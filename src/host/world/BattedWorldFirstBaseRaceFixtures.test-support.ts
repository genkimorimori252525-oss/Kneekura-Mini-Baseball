import { battedWorldRunnerContactFixture } from './BattedWorldRunnerContactFixtures.test-support';
import type { AcceptedBattedWorldExecution } from './SqliteBattedWorldExecutionStore';

/** Explicit synthetic sole motors; all contact, ground, capture and security remain executed World evidence. */
export const battedWorldFirstBaseRaceFixture = (path?: string, defenderSeconds = 0.04, batterSeconds = 0.08, throughSeconds = 0.045) => {
  const fixture = battedWorldRunnerContactFixture(path, 'ground_candidate');
  try {
    const initial = fixture.motion.response.touch.worldContact.result;
    if (initial.kind !== 'contact' || initial.contacts.length !== 1 || initial.contacts[0].kind !== 'ground') throw new Error('actual ground race fixture');
    const acquire: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-race-ground-pickup', action: { kind: 'acquisition' } };
    fixture.sources.set(acquire.sourceId, acquire); const acquired = fixture.executions.accept(acquire.sourceId);
    if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('actual race secured pickup fixture');
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
    const move: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-race-feet', previousExecutionSourceId: acquire.sourceId,
      action: { kind: 'motion', availableAtTick: secure.ball.tick, throughTick: secure.ball.tick + Math.round(throughSeconds * tps), commands } };
    fixture.sources.set(move.sourceId, move); const moved = fixture.executions.accept(move.sourceId);
    if (moved.execution.motion.world.kind !== 'moving') throw new Error('actual race fixture was interrupted');
    const source: AcceptedBattedWorldExecution = { ...fixture.source, sourceId: 'actual-first-base-race', previousExecutionSourceId: move.sourceId,
      action: { kind: 'first_base_race', geometrySourceId: fixture.geometrySource.sourceId } };
    fixture.sources.set(source.sourceId, source);
    return { ...fixture, acquired, moved, source };
  } catch (error) { fixture.f.close(); throw error; }
};
