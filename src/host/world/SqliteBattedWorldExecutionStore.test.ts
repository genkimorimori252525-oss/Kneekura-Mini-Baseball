import { expect, it } from 'vitest';
import { battedWorldExecutionFixture as fixture } from './BattedWorldExecutionFixtures.test-support';
import { openSqliteBattedWorldExecutionStore } from './SqliteBattedWorldExecutionStore';

it.each(['free', 'carried', 'candidate'] as const)('owns %s execution from its actual motion root and reopens immutable evidence', (kind) => {
  const { f, motions, motion, executions, source } = fixture(undefined, kind);
  try {
    const value = executions.accept(source.sourceId);
    expect(value.revision).toBe(1); expect(value.baseMotion).toEqual(motion); expect(value.history).toEqual([source]);
    if (kind === 'candidate') {
      expect(value.execution.kind).toBe('acquisition');
      if (value.execution.kind !== 'acquisition') throw new Error('acquisition fixture');
      expect(value.execution.acquisition.kind).toBe('secured');
      expect(value.execution.acquisition.acquirerPlayerId).not.toBe('p2');
      expect(value.execution.acquisition.contactMoment).toEqual(motion.motion.world.moment);
    } else {
      expect(value.execution.kind).toBe('motion');
      if (value.execution.kind !== 'motion') throw new Error('motion fixture');
      expect(value.execution.motion.response.kind).toBe(kind === 'carried' ? 'carried' : 'moving');
    }
    const reopened = f.track(openSqliteBattedWorldExecutionStore(f.path, motions));
    expect(reopened.read(source.sourceId)).toEqual(value); expect(reopened.accept(source.sourceId)).toEqual(value);
    expect(motions.read(motion.source.sourceId)).toEqual(motion);
    expect(value).not.toHaveProperty('playEnd'); expect(value).not.toHaveProperty('out');
  } finally { f.close(); }
});
it('adopts only World-proven later acquisition and continues carried movement from its actual secure moment', () => {
  const { f, motion, motionSource, sources, executions, source } = fixture(undefined, 'candidate');
  try {
    const acquired = executions.accept(source.sourceId);
    if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('acquisition fixture');
    const result = acquired.execution.acquisition;
    const next = { ...source, sourceId: 'execution-2', previousExecutionSourceId: source.sourceId,
      action: { kind: 'motion' as const, commands: motionSource.commands, availableAtTick: result.secureTick, throughTick: result.secureTick + 1000 } };
    sources.set(next.sourceId, next);
    const carried = executions.accept(next.sourceId);
    expect(carried.history).toEqual([source, next]); expect(carried.revision).toBe(2);
    if (carried.execution.kind !== 'motion') throw new Error('motion fixture');
    expect(carried.execution.motion.response.kind).toBe('carried');
    expect(carried.execution.motion.carrierPlayerId).toBe(result.acquirerPlayerId);
    expect(carried.execution.motion.actors[0].startElapsedSeconds).toBe(result.moment.elapsedSeconds);
    expect(executions.read(source.sourceId)).toEqual(acquired); expect(executions.accept(source.sourceId)).toEqual(acquired);
    expect(motion.motion.response.kind).toBe('capture_candidate'); expect(motion.motion.cursor).toBeNull();
  } finally { f.close(); }
});
it.each([
  "UPDATE batted_world_executions SET source_hash='changed'",
  "UPDATE batted_world_executions SET snapshot_hash='changed'",
  "UPDATE batted_world_executions SET base_motion_source_id='wrong'",
  'UPDATE batted_world_executions SET revision=revision+1',
  'DELETE FROM batted_world_execution_heads',
  "UPDATE batted_world_motions SET snapshot_hash='changed'",
])('re-derives the own complete execution/root prefix on read and retry: %s', (sql) => {
  const { f, executions, source } = fixture();
  try { executions.accept(source.sourceId); f.db.exec(sql);
    expect(() => executions.read(source.sourceId)).toThrow(); expect(() => executions.accept(source.sourceId)).toThrow();
  } finally { f.close(); }
});
it('rejects transported results, incomplete motion commands and acquisition without an actual candidate', () => {
  const { f, executions, source, sources } = fixture();
  try {
    for (const property of ['ball', 'actors', 'possession', 'result', 'secureTick']) {
      sources.set(source.sourceId, { ...source, [property]: {} }); expect(() => executions.accept(source.sourceId)).toThrow();
    }
    if (source.action.kind !== 'motion') throw new Error('motion fixture');
    sources.set(source.sourceId, { ...source, action: { ...source.action, commands: [] } }); expect(() => executions.accept(source.sourceId)).toThrow();
    sources.set(source.sourceId, { ...source, action: { kind: 'acquisition' } }); expect(() => executions.accept(source.sourceId)).toThrow(/candidate/);
  } finally { f.close(); }
});
it('fences fresh lower motion after the execution owns the future while retaining original reads/retries', () => {
  const { f, executions, source, motions, motion, motionSource, motionSources } = fixture();
  try {
    executions.accept(source.sourceId);
    const next = { ...motionSource, sourceId: 'stale-lower-motion', previousMotionSourceId: motionSource.sourceId,
      availableAtTick: motion.motion.world.moment.ball.tick, throughTick: motionSource.throughTick + 2000 };
    motionSources.set(next.sourceId, next);
    expect(() => motions.accept(next.sourceId)).toThrow(/owner/);
    expect(motions.read(motion.source.sourceId)).toEqual(motion); expect(motions.accept(motion.source.sourceId)).toEqual(motion);
    expect(f.db.prepare('SELECT count(*) AS n FROM batted_world_motions').get()).toEqual({ n: 1 });
  } finally { f.close(); }
});
