import { expect, it } from 'vitest';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';
import { installOwnedScheduledDecision } from './OwnedScheduledMotionDecisionFixtures.test-support';
import { actualPlayerKinematicsFromPrefix, type ActualPlayerKinematics } from './ActualPlayerKinematicsFromPrefix';
import { wholePlayPhysicalHistoryFromPrefix } from './WholePlayPhysicalHistoryFromPrefix';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';

const canonicalState = (self: ActualPlayerKinematics, role: ActualPlayerKinematics['roles'][number]) => {
  const actor = role.canonicalActor, p = actor.primitive;
  const dt = self.at.elapsedSeconds - ((p.startTick - self.at.originTick) / self.ticksPerSecond + (actor.startElapsedSeconds ?? 0));
  const sample = (part: 'position' | 'velocity') => {
    const value = (axis: 'x' | 'y' | 'z') => part === 'position'
      ? p.startCenter[axis] + p.startVelocity[axis] * dt + 0.5 * p.acceleration[axis] * dt * dt
      : p.startVelocity[axis] + p.acceleration[axis] * dt;
    return { x: value('x'), y: value('y'), z: value('z') };
  };
  return { position: sample('position'), velocity: sample('velocity') };
};

it('keeps retained Player command authority and all fifty parts through three mixed owned rebases', () => {
  let retainedId = '';
  const x = ownedScheduledMotionFixture(undefined, 10_000, undefined, world => {
    retainedId = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find(b => b.playerId !== 'p2')!.playerId;
    const source = world.sources.get(world.source.sourceId)!;
    const batter = world.flight.physicalPitch.frame.batterActor!.binding.playerId;
    world.sources.set(source.sourceId, { ...source, commands: source.commands.map(c => c.playerId === batter ? { ...c, bodyAcceleration: { x: 0.03, y: 0.02, z: -0.01 } } : c.playerId !== retainedId ? c : { ...c,
      bodyAcceleration: { x: 0.1, y: 0, z: 0.3 }, primitiveMotions: c.primitiveMotions.map((p, i) => ({ ...p,
        offsetVelocity: { x: 0.02 * (i + 1), y: 0.01 * (i + 1), z: -0.03 * (i + 1) },
        offsetAcceleration: { x: 0.1, y: -0.2, z: 0.3 } })) }) });
  });
  try {
    const planned = x.plan('mixed-owned-plan');
    if (planned.execution.kind !== 'owned_acquisition_plan_v1') throw new Error('fixture');
    const plan = planned.execution.plan;
    let current = x.step('mixed-owned-init', planned.source.sourceId,
      { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: plan.contactMoment.elapsedSeconds });
    const origin = plan.contactMoment.originTick, tps = plan.input.response.world.parameters.ticksPerSecond;
    current = x.step('mixed-owned-integer-cut', current.source.sourceId, { kind: 'operation', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: (plan.contactMoment.ball.tick + 1 - origin) / tps });
    const before = x.selves(current.source.sourceId), original = new Map(before.map(s => [s.playerId, s]));
    const batter = x.baseField.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId;
    expect(original.get(batter)!.root.velocity.y).not.toBe(0);
    expect(original.get(retainedId)!.roles.some(p => Object.values(p.relativeVelocity).some(v => v !== 0))).toBe(true);
    const selected = x.playerIds.filter(id => id !== batter && id !== plan.acquirerPlayerId && id !== retainedId).slice(0, 3);
    for (const [i, playerId] of selected.entries()) {
      const previous = x.selves(current.source.sourceId), chain = installOwnedScheduledDecision(x, playerId, current.source.sourceId);
      const motor = chain.issue(current.source.sourceId);
      expect(motor.receipt.self.at).toEqual(previous.find(s => s.playerId === playerId)!.at);
      const now = previous[0].at.elapsedSeconds;
      current = x.step(`mixed-owned-rebase-${i}`, current.source.sourceId,
        { kind: 'operation', planSourceId: planned.source.sourceId, throughElapsedSeconds: now }, [playerId]);
      const prefix = x.prefix(current.source.sourceId), selves = x.selves(current.source.sourceId);
      expect(battedWorldFieldPhysicalPrefix(prefix).segments.at(-1)!.actors).toHaveLength(50);
      for (const self of selves) {
        const prior = previous.find(s => s.playerId === self.playerId)!;
        expect(self.root.position).toEqual(prior.root.position);
        expect(self.root.velocity).toEqual(prior.root.velocity);
        expect(self.roles.map(p => p.declaredPose)).toEqual(prior.roles.map(p => p.declaredPose));
        for (const role of self.roles) {
          const previousRole = prior.roles.find(p => p.role === role.role)!;
          const currentState = canonicalState(self, role), previousState = canonicalState(prior, previousRole);
          for (const part of ['position', 'velocity'] as const) for (const axis of ['x', 'y', 'z'] as const) {
            expect(currentState[part][axis]).toBeCloseTo(previousState[part][axis], 12);
          }
        }
        expect(self.adoptions).toHaveLength(prior.adoptions.length + (self.playerId === playerId ? 1 : 0));
        if (self.playerId !== playerId) {
          expect(self.activeCommand).toEqual(prior.activeCommand);
          expect(self.ownedMotionCoverage?.rootAuthority.acceptedThroughTick).toBe(prior.ownedMotionCoverage?.rootAuthority.acceptedThroughTick ?? prior.activeCommand.acceptedThroughTick);
        }
        expect(self.ownedMotionCoverage?.compositionSourceId).toBe(current.source.sourceId);
        expect(self.roles.every(p => p.canonicalActor.primitive.endTick === self.ownedMotionCoverage!.physicalThroughTick)).toBe(true);
      }
      const observer = { ...x.source, sourceId: `mixed-observer-${i}`, previousExecutionSourceId: current.source.sourceId, action: { kind: 'whole_play_history' as const } };
      x.sources.set(observer.sourceId, observer); current = x.executions.accept(observer.sourceId);
    }
    current = x.step('mixed-owned-retained-progress', current.source.sourceId, { kind: 'operation', planSourceId: planned.source.sourceId,
      throughElapsedSeconds: (before[0].at.tick + 1 - origin) / tps });
    const finalPrefix = x.prefix(current.source.sourceId), history = wholePlayPhysicalHistoryFromPrefix(finalPrefix);
    const retained = actualPlayerKinematicsFromPrefix(retainedId, finalPrefix), originalRetained = original.get(retainedId)!;
    expect(retained.adoptions.map(({ executedThrough: _, ...a }) => a)).toEqual(originalRetained.adoptions.map(({ executedThrough: _, ...a }) => a));
    expect(retained.activeCommand.sourceId).toBe(originalRetained.activeCommand.sourceId);
    expect(retained.activeCommand.acceptedThroughTick).toBe(originalRetained.activeCommand.acceptedThroughTick);
    const dt = retained.at.elapsedSeconds - originalRetained.at.elapsedSeconds;
    expect(dt).toBeGreaterThan(0);
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(retained.root.position[axis]).toBeCloseTo(originalRetained.root.position[axis] + originalRetained.root.velocity[axis] * dt
        + 0.5 * originalRetained.root.acceleration[axis] * dt * dt, 12);
      expect(retained.root.velocity[axis]).toBeCloseTo(originalRetained.root.velocity[axis] + originalRetained.root.acceleration[axis] * dt, 12);
    }
    for (const role of retained.roles) {
      const originalRole = originalRetained.roles.find(p => p.role === role.role)!;
      expect(role.declaredPose.relativeAcceleration).toEqual(originalRole.declaredPose.relativeAcceleration);
      const sampled = canonicalState(retained, role);
      for (const axis of ['x', 'y', 'z'] as const) {
        expect(role.declaredPose.offset[axis]).toBeCloseTo(originalRole.declaredPose.offset[axis]
          + originalRole.declaredPose.relativeVelocity[axis] * dt + 0.5 * originalRole.declaredPose.relativeAcceleration[axis] * dt * dt, 12);
        expect(role.declaredPose.relativeVelocity[axis]).toBeCloseTo(originalRole.declaredPose.relativeVelocity[axis]
          + originalRole.declaredPose.relativeAcceleration[axis] * dt, 12);
        expect(sampled.position[axis]).toBeCloseTo(retained.root.position[axis] + role.offset[axis], 12);
        expect(sampled.velocity[axis]).toBeCloseTo(retained.root.velocity[axis] + role.relativeVelocity[axis], 12);
      }
    }
    expect(history.observations).toHaveLength(3);
    expect(history.end.kind).toBe('unestablished');
    expect(x.f.db.prepare('SELECT count(*) AS n FROM actual_locomotion_receipts').get()!.n).toBe(3);
  } finally { x.f.close(); }
});
