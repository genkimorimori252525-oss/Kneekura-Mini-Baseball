import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

/** A rolling ball meets an actually descending glove after a distinct earlier ground contact. */
export const scheduledConstraintGroundFixture = () => {
  const x = battedWorldFieldFixture(undefined, true, false, undefined, { groundRestitution: 0,
    world(world) {
      const p = world.flight.source.execution.ballFlightParameters, initial = world.flight.flight.initialBall;
      const predicted = createBattedBallFlightEvidence({ contact: world.flight.flight.contact, parameters: p, searchDurationTicks: 2_000_000 });
      const target = predicted.firstGroundContact!, frame = world.flight.physicalPitch.frame.world;
      const pitcher = frame.defenders.find((actor) => actor.playerId === 'p2')!, dt = (target.tick - frame.tick) / p.ticksPerSecond;
      const elapsed = (target.tick - initial.tick) / p.ticksPerSecond, model = world.models.get(world.model.sourceId)!;
      world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => actor.playerId !== 'p2' ? actor : { ...actor,
        primitives: actor.primitives.map((primitive) => primitive.role !== 'glove' ? primitive : { ...primitive, offset: {
          x: target.state.position.x - pitcher.position.x - pitcher.velocity.x * dt,
          y: p.ballRadius + 0.02 + elapsed, z: target.state.position.z + 0.12 - pitcher.position.z - pitcher.velocity.z * dt,
        } }) }) });
      const source = world.sources.get(world.source.sourceId)!;
      world.sources.set(source.sourceId, { ...source, commands: source.commands.map((command) => command.playerId !== 'p2' ? command : { ...command,
        primitiveMotions: command.primitiveMotions.map((motor) => motor.role !== 'glove' ? motor : { ...motor, offsetVelocity: { x: 0, y: -1, z: 0 } }) }) });
    },
    response(value) {
      value.responseModels.set(value.responseModel.sourceId, { ...value.responseModel, actors: value.responseModel.actors.map((actor) => ({ ...actor,
        primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile : { ...profile,
          parameters: { ...profile.parameters, captureDissipationPowerW: 100_000_000 } }) })) });
    },
  });
  try {
    let baseField = x.fields.accept(x.source.sourceId);
    const fields = [baseField];
    for (let i = 0; i < 12 && baseField.field.motion.response.kind !== 'capture_candidate'; i++) {
      const source = { ...x.source, sourceId: `constraint-ground-field-${i}`, previousFieldSourceId: baseField.source.sourceId };
      x.sources.set(source.sourceId, source); baseField = x.fields.accept(source.sourceId); fields.push(baseField);
    }
    if (baseField.field.motion.response.kind !== 'capture_candidate') throw new Error('descending glove candidate fixture');
    const sources = new Map<string, AcceptedBattedWorldFieldExecution>(), executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
      { readAcceptedExecution: (id) => sources.get(id) ?? null }));
    const prefix: DurableBattedWorldFieldExecution[] = [];
    const accept = (sourceId: string, action: AcceptedBattedWorldFieldExecution['action']) => {
      const source: AcceptedBattedWorldFieldExecution = { sourceId, sourceVersion: 'synthetic-v1', baseFieldSourceId: baseField.source.sourceId,
        previousExecutionSourceId: prefix.at(-1)?.source.sourceId ?? null, action };
      sources.set(sourceId, source); const result = executions.accept(sourceId); prefix.push(result); return result;
    };
    return { ...x, baseField, ownFields: fields, executions, prefix, accept };
  } catch (error) { x.f.close(); throw error; }
};
