import { expect, it } from 'vitest';
import { battedWorldRunnerContactFixture as fixture } from './BattedWorldRunnerContactFixtures.test-support';
import { openSqliteBattedWorldExecutionStore, type AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

it.each(['free', 'carried'] as const)('owns actual registered batter contact over the %s World segment and reopens', (kind) => {
  const g = fixture(undefined, kind); try {
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'runner_base_touch') throw new Error('actual runner contact fixture');
    expect(value.execution.contact?.playerId).toBe(g.batter.binding.playerId);
    expect(value.execution.geometry).toEqual(g.geometry); expect(value.execution.motion).toEqual(g.motion.motion);
    expect(value.execution.base).toBe('home'); expect(value.execution).not.toHaveProperty('safe'); expect(value.execution).not.toHaveProperty('basesAfter');
    g.sources.clear(); expect(g.executions.accept(g.source.sourceId)).toEqual(value);
    const reopened = g.f.track(openSqliteBattedWorldExecutionStore(g.f.path, { read: () => null }));
    expect(reopened.read(g.source.sourceId)).toEqual(value);
  } finally { g.f.close(); }
});
it('records no touch when the actual batter feet do not reach the requested base', () => {
  const g = fixture(); try {
    g.sources.set(g.source.sourceId, { ...g.source, action: { kind: 'runner_base_touch', geometrySourceId: g.geometrySource.sourceId,
      playerId: g.batter.binding.playerId, base: 'first' } });
    const value = g.executions.accept(g.source.sourceId);
    if (value.execution.kind !== 'runner_base_touch') throw new Error('actual runner contact fixture');
    expect(value.execution.contact).toBeNull(); expect(value.execution.motion).toEqual(g.motion.motion);
  } finally { g.f.close(); }
});
it('continues actual motion after observation without resetting the batter or ball', () => {
  const g = fixture(); try {
    const first = g.executions.accept(g.source.sourceId), next: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'after-runner-touch',
      previousExecutionSourceId: first.source.sourceId, action: { kind: 'motion', availableAtTick: first.execution.motion.world.moment.ball.tick,
        throughTick: first.execution.motion.world.moment.ball.tick + 1000, commands: g.motionSource.commands } };
    g.sources.set(next.sourceId, next); const later = g.executions.accept(next.sourceId);
    expect(later.revision).toBe(2); expect(g.executions.read(first.source.sourceId)).toEqual(first);
    expect(later.history).toEqual([first.source, next]);
  } finally { g.f.close(); }
});
it('retains a real glove candidate through runner observation, then owns acquisition and carried motion', () => {
  const g = fixture(undefined, 'candidate'); try {
    const first = g.executions.accept(g.source.sourceId);
    expect(first.execution.motion.response.kind).toBe('capture_candidate');
    const acquire: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'acquire-after-touch', previousExecutionSourceId: first.source.sourceId, action: { kind: 'acquisition' } };
    g.sources.set(acquire.sourceId, acquire); const acquired = g.executions.accept(acquire.sourceId);
    if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('real candidate fixture must secure');
    const premature = { ...g.source, sourceId: 'touch-before-carried-motion', previousExecutionSourceId: acquired.source.sourceId };
    g.sources.set(premature.sourceId, premature);
    expect(() => g.executions.accept(premature.sourceId)).toThrow(/motion scope/);
    expect(g.executions.read(acquired.source.sourceId)).toEqual(acquired);
    const secure = acquired.execution.acquisition, move: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'carry-after-acquire',
      previousExecutionSourceId: acquired.source.sourceId, action: { kind: 'motion', availableAtTick: secure.secureTick, throughTick: secure.secureTick + 1000, commands: g.motionSource.commands } };
    g.sources.set(move.sourceId, move); expect(g.executions.accept(move.sourceId).execution.motion.carrierPlayerId).toBe(secure.acquirerPlayerId);
    const later = { ...g.source, sourceId: 'touch-after-carried-motion', previousExecutionSourceId: move.sourceId };
    g.sources.set(later.sourceId, later); expect(g.executions.accept(later.sourceId).execution.kind).toBe('runner_base_touch');
    expect(g.executions.read(first.source.sourceId)).toEqual(first);
  } finally { g.f.close(); }
});
it.each(['missing', 'defender', 'other_batter', 'unknown', 'base', 'result', 'clock'] as const)('rejects %s runner evidence injection', (kind) => {
  const g = fixture(); try {
    if (kind === 'other_batter') expect(g.f.participation.readPregameBinding('game-1', 'away-2')).not.toBeNull();
    const action = { kind: 'runner_base_touch', geometrySourceId: kind === 'missing' ? 'missing' : g.geometrySource.sourceId,
      playerId: kind === 'defender' ? g.batter.defenderBindings[0].playerId : kind === 'other_batter' ? 'away-2' : kind === 'unknown' ? 'unknown' : g.batter.binding.playerId,
      base: kind === 'base' ? 'fifth' : 'home', ...(kind === 'result' ? { safe: true } : kind === 'clock' ? { tick: 0 } : {}) };
    g.sources.set(g.source.sourceId, { ...g.source, action } as unknown as AcceptedBattedWorldExecution);
    expect(() => g.executions.accept(g.source.sourceId)).toThrow();
    expect(g.f.db.prepare('SELECT count(*) AS n FROM batted_world_executions').get()).toEqual({ n: 0 });
  } finally { g.f.close(); }
});

it('records first-base contact from accepted actual future body motion, not the original segment', () => {
  const g = fixture(); try {
    if (g.source.action.kind !== 'runner_base_touch') throw new Error('runner Source fixture');
    const before: AcceptedBattedWorldExecution = { ...g.source, action: { ...g.source.action, base: 'first' } };
    g.sources.set(before.sourceId, before);
    const original = g.executions.accept(before.sourceId);
    if (original.execution.kind !== 'runner_base_touch') throw new Error('runner observation fixture');
    expect(original.execution.contact).toBeNull();
    // Explicit synthetic motor commands isolate Source causality; these are not generated locomotion capability defaults.
    const initialMoment = original.execution.motion.world.moment, ticks = 1000, firstSeconds = ticks / g.foot.primitive.ticksPerSecond;
    const detourCommands = g.motionSource.commands.map((command) => command.playerId !== g.batter.binding.playerId ? command : { ...command,
      bodyAcceleration: { x: -2 / firstSeconds ** 2, y: 0, z: 2 / firstSeconds ** 2 } });
    const detour: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'actual-detour', previousExecutionSourceId: before.sourceId,
      action: { kind: 'motion', availableAtTick: initialMoment.ball.tick, throughTick: initialMoment.ball.tick + ticks, commands: detourCommands } };
    g.sources.set(detour.sourceId, detour); const away = g.executions.accept(detour.sourceId);
    const priorFoot = away.execution.motion.actors.find((actor) => actor.playerId === g.batter.binding.playerId && actor.primitive.role === 'left_foot')!;
    const moment = away.execution.motion.world.moment, primitive = priorFoot.primitive;
    const dt = (moment.originTick - primitive.startTick) / primitive.ticksPerSecond + moment.elapsedSeconds - (priorFoot.startElapsedSeconds ?? 0);
    const start = Object.fromEntries((['x', 'y', 'z'] as const).map((axis) => [axis, primitive.startCenter[axis] + primitive.startVelocity[axis] * dt + 0.5 * primitive.acceleration[axis] * dt * dt])) as { x: number; y: number; z: number };
    const velocity = Object.fromEntries((['x', 'y', 'z'] as const).map((axis) => [axis, primitive.startVelocity[axis] + primitive.acceleration[axis] * dt])) as typeof start;
    const target = g.geometry.geometry.bases.first, seconds = ticks / primitive.ticksPerSecond;
    const acceleration = { x: 2 * (target.region.center.x - start.x - velocity.x * seconds) / seconds ** 2, y: 0,
      z: 2 * (target.region.center.z - start.z - velocity.z * seconds) / seconds ** 2 };
    const commands = g.motionSource.commands.map((command) => command.playerId !== g.batter.binding.playerId ? command : { ...command,
      bodyAcceleration: acceleration, primitiveMotions: command.primitiveMotions.map((motion) => !motion.role.endsWith('foot') ? motion : { ...motion,
        offsetAcceleration: { x: 0, y: 2 * (target.surfaceHeightMeters - start.y - velocity.y * seconds) / seconds ** 2, z: 0 } }) });
    const move: AcceptedBattedWorldExecution = { ...g.source, sourceId: 'actual-first-arrival', previousExecutionSourceId: detour.sourceId,
      action: { kind: 'motion', availableAtTick: moment.ball.tick, throughTick: moment.ball.tick + ticks, commands } };
    g.sources.set(move.sourceId, move); const moving = g.executions.accept(move.sourceId);
    const actualFoot = moving.execution.motion.actors.find((actor) => actor.playerId === g.batter.binding.playerId && actor.primitive.role === 'left_foot')!;
    expect(actualFoot.primitive.startCenter).toEqual(start); expect(actualFoot.primitive.startVelocity).toEqual(velocity);
    expect(moving.execution.motion.world.kind).toBe('moving');
    const ball = moving.execution.motion.world.moment.ball, priorBall = moment.ball;
    const gravity = g.motion.response.touch.worldContact.flight.source.execution.ballFlightParameters.gravityY;
    expect(ball.position.x).toBeCloseTo(priorBall.position.x + priorBall.velocity.x * seconds, 14);
    expect(ball.position.y).toBeCloseTo(priorBall.position.y + priorBall.velocity.y * seconds + 0.5 * gravity * seconds ** 2, 14);
    expect(ball.position.z).toBeCloseTo(priorBall.position.z + priorBall.velocity.z * seconds, 14);
    expect(ball.spin).toEqual(priorBall.spin);
    const observe: AcceptedBattedWorldExecution = { ...before, sourceId: 'actual-first-touch', previousExecutionSourceId: move.sourceId };
    g.sources.set(observe.sourceId, observe); const contact = g.executions.accept(observe.sourceId);
    if (contact.execution.kind !== 'runner_base_touch') throw new Error('runner observation fixture');
    expect(contact.execution.contact?.playerId).toBe(g.batter.binding.playerId);
    expect(contact.execution.contact!.elapsedSeconds).toBeGreaterThan(moment.elapsedSeconds);
    expect(contact.execution.motion).toEqual(moving.execution.motion);
    expect(g.executions.read(before.sourceId)).toEqual(original);
  } finally { g.f.close(); }
});

