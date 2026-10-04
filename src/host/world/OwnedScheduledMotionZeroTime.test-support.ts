import { respondToGroundContact, type BallFlightParameters } from '../../core/sim/ball/BallFlight';
import { deriveBallWorldContinuation, type BallWorldMoment, type BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';

/** Reconstructed test geometry. All inputs are original Source values. The ground
 * anchor is an actual free-flight/ground/rolling result, never an edited ball. */
export const ownedZeroTimeTangentSource = (initial: BallWorldMoment, parameters: BallFlightParameters, ground: boolean) => {
  let anchor = initial;
  if (ground) {
    for (let i = 0; i < 8; i++) {
      const result = deriveBallWorldContinuation({ moment: anchor, parameters,
        throughTick: initial.originTick + 30 * parameters.ticksPerSecond, actors: [], surfaces: [], previousContacts: [] });
      if (result.kind === 'boundary' && result.contacts.length === 1 && result.contacts[0].kind === 'rolling_stop') {
        anchor = result.moment; break;
      }
      if (result.kind !== 'boundary' || result.contacts.length !== 1 || result.contacts[0].kind !== 'ground') {
        throw new Error('zero-time fixture requires a real ground then rolling-stop anchor');
      }
      anchor = { ...result.moment, ball: respondToGroundContact(result.moment.ball, parameters) };
    }
    if (anchor.elapsedSeconds === 0 || Object.values(anchor.ball.velocity).some(v => v !== 0)) throw new Error('zero-time fixture has no resting anchor');
  }
  const contactElapsedSeconds = ground ? Math.ceil(anchor.elapsedSeconds) + 1 : 0.125;
  const t = contactElapsedSeconds, ball = ground ? anchor.ball : initial.ball;
  const startCenter = { x: ball.position.x, y: ball.position.y + parameters.ballRadius + 0.05 + 0.5 * t * t, z: ball.position.z };
  const startVelocity = ground ? { x: 0, y: -t, z: 0 } : { ...ball.velocity, y: ball.velocity.y - t };
  const acceleration = { x: 0, y: ground ? 1 : parameters.gravityY + 1, z: 0 };
  const dt = ground ? anchor.elapsedSeconds : 0, until = t - dt;
  const centerAtAnchor = startCenter.y + startVelocity.y * dt + 0.5 * acceleration.y * dt * dt;
  // Choose the original radius from the actual local quadratic coefficients. This
  // makes its later tangent a double root; it never rounds the resulting contact.
  const radius = centerAtAnchor - ball.position.y - 0.5 * until * until - parameters.ballRadius;
  if (!(radius > 0.01 && radius < 0.1)) throw new Error('zero-time synthetic glove radius out of fixture bounds');
  const actor: BallWorldMotionActor = { playerId: 'p2', primitive: { role: 'glove', radius,
    startTick: initial.originTick, endTick: initial.originTick + (t + 1) * parameters.ticksPerSecond,
    ticksPerSecond: parameters.ticksPerSecond, startCenter, startVelocity, acceleration } };
  return { anchor, contactElapsedSeconds, actor };
};

import { battedWorldFieldFixture } from './BattedWorldFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { openSqliteBattedWorldFieldExecutionStore, battedWorldFieldExecutionEvidenceFromSqlite,
  type AcceptedBattedWorldFieldExecution, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';

/** Reconstructed real Native fixture. Synthetic geometry and zero spin are set
 * before their Sources are admitted; every later state is derived by its owner. */
export const ownedZeroTimeChainFixture = (groundOverlap = false) => {
  let tangent: ReturnType<typeof ownedZeroTimeTangentSource> | undefined, receiverPlayerId = '';
  const x = battedWorldFieldFixture(undefined, true, false, 4, {
    groundRestitution: 0, pitchPhysics: { spin: { x: 0, y: 0, z: 0 } },
    world(world) {
      const initial = world.flight.flight.initialBall, p = world.flight.source.execution.ballFlightParameters;
      tangent = ownedZeroTimeTangentSource({ originTick: initial.tick, elapsedSeconds: 0, ball: initial }, p, groundOverlap);
      const frame = world.flight.physicalPitch.frame, acquirer = tangent.actor.playerId;
      receiverPlayerId = frame.batterActor!.defenderBindings.find(b => b.playerId !== acquirer)!.playerId;
      const model = world.models.get(world.model.sourceId)!;
      const root = (playerId: string) => {
        const defender = frame.world.defenders.find(d => d.playerId === playerId)!;
        const dt = (initial.tick - frame.world.tick) / p.ticksPerSecond;
        return { position: { x: defender.position.x + defender.velocity.x * dt,
          y: model.actors.find(a => a.playerId === playerId)!.bodyOriginHeightMeters,
          z: defender.position.z + defender.velocity.z * dt }, velocity: { x: defender.velocity.x, y: 0, z: defender.velocity.z } };
      };
      const acquirerRoot = root(acquirer), receiverRoot = root(receiverPlayerId), t = tangent.contactElapsedSeconds;
      const ballAtContact = groundOverlap ? tangent.anchor.ball.position : {
        x: initial.position.x + initial.velocity.x * t, y: initial.position.y + initial.velocity.y * t + 0.5 * p.gravityY * t * t,
        z: initial.position.z + initial.velocity.z * t };
      const receiverCenter = { x: ballAtContact.x - 10, y: groundOverlap ? 0 : ballAtContact.y, z: ballAtContact.z };
      const offset = (center: typeof initial.position, position: typeof initial.position) => ({ x: center.x - position.x, y: center.y - position.y, z: center.z - position.z });
      world.models.set(model.sourceId, { ...model, actors: model.actors.map((actor, i) => ({ ...actor,
        primitives: actor.primitives.map((primitive, j) => actor.playerId === acquirer && primitive.role === 'glove'
          ? { ...primitive, radius: tangent!.actor.primitive.radius, offset: offset(tangent!.actor.primitive.startCenter, acquirerRoot.position) }
          : actor.playerId === receiverPlayerId && primitive.role === 'glove'
            ? { ...primitive, offset: offset(receiverCenter, receiverRoot.position) }
            : { ...primitive, offset: { x: primitive.offset.x + 100 + i * 2, y: primitive.offset.y + 50, z: primitive.offset.z + 100 + j * 2 } }) })) });
      const source = world.sources.get(world.source.sourceId)!;
      world.sources.set(source.sourceId, { ...source, commands: source.commands.map(command => ({ ...command,
        bodyAcceleration: { x: 0, y: 0, z: 0 }, primitiveMotions: command.primitiveMotions.map(motion =>
          command.playerId === acquirer && motion.role === 'glove' ? { ...motion,
            offsetVelocity: offset(tangent!.actor.primitive.startVelocity, acquirerRoot.velocity), offsetAcceleration: tangent!.actor.primitive.acceleration }
            : command.playerId === receiverPlayerId && motion.role === 'glove' ? { ...motion,
              offsetVelocity: offset({ x: 0, y: 0, z: 0 }, receiverRoot.velocity), offsetAcceleration: { x: 0, y: 0, z: 0 } } : motion) })) });
    },
  });
  try {
    if (!tangent) throw new Error('zero-time tangent Source was not configured');
    const fieldSource = { ...x.source, throughTick: tangent.actor.primitive.endTick };
    x.sources.set(fieldSource.sourceId, fieldSource);
    const baseField = x.fields.accept(fieldSource.sourceId);
    const sources = new Map<string, AcceptedBattedWorldFieldExecution>();
    const executions = x.f.track(openSqliteBattedWorldFieldExecutionStore(x.f.path, x.fields,
      { readAcceptedExecution: id => sources.get(id) ?? null }));
    let current: DurableBattedWorldFieldExecution | null = null;
    const prefix = () => ({ baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(baseField, baseField.source.sourceId),
      executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(baseField, current?.source.sourceId ?? null) });
    const knownWork = fieldSource.commands.map(c => ({ playerId: c.playerId, decisionSourceId: null, motorSourceId: null }));
    const accept = (sourceId: string, action: AcceptedBattedWorldFieldExecution['action']) => {
      const source: AcceptedBattedWorldFieldExecution = { sourceId, sourceVersion: 'synthetic-zero-energy-reconstructed-v1',
        baseFieldSourceId: baseField.source.sourceId, previousExecutionSourceId: current?.source.sourceId ?? null, action };
      sources.set(sourceId, source); current = executions.accept(sourceId); return current;
    };
    const advance = (sourceId: string, checkpoint: OwnedMotionV2Action['checkpoint']) => accept(sourceId, { kind: 'owned_motion_v2', checkpoint, knownWork,
      contributions: actualPlayersKinematicsFromPrefix(knownWork.map(w => w.playerId), prefix())
        .map(self => ({ kind: 'retained' as const, playerId: self.playerId, command: self.activeCommand })) });
    const step = (sourceId: string, planSourceId: string, throughElapsedSeconds: number) =>
      advance(sourceId, { kind: 'operation', planSourceId, throughElapsedSeconds });
    const throughTick = tangent.actor.primitive.startTick + tangent.contactElapsedSeconds * tangent.actor.primitive.ticksPerSecond;
    const physicalField = (): typeof baseField.field => current?.execution.field ?? baseField.field;
    for (let i = 0; i < 8; i++) {
      const physical = physicalField();
      if (physical.motion.response.kind === 'capture_candidate') break;
      if (!physical.motion.cursor) throw new Error(`zero-time approach met unsupported ${physical.motion.response.kind}`);
      advance(`zero-tangent-approach-${i}`, { kind: 'motion', throughTick });
    }
    if (physicalField().motion.response.kind !== 'capture_candidate') throw new Error('zero-time approach did not reach its original tangent');
    return { ...x, baseField, fieldSource, executions, prefix, accept, step, knownWork, receiverPlayerId,
      contactElapsedSeconds: tangent.contactElapsedSeconds };
  } catch (error) { x.f.close(); throw error; }
};
