import type { DatabaseSync } from 'node:sqlite';
import type { Vec3 } from '../../core/model/geometry';
import type { AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { sampleAerodynamicPitchTrajectory, advanceAerodynamicPitchState } from '../../core/sim/pitching/AerodynamicPitchTrajectory';
import { createRigidBatSwingWindowFromKinematicsV1, resolveAerodynamicRigidBatSwing } from '../../core/sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../core/sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../core/sim/contact/WoodBatSpeedResponseProfile';
import { sampleSwingKinematicsV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { deriveBallWorldContinuation, deriveAcceleratedBallWorldMotion, type BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import { respondToBallWorldBoundary, type BattedWorldBallCursor } from '../../core/sim/ball/BattedWorldContinuation';
import { deriveBallWorldGloveAcquisition, deriveBallWorldGloveCaptureDeadline } from '../../core/sim/ball/BattedWorldAcquisition';
import { assertBattedResponseProfiles, type BallWorldResponseInput, type BattedActorResponseProfile } from '../../core/sim/ball/BattedBallContactResponse';
import { deriveCatchRetentionParameters, type CatchRetentionSkillCalibration } from '../../core/sim/fielding/CatchRetentionSkill';
import type { CatchRetentionParameters } from '../../core/sim/fielding/CatchRetention';
import type { BallFlightParameters } from '../../core/sim/ball/BallFlight';
import type { BattedWorldSurface } from '../../core/sim/ball/BattedBallWorldContacts';
import type { BallContactMaterial } from '../../core/sim/ball/BallContactResponse';
import type { BodyMaterializationReceipt, BodySourceRef } from './PlayerBodyCapabilityMaterialization';
import type { PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { readNativePitchPracticeAttemptFromSqlite } from './NativePitchPracticeEvidenceFromSqlite';
import { standalonePracticeSwingTrajectory, type AcceptedStandalonePractice, type StandaloneSwingCommand } from './StandalonePracticeMotion';
import { nonPitchFields as fields, nonPitchId as id } from './NonPitchDevelopmentRepetition';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';

export type StandaloneBattingContactCommand = StandaloneSwingCommand & Readonly<{
  kind: 'BATTING_CONTACT'; pitchAttemptId: string; calibrationRef: BodySourceRef; parameters: AerodynamicPitchTrajectoryParameters;
}>;
export type StandaloneGloveReceiveCommand = Readonly<{
  kind: 'STATIONARY_GLOVE_RECEIVE'; pitchAttemptId: string; calibrationRef: BodySourceRef; rootPosition: Vec3;
  parameters: BallFlightParameters & Readonly<{ groundRollingDecelerationMps2: number }>;
  surfaces: readonly Readonly<{ geometry: BattedWorldSurface; material: BallContactMaterial }>[];
  glove: Readonly<{ pocketCenterOffset: Vec3; bodyStability: number; retention: CatchRetentionParameters; skill: CatchRetentionSkillCalibration }>;
  otherBodyMaterial: BallContactMaterial;
}>;
export type StandaloneContactCommand = StandaloneBattingContactCommand | StandaloneGloveReceiveCommand;
export const isStandaloneContactCommand = (c: { kind: string }): c is StandaloneContactCommand =>
  c.kind === 'BATTING_CONTACT' || c.kind === 'STATIONARY_GLOVE_RECEIVE';
const vector = (v: unknown) => fields(v, ['x', 'y', 'z']) && Object.values(v as Record<string, unknown>).every(Number.isFinite);
export const assertStandaloneContactInput = (command: StandaloneContactCommand) => {
  if (!id(command.pitchAttemptId) || !fields(command.calibrationRef, ['sourceId', 'sourceVersion'])
    || !Object.values(command.calibrationRef).every(id)) throw new Error('invalid standalone original pitch/calibration');
  const p = command.parameters;
  if (command.kind === 'BATTING_CONTACT') {
    const a = p as AerodynamicPitchTrajectoryParameters;
    if (!fields(a, ['ticksPerSecond', 'integrationStepTicks', 'gravityY', 'aerodynamics'])
      || !fields(a.aerodynamics, ['ballMassKg', 'ballRadiusM', 'airDensityKgM3', 'windVelocityMps', 'dragCoefficient',
        ...['coefficientProfile', 'airKinematicViscosityM2PerSecond', 'spinDecay'].filter(key => Object.hasOwn(a.aerodynamics, key))])) {
      throw new Error('invalid explicit standalone aerodynamic calibration');
    }
  } else if (!fields(command, ['kind', 'pitchAttemptId', 'calibrationRef', 'rootPosition', 'parameters', 'surfaces', 'glove', 'otherBodyMaterial'])
    || !vector(command.rootPosition) || !fields(p, ['ticksPerSecond', 'gravityY', 'ballRadius', 'groundRestitution', 'groundFriction',
      'groundRollingDecelerationMps2', 'integrationStepTicks', 'restingVerticalSpeed']) || !Object.values(p).every(Number.isFinite)
    || !fields(command.glove, ['pocketCenterOffset', 'bodyStability', 'retention', 'skill']) || !vector(command.glove.pocketCenterOffset)
    || !fields(command.glove.retention, ['ticksPerSecond', 'ballMassKg', 'ballRadiusMeters', 'pocketRadiusMeters', 'centerRetentionCapacityJ',
      'captureDissipationPowerW', 'failedContactRestitution', 'failedTangentialDamping', 'failedSpinDamping'])
    || !fields(command.glove.skill, ['lowAbilityCenterRetentionCapacityMultiplier', 'highAbilityCenterRetentionCapacityMultiplier',
      'lowAbilityCaptureDissipationPowerMultiplier', 'highAbilityCaptureDissipationPowerMultiplier'])
    || !fields(command.otherBodyMaterial, ['restitution', 'tangentialDamping', 'spinDamping']) || !Array.isArray(command.surfaces)
    || command.surfaces.some(value => !fields(value, ['geometry', 'material'])
      || !fields(value.geometry, ['surfaceId', 'start', 'end', 'minimumHeight', 'maximumHeight'])
      || !fields(value.material, ['restitution', 'tangentialDamping', 'spinDamping']))) throw new Error('invalid explicit standalone glove calibration');
};
const originalPitch = (db: DatabaseSync, source: AcceptedStandalonePractice, fresh: boolean) => {
  if (!isStandaloneContactCommand(source.command)) throw new Error('standalone contact command is missing');
  const pitch = readNativePitchPracticeAttemptFromSqlite(db, source.command.pitchAttemptId);
  if (!pitch || pitch.opportunity.careerId !== source.careerId || pitch.opportunity.playerId === source.playerId
    || pitch.opportunity.atDay !== source.atDay || source.ticksPerSecond !== 1_000_000
    || source.command.parameters.ticksPerSecond !== source.ticksPerSecond
    || pitch.plannedDelivery.release.releaseAtUs >= source.endTick) throw new Error('standalone original pitching scope or clock differs');
  if (source.command.kind === 'STATIONARY_GLOVE_RECEIVE' && source.startTick > pitch.plannedDelivery.release.releaseAtUs) {
    throw new Error('whole-flight stationary receiving must start no later than original release');
  }
  if (fresh && pitch.throughUs >= pitch.plannedDelivery.release.releaseAtUs) throw new Error('standalone recipient command must precede consumed pitch release');
  return freeze({ attemptId: pitch.attemptId, opportunity: pitch.opportunity, frame: pitch.frame,
    plannedDelivery: pitch.plannedDelivery, priorClock: pitch.priorClock });
};
export const readStandaloneContactFrame = (db: DatabaseSync, source: AcceptedStandalonePractice, fresh: boolean,
  body: BodyMaterializationReceipt, workload: PlayerWorkloadRecoveryState) => {
  const c = source.command, pitch = originalPitch(db, source, fresh);
  if (c.kind === 'BATTING_CONTACT') {
    const owner = playerBattingModelEvidenceFromSqlite(db), model = owner.read(source.modelSourceId);
    if (!model || json(model.bodyMaterialization) !== json(body) || model.source.acceptedAtDay > source.atDay
      || fresh && json(owner.selectAtDay(source.careerId, source.playerId, source.atDay)) !== json(model)
      || c.parameters.aerodynamics.ballMassKg !== model.equipment.values.ball.massKg
      || c.parameters.aerodynamics.ballRadiusM !== model.equipment.values.ball.radiusM) throw new Error('standalone bat original model/equipment differs');
    return freeze({ kind: c.kind, body, workload, model, pitch });
  }
  if (c.kind !== 'STATIONARY_GLOVE_RECEIVE') throw new Error('unsupported standalone contact family');
  const owner = playerFieldingModelEvidenceFromSqlite(db), model = owner.read(source.modelSourceId);
  if (!model || json(body.fieldingModel) !== json(model) || model.source.acceptedAtDay > source.atDay
    || fresh && json(owner.selectAtDay(source.careerId, source.playerId, source.atDay)) !== json(model)) throw new Error('standalone glove original model differs');
  return freeze({ kind: c.kind, body, workload, model, pitch });
};
export type StandaloneContactFrame = ReturnType<typeof readStandaloneContactFrame>;
/** Freeze the first actually consumed release prefix. Later follow-through or
 * assessments cannot rewrite the ball's original launch or this proof. */
export const readStandaloneConsumedRelease = (db: DatabaseSync, source: AcceptedStandalonePractice, throughTick: number) => {
  if (!isStandaloneContactCommand(source.command) || throughTick <= source.startTick) return null;
  const original = originalPitch(db, source, false), releaseAtUs = original.plannedDelivery.release.releaseAtUs;
  if (throughTick < releaseAtUs) return null;
  const pitch = readNativePitchPracticeAttemptFromSqlite(db, original.attemptId)!;
  if (!pitch.events.some(event => event.kind === 'released' && event.atUs === releaseAtUs)) throw new Error('original practice pitch release has not been consumed');
  const row = db.prepare('SELECT progress_json FROM main.pitch_practice_attempts WHERE attempt_id=?').get(original.attemptId)!;
  const progress = JSON.parse(String(row.progress_json)) as readonly { beforeRevision: number; throughUs: number }[];
  const index = progress.findIndex(step => step.throughUs >= releaseAtUs);
  if (index < 0) throw new Error('original consumed pitch release prefix is missing');
  return freeze({ attemptId: original.attemptId, releaseAtUs, revision: index + 1,
    prefixHash: hash({ original, progress: progress.slice(0, index + 1) }) });
};
const ballFrom = (frame: StandaloneContactFrame) => {
  const { releaseAtUs: tick, position, velocity, spin } = frame.pitch.plannedDelivery.release;
  return { tick, position, velocity, spin };
};
const inertCore = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(inertCore) as T;
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, inertCore(item)])) as T;
};
export const executeStandaloneContact = (source: AcceptedStandalonePractice, frame: StandaloneContactFrame, throughTick: number) => {
  const c = source.command, initialBall = ballFrom(frame), reserved = throughTick <= source.startTick;
  if (c.kind === 'BATTING_CONTACT' && frame.kind === c.kind) {
    const trajectory = standalonePracticeSwingTrajectory(source, c, frame.model);
    if (trajectory.startTick < initialBall.tick) throw new Error('standalone bat motor precedes original pitch release');
    const flight = { start: initialBall, endTick: source.endTick, parameters: c.parameters };
    sampleAerodynamicPitchTrajectory(flight, initialBall.tick);
    if (reserved) return freeze({ kind: c.kind, moved: false, repetitionOccurred: false, completionAllowed: false, ball: null, contact: null, sample: null });
    const result = resolveAerodynamicRigidBatSwing({ trajectory: flight,
      swing: createRigidBatSwingWindowFromKinematicsV1(trajectory, frame.model.equipment.values.batPhysical),
      ball: frame.model.equipment.values.ball, parameterResolver: kinematics =>
        resolveWoodBatSpeedResponse(NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1, kinematics.normalApproachSpeedMps) });
    const contact = result.kind === 'contact' && result.contact.tick <= throughTick ? result.contact : null;
    // Preserve the original post-contact free-ball state. This bounded batting
    // owner does not claim downstream field/custody/ground events from a forecast.
    const ball = contact ? { tick: contact.tick, position: contact.ballCenter, velocity: contact.exitVelocity, spin: contact.exitSpin }
      : advanceAerodynamicPitchState(initialBall, throughTick - initialBall.tick, c.parameters);
    return freeze(cloneInert(inertCore({ kind: c.kind, moved: throughTick > source.startTick, repetitionOccurred: contact !== null,
      completionAllowed: true, ball, contact, sample: sampleSwingKinematicsV1(trajectory, throughTick) })));
  }
  if (c.kind !== 'STATIONARY_GLOVE_RECEIVE' || frame.kind !== c.kind) throw new Error('standalone contact model family differs');
  const actors = frame.body.actor.primitives.map(shape => ({ playerId: source.playerId, primitive: { role: shape.role,
    radius: shape.radius, startTick: initialBall.tick, endTick: source.endTick, ticksPerSecond: source.ticksPerSecond,
    startCenter: { x: c.rootPosition.x + shape.offset.x, y: c.rootPosition.y + shape.offset.y, z: c.rootPosition.z + shape.offset.z },
    startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } }));
  const parameters = deriveCatchRetentionParameters(c.glove.retention, frame.model.source.ratings.catching, c.glove.skill);
  const response: BallWorldResponseInput = { world: { actors, parameters: c.parameters, surfaces: c.surfaces.map(surface => surface.geometry) },
    actors: actors.map(actor => ({ playerId: actor.playerId, profile: actor.primitive.role === 'glove'
      ? { role: 'glove', pocketCenterOffset: c.glove.pocketCenterOffset, bodyStability: c.glove.bodyStability, parameters }
      : { role: actor.primitive.role, material: c.otherBodyMaterial } as BattedActorResponseProfile })),
    surfaces: c.surfaces.map(surface => ({ surfaceId: surface.geometry.surfaceId, material: surface.material })) };
  assertBattedResponseProfiles(response);
  // Validate explicit geometry/physical units even before release consumption.
  deriveBallWorldContinuation({ ...response.world, moment: { originTick: initialBall.tick, elapsedSeconds: 0, ball: initialBall },
    previousContacts: [], throughTick: initialBall.tick });
  if (reserved || throughTick < initialBall.tick) return freeze({ kind: c.kind, moved: false, repetitionOccurred: false,
    completionAllowed: false, state: 'waiting_for_release' as const, ball: null, events: [] });
  let cursor: BattedWorldBallCursor = { moment: { originTick: initialBall.tick, elapsedSeconds: 0, ball: initialBall }, previousContacts: [] };
  const events: unknown[] = []; let contacted = false;
  const endpoint = (state: string, moment: BallWorldMoment, completionAllowed: boolean) => freeze(cloneInert({ kind: c.kind, moved: false,
    repetitionOccurred: contacted, completionAllowed, state, ball: moment, events }));
  for (let step = 0; step < 10_000; step++) {
    const world = deriveBallWorldContinuation({ ...response.world, moment: cursor.moment, previousContacts: cursor.previousContacts, throughTick });
    const result = respondToBallWorldBoundary(response, cursor, world);
    if (world.kind !== 'boundary') return endpoint('free', world.moment, true);
    events.push({ world, response: result });
    contacted ||= world.contacts.some(contact => contact.kind === 'actor' && contact.playerId === source.playerId && contact.role === 'glove');
    if (result.kind === 'capture_candidate') {
      const motion = { actors, carrierPlayerId: null, world, response: result, cursor: null };
      const contact = world.contacts[0];
      if (contact.kind !== 'actor') throw new Error('standalone original glove contact is missing');
      const constrained = { ...world.moment, ball: { ...world.moment.ball, velocity: contact.velocity, spin: { x: 0, y: 0, z: 0 } } };
      const carried = (moment: BallWorldMoment) => deriveAcceleratedBallWorldMotion({ ...response.world, moment,
        throughElapsedSeconds: (throughTick - initialBall.tick) / source.ticksPerSecond, acceleration: { x: 0, y: 0, z: 0 },
        previousContacts: [{ kind: 'actor', playerId: source.playerId, role: 'glove' }] });
      // The prescribed pose has no authority beyond the command interval. A
      // still-dissipating ball remains constrained and cannot become possession.
      const deadline = deriveBallWorldGloveCaptureDeadline(world.moment, result.retention, parameters);
      if (deadline.candidateSecureTick > source.endTick) {
        const partial = carried(constrained);
        return endpoint(partial.kind === 'boundary' ? 'capture_interrupted' : 'capturing', partial.moment, false);
      }
      const acquisition = deriveBallWorldGloveAcquisition({ response, motion });
      const end = acquisition.kind === 'secured' ? acquisition.moment : acquisition.world.moment;
      const endTick = acquisition.kind === 'secured' ? acquisition.secureTick : end.ball.tick;
      if (endTick > throughTick) {
        const partial = carried(constrained);
        if (partial.kind === 'boundary') return endpoint('capture_interrupted', partial.moment, false);
        return endpoint('capturing', partial.moment, false);
      }
      events.push({ acquisition });
      if (acquisition.kind === 'interrupted') return endpoint('capture_interrupted', end, false);
      const continuation = carried(end);
      return endpoint(continuation.kind === 'boundary' ? 'carried_contact_pending' : 'secured', continuation.moment, continuation.kind !== 'boundary');
    }
    if (!result.cursor) return endpoint('contact_pending', world.moment, false);
    if (world.moment.elapsedSeconds >= (throughTick - initialBall.tick) / source.ticksPerSecond) return endpoint(result.kind, result.cursor.moment, true);
    if (json(result.cursor) === json(cursor)) throw new Error('standalone ball continuation makes no progress');
    cursor = result.cursor;
  }
  throw new Error('standalone physical boundary budget exhausted without completion');
};
