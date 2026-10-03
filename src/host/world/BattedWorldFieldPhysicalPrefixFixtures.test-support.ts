import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { openSqliteBattedWorldBaseGeometryStore, type AcceptedBattedWorldBaseGeometry } from './SqliteBattedWorldBaseGeometryStore';
import { openSqliteBattedWorldFieldStore, type AcceptedBattedWorldFieldAction, type AcceptedBattedWorldFieldGeometry } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { openSqlitePlayerFieldingModelStore, type AcceptedPlayerFieldingModel } from './SqlitePlayerFieldingModelStore';

/** Explicit synthetic tall bags and a moving glove expose capture/transfer/released contact provenance. */
export const fieldPhysicalBagFixture = (kind: 'capture' | 'carry' | 'transfer' | 'release' | 'rebound') => {
  let receiverPlayerId = '';
  const base = battedContactResponseFixture(undefined, 'airborne', (world) => {
    const ball = world.flight.flight.initialBall, frame = world.flight.physicalPitch.frame.world;
    const p = world.flight.source.execution.ballFlightParameters, dt = 0.01;
    receiverPlayerId = world.flight.physicalPitch.frame.batterActor!.defenderBindings.find((binding) => binding.playerId !== 'p2')!.playerId;
    const pitcher = frame.defenders.find((actor) => actor.playerId === 'p2')!, receiver = frame.defenders.find((actor) => actor.playerId === receiverPlayerId)!;
    const center = { x: ball.position.x + ball.velocity.x * dt,
      y: ball.position.y + ball.velocity.y * dt + 0.5 * p.gravityY * dt * dt, z: ball.position.z + ball.velocity.z * dt };
    const model = world.models.get(world.model.sourceId)!;
    world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => ({ ...actor, primitives: actor.primitives.map((primitive) => {
      if (primitive.role !== 'glove') return primitive;
      if (actor.playerId === receiverPlayerId) return { ...primitive,
        offset: { x: center.x - receiver.position.x, y: center.y, z: -5 - receiver.position.z } };
      if (actor.playerId !== 'p2') return primitive;
      const relative = { x: ball.velocity.x - pitcher.velocity.x, y: ball.velocity.y + p.gravityY * dt, z: ball.velocity.z - pitcher.velocity.z - 1 };
      const length = Math.hypot(relative.x, relative.y, relative.z), radius = p.ballRadius + primitive.radius;
      const elapsed = (ball.tick - frame.tick) / p.ticksPerSecond + dt;
      return { ...primitive, offset: { x: center.x + relative.x / length * radius - pitcher.position.x - pitcher.velocity.x * elapsed,
        y: center.y + relative.y / length * radius,
        z: center.z + relative.z / length * radius - pitcher.position.z - pitcher.velocity.z * elapsed - dt } };
    }) })) });
    const source = world.sources.get(world.source.sourceId)!;
    world.sources.set(source.sourceId, { ...source, commands: source.commands.map((command) => command.playerId !== 'p2' ? command : { ...command,
      primitiveMotions: command.primitiveMotions.map((motion) => motion.role !== 'glove' ? motion : { ...motion, offsetVelocity: { x: 0, y: 0, z: 1 } }) }) });
  }, true, true);
  base.responseModels.set(base.responseModel.sourceId, { ...base.responseModel, actors: base.responseModel.actors.map((actor) => ({ ...actor,
    primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile : { ...profile,
      bodyStability: kind === 'rebound' ? 0 : profile.bodyStability, parameters: { ...profile.parameters, captureDissipationPowerW: kind === 'capture' ? 50 : 100_000_000 } }) })) });
  const response = base.responses.accept(base.responseSource.sourceId), flight = response.touch.worldContact.flight;
  const centers = flight.physicalPitch.frame.initialWorld!.source.worldSetup.baseCenters;
  const surface = (center: { x: number; z: number }, x = 0.01, z = 0.01, height = 0.1) => ({
    region: { center, halfSize: { x, z }, rotationRadians: 0 }, surfaceHeightMeters: height });
  const baseSource: AcceptedBattedWorldBaseGeometry = { sourceId: 'bag-prefix-bases', sourceVersion: 'synthetic-v1',
    flightSourceId: flight.source.sourceId, geometryRef: 'synthetic-bag-prefix', availableAtDay: 1,
    bases: { home: surface(flight.source.execution.field.homePlate, 0.5, 0.01, 3), first: surface(centers.first),
      second: surface(centers.second), third: surface(centers.third, 0.5, 26.5, 3) } };
  const bases = base.f.track(openSqliteBattedWorldBaseGeometryStore(base.f.path, base.flights,
    { readAcceptedGeometry: (id) => id === baseSource.sourceId ? baseSource : null }));
  bases.accept(baseSource.sourceId);
  const model = { bottomY: 0, material: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 } };
  const geometrySource: AcceptedBattedWorldFieldGeometry = { sourceId: 'bag-prefix-geometry', sourceVersion: 'synthetic-v1',
    baseGeometrySourceId: baseSource.sourceId, baseModels: { home: model, first: model, second: model, third: model } };
  const fieldSource: AcceptedBattedWorldFieldAction = { sourceId: 'bag-prefix-field', sourceVersion: 'synthetic-v1',
    responseSourceId: response.source.sourceId, geometrySourceId: geometrySource.sourceId, previousFieldSourceId: null,
    availableAtTick: flight.flight.initialBall.tick, throughTick: flight.flight.initialBall.tick + 2_000_000,
    commands: response.touch.worldContact.source.commands.map((command) => ({ playerId: command.playerId, bodyAcceleration: command.bodyAcceleration,
      primitiveMotions: command.primitiveMotions.map((motion) => ({ role: motion.role, offsetAcceleration: motion.offsetAcceleration })) })) };
  const fields = base.f.track(openSqliteBattedWorldFieldStore(base.f.path, base.responses, bases,
    { readAcceptedGeometry: () => geometrySource, readAcceptedAction: () => fieldSource }));
  fields.acceptGeometry(geometrySource.sourceId);
  const baseField = fields.accept(fieldSource.sourceId);
  const source: AcceptedBattedWorldFieldExecution = { sourceId: 'bag-prefix-capture', sourceVersion: 'synthetic-v1',
    baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId: null, action: kind === 'rebound'
      ? { kind: 'motion', availableAtTick: baseField.field.motion.world.moment.ball.tick,
        throughTick: baseField.field.motion.world.moment.ball.tick + 1_000_000, commands: fieldSource.commands } : { kind: 'acquisition' } };
  const sources = new Map([[source.sourceId, source]]);
  const executions = base.f.track(openSqliteBattedWorldFieldExecutionStore(base.f.path, fields,
    { readAcceptedExecution: (id) => sources.get(id) ?? null }));
  const acquired = executions.accept(source.sourceId);
  if (kind === 'rebound') return { ...base, baseField, prefix: [acquired] };
  if (acquired.execution.kind !== 'acquisition') throw new Error('bag acquisition fixture');
  if (kind === 'capture') return { ...base, baseField, prefix: [acquired] };
  const capture = acquired.execution.acquisition;
  if (capture.kind !== 'secured') throw new Error('bag secure fixture');
  let action: AcceptedBattedWorldFieldExecution['action'] = { kind: 'motion', availableAtTick: capture.secureTick,
    throughTick: capture.secureTick + 1_000_000, commands: fieldSource.commands };
  if (kind !== 'carry') {
    const actor = response.touch.worldContact.modelActorEvidence.find((value) => value.binding.playerId === capture.acquirerPlayerId)!;
    const delay = kind === 'transfer' ? 300_000 : 50_000;
    const fieldingSource: AcceptedPlayerFieldingModel = { sourceId: 'bag-prefix-throw-model', sourceVersion: 'synthetic-v1',
      careerId: actor.binding.careerId, playerId: actor.binding.playerId, personLinkSourceId: actor.binding.personLinkSourceId, acceptedAtDay: actor.binding.gameDay,
      ratings: { positionSuitability: { P: 0.5, C: 0.5, '1B': 0.5, '2B': 0.5, '3B': 0.5, SS: 0.5, LF: 0.5, CF: 0.5, RF: 0.5 },
        firstStep: 0.5, acceleration: 0.5, battedBallRead: 0.5, routeEfficiency: 0.5, catching: 0.5, transfer: 0.5,
        armStrength: 0.5, throwingAccuracy: 0.5, situationalAwareness: 0.5, tagSkill: 0.5 },
      transferParameters: { minimumTransferDelayTicks: delay, maximumTransferDelayTicks: delay, fixedGripOffsetTicks: 0 },
      throwCalibration: { minimumReleaseSpeedMps: 20, maximumReleaseSpeedMps: 20, minimumTargetErrorMeters: 0, maximumTargetErrorMeters: 0 } };
    const fielding = base.f.track(openSqlitePlayerFieldingModelStore(base.f.path, { readAcceptedModel: () => fieldingSource }));
    fielding.accept(fieldingSource.sourceId);
    action = { ...action, kind: 'throw', modelSourceId: fieldingSource.sourceId, receiverPlayerId };
  }
  const next = { ...source, sourceId: 'bag-prefix-next', previousExecutionSourceId: source.sourceId, action };
  sources.set(next.sourceId, next);
  return { ...base, baseField, prefix: [acquired, executions.accept(next.sourceId)] };
};
