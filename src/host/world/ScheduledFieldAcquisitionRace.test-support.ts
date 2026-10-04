import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { createBattedBallFlightEvidence } from '../../core/sim/ball/BattedBallFlightEvidence';
import type { BattedBallContactResponseInput } from '../../core/sim/ball/BattedBallContactResponse';
import { createBattedWorldFieldGeometry, deriveBattedWorldFieldMotion, deriveInitialBattedWorldFieldMotion } from '../../core/sim/ball/BattedWorldFieldMotion';
import type { BattedWorldScheduledFieldAcquisitionPlan } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import { sampleBatterSwingState } from '../../core/sim/contact/BatBallContact';
import { openSqliteBattedWorldFieldExecutionStore, type AcceptedBattedWorldFieldExecution, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

/** Geometry and motor commands are chosen before their original Native models are accepted.
 * Pure preflight determines calibration only; every asserted fact comes from accepted physical execution. */
export const scheduledAcquisitionRaceFixture = (competition?: Readonly<{
  capture: BattedWorldScheduledFieldAcquisitionPlan; elapsedSeconds: number;
}>) => {
  let secureElapsedSeconds = 0.0625001;
  const x = battedWorldFieldFixture(undefined, true, false, undefined, {
    world(world) {
      const p = world.flight.source.execution.ballFlightParameters, flight = world.flight.flight;
      const predicted = createBattedBallFlightEvidence({ contact: flight.contact, parameters: p, searchDurationTicks: 2_000_000 });
      const target = predicted.firstGroundContact!, frame = world.flight.physicalPitch.frame;
      const pitcher = frame.world.defenders.find((actor) => actor.playerId === 'p2')!;
      const dt = (target.tick - frame.world.tick) / p.ticksPerSecond;
      const groundElapsed = (target.tick - flight.initialBall.tick) / p.ticksPerSecond;
      if (groundElapsed >= 0.05) secureElapsedSeconds = (Math.ceil(groundElapsed * 1000) + 10) / 1000 + 0.0000001;
      const first = frame.initialWorld!.source.worldSetup.baseCenters.first, batterId = frame.batterActor!.binding.playerId;
      const action = world.flight.physicalPitch.source.request.batter.action;
      if (action.kind !== 'swing') throw new Error('scheduled race requires original swing');
      const swing = sampleBatterSwingState(action.swing.stateAtStart, flight.initialBall.tick - action.swing.startTick, action.swing.ticksPerSecond);
      const model = world.models.get(world.model.sourceId)!;
      const competitorId = frame.world.defenders.find((actor) => actor.playerId !== 'p2')!.playerId;
      const competingBody = competition ? (() => {
        const moment = competition.capture.initialConstraintMoment, elapsed = competition.elapsedSeconds - moment.elapsedSeconds;
        const radius = model.actors.find((actor) => actor.playerId === competitorId)!.primitives.find((primitive) => primitive.role === 'body')!.radius;
        const velocity = { ...moment.ball.velocity, y: moment.ball.velocity.y - 10 };
        // Descend onto the actual constrained curve; the next Native fixture owns these original commands.
        const position = { x: moment.ball.position.x + moment.ball.velocity.x * elapsed - velocity.x * competition.elapsedSeconds,
          y: moment.ball.position.y + moment.ball.velocity.y * elapsed + p.ballRadius + radius - velocity.y * competition.elapsedSeconds,
          z: moment.ball.position.z + moment.ball.velocity.z * elapsed - velocity.z * competition.elapsedSeconds };
        return { position, velocity };
      })() : null;
      const rootAtContact = (playerId: string) => playerId === batterId ? {
        position: { x: swing.pose.grip.x - model.batterGripOffset.x, y: swing.pose.grip.y - model.batterGripOffset.y,
          z: swing.pose.grip.z - model.batterGripOffset.z }, velocity: swing.linearVelocity,
      } : (() => {
        const defender = frame.world.defenders.find((actor) => actor.playerId === playerId)!;
        return { position: { x: defender.position.x + defender.velocity.x * (flight.initialBall.tick - frame.world.tick) / p.ticksPerSecond,
          y: 0, z: defender.position.z + defender.velocity.z * (flight.initialBall.tick - frame.world.tick) / p.ticksPerSecond },
          velocity: { x: defender.velocity.x, y: 0, z: defender.velocity.z } };
      })();
      world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor) => {
        if (competingBody && actor.playerId === competitorId) {
          const root = rootAtContact(actor.playerId);
          return { ...actor, primitives: actor.primitives.map((primitive) => primitive.role !== 'body' ? primitive : { ...primitive,
            offset: { x: competingBody.position.x - root.position.x, y: competingBody.position.y - root.position.y,
              z: competingBody.position.z - root.position.z } }) };
        }
        if (actor.playerId !== 'p2' && actor.playerId !== batterId) return actor;
        const root = rootAtContact(actor.playerId), runner = actor.playerId === batterId;
        return { ...actor, primitives: actor.primitives.map((primitive) => primitive.role === 'left_foot'
          ? { ...primitive, offset: { x: first.x - (runner ? 0.01 + secureElapsedSeconds + 0.0000001 : 0) - root.position.x,
            y: 0.1 - root.position.y, z: first.z - root.position.z } }
          : primitive.role === 'glove' && !runner ? { ...primitive, offset: {
            x: target.state.position.x - pitcher.position.x - pitcher.velocity.x * dt,
            y: p.ballRadius + 0.02, z: target.state.position.z + 0.12 - pitcher.position.z - pitcher.velocity.z * dt,
          } } : primitive) };
      }) });
      const source = world.sources.get(world.source.sourceId)!;
      world.sources.set(source.sourceId, { ...source, commands: source.commands.map((command) => {
        if (competingBody && command.playerId === competitorId) {
          const root = rootAtContact(command.playerId);
          return { ...command, primitiveMotions: command.primitiveMotions.map((motor) => motor.role !== 'body' ? motor : { ...motor,
            offsetVelocity: { x: competingBody.velocity.x - root.velocity.x, y: competingBody.velocity.y - root.velocity.y,
              z: competingBody.velocity.z - root.velocity.z } }) };
        }
        if (command.playerId !== 'p2' && command.playerId !== batterId) return command;
        const root = rootAtContact(command.playerId);
        return { ...command, primitiveMotions: command.primitiveMotions.map((motor) => motor.role !== 'left_foot' ? motor : {
          ...motor, offsetVelocity: { x: (command.playerId === batterId ? 1 : 0) - root.velocity.x,
            y: -root.velocity.y, z: -root.velocity.z },
        }) };
      }) });
    },
    response(value) {
      const w = value.worldContact, p = w.flight.source.execution.ballFlightParameters, centers = w.flight.physicalPitch.frame.initialWorld!.source.worldSetup.baseCenters;
      const response: BattedBallContactResponseInput = { world: { flight: w.flight.flight, parameters: p,
        throughTick: w.flight.flight.contact.tick, actors: w.actors, surfaces: w.model.surfaces },
        actors: value.responseModel.actors.filter((a) => w.actors.some((b) => a.playerId === b.playerId))
          .flatMap((a) => a.primitives.map((profile) => ({ playerId: a.playerId, profile }))), surfaces: value.responseModel.surfaces };
      const surface = (center: { x: number; z: number }) => ({ region: { center, halfSize: { x: 0.01, z: 0.2 }, rotationRadians: 0 }, surfaceHeightMeters: 0.1 });
      const bag = { bottomY: 0, material: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 } };
      const geometry = createBattedWorldFieldGeometry({ baseGeometry: { field: w.flight.source.execution.field,
        bases: { home: surface(w.flight.source.execution.field.homePlate), first: surface(centers.first), second: surface(centers.second), third: surface(centers.third) } },
        baseModels: { home: bag, first: bag, second: bag, third: bag } });
      const commands = w.source.commands.flatMap((c) => c.primitiveMotions.map((m) => ({ playerId: c.playerId, role: m.role,
        acceleration: { x: c.bodyAcceleration.x + m.offsetAcceleration.x, y: c.bodyAcceleration.y + m.offsetAcceleration.y,
          z: c.bodyAcceleration.z + m.offsetAcceleration.z } })));
      const common = { response, geometry, commands, availableAtTick: w.flight.flight.initialBall.tick, throughTick: w.flight.flight.initialBall.tick + 2_000_000 };
      let field = deriveInitialBattedWorldFieldMotion(common);
      for (let i = 0; i < 12 && field.motion.response.kind !== 'capture_candidate'; i++) {
        if (!field.motion.cursor) throw new Error('scheduled race preflight has no continuing cursor');
        field = deriveBattedWorldFieldMotion({ ...common, cursor: field.motion.cursor, actors: field.motion.actors, carrierPlayerId: field.motion.carrierPlayerId });
      }
      if (field.motion.response.kind !== 'capture_candidate') throw new Error('scheduled race preflight did not reach sole glove');
      const duration = secureElapsedSeconds - field.motion.world.moment.elapsedSeconds;
      if (duration <= 0) throw new Error('scheduled race secure deadline precedes glove');
      const power = field.motion.response.retention.diagnostics.retentionLoadJ / duration;
      value.responseModels.set(value.responseModel.sourceId, { ...value.responseModel, actors: value.responseModel.actors.map((actor) => ({ ...actor,
        primitives: actor.primitives.map((profile) => profile.role !== 'glove' ? profile : { ...profile,
          parameters: { ...profile.parameters, captureDissipationPowerW: power } }) })) });
    },
  });
  try {
    const firstField = x.fields.accept(x.source.sourceId), fieldPrefix = [firstField];
    if (firstField.field.motion.world.kind !== 'boundary' || !firstField.field.motion.world.contacts.some((c) => c.kind === 'ground')) {
      throw new Error('scheduled race must physically reach ground first');
    }
    let baseField = firstField;
    for (let i = 0; i < 12 && baseField.field.motion.response.kind !== 'capture_candidate'; i++) {
      const source = { ...x.source, sourceId: `scheduled-race-field-${i}`, previousFieldSourceId: baseField.source.sourceId };
      x.sources.set(source.sourceId, source); baseField = x.fields.accept(source.sourceId); fieldPrefix.push(baseField);
    }
    if (baseField.field.motion.response.kind !== 'capture_candidate') throw new Error('scheduled race sole glove missing');
    const executionPrefix: DurableBattedWorldFieldExecution[] = [], sources = new Map<string, AcceptedBattedWorldFieldExecution>();
    const authority = { readAcceptedExecution: (id: string) => sources.get(id) ?? null };
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields, authority));
    const accept = (sourceId: string, action: AcceptedBattedWorldFieldExecution['action']) => {
      const source: AcceptedBattedWorldFieldExecution = { sourceId, sourceVersion: 'synthetic-v1', baseFieldSourceId: baseField.source.sourceId,
        previousExecutionSourceId: executionPrefix.at(-1)?.source.sourceId ?? null, action };
      sources.set(sourceId, source); const result = executions.accept(sourceId); executionPrefix.push(result); return result;
    };
    return { ...x, firstField, baseField, fieldPrefix, executionPrefix, sources, executions, authority, accept, secureElapsedSeconds,
      runnerTouchElapsedSeconds: secureElapsedSeconds + 0.0000001, observationElapsedSeconds: secureElapsedSeconds + 0.0000002,
      batterId: x.response.touch.worldContact.flight.physicalPitch.frame.batterActor!.binding.playerId };
  } catch (error) { x.f.close(); throw error; }
};
