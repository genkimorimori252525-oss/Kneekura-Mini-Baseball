import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { battedWorldExecutionFixture as fixture } from './BattedWorldExecutionFixtures.test-support';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';

const path = () => join(mkdtempSync(join(tmpdir(), 'batted-execution-wal-')), 'state.sqlite');
it.each([
  ['motion', "UPDATE batted_world_motions SET source_hash='changed';"],
  ['motion_head', 'UPDATE batted_world_motion_heads SET revision=revision+1;'],
  ['response', "UPDATE batted_contact_responses SET snapshot_hash='changed';"],
  ['model', "UPDATE batted_contact_response_models SET source_hash='changed';"],
  ['person', "UPDATE world_player_person_links SET person_id='changed';"],
  ['physical', "UPDATE physical_pitch_progress_actions SET source_hash='changed';"],
  ['workload', 'UPDATE world_player_workload_heads SET revision=revision+1;'],
  ['source', "UPDATE batted_world_executions SET source_hash='changed';"],
  ['mirror', "UPDATE batted_world_executions SET physical_pitch_source_id='wrong';"],
  ['head', 'UPDATE batted_world_execution_heads SET revision=revision+1;'],
  ['archive', 'DELETE FROM batted_world_executions;'],
])('rolls back late %s mutation after the actual execution head insert', (_kind, sql) => {
  const { f, motions, motion, executions, source } = fixture(path());
  try {
    f.db.exec(`CREATE TRIGGER mutate_execution AFTER INSERT ON batted_world_execution_heads BEGIN ${sql} END`);
    expect(() => executions.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_execution_heads').get()).toEqual({ n: 0 });
    expect(motions.read(motion.source.sourceId)).toEqual(motion);
    f.db.exec('DROP TRIGGER mutate_execution'); expect(executions.accept(source.sourceId).revision).toBe(1);
  } finally { f.close(); }
});
it('checks its original root after a cached peer mutates that root before the transaction', () => {
  const { f, motion, source, authority } = fixture(path());
  try {
    const changed = f.track(openSqliteBattedWorldExecutionStore(f.path, { read: () => {
      f.db.exec("UPDATE batted_world_motions SET snapshot_hash='changed'"); return motion;
    } }, authority));
    expect(() => changed.accept(source.sourceId)).toThrow();
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { f.close(); }
});
it('re-reads its own complete prefix after an identical retry authority changes the head', () => {
  const { f, motions, executions, source } = fixture(path());
  try {
    executions.accept(source.sourceId);
    const changed = f.track(openSqliteBattedWorldExecutionStore(f.path, motions, { readAcceptedExecution: () => {
      f.db.exec('UPDATE batted_world_execution_heads SET revision=revision+1'); return source;
    } }));
    expect(() => changed.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('preserves historical execution after legitimate workload recovery but rejects a fresh stale append', () => {
  const { f, executions, source, sources } = fixture(path());
  try {
    const value = executions.accept(source.sourceId), rest = { sourceEventId: 'execution-rest', sourceVersion: 'fixture-v1', evidenceId: 'actual-rest',
      careerId: 'career-a', playerId: 'p2', atDay: 11, kind: 'RECOVERY' as const, durationHours: 8, quality: 1, medicalAvailability: 1 };
    f.activities.set(rest.sourceEventId, rest); f.workload.apply(rest.sourceEventId, 0);
    expect(executions.read(source.sourceId)).toEqual(value); expect(executions.accept(source.sourceId)).toEqual(value);
    if (source.action.kind !== 'motion') throw new Error('motion fixture');
    const next = { ...source, sourceId: 'stale-execution', previousExecutionSourceId: source.sourceId,
      action: { ...source.action, throughTick: source.action.throughTick + 1000 } };
    sources.set(next.sourceId, next); expect(() => executions.accept(next.sourceId)).toThrow(/workload/);
  } finally { f.close(); }
});
it('rolls back a lower motion when an execution owner appears after its actual insert', () => {
  const { f, motions, motionSource, motionSources } = fixture(path());
  try {
    const next = { ...motionSource, sourceId: 'lower-before-execution', previousMotionSourceId: motionSource.sourceId, throughTick: motionSource.throughTick + 1000 };
    motionSources.set(next.sourceId, next);
    f.db.exec(`CREATE TRIGGER introduce_execution AFTER INSERT ON batted_world_motions BEGIN
      INSERT INTO batted_world_execution_heads VALUES (NEW.physical_pitch_source_id,NEW.source_id,'orphan-execution',1); END`);
    expect(() => motions.accept(next.sourceId)).toThrow(/execution owner/);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 1 });
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_execution_heads').get()).toEqual({ n: 0 });
    f.db.exec('DROP TRIGGER introduce_execution'); expect(motions.accept(next.sourceId).revision).toBe(2);
  } finally { f.close(); }
});
