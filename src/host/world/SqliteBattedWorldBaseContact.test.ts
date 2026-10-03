import { expect, it } from 'vitest';
import { battedWorldBaseContactFixture } from './BattedWorldBaseContactFixtures.test-support';
import { openSqliteBattedWorldExecutionStore, type AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

it('derives actual secured continuous foot contact from own fixture geometry and execution', () => {
  const g = battedWorldBaseContactFixture(); try {
    const value = g.executions.accept(g.source.sourceId);
    expect(value.execution.kind).toBe('base_contact');
    if (value.execution.kind !== 'base_contact') throw new Error('actual base contact fixture');
    expect(value.execution.geometry).toEqual(g.geometry);
    expect(value.execution.contact?.playerId).toBe(g.motion.motion.carrierPlayerId);
    expect(value.execution.contact?.tick).toBe(g.motion.acquisition!.result.kind === 'secured' ? g.motion.acquisition!.result.secureTick : -1);
    expect(value.execution.motion).toEqual(g.motion.motion);
    expect(value.execution).not.toHaveProperty('out'); expect(value.execution).not.toHaveProperty('safe');
    g.sources.clear(); expect(g.executions.accept(g.source.sourceId)).toEqual(value);
    const reopened = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => null }));
    expect(reopened.read(g.source.sourceId)).toEqual(value);
  } finally { g.f.close(); }
});
it('reports absent physical base contact without inventing a ruling', () => {
  const g = battedWorldBaseContactFixture(); try {
    g.sources.set(g.source.sourceId, { ...g.source, action: { kind: 'base_contact', geometrySourceId: g.geometrySource.sourceId, base: 'first' } } as unknown as AcceptedBattedWorldExecution);
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'base_contact') throw new Error('actual base contact fixture');
    expect(value.execution.contact).toBeNull(); expect(value.execution.motion).toEqual(g.motion.motion);
  } finally { g.f.close(); }
});
it('preserves the old physical contact when a later actual carried motion continues', () => {
  const g = battedWorldBaseContactFixture(); try {
    const first = g.executions.accept(g.source.sourceId);
    const next: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'after-base-contact', previousExecutionSourceId: first.source.sourceId,
      action: { kind: 'motion', availableAtTick: first.execution.motion.world.moment.ball.tick,
        throughTick: first.execution.motion.world.moment.ball.tick + 1000, commands: g.motionSource.commands } };
    g.sources.set(next.sourceId, next); const later = g.executions.accept(next.sourceId);
    expect(later.revision).toBe(2); expect(later.execution.motion.carrierPlayerId).toBe(first.execution.motion.carrierPlayerId);
    expect(g.executions.read(first.source.sourceId)).toEqual(first);
  } finally { g.f.close(); }
});
it('rejects an actual free segment that has no owned secured possession', () => {
  const g = battedWorldBaseContactFixture(undefined, false); try {
    expect(() => g.executions.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { g.f.close(); }
});
it.each(['missing', 'base', 'caller_result'] as const)('rejects invalid %s controlled base Source', (kind) => {
  const g = battedWorldBaseContactFixture(); try {
    g.sources.set(g.source.sourceId, { ...g.source, action: { kind: 'base_contact',
      geometrySourceId: kind === 'missing' ? 'missing-geometry' : g.geometrySource.sourceId, base: kind === 'base' ? 'fifth' : 'home',
      ...(kind === 'caller_result' ? { out: true } : {}) } } as unknown as AcceptedBattedWorldExecution);
    expect(() => g.executions.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { g.f.close(); }
});
