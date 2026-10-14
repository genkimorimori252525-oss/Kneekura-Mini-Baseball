import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualDefensiveBoundary } from './ActualDefensiveContext';

export type FieldRaceCheckpointFixture = Readonly<{
  sourceId: string; coverageAfterCheckpointTicks: number;
  phase?: <T>(name: string, run: () => T) => T;
}>;

/** The forecast positions synthetic test geometry only; adopted field contact and security supply every rule fact. */
export const battedWorldFieldRaceFixture = (path?: string, defenderSeconds = 0.04, batterSeconds = 0.08, throughSeconds = 0.045,
  groundRestitution?: number, checkpoint?: FieldRaceCheckpointFixture) => {
  if (checkpoint && (!checkpoint.sourceId || checkpoint.sourceId !== checkpoint.sourceId.trim()
    || !Number.isSafeInteger(checkpoint.coverageAfterCheckpointTicks) || checkpoint.coverageAfterCheckpointTicks <= 0)) {
    throw new Error('invalid prospective field-race checkpoint fixture');
  }
  const phase = checkpoint?.phase ?? (<T>(_name: string, run: () => T): T => run());
  const x = phase('root-field-fixture', () => battedWorldFieldFixture(path, true, false, undefined, { groundRestitution,
    world(world) {
      const p = world.flight.source.execution.ballFlightParameters;
      const predicted = createBattedBallFlightEvidence({ contact: world.flight.flight.contact, parameters: p, searchDurationTicks: 2_000_000 });
      const target = predicted.firstGroundContact!, frame = world.flight.physicalPitch.frame.world;
      const pitcher = frame.defenders.find((actor) => actor.playerId === 'p2')!, dt = (target.tick - frame.tick) / p.ticksPerSecond;
      const model = world.models.get(world.model.sourceId)!;
      world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => actor.playerId !== 'p2' ? actor : { ...actor,
        primitives: actor.primitives.map((primitive) => primitive.role !== 'glove' ? primitive : { ...primitive, offset: {
          x: target.state.position.x - pitcher.position.x - pitcher.velocity.x * dt, y: p.ballRadius + 0.02,
          z: target.state.position.z + 0.12 - pitcher.position.z - pitcher.velocity.z * dt,
        } }) }) });
    },
    response(value) {
      value.responseModels.set(value.responseModel.sourceId, { ...value.responseModel,
        actors: value.responseModel.actors.map((actor) => ({ ...actor, primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile
          : { ...profile, parameters: { ...profile.parameters, captureDissipationPowerW: 100_000_000 } }) })) });
    },
  }));
  try {
    const firstField = phase('first-ground-field', () => x.fields.accept(x.source.sourceId));
    if (firstField.field.motion.world.kind !== 'boundary' || !firstField.field.motion.world.contacts.some((c) => c.kind === 'ground')) {
      throw new Error('actual field race first ground fixture');
    }
    let baseField = firstField;
    for (let index = 0; index < 12 && baseField.field.motion.response.kind !== 'capture_candidate'; index++) {
      const source = { ...x.source, sourceId: `field-race-candidate-${index}`, previousFieldSourceId: baseField.source.sourceId };
      x.sources.set(source.sourceId, source); baseField = phase(`capture-candidate-${index}`, () => x.fields.accept(source.sourceId));
    }
    if (baseField.field.motion.response.kind !== 'capture_candidate') throw new Error('actual field race capture candidate fixture');
    const acquire: AcceptedBattedWorldFieldExecution = { sourceId: 'field-race-acquisition', sourceVersion: 'synthetic-v1',
      baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId: null, action: { kind: 'acquisition' } };
    const sources = new Map([[acquire.sourceId, acquire]]), authority = { readAcceptedExecution: (id: string) => sources.get(id) ?? null };
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, authority));
    const acquired = phase('secured-acquisition', () => executions.accept(acquire.sourceId));
    if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('actual field race security fixture');
    const acquisition = acquired.execution.acquisition, secure = acquisition.moment;
    const tps = x.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
    let feetMoment = secure, feetActors = acquired.execution.field.motion.actors, feetPredecessor = acquire.sourceId;
    if (checkpoint) phase('feet-start-qualification', () => {
      // The legacy source's quantized secure tick can lie after the exact secure
      // moment. Reach that integer cut with original covered curves before
      // making a fresh exact-availability feet command; never backdate it.
      const startTick = actualDefensiveBoundary({ originTick: secure.originTick, elapsedSeconds: secure.elapsedSeconds, tick: secure.ball.tick }, tps);
      if ((startTick - secure.originTick) / tps > secure.elapsedSeconds) {
        const align: AcceptedBattedWorldFieldExecution = { ...acquire, sourceId: `${checkpoint.sourceId}-integer-start`,
          previousExecutionSourceId: acquire.sourceId, action: { kind: 'retained_motion_checkpoint_v1', checkpointThroughTick: startTick } };
        sources.set(align.sourceId, align);
        const aligned = phase('feet-integer-start', () => executions.accept(align.sourceId));
        const motion = aligned.execution.field.motion;
        if (motion.world.kind !== 'moving' || !motion.cursor || motion.carrierPlayerId !== acquisition.acquirerPlayerId
          || motion.world.moment.elapsedSeconds !== (startTick - secure.originTick) / tps || motion.world.moment.ball.tick !== startTick
          || motion.actors.length !== 50 || JSON.stringify(motion.actors) !== JSON.stringify(feetActors)) {
          throw new Error('actual field race integer alignment was interrupted or changed retained coverage');
        }
        feetMoment = motion.world.moment;
        feetActors = motion.actors; feetPredecessor = align.sourceId;
      }
    });
    const batter = x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!, surface = x.geometry.geometry.baseGeometry.bases.first;
    const commands = x.source.commands.map((command) => {
      if (command.playerId !== 'p2' && command.playerId !== batter.binding.playerId) return command;
      const dt = command.playerId === 'p2' ? defenderSeconds : batterSeconds;
      const foot = feetActors.find((actor) => actor.playerId === command.playerId && actor.primitive.role === 'left_foot')!;
      const local = (feetMoment.originTick - foot.primitive.startTick) / tps + feetMoment.elapsedSeconds - (foot.startElapsedSeconds ?? 0);
      const acceleration = (axis: 'x' | 'y' | 'z') => {
        const p = foot.primitive, center = p.startCenter[axis] + p.startVelocity[axis] * local + 0.5 * p.acceleration[axis] * local ** 2;
        const velocity = p.startVelocity[axis] + p.acceleration[axis] * local;
        const target = axis === 'y' ? surface.surfaceHeightMeters : surface.region.center[axis];
        return 2 * (target - center - velocity * dt) / dt ** 2 - command.bodyAcceleration[axis];
      };
      return { ...command, primitiveMotions: command.primitiveMotions.map((motor) => motor.role !== 'left_foot' ? motor : { ...motor,
        offsetAcceleration: { x: acceleration('x'), y: acceleration('y'), z: acceleration('z') } }) };
    });
    const throughTick = feetMoment.ball.tick + Math.round(throughSeconds * tps);
    const move: AcceptedBattedWorldFieldExecution = { ...acquire, sourceId: checkpoint?.sourceId ?? 'field-race-feet', previousExecutionSourceId: feetPredecessor,
      action: checkpoint ? { kind: 'motion_checkpoint_v1', availableAtTick: feetMoment.ball.tick, checkpointThroughTick: throughTick,
        coverageThroughTick: throughTick + checkpoint.coverageAfterCheckpointTicks, commands }
        : { kind: 'motion', availableAtTick: secure.ball.tick, throughTick, commands } };
    sources.set(move.sourceId, move); const moved = phase('feet-motion', () => executions.accept(move.sourceId));
    if (moved.execution.field.motion.world.kind !== 'moving') throw new Error('actual field race motion was interrupted');
    const source: AcceptedBattedWorldFieldExecution = { ...acquire, sourceId: 'field-first-base-race', previousExecutionSourceId: move.sourceId,
      action: { kind: 'first_base_race' } };
    sources.set(source.sourceId, source);
    return { ...x, firstField, baseField, acquire, acquired, moved, move, executions, source, sources, authority, batter,
      ...(checkpoint ? { feetStart: { moment: feetMoment, executionSourceId: feetPredecessor } } : {}),
      fieldSource: x.source, fieldSources: x.sources };
  } catch (error) { x.f.close(); throw error; }
};
