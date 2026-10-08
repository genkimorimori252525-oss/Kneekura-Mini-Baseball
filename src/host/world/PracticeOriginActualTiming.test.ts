import { afterEach, expect, it } from 'vitest';
import { practiceOriginActualTimingFixture } from './PracticeOriginActualTiming.test-support';
import { readOwnedPitchPracticeAttempt } from './SqlitePitchPracticeAttemptStore';
import { witnessSqliteWrite } from './SqliteWriteWitness.test-support';

const cleanup: (() => void)[] = [];
afterEach(() => { while (cleanup.length) cleanup.pop()!(); });

it('adopts separately measured timing from genuine later practices while retaining the null origin through reopen', () => {
  const f = practiceOriginActualTimingFixture(cleanup), physical = f.practice.read(f.origin.completed.attemptId);
  const later = f.pairs.map(p => f.practice.read(p.original.attemptId));
  const raw = f.pairs.map(p => [p.normal.observation, p.quick.observation]);
  const person = f.base.snapshot('world_person_priors'), release = f.base.snapshot('world_player_release_heads');
  const workload = f.base.snapshot('world_player_workload_activities');
  const settled = f.practice.settleLearning(f.input.sourceId);
  if (settled.kind !== 'complete') throw new Error('accepted new-origin timing did not settle');
  expect(settled.source.records.at(-1)!.changeKind).toBe('SOURCE_CHANGED');
  expect(settled.source.profile.quickSpeedFactor).toBe(2.4);
  expect(f.timing.readHead('career-a', 'p1')).toEqual(settled.source);
  expect(f.practice.read(f.origin.completed.attemptId)).toEqual(physical);
  expect(f.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(f.origin.receipt);
  expect(f.pairs.map(p => f.practice.read(p.original.attemptId))).toEqual(later);
  expect(f.practice.settleLearning(f.input.sourceId)).toEqual(settled);
  f.clearAuthorities(); f.reopen();
  expect(f.timing.readHead('career-a', 'p1')).toEqual(settled.source);
  expect(f.timing.apply(f.input.sourceId, 0)).toEqual(settled.source);
  expect(f.episodes.read(f.packet.request.episodeId)!.episode).toEqual(f.input.episode);
  expect(f.practice.read(f.origin.completed.attemptId)).toEqual(physical);
  expect(f.pairs.map(p => f.practice.read(p.original.attemptId))).toEqual(later);
  expect(f.pairs.map(p => [f.practice.read(p.normal.attemptId)!.observation, f.practice.read(p.quick.attemptId)!.observation])).toEqual(raw);
  expect(f.base.snapshot('world_person_priors')).toBe(person); expect(f.base.snapshot('world_player_release_heads')).toBe(release);
  expect(f.base.snapshot('world_player_workload_activities')).toBe(workload);
  expect(f.base.count('world_roster_executions')).toBe(0); expect(f.base.count('world_pitch_timing_updates')).toBe(1);
});

it.each(['live', 'reopened'] as const)('enforces the real historical timing ceiling after new-origin adoption in %s reads', mode => {
  const f = practiceOriginActualTimingFixture(cleanup), settled = f.practice.settleLearning(f.input.sourceId);
  if (settled.kind !== 'complete') throw new Error('accepted timing prerequisite did not settle');
  const next = f.consume(f.opportunity('after-origin-timing', 19, 0, null)).attempt;
  expect(next.frame.timing.revision).toBe(1); expect(next.frame.timing.profile.quickSpeedFactor).toBe(2.4);
  if (mode === 'reopened') { f.clearAuthorities(); f.reopen(); }
  const before = f.base.snapshot('world_pitch_timing_updates');
  expect(readOwnedPitchPracticeAttempt(f.practice, f.base.db, f.origin.completed.attemptId, 0)).toEqual(f.origin.completed);
  expect(readOwnedPitchPracticeAttempt(f.practice, f.base.db, f.pairs[0].original.attemptId, 0)).toEqual(f.pairs[0].original);
  expect(() => readOwnedPitchPracticeAttempt(f.practice, f.base.db, next.attemptId, 0)).toThrow('practice proof depends on a later timing revision');
  expect(readOwnedPitchPracticeAttempt(f.practice, f.base.db, next.attemptId, 1)).toEqual(next);
  expect(f.timing.selectAtRevision('career-a', 'p1', 0)).toEqual(f.origin.completed.frame.timing);
  expect(f.timing.readHead('career-a', 'p1')).toEqual(settled.source);
  expect(f.base.snapshot('world_pitch_timing_updates')).toBe(before);
});

for (const mutation of ['deleted', 'tampered'] as const) {
  const sql = mutation === 'deleted' ? 'DELETE FROM world_development_practice_origins'
    : "UPDATE world_development_practice_origins SET origin_hash='tampered'";
  it(`rolls back accepted timing when its writer-local INSERT leaves the origin ${mutation}`, () => {
    const f = practiceOriginActualTimingFixture(cleanup);
    const tables = ['world_development_practice_origins', 'world_pitch_timing_updates', 'world_pitch_timing_heads', 'world_player_workload_activities'];
    const before = tables.map(t => f.base.snapshot(t));
    f.base.db.exec(`CREATE TRIGGER alter_origin_for_timing BEFORE INSERT ON world_pitch_timing_updates BEGIN ${sql}; END;`);
    const witness = witnessSqliteWrite(/INSERT INTO world_pitch_timing_updates\b/, db => {
      const row = db.prepare('SELECT origin_hash FROM world_development_practice_origins WHERE episode_id=?').get(f.packet.request.episodeId);
      return db !== f.base.db && Boolean(db.prepare('SELECT 1 FROM world_pitch_timing_updates WHERE source_id=?').get(f.input.sourceId))
        && (mutation === 'deleted' ? !row : row?.origin_hash === 'tampered');
    });
    try {
      expect(() => f.timing.apply(f.input.sourceId, 0)).toThrow(/origin|practice|source|evidence|binding/i);
      expect(witness.wasReached()).toBe(true);
    } finally { witness.close(); }
    expect(tables.map(t => f.base.snapshot(t))).toEqual(before);
    expect(f.practice.read(f.origin.completed.attemptId)).toEqual(f.origin.completed);
    expect(f.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(f.origin.receipt);
    f.base.db.exec('DROP TRIGGER alter_origin_for_timing');
    expect(f.practice.settleLearning(f.input.sourceId).kind).toBe('complete');
  });
  it(`rejects timing read and retry after accepted origin proof is ${mutation}, live and reopened`, () => {
    const f = practiceOriginActualTimingFixture(cleanup);
    expect(f.practice.settleLearning(f.input.sourceId).kind).toBe('complete');
    const before = f.base.snapshot('world_pitch_timing_updates');
    f.base.db.exec(sql);
    for (const reopened of [false, true]) {
      if (reopened) { f.clearAuthorities(); f.reopen(); }
      expect(() => f.timing.readHead('career-a', 'p1')).toThrow(/origin|practice|source|evidence|binding/i);
      expect(() => f.timing.apply(f.input.sourceId, 0)).toThrow(/origin|practice|source|evidence|binding/i);
      expect(f.practice.read(f.origin.completed.attemptId)).toEqual(f.origin.completed);
      expect(f.workload.readActivity(f.origin.result.activity.sourceEventId)).toEqual(f.origin.receipt);
      expect(f.base.snapshot('world_pitch_timing_updates')).toBe(before);
    }
  });
}
