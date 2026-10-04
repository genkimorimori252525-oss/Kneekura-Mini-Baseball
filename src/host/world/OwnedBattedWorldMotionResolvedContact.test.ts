import { expect, it } from 'vitest';
import { ownedBattedWorldMotionFixture as fixture } from './OwnedBattedWorldMotionFixtures.test-support';

it('preserves a resolved first-contact prefix and open continuation without inventing an unresolved contact owner', () => {
  const x = fixture(undefined, 5_000_000);
  try {
    const source = x.retain(x.first.source.sourceId, x.at + 1_500_000, 'resolved-owned-boundary');
    x.sources.set(source.sourceId, source);
    const saved = x.executions.accept(source.sourceId);
    if (saved.execution.kind !== 'owned_motion_v1') throw new Error('missing owned adoption');
    const { field, adoption, liveWork } = saved.execution;
    expect(field.motion.world.kind).toBe('boundary');
    expect(field.motion.response.kind).toBe('ground');
    expect(field.motion.cursor).not.toBeNull();
    expect(adoption.status).toBe('physical_boundary');
    expect(adoption.executedThrough.elapsedSeconds).toBe(field.motion.world.moment.elapsedSeconds);
    expect(adoption.executedThrough.elapsedSeconds).toBeLessThan((adoption.checkpointThroughTick - adoption.adoptedAt.originTick) / saved.execution.composition.ticksPerSecond);
    expect(adoption).toMatchObject({ physicalBoundary: { responseKind: 'ground', cursorAvailable: true } });
    expect(liveWork).toMatchObject({ unresolvedSuccessor: 'next_owned_physical_checkpoint', pendingDecisionHandoffs: [], queue: null });
    expect(liveWork.contributors.every(c => c.status === 'admitted_physical_coverage' && c.unexecutedTail !== null)).toBe(true);
    const continuation = x.retain(source.sourceId, adoption.executedThrough.tick + 100, 'resolved-owned-continuation');
    x.sources.set(continuation.sourceId, continuation);
    const next = x.executions.accept(continuation.sourceId);
    expect(next.execution.field.motion.world.moment.elapsedSeconds).toBeGreaterThan(adoption.executedThrough.elapsedSeconds);
    expect(x.executions.read(source.sourceId)).toEqual(saved);
    expect(liveWork).not.toHaveProperty('playEnd');
  } finally { x.f.close(); }
});
