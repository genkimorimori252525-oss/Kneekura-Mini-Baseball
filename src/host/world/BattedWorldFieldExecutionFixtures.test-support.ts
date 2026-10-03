import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

export const battedWorldFieldExecutionFixture = (path?: string, kind: 'free' | 'candidate' = 'free',
  configureWorld?: NonNullable<Parameters<typeof battedWorldFieldFixture>[4]>['world']) => {
  const base = battedWorldFieldFixture(path, true, kind === 'free', undefined, kind === 'free' ? undefined : {
    world(world) {
      const ball = world.flight.flight.initialBall, frame = world.flight.physicalPitch.frame.world;
      const p = world.flight.source.execution.ballFlightParameters, dt = 0.01;
      const pitcher = frame.defenders.find((actor) => actor.playerId === 'p2')!, model = world.models.get(world.model.sourceId)!;
      const center = { x: ball.position.x + ball.velocity.x * dt,
        y: ball.position.y + ball.velocity.y * dt + 0.5 * p.gravityY * dt * dt, z: ball.position.z + ball.velocity.z * dt };
      world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => actor.playerId !== 'p2' ? actor : { ...actor,
        primitives: actor.primitives.map((primitive) => {
          if (primitive.role !== 'glove') return primitive;
          const relative = { x: ball.velocity.x - pitcher.velocity.x, y: ball.velocity.y + p.gravityY * dt, z: ball.velocity.z - pitcher.velocity.z };
          const length = Math.hypot(relative.x, relative.y, relative.z), radius = p.ballRadius + primitive.radius;
          const elapsed = (ball.tick - frame.tick) / p.ticksPerSecond + dt;
          return { ...primitive, offset: { x: center.x + relative.x / length * radius - pitcher.position.x - pitcher.velocity.x * elapsed,
            y: center.y + relative.y / length * radius, z: center.z + relative.z / length * radius - pitcher.position.z - pitcher.velocity.z * elapsed } };
        }) }) });
      configureWorld?.(world);
    },
    response(value) {
      value.responseModels.set(value.responseModel.sourceId, { ...value.responseModel,
        actors: value.responseModel.actors.map((actor) => ({ ...actor, primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile
          : { ...profile, parameters: { ...profile.parameters, captureDissipationPowerW: 100_000_000 } }) })) });
    },
  });
  const baseField = base.fields.accept(base.source.sourceId);
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'field-execution-1', sourceVersion: 'synthetic-v1',
    baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId: null, action: kind === 'candidate' ? { kind: 'acquisition' }
      : { kind: 'motion', availableAtTick: baseField.field.motion.world.moment.ball.tick,
        throughTick: baseField.field.motion.world.moment.ball.tick + 1000, commands: base.source.commands } };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedExecution: (id: string) => sources.get(id) ?? null };
  const executions = base.f.track(openSqliteBattedWorldFieldExecutionStore(base.f.path, base.fields, authority));
  return { ...base, baseField, source, sources, authority, executions, fieldSource: base.source, fieldSources: base.sources };
};

export const battedWorldFieldThrowFixture = (path?: string, transferDelayTicks?: number,
  configureWorld?: NonNullable<Parameters<typeof battedWorldFieldFixture>[4]>['world']) => {
  const base = battedWorldFieldExecutionFixture(path, 'candidate', configureWorld), acquired = base.executions.accept(base.source.sourceId);
  if (acquired.execution.kind !== 'acquisition' || acquired.execution.acquisition.kind !== 'secured') throw new Error('field capture fixture');
  const capture = acquired.execution.acquisition, world = base.response.touch.worldContact;
  const actor = world.modelActorEvidence.find((value) => value.binding.playerId === capture.acquirerPlayerId)!;
  const receiver = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((binding) => binding.playerId !== capture.acquirerPlayerId)!;
  const fieldingSource: AcceptedPlayerFieldingModel = { sourceId: 'field-throw-model', sourceVersion: 'synthetic-v1',
    careerId: actor.binding.careerId, playerId: actor.binding.playerId, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
    ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
      firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
      armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
    transferParameters: transferDelayTicks === undefined ? { minimumTransferDelayTicks: 100, maximumTransferDelayTicks: 300, fixedGripOffsetTicks: 10 }
      : { minimumTransferDelayTicks: transferDelayTicks, maximumTransferDelayTicks: transferDelayTicks, fixedGripOffsetTicks: 0 },
    throwCalibration: { minimumReleaseSpeedMps: 10, maximumReleaseSpeedMps: 30, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 1 } };
  const fieldingSources = new Map([[fieldingSource.sourceId, fieldingSource]]);
  const fielding = base.f.track(openSqlitePlayerFieldingModelStore(base.f.path, { readAcceptedModel: (id) => fieldingSources.get(id) ?? null }));
  const model = fielding.accept(fieldingSource.sourceId);
  const source: AcceptedBattedWorldFieldExecution = { ...base.source, sourceId: 'field-throw', previousExecutionSourceId: base.source.sourceId,
    action: { kind: 'throw', modelSourceId: model.source.sourceId, receiverPlayerId: receiver.playerId,
      availableAtTick: capture.secureTick, throughTick: capture.secureTick + 100_000, commands: base.fieldSource.commands } };
  base.sources.set(source.sourceId, source);
  return { ...base, acquired, capture, source, model, fielding, fieldingSource, fieldingSources, actor, receiver };
};
