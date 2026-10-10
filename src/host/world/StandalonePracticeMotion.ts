import { assertStandaloneContactInput, isStandaloneContactCommand, readStandaloneContactFrame, executeStandaloneContact, type StandaloneContactCommand } from './StandalonePracticeContact';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec2, Vec3 } from '../../core/model/geometry';
import { DEVELOPMENT_DOMAINS, type DevelopmentDomain } from '../../core/world/development/DevelopmentTrajectory';
import { buildRunnerMotionTrajectory, type RunnerMotionState, type RunnerMotionIntent } from '../../core/sim/running/RunnerMotion';
import { buildDefenderMotionTrajectory, sampleDefenderMotionSegment, type DefenderMotionState } from '../../core/sim/fielding/DefenderMotion';
import { deriveRatedDefenderMotionParameters } from '../../core/sim/fielding/DefensiveRatingAdapters';
import { planCourseAwareSwingKinematicsV1, type CourseAwareSwingPlanInputV1 } from '../../core/sim/pitching/CourseAwareSwingKinematicsV1';
import { sampleSwingKinematicsV1, shiftSwingKinematicsTrajectoryV1 } from '../../core/sim/contact/SwingKinematicsV1';
import { resolveMotorStart } from '../../core/world/psychology/batting/BattingTiming';
import { assertSwingSpeedEnvelope } from '../../core/world/psychology/batting/BattingSpeedEnvelope';
import { playerBodyCapabilityMaterializationEvidenceFromSqlite } from './PlayerBodyCapabilityMaterializationEvidence';
import type { DurablePlayerBattingModelV1 } from './PlayerBattingModel';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { playerRunnerDecisionMotionModelEvidenceFromSqlite } from './SqlitePlayerRunnerDecisionMotionModelStore';
import { playerLocomotionModelEvidenceFromSqlite } from './SqlitePlayerLocomotionModelStore';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';
import { playerWorkloadRecoveryStoreFromSqlite } from './SqlitePlayerWorkloadRecoveryStore';
import { nonPitchFields as fields, nonPitchId as id } from './NonPitchDevelopmentRepetition';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type StandaloneSwingCommand = Readonly<{ issuedTick: number; bodyReadyTick: number; profileId: string; profileVersion: string;
  plan: Omit<CourseAwareSwingPlanInputV1, 'profile' | 'ticksPerSecond'> }>;

/** These are prospective commands. No contact, success or learning result is an input. */
export type StandalonePracticeCommand =
  | Readonly<{ kind: 'RUNNING_MOTION'; initial: RunnerMotionState; intent: RunnerMotionIntent; routeOrigin: Vec3; routeDirection: Vec2 }>
  | Readonly<{ kind: 'DEFENDER_FOOTWORK'; initial: DefenderMotionState; target: Vec2 | null; rootHeightMeters: number }>
  | (StandaloneSwingCommand & Readonly<{ kind: 'DRY_SWING' }>)
  | StandaloneContactCommand;
export type AcceptedStandalonePractice = Readonly<{
  sourceId: string; sourceVersion: string; opportunityId: string; careerId: string; playerId: string; personLinkSourceId: string;
  atDay: number; startTick: number; endTick: number; ticksPerSecond: number; workloadRevision: number;
  bodySourceId: string; modelSourceId: string; episodeId: string; episodeRevision: number; domain: DevelopmentDomain;
  command: StandalonePracticeCommand;
}>;
export const standaloneTick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const vector = (value: unknown, keys: readonly string[]) => fields(value, keys)
  && Object.values(value as Record<string, unknown>).every(n => typeof n === 'number' && Number.isFinite(n));
export const standalonePracticeInput = (raw: unknown, sourceId: string): AcceptedStandalonePractice => {
  const s = cloneInert(raw) as AcceptedStandalonePractice;
  if (!fields(s, ['sourceId', 'sourceVersion', 'opportunityId', 'careerId', 'playerId', 'personLinkSourceId', 'atDay',
    'startTick', 'endTick', 'ticksPerSecond', 'workloadRevision', 'bodySourceId', 'modelSourceId', 'episodeId', 'episodeRevision', 'domain', 'command'])
    || s.sourceId !== sourceId || ![s.sourceId, s.sourceVersion, s.opportunityId, s.careerId, s.playerId, s.personLinkSourceId,
      s.bodySourceId, s.modelSourceId, s.episodeId].every(id)
    || ![s.atDay, s.startTick, s.endTick, s.ticksPerSecond, s.workloadRevision, s.episodeRevision].every(standaloneTick)
    || !s.ticksPerSecond || s.endTick <= s.startTick || !DEVELOPMENT_DOMAINS.includes(s.domain)) throw new Error('invalid standalone practice Source');
  const c = s.command;
  if (c?.kind === 'RUNNING_MOTION') {
    if (!fields(c, ['kind', 'initial', 'intent', 'routeOrigin', 'routeDirection'])
      || !fields(c.initial, ['tick', 'routeDistanceMeters', 'speedMps', 'driveDirection', 'bodyMode'])
      || !fields(c.intent, ['kind', 'issuedTick']) || !['advance', 'retreat', 'hold', 'slide'].includes(c.intent.kind)
      || c.initial.tick !== s.startTick || c.intent.issuedTick !== s.startTick || !vector(c.routeOrigin, ['x', 'y', 'z'])
      || !vector(c.routeDirection, ['x', 'z']) || Math.abs(Math.hypot(c.routeDirection.x, c.routeDirection.z) - 1) > 1e-12) {
      throw new Error('invalid standalone running command');
    }
  } else if (c?.kind === 'DEFENDER_FOOTWORK') {
    if (!fields(c, ['kind', 'initial', 'target', 'rootHeightMeters']) || !fields(c.initial, ['tick', 'position', 'velocity'])
      || c.initial.tick !== s.startTick || !vector(c.initial.position, ['x', 'z']) || !vector(c.initial.velocity, ['x', 'z'])
      || c.target !== null && !vector(c.target, ['x', 'z']) || !Number.isFinite(c.rootHeightMeters)) throw new Error('invalid standalone footwork command');
  } else if (c?.kind === 'DRY_SWING' || c?.kind === 'BATTING_CONTACT') {
    const p = c.plan;
    if (!fields(c, ['kind', 'issuedTick', 'bodyReadyTick', 'profileId', 'profileVersion', 'plan',
      ...(c.kind === 'BATTING_CONTACT' ? ['pitchAttemptId', 'calibrationRef', 'parameters'] : [])]) || ![c.profileId, c.profileVersion].every(id)
      || !standaloneTick(c.issuedTick) || c.issuedTick > s.startTick || !standaloneTick(c.bodyReadyTick) || c.bodyReadyTick > s.startTick
      || !fields(p, ['handedness', 'batterCenterOfMass', 'targetBallCenterAtPlate', 'strikeZone', 'contactTick',
        ...(p && Object.hasOwn(p, 'targetBallCenterAtContact') ? ['targetBallCenterAtContact'] : [])])
      || !['R', 'L'].includes(p.handedness) || !vector(p.batterCenterOfMass, ['x', 'y', 'z']) || !vector(p.targetBallCenterAtPlate, ['x', 'y', 'z'])
      || Object.hasOwn(p, 'targetBallCenterAtContact') && !vector(p.targetBallCenterAtContact, ['x', 'y', 'z'])
      || !fields(p.strikeZone, ['centerX', 'halfWidth', 'lowerY', 'upperY']) || !standaloneTick(p.contactTick)) throw new Error('invalid standalone dry swing command');
    if (c.kind === 'BATTING_CONTACT') assertStandaloneContactInput(c);
  } else if (c?.kind === 'STATIONARY_GLOVE_RECEIVE') assertStandaloneContactInput(c);
  else throw new Error('unsupported standalone practice command');
  return freeze(s);
};

const assertBattingClock = (ticksPerSecond: number, model: DurablePlayerBattingModelV1): void => {
  if (model.predictionCalibration.values.parameters.ticksPerSecond !== ticksPerSecond
    || model.observationCalibration.values.calibration.memoryDecayParameters.ticksPerSecond !== ticksPerSecond) {
    throw new Error('standalone batting original model clock differs');
  }
};

/** Original owners are read on the consumer's snapshot, with pinned historical
 * model identity. Fresh admission additionally verifies the dated selection. */
export const readStandalonePracticeMotionFrame = (db: DatabaseSync, source: AcceptedStandalonePractice, fresh: boolean) => {
  const body = playerBodyCapabilityMaterializationEvidenceFromSqlite(db).read(source.bodySourceId);
  const link = playerPersonLinkEvidenceFromSqlite(db).readLink(source.personLinkSourceId);
  const workloadOwner = playerWorkloadRecoveryStoreFromSqlite(db, playerPersonLinkEvidenceFromSqlite(db));
  const workload = workloadOwner.selectAtRevision(source.careerId, source.playerId, source.workloadRevision);
  const role = source.command.kind === 'RUNNING_MOTION' ? 'runner' : ['DEFENDER_FOOTWORK', 'STATIONARY_GLOVE_RECEIVE'].includes(source.command.kind) ? 'defender' : 'batter';
  if (!body || !link || body.source.careerId !== source.careerId || body.source.playerId !== source.playerId
    || body.source.personLinkSourceId !== source.personLinkSourceId || body.source.role !== role || body.source.atDay > source.atDay
    || json(body.person) !== json(link) || workload.effectiveDay > source.atDay) throw new Error('standalone practice original body/Person/workload differs');
  if (fresh && workloadOwner.readHead(source.careerId, source.playerId)?.revision !== source.workloadRevision) throw new Error('standalone practice workload revision is stale');
  const scope = (model: { source: { careerId: string; playerId: string; personLinkSourceId: string; acceptedAtDay: number } }) => {
    if (model.source.careerId !== source.careerId || model.source.playerId !== source.playerId
      || model.source.personLinkSourceId !== source.personLinkSourceId || model.source.acceptedAtDay > source.atDay) throw new Error('standalone practice original model scope differs');
  };
  if (isStandaloneContactCommand(source.command)) return readStandaloneContactFrame(db, source, fresh, body, workload);
  if (source.command.kind === 'RUNNING_MOTION') {
    const owner = playerRunnerDecisionMotionModelEvidenceFromSqlite(db), model = owner.read(source.modelSourceId);
    if (!model) throw new Error('standalone runner model is missing'); scope(model);
    if (fresh && json(owner.selectAtDay(source.careerId, source.playerId, source.atDay)) !== json(model)) throw new Error('standalone runner model is stale');
    if (model.source.motion.ticksPerSecond !== source.ticksPerSecond) throw new Error('standalone runner clock differs');
    return freeze({ kind: source.command.kind, body, workload, model });
  }
  if (source.command.kind === 'DEFENDER_FOOTWORK') {
    const owner = playerLocomotionModelEvidenceFromSqlite(db), model = owner.read(source.modelSourceId);
    if (!model) throw new Error('standalone locomotion model is missing'); scope(model);
    if (fresh && json(owner.selectAtDay(source.careerId, source.playerId, source.atDay)) !== json(model)) throw new Error('standalone locomotion model is stale');
    if (json(body.fieldingModel) !== json(model.fieldingModel)) throw new Error('standalone footwork body/model differs');
    return freeze({ kind: source.command.kind, body, workload, model });
  }
  const owner = playerBattingModelEvidenceFromSqlite(db), model = owner.read(source.modelSourceId);
  if (!model) throw new Error('standalone batting model is missing'); scope(model);
  if (fresh && json(owner.selectAtDay(source.careerId, source.playerId, source.atDay)) !== json(model)) throw new Error('standalone batting model is stale');
  assertBattingClock(source.ticksPerSecond, model);
  if (json(model.bodyMaterialization) !== json(body)) throw new Error('standalone swing body/model differs');
  return freeze({ kind: source.command.kind, body, workload, model });
};
export type StandalonePracticeMotionFrame = ReturnType<typeof readStandalonePracticeMotionFrame>;

export const standalonePracticeSwingTrajectory = (s: AcceptedStandalonePractice, c: StandaloneSwingCommand, model: DurablePlayerBattingModelV1) => {
  assertBattingClock(s.ticksPerSecond, model);
  const profiles = model.repertoire.values.profiles.filter(item => item.profile.profileId === c.profileId && item.profile.version === c.profileVersion);
  if (profiles.length !== 1) throw new Error('standalone swing explicit profile is missing or ambiguous');
  const plan = planCourseAwareSwingKinematicsV1({ ...c.plan, ticksPerSecond: s.ticksPerSecond, profile: profiles[0].profile });
  const motor = model.capability.values;
  const preferred = shiftSwingKinematicsTrajectoryV1(plan.trajectory, motor.technicalTimingOffsetTicks);
  const motorStartTick = resolveMotorStart(preferred.startTick, c.issuedTick, c.bodyReadyTick, motor.motorLatencyTicks);
  const trajectory = shiftSwingKinematicsTrajectoryV1(preferred, motorStartTick - preferred.startTick);
  if (trajectory.startTick !== s.startTick || trajectory.endTick !== s.endTick) throw new Error('standalone swing prescribed motor interval differs');
  assertSwingSpeedEnvelope(trajectory, motor.maximumSweetSpotSpeedMps);
  return trajectory;
};

/** Calculate only the consumed prefix. The caller owns adopting it durably;
 * target/contact-named swing knots do not denote a bat/ball occurrence. */
export const executeStandalonePracticeMotion = (s: AcceptedStandalonePractice, frame: StandalonePracticeMotionFrame, throughTick: number) => {
  if (!standaloneTick(throughTick) || throughTick < s.startTick || throughTick > s.endTick) throw new Error('standalone practice consumed interval differs');
  const c = s.command;
  if (isStandaloneContactCommand(c) && (frame.kind === 'BATTING_CONTACT' || frame.kind === 'STATIONARY_GLOVE_RECEIVE')) return executeStandaloneContact(s, frame, throughTick);
  if (c.kind === 'RUNNING_MOTION' && frame.kind === c.kind) {
    if (Math.abs(c.initial.speedMps) > frame.model.source.motion.topSpeedMps) throw new Error('standalone runner inherited speed exceeds capability');
    const trajectory = buildRunnerMotionTrajectory(c.initial, c.intent, throughTick - s.startTick, frame.model.source.motion);
    const root = { x: c.routeOrigin.x + c.routeDirection.x * trajectory.endState.routeDistanceMeters, y: c.routeOrigin.y,
      z: c.routeOrigin.z + c.routeDirection.z * trajectory.endState.routeDistanceMeters };
    return freeze(cloneInert({ kind: c.kind, trajectory, root, moved: trajectory.segments.some(segment =>
      segment.endElapsedSeconds > segment.startElapsedSeconds && (segment.startSpeedMps !== 0 || segment.accelerationMps2 !== 0)) }));
  }
  if (c.kind === 'DEFENDER_FOOTWORK' && frame.kind === c.kind) {
    const calibration = frame.model.source.calibration;
    if (Math.hypot(c.initial.velocity.x, c.initial.velocity.z) > calibration.topSpeedMps) throw new Error('standalone defender inherited speed exceeds capability');
    const parameters = deriveRatedDefenderMotionParameters({ ticksPerSecond: s.ticksPerSecond,
      maxIntegrationStepTicks: calibration.maxIntegrationStepTicks, accelerationMps2: calibration.accelerationRatingCalibration.lowestAbilityAccelerationMps2,
      brakingMps2: calibration.brakingMps2, topSpeedMps: calibration.topSpeedMps, arrivalRadiusMeters: calibration.arrivalRadiusMeters },
    frame.model.fieldingModel.source.ratings, calibration.accelerationRatingCalibration);
    // Freeze integration boundaries to the prescribed command, so adopting a
    // partial cut cannot retrospectively change an earlier acceleration.
    const segments = buildDefenderMotionTrajectory(c.initial, c.target, s.endTick - s.startTick, parameters)
      .filter(segment => segment.startTick < throughTick).map(segment => ({ ...segment, endTick: Math.min(segment.endTick, throughTick) }));
    const endState = segments.length ? sampleDefenderMotionSegment(segments[segments.length - 1], throughTick) : c.initial;
    return freeze(cloneInert({ kind: c.kind, parameters, segments, endState,
      root: { x: endState.position.x, y: c.rootHeightMeters, z: endState.position.z },
      moved: segments.some(segment => segment.endTick > segment.startTick && (segment.startVelocity.x !== 0 || segment.startVelocity.z !== 0
        || segment.acceleration.x !== 0 || segment.acceleration.z !== 0)) }));
  }
  if (c.kind === 'DRY_SWING' && frame.kind === c.kind) {
    const trajectory = standalonePracticeSwingTrajectory(s, c, frame.model);
    const sample = sampleSwingKinematicsV1(trajectory, throughTick);
    return freeze(cloneInert({ kind: c.kind, trajectory, consumedThroughTick: throughTick, sample, moved: throughTick > s.startTick }));
  }
  throw new Error('standalone command/model family differs');
};
