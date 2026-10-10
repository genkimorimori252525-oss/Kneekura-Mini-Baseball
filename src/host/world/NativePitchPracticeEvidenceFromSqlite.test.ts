import { createRequire } from 'node:module';
import { afterEach, expect, it } from 'vitest';
import { practiceFixture } from './PitchPracticeAttempt.test-support';
import { practiceOrderFixture } from './OwnedPitchPracticeOrder.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });
const native = async () => import('./NativePitchPracticeEvidenceFromSqlite');
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

it('replays consumed standalone practice after every writer closes, without installing schema', async () => {
  const f = await practiceFixture(cleanup);
  f.opportunities.set(f.opportunity.sourceId, { ...f.opportunity, episode: null });
  const completed = f.assess(f.complete());
  f.owner.settle(completed.attemptId);
  f.close();
  const db = new DatabaseSync(f.path); cleanup.push(() => db.close());
  const schema = db.prepare('SELECT * FROM sqlite_master ORDER BY name').all();
  const before = db.prepare('SELECT total_changes() AS n').get();
  const reader = await native();
  db.exec('BEGIN');
  try {
    expect(reader.readNativePitchPracticeAttemptFromSqlite(db, completed.attemptId)).toEqual(completed);
    expect(db.prepare('SELECT * FROM sqlite_master ORDER BY name').all()).toEqual(schema);
    expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
    db.exec("UPDATE world_player_release_heads SET state_json='{}'");
    expect(reader.readNativePitchPracticeAttemptFromSqlite(db, completed.attemptId)).toEqual(completed);
    db.exec("UPDATE world_pitch_timing_baselines SET initial_json='{}'");
    expect(() => reader.readNativePitchPracticeAttemptFromSqlite(db, completed.attemptId)).toThrow();
  } finally { db.exec('ROLLBACK'); }
});

it('retains the issued order and original World event after its writer closes', async () => {
  const f = await practiceOrderFixture(cleanup), order = f.issue(), begun = f.base.owner.begin(order.sourceId);
  f.base.close();
  const db = new DatabaseSync(f.base.path); cleanup.push(() => db.close());
  const reader = await native();
  db.exec('BEGIN');
  try {
    expect(reader.readNativePitchPracticeAttemptFromSqlite(db, begun.attemptId)).toEqual(begun);
    db.prepare('UPDATE world_decision_revision_events SET event_json=? WHERE source_event_id=?').run('{}', order.sourceId);
    expect(() => reader.readNativePitchPracticeAttemptFromSqlite(db, begun.attemptId)).toThrow(/order|World|evidence/);
  } finally { db.exec('ROLLBACK'); }
});

it('authenticates the original repetition and episode on a reopened Native snapshot', async () => {
  const f = await practiceFixture(cleanup), completed = f.assess(f.complete());
  const settled = f.owner.settle(completed.attemptId);
  if (settled.kind !== 'complete') throw new Error('fixture practice did not settle');
  f.close();
  const db = new DatabaseSync(f.path); cleanup.push(() => db.close());
  const reader = await native();
  db.exec('BEGIN');
  try {
    expect(reader.readNativePitchPracticeRepetitionFromSqlite(db, settled.activity.sourceEventId)).toMatchObject({
      episodeId: 'episode', careerId: 'career-a', playerId: 'p1', fatigue: 0.2, healthAvailability: 0.9,
      event: { sourceEventId: settled.activity.sourceEventId, kind: 'PRACTICE_RECORDED' },
    });
    db.prepare('UPDATE world_development_learning_events SET state_json=? WHERE source_id=?').run('{}', settled.activity.sourceEventId);
    expect(() => reader.readNativePitchPracticeRepetitionFromSqlite(db, settled.activity.sourceEventId)).toThrow();
  } finally { db.exec('ROLLBACK'); }
});

it('requires the callers real Native transaction before reading a practice proof', async () => {
  const reader = await native(), db = new DatabaseSync(':memory:'); cleanup.push(() => db.close());
  expect(() => reader.readNativePitchPracticeAttemptFromSqlite(db, 'attempt')).toThrow(/Native.*transaction/);
  expect(() => reader.readNativePitchPracticeRepetitionFromSqlite({ prepare: db.prepare.bind(db) } as never, 'event')).toThrow(/Native.*transaction/);
});
