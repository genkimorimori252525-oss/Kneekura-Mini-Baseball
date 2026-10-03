import { expect, it } from 'vitest';
import { battedWorldRunnerContactFixture } from './BattedWorldRunnerContactFixtures.test-support';
import type { AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

const observation = (fixture: ReturnType<typeof battedWorldRunnerContactFixture>, sourceId = 'first-base-rule-source', previousExecutionSourceId: string | null = null): AcceptedBattedWorldExecution => ({
  ...fixture.source, sourceId, previousExecutionSourceId, action: { kind: 'first_base_rule', geometrySourceId: fixture.geometrySource.sourceId } });

it('owns actual secured airborne catch priority before any first-base race and reopens without changing physical motion', () => {
  const fixture = battedWorldRunnerContactFixture(undefined, 'carried');
  try {
    const source = observation(fixture);
    fixture.sources.set(source.sourceId, source);
    const value = fixture.executions.accept(source.sourceId);
    expect(value.execution.kind).toBe('first_base_rule');
    if (value.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'fly_catch', correctRuleResult: { kind: 'caught' } });
    expect(value.execution.motion).toEqual(fixture.motion.motion);
    expect(value.execution).not.toHaveProperty('officialClosure');
    expect(fixture.executions.read(source.sourceId)).toEqual(value);
  } finally { fixture.f.close(); }
});
it('does not turn a free actual World horizon into ground, a secured catch, a first-base ruling or a play end', () => {
  const fixture = battedWorldRunnerContactFixture();
  try {
    const source = observation(fixture); fixture.sources.set(source.sourceId, source);
    const value = fixture.executions.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'unresolved', reason: 'catch_pending' });
    expect(value.execution.groundRule).toBe(null);
    expect(value.execution.motion).toEqual(fixture.motion.motion);
    expect(value.execution).not.toHaveProperty('playEnd');
    expect(fixture.executions.read(source.sourceId)).toEqual(value);
  } finally { fixture.f.close(); }
});
it('keeps actual ground before the base gates pending without choosing fair or a first-base result', () => {
  const fixture = battedWorldRunnerContactFixture(undefined, 'ground');
  try {
    const original = fixture.motion.response.touch.worldContact.result;
    expect(original.kind).toBe('contact');
    if (original.kind !== 'contact') throw new Error('actual ground fixture');
    expect(original.contacts).toEqual([{ kind: 'ground' }]);
    const source = observation(fixture); fixture.sources.set(source.sourceId, source);
    const value = fixture.executions.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
    expect(original.ball.position.z).toBeLessThan(fixture.geometry.geometry.bases.third.region.center.z);
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'unresolved', reason: 'fair_foul_pending' });
    expect(value.execution.groundRule).toBe(null);
    expect(value.execution).not.toHaveProperty('officialClosure');
    expect(fixture.executions.read(source.sourceId)).toEqual(value);
  } finally { fixture.f.close(); }
});
it('uses a later actual fielder touch after ground to establish fair eligibility and invoke the owned first-base RuleEngine', () => {
  const fixture = battedWorldRunnerContactFixture(undefined, 'ground');
  try {
    const current = fixture.motion.motion.world.moment, tps = fixture.motion.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    const glove = fixture.motion.motion.actors.find((actor) => actor.playerId === 'p2' && actor.primitive.role === 'glove')!;
    const local = (current.originTick - glove.primitive.startTick) / tps + current.elapsedSeconds - (glove.startElapsedSeconds ?? 0);
    const dt = 0.02, gravity = fixture.motion.response.touch.worldContact.flight.source.execution.ballFlightParameters.gravityY;
    const acceleration = (axis: 'x' | 'y' | 'z') => {
      const segment = glove.primitive, position = segment.startCenter[axis] + segment.startVelocity[axis] * local + 0.5 * segment.acceleration[axis] * local * local;
      const velocity = segment.startVelocity[axis] + segment.acceleration[axis] * local;
      const target = current.ball.position[axis] + current.ball.velocity[axis] * dt + (axis === 'y' ? 0.5 * gravity * dt * dt : 0);
      return 2 * (target - position - velocity * dt) / (dt * dt);
    };
    const commands = fixture.motionSource.commands.map((command) => command.playerId !== 'p2' ? command : { ...command,
      primitiveMotions: command.primitiveMotions.map((motor) => motor.role !== 'glove' ? motor : { ...motor,
        offsetAcceleration: { x: acceleration('x') - command.bodyAcceleration.x, y: acceleration('y') - command.bodyAcceleration.y,
          z: acceleration('z') - command.bodyAcceleration.z } }) });
    const movement: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-ground-fielding-motion',
      action: { kind: 'motion', availableAtTick: current.ball.tick, throughTick: current.ball.tick + 40_000, commands } };
    fixture.sources.set(movement.sourceId, movement); const moved = fixture.executions.accept(movement.sourceId);
    if (moved.execution.kind !== 'motion' || moved.execution.motion.world.kind !== 'boundary') throw new Error('actual fielding boundary fixture');
    expect(moved.execution.motion.world.contacts).toMatchObject([{ kind: 'actor', playerId: 'p2', role: 'glove' }]);
    const source = observation(fixture, 'first-base-rule-after-fielding', movement.sourceId); fixture.sources.set(source.sourceId, source);
    const value = fixture.executions.accept(source.sourceId);
    if (value.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
    expect(value.execution.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair', firstFielderTouch: {
      fielderId: 'p2', tick: moved.execution.motion.world.moment.ball.tick } });
    expect(value.execution.groundRule?.physicalFacts).toMatchObject({ batterRunnerId: fixture.batter.binding.playerId,
      outsAtStart: fixture.motion.response.touch.worldContact.flight.physicalPitch.frame.match.outs, homeTouches: [] });
    expect(value.execution.groundRule?.correctRuleResult.kind).toBe('unresolved');
    expect(value.execution.motion).toEqual(moved.execution.motion);
    expect(fixture.executions.read(source.sourceId)).toEqual(value);
  } finally { fixture.f.close(); }
});
it('keeps an observation pending until actual capture completes, then preserves the old interpretation', () => {
  const fixture = battedWorldRunnerContactFixture(undefined, 'candidate');
  try {
    const before = observation(fixture); fixture.sources.set(before.sourceId, before);
    const pending = fixture.executions.accept(before.sourceId);
    if (pending.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
    expect(pending.execution.ballEvidence).toMatchObject({ kind: 'unresolved', reason: 'catch_pending' });
    const acquire: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-rule-acquire',
      previousExecutionSourceId: before.sourceId, action: { kind: 'acquisition' } };
    fixture.sources.set(acquire.sourceId, acquire); const actual = fixture.executions.accept(acquire.sourceId);
    if (actual.execution.kind !== 'acquisition' || actual.execution.acquisition.kind !== 'secured') throw new Error('secured fixture');
    const after = observation(fixture, 'rule-after-actual-capture', acquire.sourceId); fixture.sources.set(after.sourceId, after);
    const resolved = fixture.executions.accept(after.sourceId);
    if (resolved.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
    expect(resolved.execution.ballEvidence).toMatchObject({ kind: 'fly_catch', correctRuleResult: {
      kind: 'caught', outTick: actual.execution.acquisition.secureTick } });
    expect(resolved.execution.batterFirstBase.history.endElapsedSeconds).toBe(actual.execution.acquisition.moment.elapsedSeconds);
    expect(fixture.executions.read(before.sourceId)).toEqual(pending);
    expect(fixture.executions.read(after.sourceId)).toEqual(resolved);
  } finally { fixture.f.close(); }
});
it.each([[0.04, 0.05, 'out'], [0.05, 0.04, 'safe'], [0.04, 0.04, 'simultaneous']] as const)(
  'derives %s/%s actual first-base arrival race after real ground and secured pickup: %s', (defenderSeconds, batterSeconds, resultKind) => {
    const fixture = battedWorldRunnerContactFixture(undefined, 'ground_candidate');
    try {
      const initial = fixture.motion.response.touch.worldContact.result;
      expect(initial.kind).toBe('contact');
      if (initial.kind !== 'contact') throw new Error('actual ground pickup fixture');
      expect(initial.contacts).toEqual([{ kind: 'ground' }]);
      const acquire: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-ground-pickup', action: { kind: 'acquisition' } };
      fixture.sources.set(acquire.sourceId, acquire); const acquired = fixture.executions.accept(acquire.sourceId);
      if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('actual pickup secured fixture');
      const secure = acquired.execution.acquisition.moment, tps = fixture.motion.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
      const first = fixture.geometry.geometry.bases.first.region.center;
      const commands = fixture.motionSource.commands.map((command) => {
        if (command.playerId !== 'p2' && command.playerId !== fixture.batter.binding.playerId) return command;
        const dt = command.playerId === 'p2' ? defenderSeconds : batterSeconds;
        const foot = acquired.execution.motion.actors.find((actor) => actor.playerId === command.playerId && actor.primitive.role === 'left_foot')!;
        const local = (secure.originTick - foot.primitive.startTick) / tps + secure.elapsedSeconds - (foot.startElapsedSeconds ?? 0);
        const acceleration = (axis: 'x' | 'y' | 'z') => {
          const p = foot.primitive, center = p.startCenter[axis] + p.startVelocity[axis] * local + 0.5 * p.acceleration[axis] * local ** 2;
          const velocity = p.startVelocity[axis] + p.acceleration[axis] * local, target = axis === 'y' ? 0 : first[axis];
          return 2 * (target - center - velocity * dt) / dt ** 2 - command.bodyAcceleration[axis];
        };
        return { ...command, primitiveMotions: command.primitiveMotions.map((motor) => motor.role !== 'left_foot' ? motor : { ...motor,
          offsetAcceleration: { x: acceleration('x'), y: acceleration('y'), z: acceleration('z') } }) };
      });
      // Explicit synthetic sole motors exercise actual World and complete owned history, not production ability generation.
      const move: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-ground-race-feet', previousExecutionSourceId: acquire.sourceId,
        action: { kind: 'motion', availableAtTick: secure.ball.tick, throughTick: secure.ball.tick + 60_000, commands } };
      fixture.sources.set(move.sourceId, move); const moved = fixture.executions.accept(move.sourceId);
      expect(moved.execution.motion.world.kind).toBe('moving');
      const source = observation(fixture, 'rule-after-actual-ground-race', move.sourceId);
      fixture.sources.set(source.sourceId, source); const value = fixture.executions.accept(source.sourceId);
      if (value.execution.kind !== 'first_base_rule') throw new Error('first-base interpretation fixture');
      expect(value.execution.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair', pendingContacts: [] });
      expect(value.execution.defendersFirstBase.flatMap((d) => d.controlledContacts)).toHaveLength(1);
      expect(value.execution.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe(resultKind);
      expect(value.execution.groundRule?.correctRuleResult.kind).toBe(resultKind === 'simultaneous' ? 'unresolved' : 'resolved');
      expect(value.execution.groundRule?.physicalFacts).toMatchObject({ batterRunnerId: fixture.batter.binding.playerId,
        defenderControl: { defenderId: 'p2', base: 1 }, batterRunnerTouch: { runnerId: fixture.batter.binding.playerId, base: 1 }, homeTouches: [] });
      expect(value.execution).not.toHaveProperty('officialClosure');
      expect(fixture.executions.read(source.sourceId)).toEqual(value);
    } finally { fixture.f.close(); }
  });
it.each(['geometry', 'desired_fair', 'desired_ground', 'desired_catch', 'desired_result', 'transported_facts'] as const)('rejects %s outside the owned first-base interpretation Source', (kind) => {
  const fixture = battedWorldRunnerContactFixture(undefined, 'carried');
  try {
    const source = observation(fixture), action = kind === 'geometry' ? { ...source.action, geometrySourceId: 'missing' }
      : { ...source.action, [kind]: true };
    fixture.sources.set(source.sourceId, { ...source, action });
    expect(() => fixture.executions.accept(source.sourceId)).toThrow();
    expect(fixture.executions.read(source.sourceId)).toBe(null);
  } finally { fixture.f.close(); }
});
