import { liveFielderBodyPoseV105, sampleLiveFielderPostureV105, validateLiveFielderBodyModelV105, liveFielderReachTargetV105, liveFielderDesiredCrouchV105, liveFielderHorizontalReachV105, liveFielderPreferredBodyPointV105, liveFielderThrowOffsetV105, liveFielderRecoverySecondsV105, liveFielderPreparationPostureSecondsV105, createLiveBodyHandPreparationV105, type LiveFielderBodyModelV105, type LiveFielderBodyPoseV105, type LiveFielderPostureV105 } from './LiveFielderBodyGeometryV105';
import { sampleLiveTransferDelayV101 } from './LiveTransferTimingV101';
import { estimateLiveReceiverArrivalV106 } from './LiveReceiverArrivalV106';
import {estimateLivePostActionArrivalV1,createLiveObservedPostActionV1,type LivePostActionContextV120} from './LivePostActionArrivalV1';
import {estimateLiveObservedRecoveryV120} from './LiveObservedRecoveryV120';
import type {LivePursuitWindowV1} from './LiveFieldPursuitV1';
import { decideLiveDoublePlayV106, type LiveDoublePlayRouteV106 } from './LiveDoublePlayDecisionV106';
import { decideLiveFirstBaseAttemptV108 } from './LiveFirstBaseAttemptV108';
import { withLiveThrowPhysicalMemoV113, getLiveThrowPhysicalMemoStatsV113 } from './LiveThrowPhysicalMemoV113';
import {createLiveFielderAthleticV115,type LiveFielderAthleticPlanV115} from './LiveFielderAthleticV115';
import {liveFielderReachMarginV105} from './LiveFielderBodyGeometryV105';
import {validateLiveAthleticProfileV115,type LiveAthleticProfileV115} from '../LiveAthleticControlsV115';
import {createLiveRunnerSlideV115,type LiveRunnerSlideMotionV115} from '../running/LiveRunnerSlideV115';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldMoment } from '../ball/BallWorldContinuation';
import { captureLivePoleContactWitnessV213, type LivePoleContactWitnessV213 } from './LivePoleContactWitnessV213';
import { createSourceFreeBallKernel, type SourceFreeBallKernel, type SourceFreeBallDescriptorV2 } from '../ball/SourceFreeBallKernel';
import { createSourceFreePoleSessionV148, type SourceFreePoleSessionInputV148, type SourceFreePoleQueryInputV148, type SourceFreeBallWorldQueryResultV2 } from '../ball/SourceFreeBallWorldQuery';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { respondToBallContact } from '../ball/BallContactResponse';
import { sourceRk4PositionBounds } from '../ball/SourceFreeBallSpeedBound';
import { quantizeEventTick } from '../ExactEventTime';
import { IDENTITY_QUATERNION, advanceBaseballOrientation, multiplyQuaternions, type Quaternion } from '../pitching/BaseballOrientation';
import { createLiveLocomotionProfileV84, stepLiveDefenderMotionV84 } from '../locomotion/LiveLocomotionV84';
import { coordinateLiveFielderMotionV1, LIVE_FIELDER_AVOIDANCE_POLICY_V1 } from './LiveFielderAvoidanceV1';
import { resolveCatchRetention, type CatchRetentionParameters } from './CatchRetention';
import { createGroundWallRollingCurveV1 } from './GroundWallRollingCurveV1';
import { createLiveFieldForecastV1, liveUnobservedSeamPhysicsV113 } from './LiveFieldForecastV1';
import { predictLiveDefensiveOpportunityV1, LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1,
  type LiveDefensiveOpportunityV1 } from './LiveDefensiveOpportunityV1';
import { resolveGroundedActorContactResponseV1 } from './GroundedActorContactResponseV1';
import { planLiveThrowV1 } from './LiveThrowPlanV1';
import { planLiveThrowActionV103,LIVE_THROW_EFFORT_POLICY_V103 } from './LiveThrowActionV103';
import { liveFielderTurnSpeedV110 } from './LiveFielderBodyGeometryV105';
import { planLiveTransferActionV110,resolveLiveGloveTossCapabilityV110,liveGloveTossOffsetV110 } from './LiveGloveTossV110';
import { createLiveHandPreparationV1 } from './LiveHandPreparationV1';
import { assignLiveFieldRolesV1, liveFieldArrivalSecondsV1 as uncachedFieldArrivalV120, LIVE_FIELD_ROLE_POLICY_V1,
  type LiveFieldRoleV1, type LiveFieldRoleActorV1,type LiveFieldRoleCostDiagnosticV118 } from './LiveFieldRoleAssignmentV1';
import { applyLiveThrowDirectionV1 } from './LiveThrowDirectionV1';
import { decideLiveRunnerAdvanceV1, estimateLiveRunnerLegSecondsV1 } from './LiveRunnerAdvancePolicyV1';
import { selectLiveFieldHandlerV1 } from './LiveFieldHandlerSelectionV1';
import {createLiveFieldDecisionTraceV1} from './LiveFieldDecisionTraceV1';
import {captureLiveFieldObservationSnapshotV1,buildLiveFieldPerceivedStateV1,type LiveFieldObservationSnapshotV1} from './LiveFieldPerceptionV1';
import {type LiveFieldCoordinationPayloadV1} from './LiveFieldCoordinationV1';
import {createLiveFieldCoordinationV2} from './LiveFieldCoordinationV2';
import {readLiveFieldCommitmentV1,type LiveFieldCommitmentV1,type LiveBodyBezierSegmentV1} from './LiveFieldCommitmentV1';
import {certifyLiveAthleticClearanceV1,validateLiveAthleticClearanceV1,type LiveAthleticClearanceInputV1} from './LiveAthleticClearanceV1';
import {evaluateLiveFieldDecisionV1,liveFieldIntentV1,updateLiveRetouchBeliefV118,type LiveRetouchBeliefV118,type LiveFieldAdviceV1} from './LiveFieldDecisionV1';
import { planLiveRelayV1, type LiveRelayPlanV1, type LiveRelayActorV1 } from './LiveRelayPlanV1';
import { createLiveDefenseControlMemoV95, estimateLiveDefenseControlV95, type LiveDefenseControlSourceV95 } from './LiveDefenseControlEstimateV95';
import { createLiveRunnerMotionV1, type LiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';
import { createLiveRunnerRetreatMotionV1 } from '../running/LiveRunnerRetreatMotionV1';
import { SeedRoot } from '../../rng/SeedRoot';
import {createLivePlayRandomStreamsV152,type LiveRandomnessV152} from '../../rng/LiveRandomStreamsV152';
import { decideLiveReceiveTimingV99, validateFieldRelationshipsV99, type FieldRelationshipV99 } from './LiveReceiveTimingV99';
import { validateTechnicalSkillControlsV75, type TechnicalSkillControlsV75 } from '../TechnicalSkillControlsV75';
import { createInitialForceObligationState, deriveCurrentForceObligations, retireForceParticipant,
  satisfyForceParticipantObligation } from '../../rules/ForceObligation';
import type { BaseballBase, RunnerBaseTouchFact, ControlledBaseContactFact, ControlledRunnerTagFact,
  RunnerBaseDepartureFact, DefensiveAppealAttemptFact, PlayEndFact } from '../../rules/PhysicalRuleFacts';

export type LiveFielderV1 = Readonly<{ playerId: string; position: Vec3; velocity?: Vec3;
  fieldRelationshipsV99?: readonly FieldRelationshipV99[];
  technicalSkills?: TechnicalSkillControlsV75;
  bodyModelV105?: LiveFielderBodyModelV105;
  athleticProfileV115?: LiveAthleticProfileV115;
  defensivePosition?: LiveFieldRoleActorV1['defensivePosition'];
  reactionSeconds: number; topSpeedMps: number; accelerationMps2: number;
  /** Explicit additional decision latency, independent of team assignment correctness. */
  fieldingCognition?: Readonly<{ decisionSeconds: number; pursuitCostWeight?: number; cautious?: boolean }>;
  gloveSpeedMps: number; gloveReachMeters: number; gloveRadiusMeters: number;
  catchRetention: CatchRetentionParameters; transferSeconds: number; transferDelayMaxSecondsV101?: number; throwSpeedMps: number;
  throwEffortBuildSecondsV103?: number;
  throwDirectionStdRadians?: number;
  throwSpinRadPerSecond?: Vec3; throwBackspinRadPerSecond?: number }>;
export type LiveRunnerV1 = Readonly<{ runnerId: string; initialBase: 0 | 1 | 2 | 3;
  athleticProfileV115?: LiveAthleticProfileV115;
  technicalSkills?: TechnicalSkillControlsV75;
  position?: Vec3; topSpeedMps: number; accelerationMps2: number; reactionSeconds: number;
  advanceSafetyMarginSeconds?: number; roundingRadiusMeters?: number; lateralAccelerationMps2?: number }>;
export type LiveFieldGeometryV1 = Readonly<{ bases: Readonly<Record<'home' | 'first' | 'second' | 'third', Vec3>>;
  fenceRadiusMeters: number; fenceHeightMeters: number; foulFenceRadiusMeters?: number; baseTouchRadiusMeters?: number;
  /** Explicit authored physical equipment; no real-park or official rule authority is inferred. */
  poleEquipmentV148?: SourceFreePoleSessionInputV148 }>;
export type LiveFieldPlayInputV1 = Readonly<{ ball: BallWorldMoment; physics: AeroGroundBallPhysicsV1;
  orientation?: Quaternion; field: LiveFieldGeometryV1; fielders: readonly LiveFielderV1[];
  runners: readonly LiveRunnerV1[]; outs: number; maxPlaySeconds?: number; frameSeconds?: number; seed?: number;
  /** Explicit PLAY-scoped independent random roots; omission retains legacy streams. */
  randomnessV152?:LiveRandomnessV152;
  /** Research-only physical execution offsets. No result/ability is replaced. */
  executionPerturbationsV95?: Readonly<{ throwErrors: readonly Readonly<{ releaseOrdinal: number; yawRadians: number; pitchRadians: number }>[] }>;
  /** Read-only first movement diagnostics; omitted in normal matches. */
  recordInitialMovementV98?: true;
  /** Internal transition/research setting. Never an authored player ability. */
  defenseDecisionModeV118?: 'legacy'|'shadow'|'individual';
  recordDecisionTraceV118?: true }>;
export type LiveFieldRuleFactsV1 = Readonly<{ contactTick: number; throughTick: number; territory: 'fair' | 'foul';
  firstGroundContactTick: number | null; flyCatch: Readonly<{ fielderId: string; firstTouchTick: number; secureCatchTick: number }> | null;
  runnerTouches: readonly RunnerBaseTouchFact[]; controlledBaseContacts: readonly ControlledBaseContactFact[];
  controlledRunnerTags: readonly ControlledRunnerTagFact[]; runnerDepartures: readonly RunnerBaseDepartureFact[];
  defensiveAppeals?: readonly DefensiveAppealAttemptFact[];
  /** Physical equipment alone does not adopt a foul-pole or home-run policy. */
  pendingEquipmentPolicyV148?: Readonly<{ firstContactTick: number; surfaceIds: readonly string[] }>;
  overFence: Readonly<{ tick: number; fair: boolean; untouchedGround: boolean; cause?: 'batted' | 'throw';
    awardFrom?: Readonly<Record<string, number>> }> | null; playEnd: PlayEndFact }>;
export type LiveFieldFactV1 = Readonly<{ kind: 'ground_contact' | 'glove_contact' | 'body_contact' | 'pole_contact' | 'catch_secured' | 'throw_release'
  | 'runner_base_touch' | 'runner_base_departure' | 'controlled_base_contact' | 'controlled_runner_tag' | 'over_fence' | 'territory_determined' | 'wall_support' | 'play_end';
  elapsedSeconds: number; tick: number; playerId?: string; runnerId?: string; base?: BaseballBase;
  position?: Vec3; reason?: string; surfaceId?: string;
  /** At-release controller metadata, never inferred from a subsequent catch. */
  receiverPlayerId?: string; target?: Vec3 }>;
type ThrowEffortCommandV103 = { playerId: string; from: number; chargeFrom: number; readyAt: number; effort: number;
  commandIdV118?:string;
  commandSpeedMps: number; capacitySpeedMps: number; fullChargeSeconds: number; requiredChargeSeconds: number;
  plannedFlightSeconds: number; plannedArrivalAtSeconds: number; plannedControlAtSeconds: number;
  runnerDeadlineAtSeconds: number; receiverReadyAtSeconds: number; target: Vec3; base: BaseballBase;
  reason: Extract<ReturnType<typeof planLiveTransferActionV110>, { kind: 'planned' }>['selectionReason'];
  releaseStyleV110:'hand_throw'|'glove_toss';
  outputSearchLimitApplied: boolean };
export type LiveFieldFrameV1 = Readonly<{ elapsedSeconds: number; tick: number;
  /** Source action samples after official closure; never additional rule facts. */
  recoveryV115?: Readonly<{ kind: 'runner_action_recovery'|'athletic_action_recovery'; officialEndTick: number; readOnly: true }>;
  defensiveOpportunity: LiveDefensiveOpportunityV1 | null;
  ball: Readonly<{ position: Vec3; velocity: Vec3; spin: Vec3; orientation: Quaternion;
    visible: boolean; possessedBy: string | null; phase: string }>;
  fielders: readonly Readonly<{ playerId: string; position: Vec3; velocity: Vec3; glove: Vec3; bodyPoseV105?: LiveFielderBodyPoseV105;
    athleticV115?:Readonly<{kind:'jump'|'dive';phase:string;fromSeconds:number;throughSeconds:number}>;
    intent: 'intercept' | 'base_cover' | 'relay' | 'backup' | 'hold' | 'tag'; targetBase: BaseballBase | null }>[];
  runners: readonly Readonly<{ runnerId: string; position: Vec3; velocity: Vec3; currentBase: number; targetBase: number | null;
    bodyPoseV105?:LiveFielderBodyPoseV105;athleticV115?:Readonly<{kind:'feet_slide'|'head_slide';phase:string}>;
    retired: boolean; scored: boolean }>[] }>;

export type LiveFieldInitialMovementV98 = {
  playerId: string; inputReactionSeconds: number; decisionSeconds: number; responseSecondsAtStart: number;
  sampleIntervalSeconds: number;
  firstActivation: { elapsedSeconds: number; tick: number } | null;
  firstNonHoldRole: { elapsedSeconds: number; tick: number; intent: LiveFieldFrameV1['fielders'][number]['intent'] } | null;
  firstMovementCommand: { elapsedSeconds: number; tick: number; position: Vec3; velocity: Vec3; acceleration: Vec3;
    intent: LiveFieldFrameV1['fielders'][number]['intent']; commandReason: 'preferred' | 'brake' | 'yield' } | null;
  firstSampledMoving: { elapsedSeconds: number; tick: number; previousSampleElapsedSeconds: number | null;
    position: Vec3; velocity: Vec3 } | null;
};

/** Explicit kinematic research controller. These numbers are controller cadence
 * and geometry, never NLB/MLB ability or outcome probabilities. Player motor,
 * reaction, pocket energy, transfer and throw values are required SI inputs. */
export const LIVE_FIELD_TEST_MODEL_V1 = Object.freeze({ basis: 'EXPLICIT_SYNTHETIC_LIVE_FIELD_CONTROL_V1' as const,
  controlSeconds: .04, frameSeconds: .055, bodyRadiusMeters: .24,
  roleAssignment: LIVE_FIELD_ROLE_POLICY_V1,
  defensiveOpportunity: LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1,
  fielderAvoidance: LIVE_FIELDER_AVOIDANCE_POLICY_V1,
  catchApproachCostFraction: .3,
  // Tactical willingness to try a near miss, never additional reach or a catch.
  nearAttemptV113: Object.freeze({ maximumLateSeconds: .25, horizonSeconds: 2 }),
  // Provisional willingness to try a close crossing, never additional reach.
  closeAttemptV117: Object.freeze({ maximumRouteMeters: 6, maximumLateSeconds: .55 }),
  bodyMaterial: Object.freeze({ restitution: .25, tangentialDamping: .3, spinDamping: .1 }),
  wallMaterial: Object.freeze({ restitution: .25, tangentialDamping: .3, spinDamping: .1,
    groundNormalHysteresisLossJ: .0001, maximumCompressionMeters: .002 }),
  sensorPrediction: Object.freeze({ horizonSeconds: 8, maximumPositionResidualMeters: .01,
    maximumVelocityResidualMps: .05, maximumSpinResidualRadPerSecond: .5,
    nearInterceptStepSeconds: .02, nearInterceptThroughSeconds: .5, farInterceptStepSeconds: .1 }),
  fenceMotorStoppingReserveMeters: .02,
  throwHand: Object.freeze({ heightAboveHipMeters: .7, forwardMeters: .5, readyRadiusUsesBallRadius: true }),
  neuralReactionCalibrated: false, muscleTorqueCalibrated: false, tagUpAppealsImplemented: true });

const v = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });
const add = (a: Vec3, b: Vec3): Vec3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: Vec3, b: Vec3): Vec3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: Vec3, s: number): Vec3 => v(a.x * s, a.y * s, a.z * s);
const norm = (a: Vec3) => Math.hypot(a.x, a.y, a.z);
const flat = (a: Vec3) => v(a.x, 0, a.z);
const distance = (a: Vec3, b: Vec3) => norm(sub(a, b));
const finite = (a: Vec3) => !!a && [a.x, a.y, a.z].every(Number.isFinite);
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const freeze = <T>(a: T): T => { if (a && typeof a === 'object') { Object.values(a).forEach(freeze); Object.freeze(a); } return a; };
function assert(a: unknown, m: string): asserts a { if (!a) throw new Error('live field play: ' + m); }
type Curve = { from: number; p: Vec3; velocity: Vec3; acceleration: Vec3; jerk?: Vec3;
  stopAfter?: number; continuingVelocity?: Vec3; continuingAcceleration?: Vec3; continuingJerk?: Vec3;
  exactEnd?: { time: number; position: Vec3; velocity: Vec3 } };
const at = (c: Curve, t: number) => {
  if (c.exactEnd?.time === t) return c.exactEnd.position;
  const dt = t - c.from, accelerating = Math.min(dt, c.stopAfter ?? dt);
  const after = dt - accelerating;
  return add(c.p, add(add(add(mul(c.velocity, accelerating), mul(c.acceleration, .5 * accelerating ** 2)), mul(c.jerk ?? v(), accelerating ** 3 / 6)),
    add(add(mul(c.continuingVelocity ?? v(), after), mul(c.continuingAcceleration ?? v(), .5 * after ** 2)), mul(c.continuingJerk ?? v(), after ** 3 / 6))));
};
const velocityAt = (c: Curve, t: number): Vec3 => {
  if (c.exactEnd?.time === t) return c.exactEnd.velocity;
  const dt = t - c.from;
  if (c.stopAfter !== undefined && dt >= c.stopAfter) { const after = dt - c.stopAfter;
    return add(c.continuingVelocity ?? v(), add(mul(c.continuingAcceleration ?? v(), after), mul(c.continuingJerk ?? v(), .5 * after ** 2))); }
  return add(c.velocity, add(mul(c.acceleration, dt), mul(c.jerk ?? v(), .5 * dt ** 2)));
};
const maximumCurveSpeed = (c: Curve, from: number, through: number): number => {
  if (c.stopAfter !== undefined && c.from + c.stopAfter > from && c.from + c.stopAfter < through)
    return Math.max(maximumCurveSpeed(c, from, c.from + c.stopAfter), maximumCurveSpeed(c, c.from + c.stopAfter, through));
  const dt = through - from, after = c.stopAfter !== undefined && from - c.from >= c.stopAfter,
    local = from - c.from - (after ? c.stopAfter! : 0),
    acceleration = add(after ? c.continuingAcceleration ?? v() : c.acceleration, mul(after ? c.continuingJerk ?? v() : c.jerk ?? v(), local)),
    middleDerivativeControl = add(velocityAt(c, from), mul(acceleration, dt / 2));
  return Math.max(norm(velocityAt(c, from)), norm(velocityAt(c, through)), norm(middleDerivativeControl));
};
const maximumCurveAcceleration = (c: Curve, through: number) => {
  const dt = Math.min(through - c.from, c.stopAfter ?? Infinity), after = Math.max(0, through - c.from - (c.stopAfter ?? Infinity));
  return Math.max(norm(c.acceleration), norm(add(c.acceleration, mul(c.jerk ?? v(), dt))), norm(c.continuingAcceleration ?? v()),
    norm(add(c.continuingAcceleration ?? v(), mul(c.continuingJerk ?? v(), after))));
};
type Fielder = { spec: LiveFielderV1; locomotion: ReturnType<typeof createLiveLocomotionProfileV84>;
  athleticV115?:LiveFielderAthleticPlanV115;athleticAttemptAfterV115?:number;
  body: Curve; glove: Curve; postureV105?: LiveFielderPostureV105; intent: LiveFieldFrameV1['fielders'][number]['intent'];
  targetBase: BaseballBase | null; catchEnabledAfter: number };
type NearFieldAttemptV113 = { point: Vec3; eta: number; arrivalSeconds: number; latenessSeconds: number };
type HandPreparationState = { fielder: Fielder; base: BaseballBase;
  curve: Extract<ReturnType<typeof createLiveHandPreparationV1>, { kind: 'planned' }>; prepared: boolean };
type Leg = { from: number; to: BaseballBase; motion: LiveRunnerMotionV1; nextTouchIndex: number; height: number;
  departure: { base: BaseballBase; elapsedSeconds: number } | null; returning?: boolean };
type Runner = { spec: LiveRunnerV1; base: number; p: Vec3; leg: Leg | null; retired: boolean; scored: boolean;
  retiredSlideV115?:Leg;
  retouchBase: 1 | 2 | 3 | null; returnReadyAt: number | null };
type Hit = { t: number; from: number; gap: number; rounding: number; speed: number; ambiguous?: true };

export function deriveLiveFieldFenceGeometryV1(field: LiveFieldGeometryV1) {
  const back = field.foulFenceRadiusMeters ?? 35;
  assert(finite(field.bases.home) && Number.isFinite(back) && back > 0 && Number.isFinite(field.fenceRadiusMeters)
    && field.fenceRadiusMeters > 0 && Number.isFinite(field.fenceHeightMeters) && field.fenceHeightMeters >= 0, 'finite fence geometry required');
  return freeze({ fenceCenter: add(field.bases.home, v(0, 0, (field.fenceRadiusMeters - back) / 2)),
    fenceRadiusMeters: (field.fenceRadiusMeters + back) / 2, fenceHeightMeters: field.fenceHeightMeters });
}

/** Bounded continuous search, independent of render frames. A real overlap
 * witness is mandatory; an unresolved graze stops the play without a result. */
function firstContact(gap: (t: number) => number, speed: number, rounding: number, lo: number, hi: number, depth = 0, maximumPencilSeconds = 1e-6): Hit | null {
  const a = gap(lo), b = gap(hi);
  if (a <= 0) return { t: lo, from: lo, gap: a, rounding, speed };
  if (Math.min(a, b) > speed * (hi - lo) + rounding) return null;
  if (hi - lo <= 1e-13 || depth >= 48 || (hi + lo) / 2 === lo || (hi + lo) / 2 === hi)
    return { t: hi, from: lo, gap: b, rounding, speed, ...(b > 0 ? { ambiguous: true as const } : {}) };
  const mid = (lo + hi) / 2, left = firstContact(gap, speed, rounding, lo, mid, depth + 1, maximumPencilSeconds);
  if (left && !left.ambiguous) return left;
  if (left?.ambiguous && mid - left.from > maximumPencilSeconds) return left;
  const right = firstContact(gap, speed, rounding, mid, hi, depth + 1, maximumPencilSeconds);
  if (!left) return right;
  // Keep the entire possible-contact pencil, rather than declaring a positive
  // gap to be a hit. The owner below admits only an actual overlap witness whose
  // complete uncertainty interval belongs to the same official occurrence tick.
  if (right && !right.ambiguous) return { ...right, from: left.from };
  return left;
}

export function simulateLiveFieldPlayV1(raw: LiveFieldPlayInputV1) {
  return withLiveThrowPhysicalMemoV113(() => simulateLiveFieldPlayScopedV113(raw));
}
function simulateLiveFieldPlayScopedV113(raw: LiveFieldPlayInputV1) {
  const input = cloneInert(raw), start = input.ball.elapsedSeconds, originTick = input.ball.originTick,
    tps = input.physics.air.ticksPerSecond, max = start + (input.maxPlaySeconds ?? 35), frameSeconds = input.frameSeconds ?? .055;
  assert(input.recordInitialMovementV98 === undefined || input.recordInitialMovementV98 === true, 'invalid initial movement telemetry option');
  assert(input.defenseDecisionModeV118===undefined||['legacy','shadow','individual'].includes(input.defenseDecisionModeV118),'invalid defense decision mode');
  assert(input.recordDecisionTraceV118===undefined||input.recordDecisionTraceV118===true,'invalid decision trace option');
  const individualV118=input.defenseDecisionModeV118==='individual',
    decisionTraceV118=createLiveFieldDecisionTraceV1({enabled:!!input.recordDecisionTraceV118,originTick,ticksPerSecond:tps,seed:input.seed??0});
  const executionErrorsV95 = input.executionPerturbationsV95?.throwErrors ?? [];
  assert(Array.isArray(executionErrorsV95) && executionErrorsV95.length <= 64
    && executionErrorsV95.every(e => Number.isSafeInteger(e.releaseOrdinal) && e.releaseOrdinal >= 0
      && [e.yawRadians, e.pitchRadians].every(n => Number.isFinite(n) && Math.abs(n) <= .35))
    && new Set(executionErrorsV95.map(e => e.releaseOrdinal)).size === executionErrorsV95.length, 'invalid execution perturbations V95');
  assert(input.fielders.length === 9 && new Set(input.fielders.map(f => f.playerId)).size === 9, 'nine unique defenders required');
  for (const f of input.fielders) if (f.fieldRelationshipsV99 !== undefined) validateFieldRelationshipsV99(f.fieldRelationshipsV99);
  assert(input.runners.length >= 1 && input.runners.length <= 4 && new Set(input.runners.map(r => r.runnerId)).size === input.runners.length
    && new Set(input.runners.map(r => r.initialBase)).size === input.runners.length && input.runners.some(r => r.initialBase === 0), 'complete unique runner population required');
  assert(Number.isInteger(input.outs) && input.outs >= 0 && input.outs <= 2 && Number.isFinite(max) && max > start && max - start <= 120
    && frameSeconds > 0 && Number.isFinite(frameSeconds)
    && (input.seed === undefined || Number.isSafeInteger(input.seed) && input.seed >= 0 && input.seed <= 0xffffffff), 'invalid finite play scope');
  assert(input.ball.ball.tick === quantizeEventTick(originTick, start, tps) && input.physics.ground.ticksPerSecond === tps, 'actual contact clock differs');
  const randomnessV152=input.randomnessV152===undefined?undefined:createLivePlayRandomStreamsV152(input.seed??0,input.randomnessV152),
    fieldRandomSeedV152=(key:string)=>randomnessV152?.seedFor('fielding',key)??input.seed??0,
    runnerRandomDrawV152=(key:string)=>new SeedRoot(randomnessV152?.seedFor('baserunning',key)??input.seed??0)
      .streamRng(0,randomnessV152?'baserunning':'fielding',key).nextFloat();
  const field = input.field, base = (n: number) => field.bases[(['home', 'first', 'second', 'third', 'home'] as const)[n]];
  const equipmentSessionV148 = field.poleEquipmentV148 !== undefined ? createSourceFreePoleSessionV148(field.poleEquipmentV148) : null,
    poleSessionV148 = field.poleEquipmentV148?.poles.length ? equipmentSessionV148 : null;
  assert(Object.values(field.bases).every(finite) && Number.isFinite(field.fenceRadiusMeters) && Number.isFinite(field.fenceHeightMeters)
    && field.fenceRadiusMeters > 0 && field.fenceHeightMeters >= 0, 'finite field geometry required');
  // One continuous solid stadium perimeter. CF/back distances remain the
  // specified values; changing a ball's fair/foul status never moves a wall.
  const fieldGeometry = { ...deriveLiveFieldFenceGeometryV1(field),
    ...(poleSessionV148 ? { poleEquipmentV148: field.poleEquipmentV148! } : {}) },
    fenceCenter = fieldGeometry.fenceCenter, fenceRadius = fieldGeometry.fenceRadiusMeters;
  for (const f of input.fielders) assert(f.playerId && finite(f.position) && (!f.velocity || finite(f.velocity)) && f.position.y > 0
    && (f.defensivePosition === undefined || ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].includes(f.defensivePosition))
    && [f.topSpeedMps, f.accelerationMps2, f.gloveSpeedMps, f.gloveReachMeters, f.gloveRadiusMeters, f.throwSpeedMps].every(x => Number.isFinite(x) && x > 0)
    && [f.reactionSeconds, f.transferSeconds].every(x => Number.isFinite(x) && x >= 0)
    && (f.transferDelayMaxSecondsV101 === undefined || Number.isFinite(f.transferDelayMaxSecondsV101) && f.transferDelayMaxSecondsV101 >= 0 && f.transferDelayMaxSecondsV101 <= 2)
    && (f.throwEffortBuildSecondsV103 === undefined || Number.isFinite(f.throwEffortBuildSecondsV103) && f.throwEffortBuildSecondsV103 >= 0 && f.throwEffortBuildSecondsV103 <= 5)
    && (f.bodyModelV105 === undefined || validateLiveFielderBodyModelV105(f.bodyModelV105))
    && f.catchRetention.ticksPerSecond === tps && f.catchRetention.ballRadiusMeters === input.physics.ground.radiusM
    && f.catchRetention.ballMassKg === input.physics.air.aerodynamics.ballMassKg
    && [f.catchRetention.pocketRadiusMeters, f.catchRetention.centerRetentionCapacityJ, f.catchRetention.captureDissipationPowerW].every(x => Number.isFinite(x) && x > 0)
    && [f.catchRetention.failedContactRestitution, f.catchRetention.failedTangentialDamping, f.catchRetention.failedSpinDamping].every(x => Number.isFinite(x) && x >= 0 && x <= 1)
    && (f.throwBackspinRadPerSecond === undefined || Number.isFinite(f.throwBackspinRadPerSecond) && f.throwBackspinRadPerSecond >= 0)
    && (!f.throwSpinRadPerSecond || finite(f.throwSpinRadPerSecond))
    && (f.throwDirectionStdRadians === undefined || Number.isFinite(f.throwDirectionStdRadians) && f.throwDirectionStdRadians >= 0 && f.throwDirectionStdRadians <= .12)
    && (f.fieldingCognition === undefined || Object.keys(f.fieldingCognition).every(k => ['decisionSeconds', 'pursuitCostWeight', 'cautious'].includes(k))
      && Number.isFinite(f.fieldingCognition.decisionSeconds) && f.fieldingCognition.decisionSeconds >= 0
      && (f.fieldingCognition.cautious === undefined || typeof f.fieldingCognition.cautious === 'boolean')
      && (f.fieldingCognition.pursuitCostWeight === undefined || Number.isFinite(f.fieldingCognition.pursuitCostWeight)
        && f.fieldingCognition.pursuitCostWeight >= .25 && f.fieldingCognition.pursuitCostWeight <= 4)
      && Number.isFinite(f.reactionSeconds + f.fieldingCognition.decisionSeconds)), 'explicit fielder SI required');
  for (const r of input.runners) assert(r.runnerId && [0, 1, 2, 3].includes(r.initialBase)
    && [r.topSpeedMps, r.accelerationMps2].every(x => Number.isFinite(x) && x > 0)
    && Number.isFinite(r.reactionSeconds) && r.reactionSeconds >= 0 && (!r.position || finite(r.position))
    && (r.advanceSafetyMarginSeconds === undefined || Number.isFinite(r.advanceSafetyMarginSeconds)
      && r.advanceSafetyMarginSeconds >= 0 && r.advanceSafetyMarginSeconds <= 3)
    && (r.roundingRadiusMeters === undefined || Number.isFinite(r.roundingRadiusMeters) && r.roundingRadiusMeters >= .5 && r.roundingRadiusMeters <= 10)
    && (r.lateralAccelerationMps2 === undefined || Number.isFinite(r.lateralAccelerationMps2) && r.lateralAccelerationMps2 >= .5 && r.lateralAccelerationMps2 <= 20), 'explicit runner SI required');
  for (const actor of [...input.fielders, ...input.runners]) if (actor.technicalSkills !== undefined) validateTechnicalSkillControlsV75(actor.technicalSkills);
  for(const actor of [...input.fielders,...input.runners])if(actor.athleticProfileV115!==undefined)
    assert(validateLiveAthleticProfileV115(actor.athleticProfileV115),'invalid individual athletic profile V115');
  const poleContactWitnessesV213: LivePoleContactWitnessV213[] = [];
  const facts: LiveFieldFactV1[] = [], frames: LiveFieldFrameV1[] = [], runnerTouches: RunnerBaseTouchFact[] = [],
    controlledBaseContacts: ControlledBaseContactFact[] = [], controlledRunnerTags: ControlledRunnerTagFact[] = [], runnerDepartures: RunnerBaseDepartureFact[] = [],
    defensiveAppeals: DefensiveAppealAttemptFact[] = [];
  const tick = (t: number) => quantizeEventTick(originTick, t, tps);
  const arrivalMemoV120=new Map<string,number>();
  const liveFieldArrivalSecondsV1=(actor:Parameters<typeof uncachedFieldArrivalV120>[0],target:Vec3,radius=.28)=>{
    const values=[actor.position.x,actor.position.y,actor.position.z,actor.velocity.x,actor.velocity.y,actor.velocity.z,
      actor.topSpeedMps,actor.accelerationMps2,actor.remainingReactionSeconds,target.x,target.y,target.z,radius];
    // Invalid or overflowing values still go through the original validator.
    // All scalar motor inputs are part of this exact, per-play key.
    if(!values.every(Number.isFinite))return uncachedFieldArrivalV120(actor,target,radius);
    const key=values.map(n=>Object.is(n,-0)?'-0':n).join(','),cached=arrivalMemoV120.get(key);if(cached!==undefined)return cached;
    const value=uncachedFieldArrivalV120(actor,target,radius);
    if(arrivalMemoV120.size===2048)arrivalMemoV120.delete(arrivalMemoV120.keys().next().value!);
    arrivalMemoV120.set(key,value);return value;
  };
  const findContact = (gap: (t: number) => number, speed: number, rounding: number, lo: number, hi: number) => firstContact(gap, speed, rounding, lo, hi, 0, 1 / tps);
  let runnerCueRevisionV95 = 0, runnerCueAtV95 = start;
  const emit = (kind: LiveFieldFactV1['kind'], t: number, extra: Omit<LiveFieldFactV1, 'kind' | 'tick' | 'elapsedSeconds'> = {}) => {
    if (['ground_contact', 'glove_contact', 'body_contact', 'pole_contact', 'catch_secured', 'throw_release', 'wall_support'].includes(kind)) { runnerCueRevisionV95++; runnerCueAtV95 = t; }
    return facts.push({ kind, tick: tick(t), elapsedSeconds: t, ...extra });
  };
  const defenders: Fielder[] = input.fielders.map(spec => ({ spec, locomotion: createLiveLocomotionProfileV84(spec), body: { from: start, p: spec.position, velocity: spec.velocity ?? v(), acceleration: v() },
    glove: { from: start, p: spec.bodyModelV105 ? add(spec.position, v(0, spec.bodyModelV105.shoulderHeightMeters - spec.bodyModelV105.hipHeightMeters - Math.min(spec.bodyModelV105.armReachMeters * .4, Math.max(0, spec.bodyModelV105.shoulderHeightMeters - Math.max(spec.gloveRadiusMeters,input.physics.ground.radiusM) - .02)), 0)) : spec.position, velocity: spec.velocity ?? v(), acceleration: v() },
    ...(spec.bodyModelV105 ? { postureV105: { from: start, through: start, crouchFrom: 0, crouchTo: 0, yawFrom: Math.atan2(base(0).x-spec.position.x, base(0).z-spec.position.z), yawTo: Math.atan2(base(0).x-spec.position.x, base(0).z-spec.position.z) } } : {}), intent: 'hold', targetBase: null, catchEnabledAfter: start }));
  const athleticActiveV115=(f:Fielder,t:number)=>!!f.athleticV115&&t<f.athleticV115.throughSeconds;
  const poseMemoV120=new WeakMap<Fielder,{t:number;body:Curve;glove:Curve;posture:LiveFielderPostureV105;
    athletic:LiveFielderAthleticPlanV115|undefined;pose:LiveFielderBodyPoseV105}>();
  const poseV105 = (f: Fielder, t: number) => {
    if(!f.spec.bodyModelV105||!f.postureV105)return undefined;
    const cached=poseMemoV120.get(f);if(cached&&cached.t===t&&cached.body===f.body&&cached.glove===f.glove
      &&cached.posture===f.postureV105&&cached.athletic===f.athleticV115)return cached.pose;
    let pose:LiveFielderBodyPoseV105;
    if(athleticActiveV115(f,t)){
      const sample=f.athleticV115!.sampleAtElapsedSeconds(t).pose;
      pose={...sample,reachMarginMeters:liveFielderReachMarginV105(f.spec.bodyModelV105,sample.shoulder,sample.forward,at(f.glove,t))};
    }else pose=liveFielderBodyPoseV105(f.spec.bodyModelV105,at(f.body,t),velocityAt(f.body,t),f.postureV105,t,at(f.glove,t));
    // Curves/postures are replaced by their sole motor owner, never edited in
    // place. Same instant and all source identities are required; no rounding.
    poseMemoV120.set(f,{t,body:f.body,glove:f.glove,posture:f.postureV105,athletic:f.athleticV115,pose});return pose;
  };
  const recoveryV105 = (f: Fielder, t: number) => Math.max(athleticActiveV115(f,t)?f.athleticV115!.throughSeconds-t:0,
    f.spec.bodyModelV105 ? liveFielderRecoverySecondsV105(f.spec.bodyModelV105, poseV105(f, t)) : 0);
  const horizontalReachV105 = (f: Fielder, t: number, y: number) => f.spec.bodyModelV105
    ? liveFielderHorizontalReachV105(f.spec.bodyModelV105, at(f.body, t), y) : Math.sqrt(Math.max(0, f.spec.gloveReachMeters ** 2 - (f.spec.position.y-y) ** 2));
  // Tactical reach uses a visible standing-height estimate; actual tags below
  // still test the real continuous runner/hand shapes, including sliding.
  const tagReachV105 = (f: Fielder, r: Runner, t: number) => {
    if(!f.spec.bodyModelV105)return f.spec.gloveReachMeters;
    if(!individualV118)return Math.max(0,horizontalReachV105(f,t,runnerTagTargetV115(r,t).y));
    const observer=possession??f,seen=knownRunnerV118(observer,r,t),height=(r.spec.athleticProfileV115?.heightMeters??1.8)*.35;
    return Math.max(0,liveFielderHorizontalReachV105(f.spec.bodyModelV105,knownActorV118(observer,f,t).position,(seen?.position.y??0)+height));
  };
  const runners: Runner[] = input.runners.map(spec => ({ spec, base: spec.initialBase, p: spec.position ?? base(spec.initialBase), leg: null,
    retired: false, scored: false, retouchBase: null, returnReadyAt: null }));
  const tagUpAtFirstTouch = new Map<string, boolean>();
  const runnerReadBias = new Map(runners.map(r => [r.spec.runnerId,
    (2 * runnerRandomDrawV152('runner-flight-read-v53:' + r.spec.initialBase) - 1)
      * r.spec.reactionSeconds]));
  // Only the actual through-route disk exit may establish this causal link.
  // A beginLeg departure intent does not certify physical loss of protection.
  const physicalBaseDepartures = new Map<string, { base: BaseballBase; tick: number; elapsedSeconds: number }>();
  const batter = runners.find(r => r.base === 0)!;
  let force = createInitialForceObligationState({ first: runners.find(r => r.base === 1)?.spec.runnerId ?? null,
    second: runners.find(r => r.base === 2)?.spec.runnerId ?? null, third: runners.find(r => r.base === 3)?.spec.runnerId ?? null }, batter.spec.runnerId);
  let retiredCount = 0, firstGroundContactTick: number | null = null, firstTouchTick: number | null = null,
    flyCatch: LiveFieldRuleFactsV1['flyCatch'] = null, overFence: LiveFieldRuleFactsV1['overFence'] = null;
  let firstGroundContactSeconds: number | null = null, firstFielderTouchSeconds: number | null = null;
  let territory = 'fair' as 'fair' | 'foul', territoryFixed = false, time = start, endReason = 'scope_exhausted', dead = false;
  let kernelBuilds = 0, kernelExtensions = 0, wallKernelBuilds = 0, collisionQueries = 0, kernel: Pick<SourceFreeBallKernel, 'cells' | 'boundaries' | 'evaluateAt'>,
    orientationBasis = input.orientation ?? IDENTITY_QUATERNION;
  const materialSeamsActive = (input.physics.air.aerodynamics.seamForce?.coefficientScale ?? 0) > 0;
  const runnerObservedPhysicsV113 = liveUnobservedSeamPhysicsV113(input.physics);
  // Compare hypothetical routes with the unknown-grip mean profile. Solving
  // seam phase for every unissued leg every control tick is neither observable
  // for future relay grips nor an executable guarantee. The chosen first hop
  // is re-solved below at its actual release boundary with the full profile,
  // actual material orientation, accumulated charge and receiver readiness.
  const commandComparisonPhysicsV113 = runnerObservedPhysicsV113;
  if (materialSeamsActive && input.orientation === undefined) throw new Error('live field: explicit material orientation required for seam force');
  type FreeScope = { initial: BallWorldMoment; spanSeconds: number; through: number; descriptor: SourceFreeBallDescriptorV2;
    materialOrientationAtStart?: Quaternion };
  let freeScope: FreeScope | null = null;
  let wallContact: ReturnType<typeof createGroundWallRollingCurveV1>['support'] | null = null;
  let constrainedWallCurveV170: ReturnType<typeof createGroundWallRollingCurveV1> | null = null;
  const constrainedPoleWindowsV170: Extract<ReturnType<ReturnType<typeof createGroundWallRollingCurveV1>['queryNoPoleContactWindowV170']>,{kind:'clear'}>[] = [];
  const wallSupports: ReturnType<typeof createGroundWallRollingCurveV1>['support'][] = [];
  const simultaneousContacts: ReturnType<typeof resolveGroundedActorContactResponseV1>['proof'][] = [];
  const throwDecisions: { elapsedSeconds: number; base: BaseballBase; reason: string; flightSeconds?: number }[] = [];
  const receiveTimingV99: { elapsedSeconds: number; throwerPlayerId: string; receiverPlayerId: string; base: BaseballBase;
    observationSeconds: number; predictedBallArrivalSeconds: number; predictedReceiverReadySeconds: number;
    receiverDistanceMeters: number; receiverReadySeconds: number; flightSeconds: number; trust: number; coordination: number;
    explicitRelationship: boolean; allow: boolean; probability: number; draw: number; reason: string; marginSeconds: number }[] = [];
  const throwDirectionCommands: { elapsedSeconds: number; plannedVelocity: Vec3; bodyVelocity: Vec3;
    actual: ReturnType<typeof applyLiveThrowDirectionV1> }[] = [];
  const throwEffortCommandsV103: ThrowEffortCommandV103[] = [],
    throwEffortCancellationsV103: { playerId: string; from: number; commandFrom: number; reason: string }[] = [];
  const bodyGeometryV105 = { basis: 'SHOULDER_RELATIVE_CONTINUOUS_REACH_V105' as const, postureDeferredCount: 0, reachProofRejectCount: 0, maximumCertifiedArmLengthMeters: 0,
    contacts: [] as { playerId: string; elapsedSeconds: number; kind: 'contact' | 'secure'; glove: Vec3; pose: LiveFielderBodyPoseV105; reachMarginMeters: number }[] };
  const handPreparationProofs: { playerId: string; base: BaseballBase; from: number; through: number; target: Vec3;
    controls: ReturnType<HandPreparationState['curve']['cubicBezierControls']>; diagnostics: HandPreparationState['curve']['diagnostics'] }[] = [];
  const roleTransitions: { elapsedSeconds: number; previousHandlerId: string | null; handlerId: string;
    source: 'possession' | 'pending_catch' | 'throw_receiver' | 'forecast_retained' | 'forecast_best' | 'forecast_attempt' | 'fallback_first';
    intercepted: boolean | null; eta: number | null; targetPoint: Vec3 | null; observedPosition: Vec3 | null;
    reactionGatedCount: number }[] = [];
  const throwTargetCancellations: { elapsedSeconds: number; base: BaseballBase; receiverPlayerId: string;
    releasedAt: number | null; seenAt: number; distanceToTargetMeters: number }[] = [];
  const contactDiagnostics: { elapsedSeconds: number; playerId: string; role: 'glove' | 'body';
    ballSpeedMps: number; bodySpeedMps: number; gloveOffsetMeters: number; intent: Fielder['intent'];
    targetBase: BaseballBase | null; distanceToTargetBaseMeters: number | null;
    retention?: { outcome: 'secured' | 'live-ball'; retentionLoadJ: number; effectiveCapacityJ: number;
      pocketOffsetMeters: number; bodyStability: number; ballVelocity: Vec3; gloveVelocity: Vec3;
      relativeVelocity: Vec3; translationalEnergyJ: number; rotationalEnergyJ: number } }[] = [];
  const holderDecisions: { elapsedSeconds: number; playerId: string; state: string; base: BaseballBase | null;
    margin?: number; carrySeconds?: number; receivingSeconds?: number; receiverPlayerId?: string;
    receiverDistanceToBaseMeters?: number }[] = [];
  const rejectedThrows = new Set<string>();
  const relayPlans: { elapsedSeconds: number; playerId: string; runnerId: string; base: BaseballBase;
    kind: LiveRelayPlanV1['kind']; receivers: string[]; readySeconds: number; marginSeconds: number; aerodynamicSolveCount: number }[] = [];
  const relayCache = new Map<string, { at: number; plan: LiveRelayPlanV1 }>();
  const doublePlayDecisionsV106: { elapsedSeconds:number; playerId:string; routes:LiveDoublePlayRouteV106[];
    decision:ReturnType<typeof decideLiveDoublePlayV106> }[]=[];
  const firstBaseAttemptDecisionsV108: { elapsedSeconds:number;playerId:string;opportunityId:string;
    distanceMeters:number;capacityMps:number;runnerSpeedMps:number;runnerSeconds:number;receivingSeconds:number;
    decision:ReturnType<typeof decideLiveFirstBaseAttemptV108> }[]=[];
  const relayVisited = new Map<string, Set<string>>();
  const runnerMotions: { elapsedSeconds: number; runnerId: string; throughBases: number[]; position: Vec3; velocity: Vec3;
    terminalMode?: 'first-base-overrun'; durationSeconds: number; lengthMeters: number; route: LiveRunnerMotionV1['route'] }[] = [];
  const roundingRecheckAfter = new Map<string, number>();
  const runnerDefenseMemoV95 = createLiveDefenseControlMemoV95(64);
  const runnerObservationsV95: { runnerId: string; elapsedSeconds: number; observedAtSeconds: number; reactionSeconds: number;
    targetBase: number; cueRevision: number; route: string | null; controlSeconds: number | null; aerodynamicSolves: number; cacheHit: boolean }[] = [];
  const runnerDecisions: ({ elapsedSeconds: number; runnerId: string; targetBase: number; defenderControlSeconds: number | null }
    & ReturnType<typeof decideLiveRunnerAdvanceV1>)[] = [];
  const fielderAvoidanceTransitions: { elapsedSeconds: number; throughSeconds: number;
    actions: { playerId: string; reason: 'brake' | 'yield' }[]; minimumPlannedStepGapMeters: number | null }[] = [];
  const fielderAvoidanceCounts = new Map<string, { preferred: number; brake: number; yield: number }>();
  let avoidancePlanCount = 0, avoidanceCandidateEvaluations = 0, avoidanceState = '',
    minimumPlannedStepGapMeters = Infinity, minimumStoppingGapMeters = Infinity;
  let runnerDecisionPending = false;
  let defensiveOpportunity: LiveDefensiveOpportunityV1 | null = null,
    decisiveCandidate: { tick: number; observationTick: number } | null = null;
  const defensiveOpportunityTransitions: { tick: number; elapsedSeconds: number; opportunity: LiveDefensiveOpportunityV1 | null }[] = [];
  let lastRunnerEvaluationSeconds: number | null = null;
  let unresolvedDetail: unknown = null;
  const build = (moment: BallWorldMoment, materialOrientationAtStart = orientationBasis, originalThrough?: number) => {
    constrainedWallCurveV170 = null;
    kernelBuilds++; const through = originalThrough ?? Math.min(max, moment.elapsedSeconds + 8), result = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
      initial: moment, throughElapsedSeconds: through, profile: input.physics, ...(materialSeamsActive ? { materialOrientationAtStart } : {}) });
    freeScope = { initial: result.descriptor.initial, spanSeconds: 8, through, descriptor: result.descriptor,
      ...(materialSeamsActive ? { materialOrientationAtStart } : {}) }; return result;
  };
  const ensureThrough = (through: number) => {
    if (!freeScope || through <= freeScope.through) return;
    let span = freeScope.spanSeconds;
    while (freeScope.initial.elapsedSeconds + span < through) span *= 2;
    const end = Math.min(max, freeScope.initial.elapsedSeconds + span);
    // The original impulse root and its RK lattice remain identical. This is
    // only a larger finite cache; no observed/render sample becomes a basis.
    const extended = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
      initial: freeScope.initial, throughElapsedSeconds: end, profile: input.physics,
      ...(freeScope.materialOrientationAtStart ? { materialOrientationAtStart: freeScope.materialOrientationAtStart } : {}) });
    kernel = extended;
    freeScope = { ...freeScope, spanSeconds: span, through: end, descriptor: extended.descriptor }; kernelExtensions++;
  };
  kernel = build(input.ball);
  let side: 'incoming' | 'outgoing' = 'incoming', possession: Fielder | null = null,
    pendingCatch: { fielder: Fielder; first: number; secure: number; firstTouchWasAirborne: boolean; offset: Vec3; spin: Vec3;
      initialPosition: Vec3; initialGlove: Vec3 } | null = null,
    throwTarget: { receiver: Fielder; throwerPlayerId: string; base: BaseballBase; runnerId: string; forced: boolean; appeal: boolean; routineReturn?: boolean;
      point: Vec3; receiverPoint: Vec3; issuedFrom: Vec3; intent: 'relay' | 'base_cover'; effort: ThrowEffortCommandV103;
      releasedAt?: number; releasedFrom?: Vec3; handPreparationRetriesV110?:number; outputRefreshedV110?:boolean; tossReviewAfterV118?:number } | null = null,
    releaseAt: number | null = null, custodySince = Infinity;
  let custodyDelayV101 = 0, custodyOrdinalV101 = 0;
  let airCatchV115:Fielder|null=null;
  const landingReviewedV115=new Set<LiveFielderAthleticPlanV115>();
  // One preparation clock per secured possession, retained across cancelled
  // targets. A controller re-evaluation cannot manufacture or reset charge.
  let custodyChargeFromV103: number | null = null;
  const transferTimingsV101: { playerId: string; securedSeconds: number; baselineSeconds: number; delaySeconds: number; readySeconds: number }[] = [];
  let releaseOpen: Fielder | null = null;
  let hasThrown = false, lastThrowBases: Record<string, number> = {};
  let handPreparation: HandPreparationState | null = null;
  let fenceEscape: { from: number; radius: number; outgoing: BallWorldMoment; witness: Hit } | null = null;
  const departureProofs: { kind: 'actor' | 'fence'; from: number; through: number; escapeThrough: number;
    signedGap: number; penetrationBoundMeters: number; supportingPlaneLowerGapMeters: number; actualGapAtEscapeMeters: number }[] = [];
  let reboundEscape: { fielder: Fielder; role: 'glove' | 'body'; hit: Hit; normal: Vec3; outgoing: BallWorldMoment } | null = null;
  const isFair = (point: Vec3) => { const d = sub(point, base(0)); return d.z >= Math.abs(d.x); };
  const determineTerritory = (t: number, value: 'fair' | 'foul') => {
    if (!territoryFixed) emit('territory_determined', t, { reason: value });
    territory = value; territoryFixed = true;
  };
  const runnerAt = (r: Runner, t: number): Vec3 => {
    const leg = r.leg ?? r.retiredSlideV115; if (!leg) return r.p;
    const p = leg.motion.sampleAtElapsedSeconds(t - leg.from).position;
    return v(p.x, leg.height, p.z);
  };
  const runnerVelocityAt = (r: Runner, t: number): Vec3 => {
    const leg=r.leg??r.retiredSlideV115;if (!leg) return v();
    const vel = leg.motion.sampleAtElapsedSeconds(t - leg.from).velocity; return v(vel.x, 0, vel.z);
  };
  const slideMotionV115=(leg:Leg|null|undefined)=>leg&&'slideV115'in leg.motion?leg.motion as LiveRunnerSlideMotionV115:null;
  const runnerSlideBodyV115=(r:Runner,t:number)=>{const leg=r.leg??r.retiredSlideV115,motion=slideMotionV115(leg);
    return leg&&motion?{...motion.sampleBodyAtElapsedSeconds(t-leg.from),style:motion.slideV115.style,groundY:leg.height}:null;};
  const runnerTouchPointV115=(r:Runner,t:number)=>{const s=runnerSlideBodyV115(r,t);return s?v(s.contactPoint.x,s.groundY+s.contactHeightMeters,s.contactPoint.z):runnerAt(r,t);};
  const runnerPostureV115=(r:Runner,t:number):LiveFielderBodyPoseV105|undefined=>{
    const s=runnerSlideBodyV115(r,t),h=r.spec.athleticProfileV115?.heightMeters;if(!s||!h)return undefined;
    const point=(p:{position:{x:number;z:number};heightMeters:number})=>v(p.position.x,s.groundY+p.heightMeters,p.position.z),
      hip=point(s.hip),head=point(s.head),shoulder=point(s.torso),d=flat(sub(head,hip)),n=norm(d),vel=runnerVelocityAt(r,t);
    return{foot:v(s.position.x,s.groundY,s.position.z),hip,head,shoulder,eye:add(head,v(0,-h*.04,0)),eyeVelocity:v(s.head.velocity.x,s.head.heightVelocityMps,s.head.velocity.z),
      forward:n>1e-9?mul(d,1/n):norm(vel)>0?mul(vel,1/norm(vel)):v(0,0,1),crouchMeters:Math.max(0,h*.53-s.hip.heightMeters),armReachMeters:h*.491};
  };
  const runnerTagTargetV115=(r:Runner,t:number)=>runnerPostureV115(r,t)?.hip??add(runnerAt(r,t),v(0,.9,0));
  const segmentGapV115=(p:Vec3,a:Vec3,b:Vec3)=>{const d=sub(b,a),u=clamp(((p.x-a.x)*d.x+(p.y-a.y)*d.y+(p.z-a.z)*d.z)/Math.max(1e-30,norm(d)**2),0,1);return distance(p,add(a,mul(d,u)));};
  const runnerTagGapV115=(r:Runner,t:number,glove:Vec3)=>{const s=runnerPostureV115(r,t);
    return s?Math.min(segmentGapV115(glove,s.hip,s.head)-.22,segmentGapV115(glove,s.hip,runnerTouchPointV115(r,t))-.12):distance(glove,add(runnerAt(r,t),v(0,.9,0)))-.28;};
  const slideCommittedV115=(r:Runner,t:number)=>{const leg=r.leg,motion=slideMotionV115(leg);return !!leg&&!!motion&&t>=leg.from+motion.slideV115.fromSeconds&&t<leg.from+motion.durationSeconds;};
  const ballAt = (t: number) => {
    const holder = possession ?? pendingCatch?.fielder;
    if (holder) {
      const u = pendingCatch ? clamp((t - pendingCatch.first) / Math.max(pendingCatch.secure - pendingCatch.first, Number.MIN_VALUE), 0, 1) : 1;
      const grip = at(holder.glove, t), translatedEntry = pendingCatch ? add(pendingCatch.initialPosition, sub(grip, pendingCatch.initialGlove)) : grip;
      return { position: pendingCatch ? u === 0 ? pendingCatch.initialPosition : u === 1 ? grip : add(mul(translatedEntry, 1 - u), mul(grip, u)) : grip,
        velocity: pendingCatch ? sub(velocityAt(holder.glove, t), mul(pendingCatch.offset, 1 / (pendingCatch.secure - pendingCatch.first))) : velocityAt(holder.glove, t),
        spin: pendingCatch ? mul(pendingCatch.spin, 1 - u) : v(),
        orientation: pendingCatch ? advanceBaseballOrientation(orientationBasis, mul(pendingCatch.spin, 1 - u / 2), t - pendingCatch.first) : orientationBasis, phase: 'possessed' };
    }
    const b = kernel.evaluateAt(t, t === time ? side : 'outgoing');
    return { ...b.moment.ball, orientation: b.materialOrientation ?? multiplyQuaternions(b.orientation, orientationBasis), phase: dead ? 'dead' : wallContact ? 'wall_' + b.phase : b.phase };
  };
  const sampleFrame = (t: number) => {
    const b = ballAt(t), previousSampleV98 = initialMovementV98 ? frames.at(-1)?.elapsedSeconds ?? null : null;
    frames.push({ elapsedSeconds: t, tick: tick(t), defensiveOpportunity, ball: { position: b.position, velocity: b.velocity, spin: b.spin,
      orientation: b.orientation, phase: b.phase, visible: !dead && !possession && !pendingCatch, possessedBy: (possession ?? pendingCatch?.fielder)?.spec.playerId ?? null },
      fielders: defenders.map(f => ({ playerId: f.spec.playerId, position: at(f.body, t), velocity: velocityAt(f.body, t), glove: at(f.glove, t), ...(f.spec.bodyModelV105 ? { bodyPoseV105: poseV105(f, t) } : {}),
        ...(athleticActiveV115(f,t)?{athleticV115:{kind:f.athleticV115!.kind,phase:f.athleticV115!.sampleAtElapsedSeconds(t).phase,fromSeconds:f.athleticV115!.fromSeconds,throughSeconds:f.athleticV115!.throughSeconds}}:{}),intent: f.intent, targetBase: f.targetBase })),
      runners: runners.map(r => ({ runnerId: r.spec.runnerId, position: runnerAt(r, t), velocity: runnerVelocityAt(r, t),
        ...(runnerPostureV115(r,t)?{bodyPoseV105:runnerPostureV115(r,t),athleticV115:{kind:slideMotionV115(r.leg??r.retiredSlideV115)!.slideV115.style==='head_first'?'head_slide' as const:'feet_slide' as const,phase:runnerSlideBodyV115(r,t)!.phase}}:{}),
        currentBase: r.base, targetBase: r.leg && r.leg.to !== r.base ? r.leg.to : null, retired: r.retired, scored: r.scored })) });
    if (initialMovementV98) for (const f of frames.at(-1)!.fielders) {
      const first = initialMovementV98.get(f.playerId)!;
      if (first.firstSampledMoving === null && (norm(f.velocity) > 0 || distance(f.position, defenders.find(d => d.spec.playerId === f.playerId)!.spec.position) > 0))
        first.firstSampledMoving = { elapsedSeconds: t, tick: tick(t), previousSampleElapsedSeconds: previousSampleV98,
          position: f.position, velocity: f.velocity };
    }
  };
  const retire = (r: Runner, t: number) => { if (r.retired) return; r.p = runnerAt(r, t);if(slideCommittedV115(r,t))r.retiredSlideV115=r.leg!; r.leg = null; r.retired = true; retiredCount++;
    force = retireForceParticipant(force, r.spec.runnerId);
    // Retiring a runner vacates both a physical bag and reserved future bags.
    // Remaining runners must decide against that new state before closure.
    runnerDecisionPending = true; controlThrough = t; };
  const scheduleDeparture = (leg: Leg, n: BaseballBase, from: number, through: number) => {
    if (through <= from) return;
    const gap = (t: number) => { const slide=slideMotionV115(leg),p = slide?slide.sampleBodyAtElapsedSeconds(t).contactPoint:leg.motion.sampleAtElapsedSeconds(t).position;
      return (field.baseTouchRadiusMeters ?? .28) - distance(flat(v(p.x, 0, p.z)), flat(base(n))); };
    // Start at the closest passage through the bag, rather than the incoming
    // disk boundary. Departure is the outgoing disk crossing, not motor onset.
    if (gap(from) <= 0) return;
    const hit = findContact(gap, Math.max(...leg.motion.speedSegments.map(s => s.startSpeedMps), slideMotionV115(leg)?.slideV115.maximumContactSpeedMps??0, rMaxSpeed), 128 * Number.EPSILON, from, through);
    if (hit && !hit.ambiguous) leg.departure = { base: n, elapsedSeconds: leg.from + hit.t };
  };
  const rMaxSpeed = Math.max(...runners.map(r => r.spec.topSpeedMps));
  const beginLeg = (r: Runner, n: BaseballBase, t: number, defenderControlSeconds?: number | null) => {
    if(slideCommittedV115(r,t))return;
    const p = runnerAt(r, t), velocity = runnerVelocityAt(r, t), motorInput={ position: p, velocity,
      bases: [{ base: n, position: base(n) }], topSpeedMps: r.spec.topSpeedMps, accelerationMps2: r.spec.accelerationMps2,
      ...(r.base === 0 && n === 1 ? { terminalMode: 'first-base-overrun' as const } : {}),
      ...(r.spec.technicalSkills === undefined ? {} : { technicalSkills: r.spec.technicalSkills }),
      roundingRadiusMeters: r.spec.roundingRadiusMeters ?? 4.5,
      lateralAccelerationMps2: r.spec.lateralAccelerationMps2 ?? 1.5 * r.spec.accelerationMps2,
      baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28 },athletic=r.spec.athleticProfileV115,
      draw=athletic?runnerRandomDrawV152('slide:'+r.spec.runnerId+':'+n+':'+tick(t)):1,
      head=!!athletic&&(athletic.headSlidePreference===1||draw<athletic.headSlidePreference*(n===1?.15:1)),
      seen=athletic?runnerObservationV95(r,t):null,
      arrival=athletic?estimateLiveRunnerLegSecondsV1(distance(flat(p),flat(base(n))),r.spec.topSpeedMps,r.spec.accelerationMps2,field.baseTouchRadiusMeters??.28):0,
      // Cheap observed pickup/transfer/straight-flight lower bound is only a
      // reason to attempt a slide. It never proves possession, a throw or OUT.
      observedThreat=seen?Math.min(...seen.actors.filter(a=>!seen.holder||a.playerId===seen.holder).map(a=>
        Math.max(0,a.remainingReactionSeconds)+(seen.holder?seen.readySeconds+seen.transferRemainingSeconds
          :Math.max(0,distance(flat(a.position),flat(seen.position))-a.gloveReachMeters)/a.topSpeedMps+a.transferSeconds)
        +distance(seen.holder?a.glovePosition:seen.position,base(n))/a.throwSpeedMps)):Infinity,
      tightApproach=athletic?.headSlidePreference===1||(defenderControlSeconds??observedThreat)<=arrival+.75,
      wantsSlide=!!athletic&&tightApproach&&!dead&&!overFence&&!defensiveOpportunity&&(n!==1||head),
      slide=wantsSlide?createLiveRunnerSlideV115({...motorInput,style:head?'head_first':'feet_first',heightMeters:athletic!.heightMeters,
        reachMeters:athletic!.slideReachMeters+(head?athletic!.headSlideExtraMeters:0),
        frictionCoefficient:Math.max(.01,input.physics.ground.material.slidingFriction*2.5)*athletic!.slideFrictionScale,
        gravityMps2:input.physics.ground.gravityMps2,recoverySeconds:head?athletic!.headSlideRecoverySeconds:athletic!.slideRecoverySeconds}):null,
      motion=slide??createLiveRunnerMotionV1(motorInput);
    if (!motion) return;
    r.leg = { from: t, to: n, motion, nextTouchIndex: 0, height: p.y, departure: null };
    runnerMotions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, throughBases: [n], position: p, velocity,
      ...(motion.firstBaseOverrunV95 ? { terminalMode: 'first-base-overrun' as const } : {}),
      durationSeconds: motion.durationSeconds, lengthMeters: motion.lengthMeters, route: motion.route });
    if (r.base > 0 && !physicalBaseDepartures.has(r.spec.runnerId))
      scheduleDeparture(r.leg, r.base as BaseballBase, 0, motion.touches[0]?.centerElapsedSeconds ?? motion.durationSeconds);
  };
  // Immediate return after touching first is protected; choosing a new leg to
  // second replaces this motion and ends the exception. This is not a tag fact.
  const protectedFirstOverrunV95 = (r: Runner) => r.base === 1 && !!r.leg?.motion.firstBaseOverrunV95 && !r.leg.returning;
  const legacyRunnerArrivalSecondsV117 = (r: Runner, n: BaseballBase, t: number) => {
    const touch = r.leg?.motion.touches.slice(r.leg.nextTouchIndex).find(b => b.base === n);
    if (r.retouchBase === n && !r.leg?.returning) {
      const ready = Math.max(t, r.returnReadyAt ?? t, slideCommittedV115(r,t) ? r.leg!.from + r.leg!.motion.durationSeconds : -Infinity), p = runnerAt(r, ready), velocity = runnerVelocityAt(r, ready),
        passed = Math.max(r.base, ...((r.leg?.motion.touches ?? []).filter(b => r.leg!.from + b.elapsedSeconds <= ready).map(b => b.base))),
        motion = createLiveRunnerRetreatMotionV1({ position: p, velocity, bases: { 1: base(1), 2: base(2), 3: base(3), 4: base(4) },
          originBase: r.retouchBase, lastTouchedBase: passed, topSpeedMps: r.spec.topSpeedMps, accelerationMps2: r.spec.accelerationMps2,
          baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28 });
      return ready - t + (motion?.touches.slice().reverse().find(b => b.base === n)?.elapsedSeconds ?? 0);
    }
    return touch && r.leg ? Math.max(0, r.leg.from + touch.elapsedSeconds - t)
      : estimateLiveRunnerLegSecondsV1(distance(flat(runnerAt(r, t)), flat(base(n))), r.spec.topSpeedMps, r.spec.accelerationMps2, field.baseTouchRadiusMeters ?? .28);
  };
  // A non-force advance is defended by throwing to the destination and tagging
  // the runner. Only applyBaseControl may retire an actual force obligation.
  const advancingPast = (r: Runner, n: number, t: number) => {
    if (!r.leg || r.leg.returning || r.retouchBase !== null || n >= 4) return false;
    const position = runnerAt(r, t), velocity = runnerVelocityAt(r, t), next = sub(base(n + 1), position), speed = norm(flat(velocity));
    // Observed motion toward the next bag, not an unissued future leg. A
    // first-base overrun points up the foul-side lane, not toward second.
    return distance(flat(position), flat(base(n))) < 8 && speed > .8
      && (velocity.x * next.x + velocity.z * next.z) / Math.max(.001, speed * norm(flat(next))) > .55;
  };
  const legacyOutTargetsV117 = () => {
    const appeals = runners.filter(r => !r.retired && r.retouchBase !== null)
      .map(r => ({ runnerId: r.spec.runnerId, targetBase: r.retouchBase!, forced: false, appeal: true })),
      forced = deriveCurrentForceObligations(force).filter(o => !appeals.some(a => a.runnerId === o.runnerId)).map(o => ({ ...o, forced: true, appeal: false }));
    const current = [...appeals, ...forced, ...runners.filter(r => !r.retired && !r.scored && r.leg && r.leg.to > r.base
      && !r.retouchBase && !forced.some(o => o.runnerId === r.spec.runnerId))
      .map(r => ({ runnerId: r.spec.runnerId, targetBase: r.leg!.to, forced: false, appeal: false }))];
    // When the current bag cannot be defended, return the ball ahead of the
    // runner. A failed out attempt must not leave an outfielder chasing a
    // runner across the diamond while every extra base remains undefended.
    const containment = runners.filter(r => !r.retired && !r.scored && r.leg && !r.retouchBase
      && advancingPast(r, Math.max(r.base, r.leg.to), time))
      .map(r => ({ runnerId: r.spec.runnerId, targetBase: Math.max(r.base, r.leg!.to) + 1 as BaseballBase, forced: false, appeal: false }));
    return [...current.map(o => ({ ...o, containment: false })), ...containment
      .filter(o => !current.some(c => c.runnerId === o.runnerId && c.targetBase === o.targetBase))
      .map(o => ({ ...o, containment: true }))];
  };
  type ObservationV95 = { t: number; position: Vec3; velocity: Vec3; spin: Vec3; phase: string;
    actors: readonly LiveRelayActorV1[]; holder: string | null; pending: boolean; readySeconds: number;
    transferRemainingSeconds: number; chargeElapsedSecondsV103: number; cueRevision: number; orientation: Quaternion };
  const gloveTossCapabilitiesV110=new Map(defenders.map(f=>[f,resolveLiveGloveTossCapabilityV110({reactionSeconds:f.spec.reactionSeconds,
    decisionSeconds:f.spec.fieldingCognition?.decisionSeconds??0,advancedFielding:f.spec.technicalSkills?.advanced_fielding??0,
    gloveSpeedMps:f.spec.gloveSpeedMps,throwSpeedMps:f.spec.throwSpeedMps})]));
  const transferActorV110=(f:Fielder,t:number)=>({position:at(f.body,t),velocity:velocityAt(f.body,t),
    glovePosition:at(f.glove,t),gloveVelocity:velocityAt(f.glove,t),gloveSpeedMps:f.spec.gloveSpeedMps,gloveReachMeters:f.spec.gloveReachMeters,
    bodyModelV105:f.spec.bodyModelV105,bodyPoseV105:poseV105(f,t),gloveTossV110:gloveTossCapabilitiesV110.get(f)});
  const history: ObservationV95[] = [],perceptionHistoryV118:LiveFieldObservationSnapshotV1[]=[],observedThrowPhaseV118=new Set<string>();
  const postActionClockV120=Object.freeze({originTick,ticksPerSecond:tps}),postActionScopeV120='field:'+originTick+':'+start+':'+(input.seed??0);
  const postActionEstimatesV120:{elapsedSeconds:number;observerId:string;playerId:string;knowledge:string;sourceId:string;revision:number;
    observedSeconds:number;readySeconds:number;arrivalSeconds:number;arrivalMode:string;target:Vec3}[]=[];
  // This is an observation-model horizon, not an extension of a physical
  // action or a message lifetime. Route queries may continue after ready.
  const postActionValidityV120=max+16;
  const observedRecoveryV120=(f:Fielder,t:number):LivePostActionContextV120|undefined=>{
    if(!individualV118||!athleticActiveV115(f,t)||!f.spec.bodyModelV105||!f.spec.athleticProfileV115)return undefined;
    const sample=f.athleticV115!.sampleAtElapsedSeconds(t),estimate=estimateLiveObservedRecoveryV120({kind:f.athleticV115!.kind,phase:sample.phase,
      position:sample.position,velocity:sample.velocity,body:f.spec.bodyModelV105,profile:f.spec.athleticProfileV115,
      gravityMps2:input.physics.ground.gravityMps2,brakingMps2:Math.min(Math.max(.05,input.physics.ground.material.slidingFriction*2.5)*input.physics.ground.gravityMps2,f.locomotion.brakingMps2),
      groundY:f.spec.position.y-f.spec.bodyModelV105.hipHeightMeters,observationCadenceSeconds:LIVE_FIELD_TEST_MODEL_V1.controlSeconds});
    if(!estimate)return undefined;
    return {clock:postActionClockV120,scopeId:postActionScopeV120,nowSeconds:t,nowTick:tick(t),knownAction:createLiveObservedPostActionV1({
      clock:postActionClockV120,provenance:{kind:'observed',scopeId:postActionScopeV120,actorId:f.spec.playerId,sourceId:'visible-body:'+f.spec.playerId,
        revision:tick(t),observedSeconds:t,observedTick:tick(t),validThroughSeconds:postActionValidityV120},
      recoveryRemainingSeconds:estimate.remainingSeconds,position:estimate.position,velocity:estimate.velocity,uncertaintySeconds:estimate.uncertaintySeconds})};
  };
  const observedRecoveryFieldsV120=(f:Fielder,t:number)=>{const context=observedRecoveryV120(f,t);return context?{postActionV120:context}:{};};
  const observe = (t: number) => {
    const b = ballAt(t), holder = possession ?? pendingCatch?.fielder;
    history.push({ t, position: b.position, velocity: b.velocity, spin: b.spin, phase: b.phase,
      actors: defenders.map(f => ({ ...roleActor(f, t), glovePosition: at(f.glove, t), gloveVelocity: velocityAt(f.glove, t),
        ...(individualV118?observedRecoveryFieldsV120(f,t):athleticActiveV115(f,t)?{athleticRecoverySecondsV116:recoveryV105(f,t)}:{}),
        gloveSpeedMps: f.spec.gloveSpeedMps, gloveReachMeters: f.spec.gloveReachMeters, gloveRadiusMeters: f.spec.gloveRadiusMeters,
        ...(f.spec.bodyModelV105 ? { bodyModelV105: f.spec.bodyModelV105, bodyPoseV105: poseV105(f, t) } : {}),
        transferSeconds: forecastTransferSecondsV101(f), ...(gloveTossCapabilitiesV110.get(f)?{gloveTossV110:gloveTossCapabilitiesV110.get(f)!}:{}),throwDirectionStdRadians: f.spec.throwDirectionStdRadians,
        ...(f.spec.throwEffortBuildSecondsV103 === undefined ? {} : { throwEffortBuildSecondsV103: f.spec.throwEffortBuildSecondsV103 }),
        throwBackspinRadPerSecond: f.spec.throwBackspinRadPerSecond, throwSpinRadPerSecond: f.spec.throwSpinRadPerSecond })),
      holder: holder?.spec.playerId ?? null, pending: !!pendingCatch, readySeconds: pendingCatch ? Math.max(0, pendingCatch.secure - t) : 0,
      transferRemainingSeconds: holder ? possession ? Math.max(0, custodySince + forecastTransferSecondsV101(holder) - t) : forecastTransferSecondsV101(holder) : 0,
      chargeElapsedSecondsV103: possession && custodyChargeFromV103 !== null ? Math.max(0, t - Math.max(custodyChargeFromV103,custodySince+effectiveTransferSeconds(possession))) : 0,
      cueRevision: runnerCueRevisionV95, orientation: b.orientation });
    if(input.defenseDecisionModeV118==='individual'||input.defenseDecisionModeV118==='shadow'){
      perceptionHistoryV118.push(captureLiveFieldObservationSnapshotV1({elapsedSeconds:t,
        ball:{position:b.position,velocity:b.velocity,spin:b.spin,possessedBy:holder?.spec.playerId??null,phase:holder?'held':hasThrown?'throw':'free',
          flyCaught:!!flyCatch,...(firstFielderTouchSeconds===null?{}:{firstTouchElapsedSeconds:firstFielderTouchSeconds})},
        actors:history.at(-1)!.actors.map(a=>({playerId:a.playerId,position:a.position,velocity:a.velocity,glovePosition:a.glovePosition,gloveVelocity:a.gloveVelocity})),
        runners:runners.map(r=>({runnerId:r.spec.runnerId,position:runnerAt(r,t),velocity:runnerVelocityAt(r,t),currentBase:r.base,retired:r.retired,scored:r.scored})),
        outs:Math.min(3,input.outs+retiredCount)}));
    }
  };
  // One local technique owner: authored SI remains intact in movement, relay and forecasts.
  const effectiveTransferSeconds = (f: Fielder) => { const skill = f.spec.technicalSkills?.advanced_fielding ?? 0;
    return (skill > 0 ? f.spec.transferSeconds * (1 - .08 * skill) : f.spec.transferSeconds) + (f === possession ? custodyDelayV101 : 0); };
  const forecastTransferSecondsV101 = (f: Fielder) => effectiveTransferSeconds(f) - (f === possession ? custodyDelayV101 : 0) + (f.spec.transferDelayMaxSecondsV101 ?? 0) / 3;
  const responseSeconds = (f: Fielder) => {
    const skill = !(individualV118?observedThrowPhaseV118.has(f.spec.playerId):hasThrown) && f.spec.defensivePosition === 'P' ? f.spec.technicalSkills?.pitcher_field_reaction ?? 0 : 0;
    return (skill > 0 ? f.spec.reactionSeconds / (1 + .6 * skill) : f.spec.reactionSeconds) + (f.spec.fieldingCognition?.decisionSeconds ?? 0);
  };
  const initialMovementV98 = input.recordInitialMovementV98 ? new Map<string, LiveFieldInitialMovementV98>(defenders.map(f => [f.spec.playerId, {
    playerId: f.spec.playerId, inputReactionSeconds: f.spec.reactionSeconds,
    decisionSeconds: f.spec.fieldingCognition?.decisionSeconds ?? 0, responseSecondsAtStart: responseSeconds(f), sampleIntervalSeconds: frameSeconds,
    firstActivation: null, firstNonHoldRole: null, firstMovementCommand: null, firstSampledMoving: null }])) : null;
  const seenBy = (f: Fielder, t: number) => {
    const relationship = throwTarget && defenders.find(a => a.spec.playerId === throwTarget!.throwerPlayerId)?.spec.fieldRelationshipsV99?.find(r => r.toPlayerId === f.spec.playerId);
    const delay = !individualV118&&hasThrown && f === throwTarget?.receiver ? f.spec.reactionSeconds + (relationship ? .08 * (1 - relationship.coordination / 100) : 0) : responseSeconds(f),
      available=individualV118?Math.min(t-delay,Math.floor((t-delay+1e-12)/LIVE_FIELD_TEST_MODEL_V1.controlSeconds)*LIVE_FIELD_TEST_MODEL_V1.controlSeconds):t-delay;
    for (let i = history.length - 1; i >= 0; i--) if (history[i].t <= available+(individualV118?1e-12:0)) return history[i];
    return null;
  };
  const predictions: { observation: typeof history[number]; curve: ReturnType<typeof createLiveFieldForecastV1> }[] = [];
  let forecastBuilds = 0;
  const predictObservation = (seen: typeof history[number] | null, t: number, response: number) => {
    if (!seen || seen.phase === 'possessed' || (!individualV118&&(possession||pendingCatch||dead)) || t - seen.t >= LIVE_FIELD_TEST_MODEL_V1.sensorPrediction.horizonSeconds) return null;
    const policy = LIVE_FIELD_TEST_MODEL_V1.sensorPrediction,
      requiredLookahead = Math.min(5, Math.max(.1, (policy.horizonSeconds - response) / 2));
    let hypothesis: typeof predictions[number] | undefined;
    for (let i = predictions.length - 1; i >= 0; i--) if (predictions[i].observation.t <= seen.t
      && t - predictions[i].observation.t + requiredLookahead <= policy.horizonSeconds) { hypothesis = predictions[i]; break; }
    if (hypothesis) {
      const prior = hypothesis.curve.sampleAtElapsedSeconds(seen.t - hypothesis.observation.t);
      if (distance(prior.position, seen.position) > policy.maximumPositionResidualMeters
        || distance(prior.velocity, seen.velocity) > policy.maximumVelocityResidualMps
        || distance(prior.spin, seen.spin) > policy.maximumSpinResidualRadPerSecond) hypothesis = undefined;
    }
    if (!hypothesis) {
      hypothesis = { observation: seen, curve: createLiveFieldForecastV1({ observation: { tick: tick(seen.t), position: seen.position,
        velocity: seen.velocity, spin: seen.spin }, physics: input.physics, horizonSeconds: policy.horizonSeconds }) };
      predictions.push(hypothesis); forecastBuilds++;
    }
    const age = t - hypothesis.observation.t;
    return { observedPosition: seen.position, observationTick: tick(seen.t),
      maximumPositionSpeedMps: hypothesis.curve.diagnostics.maximumPositionSpeedUpperBoundMps,
      maximumSeconds: policy.horizonSeconds - age,
      firstPredictedGroundSeconds: (hypothesis.curve.diagnostics.groundContactElapsedSeconds[0] ?? Infinity) - age,
      sample: (h: number) => hypothesis!.curve.sampleAtElapsedSeconds(age + h) };
  };
  const predict = (f: Fielder, t: number) => predictObservation(seenBy(f, t) ?? (!individualV118&&!hasThrown && history.length ? history[0] : null), t, responseSeconds(f));
  const roleActor = (f: Fielder, t: number): LiveFieldRoleActorV1 => ({ playerId: f.spec.playerId,
    position: at(f.body, t), velocity: velocityAt(f.body, t), homePosition: f.spec.position,
    topSpeedMps: f.spec.topSpeedMps, accelerationMps2: f.spec.accelerationMps2, throwSpeedMps: f.spec.throwSpeedMps,
    remainingReactionSeconds: Math.max(0, start + responseSeconds(f) - t),
    ...(f.spec.defensivePosition === undefined ? {} : { defensivePosition: f.spec.defensivePosition }),
    ...(f.spec.fieldingCognition?.pursuitCostWeight === undefined ? {} : { pursuitCostWeight: f.spec.fieldingCognition.pursuitCostWeight }) });
  const communicationV118=createLiveFieldCoordinationV2({clock:{originTick,ticksPerSecond:tps},maximumMessages:256}),
    knowledgeCacheV118=new Map<string,{at:number;value:ReturnType<typeof buildLiveFieldPerceivedStateV1>}>(),
    announcementV118=new Map<string,{at:number;key:string;revision:number}>(),
    lastIndividualDecisionV118=new Map<string,{playerId:string;tick:number;observationSeconds:number|null;basis:'individual_perception';decision:ReturnType<typeof evaluateLiveFieldDecisionV1>}>(),
    retouchBeliefsV118=new Map<string,LiveRetouchBeliefV118>();
  const knowledgeV118=(f:Fielder,t:number)=>{
    const old=knowledgeCacheV118.get(f.spec.playerId);if(old?.at===t)return old.value;
    const available=t-responseSeconds(f),gate=Math.floor((available+1e-12)/LIVE_FIELD_TEST_MODEL_V1.controlSeconds)*LIVE_FIELD_TEST_MODEL_V1.controlSeconds;
    let lo=0,hi=perceptionHistoryV118.length;while(lo<hi){const m=(lo+hi)>>>1;if(perceptionHistoryV118[m].elapsedSeconds<=Math.min(available,gate)+1e-12)lo=m+1;else hi=m;}
    const snapshot=perceptionHistoryV118[lo-1],value=buildLiveFieldPerceivedStateV1({observerId:f.spec.playerId,elapsedSeconds:t,
      clock:{originTick,ticksPerSecond:tps},delaySeconds:responseSeconds(f),cadenceSeconds:LIVE_FIELD_TEST_MODEL_V1.controlSeconds,
      snapshots:snapshot?[snapshot]:[],knownContext:{outs:input.outs,occupiedBases:input.runners.filter(r=>r.initialBase>0).map(r=>r.initialBase as 1|2|3)}});
    retouchBeliefsV118.set(f.spec.playerId,updateLiveRetouchBeliefV118(retouchBeliefsV118.get(f.spec.playerId),{
      observationSeconds:value.observationElapsedSeconds,firstTouchSeconds:value.ball?.firstTouchElapsedSeconds??null,flyCaught:value.ball?.flyCaught??false,
      bases:{1:base(1),2:base(2),3:base(3),4:base(4)},touchRadiusMeters:field.baseTouchRadiusMeters??.28,
      runners:value.runners.map(r=>({runnerId:r.runnerId,initialBase:input.runners.find(p=>p.runnerId===r.runnerId)!.initialBase,
        position:r.observedPosition,velocity:r.observedVelocity}))}));
    if(value.ball?.phase==='throw')observedThrowPhaseV118.add(f.spec.playerId);
    knowledgeCacheV118.set(f.spec.playerId,{at:t,value});return value;
  };
  const knownActorV118=(observer:Fielder,f:Fielder,t:number):LiveFieldRoleActorV1=>{
    if(!individualV118||observer===f)return roleActor(f,t);
    const known=knowledgeV118(observer,t).actors.find(a=>a.playerId===f.spec.playerId);
    // Pre-play placement/profile is prior knowledge; an unseen current command is not.
    return {playerId:f.spec.playerId,position:known?.position??f.spec.position,velocity:known?.velocity??v(),homePosition:f.spec.position,
      topSpeedMps:f.spec.topSpeedMps,accelerationMps2:f.spec.accelerationMps2,throwSpeedMps:f.spec.throwSpeedMps,
      ...(f.spec.defensivePosition?{defensivePosition:f.spec.defensivePosition}:{}),
      ...(f.spec.fieldingCognition?.pursuitCostWeight===undefined?{}:{pursuitCostWeight:f.spec.fieldingCognition.pursuitCostWeight}),remainingReactionSeconds:0};
  };
  const knownRunnerV118=(observer:Fielder,r:Runner,t:number)=>knowledgeV118(observer,t).runners.find(a=>a.runnerId===r.spec.runnerId);
  const knownRunnerActiveV118=(r:Runner,t:number,observer=possession??pendingCatch?.fielder)=>{
    if(!individualV118||!observer)return !r.retired&&!r.scored;
    const seen=knownRunnerV118(observer,r,t);return !!seen&&!seen.retired&&!seen.scored;
  };
  const knownRunnerMovingV118=(r:Runner,t:number,observer=possession??pendingCatch?.fielder)=>{
    if(!individualV118||!observer)return !!r.leg;
    const seen=knownRunnerV118(observer,r,t);if(!seen||seen.retired||seen.scored)return false;
    const next=base(Math.min(4,seen.currentBase+1)),d=sub(next,seen.position);
    return norm(flat(seen.velocity))>.15&&(seen.velocity.x*d.x+seen.velocity.z*d.z)>0;
  };
  const knownPostActionV120=(observer:Fielder,f:Fielder,t:number,observed?:LiveRelayActorV1):LivePostActionContextV120|undefined=>{
    if(!individualV118)return undefined;
    if(observer===f){
      if(!athleticActiveV115(f,t))return undefined;
      const action=f.athleticV115!,end=action.sampleAtElapsedSeconds(action.throughSeconds);
      return {clock:postActionClockV120,scopeId:postActionScopeV120,nowSeconds:t,nowTick:tick(t),knownAction:{readySeconds:action.throughSeconds,
        readyTick:tick(action.throughSeconds),position:end.position,velocity:end.velocity,uncertaintySeconds:0,
        provenance:{kind:'self',scopeId:postActionScopeV120,actorId:f.spec.playerId,sourceId:'self-action:'+tick(action.fromSeconds),revision:tick(action.fromSeconds),
          observedSeconds:t,observedTick:tick(t),validThroughSeconds:postActionValidityV120}}};
    }
    const delivered=communicationV118.receiveWithCommitments({observerId:observer.spec.playerId,elapsedSeconds:t})
      .filter(m=>m.commitment?.actorId===f.spec.playerId&&m.commitment.kind==='athletic')
      .sort((a,b)=>b.reception.sentAtElapsedSeconds-a.reception.sentAtElapsedSeconds)[0];
    if(delivered?.commitment){const c=delivered.commitment,ready=c.throughSeconds;
      return {clock:postActionClockV120,scopeId:postActionScopeV120,nowSeconds:t,nowTick:tick(t),knownAction:{readySeconds:ready,readyTick:tick(ready),
        position:c.segments.at(-1)!.controls[3],velocity:v(),uncertaintySeconds:0,provenance:{kind:'received',scopeId:postActionScopeV120,actorId:f.spec.playerId,
          sourceId:c.commandId,revision:c.revision,observedSeconds:delivered.reception.sentAtElapsedSeconds,observedTick:tick(delivered.reception.sentAtElapsedSeconds),
          receivedSeconds:delivered.reception.receivedAtElapsedSeconds,receivedTick:tick(delivered.reception.receivedAtElapsedSeconds),validThroughSeconds:postActionValidityV120}}};}
    if(!observed){const at=knowledgeV118(observer,t).observationElapsedSeconds;let lo=0,hi=history.length;
      while(lo<hi){const m=(lo+hi)>>>1;if(history[m].t<=(at??-Infinity))lo=m+1;else hi=m;}
      observed=history[lo-1]?.actors.find(a=>a.playerId===f.spec.playerId);}
    return observed?.postActionV120?{...observed.postActionV120,nowSeconds:t,nowTick:tick(t)}:undefined;
  };
  const knownArrivalV120=(observer:Fielder,f:Fielder,t:number,target:Vec3,radius:number,mode:'first_entry'|'receiver'='first_entry')=>{
    const known=knownActorV118(observer,f,t),actor=mode==='receiver'?known:{...known,remainingReactionSeconds:0},context=knownPostActionV120(observer,f,t);
    if(!context)return mode==='receiver'?estimateLiveReceiverArrivalV106(actor,target,radius):liveFieldArrivalSecondsV1(actor,target,radius);
    const estimate=estimateLivePostActionArrivalV1({...context,actorId:f.spec.playerId,actor,target,arrivalMode:mode,radiusMeters:radius}),p=context.knownAction.provenance;
    if(postActionEstimatesV120.length===256)postActionEstimatesV120.shift();
    postActionEstimatesV120.push({elapsedSeconds:t,observerId:observer.spec.playerId,playerId:f.spec.playerId,knowledge:p.kind,sourceId:p.sourceId,revision:p.revision,
      observedSeconds:p.observedSeconds,readySeconds:context.knownAction.readySeconds,arrivalSeconds:estimate.arrivalSeconds,arrivalMode:mode,target:{...target}});
    return estimate.remainingSeconds;
  };
  const knownRelayActorV118=(observer:Fielder,f:Fielder,t:number):LiveRelayActorV1=>{
    const state=knowledgeV118(observer,t),known=state.actors.find(a=>a.playerId===f.spec.playerId);
    let lo=0,hi=history.length;while(lo<hi){const m=(lo+hi)>>>1;if(history[m].t<=(state.observationElapsedSeconds??-Infinity))lo=m+1;else hi=m;}
    const observed=history[lo-1]?.actors.find(a=>a.playerId===f.spec.playerId),self=f===observer,postAction=knownPostActionV120(observer,f,t,observed);
    // Another hand's unobserved continuation is unknown. Carry its last
    // observed offset with the estimated body rather than extending a brief
    // downward catch velocity through the ground as a new throw boundary.
    return {...knownActorV118(observer,f,t),...(postAction?{postActionV120:postAction}:{}),glovePosition:self?at(f.glove,t):known&&observed?add(known.position,sub(observed.glovePosition,observed.position)):known?.position??f.spec.position,
      gloveVelocity:self?velocityAt(f.glove,t):known?.velocity??v(),gloveSpeedMps:f.spec.gloveSpeedMps,
      gloveReachMeters:f.spec.gloveReachMeters,gloveRadiusMeters:f.spec.gloveRadiusMeters,
      ...(f.spec.bodyModelV105?{bodyModelV105:f.spec.bodyModelV105,bodyPoseV105:self?poseV105(f,t):observed?.bodyPoseV105}:{}),
      transferSeconds:self?forecastTransferSecondsV101(f):f.spec.transferSeconds+(f.spec.transferDelayMaxSecondsV101??0)/3,
      ...(gloveTossCapabilitiesV110.get(f)?{gloveTossV110:gloveTossCapabilitiesV110.get(f)!}:{}),
      ...(f.spec.throwEffortBuildSecondsV103===undefined?{}:{throwEffortBuildSecondsV103:f.spec.throwEffortBuildSecondsV103}),
      ...(f.spec.throwDirectionStdRadians===undefined?{}:{throwDirectionStdRadians:f.spec.throwDirectionStdRadians}),
      ...(f.spec.throwBackspinRadPerSecond===undefined?{}:{throwBackspinRadPerSecond:f.spec.throwBackspinRadPerSecond}),
      ...(f.spec.throwSpinRadPerSecond===undefined?{}:{throwSpinRadPerSecond:f.spec.throwSpinRadPerSecond})};
  };
  const knownRunnerAtV118=(r:Runner,t:number,observer=possession??pendingCatch?.fielder)=>{
    if(!individualV118||!observer)return runnerAt(r,t);
    const known=knownRunnerV118(observer,r,time);return known?add(known.position,mul(known.velocity,t-time)):r.spec.position??base(r.spec.initialBase);
  };
  const knownForceStateV118=(observer:Fielder,t:number)=>{
    if(!individualV118)return force;
    const state=knowledgeV118(observer,t);let result=createInitialForceObligationState({first:input.runners.find(r=>r.initialBase===1)?.runnerId??null,
      second:input.runners.find(r=>r.initialBase===2)?.runnerId??null,third:input.runners.find(r=>r.initialBase===3)?.runnerId??null},batter.spec.runnerId);
    for(const r of state.runners){if(r.retired)result=retireForceParticipant(result,r.runnerId);
      for(const o of deriveCurrentForceObligations(result).filter(o=>o.runnerId===r.runnerId&&r.currentBase>=o.targetBase))result=satisfyForceParticipantObligation(result,o.runnerId);}
    return result;
  };
  const knownForceObligationsV118=(observer:Fielder,t:number)=>deriveCurrentForceObligations(knownForceStateV118(observer,t));
  const runnerArrivalSeconds=(r:Runner,n:BaseballBase,t:number,observer=possession??pendingCatch?.fielder)=>{
    if(!individualV118||!observer)return legacyRunnerArrivalSecondsV117(r,n,t);
    const known=knownRunnerV118(observer,r,t);if(!known)return estimateLiveRunnerLegSecondsV1(distance(flat(r.spec.position??base(r.spec.initialBase)),flat(base(n))),r.spec.topSpeedMps,r.spec.accelerationMps2);
    return liveFieldArrivalSecondsV1({playerId:r.spec.runnerId,position:known.position,velocity:known.velocity,homePosition:base(r.spec.initialBase),
      topSpeedMps:r.spec.topSpeedMps,accelerationMps2:r.spec.accelerationMps2,throwSpeedMps:1,remainingReactionSeconds:0},base(n),field.baseTouchRadiusMeters??.28);
  };
  const outTargets=(observer=possession??pendingCatch?.fielder,t=time)=>{
    if(!individualV118||!observer)return legacyOutTargetsV117();
    const state=knowledgeV118(observer,t),appeals=(retouchBeliefsV118.get(observer.spec.playerId)?.required??[])
      .filter(r=>state.runners.some(p=>p.runnerId===r.runnerId&&!p.retired&&!p.scored))
      .map(r=>({runnerId:r.runnerId,targetBase:r.base,forced:false,appeal:true,containment:false})),
      forced=knownForceObligationsV118(observer,t).filter(o=>!appeals.some(a=>a.runnerId===o.runnerId)).map(o=>({...o,forced:true,appeal:false,containment:false})),
      result:{runnerId:string;targetBase:BaseballBase;forced:boolean;appeal:boolean;containment:boolean}[]=[...appeals,...forced];
    for(const seen of state.runners){
      if(seen.retired||seen.scored||result.some(o=>o.runnerId===seen.runnerId))continue;
      const next=Math.min(4,seen.currentBase+1) as BaseballBase,d=sub(base(next),seen.position),speed=norm(flat(seen.velocity));
      if(speed>.8&&(seen.velocity.x*d.x+seen.velocity.z*d.z)/Math.max(.001,speed*norm(flat(d)))>.55)
        result.push({runnerId:seen.runnerId,targetBase:next,forced:false,appeal:false,containment:false});
    }
    return result;
  };
  const adviceV118=(f:Fielder,t:number):LiveFieldAdviceV1[]=>communicationV118.receive({observerId:f.spec.playerId,elapsedSeconds:t}).flatMap(m=>{
    const payload=m.received.event.content.payload,intent=payload.intent;if(payload.kind!=='intent'||!intent)return [];
    const kind=intent.kind,role:LiveFieldRoleV1={playerId:payload.targetPlayerId??m.received.event.sourceId,
      taskId:kind==='base_cover'?'cover:'+intent.base:kind==='ball_handler'?'pickup':kind,
      intent:kind==='ball_handler'?'intercept':kind==='base_cover'?'base_cover':kind==='relay'?'relay':kind==='backup'?'backup':'hold',
      point:payload.point??(kind==='base_cover'?base(intent.base):f.spec.position),targetBase:kind==='base_cover'?intent.base:null},
      relationship=f.spec.fieldRelationshipsV99?.find(r=>r.toPlayerId===m.received.event.sourceId);
    return [{sourceId:m.received.event.sourceId,targetPlayerId:payload.targetPlayerId,role,trust:(relationship?.trust??50)/100}];
  });
  const publishIntentV118=(f:Fielder,t:number,key:string,payload:LiveFieldCoordinationPayloadV1,recipient?:Fielder)=>{
    const id=f.spec.playerId+':'+(recipient?.spec.playerId??'all')+':'+key,old=announcementV118.get(id),signature=JSON.stringify(payload.intent);
    if(old&&old.key===signature&&t-old.at<.6)return;
    const revision=(old?.revision??0)+1;announcementV118.set(id,{at:t,key:signature,revision});
    for(const to of recipient?[recipient]:defenders.filter(to=>to!==f)){
      const relation=f.spec.fieldRelationshipsV99?.find(r=>r.toPlayerId===to.spec.playerId);
      communicationV118.issue({messageId:id,revision,sourceId:f.spec.playerId,recipientId:to.spec.playerId,issuedAtElapsedSeconds:t,
        expiresAtElapsedSeconds:t+1.4,propagationDelaySeconds:.04+.08*(1-(relation?.coordination??50)/100),payload});
    }
  };
  const runnerSnapshotBucketsV95 = new Map<string, ObservationV95>();
  const runnerSourceCacheV95 = new Map<ObservationV95, readonly LiveDefenseControlSourceV95[]>();
  const runnerObservationV95 = (r: Runner, t: number): ObservationV95 | null => {
    const available = t - r.spec.reactionSeconds;
    let lo = 0, hi = history.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (history[mid].t <= available) lo = mid + 1; else hi = mid; }
    const latest = history[lo - 1]; if (!latest) return null;
    const key = latest.cueRevision + ':' + Math.floor((latest.t - start) / .2);
    let snapshot = runnerSnapshotBucketsV95.get(key);
    if (snapshot && snapshot.t > available) return latest;
    if (!snapshot) { snapshot = latest; runnerSnapshotBucketsV95.set(key, snapshot);
      if (runnerSnapshotBucketsV95.size > 128) runnerSnapshotBucketsV95.delete(runnerSnapshotBucketsV95.keys().next().value!); }
    return snapshot;
  };
  const runnerSourcesV95 = (seen: ObservationV95): readonly LiveDefenseControlSourceV95[] => {
    const cached = runnerSourceCacheV95.get(seen); if (cached) return cached;
    let sources: LiveDefenseControlSourceV95[] = [];
    if (seen.holder) sources = [{ playerId: seen.holder,
      point: seen.actors.find(a => a.playerId === seen.holder)!.glovePosition, readySeconds: seen.readySeconds,
      kind: seen.pending ? 'pending' : 'held', holderTransferRemainingSeconds: seen.transferRemainingSeconds,
      holderChargeElapsedSecondsV103: seen.pending ? 0 : seen.chargeElapsedSecondsV103 }];
    else {
      const curve = createLiveFieldForecastV1({ observation: { tick: tick(seen.t), position: seen.position,
        velocity: seen.velocity, spin: seen.spin }, physics: input.physics, horizonSeconds: 8 });
      for (const actor of seen.actors) for (let h = 0; h <= 8; h += .2) {
        const context=actor.postActionV120,recovery=context?Math.max(0,context.knownAction.readySeconds-seen.t):actor.athleticRecoverySecondsV116??0,
          readyPosition=context&&recovery>0?context.knownAction.position:actor.position;
        if (h < recovery) continue;
        const point = curve.sampleAtElapsedSeconds(h).position;
        const reach = actor.bodyModelV105 ? liveFielderHorizontalReachV105(actor.bodyModelV105, readyPosition, point.y) : actor.gloveReachMeters;
        if (!pointInside(point, fenceRadius - input.physics.ground.radiusM) || reach < 0 || !actor.bodyModelV105 && point.y > actor.position.y + actor.gloveReachMeters) continue;
        const postureTime = actor.bodyModelV105 ? Math.abs(liveFielderDesiredCrouchV105(actor.bodyModelV105, actor.position, point) - (actor.bodyPoseV105?.crouchMeters ?? 0)) / actor.bodyModelV105.postureSpeedMps : 0;
        const arrival = context?estimateLivePostActionArrivalV1({...context,actorId:actor.playerId,actor,target:point,arrivalMode:'first_entry',radiusMeters:reach*(actor.bodyModelV105 ? .65 : 1)}).remainingSeconds:recovery > 0 ? recovery + liveFieldArrivalSecondsV1({ ...actor, velocity: v(),
          remainingReactionSeconds: Math.max(0,actor.remainingReactionSeconds-recovery) }, point, reach * (actor.bodyModelV105 ? .65 : 1))
          : liveFieldArrivalSecondsV1(actor, point, reach * (actor.bodyModelV105 ? .65 : 1));
        if (Math.max(arrival, actor.bodyModelV105 ? actor.remainingReactionSeconds + postureTime : 0) <= h) {
          sources.push({ playerId: actor.playerId, point, readySeconds: h, kind: 'forecast' }); break;
        }
      }
      sources.sort((a, b) => a.readySeconds - b.readySeconds);
    }
    runnerSourceCacheV95.set(seen, sources); return sources;
  };
  const forecast = (f: Fielder, t: number) => {
    const prediction = predict(f, t); if (!prediction) return null;
    const bodyPos = at(f.body, t), bodyVel = velocityAt(f.body, t),
      activeAt = start + Math.ceil(Math.max(0, responseSeconds(f) - 1e-12) / LIVE_FIELD_TEST_MODEL_V1.controlSeconds) * LIVE_FIELD_TEST_MODEL_V1.controlSeconds,
      wait = Math.max(0, activeAt - t),
      gloveFloor = Math.max(f.spec.gloveRadiusMeters, input.physics.ground.radiusM),
      travelActor={...roleActor(f,t),position:bodyPos,velocity:bodyVel,remainingReactionSeconds:wait};
    const horizontalReachAt = (y: number) => {
      if (f.spec.bodyModelV105) return liveFielderHorizontalReachV105(f.spec.bodyModelV105,bodyPos,Math.max(gloveFloor,y));
      const dy = f.spec.position.y - Math.max(gloveFloor, y);
      return Math.sqrt(Math.max(0, f.spec.gloveReachMeters * f.spec.gloveReachMeters - dy * dy)) + f.spec.gloveRadiusMeters * .5;
    };
    const travelTo = (p: Vec3) => liveFieldArrivalSecondsV1(travelActor,p,Math.max(0,horizontalReachAt(p.y))*(f.spec.bodyModelV105 ? .65 : 1));
    const observed = prediction.observedPosition, fallbackTravel = travelTo(observed);
    let best = { point: observed, eta: fallbackTravel + Math.max(0, observed.y - f.spec.position.y - f.spec.gloveReachMeters), prediction, intercepted: false };
    let attempt: NearFieldAttemptV113 | null = null;
    const observedVelocity = prediction.sample(0).velocity,
      approaching = observedVelocity.x * (bodyPos.x - observed.x) + observedVelocity.z * (bodyPos.z - observed.z) > 0;
    let lastInFence = null as { point: Vec3; eta: number } | null;
    const near = LIVE_FIELD_TEST_MODEL_V1.sensorPrediction, horizons = [
      ...Array.from({ length: Math.floor(near.nearInterceptThroughSeconds / near.nearInterceptStepSeconds) }, (_, i) => (i + 1) * near.nearInterceptStepSeconds),
      ...Array.from({ length: Math.floor(prediction.maximumSeconds / near.farInterceptStepSeconds) }, (_, i) => (i + 1) * near.farInterceptStepSeconds)
        .filter(h => h > near.nearInterceptThroughSeconds) ];
    const tryHorizon = (h: number) => {
      const p = prediction.sample(h).position, insideFence = distance(flat(p), flat(fenceCenter)) <= fenceRadius - input.physics.ground.radiusM;
      if (!insideFence) return null;
      const travel = travelTo(p);
      lastInFence = { point: p, eta: Math.max(h, travel) };
      const postureTime = f.spec.bodyModelV105 ? Math.abs(liveFielderDesiredCrouchV105(f.spec.bodyModelV105, bodyPos, p) - (poseV105(f, t)?.crouchMeters ?? 0)) / f.spec.bodyModelV105.postureSpeedMps : 0;
      const lateness = Math.max(travel, wait + postureTime) - h;
      const pursuit = f.spec.fieldingCognition?.pursuitCostWeight ?? 1,
        closeCrossing = f.spec.fieldingCognition?.cautious !== true
          && distance(flat(bodyPos), flat(p)) <= LIVE_FIELD_TEST_MODEL_V1.closeAttemptV117.maximumRouteMeters / Math.sqrt(Math.max(1,pursuit))
          && lateness <= LIVE_FIELD_TEST_MODEL_V1.closeAttemptV117.maximumLateSeconds / Math.sqrt(Math.max(.5,pursuit));
      if (f.spec.bodyModelV105 && approaching && horizontalReachAt(p.y) >= 0 && lateness > 0
        && h <= LIVE_FIELD_TEST_MODEL_V1.nearAttemptV113.horizonSeconds
        && (lateness <= LIVE_FIELD_TEST_MODEL_V1.nearAttemptV113.maximumLateSeconds / Math.max(1,pursuit) || closeCrossing)
        && (!attempt || lateness < attempt.latenessSeconds))
        attempt = { point: p, eta: h, arrivalSeconds: travel, latenessSeconds: lateness };
      if ((f.spec.bodyModelV105 ? horizontalReachAt(p.y) >= 0 && wait + postureTime <= h : p.y <= f.spec.position.y + f.spec.gloveReachMeters) && travel <= h) {
        best = { point: p, eta: h, prediction, intercepted: true }; return true;
      }
      return travel - h;
    };
    let prevH = 0;
    for (const h of horizons) {
      if (h > prediction.maximumSeconds) break;
      const step = h - prevH;
      const res = tryHorizon(h);
      if (res === true) break;
      if (typeof res === 'number' && res < 0.35 && step > 0.01) {
        const subSteps = Math.min(10, Math.ceil(step / 0.01));
        for (let s = 1; s < subSteps; s++) {
          const subH = prevH + (step * s) / subSteps;
          if (subH <= prediction.maximumSeconds && tryHorizon(subH) === true) break;
        }
        if (best.intercepted) break;
      }
      prevH = h;
    }
    if (!best.intercepted && lastInFence) best = { point: lastInFence.point, eta: lastInFence.eta, prediction, intercepted: false };
    // tryHorizon assigns this value; TypeScript does not narrow callback writes.
    return { ...best, attempt: attempt as NearFieldAttemptV113 | null };
  };
  // Commands, rather than positions, are constrained. Every admitted motor
  // segment and its bounded emergency stop remain in the same solid stadium.
  // Convex Bezier hulls certify the complete quadratic, not just its endpoints.
  const roundBound = (p: Vec3) => 256 * Number.EPSILON * Math.max(1, norm(p), norm(fenceCenter), fenceRadius);
  const pointInside = (p: Vec3, radius: number) => distance(flat(p), flat(fenceCenter)) + roundBound(p) <= radius;
  const curveInside = (c: Curve, from: number, through: number, radius: number, floor: number, depth = 0): boolean => {
    if (c.stopAfter !== undefined && c.from + c.stopAfter > from && c.from + c.stopAfter < through)
      return curveInside(c, from, c.from + c.stopAfter, radius, floor, depth)
        && curveInside(c, c.from + c.stopAfter, through, radius, floor, depth);
    const a = at(c, from), b = at(c, through), control = add(a, mul(velocityAt(c, from), (through - from) / 3)),
      control2 = sub(b, mul(velocityAt(c, through), (through - from) / 3));
    if (!pointInside(a, radius) || !pointInside(b, radius) || a.y < floor || b.y < floor) return false;
    if (pointInside(control, radius) && pointInside(control2, radius) && control.y >= floor && control2.y >= floor) return true;
    if (depth >= 12 || from === through) return false;
    const mid = (from + through) / 2;
    return curveInside(c, from, mid, radius, floor, depth + 1) && curveInside(c, mid, through, radius, floor, depth + 1);
  };
  // A relative cubic Bezier hull stays inside the convex shoulder sphere.
  // Both facing endpoint planes conservatively bound every intermediate yaw.
  const bodyReachSafeV105 = (f: Fielder, c: Curve, from: number, through: number): boolean => {
    const m = f.spec.bodyModelV105; if (!m) return true;
    const boundary=f.athleticV115?.boundaries.find(t=>t>from&&t<through);
    if(boundary!==undefined)return bodyReachSafeV105(f,c,from,boundary)&&bodyReachSafeV105(f,c,boundary,through);
    if (f.body.stopAfter !== undefined && f.body.from + f.body.stopAfter > from && f.body.from + f.body.stopAfter < through)
      return bodyReachSafeV105(f, c, from, f.body.from + f.body.stopAfter) && bodyReachSafeV105(f, c, f.body.from + f.body.stopAfter, through);
    if (c.stopAfter !== undefined && c.from + c.stopAfter > from && c.from + c.stopAfter < through)
      return bodyReachSafeV105(f, c, from, c.from + c.stopAfter) && bodyReachSafeV105(f, c, c.from + c.stopAfter, through);
    const a = poseV105(f, from)!, b = poseV105(f, through)!, dt = through - from,
      sa = athleticActiveV115(f,from)?f.athleticV115!.sampleAtElapsedSeconds(from).shoulderVelocity:add(velocityAt(f.body, from), v(0, -(f.postureV105!.crouchTo-f.postureV105!.crouchFrom) / Math.max(f.postureV105!.through-f.postureV105!.from, 1e-30), 0)),
      sb = athleticActiveV115(f,from)?add(sa,add(mul(f.athleticV115!.sampleAtElapsedSeconds(from).shoulderAcceleration,dt),mul(f.athleticV115!.sampleAtElapsedSeconds(from).shoulderJerk,.5*dt*dt))):add(velocityAt(f.body, through), v(0, sa.y-velocityAt(f.body, from).y, 0)),
      controls = [sub(at(c, from), a.shoulder), sub(add(at(c, from), mul(velocityAt(c, from), dt/3)), add(a.shoulder, mul(sa, dt/3))),
        sub(sub(at(c, through), mul(velocityAt(c, through), dt/3)), sub(b.shoulder, mul(sb, dt/3))), sub(at(c, through), b.shoulder)],
      yawSpan = athleticActiveV115(f,from)?0:Math.abs(f.postureV105!.yawTo-f.postureV105!.yawFrom), rear = -m.rearReachFraction*m.armReachMeters*Math.cos(yawSpan/2),
      rounding = 1024*Number.EPSILON*Math.max(1,m.armReachMeters,norm(a.shoulder),norm(b.shoulder)),
      bound = Math.max(...controls.map(norm)), safe = bound <= m.armReachMeters+rounding
        && controls.every(d => d.x*a.forward.x+d.z*a.forward.z >= rear-rounding && d.x*b.forward.x+d.z*b.forward.z >= rear-rounding);
    if (safe) bodyGeometryV105.maximumCertifiedArmLengthMeters = Math.max(bodyGeometryV105.maximumCertifiedArmLengthMeters,bound);
    else bodyGeometryV105.reachProofRejectCount++;
    return safe;
  };
  const shifted = (c: Curve, offset: Vec3, velocity = v()): Curve => ({ ...c, p: add(c.p, offset), velocity: add(c.velocity, velocity),
    ...(c.stopAfter !== undefined ? { continuingVelocity: add(c.continuingVelocity ?? v(), velocity) } : {}) });
  const actualHipCurveV105 = (f: Fielder): Curve => {
    if(athleticActiveV115(f,f.body.from))return f.body;
    if (!f.postureV105) return f.body;
    const p = f.postureV105, dt = p.through-p.from, rate = dt>0 ? (p.crouchTo-p.crouchFrom)/dt : 0,
      current = sampleLiveFielderPostureV105(p,f.body.from).crouchMeters;
    return shifted(f.body,v(0,-.65*current,0),v(0,-.65*rate,0));
  };
  const stopPoint = (c: Curve, t: number, acceleration: number) => {
    const speed = norm(velocityAt(c, t)); return add(at(c, t), mul(velocityAt(c, t), speed / (2 * acceleration)));
  };
  const targetInside = (p: Vec3, radius: number) => {
    const d = flat(sub(p, fenceCenter)), length = norm(d);
    return length <= radius ? p : add(fenceCenter, add(mul(d, radius / length), v(0, p.y - fenceCenter.y, 0)));
  };
  const throwOffset = (f: Fielder, position: Vec3, target: Vec3,style:'hand_throw'|'glove_toss'='hand_throw') => {
    if(style==='glove_toss')return liveGloveTossOffsetV110({position,bodyModelV105:f.spec.bodyModelV105},target);
    if (f.spec.bodyModelV105) return liveFielderThrowOffsetV105(f.spec.bodyModelV105, position, target);
    const direction = flat(sub(target, position)), length = norm(direction), model = LIVE_FIELD_TEST_MODEL_V1.throwHand,
      desired = add(mul(direction, model.forwardMeters / Math.max(length, 1e-30)), v(0, model.heightAboveHipMeters, 0));
    return mul(desired, Math.min(1, f.spec.gloveReachMeters / norm(desired)));
  };
  let motorBoundaryFailure: unknown = null;
  const bodyAuthorityV120=Object.freeze({}),bodyCommandCacheV120=new Map<string,LiveFieldCommitmentV1>(),clearanceOptionCacheV120=new Map<string,boolean>();
  let bodyPlanRevisionV120=0;
  const athleticSafetyV120:{elapsedSeconds:number;playerId:string;kind:string;reason:string;checkedIntervals:number}[]=[];
  const recordSafetyV120=(elapsedSeconds:number,playerId:string,kind:string,reason:string,checkedIntervals=0)=>{
    if(athleticSafetyV120.length===256)athleticSafetyV120.shift();athleticSafetyV120.push({elapsedSeconds,playerId,kind,reason,checkedIntervals});
  };
  // A braking continuation is an executable fallback, not a forecast of what
  // another player will choose. Later motors are tested against airborne paths.
  const bodyCommandV120=(f:Fielder,t:number,end:number,override?:Readonly<{curve:Curve;through:number}>,action?:LiveFielderAthleticPlanV115):LiveFieldCommitmentV1|null=>{
    const model=f.spec.bodyModelV105;if(!model)return null;
    const key=JSON.stringify([f.spec.playerId,t,end,action?.kind,action?.fromSeconds,action?.throughSeconds,override]);
    const cached=bodyCommandCacheV120.get(key);if(cached)return cached;
    const from=action?.fromSeconds??t,through=Math.max(end,action?.throughSeconds??end),cuts=[from,through],pieces:{from:number;through:number;curve:Curve}[]=[];
    const append=(a:number,b:number,c:Curve)=>{
      if(b<=a)return;const stop=c.stopAfter===undefined?null:c.from+c.stopAfter;
      if(stop!==null&&stop>a&&stop<b){append(a,stop,c);append(stop,b,c);return;}
      pieces.push({from:a,through:b,curve:c});
    };
    if(action){
      cuts.push(...action.boundaries.filter(b=>b>from&&b<through));cuts.sort((a,b)=>a-b);
      for(let i=1;i<cuts.length;i++)if(cuts[i]>cuts[i-1])append(cuts[i-1],cuts[i],action.curveAtElapsedSeconds(cuts[i-1]));
    }else{
      const gate=override?Math.min(through,Math.max(t,override.through)):t;
      if(override)append(t,gate,override.curve);
      const position=override?at(override.curve,gate):at(f.body,t),velocity=override?velocityAt(override.curve,gate):velocityAt(f.body,t),speed=norm(flat(velocity)),
        brake:Curve={from:gate,p:position,velocity,acceleration:speed?mul(flat(velocity),-f.locomotion.brakingMps2/speed):v(),stopAfter:speed/f.locomotion.brakingMps2};
      append(gate,through,brake);
    }
    const segments:LiveBodyBezierSegmentV1[]=pieces.map(({from:a,through:b,curve:c})=>{
      const after=c.stopAfter!==undefined&&a>=c.from+c.stopAfter,local=a-c.from-(after?c.stopAfter!:0),
        jerk=after?c.continuingJerk??v():c.jerk??v(),acceleration=add(after?c.continuingAcceleration??v():c.acceleration,mul(jerk,local)),
        p=at(c,a),velocity=velocityAt(c,a),dt=b-a,
        p1=add(p,mul(velocity,dt/3)),p2=add(p,add(mul(velocity,2*dt/3),mul(acceleration,dt*dt/6))),
        p3=add(p,add(mul(velocity,dt),add(mul(acceleration,.5*dt*dt),mul(jerk,dt*dt*dt/6))));
      return{fromSeconds:a,throughSeconds:b,controls:[p,p1,p2,p3]};
    });
    const command=readLiveFieldCommitmentV1({schemaVersion:1,actorId:f.spec.playerId,
      commandId:f.spec.playerId+':'+(action?'athletic:'+tick(action.fromSeconds):'motor:'+tick(t)),revision:action?1:bodyPlanRevisionV120,
      clock:{originTick,ticksPerSecond:tps},worldRevision:bodyPlanRevisionV120,fromSeconds:from,throughSeconds:through,fromTick:tick(from),throughTick:tick(through),
      kind:action?'athletic':'motor',bodyModel:model,bodyRadiusMeters:LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters,gloveRadiusMeters:f.spec.gloveRadiusMeters,
      extraFootReachMeters:action?.kind==='jump'?Math.max(0,action.sampleAtElapsedSeconds(action.airborneSeconds).position.y-action.sampleAtElapsedSeconds(action.fromSeconds).position.y):0,
      segments});
    bodyCommandCacheV120.set(key,command);return command;
  };
  const clearanceInputV120=(t:number,end:number,candidate?:Readonly<{fielder:Fielder;action:LiveFielderAthleticPlanV115}>,
    overrides?:ReadonlyMap<Fielder,Readonly<{curve:Curve;through:number}>>,focusActorId?:string):LiveAthleticClearanceInputV1|null=>{
    const commands=defenders.map(f=>bodyCommandV120(f,t,end,overrides?.get(f),candidate?.fielder===f?candidate.action:athleticActiveV115(f,t)?f.athleticV115:undefined));
    if(commands.some(c=>c===null))return null;
    return{scope:bodyAuthorityV120,worldRevision:bodyPlanRevisionV120,clock:{originTick,ticksPerSecond:tps},fromSeconds:t,throughSeconds:end,
      commands:commands as LiveFieldCommitmentV1[],expectedActorIds:defenders.map(f=>f.spec.playerId),fence:{center:{x:fenceCenter.x,z:fenceCenter.z},radiusMeters:fenceRadius},
      ...(focusActorId===undefined?{}:{focusActorId})};
  };
  const respectsAirborneV120=(f:Fielder,curve:Curve,t:number,through:number)=>{
    if(!individualV118||!defenders.every(a=>a.spec.bodyModelV105))return true;
    const active=defenders.filter(a=>a!==f&&athleticActiveV115(a,t));if(!active.length)return true;
    const end=Math.max(...active.map(a=>a.athleticV115!.throughSeconds)),key=JSON.stringify([f.spec.playerId,t,through,curve,end]);
    const cached=clearanceOptionCacheV120.get(key);if(cached!==undefined)return cached;
    const q=clearanceInputV120(t,end,undefined,new Map([[f,{curve,through}]]),f.spec.playerId),proof=q?certifyLiveAthleticClearanceV1(q):null,
      safe=!!q&&proof?.kind==='safe'&&validateLiveAthleticClearanceV1(proof,q);
    clearanceOptionCacheV120.set(key,safe);return safe;
  };
  const athleticDecisionsV115:{playerId:string;kind:'jump'|'dive';fromSeconds:number;interceptSeconds:number;point:Vec3;throughSeconds:number}[]=[];
  // Candidate actions use the delayed sensor forecast. The actual hand motor,
  // collision, retention and landing still decide whether a catch occurs.
  const athleticCandidateV115=(f:Fielder,prediction:NonNullable<ReturnType<typeof forecast>>,t:number)=>{
    const m=f.spec.bodyModelV105,profile=f.spec.athleticProfileV115,pose=poseV105(f,t);
    if(!m||!profile||!pose||pose.crouchMeters!==0||athleticActiveV115(f,t)||t<(f.athleticAttemptAfterV115??0)
      ||t<start+responseSeconds(f)||Math.abs(velocityAt(f.body,t).y)>1e-8)return null;
    f.athleticAttemptAfterV115=t+.08;
    const position=at(f.body,t),velocity=velocityAt(f.body,t),near=prediction.prediction.observedPosition;
    if(distance(flat(position),flat(near))>f.spec.topSpeedMps*1.15+m.armReachMeters+2)return null;
    const candidates: {action:LiveFielderAthleticPlanV115;eta:number;point:Vec3;gap:number}[]=[];
    for(const kind of ['jump','dive'] as const){
      // A takeoff spans several control steps and may cross a support-speed
      // band. Its constant push must fit every band, not only the initial one.
      const push=Math.min(profile.divePushMps,Math.max(0,f.spec.topSpeedMps-norm(flat(velocity)))*.8,Math.min(...f.locomotion.propulsionBands.map(b=>b.accelerationMps2))*.12*.8),
        action=createLiveFielderAthleticV115({kind,fromSeconds:t,position,velocity,forward:pose.forward,body:m,profile:{...profile,divePushMps:push},
          gravityMps2:input.physics.ground.gravityMps2,frictionCoefficient:Math.min(Math.max(.05,input.physics.ground.material.slidingFriction*2.5),f.locomotion.brakingMps2/input.physics.ground.gravityMps2)});
      if(!action)continue;
      for(let h=.12;h<=Math.min(1.1,action.landedSeconds-t,prediction.prediction.maximumSeconds);h+=.04){
        const caution=f.spec.fieldingCognition?.pursuitCostWeight??1;
        if(prediction.intercepted&&prediction.eta<=h+.02*caution)continue;
        const point=prediction.prediction.sample(h).position,s=action.sampleAtElapsedSeconds(t+h),delta=sub(point,s.pose.shoulder),
          gap=liveFielderReachMarginV105(m,s.pose.shoulder,s.pose.forward,point);
        if(kind==='jump'&&point.y<m.shoulderHeightMeters+m.armReachMeters*.8||kind==='dive'&&point.y>m.shoulderHeightMeters*.8)continue;
        if(gap<.04*Math.max(1,caution)||norm(delta)>m.armReachMeters*.95)continue;
        // Preserve the complete landing corridor, including a reachable reserve
        // for teammates. Reject before takeoff rather than brake in the air.
        const legacyClear=()=>action.boundaries.every(end=>{
          const from=action.boundaries.filter(b=>b<end).at(-1)??t,c=action.curveAtElapsedSeconds(from),dt=end-t,
            pad=LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters+m.armReachMeters+m.heightMeters*.3;
          return curveInside(c,from,end,fenceRadius-pad,0)&&defenders.every(other=>other===f
            ||distance(flat(action.sampleAtElapsedSeconds(end).position),flat(at(other.body,t)))>pad+LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters+other.spec.topSpeedMps*dt);
        });
        const q=individualV118?clearanceInputV120(t,action.throughSeconds,{fielder:f,action}):null,
          proof=q?certifyLiveAthleticClearanceV1(q):null,
          clear=q?proof?.kind==='safe'&&validateLiveAthleticClearanceV1(proof,q):legacyClear();
        if(individualV118&&proof?.kind!=='safe')recordSafetyV120(t,f.spec.playerId,proof?.kind??'unknown',proof?.reason??'legacy_body_model_guard',proof?.checkedIntervals??0);
        if(clear)candidates.push({action,eta:h,point,gap});
        break;
      }
    }
    return candidates.sort((a,b)=>a.eta-b.eta+(a.action.kind==='dive'?.06:0)-(b.action.kind==='dive'?.06:0))[0]??null;
  };
  let previousRoles: readonly LiveFieldRoleV1[] = [], previousHandlerId: string | null = null;
  const plan = (t: number, plannedThrough: number) => {
    let through=plannedThrough;
    bodyPlanRevisionV120++;bodyCommandCacheV120.clear();clearanceOptionCacheV120.clear();
    const newAthleticsV120=new Map<Fielder,{previous:LiveFielderAthleticPlanV115|undefined;action:LiveFielderAthleticPlanV115;eta:number;point:Vec3}>();
    observe(t);
    if(individualV118&&possession&&!pendingCatch&&throwTarget&&releaseAt!==null
      &&throwTarget.effort.releaseStyleV110==='hand_throw'&&gloveTossCapabilitiesV110.has(possession)
      &&t<custodySince+effectiveTransferSeconds(possession)&&t>throwTarget.effort.from
      &&t>=(throwTarget.tossReviewAfterV118??0)){
      const target=throwTarget,f=possession;
      target.tossReviewAfterV118=t+.12;
      // The hand can settle after a ground catch while an ordinary transfer is
      // still pending. Reconsider the same recipient with the current measured
      // hand boundary; an initially unavailable certificate is not permanent.
      const receiverReady=knownArrivalV120(f,target.receiver,t,target.receiverPoint,field.baseTouchRadiusMeters??.28,'receiver'),
        action=planLiveTransferActionV110({releasePosition:add(at(f.body,t),throwOffset(f,at(f.body,t),target.point)),bodyVelocity:v(),
          capacityMps:f.spec.throwSpeedMps,spin:f.spec.throwSpinRadPerSecond??v(),target:target.point,physics:commandComparisonPhysicsV113,
          remainingTransferSeconds:Math.max(0,custodySince+effectiveTransferSeconds(f)-t),handPreparationSeconds:0,
          chargeElapsedSeconds:Math.max(0,t-(custodyChargeFromV103??t)),
          ...(f.spec.throwEffortBuildSecondsV103===undefined?{}:{throwEffortBuildSecondsV103:f.spec.throwEffortBuildSecondsV103}),
          receiverReadySeconds:receiverReady,deadlineSeconds:Math.max(0,target.effort.runnerDeadlineAtSeconds-t),preferStrongestFeasibleV103:true},
          transferActorV110(f,t),2,true,true);
      if(action.kind==='planned'&&action.releaseStyleV110==='glove_toss'
        &&t+action.releaseDelaySeconds<releaseAt&&t+action.controlSeconds<=target.effort.plannedControlAtSeconds+.025){
        throwEffortCancellationsV103.push({playerId:f.spec.playerId,from:t,commandFrom:target.effort.from,reason:'earlier_physical_glove_feed_v118'});
        const command:ThrowEffortCommandV103={...target.effort,from:t,chargeFrom:t,commandIdV118:'throw:'+f.spec.playerId+':'+throwEffortCommandsV103.length,
          readyAt:t+action.chargeSeconds,effort:action.effort,commandSpeedMps:action.commandSpeedMps,capacitySpeedMps:action.capacityMps,
          fullChargeSeconds:action.fullChargeSecondsV110,requiredChargeSeconds:action.chargeSeconds,plannedFlightSeconds:action.flightSeconds,
          plannedArrivalAtSeconds:t+action.releaseDelaySeconds+action.flightSeconds,plannedControlAtSeconds:t+action.controlSeconds,
          receiverReadyAtSeconds:t+receiverReady,reason:action.selectionReason,releaseStyleV110:action.releaseStyleV110,outputSearchLimitApplied:action.outputSearchLimitApplied};
        custodyChargeFromV103=t;throwEffortCommandsV103.push(command);throwTarget={...target,issuedFrom:at(f.glove,t),effort:command};
        handPreparation=null;releaseAt=Math.max(through,command.readyAt);runnerCueRevisionV95++;runnerCueAtV95=t;
        if(input.recordDecisionTraceV118)decisionTraceV118.record(t,f.spec.playerId,{event:'throw_revised',reason:'earlier_physical_glove_feed_v118',
          previousCommandId:target.effort.commandIdV118,commandId:command.commandIdV118,command,observationSeconds:knowledgeV118(f,t).observationElapsedSeconds},undefined,'execution');
      }
    }
    if (!possession && throwTarget) {
      const seen = seenBy(throwTarget.receiver, t), target = throwTarget.point;
      const origin = throwTarget.releasedFrom, line = origin ? sub(target, origin) : null;
      if (seen && origin && line && throwTarget.releasedAt !== undefined && seen.phase !== 'possessed' && seen.t >= throwTarget.releasedAt
        && (seen.position.x - origin.x) * line.x + (seen.position.z - origin.z) * line.z > line.x * line.x + line.z * line.z
        && (target.x - seen.position.x) * seen.velocity.x + (target.z - seen.position.z) * seen.velocity.z < 0
        && distance(flat(seen.position), flat(target)) > (throwTarget.receiver.spec.bodyModelV105 ? Math.max(0,horizontalReachV105(throwTarget.receiver,t,target.y)) : throwTarget.receiver.spec.gloveReachMeters)) {
        throwTargetCancellations.push({ elapsedSeconds: t, base: throwTarget.base, receiverPlayerId: throwTarget.receiver.spec.playerId,
          releasedAt: throwTarget.releasedAt ?? null, seenAt: seen.t, distanceToTargetMeters: distance(flat(seen.position), flat(target)) });
        throwTarget = null;
      }
    }
    const forecasts = defenders.map(f => ({ f, predicted: forecast(f, t) }));
    let athleticHandler=defenders.find(f=>athleticActiveV115(f,t));
    if(!individualV118&&!athleticHandler&&!dead&&!possession&&!pendingCatch&&!throwTarget){
      const attempts=forecasts.filter(x=>x.predicted&&x.f.spec.athleticProfileV115)
        .sort((a,b)=>distance(flat(at(a.f.body,t)),flat(a.predicted!.prediction.observedPosition))-distance(flat(at(b.f.body,t)),flat(b.predicted!.prediction.observedPosition)))
        .slice(0,2).flatMap(x=>{const candidate=athleticCandidateV115(x.f,x.predicted!,t);return candidate?[{f:x.f,...candidate}]:[];})
        .sort((a,b)=>a.eta*(a.f.spec.fieldingCognition?.pursuitCostWeight??1)-b.eta*(b.f.spec.fieldingCognition?.pursuitCostWeight??1));
      const best=attempts[0];if(best){best.f.athleticV115=best.action;athleticHandler=best.f;
        best.f.athleticAttemptAfterV115=best.action.throughSeconds+.2;
        athleticDecisionsV115.push({playerId:best.f.spec.playerId,kind:best.action.kind,fromSeconds:t,interceptSeconds:t+best.eta,point:best.point,throughSeconds:best.action.throughSeconds});}
    }
    for(const f of defenders)if(athleticActiveV115(f,t))through=Math.min(through,f.athleticV115!.boundaries.find(b=>b>t)??through);
    controlThrough=through;
    if (!dead) {
      const seen = defenders.map(f => seenBy(f, t)).filter((h): h is typeof history[number] => h !== null)
        .sort((a, b) => b.t - a.t)[0],
        prediction = seen && !hasThrown && !possession && !pendingCatch && firstGroundContactSeconds === null && firstFielderTouchSeconds === null
          ? predictObservation(seen, t, 0) : null,
        candidate = prediction ? predictLiveDefensiveOpportunityV1({ availableAtTick: tick(t), observationTick: prediction.observationTick,
          ballRadiusMeters: input.physics.ground.radiusM, home: base(0), fenceCenter, fenceRadiusMeters: fenceRadius,
          fenceHeightMeters: field.fenceHeightMeters, prediction,
          fielders: defenders.map(f => ({ position: at(f.body, t), velocity: velocityAt(f.body, t),
            topSpeedMps: f.spec.topSpeedMps, accelerationMps2: f.spec.accelerationMps2,
            gloveReachMeters: f.spec.bodyModelV105 ? f.spec.bodyModelV105.armReachMeters + Math.abs(f.spec.bodyModelV105.shoulderHeightMeters - f.spec.bodyModelV105.hipHeightMeters) : f.spec.gloveReachMeters, gloveRadiusMeters: f.spec.gloveRadiusMeters,
            bodyRadiusMeters: LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters })) }) : null;
      const prior = defensiveOpportunity;
      if (!candidate) { decisiveCandidate = null; defensiveOpportunity = null; }
      else {
        decisiveCandidate ??= { tick: tick(t), observationTick: candidate.observationTick };
        defensiveOpportunity = tick(t) - decisiveCandidate.tick >= Math.ceil(LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1.confirmationSeconds * tps)
          && candidate.observationTick > decisiveCandidate.observationTick ? candidate : null;
      }
      if (Boolean(prior) !== Boolean(defensiveOpportunity)) defensiveOpportunityTransitions.push({ tick: tick(t), elapsedSeconds: t, opportunity: defensiveOpportunity });
    }
    if(athleticHandler){defensiveOpportunity=null;decisiveCandidate=null;}
    const selection = selectLiveFieldHandlerV1({ candidates: forecasts.flatMap(({ f, predicted }) => {
      if (!predicted) return [];
      const route = flat(sub(predicted.point, at(f.body, t))), incoming = flat(predicted.prediction.sample(Math.min(predicted.eta, predicted.prediction.maximumSeconds)).velocity),
        arrivalSeconds = liveFieldArrivalSecondsV1(roleActor(f, t), predicted.point, f.spec.bodyModelV105 ? Math.max(0, horizontalReachV105(f, t, predicted.point.y)) * .65 : f.spec.gloveReachMeters),
        chasing = Math.max(0, (route.x * incoming.x + route.z * incoming.z) / Math.max(norm(route) * norm(incoming), 1e-30));
      return [{
      playerId: f.spec.playerId, intercepted: predicted.intercepted, interceptSeconds: predicted.eta,
      arrivalSeconds, approachPenaltySeconds: predicted.point.y > input.physics.ground.radiusM + .2
        ? chasing * arrivalSeconds * LIVE_FIELD_TEST_MODEL_V1.catchApproachCostFraction : 0,
      travelDistanceMeters: distance(flat(at(f.body, t)), flat(predicted.point)),
      ...(f.spec.fieldingCognition?.pursuitCostWeight === undefined ? {} : { pursuitCostWeight: f.spec.fieldingCognition.pursuitCostWeight }) }]; }),
      previousPlayerId: previousHandlerId });
    const incumbent = forecasts.find(x => x.f.spec.playerId === previousHandlerId),
      best = forecasts.find(x => x.f.spec.playerId === selection.playerId), retained = best?.f;
    // A later, certain pickup must not make a nearby player abandon a close
    // chance before it arrives. This only issues an ordinary bounded pursuit;
    // the downstream actual hand contact/retention still decides the outcome.
    const nearAttempt = !individualV118&&!hasThrown && !possession && !pendingCatch && !throwTarget && !defensiveOpportunity
      ? forecasts.filter(x => x.f !== retained && x.predicted?.attempt
        && x.predicted.attempt.eta + x.predicted.attempt.latenessSeconds < (best?.predicted?.eta ?? Infinity))
        .sort((a,b) => a.predicted!.attempt!.eta + a.predicted!.attempt!.latenessSeconds * (a.f.spec.fieldingCognition?.pursuitCostWeight ?? 1)
          - b.predicted!.attempt!.eta - b.predicted!.attempt!.latenessSeconds * (b.f.spec.fieldingCognition?.pursuitCostWeight ?? 1))[0] : undefined;
    if (nearAttempt?.predicted?.attempt) nearAttempt.predicted = { ...nearAttempt.predicted,
      point: nearAttempt.predicted.attempt.point, eta: nearAttempt.predicted.attempt.eta, intercepted: false };
    const handler = possession ?? pendingCatch?.fielder ?? throwTarget?.receiver ?? athleticHandler ?? nearAttempt?.f ?? retained ?? defenders[0];
    const handlerPrediction = forecasts.find(x => x.f === handler)?.predicted;
    if (handler.spec.playerId !== previousHandlerId) {
      const source = possession ? 'possession' : pendingCatch ? 'pending_catch' : throwTarget ? 'throw_receiver'
        : nearAttempt?.f === handler ? 'forecast_attempt'
        : retained && retained === incumbent?.f ? 'forecast_retained' : best?.f === handler ? 'forecast_best' : 'fallback_first';
      roleTransitions.push({ elapsedSeconds: t, previousHandlerId, handlerId: handler.spec.playerId, source,
        intercepted: handlerPrediction?.intercepted ?? null, eta: handlerPrediction?.eta ?? null,
        targetPoint: handlerPrediction?.point ?? null, observedPosition: handlerPrediction?.prediction.observedPosition ?? null,
        reactionGatedCount: forecasts.filter(x => !x.predicted).length });
    }
    previousHandlerId = handler.spec.playerId;
    let holderTask: { point: Vec3; intent: Fielder['intent']; base: BaseballBase | null } = { point: at(handler.body, t), intent: 'hold', base: null };
    if ((possession || pendingCatch) && !throwTarget && releaseAt === null) {
      const activeObligations = knownForceObligationsV118(handler,t);
      const nearForcedBase = activeObligations
        .map(o => {
          const r = runners.find(x => x.spec.runnerId === o.runnerId)!, b = base(o.targetBase),
            runnerSec = runnerArrivalSeconds(r, o.targetBase, t),
            holderSec = knownArrivalV120(handler,handler,t,b,field.baseTouchRadiusMeters??.28),
            otherSec = Math.min(...defenders.filter(f => f !== handler).map(f => individualV118?knownArrivalV120(handler,f,t,b,field.baseTouchRadiusMeters??.28):liveFieldArrivalSecondsV1(knownActorV118(handler,f,t), b, field.baseTouchRadiusMeters ?? .28))),
            dist = distance(flat(at(handler.body, t)), flat(b));
          return { base: o.targetBase, point: b, dist, holderSec, otherSec, runnerSec };
        })
        .filter(c => c.holderSec < c.runnerSec && (c.dist <= 3.5 || (c.dist <= 7.5 && c.runnerSec - c.holderSec > .45) || c.holderSec <= c.otherSec + .35 || handler.targetBase === c.base))
        .sort((a, b) => a.holderSec - b.holderSec)[0];
      if (nearForcedBase) {
        holderTask = { point: nearForcedBase.point, intent: 'base_cover', base: nearForcedBase.base };
      }
    }
    const threats: { base: BaseballBase; arrivalSeconds: number }[] = [];
    if(!individualV118)for (const runner of runners.filter(r => !r.retired && !r.scored)) {
      const n = runner.retouchBase ?? runner.leg?.to ?? deriveCurrentForceObligations(force).find(o => o.runnerId === runner.spec.runnerId)?.targetBase ?? null;
      if (n === null) continue;
      const eta = runnerArrivalSeconds(runner, n as BaseballBase, t);
      threats.push({ base: n as BaseballBase, arrivalSeconds: eta });
      // Protect the next advance as well, without reserving every unthreatened
      // base. The estimate is tactical evidence, never a runner arrival fact.
      // Cover the possible next advance without automatically THROWING there.
      // Out-target commitment above separately requires observed advancement.
      if (n < 4 && runner.retouchBase === null) threats.push({ base: (n + 1) as BaseballBase,
        arrivalSeconds: eta + estimateLiveRunnerLegSecondsV1(distance(flat(base(n)), flat(base(n + 1))), runner.spec.topSpeedMps, runner.spec.accelerationMps2) });
    }
    const individualAssignmentV118=()=>{
      const roles:LiveFieldRoleV1[]=[];
      for(const f of defenders){
        const seen=knowledgeV118(f,t),predicted=forecasts.find(x=>x.f===f)?.predicted,
          attempt=predicted?.attempt&&predicted.attempt.eta+predicted.attempt.latenessSeconds<predicted.eta?predicted.attempt:null,
          pickup=predicted?{point:attempt?.point??predicted.point,eta:attempt?.eta??predicted.eta,
            intercepted:attempt?false:predicted.intercepted,latenessSeconds:attempt?.latenessSeconds}:null,
          targets=outTargets(f,t),knownThreats=targets.map(o=>({base:o.targetBase,arrivalSeconds:runnerArrivalSeconds(runners.find(r=>r.spec.runnerId===o.runnerId)!,o.targetBase,t,f)})),
          pickupWindows:LivePursuitWindowV1[]=pickup?[{family:'direct',...pickup,arrivalSeconds:Math.max(0,pickup.eta+(pickup.latenessSeconds??0))}]:[];
        if(pickup&&predicted&&seen.ball?.possessedBy===null){
          const own=roleActor(f,t),wait=Math.max(0,start+responseSeconds(f)-t),body=at(f.body,t),
            floor=Math.max(f.spec.gloveRadiusMeters,input.physics.ground.radiusM);
          for(const [family,offset]of [['following',.24],['recovery',.64]] as const){
            const eta=pickup.eta+offset;if(eta>predicted.prediction.maximumSeconds)continue;
            const point=predicted.prediction.sample(eta).position;
            if(!pointInside(point,fenceRadius-input.physics.ground.radiusM))continue;
            const reach=f.spec.bodyModelV105?horizontalReachV105(f,t,Math.max(floor,point.y)):f.spec.gloveReachMeters,
              arrivalSeconds=liveFieldArrivalSecondsV1({...own,remainingReactionSeconds:wait},point,Math.max(0,reach)*.65),
              posture=f.spec.bodyModelV105?Math.abs(liveFielderDesiredCrouchV105(f.spec.bodyModelV105,body,point)-(poseV105(f,t)?.crouchMeters??0))/f.spec.bodyModelV105.postureSpeedMps:0,
              late=Math.max(arrivalSeconds,wait+posture)-eta;
            pickupWindows.push({family,point,eta,arrivalSeconds:Math.max(arrivalSeconds,wait+posture),intercepted:reach>=0&&late<=0,latenessSeconds:Math.max(0,late)});
          }
        }
        const
          result=evaluateLiveFieldDecisionV1({elapsedSeconds:t,observationSeconds:seen.observationElapsedSeconds,
            self:roleActor(f,t),others:defenders.filter(a=>a!==f).map(a=>knownActorV118(f,a,t)),bases:{1:base(1),2:base(2),3:base(3),4:base(4)},
            ball:seen.ball?.position??null,ballVelocity:seen.ball?.velocity??v(),possessionPlayerId:seen.ball?.possessedBy??null,
            pickup,pickupWindowsV120:pickupWindows,threats:knownThreats,received:adviceV118(f,t),previous:previousRoles.find(r=>r.playerId===f.spec.playerId),
            cautious:f.spec.fieldingCognition?.cautious,
            ...((f===possession||f===pendingCatch?.fielder)?{ownTask:{playerId:f.spec.playerId,taskId:'holder',point:holderTask.point,intent:holderTask.intent,targetBase:holderTask.base}}:{})});
        roles.push(result.role);
        if(individualV118)lastIndividualDecisionV118.set(f.spec.playerId,{playerId:f.spec.playerId,tick:tick(t),
          observationSeconds:seen.observationElapsedSeconds,basis:'individual_perception',decision:result});
        const pursuitChoice=result.pursuit?.options.find(option=>option.taskId===result.role.taskId);
        if(individualV118&&pursuitChoice&&result.role.intent==='intercept'){
          const x=forecasts.find(x=>x.f===f)!;x.predicted={...x.predicted!,point:pursuitChoice.point,eta:pursuitChoice.eta,intercepted:pursuitChoice.intercepted};
        }
        if(input.recordDecisionTraceV118)decisionTraceV118.record(t,f.spec.playerId,{basis:'individual_perception',
          observationSeconds:seen.observationElapsedSeconds,observationTick:seen.observationTick,informationSource:'delayed_sensor_and_received_callouts',
          selected:result.role,candidates:result.candidates,advice:result.advice,pursuit:result.pursuit??null,reason:result.reason},
          result.role.taskId+':'+result.reason+':'+Math.floor((seen.observationElapsedSeconds??start)/.2),individualV118?'decision':'strategy');
      }
      return {roles,targets:new Map(defenders.map(f=>{const r=roles.find(r=>r.playerId===f.spec.playerId)!;
        return [f,{point:r.point,intent:r.intent,base:r.targetBase}] as const;}))};
    };
    const roleCostsV118:LiveFieldRoleCostDiagnosticV118[]|undefined=input.recordDecisionTraceV118?[]:undefined;
    const assignment = () => {
      if(individualV118)return individualAssignmentV118();
      const reservations: LiveFieldRoleV1[] = [];
      if (possession || pendingCatch) reservations.push({ playerId: handler.spec.playerId, taskId: 'holder',
        point: holderTask.point, intent: holderTask.intent, targetBase: holderTask.base });
      else if (throwTarget) reservations.push({ playerId: throwTarget.receiver.spec.playerId, taskId: 'receiver:' + throwTarget.base,
        point: throwTarget.receiverPoint, intent: throwTarget.intent, targetBase: throwTarget.intent === 'relay' ? null : throwTarget.base });
      else reservations.push({ playerId: handler.spec.playerId, taskId: 'handler', point: handlerPrediction?.point ?? at(handler.body, t),
        intent: 'intercept', targetBase: null });
      if (throwTarget && (possession || pendingCatch) && throwTarget.receiver !== handler)
        reservations.push({ playerId: throwTarget.receiver.spec.playerId, taskId: 'receiver:' + throwTarget.base,
          point: throwTarget.receiverPoint, intent: throwTarget.intent, targetBase: throwTarget.intent === 'relay' ? null : throwTarget.base });
      const seen = seenBy(handler, t), ball = possession || pendingCatch ? ballAt(t) : seen;
      const roles = assignLiveFieldRolesV1({ actors: defenders.map(f => roleActor(f, t)), bases: { 1: base(1), 2: base(2), 3: base(3), 4: base(4) },
        ballPosition: ball?.position ?? at(handler.body, t), ballVelocity: ball?.velocity ?? v(),
        ballPhase: possession || pendingCatch ? 'held' : throwTarget ? 'throw' : 'free',
        ...(throwTarget ? { activeThrow: { from: throwTarget.releasedFrom ?? throwTarget.issuedFrom, target: throwTarget.point } } : {}),
        pickupPoint: handlerPrediction?.point ?? at(handler.body, t), threats, reservations, previous: previousRoles },roleCostsV118);
      return { roles, targets: new Map(defenders.map(f => { const role = roles.find(r => r.playerId === f.spec.playerId)!;
        return [f, { point: role.point, intent: role.intent, base: role.targetBase }] as const; })) };
    };
    let planned = assignment(), assigned = planned.targets;
    if (possession && !pendingCatch && t < custodySince + effectiveTransferSeconds(possession) && releaseAt === null) {
      const oblig = deriveCurrentForceObligations(force)[0];
      holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: 'waiting_transfer',
        base: oblig?.targetBase ?? null,
        receiverDistanceToBaseMeters: oblig ? distance(flat(at(possession.body, t)), flat(base(oblig.targetBase))) : undefined });
    }
    // Select the intended receiver while transfer/recovery are still running.
    // This announces a target, never permission to release an unready hand.
    if (possession && !pendingCatch && releaseAt === null) {
      const arrive = (f: Fielder, target: Vec3) => knownArrivalV120(possession!,f,t,target,field.baseTouchRadiusMeters??.28),
        relayActorsV120=individualV118?defenders.map(f=>knownRelayActorV118(possession!,f,t)):null,
        recoveringKnowledgeV120=relayActorsV120?.some(a=>!!a.postActionV120),
        ownPostActionV120=knownPostActionV120(possession,possession,t),
        ownRecoveryWaitV120=Math.max(0,(ownPostActionV120?.knownAction.readySeconds??t)-t),
        ownReleaseBodyV120=ownRecoveryWaitV120>0?ownPostActionV120!.knownAction.position:at(possession.body,t);
      const targets = outTargets(), evaluateCandidate = (o: typeof targets[number]) => {
        const r = runners.find(r => r.spec.runnerId === o.runnerId)!, target = base(o.targetBase),
          receiver = individualV118?defenders.filter(f=>f!==possession).sort((a,b)=>{
            const received=adviceV118(possession!,t),cost=(f:Fielder)=>knownArrivalV120(possession!,f,t,target,0)
              +(received.some(m=>m.sourceId===f.spec.playerId&&m.role.intent==='intercept')?.3:0)
              -(received.some(m=>m.sourceId===f.spec.playerId&&m.role.intent==='base_cover'&&m.role.targetBase===o.targetBase)?.1:0);
            return cost(a)-cost(b)||a.spec.playerId.localeCompare(b.spec.playerId);
          })[0]:defenders.find(f => f !== possession && assigned.get(f)?.intent === 'base_cover' && assigned.get(f)?.base === o.targetBase)
            ?? defenders.filter(f => f !== possession).sort((a, b) => liveFieldArrivalSecondsV1(knownActorV118(possession!,a,t), target)
              - liveFieldArrivalSecondsV1(knownActorV118(possession!,b,t), target))[0],
          runnerSeconds = runnerArrivalSeconds(r, o.targetBase, t),
          preparation = createLiveBodyHandPreparationV105({ fromElapsedSeconds: t,
            initialOffset: add(sub(at(possession!.glove, t), at(possession!.body, t)),v(0,poseV105(possession!,t)?.crouchMeters??0,0)),
            initialRelativeVelocity: sub(velocityAt(possession!.glove, t), velocityAt(possession!.body, t)),
            targetOffset: throwOffset(possession!, ownReleaseBodyV120, target), maximumRelativeSpeedMps: possession!.spec.gloveSpeedMps,
            maximumReachMeters: possession!.spec.gloveReachMeters }, possession!.spec.bodyModelV105),
          // A non-force carry seeks the actual runner, not a bare bag. Using
          // the bag ETA after starting a tag pursuit made the holder reverse
          // toward that bag or prepare an unnecessary second throw.
          carrySeconds = o.forced || o.appeal || o.containment ? arrive(possession!, target)
            : knownArrivalV120(possession!,possession!,t,knownRunnerAtV118(r,t),tagReachV105(possession!,r,t)),
          receiverArriveSeconds = knownArrivalV120(possession!,receiver,t,target,field.baseTouchRadiusMeters??.28,'receiver'),
          holderDist = distance(flat(at(possession!.body, t)), flat(target)),
          chargeElapsedSeconds = custodyChargeFromV103 === null ? 0 : Math.max(0, t - Math.max(custodyChargeFromV103,custodySince+effectiveTransferSeconds(possession!))),
          remainingTransferSeconds = Math.max(0,custodySince+effectiveTransferSeconds(possession!)-t);
        const cacheKey = custodySince + ':' + possession!.spec.playerId + ':' + r.spec.runnerId + ':' + o.targetBase,
          cached = relayCache.get(cacheKey);
        let relayPlan: LiveRelayPlanV1 | null = null;
        if (holderDist > 3.5) {
          relayPlan = cached && !recoveringKnowledgeV120 && t - cached.at < .12 ? cached.plan : planLiveRelayV1({
            actors: relayActorsV120??defenders.map(f => ({ ...knownActorV118(possession!,f,t), glovePosition: at(f.glove, t), gloveVelocity: velocityAt(f.glove, t),
              gloveSpeedMps: f.spec.gloveSpeedMps, gloveReachMeters: f.spec.gloveReachMeters, gloveRadiusMeters: f.spec.gloveRadiusMeters,
        ...(f.spec.bodyModelV105 ? { bodyModelV105: f.spec.bodyModelV105, bodyPoseV105: poseV105(f, t) } : {}),
              transferSeconds: forecastTransferSecondsV101(f),...(gloveTossCapabilitiesV110.get(f)?{gloveTossV110:gloveTossCapabilitiesV110.get(f)!}:{}),
              ...(f.spec.throwEffortBuildSecondsV103 === undefined ? {} : { throwEffortBuildSecondsV103: f.spec.throwEffortBuildSecondsV103 }),
              ...(f.spec.throwDirectionStdRadians === undefined ? {} : { throwDirectionStdRadians: f.spec.throwDirectionStdRadians }),
              ...(f.spec.throwBackspinRadPerSecond === undefined ? {} : { throwBackspinRadPerSecond: f.spec.throwBackspinRadPerSecond }),
              ...(f.spec.throwSpinRadPerSecond === undefined ? {} : { throwSpinRadPerSecond: f.spec.throwSpinRadPerSecond }) })),
            holderPlayerId: possession!.spec.playerId, receiverPlayerId: receiver.spec.playerId, finalBase: o.targetBase,
            runnerId: r.spec.runnerId, target: add(target, v(0, receiver.spec.position.y, 0)), runnerArrivalSeconds: runnerSeconds,
            holderTransferRemainingSeconds: remainingTransferSeconds, holderChargeElapsedSecondsV103: chargeElapsedSeconds,
            // This controller's throw task brakes to hold. Do not count the
            // catch's running momentum as a free boost at the later release.
            holderReleaseBodyVelocityV110:v(),
            preferStrongestFeasibleV103: !o.containment, physics: commandComparisonPhysicsV113,
            excludedRelayPlayerIds: [...(relayVisited.get(r.spec.runnerId + ':' + o.targetBase) ?? [])],
            throwHandOffset: { forwardMeters: LIVE_FIELD_TEST_MODEL_V1.throwHand.forwardMeters,
              heightAboveHipMeters: LIVE_FIELD_TEST_MODEL_V1.throwHand.heightAboveHipMeters } },individualV118);
          if (!cached || relayPlan !== cached.plan) {
            relayCache.set(cacheKey, { at: t, plan: relayPlan });
            relayPlans.push({ elapsedSeconds: t, playerId: possession!.spec.playerId, runnerId: r.spec.runnerId, base: o.targetBase,
              kind: relayPlan.kind, receivers: relayPlan.legs.map(l => l.receiverPlayerId), readySeconds: relayPlan.readySeconds,
              marginSeconds: relayPlan.marginSeconds, aerodynamicSolveCount: relayPlan.diagnostics.aerodynamicSolveCount });
          }
        }
        // The relay planner already solves its direct leg. Only solve a separate
        // direct action for the near bag or a bounded-search/routine fallback.
        // No raw distance/capacity shortcut can certify a receiving time.
        let directAction: ReturnType<typeof planLiveTransferActionV110> | null = null;
        if (!relayPlan?.firstHop && relayPlan?.kind !== 'carry' && (preparation.kind === 'planned'||gloveTossCapabilitiesV110.has(possession!))) {
          const releasePosition = add(ownReleaseBodyV120, throwOffset(possession!, ownReleaseBodyV120, target)),
            point = add(target, v(0, receiver.spec.position.y, 0)), d = sub(point, releasePosition), h = Math.hypot(d.x, d.z),
            backspin = possession!.spec.throwBackspinRadPerSecond ?? 0,
            spin = possession!.spec.throwSpinRadPerSecond ?? (h > 0 ? v(-d.z / h * backspin, 0, d.x / h * backspin) : v());
          directAction = planLiveTransferActionV110({ releasePosition, bodyVelocity: v(),
            capacityMps: possession!.spec.throwSpeedMps, spin, physics: commandComparisonPhysicsV113, target: point,
            // Posture/hand preparation can advance during transfer. Charge
            // still starts only after transfer, matching the issued command.
            remainingTransferSeconds, handPreparationSeconds: Math.max(0,(preparation.kind==='planned'?preparation.durationSeconds:0)
              +(possession!.spec.bodyModelV105 ? liveFielderPreparationPostureSecondsV105(possession!.spec.bodyModelV105,poseV105(possession!,t),at(possession!.body,t),point) : 0)-remainingTransferSeconds), chargeElapsedSeconds,
            throwEffortBuildSecondsV103: possession!.spec.throwEffortBuildSecondsV103 ?? LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds,
            receiverReadySeconds: receiverArriveSeconds,
            ...(!o.containment ? { deadlineSeconds: Math.max(0, runnerSeconds - (receiver.spec.gloveRadiusMeters + input.physics.ground.radiusM) / receiver.spec.gloveSpeedMps),
              preferStrongestFeasibleV103: true } : {}) },ownRecoveryWaitV120>0?{...transferActorV110(possession!,t),position:ownReleaseBodyV120,
                glovePosition:add(ownReleaseBodyV120,sub(at(possession!.glove,t),at(possession!.body,t)))}:transferActorV110(possession!,t),2,preparation.kind==='planned',individualV118);
          if(directAction.kind==='planned'&&ownRecoveryWaitV120>directAction.releaseDelaySeconds){
            const controlSeconds=Math.max(ownRecoveryWaitV120+directAction.flightSeconds,receiverArriveSeconds),
              meetsDeadline=directAction.deadlineSeconds===null||controlSeconds<=directAction.deadlineSeconds;
            directAction={...directAction,releaseDelaySeconds:ownRecoveryWaitV120,controlSeconds,meetsDeadline};
          }
        }
        const receivingSeconds = relayPlan?.firstHop ? relayPlan.readySeconds
          : directAction?.kind === 'planned' ? directAction.controlSeconds + (receiver.spec.gloveRadiusMeters + input.physics.ground.radiusM) / receiver.spec.gloveSpeedMps : Infinity;
        // Receiving at a bag retires a force runner, but a non-force runner
        // must still be tagged. Include the receiving player's own transfer
        // and pursuit rather than comparing receipt against the holder's tag.
        const tagAfterReceipt = !o.forced && !o.appeal && !o.containment && Number.isFinite(receivingSeconds)
          ? forecastTransferSecondsV101(receiver) + liveFieldArrivalSecondsV1({ ...knownActorV118(possession!,receiver,t),
            position: v(target.x, receiver.spec.position.y, target.z), velocity: v(), remainingReactionSeconds: 0 },
          knownRunnerAtV118(r, t + receivingSeconds + forecastTransferSecondsV101(receiver)), tagReachV105(receiver, r, t)) : 0,
          receivingRetirementSeconds = receivingSeconds + tagAfterReceipt;
        return { runnerId: r.spec.runnerId, forced: o.forced, appeal: o.appeal, containment: o.containment, base: o.targetBase, receiver, relayPlan, margin: runnerSeconds - Math.min(carrySeconds, receivingRetirementSeconds), target,
          carrySeconds, receivingSeconds, directAction, runnerSeconds, receiverArriveSeconds,
          carryPreferred: carrySeconds <= receivingRetirementSeconds };
      };
      const candidates = targets.filter(o => !o.containment && !rejectedThrows.has(o.runnerId + ':' + o.targetBase))
        .map(evaluateCandidate).sort((a, b) => b.margin - a.margin || b.base - a.base);
      if (!candidates.some(c => c.margin > 0)) {
        for (const target of targets.filter(o => o.containment && !rejectedThrows.has(o.runnerId + ':' + o.targetBase))
          .sort((a, b) => a.targetBase - b.targetBase)) {
          const candidate = evaluateCandidate(target); candidates.push(candidate);
          if (candidate.margin > 0) break;
        }
      }
      // Compare complete force-out continuations, rather than always taking
      // the largest margin for a single out. Future receipts are hypotheses:
      // the next controller still replans after its actual physical catch.
      const doublePlayRoutes: LiveDoublePlayRouteV106[]=[];
      if((individualV118?knowledgeV118(possession!,t).world.knownContext.outs:input.outs+retiredCount)<2)for(const first of candidates.filter(c=>c.forced&&!c.appeal)){
        const after=deriveCurrentForceObligations(retireForceParticipant(individualV118?knownForceStateV118(possession!,t):force,first.runnerId)),
          firstSeconds=first.carryPreferred?first.carrySeconds:first.receivingSeconds,
          controller=first.carryPreferred?possession:first.receiver;
        if(!Number.isFinite(firstSeconds))continue;
        const origin=v(first.target.x,controller.spec.position.y,first.target.z),
          incoming=flat(sub(at(possession.body,t),origin)),length=norm(incoming),
          futurePose={crouchMeters:0,forward:length?mul(incoming,1/length):(individualV118?knownRelayActorV118(possession,controller,t).bodyPoseV105?.forward:poseV105(controller,t)?.forward)??v(0,0,-1)};
        // Retiring the batter at first removes the lead runner's force.
        // A receiver who can carry directly to that runner is also a real
        // two-out continuation; do not prefer an unnecessary two-throw chain.
        for(const second of candidates.filter(c=>c.runnerId!==first.runnerId&&!c.appeal
          &&!after.some(o=>o.runnerId===c.runnerId&&o.targetBase===c.base))){
          const runner=runners.find(r=>r.spec.runnerId===second.runnerId)!,transfer=forecastTransferSecondsV101(controller),
            tagPoint=knownRunnerAtV118(runner,t+firstSeconds+transfer),
            pursuit=liveFieldArrivalSecondsV1({...knownActorV118(possession!,controller,t),position:origin,velocity:v(),remainingReactionSeconds:0},
              tagPoint,tagReachV105(controller,runner,t)),controlSeconds=firstSeconds+transfer+pursuit;
          if(Number.isFinite(controlSeconds))doublePlayRoutes.push({firstRunnerId:first.runnerId,firstBase:first.base,
            secondRunnerId:second.runnerId,secondBase:second.base,firstMarginSeconds:first.margin,
            secondMarginSeconds:second.runnerSeconds-controlSeconds,controlSeconds});
        }
        for(const second of candidates.filter(c=>c.forced&&after.some(o=>o.runnerId===c.runnerId&&o.targetBase===c.base))){
          if(second.receiver===controller)continue;
          const target=add(second.target,v(0,second.receiver.spec.position.y,0)),offset=throwOffset(controller,origin,target),
            hand=createLiveBodyHandPreparationV105({fromElapsedSeconds:0,initialOffset:v(),initialRelativeVelocity:v(),targetOffset:offset,
              maximumRelativeSpeedMps:controller.spec.gloveSpeedMps,maximumReachMeters:controller.spec.gloveReachMeters},controller.spec.bodyModelV105);
          if(hand.kind!=='planned')continue;
          const posture=controller.spec.bodyModelV105?liveFielderPreparationPostureSecondsV105(controller.spec.bodyModelV105,futurePose,origin,target):0,
            d=sub(target,add(origin,offset)),horizontal=norm(flat(d)),backspin=controller.spec.throwBackspinRadPerSecond??0,
            spin=controller.spec.throwSpinRadPerSecond??(horizontal?v(-d.z/horizontal*backspin,0,d.x/horizontal*backspin):v()),
            acquisition=(second.receiver.spec.gloveRadiusMeters+input.physics.ground.radiusM)/second.receiver.spec.gloveSpeedMps,
            action=planLiveTransferActionV110({releasePosition:add(origin,offset),bodyVelocity:v(),capacityMps:controller.spec.throwSpeedMps,
              target,spin,physics:commandComparisonPhysicsV113,remainingTransferSeconds:forecastTransferSecondsV101(controller),
              handPreparationSeconds:Math.max(0,hand.durationSeconds+posture-forecastTransferSecondsV101(controller)),throwEffortBuildSecondsV103:controller.spec.throwEffortBuildSecondsV103??LIVE_THROW_EFFORT_POLICY_V103.defaultBuildSeconds,
              receiverReadySeconds:Math.max(0,second.receiverArriveSeconds-firstSeconds),
              deadlineSeconds:Math.max(0,second.runnerSeconds-firstSeconds-acquisition),preferStrongestFeasibleV103:true},
              {...(individualV118?knownRelayActorV118(possession,controller,t):transferActorV110(controller,t)),position:origin,velocity:v(),glovePosition:origin,gloveVelocity:v(),bodyPoseV105:futurePose},2,true,individualV118);
          if(action.kind!=='planned')continue;
          const controlSeconds=firstSeconds+action.controlSeconds+acquisition;
          doublePlayRoutes.push({firstRunnerId:first.runnerId,firstBase:first.base,secondRunnerId:second.runnerId,secondBase:second.base,
            firstMarginSeconds:first.margin,secondMarginSeconds:second.runnerSeconds-controlSeconds,controlSeconds});
        }
      }
      const doublePlay=decideLiveDoublePlayV106({outs:Math.min(2,(individualV118?knowledgeV118(possession!,t).world.knownContext.outs:input.outs+retiredCount)),seed:fieldRandomSeedV152('double-play-v106:'+originTick+':'+custodySince+':'+possession.spec.playerId),
        opportunityId:originTick+':'+custodySince+':'+possession.spec.playerId,pursuitCostWeight:possession.spec.fieldingCognition?.pursuitCostWeight??1,routes:doublePlayRoutes});
      if(doublePlayRoutes.length)doublePlayDecisionsV106.push({elapsedSeconds:t,playerId:possession.spec.playerId,routes:doublePlayRoutes,decision:doublePlay});
      // A single-out plan needs a defensible opportunity. An optimistic close
      // double-play attempt above may instead risk both runners becoming safe.
      const positive = (doublePlay.selected?candidates.find(c=>c.runnerId===doublePlay.selected!.firstRunnerId&&c.base===doublePlay.selected!.firstBase):null)
          ?? candidates.find(candidate => !candidate.containment && candidate.margin > 0);
      const routineFirst = positive ? undefined : candidates.find(c => {
        if(c.base!==1||!c.forced||c.appeal||c.containment||c.carryPreferred||c.margin>0||!Number.isFinite(c.receivingSeconds)
          ||runners.some(r=>r.spec.runnerId!==c.runnerId&&knownRunnerActiveV118(r,t)))return false;
        const opportunityId=originTick+':'+custodySince+':'+possession!.spec.playerId,
          race={seed:fieldRandomSeedV152('first-base-attempt-v108:'+opportunityId),opportunityId,pursuitCostWeight:possession!.spec.fieldingCognition?.pursuitCostWeight??1,
            runnerSeconds:c.runnerSeconds,receivingSeconds:c.receivingSeconds,distanceMeters:distance(flat(at(possession!.body,t)),flat(c.target)),
            capacityMps:possession!.spec.throwSpeedMps,runnerSpeedMps:runners.find(r=>r.spec.runnerId===c.runnerId)!.spec.topSpeedMps},
          decision=decideLiveFirstBaseAttemptV108(race),previous=firstBaseAttemptDecisionsV108.at(-1);
        if(previous?.opportunityId!==opportunityId||previous.decision.reason!==decision.reason)
          firstBaseAttemptDecisionsV108.push({elapsedSeconds:t,playerId:possession!.spec.playerId,opportunityId,
            distanceMeters:race.distanceMeters,capacityMps:race.capacityMps,runnerSpeedMps:race.runnerSpeedMps,
            runnerSeconds:race.runnerSeconds,receivingSeconds:race.receivingSeconds,decision});
        return decision.attempt;
      }), pick = positive ?? routineFirst
          ?? candidates.filter(candidate => candidate.containment && candidate.margin > 0).sort((a, b) => a.base - b.base || b.margin - a.margin)[0];
      if(individualV118&&input.recordDecisionTraceV118)decisionTraceV118.record(t,possession.spec.playerId,{basis:'individual_perception',
        observationSeconds:knowledgeV118(possession,t).observationElapsedSeconds,event:'holder_candidates',
        candidates:candidates.map(c=>({runnerId:c.runnerId,base:c.base,receiverPlayerId:c.receiver.spec.playerId,marginSeconds:c.margin,
          runnerSeconds:c.runnerSeconds,carrySeconds:c.carrySeconds,receivingSeconds:c.receivingSeconds,carryPreferred:c.carryPreferred,
          relayReceivers:c.relayPlan?.legs.map(l=>l.receiverPlayerId)??[]})),
        selected:pick?{runnerId:pick.runnerId,base:pick.base,receiverPlayerId:pick.receiver.spec.playerId,carry:pick.carryPreferred}:null},undefined,'strategy');
      if (pick) {
        const here = distance(flat(at(possession.body, t)), flat(pick.target));
        if (!pick.forced && !pick.appeal && !pick.containment && (here <= tagReachV105(possession,runners.find(r=>r.spec.runnerId===pick.runnerId)!,t) + .5 || pick.carryPreferred)) {
          holderTask = { point: knownRunnerAtV118(runners.find(r => r.spec.runnerId === pick.runnerId)!, t), intent: 'tag', base: null };
        } else if (here <= (field.baseTouchRadiusMeters ?? .28)) {
          holderTask = { point: pick.target, intent: 'base_cover', base: pick.base };
          holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: 'on_base_cover', base: pick.base,
            margin: pick.margin, carrySeconds: pick.carrySeconds, receivingSeconds: pick.receivingSeconds, receiverDistanceToBaseMeters: here });
        } else if(pick.carryPreferred&&!Number.isFinite(pick.receivingSeconds)&&t<custodySince+effectiveTransferSeconds(possession)){
          // An unavailable hand certificate just after receipt is not proof
          // that carrying beats a feed. Keep the assigned cover running while
          // the ordinary hand motor settles instead of taking over their bag.
          holderTask={point:at(possession.body,t),intent:'hold',base:null};
        } else if (pick.carryPreferred) {
          holderTask = { point: pick.target, intent: 'base_cover', base: pick.base };
          holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: 'carry_to_base', base: pick.base,
            margin: pick.margin, carrySeconds: pick.carrySeconds, receivingSeconds: pick.receivingSeconds, receiverDistanceToBaseMeters: here });
        } else {
          const hop = pick.relayPlan?.firstHop,
            action = hop ? pick.relayPlan!.legs[0] : pick.directAction?.kind === 'planned' ? pick.directAction : null;
          // A carry/hold hypothesis cannot issue a throw command without a
          // physically solved output and its preparation budget.
          assert(action, 'selected throw requires a solved output command');
          custodyChargeFromV103 ??= action.releaseStyleV110==='glove_toss'?t:Math.max(t,custodySince+effectiveTransferSeconds(possession));
          if(action.releaseStyleV110==='hand_throw')custodyChargeFromV103=Math.max(custodyChargeFromV103,custodySince+effectiveTransferSeconds(possession));
          const fullChargeSeconds = action.fullChargeSecondsV110,
            command: ThrowEffortCommandV103 = { playerId: possession.spec.playerId, from: t, chargeFrom: custodyChargeFromV103,
              ...(individualV118?{commandIdV118:'throw:'+possession.spec.playerId+':'+throwEffortCommandsV103.length}:{}),
              readyAt: custodyChargeFromV103 + action.chargeSeconds, effort: action.effort, commandSpeedMps: action.commandSpeedMps,
              capacitySpeedMps: action.capacityMps, fullChargeSeconds, requiredChargeSeconds: action.chargeSeconds,
              plannedFlightSeconds: action.flightSeconds,
              plannedArrivalAtSeconds: t + action.releaseDelaySeconds + action.flightSeconds,
              plannedControlAtSeconds: t + (hop ? pick.relayPlan!.legs[0].readySeconds : pick.receivingSeconds),
              runnerDeadlineAtSeconds: t + pick.runnerSeconds,
              receiverReadyAtSeconds: t + (hop ? pick.relayPlan!.legs[0].receiverArrivalSeconds : pick.receiverArriveSeconds),
              target: hop?.target ?? add(pick.target, v(0, pick.receiver.spec.position.y, 0)), base: pick.base,
              reason: action.selectionReason,releaseStyleV110:action.releaseStyleV110,outputSearchLimitApplied: action.outputSearchLimitApplied };
          throwEffortCommandsV103.push(command); runnerCueRevisionV95++; runnerCueAtV95 = t;
          if(individualV118&&input.recordDecisionTraceV118)decisionTraceV118.record(t,possession.spec.playerId,{basis:'individual_perception',
            event:'throw_command',commandId:command.commandIdV118,command,receiverPlayerId:hop?.receiverPlayerId??pick.receiver.spec.playerId,
            observationSeconds:knowledgeV118(possession,t).observationElapsedSeconds},undefined,'execution');
          holderTask = { point: at(possession.body, t), intent: 'hold', base: null };
          throwTarget = { receiver: hop ? defenders.find(f => f.spec.playerId === hop.receiverPlayerId)! : pick.receiver, throwerPlayerId: possession.spec.playerId,
            routineReturn: pick === routineFirst && !positive,
            base: pick.base, runnerId: pick.runnerId, forced: pick.forced, appeal: pick.appeal, point: hop?.target ?? add(pick.target, v(0, pick.receiver.spec.position.y, 0)),
            receiverPoint: hop?.receiverPoint ?? pick.target, issuedFrom: at(possession.glove, t), intent: hop?.intent ?? 'base_cover', effort: command };
          releaseAt = Math.max(through, command.readyAt);
          holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: pick === routineFirst && !positive ? 'prepare_first_base_attempt' : pick.containment ? 'prepare_containment_throw' : 'prepare_throw', base: pick.base,
            margin: pick.margin, carrySeconds: pick.carrySeconds, receivingSeconds: pick.receivingSeconds,
            receiverPlayerId: pick.receiver.spec.playerId,
            receiverDistanceToBaseMeters: distance(flat(at(pick.receiver.body, t)), flat(pick.target)) });
        }
      } else {
        const bestCand = candidates[0];
        const offBase = runners.filter(r => knownRunnerActiveV118(r,t) && knownRunnerMovingV118(r,t) && (individualV118||!protectedFirstOverrunV95(r))
          && distance(flat(at(possession!.body, t)), flat(knownRunnerAtV118(r, t))) <= tagReachV105(possession!,r,t) + 2.5)
          .sort((a, b) => distance(at(possession!.body, t), knownRunnerAtV118(a, t)) - distance(at(possession!.body, t), knownRunnerAtV118(b, t)))[0];
        if (offBase) holderTask = { point: knownRunnerAtV118(offBase, t), intent: 'tag', base: null };
        else {
          const homeEta = arrive(possession, base(4)), otherHome = Math.min(...defenders.filter(f => f !== possession).map(f => liveFieldArrivalSecondsV1(knownActorV118(possession!,f,t), base(4)))),
            protectHome = !dead && runners.some(r => knownRunnerActiveV118(r,t)&&knownRunnerMovingV118(r,t)) && homeEta + .35 < otherHome
              && homeEta < Math.max(...runners.filter(r => knownRunnerActiveV118(r,t)).map(r => runnerArrivalSeconds(r, 4, t)));
          holderTask = protectHome ? { point: base(4), intent: 'base_cover', base: 4 } : { point: at(possession.body, t), intent: 'hold', base: null };
        }
        const guardingHome = holderTask.base === 4 && distance(flat(at(possession.body, t)), flat(base(4))) <= (field.baseTouchRadiusMeters ?? .28);
        holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: offBase ? 'pursue_tag' : guardingHome ? 'on_base_cover' : 'hold_no_positive_margin',
          base: guardingHome ? 4 : bestCand?.base ?? null, margin: bestCand?.margin, carrySeconds: bestCand?.carrySeconds, receivingSeconds: bestCand?.receivingSeconds });
      }
      planned = assignment(); assigned = planned.targets;
    }
    if (!individualV118&&defensiveOpportunity && !possession && !pendingCatch && !hasThrown) {
      const roles: LiveFieldRoleV1[] = defenders.map(f => ({ playerId: f.spec.playerId, taskId: 'no-defensive-opportunity',
        point: at(f.body, t), intent: 'hold', targetBase: null }));
      planned = { roles, targets: new Map(defenders.map(f => [f, { point: at(f.body, t), intent: 'hold' as const, base: null }])) };
      assigned = planned.targets;
    }
    if(input.defenseDecisionModeV118==='shadow')individualAssignmentV118();
    if(individualV118){
      const proposalsV120:{fielder:Fielder;action:LiveFielderAthleticPlanV115;eta:number;point:Vec3}[]=[];
      for(const f of defenders){const role=planned.roles.find(r=>r.playerId===f.spec.playerId)!;
        publishIntentV118(f,t,'role',{kind:'intent',intent:liveFieldIntentV1(role),point:role.point,estimatedArrivalSeconds:liveFieldArrivalSecondsV1(roleActor(f,t),role.point)});
        if(!athleticActiveV115(f,t)&&possession!==f&&pendingCatch?.fielder!==f&&knowledgeV118(f,t).ball?.possessedBy===null&&role.intent==='intercept'&&f.spec.athleticProfileV115){
          const predicted=forecasts.find(x=>x.f===f)?.predicted,candidate=predicted?athleticCandidateV115(f,predicted,t):null;
          if(candidate)proposalsV120.push({fielder:f,action:candidate.action,eta:candidate.eta,point:candidate.point});
        }
      }
      // Propose from one snapshot, then resolve incompatible starts by their
      // capture opportunity and geometry, never input order/player identity.
      proposalsV120.sort((a,b)=>a.eta-b.eta||at(a.fielder.body,t).x-at(b.fielder.body,t).x||at(a.fielder.body,t).z-at(b.fielder.body,t).z);
      for(const proposal of proposalsV120){const f=proposal.fielder,q=clearanceInputV120(t,proposal.action.throughSeconds,proposal),
        proof=q?certifyLiveAthleticClearanceV1(q):null;
        if(q&&!(proof?.kind==='safe'&&validateLiveAthleticClearanceV1(proof,q))){recordSafetyV120(t,f.spec.playerId,proof?.kind??'unknown',proof?.reason??'current_body_snapshot_incomplete',proof?.checkedIntervals??0);continue;}
        newAthleticsV120.set(f,{previous:f.athleticV115,action:proposal.action,eta:proposal.eta,point:proposal.point});f.athleticV115=proposal.action;
      }
      for(const f of defenders)if(athleticActiveV115(f,t))through=Math.min(through,f.athleticV115!.boundaries.find(b=>b>t)??through);
      if(throwTarget&&possession)publishIntentV118(possession,t,'throw',{kind:'intent',targetPlayerId:throwTarget.receiver.spec.playerId,
        intent:throwTarget.intent==='relay'?{kind:'relay',target:{x:throwTarget.receiverPoint.x,z:throwTarget.receiverPoint.z}}:{kind:'base_cover',base:throwTarget.base},
        point:throwTarget.receiverPoint,base:throwTarget.base,estimatedArrivalSeconds:Math.max(0,throwTarget.effort.plannedArrivalAtSeconds-t)},throwTarget.receiver);
    }
    previousRoles = planned.roles;
    if(input.recordDecisionTraceV118&&!individualV118)for(const f of defenders){
      const target=assigned.get(f)!,seen=seenBy(f,t);
      decisionTraceV118.record(t,f.spec.playerId,{basis:'legacy_unseparated',observationSeconds:seen?.t??null,
        informationWarning:'中央割当の真値入力は個人認識へ未分離',selected:target,
        candidates:roleCostsV118?.filter(row=>row.playerId===f.spec.playerId)??[],
        reason:target.intent==='hold'?'役割候補を比較して待機':'中央割当を実行'},
        target.intent+':'+target.base+':'+Math.floor((seen?.t??start)/.2));
    }
    // Plan all bodies from the same world before moving any glove. Teammate
    // avoidance changes bounded acceleration, never a position or velocity.
    const bodyPlans = new Map<Fielder, { before: Vec3; vel: Vec3; target: { point: Vec3; intent: LiveFieldFrameV1['fielders'][number]['intent']; base: BaseballBase | null };
      delta: number; active: boolean; body: Curve; bodyBoundaryLimited: boolean; currentOffset: Vec3; gloveRadius: number;
      accepts: (motion: Readonly<{ acceleration: Vec3; stopAfter?: number }>) => boolean }>();
    let coordinatedV120:ReturnType<typeof coordinateLiveFielderMotionV1>|null=null;
    for(let motorPassV120=0;motorPassV120<2;motorPassV120++){
    bodyPlans.clear();
    for (const f of defenders) {
      const before = at(f.body, t), vel = velocityAt(f.body, t), target = assigned.get(f)!, delta = through - t;
      const active = !dead && t >= start + responseSeconds(f), locomotion = f.locomotion;
      if (active && initialMovementV98) {
        const first = initialMovementV98.get(f.spec.playerId)!;
        first.firstActivation ??= { elapsedSeconds: t, tick: tick(t) };
        if (target.intent !== 'hold') first.firstNonHoldRole ??= { elapsedSeconds: t, tick: tick(t), intent: target.intent };
      }
      const bodyRadius = LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters, gloveRadius = Math.max(f.spec.gloveRadiusMeters, input.physics.ground.radiusM),
        grip = at(f.glove, t), currentOffset = sub(grip, before);
      if(athleticActiveV115(f,t)){
        const c=f.athleticV115!.curveAtElapsedSeconds(t),state=f.athleticV115!.sampleAtElapsedSeconds(t),
          // Only the final, continuous recovery endpoint has exact zero
          // velocity. Keep landing's incoming side untouched for speed bounds.
          end=through===f.athleticV115!.throughSeconds?f.athleticV115!.sampleAtElapsedSeconds(through):null,
          body:Curve={from:t,p:state.position,velocity:state.velocity,acceleration:c.acceleration,
            ...(end?{exactEnd:{time:through,position:end.position,velocity:end.velocity}}:{})};
        bodyPlans.set(f,{before:state.position,vel:state.velocity,target,delta,active:true,body,bodyBoundaryLimited:false,currentOffset:sub(grip,state.position),gloveRadius,
          accepts:motion=>motion.stopAfter===undefined&&distance(flat(motion.acceleration),flat(c.acceleration))<1e-10});
        continue;
      }
      let motorPoint = f.spec.bodyModelV105 && (individualV118||f === handler || f === throwTarget?.receiver) && target.intent === 'intercept'
        ? liveFielderPreferredBodyPointV105(f.spec.bodyModelV105, before, target.point, poseV105(f, t)!.forward) : target.point;
      if (!f.spec.bodyModelV105 && active && target.intent === 'intercept' && target.point.y <= gloveRadius + .2
        && (forecasts.find(x => x.f === f)?.predicted?.prediction.observedPosition.y ?? Infinity) <= gloveRadius + .2) {
        const pred = forecasts.find(x => x.f === f)?.predicted,
          toT = flat(sub(target.point, before)), distT = norm(toT),
          stopTime = liveFieldArrivalSecondsV1({ ...roleActor(f, t), remainingReactionSeconds: 0 }, target.point, .02) + norm(vel) / locomotion.brakingMps2;
        const chargeSkill = f.spec.technicalSkills?.slow_ball_charge ?? 0, seen = chargeSkill > 0 ? seenBy(f, t) : null,
          charging = chargeSkill > 0 && (individualV118?seen?.phase!=='possessed'&&seen?.phase!=='airborne':!possession && !pendingCatch && !hasThrown && !throwTarget)
            && seen !== null && (individualV118||firstGroundContactSeconds !== null&&seen.t >= firstGroundContactSeconds)
            && seen.position.y <= input.physics.ground.radiusM + .05 && norm(seen.velocity) <= 10;
        if (distT > (charging ? .15 : .35) && (charging || !pred || !pred.intercepted || pred.eta < stopTime)) {
          const runThrough = (f.spec.topSpeedMps * f.spec.topSpeedMps) / (2 * locomotion.brakingMps2) + .5;
          motorPoint = add(target.point, mul(toT, runThrough / distT));
          // A bounded observed-ball lead changes the approach route; all motor/avoidance limits still apply.
          if (charging) motorPoint = add(motorPoint, mul(flat(seen!.velocity), .03 * chargeSkill));
        }
      }
      const seg = stepLiveDefenderMotionV84({ position: flat(before), velocity: flat(vel) },
        active && (individualV118||!defensiveOpportunity) ? flat(targetInside(motorPoint, fenceRadius - bodyRadius - .02)) : null, delta, locomotion);
      const proposed: Curve = { from: t, p: before, velocity: vel, acceleration: v(seg.acceleration.x, 0, seg.acceleration.z),
        ...(seg.stopAfter === undefined ? {} : { stopAfter: seg.stopAfter }) },
        speed = norm(vel), emergency: Curve = { from: t, p: before, velocity: vel,
          acceleration: speed > 0 ? mul(vel, -locomotion.brakingMps2 / speed) : v(), stopAfter: speed / locomotion.brakingMps2 };
      const bodySafe = (c: Curve, stoppingReserve: number = LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters) => [ { offset: v(), radius: bodyRadius }, { offset: currentOffset, radius: gloveRadius } ].every(o => {
        const translated = shifted(c, o.offset);
        return curveInside(translated, t, through, fenceRadius - o.radius, 0)
          && pointInside(add(stopPoint(c, through, locomotion.brakingMps2), o.offset), fenceRadius - o.radius - stoppingReserve);
      });
      let body = proposed, bodyBoundaryLimited = false;
      if (!bodySafe(body)) {
        bodyBoundaryLimited = true;
        if (!bodySafe(emergency, 0)) { motorBoundaryFailure = { kind: 'body_fence_motor_infeasible', playerId: f.spec.playerId, position: before, velocity: vel,
          currentOffset, emergencyStop: stopPoint(emergency, through, locomotion.brakingMps2), emergencyEnd: at(emergency, through) }; return; }
        body = emergency;
        // Blending different stopAfter boundaries would make the acceleration
        // and its zero-speed boundary disagree. Only blend full-step commands.
        if (proposed.stopAfter === undefined && speed / locomotion.brakingMps2 >= delta) {
          let low = 0, high = 1;
          for (let i = 0; i < 32; i++) {
            const u = (low + high) / 2, candidate = { ...proposed, acceleration: add(mul(emergency.acceleration, 1 - u), mul(proposed.acceleration, u)) };
            if (bodySafe(candidate)) { low = u; body = candidate; } else high = u;
          }
        }
      }
      const asCurve = (motion: Readonly<{ acceleration: Vec3; stopAfter?: number }>): Curve => ({ from: t, p: before, velocity: vel,
        acceleration: motion.acceleration, ...(motion.stopAfter === undefined ? {} : { stopAfter: motion.stopAfter }) });
      bodyPlans.set(f, { before, vel, target, delta, active, body, bodyBoundaryLimited, currentOffset, gloveRadius,
        accepts: motion => (bodySafe(asCurve(motion)) || (motion.stopAfter === emergency.stopAfter
          && distance(motion.acceleration, emergency.acceleration) <= 1e-12 && bodySafe(asCurve(motion), 0)))
          &&respectsAirborneV120(f,asCurve(motion),t,through) });
    }
    const coordination = coordinateLiveFielderMotionV1({ fromSeconds: t, throughSeconds: through,
      actors: defenders.map(f => { const p = bodyPlans.get(f)!;
        return { playerId: f.spec.playerId, position: p.before, velocity: flat(p.vel),
          accelerationMps2: f.spec.accelerationMps2, topSpeedMps: f.spec.topSpeedMps, bodyRadiusMeters: LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters,
          locomotionProfile: f.locomotion,
          priority: f === possession || f === pendingCatch?.fielder ? 700 : !individualV118&&f === throwTarget?.receiver ? 600 : (individualV118?p.target.intent==='intercept':f === handler) ? 500
            : p.target.intent === 'tag' ? 450 : p.target.intent === 'base_cover' ? 300 : p.target.intent === 'relay' ? 200 : p.target.intent === 'backup' ? 100 : 0,
          canSteer: !athleticActiveV115(f,t)&&t >= start + responseSeconds(f),
          preferred: { acceleration: flat(p.body.acceleration), ...(p.body.stopAfter === undefined ? {} : { stopAfter: p.body.stopAfter }) }, accepts: p.accepts };
      }) });
    let jointSafeV120=coordination.safe;
    if(jointSafeV120&&individualV118&&defenders.some(f=>athleticActiveV115(f,t))&&defenders.every(f=>f.spec.bodyModelV105)){
      const end=Math.max(...defenders.filter(f=>athleticActiveV115(f,t)).map(f=>f.athleticV115!.throughSeconds)),
        overrides=new Map(coordination.commands.map(command=>{const f=defenders.find(f=>f.spec.playerId===command.playerId)!,p=bodyPlans.get(f)!;
          return[f,{curve:{from:t,p:p.before,velocity:p.vel,acceleration:command.motion.acceleration,...(command.motion.stopAfter===undefined?{}:{stopAfter:command.motion.stopAfter})},through}] as const;})),
        q=clearanceInputV120(t,end,undefined,overrides),proof=q?certifyLiveAthleticClearanceV1(q):null;
      jointSafeV120=!!q&&proof?.kind==='safe'&&validateLiveAthleticClearanceV1(proof,q);
      if(!jointSafeV120)recordSafetyV120(t,'joint',proof?.kind??'unknown',proof?.reason??'current_body_snapshot_incomplete',proof?.checkedIntervals??0);
    }
    if(jointSafeV120){coordinatedV120=coordination;break;}
    if(newAthleticsV120.size&&motorPassV120===0){
      for(const [f,p]of newAthleticsV120){f.athleticV115=p.previous;recordSafetyV120(t,f.spec.playerId,'not_adopted','通常追球へ戻して安全なmotorを再提案');}
      newAthleticsV120.clear();bodyCommandCacheV120.clear();clearanceOptionCacheV120.clear();continue;
    }
    motorBoundaryFailure={kind:'fielder_separation_plan_required',elapsedSeconds:t,diagnostics:coordination.diagnostics};return;
    }
    const coordination=coordinatedV120!;
    // No proposal becomes an action or a transmitted path before this final
    // synchronous joint proof. Already airborne source curves remain immutable.
    for(const [f,p]of newAthleticsV120){
      f.athleticAttemptAfterV115=p.action.throughSeconds+.2;
      athleticDecisionsV115.push({playerId:f.spec.playerId,kind:p.action.kind,fromSeconds:t,interceptSeconds:t+p.eta,point:p.point,throughSeconds:p.action.throughSeconds});
      const command=bodyCommandV120(f,t,p.action.throughSeconds,undefined,p.action)!;
      if(command)for(const to of defenders)if(to!==f){
        const relationship=f.spec.fieldRelationshipsV99?.find(r=>r.toPlayerId===to.spec.playerId),delay=.04+.08*(1-(relationship?.coordination??50)/100),
          message={messageId:command.commandId,revision:command.revision,sourceId:f.spec.playerId,recipientId:to.spec.playerId,issuedAtElapsedSeconds:t,
            expiresAtElapsedSeconds:command.throughSeconds,propagationDelaySeconds:delay,payload:{kind:'intent' as const,intent:{kind:'ball_handler' as const},point:p.point,estimatedArrivalSeconds:p.eta}};
        communicationV118.issue({schemaVersion:2,message,commitment:command});
      }
      recordSafetyV120(t,f.spec.playerId,'adopted','continuous_whole_body_clearance');
    }
    avoidancePlanCount++; avoidanceCandidateEvaluations += coordination.diagnostics.candidateEvaluations;
    if (coordination.diagnostics.minimumStepGapMeters !== null)
      minimumPlannedStepGapMeters = Math.min(minimumPlannedStepGapMeters, coordination.diagnostics.minimumStepGapMeters);
    if (coordination.diagnostics.minimumStoppingGapMeters !== null)
      minimumStoppingGapMeters = Math.min(minimumStoppingGapMeters, coordination.diagnostics.minimumStoppingGapMeters);
    const actions = coordination.commands.flatMap(c => c.reason === 'preferred' ? [] : [{ playerId: c.playerId, reason: c.reason }]),
      avoidanceKey = actions.map(c => c.playerId + ':' + c.reason).sort().join('|');
    if (avoidanceKey !== avoidanceState) {
      fielderAvoidanceTransitions.push({ elapsedSeconds: t, throughSeconds: through, actions,
        minimumPlannedStepGapMeters: coordination.diagnostics.minimumStepGapMeters }); avoidanceState = avoidanceKey;
    }
    for (const c of coordination.commands) {
      const counts = fielderAvoidanceCounts.get(c.playerId) ?? { preferred: 0, brake: 0, yield: 0 };
      counts[c.reason]++; fielderAvoidanceCounts.set(c.playerId, counts);
    }
    for (const command of coordination.commands) {
      const f = defenders.find(f => f.spec.playerId === command.playerId)!, p = bodyPlans.get(f)!;
      f.body = athleticActiveV115(f,t)?p.body:{ from: t, p: p.before, velocity: p.vel, acceleration: command.motion.acceleration,
        ...(command.motion.stopAfter === undefined ? {} : { stopAfter: command.motion.stopAfter }) };
      f.intent = p.active ? p.target.intent : 'hold'; f.targetBase = p.target.base;
      const first = initialMovementV98?.get(f.spec.playerId);
      if (first && first.firstMovementCommand === null && norm(command.motion.acceleration) > 0)
        first.firstMovementCommand = { elapsedSeconds: t, tick: tick(t), position: p.before, velocity: p.vel,
          acceleration: command.motion.acceleration, intent: f.intent, commandReason: command.reason };
    }
    for (const f of defenders) {
      const { vel, target, delta, active, bodyBoundaryLimited, currentOffset, gloveRadius } = bodyPlans.get(f)!, body = f.body, grip = at(f.glove, t),
        localHandlerV118=individualV118?target.intent==='intercept':f===handler,
        localReceiverV118=f===throwTarget?.receiver&&(!individualV118||adviceV118(f,t).some(a=>a.targetPlayerId===f.spec.playerId&&a.sourceId===throwTarget?.throwerPlayerId
          &&a.role.intent===target.intent&&a.role.targetBase===target.base&&distance(flat(a.role.point),flat(target.point))<1e-8));
      if (f.spec.bodyModelV105&&!athleticActiveV115(f,t)) {
        const m = f.spec.bodyModelV105, old = sampleLiveFielderPostureV105(f.postureV105!, t), expected = forecasts.find(x => x.f === f)?.predicted,
          point = f === possession ? throwTarget?.point ?? base(outTargets()[0]?.targetBase ?? 1) : expected?.point ?? target.point,
          near = distance(flat(point),flat(at(body,t))) <= m.armReachMeters + f.spec.topSpeedMps*(m.maximumCrouchMeters/m.postureSpeedMps+.15),
          crouchDesired = pendingCatch?.fielder === f ? old.crouchMeters : (!possession||individualV118) && active && near && (localHandlerV118 || localReceiverV118)
            ? liveFielderDesiredCrouchV105(m,at(body,t),point) : 0,
          desiredYaw = f === possession || near && (localHandlerV118 || localReceiverV118)
            ? Math.atan2(point.x-at(body,t).x,point.z-at(body,t).z)
            : norm(flat(vel)) > .3 ? Math.atan2(vel.x,vel.z) : old.yaw,
          yawDelta = Math.atan2(Math.sin(desiredYaw-old.yaw),Math.cos(desiredYaw-old.yaw)), frozen = handPreparation?.fielder === f,
          crouchTo = frozen ? old.crouchMeters : old.crouchMeters+clamp(crouchDesired-old.crouchMeters,-m.postureSpeedMps*delta,m.postureSpeedMps*delta),
          yawTo = frozen ? old.yaw : old.yaw+clamp(yawDelta,-liveFielderTurnSpeedV110(m)*delta,liveFielderTurnSpeedV110(m)*delta),
          heldCurve: Curve = { ...body,p:grip }, previous = f.postureV105;
        let accepted = false;
        // Weakening a posture changes neither the existing hand nor the ball.
        for (let i=0;i<=16;i++) {
          const fraction = i===16 ? 0 : 2**(-i);
          f.postureV105 = { from:t,through,crouchFrom:old.crouchMeters,crouchTo:old.crouchMeters+(crouchTo-old.crouchMeters)*fraction,
            yawFrom:old.yaw,yawTo:old.yaw+(yawTo-old.yaw)*fraction };
          if (bodyReachSafeV105(f,heldCurve,t,through)) { accepted=true; if(i>0)bodyGeometryV105.postureDeferredCount++; break; }
        }
        if (!accepted) { f.postureV105=previous; motorBoundaryFailure={kind:'body_reach_initial_boundary_infeasible',playerId:f.spec.playerId,glove:grip,pose:poseV105(f,t)};return; }
      }
      const heldOffset = athleticActiveV115(f,t)?sub(add(poseV105(f,through)!.shoulder,mul(poseV105(f,through)!.forward,f.spec.bodyModelV105!.armReachMeters*.25)),at(f.body,through))
        :throwTarget && f === possession ? throwOffset(f, at(f.body, through), throwTarget.point,throwTarget.effort.releaseStyleV110) : f.spec.bodyModelV105
        ? add(v(0, f.spec.bodyModelV105.shoulderHeightMeters - f.spec.bodyModelV105.hipHeightMeters - (poseV105(f, through)?.crouchMeters ?? 0), 0), mul(poseV105(f, through)!.forward, f.spec.bodyModelV105.armReachMeters * .25)) : v(0, 0, -.5);
      const expected = forecasts.find(x => x.f === f)?.predicted,
        nextPredictedBall = expected ? expected.prediction.sample(Math.min(delta, expected.prediction.maximumSeconds)) : null,
        sampledNext = nextPredictedBall?.position ?? null,
        perceivedTarget = expected
          ? expected.intercepted || (sampledNext && distance(flat(sampledNext), flat(fenceCenter)) <= fenceRadius - input.physics.ground.radiusM)
            ? sampledNext! : expected.point
          : at(f.body, through);
      let anticipated = localHandlerV118 || localReceiverV118 ? expected?.point ?? perceivedTarget : perceivedTarget;
      // Prepare the glove at the predicted receiving point for a grounded
      // ball. Chasing its current position at hand speed strikes against the
      // incoming ball, increasing retention load and launching failed catches.
      // Airborne/throw reception and model-less legacy motion stay unchanged.
      const groundReception = f.spec.bodyModelV105 && localHandlerV118 && (expected?.intercepted || nearAttempt?.f === f || individualV118&&!!expected?.attempt)
        && nextPredictedBall && nextPredictedBall.phase !== 'airborne';
      if (!groundReception && distance(perceivedTarget, f.spec.bodyModelV105 ? poseV105(f, t)!.shoulder : at(f.body, through)) <= (f.spec.bodyModelV105?.armReachMeters ?? f.spec.gloveReachMeters) + f.spec.gloveRadiusMeters + input.physics.ground.radiusM)
        anticipated = perceivedTarget;
      if (localReceiverV118&&throwTarget) {
        const bodyAtThrough = at(f.body, through),
          q = throwTarget.point,
          frontDist = Math.min((f.spec.bodyModelV105?.armReachMeters ?? f.spec.gloveReachMeters) * .55, LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + f.spec.gloveRadiusMeters + .12),
          seen = seenBy(f, t),
          sourcePos = individualV118?knowledgeV118(f,t).ball?.position??bodyAtThrough:possession ? at(possession.glove, t) : (throwTarget.releasedFrom ?? seen?.position ?? bodyAtThrough),
          toSourceFromQ = flat(sub(sourcePos, q)), lenQ = norm(toSourceFromQ),
          u = lenQ > 1e-6 ? mul(toSourceFromQ, 1 / lenQ) : v(0, 0, -1),
          bodyProj = Math.max(0, (bodyAtThrough.x - q.x) * u.x + (bodyAtThrough.z - q.z) * u.z),
          distFromQ = bodyProj + frontDist,
          frac = clamp(distFromQ / Math.max(lenQ, 1), 0, 1),
          sourceY = Math.max(sourcePos.y, q.y + LIVE_FIELD_TEST_MODEL_V1.throwHand.heightAboveHipMeters * .85),
          frontPoint = add(q, add(mul(u, distFromQ), v(0, (sourceY - q.y) * frac, 0)));
        if (expected && throwTarget.releasedAt !== undefined && seen && seen.t >= throwTarget.releasedAt) {
          let lo = -(t - seen.t), hi = Math.min(2, expected.prediction.maximumSeconds);
          for (let i = 0; i < 10; i++) {
            const mid = (lo + hi) * .5, p = expected.prediction.sample(mid).position;
            if ((p.x - frontPoint.x) * u.x + (p.z - frontPoint.z) * u.z > 0) lo = mid; else hi = mid;
          }
          anticipated = expected.prediction.sample((lo + hi) * .5).position;
        } else {
          anticipated = frontPoint;
        }
      }
      const reachableTarget = v(anticipated.x, Math.max(gloveRadius, anticipated.y), anticipated.z);
      const tagRunner = f === possession && target.intent === 'tag' ? runners.filter(r => knownRunnerActiveV118(r,t,f)&&knownRunnerMovingV118(r,t,f)&&(individualV118||!protectedFirstOverrunV95(r)))
        .sort((a, b) => distance(at(f.body, through), knownRunnerAtV118(a, through,f)) - distance(at(f.body, through), knownRunnerAtV118(b, through,f)))[0] : null;
      const relative = sub(bodyBoundaryLimited ? at(f.body, through) : tagRunner ? individualV118?knownRunnerAtV118(tagRunner,through,f):runnerTagTargetV115(tagRunner,through)
        : defensiveOpportunity&&!individualV118 ? at(f.body, through)
        : (f === possession || f === pendingCatch?.fielder) ? add(at(f.body, through), heldOffset)
        : localHandlerV118 || localReceiverV118 ? reachableTarget : at(f.body, through), at(f.body, through));
      const desired = f.spec.bodyModelV105 ? liveFielderReachTargetV105(f.spec.bodyModelV105, poseV105(f, through)!.shoulder, poseV105(f, through)!.forward, add(at(f.body, through), relative))
        : add(at(f.body, through), mul(relative, Math.min(1, f.spec.gloveReachMeters / Math.max(norm(relative), 1e-30)))),
        limited = targetInside(v(desired.x, Math.max(gloveRadius, desired.y), desired.z), fenceRadius - gloveRadius - .02),
        wantedOffset = sub(limited, at(f.body, through)), targetOffset = f.spec.bodyModelV105 ? wantedOffset : mul(wantedOffset, Math.min(1, f.spec.gloveReachMeters / Math.max(norm(wantedOffset), 1e-30))),
        shoulderMotion=athleticActiveV115(f,t)?f.athleticV115!.sampleAtElapsedSeconds(t):null,
        carrierDelta=shoulderMotion?sub(poseV105(f,through)!.shoulder,shoulderMotion.pose.shoulder):sub(at(body,through),at(body,t)),
        relativeMove = shoulderMotion?sub(sub(limited,grip),carrierDelta):sub(targetOffset,currentOffset);
      let relativeVelocity = active ? mul(relativeMove, Math.min(1, f.spec.gloveSpeedMps * delta / Math.max(norm(relativeMove), 1e-30)) / delta) : v();
      const gloveCurve = (u: number): Curve => shoulderMotion?{from:t,p:grip,velocity:add(shoulderMotion.shoulderVelocity,mul(relativeVelocity,u)),
        acceleration:shoulderMotion.shoulderAcceleration,jerk:shoulderMotion.shoulderJerk}:{ ...body, p: grip, velocity: add(vel, mul(relativeVelocity, u)),
        ...(body.stopAfter !== undefined ? { continuingVelocity: mul(relativeVelocity, u) } : {}) };
      const gloveSafe = (c: Curve, stoppingReserve: number = LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters, motorThrough = through) => {
        if (!bodyReachSafeV105(f, c, t, motorThrough)) return false;
        if (!curveInside(c, t, motorThrough, fenceRadius - gloveRadius, gloveRadius)
          || !pointInside(add(stopPoint(body, motorThrough, f.locomotion.brakingMps2), sub(at(c, motorThrough), at(body, motorThrough))), fenceRadius - gloveRadius - stoppingReserve)) return false;
        if (pendingCatch?.fielder === f) {
          const capture = pendingCatch, duration = capture.secure - capture.first, until = Math.min(through, capture.secure),
            offset = mul(capture.offset, Math.max(0, 1 - (t - capture.first) / duration)), captureCurve = shifted(c, offset, mul(capture.offset, -1 / duration));
          if (until > t && !curveInside(captureCurve, t, until, fenceRadius - input.physics.ground.radiusM + LIVE_FIELD_TEST_MODEL_V1.wallMaterial.maximumCompressionMeters,
            input.physics.ground.radiusM - roundBound(at(captureCurve, t)))) return false;
        }
        return true;
      };
      if (f === possession && throwTarget && recoveryV105(f, t) <= 1e-10
        && (!f.postureV105 || Math.abs(f.postureV105.yawTo-f.postureV105.yawFrom)<1e-10) && (!bodyBoundaryLimited || handPreparation?.fielder === f)) {
        if (!handPreparation || handPreparation.fielder !== f || handPreparation.base !== throwTarget.base) {
          const preparation = createLiveBodyHandPreparationV105({ fromElapsedSeconds: t, initialOffset: currentOffset,
            initialRelativeVelocity: sub(velocityAt(f.glove, t), vel), targetOffset: heldOffset,
            maximumRelativeSpeedMps: f.spec.gloveSpeedMps, maximumReachMeters: f.spec.gloveReachMeters }, f.spec.bodyModelV105, poseV105(f, t)?.forward);
          if (preparation.kind === 'planned') {
            handPreparation = { fielder: f, base: throwTarget.base, curve: preparation, prepared: preparation.throughElapsedSeconds === t };
            handPreparationProofs.push({ playerId: f.spec.playerId, base: throwTarget.base, from: preparation.fromElapsedSeconds,
              through: preparation.throughElapsedSeconds, target: throwTarget.point,
              controls: preparation.cubicBezierControls(preparation.fromElapsedSeconds, preparation.throughElapsedSeconds),
              diagnostics: preparation.diagnostics });
          }
          else if((throwTarget.handPreparationRetriesV110??0)<3){
            // Let the ordinary bounded hand motor settle a transient endpoint
            // before retrying the conservative C1 certificate. No snapping.
            throwTarget.handPreparationRetriesV110=(throwTarget.handPreparationRetriesV110??0)+1;
            throwDecisions.push({elapsedSeconds:t,base:throwTarget.base,reason:'c1_hand_preparation_deferred'});
          } else {
            for (const o of knownForceObligationsV118(f,t).filter(o => o.targetBase === throwTarget!.base)) rejectedThrows.add(o.runnerId + ':' + o.targetBase);
            throwDecisions.push({ elapsedSeconds: t, base: throwTarget.base, reason: 'c1_hand_preparation_unreachable' });
            throwEffortCancellationsV103.push({ playerId: f.spec.playerId, from: t, commandFrom: throwTarget.effort.from, reason: 'c1_hand_preparation_unreachable' });
            runnerCueRevisionV95++; runnerCueAtV95 = t;
            throwTarget = null; releaseAt = null;
          }
        }
        if (handPreparation && handPreparation.fielder === f && throwTarget) {
          const preparation = handPreparation, curve = preparation.curve, motorEnd = preparation.prepared ? through : Math.min(through, curve.throughElapsedSeconds),
            initial = curve.sampleAtElapsedSeconds(Math.min(t, curve.throughElapsedSeconds)), duration = curve.durationSeconds,
            controls = curve.cubicBezierControls(curve.fromElapsedSeconds, curve.throughElapsedSeconds),
            relativeJerk = preparation.prepared || duration === 0 ? v() : mul(add(sub(controls[3], mul(controls[2], 3)), sub(mul(controls[1], 3), controls[0])), 6 / duration ** 3),
            relativeAcceleration = preparation.prepared ? v() : initial.relativeAcceleration,
            relativeVelocityAtStart = preparation.prepared ? v() : initial.relativeVelocity;
          const smooth: Curve = { ...body, p: grip, velocity: add(vel, relativeVelocityAtStart),
            acceleration: add(body.acceleration, relativeAcceleration), jerk: relativeJerk };
          if (body.stopAfter !== undefined) {
            const stop = body.stopAfter;
            smooth.continuingVelocity = add(relativeVelocityAtStart, add(mul(relativeAcceleration, stop), mul(relativeJerk, .5 * stop ** 2)));
            smooth.continuingAcceleration = add(relativeAcceleration, mul(relativeJerk, stop)); smooth.continuingJerk = relativeJerk;
          }
          if (!preparation.prepared && curve.throughElapsedSeconds <= through) smooth.exactEnd = { time: curve.throughElapsedSeconds,
            position: add(at(body, curve.throughElapsedSeconds), curve.sampleAtElapsedSeconds(curve.throughElapsedSeconds).offset),
            velocity: velocityAt(body, curve.throughElapsedSeconds) };
          if (!gloveSafe(smooth, LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters, motorEnd)) {
            motorBoundaryFailure = { kind: 'c1_hand_fence_motor_infeasible', playerId: f.spec.playerId, position: grip }; return;
          }
          f.glove = smooth; continue;
        }
      }
      let glove = gloveCurve(1);
      if(shoulderMotion&&!gloveSafe(glove)){
        // At a ground-level dive, cancelling only the shoulder's average
        // displacement can still start the glove down through the ground.
        // Reserve vertical hand speed against the entire carrier derivative,
        // then use the remaining SAME motor budget for lateral tracking.
        const oldVelocity=relativeVelocity,a=shoulderMotion.shoulderAcceleration.y,j=shoulderMotion.shoulderJerk.y,
          extremum=j===0?0:clamp(-a/j,0,delta),carrierVy=(u:number)=>shoulderMotion.shoulderVelocity.y+a*u+.5*j*u*u,
          required=Math.max(oldVelocity.y,-Math.min(carrierVy(0),carrierVy(delta),carrierVy(extremum))),cap=f.spec.gloveSpeedMps;
        if(Math.abs(required)<=cap){const lateral=Math.hypot(oldVelocity.x,oldVelocity.z),available=Math.sqrt(Math.max(0,cap*cap-required*required)),scale=lateral>0?Math.min(1,available/lateral):1;
          relativeVelocity=v(oldVelocity.x*scale,required,oldVelocity.z*scale);const alternative=gloveCurve(1);
          if(gloveSafe(alternative))glove=alternative;else relativeVelocity=oldVelocity;
        }
      }
      if (!gloveSafe(glove)) {
        if (!gloveSafe(gloveCurve(0), 0)) { motorBoundaryFailure = { kind: 'glove_fence_motor_infeasible', playerId: f.spec.playerId, position: grip }; return; }
        glove = gloveCurve(0); let low = 0, high = 1;
        for (let i = 0; i < 32; i++) { const u = (low + high) / 2, candidate = gloveCurve(u);
          if (gloveSafe(candidate)) { low = u; glove = candidate; } else high = u; }
      }
      f.glove = glove;
    }
    runnerDecisionPending = runners.some(r => !r.retired && !r.scored && t < runnerCueAtV95 + r.spec.reactionSeconds);
    lastRunnerEvaluationSeconds = t;
    const defenseControlCache = new Map<string, number | null>();
    const estimateDefenseControl = (r: Runner, n: number): number | null => {
      const observer = runnerObservationV95(r, t);
      if (!observer) return null;
      const key = r.spec.runnerId + ':' + n;
      if (defenseControlCache.has(key)) return defenseControlCache.get(key)!;
      const sources = runnerSourcesV95(observer), estimate = estimateLiveDefenseControlV95({
        observedAtSeconds: observer.t, nowSeconds: t, snapshotKey: observer.t + ':' + observer.cueRevision,
        actors: observer.actors, sources, target: { base: n as BaseballBase, position: add(base(n), v(0, .9, 0)),
          forced: deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId && o.targetBase === n) },
        physics: runnerObservedPhysicsV113 }, runnerDefenseMemoV95);
      runnerObservationsV95.push({ runnerId: r.spec.runnerId, elapsedSeconds: t, observedAtSeconds: observer.t,
        reactionSeconds: r.spec.reactionSeconds, targetBase: n, cueRevision: observer.cueRevision, route: estimate.route,
        controlSeconds: estimate.controlSeconds, aerodynamicSolves: estimate.diagnostics.aerodynamicSolveCount,
        cacheHit: estimate.diagnostics.cacheHit });
      const result = estimate.controlSeconds;
      defenseControlCache.set(key, result); return result;
    };
    const targetOccupiedByOther = (r: Runner, n: number) => runners.some(x => x !== r && !x.retired && !x.scored
      && (x.base === n && (!x.leg || x.leg.to <= x.base)
        || x.leg?.motion.touches.slice(x.leg.nextTouchIndex).some(b => b.base === n)));
    const airborneAssessment = (r: Runner) => {
      if (firstGroundContactSeconds !== null || firstFielderTouchSeconds !== null || hasThrown || dead || r.spec.initialBase === 0) return undefined;
      const seen = history.slice().reverse().find(o => o.t <= t - r.spec.reactionSeconds), prediction = predictObservation(seen ?? null, t, r.spec.reactionSeconds);
      if (!seen || !prediction || seen.phase !== 'airborne') return undefined;
      let catchMarginSeconds = -LIVE_FIELD_TEST_MODEL_V1.sensorPrediction.horizonSeconds;
      // Only propagate this already observed ball. Actual future kernel
      // boundaries/catches and final hit classifications never enter the read.
      const beforeGround = Math.min(prediction.maximumSeconds, prediction.firstPredictedGroundSeconds);
      for (let h = 0; h < beforeGround; h += .1) {
        const point = prediction.sample(h).position;
        if (point.y <= input.physics.ground.radiusM + 1e-5 && h > 0) break;
        if (!pointInside(point, fenceRadius - input.physics.ground.radiusM)) break;
        for (const f of defenders) {
          const reach = f.spec.bodyModelV105 ? horizontalReachV105(f, t, point.y) : f.spec.gloveReachMeters;
          if ((f.spec.bodyModelV105 ? reach >= 0 : point.y <= f.spec.position.y + f.spec.gloveReachMeters))
            catchMarginSeconds = Math.max(catchMarginSeconds, h - Math.max(liveFieldArrivalSecondsV1(roleActor(f, t), point, reach * (f.spec.bodyModelV105 ? .65 : 1)),
              f.spec.bodyModelV105 ? roleActor(f,t).remainingReactionSeconds + Math.abs(liveFielderDesiredCrouchV105(f.spec.bodyModelV105, at(f.body, t), point) - poseV105(f, t)!.crouchMeters) / f.spec.bodyModelV105.postureSpeedMps : 0));
        }
      }
      return { observedAtSeconds: seen.t, catchMarginSeconds: catchMarginSeconds + runnerReadBias.get(r.spec.runnerId)! };
    };
    for (const r of runners.slice().sort((a, b) => b.base - a.base)) {
      if (slideCommittedV115(r,t)) continue;
      if (!r.retired && r.retouchBase !== null && !r.leg?.returning) {
        if (t < r.returnReadyAt!) { runnerDecisionPending = true; continue; }
        const position = runnerAt(r, t), velocity = runnerVelocityAt(r, t), motion = createLiveRunnerRetreatMotionV1({
          position, velocity, bases: { 1: base(1), 2: base(2), 3: base(3), 4: base(4) }, originBase: r.retouchBase,
          lastTouchedBase: r.base, topSpeedMps: r.spec.topSpeedMps, accelerationMps2: r.spec.accelerationMps2,
          roundingRadiusMeters: r.spec.roundingRadiusMeters ?? 4.5,
          lateralAccelerationMps2: r.spec.lateralAccelerationMps2 ?? 1.5 * r.spec.accelerationMps2,
          baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28 });
        if (motion) {
          r.leg = { from: t, to: (motion.touches[0]?.base ?? r.retouchBase) as BaseballBase, motion, nextTouchIndex: 0,
            height: position.y, departure: null, returning: true };
          runnerMotions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, throughBases: motion.touches.map(b => b.base), position, velocity,
            durationSeconds: motion.durationSeconds, lengthMeters: motion.lengthMeters, route: motion.route });
          if (!physicalBaseDepartures.has(r.spec.runnerId) && r.base > 0)
            scheduleDeparture(r.leg, r.base as BaseballBase, 0, motion.touches[0]?.centerElapsedSeconds ?? motion.durationSeconds);
        }
        continue;
      }
      if (r.retired || r.scored || r.leg) continue;
      const forced = deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId);
      const next = r.base + 1;
      if (next > 4) continue;
      const targetOccupied = targetOccupiedByOther(r, next);
      // Conservative defense estimate, using observed flight forecasts and
      // player SI. Straight-flight time is an optimistic lower bound for the
      // defense, not a fabricated catch or a fixed global throwing velocity.
      const air = airborneAssessment(r), canConsider = firstGroundContactSeconds !== null || firstFielderTouchSeconds !== null
        || air !== undefined && air.catchMarginSeconds < -(r.spec.advanceSafetyMarginSeconds ?? .35),
        defenderControlSeconds = r.base === 0 || forced && firstGroundContactSeconds !== null || !canConsider ? null : estimateDefenseControl(r, next);
      const awardTarget = overFence?.fair ? Math.min(4, (overFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + (overFence.untouchedGround ? 4 : 2)) : null;
      const decision = decideLiveRunnerAdvanceV1({ nowSeconds: t, playStartedAtSeconds: start, currentBase: r.base as 0 | 1 | 2 | 3, outs: input.outs as 0 | 1 | 2,
        distanceToNextBaseMeters: distance(flat(runnerAt(r, t)), flat(base(next))), baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28,
        targetOccupied, runner: r.spec, forced,
        awardThroughBase: awardTarget as BaseballBase | null,
        firstGroundContactElapsedSeconds: firstGroundContactSeconds,
        firstFielderTouchElapsedSeconds: firstFielderTouchSeconds,
        defenderControlSeconds, airborneAssessment: air, policy: { safetyMarginSeconds: r.spec.advanceSafetyMarginSeconds } });
      if (decision.reason === 'recognizing_departure_cue' && !targetOccupied) runnerDecisionPending = true;
      const previous = runnerDecisions.slice().reverse().find(d => d.runnerId === r.spec.runnerId);
      if (!previous || previous.targetBase !== next || previous.reason !== decision.reason || decision.advance)
        runnerDecisions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, targetBase: next, defenderControlSeconds, ...decision });
      if (decision.advance && !(r.base === 0 && flyCatch) && !(dead && awardTarget === null)) beginLeg(r, next as BaseballBase, t, defenderControlSeconds);
    }
    for (const r of runners.slice().sort((a, b) => b.base - a.base)) {
      const leg = r.leg;
      if (slideCommittedV115(r,t)) continue;
      if (protectedFirstOverrunV95(r) && r.retouchBase === null && !dead
        && t >= (roundingRecheckAfter.get(r.spec.runnerId) ?? -Infinity) && !targetOccupiedByOther(r, 2)) {
        roundingRecheckAfter.set(r.spec.runnerId, t + .12);
        const defense = estimateDefenseControl(r, 2), position = runnerAt(r, t), velocity = runnerVelocityAt(r, t),
          next = defense === null ? null : createLiveRunnerMotionV1({ position, velocity, bases: [{ base: 2, position: base(2) }],
            topSpeedMps: r.spec.topSpeedMps, accelerationMps2: r.spec.accelerationMps2,
            roundingRadiusMeters: r.spec.roundingRadiusMeters ?? 4.5, lateralAccelerationMps2: r.spec.lateralAccelerationMps2 ?? 1.5 * r.spec.accelerationMps2,
            ...(r.spec.technicalSkills === undefined ? {} : { technicalSkills: r.spec.technicalSkills }), baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28 });
        if (next && defense! - next.touches[0].elapsedSeconds > (r.spec.advanceSafetyMarginSeconds ?? .35)) { beginLeg(r, 2, t, defense); continue; }
      }
      if (!leg || leg.returning || r.retouchBase !== null || r.retired || r.scored || leg.departure !== null && leg.nextTouchIndex > 0 || leg.nextTouchIndex >= leg.motion.touches.length
        || new Set(leg.motion.touches.slice(leg.nextTouchIndex).map(b => b.base)).size > 1 || leg.to >= 4
        || t < (roundingRecheckAfter.get(r.spec.runnerId) ?? -Infinity)) continue;
      const awardThrough = overFence?.fair ? Math.min(4, (overFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + (overFence.untouchedGround ? 4 : 2)) : null,
        cue = firstGroundContactSeconds ?? firstFielderTouchSeconds;
      const airborne = cue === null ? airborneAssessment(r) : undefined;
      if (awardThrough === null && (dead || (cue === null ? !airborne || airborne.catchMarginSeconds >= -(r.spec.advanceSafetyMarginSeconds ?? .35)
        : t < cue + r.spec.reactionSeconds))) continue;
      const finalBase = awardThrough !== null ? awardThrough : leg.to + 1;
      if (finalBase <= leg.to || Array.from({ length: finalBase - leg.to + 1 }, (_, i) => leg.to + i).some(n => targetOccupiedByOther(r, n))) continue;
      roundingRecheckAfter.set(r.spec.runnerId, t + .12);
      const defense = estimateDefenseControl(r, finalBase);
      if (awardThrough === null && (defense === null || distance(flat(runnerAt(r, t)), flat(base(finalBase))) / r.spec.topSpeedMps
        + (r.spec.advanceSafetyMarginSeconds ?? .35) >= defense)) continue;
      const position = runnerAt(r, t), velocity = runnerVelocityAt(r, t), motion = createLiveRunnerMotionV1({ position, velocity,
        bases: Array.from({ length: finalBase - leg.to + 1 }, (_, i) => ({ base: leg.to + i, position: base(leg.to + i) })),
        topSpeedMps: r.spec.topSpeedMps, accelerationMps2: r.spec.accelerationMps2,
        roundingRadiusMeters: r.spec.roundingRadiusMeters ?? 4.5,
        ...(r.spec.technicalSkills === undefined ? {} : { technicalSkills: r.spec.technicalSkills }),
        lateralAccelerationMps2: r.spec.lateralAccelerationMps2 ?? 1.5 * r.spec.accelerationMps2,
        baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28 });
      if (!motion || awardThrough === null && defense! - motion.touches[motion.touches.length - 1].elapsedSeconds <= (r.spec.advanceSafetyMarginSeconds ?? .35)) continue;
      r.leg = { from: t, to: leg.to, motion, nextTouchIndex: 0, height: position.y, departure: null };
      if (leg.departure !== null) scheduleDeparture(r.leg, leg.departure.base, 0, motion.touches[0]?.centerElapsedSeconds ?? motion.durationSeconds);
      runnerMotions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, throughBases: motion.touches.map(b => b.base), position, velocity,
        durationSeconds: motion.durationSeconds, lengthMeters: motion.lengthMeters, route: motion.route });
    }
  };
  const applyBaseControl = (f: Fielder, n: BaseballBase, t: number) => {
    const current = controlledBaseContacts.at(-1);
    if (current?.defenderId === f.spec.playerId && current.base === n && tick(t) - current.tick < tps / 5) return;
    controlledBaseContacts.push({ kind: 'controlled_base_contact', defenderId: f.spec.playerId, base: n, tick: tick(t) });
    emit('controlled_base_contact', t, { playerId: f.spec.playerId, base: n });
    for (const o of deriveCurrentForceObligations(force)) if (o.targetBase === n) {
      const r = runners.find(r => r.spec.runnerId === o.runnerId)!;
      if (r.leg || r.base !== n) retire(r, t);
    }
    for (const r of runners) if (!r.retired && r.retouchBase === n) appeal(r, f, t);
  };
  const appeal = (r: Runner, f: Fielder, t: number) => {
    const origin = r.retouchBase!;
    defensiveAppeals.push({ kind: 'defensive_appeal_attempt', defenderId: f.spec.playerId, runnerId: r.spec.runnerId,
      base: origin, reason: 'tag_up_early_departure', tick: tick(t) });
    if (!flyCatch || !runnerDepartures.some(d => d.runnerId === r.spec.runnerId && d.base === origin && d.tick < flyCatch!.firstTouchTick)) {
      unresolvedDetail = { kind: 'unproven_tag_up_origin_departure', runnerId: r.spec.runnerId, tick: tick(t) };
      terminal = true; endReason = 'tag_up_appeal_refinement_required'; return;
    }
    const retouch = r.leg?.motion.touches.slice(r.leg.nextTouchIndex).find(b => b.base === origin);
    if (retouch && r.leg && tick(r.leg.from + retouch.elapsedSeconds) === tick(t)) {
      unresolvedDetail = { kind: 'simultaneous_tag_up_appeal_retouch', runnerId: r.spec.runnerId, tick: tick(t) };
      terminal = true; endReason = 'tag_up_appeal_refinement_required'; return;
    }
    retire(r, t);
  };
  let controlThrough = start, nextFrame = start, terminal = false;
  const confirmAirCatchV115=(f:Fielder,t:number)=>{
    if(flyCatch)return;
    flyCatch={fielderId:f.spec.playerId,firstTouchTick:firstTouchTick!,secureCatchTick:tick(t)};retire(batter,t);airCatchV115=null;
    for(const r of runners)if(!r.retired&&r.spec.initialBase>0&&!tagUpAtFirstTouch.get(r.spec.runnerId)){
      const left=runnerDepartures.slice().reverse().find(d=>d.runnerId===r.spec.runnerId&&d.base===r.spec.initialBase&&d.tick<=firstTouchTick!),
        retouched=runnerTouches.some(b=>b.runnerId===r.spec.runnerId&&b.base===r.spec.initialBase&&b.tick>=firstTouchTick!&&b.tick<=tick(t));
      if(retouched||left&&left.tick===firstTouchTick)continue;
      r.retouchBase=r.spec.initialBase as 1|2|3;r.returnReadyAt=t+r.spec.reactionSeconds;r.scored=false;
    }
  };
  observe(start);
  while (time < max && !terminal) {
    // A grounded landing impulse is applied before issuing the next motor
    // segment. Retain the ball using its pre-impact velocity, not an automatic
    // catch flag. Jump landings already use a finite absorption segment.
    for(const f of defenders){const action=f.athleticV115;
      if(!action||time<action.landedSeconds||landingReviewedV115.has(action))continue;
      landingReviewedV115.add(action);
      if(action.kind!=='dive'||possession!==f&&pendingCatch?.fielder!==f)continue;
      const b=ballAt(time),grip=at(f.glove,time),before=action.sampleAtElapsedSeconds(action.landedSeconds-1e-8).velocity,
        after=action.sampleAtElapsedSeconds(action.landedSeconds).velocity,hand=add(velocityAt(f.glove,time),sub(after,before)),
        retained=resolveCatchRetention({contactTick:tick(time),ball:{tick:tick(time),position:b.position,velocity:b.velocity,spin:b.spin},
          glove:{tick:tick(time),position:grip,velocity:hand},contactNormal:v(0,1,0),pocketOffsetMeters:0,bodyStability:1},f.spec.catchRetention);
      if(retained.outcome.kind!=='secured'){
        possession=null;pendingCatch=null;airCatchV115=null;throwTarget=null;releaseAt=null;handPreparation=null;
        kernel=build({originTick,elapsedSeconds:time,ball:retained.outcome.ball},b.orientation);wallContact=null;orientationBasis=b.orientation;side='outgoing';
        f.catchEnabledAfter=time+.08;controlThrough=time;emit('glove_contact',time,{playerId:f.spec.playerId,position:b.position,reason:'landing_retention_failed'});
      }
    }
    if(airCatchV115&&possession===airCatchV115&&time>=airCatchV115.athleticV115!.throughSeconds)confirmAirCatchV115(airCatchV115,time);
    if(retiredCount+input.outs>=3){endReason='third_out';terminal=true;break;}
    if (time === controlThrough) { controlThrough = Math.min(max, time + LIVE_FIELD_TEST_MODEL_V1.controlSeconds); ensureThrough(controlThrough); plan(time, controlThrough);
      if (motorBoundaryFailure) { unresolvedDetail = motorBoundaryFailure; endReason = 'actor_boundary_motor_required'; break; } }
    type Event = { kind: string; t: number; f?: Fielder; role?: 'glove' | 'body'; hit?: Hit; base?: BaseballBase; runner?: Runner;
      pole?: Extract<SourceFreeBallWorldQueryResultV2, { kind: 'moving' | 'resting' | 'boundary' }>; poleQueryV213?: SourceFreePoleQueryInputV148 };
    let horizon = controlThrough, event: Event | null = null;
    const choose = (e: NonNullable<typeof event>) => { if (!event || e.t < event.t) { event = e; horizon = e.t; } };
    if (pendingCatch && pendingCatch.secure <= horizon) choose({ kind: 'secure', t: Math.max(time, pendingCatch.secure) });
    const currentHandPreparation = handPreparation as HandPreparationState | null;
    if (currentHandPreparation && !currentHandPreparation.prepared && currentHandPreparation.curve.throughElapsedSeconds <= horizon)
      choose({ kind: 'hand_prepared', t: currentHandPreparation.curve.throughElapsedSeconds });
    if (releaseAt !== null && releaseAt <= horizon) choose({ kind: 'release', t: Math.max(time, releaseAt) });
    for (const r of runners) if (r.leg) {
      const touch = r.leg.motion.touches[r.leg.nextTouchIndex], atTime = r.leg.from + (touch?.elapsedSeconds ?? r.leg.motion.durationSeconds);
      if (atTime <= horizon) choose({ kind: touch ? 'arrival' : 'runner_stop', runner: r, t: atTime });
      if (r.leg.departure && r.leg.departure.elapsedSeconds <= horizon)
        choose({ kind: 'runner_departure', runner: r, t: r.leg.departure.elapsedSeconds });
    }
    for (const r of runners) if (r.retiredSlideV115) {
      const stop = r.retiredSlideV115.from + r.retiredSlideV115.motion.durationSeconds;
      if (stop > time && stop <= horizon) choose({ kind: 'retired_runner_stop', runner: r, t: stop });
    }
    if (!possession && !pendingCatch && !dead) {
      const ground = kernel.boundaries.find(b => b.kind !== 'rolling_stop' && b.kind !== 'rolling_started' && b.elapsedSeconds > time && b.elapsedSeconds <= horizon)
        ?? kernel.boundaries.find(b => b.kind !== 'rolling_started' && b.elapsedSeconds > time && b.elapsedSeconds <= horizon);
      if (ground) choose({ kind: ground.kind, t: ground.elapsedSeconds });
      const cache = new Map<number, ReturnType<typeof kernel.evaluateAt>>();
      const evaluated = (t: number) => { let e = cache.get(t); if (!e) { e = kernel.evaluateAt(t, 'incoming'); cache.set(t, e); } return e; };
      const cellStart = kernel.cells.findIndex(c => c.throughElapsedSeconds >= time);
      for (let ci = Math.max(0, cellStart); ci < kernel.cells.length; ci++) {
        const cell = kernel.cells[ci]; if (cell.fromElapsedSeconds > horizon) break;
        const lo = Math.max(time, cell.fromElapsedSeconds), hi = Math.min(horizon, cell.throughElapsedSeconds); if (hi <= lo) continue;
        for (const f of defenders) for (const role of ['glove', 'body'] as const) {
          if (role === 'glove' && (time < f.catchEnabledAfter || releaseOpen === f)) continue;
          const c = role === 'glove' ? f.glove : actualHipCurveV105(f), radius = role === 'glove' ? f.spec.gloveRadiusMeters : LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters;
          const gap = (t: number) => distance(evaluated(t).moment.ball.position, at(c, t)) - radius - input.physics.ground.radiusM;
          let from = lo;
          if (reboundEscape?.fielder === f && reboundEscape.role === role && lo === reboundEscape.outgoing.elapsedSeconds && gap(lo) <= 0) {
            const proof = reboundEscape, rel = sub(proof.outgoing.ball.velocity, velocityAt(c, lo)), outward = rel.x * proof.normal.x + rel.y * proof.normal.y + rel.z * proof.normal.z;
            const ballDeviation = kernel.evaluateAt(lo, 'outgoing').phase === 'airborne'
              ? sourceRk4PositionBounds(proof.outgoing.ball, hi - lo, input.physics.air).linearDeviationMps2
              : Math.max(input.physics.ground.material.slidingFriction * input.physics.ground.gravityMps2, input.physics.ground.material.rollingDecelerationMps2) / 2;
            const deviation = ballDeviation + maximumCurveAcceleration(c, hi) / 2;
            const span = Math.min(hi - lo, deviation > 0 ? outward / (2 * deviation) : hi - lo), escape = 2 * (-gap(lo) + cell.positionRoundingBoundMeters) / outward;
            const penetrationBound = proof.hit.rounding + proof.hit.speed * (proof.hit.t - proof.hit.from),
              lower = gap(lo) + outward * escape - deviation * escape * escape - cell.positionRoundingBoundMeters;
            if (!(tick(proof.hit.t) === tick(proof.hit.from) && gap(lo) >= -penetrationBound && outward > 0 && escape >= 0
              && Number.isFinite(escape) && escape < span && lower > 0 && gap(lo + escape) > 0 && gap(lo + span) > 0)) {
              unresolvedDetail = { kind: 'contact_departure', outward, escape, span, signedGap: gap(lo), rounding: cell.positionRoundingBoundMeters, witness: proof.hit };
              choose({ kind: 'unresolved', t: time }); continue;
            }
            departureProofs.push({ kind: 'actor', from: lo, through: lo + span, escapeThrough: lo + escape, signedGap: gap(lo),
              penetrationBoundMeters: penetrationBound, supportingPlaneLowerGapMeters: lower, actualGapAtEscapeMeters: gap(lo + escape) });
            from = lo + span;
          }
          if (from < hi) {
            collisionQueries++;
            const hit = findContact(gap, cell.maximumPositionSpeedMps + maximumCurveSpeed(c, from, hi), cell.positionRoundingBoundMeters, from, hi);
          if (hit) { const unsupported = hit.ambiguous || tick(hit.from) !== tick(hit.t);
              if (unsupported) unresolvedDetail = { kind: 'actor_contact_refinement', playerId: f.spec.playerId, role, hit };
              choose({ kind: unsupported ? 'unresolved' : role, t: hit.t, f, role, hit }); }
          }
        }
        if (!wallContact) {
        const radius = fenceRadius - input.physics.ground.radiusM;
        const gap = (t: number) => radius - distance(flat(evaluated(t).moment.ball.position), flat(fenceCenter));
        let fenceFrom = lo;
        if (fenceEscape?.from === lo && fenceEscape.radius === radius && gap(lo) <= 0) {
          const d = flat(sub(evaluated(lo).moment.ball.position, fenceCenter)), radial = norm(d), vel = evaluated(lo).moment.ball.velocity;
          const outward = -(d.x * vel.x + d.z * vel.z) / radial, speed = cell.maximumPositionSpeedMps;
          const ballDeviation = kernel.evaluateAt(lo, 'outgoing').phase === 'airborne'
            ? sourceRk4PositionBounds(fenceEscape.outgoing.ball, hi - lo, input.physics.air).linearDeviationMps2
            : Math.max(input.physics.ground.material.slidingFriction * input.physics.ground.gravityMps2, input.physics.ground.material.rollingDecelerationMps2) / 2;
          const denominator = radial - speed * (hi - lo), deviation = ballDeviation + speed * speed / (2 * Math.max(denominator, Number.MIN_VALUE));
          const span = Math.min(hi - lo, outward / (2 * deviation)), escape = 2 * (-gap(lo) + cell.positionRoundingBoundMeters) / outward;
          const hit = fenceEscape.witness, penetrationBound = hit.rounding + hit.speed * (hit.t - hit.from),
            lower = gap(lo) + outward * escape - deviation * escape * escape - cell.positionRoundingBoundMeters;
          if (!(tick(hit.t) === tick(hit.from) && gap(lo) >= -penetrationBound && denominator > 0 && outward > 0 && Number.isFinite(escape)
            && escape >= 0 && escape < span && lower > 0 && gap(lo + escape) > 0 && gap(lo + span) > 0)) {
            unresolvedDetail = { kind: 'fence_departure', denominator, outward, escape, span, gap: gap(lo), rounding: cell.positionRoundingBoundMeters,
              actualGapAtEscape: escape >= 0 && escape <= hi - lo ? gap(lo + escape) : null, actualGapAtEnd: gap(lo + span) };
            choose({ kind: 'unresolved', t: time });
          }
          else { departureProofs.push({ kind: 'fence', from: lo, through: lo + span, escapeThrough: lo + escape,
            signedGap: gap(lo), penetrationBoundMeters: penetrationBound, supportingPlaneLowerGapMeters: lower, actualGapAtEscapeMeters: gap(lo + escape) });
            fenceFrom = lo + span; }
        }
        const crossing = fenceFrom < Math.min(hi, horizon) ? findContact(gap, cell.maximumPositionSpeedMps,
          cell.positionRoundingBoundMeters, fenceFrom, Math.min(hi, horizon)) : null;
        if (crossing) choose({ kind: crossing.ambiguous || tick(crossing.from) !== tick(crossing.t) ? 'unresolved' : 'fence', t: crossing.t, hit: crossing });
        }
        if (!hasThrown && firstGroundContactTick !== null && !territoryFixed) {
          const gate = findContact(t => distance(flat(base(1)), flat(base(0))) - distance(flat(evaluated(t).moment.ball.position), flat(base(0))),
            cell.maximumPositionSpeedMps, cell.positionRoundingBoundMeters, lo, Math.min(hi, horizon));
          if (gate) choose({ kind: gate.ambiguous || tick(gate.from) !== tick(gate.t) ? 'unresolved' : 'fair_foul_gate', t: gate.t });
        }
      }
    }
    if (possession && !dead && airCatchV115!==possession) {
      const f = possession, speed = Math.max(norm(velocityAt(f.body, time)), norm(velocityAt(f.body, horizon)));
      for (const n of [1, 2, 3, 4] as const) {
        // Physical event discovery uses actual outstanding obligations. A
        // player's delayed belief can remain stale after an actual touch;
        // feeding that belief back here would repeat the same zero-time fact.
        const relevant = legacyOutTargetsV117().some(o => (o.forced || o.appeal) && o.targetBase === n);
        if (!relevant) continue;
        const hit = findContact(t => {
          if(!athleticActiveV115(f,t))return distance(flat(at(f.body,t)),flat(base(n)))-(field.baseTouchRadiusMeters??.28);
          const foot=poseV105(f,t)!.foot;
          return Math.max(distance(flat(foot),flat(base(n)))-(field.baseTouchRadiusMeters??.28),Math.abs(foot.y-base(n).y)-.02);
        },athleticActiveV115(f,time)?Math.max(speed,f.athleticV115!.maximumPointSpeedMps):speed,128*Number.EPSILON,time,horizon);
        if (hit && !hit.ambiguous) choose({ kind: 'base', t: hit.t, f, base: n });
      }
      for (const r of runners) if (!r.retired && !r.scored && !protectedFirstOverrunV95(r)) {
        const forced = deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId);
        if (!r.leg && !forced && r.retouchBase === null) continue;
        // This committed motor retains its real limb contact after arrival.
        // At the inclusive disk boundary a signed gap of zero is protection,
        // not a new tag witness on the same tick as the actual touch.
        if (slideMotionV115(r.leg) && r.leg!.nextTouchIndex > 0 && r.base > 0 && !forced && r.retouchBase === null
          && distance(flat(runnerTouchPointV115(r,time)),flat(base(r.base))) <= (field.baseTouchRadiusMeters ?? .28)
          && distance(flat(runnerTouchPointV115(r,horizon)),flat(base(r.base))) <= (field.baseTouchRadiusMeters ?? .28)) continue;
        const hit = findContact(t => Math.max(runnerTagGapV115(r,t,at(f.glove,t)),
          r.base > 0 && !forced && r.retouchBase === null ? (field.baseTouchRadiusMeters ?? .28) - distance(flat(runnerTouchPointV115(r,t)), flat(base(r.base))) : -Infinity),
          maximumCurveSpeed(f.glove, time, horizon) + Math.max(r.spec.topSpeedMps,slideMotionV115(r.leg)?.slideV115.maximumBodySpeedMps??0), 128 * Number.EPSILON, time, horizon);
        if (hit && !hit.ambiguous) choose({ kind: 'tag', t: hit.t, f, runner: r });
      }
    }
    if (poleSessionV148 && !possession && !pendingCatch && !dead) {
      if (!freeScope) {
        // A constrained wall curve is not a free Source descriptor. Never
        // substitute a fictitious free curve or silently omit its equipment.
        const window = constrainedWallCurveV170?.queryNoPoleContactWindowV170({fromElapsedSeconds:time,
          throughElapsedSeconds:horizon,poles:field.poleEquipmentV148!.poles});
        if(window?.kind==='clear')constrainedPoleWindowsV170.push(window);
        else {
          unresolvedDetail = { kind: 'constrained_pole_motion_not_supported_v148',...(window?{window}: {}) };
          choose({ kind: 'unresolved', t: time });
        }
      } else {
        // All actual actor, ground, fence and runner candidates have already
        // capped this horizon. Perception/forecast curves are not colliders.
        const poleQueryV213: SourceFreePoleQueryInputV148 = { descriptor: freeScope.descriptor,
          moment: kernel.evaluateAt(time, side).moment, side, throughElapsedSeconds: horizon };
        const observed = poleSessionV148.query(poleQueryV213);
        if (observed.kind === 'unresolved') {
          unresolvedDetail = { kind: 'pole_refinement_v148', interval: observed.interval };
          choose({ kind: 'unresolved', t: observed.interval.from });
        } else if (observed.kind === 'boundary' && observed.contacts.some(c => c.kind === 'surface')) {
          const current = event as Event | null,
            firstPossible = observed.contactSearchWitnesses.length
              ? Math.min(...observed.contactSearchWitnesses.map(w => w.firstPossibleElapsedSeconds)) : observed.moment.elapsedSeconds,
            contact = observed.contacts[0], normal = contact.kind === 'surface' ? contact.normal : null,
            incomingVelocity = observed.moment.ball.velocity,
            inward = normal ? incomingVelocity.x * normal.x + incomingVelocity.y * normal.y + incomingVelocity.z * normal.z : 0;
          let actualFirst = current?.hit?.from ?? current?.t ?? Infinity;
          if (current && (current.kind === 'ground' || current.kind === 'rolling_stop')) {
            // A ground root has no actor Hit. Retain the original query's
            // time bracket and round its subtraction down, never call it exact.
            const bits = new DataView(new ArrayBuffer(8)), lower = current.t - observed.numericalResolution.contactBracketSeconds;
            bits.setFloat64(0, lower); bits.setBigUint64(0, bits.getBigUint64(0) + (lower > 0 ? -1n : 1n));
            actualFirst = Math.max(time, lower === 0 ? -Number.MIN_VALUE : bits.getFloat64(0));
          }
          if (observed.pendingReason || observed.contacts.length !== 1 || !normal || !(inward < 0)
            || !(observed.moment.elapsedSeconds > time) || !(observed.moment.elapsedSeconds < actualFirst)) {
            unresolvedDetail = { kind: 'pole_contact_order_v148', firstPossible, witness: observed.moment.elapsedSeconds,
              actualFirst, actualWitness: current?.t ?? null };
            // Neither response wins when their certified time intervals overlap.
            event = { kind: 'unresolved', t: Math.min(firstPossible, actualFirst) }; horizon = event.t;
          } else choose({ kind: 'pole', t: observed.moment.elapsedSeconds, pole: observed, poleQueryV213 });
        }
      }
    }
    while (nextFrame < horizon) { sampleFrame(nextFrame); nextFrame = start + frames.length * frameSeconds; }
    time = horizon;
    // The explicit cast prevents TS losing mutations performed by choose().
    const e = event as Event | null;
    if (e) {
      if (e.kind === 'unresolved') { endReason = 'numerical_contact_refinement_required'; terminal = true; }
      else if (e.kind === 'pole') {
        const observed = e.pole!, contact = observed.contacts[0], scope = freeScope as FreeScope | null;
        if (contact.kind !== 'surface' || !contact.normal || !scope) throw Error('live pole lacks its actual free Source contact');
        const witnessV213 = captureLivePoleContactWitnessV213({ clock: { originTick, ticksPerSecond: tps },
          geometry: { bases: field.bases, fence: { fenceCenter, fenceRadiusMeters: fenceRadius, fenceHeightMeters: field.fenceHeightMeters },
            equipment: field.poleEquipmentV148! }, sourceQuery: e.poleQueryV213!, contact,
          search: { authority: observed.authority, phase: observed.phase, numericalResolution: observed.numericalResolution, contactSearchWitnesses: observed.contactSearchWitnesses },
          prefixBinding: { playInitialMoment: input.ball, precedingFactCount: facts.length, hasThrown, firstGroundContactSeconds, firstFielderTouchSeconds } });
        const material = field.poleEquipmentV148!.materials.find(m => m.surfaceId === contact.surfaceId)!.material,
          incoming = kernel.evaluateAt(time, 'incoming'), originalThrough = scope.through,
          outgoing = respondToBallContact({ ball: contact.moment.ball, normal: contact.normal, surfaceVelocity: v(), material });
        orientationBasis = incoming.materialOrientation ?? multiplyQuaternions(incoming.orientation, orientationBasis);
        const outward = outgoing.velocity.x * contact.normal.x + outgoing.velocity.y * contact.normal.y + outgoing.velocity.z * contact.normal.z;
        if (!(outward > 0)) {
          unresolvedDetail = { kind: 'pole_support_required_v148', surfaceId: contact.surfaceId };
          endReason = 'numerical_contact_refinement_required'; terminal = true; continue;
        }
        const next = build({ ...contact.moment, ball: outgoing }, orientationBasis, originalThrough);
        poleSessionV148!.adoptPoleImpulse(observed, next.descriptor);
        poleContactWitnessesV213.push(witnessV213);
        kernel = next; wallContact = null; side = 'outgoing';
        emit('pole_contact', time, { position: contact.moment.ball.position, surfaceId: contact.surfaceId });
      } else if (e.kind === 'ground' || e.kind === 'rolling_stop') {
        if (e.kind === 'ground') { if (!hasThrown) { firstGroundContactTick ??= tick(time); firstGroundContactSeconds ??= time; }
          emit('ground_contact', time, { position: kernel.evaluateAt(time, 'incoming').moment.ball.position }); }
        side = 'outgoing';
        if (!territoryFixed && (distance(flat(ballAt(time).position), flat(base(0))) >= distance(flat(base(1)), flat(base(0))) || e.kind === 'rolling_stop')) {
          determineTerritory(time, isFair(ballAt(time).position) ? 'fair' : 'foul');
          if (territory === 'foul') { dead = true; terminal = true; endReason = 'foul_dead_ball'; }
        }
      } else if (e.kind === 'fair_foul_gate') {
        determineTerritory(time, isFair(kernel.evaluateAt(time, 'incoming').moment.ball.position) ? 'fair' : 'foul');
        if (territory === 'foul') { dead = true; terminal = true; endReason = 'foul_dead_ball'; }
      } else if (e.kind === 'glove' || e.kind === 'body') {
        const f = e.f!, c = e.role === 'glove' ? f.glove : actualHipCurveV105(f), incoming = kernel.evaluateAt(time, 'incoming'), center = at(c, time), delta = sub(incoming.moment.ball.position, center), normal = mul(delta, 1 / norm(delta));
        const phase = incoming.materialOrientation ?? multiplyQuaternions(incoming.orientation, orientationBasis);
        if (!territoryFixed) determineTerritory(time, isFair(incoming.moment.ball.position) ? 'fair' : 'foul');
        if (firstTouchTick === null) for (const r of runners) if (r.spec.initialBase > 0)
          tagUpAtFirstTouch.set(r.spec.runnerId, distance(flat(runnerAt(r, time)), flat(base(r.spec.initialBase))) <= (field.baseTouchRadiusMeters ?? .28));
        firstTouchTick ??= tick(time); firstFielderTouchSeconds ??= time;
        if (territory === 'foul' && firstGroundContactTick !== null) { dead = true; terminal = true; endReason = 'foul_dead_ball'; continue; }
        let outgoing;
        if (e.kind === 'glove') {
          if (f.spec.bodyModelV105) { const pose = poseV105(f, time)!; bodyGeometryV105.contacts.push({ playerId: f.spec.playerId, elapsedSeconds: time, kind: 'contact', glove: at(f.glove, time), pose, reachMarginMeters: pose.reachMarginMeters! }); }
          emit('glove_contact', time, { playerId: f.spec.playerId, position: incoming.moment.ball.position });
          // The spherical capture-volume model has a local entry plane at the
          // contact normal. Normal radii are not a lateral miss of the pocket.
          // A future oriented aperture may supply a different entry-center pose.
          const ballSurfacePoint = sub(incoming.moment.ball.position, mul(normal, input.physics.ground.radiusM));
          const pocketEntryCenter = add(center, mul(normal, f.spec.gloveRadiusMeters));
          const pocketOffsetMeters = distance(ballSurfacePoint, pocketEntryCenter);
          const bodySpd = norm(velocityAt(f.body, time)), gloveExt = distance(center, f.spec.bodyModelV105 ? poseV105(f, time)!.shoulder : at(f.body, time)),
            gloveRelSpd = norm(sub(velocityAt(c, time), velocityAt(f.body, time))),
            speedRatio = clamp(bodySpd / Math.max(f.spec.topSpeedMps, .1), 0, 1),
            extRatio = clamp(gloveExt / Math.max(f.spec.bodyModelV105?.armReachMeters ?? f.spec.gloveReachMeters, .1), 0, 1),
            gloveMoveRatio = clamp(gloveRelSpd / Math.max(f.spec.gloveSpeedMps, .1), 0, 1),
            legacyStability = clamp(1 - .22 * speedRatio * speedRatio - .20 * Math.max(0, extRatio - .55) / .45 - .15 * gloveMoveRatio, .42, 1),
            skill = f.spec.technicalSkills?.advanced_fielding ?? 0,
            bodyStability = skill > 0 ? clamp(legacyStability + (1 - legacyStability) * .08 * skill, .42, 1) : legacyStability;
          const retention = resolveCatchRetention({ contactTick: tick(time), ball: { ...incoming.moment.ball, tick: tick(time) },
            glove: { tick: tick(time), position: center, velocity: velocityAt(c, time) }, contactNormal: normal,
            pocketOffsetMeters, bodyStability }, f.spec.catchRetention);
          contactDiagnostics.push({ elapsedSeconds: time, playerId: f.spec.playerId, role: 'glove',
            ballSpeedMps: norm(incoming.moment.ball.velocity), bodySpeedMps: bodySpd,
            gloveOffsetMeters: gloveExt, intent: f.intent, targetBase: f.targetBase,
            distanceToTargetBaseMeters: f.targetBase ? distance(flat(at(f.body, time)), flat(base(f.targetBase))) : null,
            retention: { outcome: retention.outcome.kind, retentionLoadJ: retention.diagnostics.retentionLoadJ,
              effectiveCapacityJ: retention.diagnostics.effectiveCapacityJ, pocketOffsetMeters, bodyStability,
              ballVelocity: incoming.moment.ball.velocity, gloveVelocity: velocityAt(c,time),
              relativeVelocity: retention.diagnostics.relativeVelocity, translationalEnergyJ: retention.diagnostics.translationalEnergyJ,
              rotationalEnergyJ: retention.diagnostics.rotationalEnergyJ } });
          if (retention.outcome.kind === 'secured') {
            orientationBasis = phase;
            pendingCatch = { fielder: f, first: time, secure: time + Math.max(retention.diagnostics.retentionLoadJ / f.spec.catchRetention.captureDissipationPowerW,
                norm(delta) / f.spec.gloveSpeedMps),
              firstTouchWasAirborne: firstGroundContactTick === null, offset: delta, spin: incoming.moment.ball.spin,
              initialPosition: incoming.moment.ball.position, initialGlove: center };
            throwTarget = null; releaseOpen = null; reboundEscape = null;
            // Contact supplies a new local motor condition. Replan from the
            // same actual pose/velocity so pocket settling is also certified.
            controlThrough = time; continue;
          }
          outgoing = retention.outcome.ball;
        } else { emit('body_contact', time, { playerId: f.spec.playerId, position: incoming.moment.ball.position });
          contactDiagnostics.push({ elapsedSeconds: time, playerId: f.spec.playerId, role: 'body',
            ballSpeedMps: norm(incoming.moment.ball.velocity), bodySpeedMps: norm(velocityAt(f.body, time)),
            gloveOffsetMeters: distance(at(f.glove, time), at(f.body, time)), intent: f.intent, targetBase: f.targetBase,
            distanceToTargetBaseMeters: f.targetBase ? distance(flat(at(f.body, time)), flat(base(f.targetBase))) : null });
          outgoing = respondToBallContact({ ball: incoming.moment.ball, normal, surfaceVelocity: velocityAt(c, time), material: LIVE_FIELD_TEST_MODEL_V1.bodyMaterial }); }
        if (incoming.moment.ball.position.y === input.physics.ground.radiusM) {
          try {
            const coupled = resolveGroundedActorContactResponseV1({ incoming: incoming.moment.ball, actorResponse: outgoing,
              normal, surfaceVelocity: velocityAt(c, time), ground: input.physics.ground,
              actorRestitution: e.kind === 'glove' ? f.spec.catchRetention.failedContactRestitution : LIVE_FIELD_TEST_MODEL_V1.bodyMaterial.restitution });
            outgoing = coupled.ball; simultaneousContacts.push(coupled.proof);
            if (coupled.proof.groundMaterialResponseApplied || coupled.proof.groundImpulsePerMass > 0)
              emit('ground_contact', time, { position: incoming.moment.ball.position, reason: 'simultaneous_actor_ground_impulse' });
          } catch (error) { unresolvedDetail = { kind: 'simultaneous_actor_ground_contact', message: error instanceof Error ? error.message : String(error) };
            terminal = true; endReason = 'simultaneous_contact_response_required'; continue; }
        }
        // An actual failed reception/body rebound invalidates the issued flight,
        // including rebounds back toward the thrower which never pass the bag.
        // Release only the reservation; pursuit still uses ordinary observations.
        const deflectedTarget=throwTarget as {releasedAt?:number;base:BaseballBase;receiver:Fielder;point:Vec3}|null;
        if (deflectedTarget?.releasedAt !== undefined) {
          throwTargetCancellations.push({ elapsedSeconds: time, base: deflectedTarget.base, receiverPlayerId: deflectedTarget.receiver.spec.playerId,
            releasedAt: deflectedTarget.releasedAt, seenAt: time, distanceToTargetMeters: distance(flat(incoming.moment.ball.position), flat(deflectedTarget.point)) });
          throwTarget = null;
        }
        const moment = { ...incoming.moment, ball: outgoing }; kernel = build(moment, phase); wallContact = null; orientationBasis = phase; side = 'outgoing';
        reboundEscape = { fielder: f, role: e.role!, hit: e.hit!, normal, outgoing: kernel.evaluateAt(time, 'outgoing').moment };
      } else if (e.kind === 'hand_prepared') {
        handPreparation!.prepared = true; controlThrough = time;
        const preparedTarget = throwTarget as { effort: ThrowEffortCommandV103 } | null;
        if (releaseAt !== null) releaseAt = Math.max(time, preparedTarget?.effort.readyAt ?? time);
      } else if (e.kind === 'secure') {
        const c:{fielder:Fielder;firstTouchWasAirborne:boolean} = pendingCatch!; orientationBasis = ballAt(time).orientation; possession = c.fielder; pendingCatch = null; custodySince = time;
        rejectedThrows.clear(); relayCache.clear(); handPreparation = null;
        custodyChargeFromV103 = null;
        const transferOrdinalV152=custodyOrdinalV101++;
        custodyDelayV101 = sampleLiveTransferDelayV101(fieldRandomSeedV152('transfer-v101:'+possession.spec.playerId+':'+transferOrdinalV152), possession.spec.playerId, transferOrdinalV152, possession.spec.transferDelayMaxSecondsV101 ?? 0);
        if (input.fielders.some(f => (f.transferDelayMaxSecondsV101 ?? 0) > 0)) transferTimingsV101.push({ playerId: possession.spec.playerId, securedSeconds: time,
          baselineSeconds: effectiveTransferSeconds(possession) - custodyDelayV101, delaySeconds: custodyDelayV101, readySeconds: time + effectiveTransferSeconds(possession) });
        if (possession.spec.bodyModelV105) { const pose = poseV105(possession, time)!; bodyGeometryV105.contacts.push({ playerId: possession.spec.playerId, elapsedSeconds: time, kind: 'secure', glove: at(possession.glove,time), pose, reachMarginMeters: pose.reachMarginMeters! }); }
        emit('catch_secured', time, { playerId: possession.spec.playerId, position: at(possession.glove, time) });
        if(c.firstTouchWasAirborne&&!flyCatch){
          if(athleticActiveV115(possession,time))airCatchV115=possession;
          else confirmAirCatchV115(possession,time);
        }
      } else if (e.kind === 'release') {
        const f = possession!, target = throwTarget!, position = at(f.glove, time), q = target.point, d = sub(q, position);
        if(athleticActiveV115(f,time)){releaseAt=f.athleticV115!.throughSeconds;continue;}
        if (!pointInside(position, fenceRadius - input.physics.ground.radiusM)) {
          unresolvedDetail = { kind: 'held_ball_fence_constraint', playerId: f.spec.playerId, position };
          terminal = true; endReason = 'actor_boundary_motor_required'; continue;
        }
        const obligations = outTargets().filter(o => o.targetBase === target.base && o.runnerId === target.runnerId);
        const reject = (reason: string, flightSeconds?: number) => {
          if(individualV118&&input.recordDecisionTraceV118)decisionTraceV118.record(time,f.spec.playerId,{event:'throw_cancelled',
            commandId:target.effort.commandIdV118,reason,flightSeconds,observationSeconds:knowledgeV118(f,time).observationElapsedSeconds},undefined,'execution');
          for (const o of obligations) rejectedThrows.add(o.runnerId + ':' + o.targetBase);
          throwDecisions.push({ elapsedSeconds: time, base: target.base, reason, ...(flightSeconds === undefined ? {} : { flightSeconds }) });
          throwEffortCancellationsV103.push({ playerId: f.spec.playerId, from: time, commandFrom: target.effort.from, reason });
          runnerCueRevisionV95++; runnerCueAtV95 = time;
          throwTarget = null; releaseAt = null; handPreparation = null;
        };
        // A target may disappear while the physical hand/receiver is preparing.
        // Cancel before readiness guards can keep a stale command waiting.
        const routineRunner = target.routineReturn && runners.find(r => r.spec.runnerId === target.runnerId),
          observedRoutine=individualV118?knowledgeV118(f,time).runners.find(r=>r.runnerId===target.runnerId):null,
          routineStillValid = individualV118?!!observedRoutine&&!observedRoutine.retired&&!observedRoutine.scored&&observedRoutine.currentBase===1
            &&!!routineRunner&&!knownRunnerMovingV118(routineRunner,time,f)
            :routineRunner && !routineRunner.retired && !routineRunner.scored && routineRunner.base === 1
            && !advancingPast(routineRunner, 1, time) && (!routineRunner.leg || routineRunner.leg.to === 1);
        if (!obligations.length && !routineStillValid) { reject('force_already_satisfied'); continue; }
        const radial = sub(position, at(actualHipCurveV105(f), time));
        const preparation = handPreparation as HandPreparationState | null,
          preparationReady = preparation?.fielder === f && preparation.base === target.base && preparation.prepared,
          desiredOffset = preparationReady ? preparation!.curve.sampleAtElapsedSeconds(preparation!.curve.throughElapsedSeconds).offset : throwOffset(f, at(f.body, time), q,target.effort.releaseStyleV110),
          otherShapeClear = defenders.filter(other => other !== f).every(other =>
          distance(position, at(actualHipCurveV105(other), time)) > LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + input.physics.ground.radiusM
          && distance(position, at(other.glove, time)) > other.spec.gloveRadiusMeters + input.physics.ground.radiusM);
        const seenReceiverWorld = seenBy(f, time), observedReceiver = seenReceiverWorld?.actors.find(a => a.playerId === target.receiver.spec.playerId);
        if (!seenReceiverWorld || !observedReceiver) { releaseAt = controlThrough; if (releaseAt === time) releaseAt += LIVE_FIELD_TEST_MODEL_V1.controlSeconds; continue; }
        const observationAge = Math.max(0, time - seenReceiverWorld.t),
          distToBag = distance(flat(observedReceiver.position), flat(target.receiverPoint)),
          touchR = field.baseTouchRadiusMeters ?? .28,
          receiverEtaToBag = Math.max(0, (observedReceiver.postActionV120?estimateLivePostActionArrivalV1({...observedReceiver.postActionV120,
            actorId:observedReceiver.playerId,actor:observedReceiver,target:target.receiverPoint,arrivalMode:'receiver',radiusMeters:touchR}).remainingSeconds
            :estimateLiveReceiverArrivalV106(observedReceiver,target.receiverPoint,touchR))-observationAge);
        if (norm(radial) <= LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + input.physics.ground.radiusM
          || !preparationReady || time < Math.max(target.effort.readyAt,target.effort.releaseStyleV110==='glove_toss'?custodySince:custodySince+effectiveTransferSeconds(f)) || distance(radial, desiredOffset) > input.physics.ground.radiusM
          || !otherShapeClear) { releaseAt = controlThrough; if (releaseAt === time) releaseAt += LIVE_FIELD_TEST_MODEL_V1.controlSeconds; continue; }
        const horizontalSpeed = norm(flat(d)), backspin = f.spec.throwBackspinRadPerSecond ?? 0;
        assert(Number.isFinite(backspin) && backspin >= 0 && (!f.spec.throwSpinRadPerSecond || finite(f.spec.throwSpinRadPerSecond)), 'explicit throw spin differs');
        const spin = target.effort.releaseStyleV110==='glove_toss'?v():f.spec.throwSpinRadPerSecond ?? (horizontalSpeed > 0 ? v(-d.z / horizontalSpeed * backspin, 0, d.x / horizontalSpeed * backspin) : v());
        if(!target.outputRefreshedV110){
          // Early intent is not an immutable output cap: braking and the hand
          // path change the real launch boundary. Re-select once there, using
          // only charge actually accumulated; extra effort must still wait.
          const runnerSeconds=Math.max(...obligations.map(o=>runnerArrivalSeconds(runners.find(r=>r.spec.runnerId===o.runnerId)!,target.base,time))),
            action=planLiveThrowActionV103({releasePosition:position,bodyVelocity:velocityAt(f.body,time),capacityMps:target.effort.capacitySpeedMps,
              target:q,spin,physics:input.physics,remainingTransferSeconds:0,handPreparationSeconds:0,
              chargeElapsedSeconds:Math.max(0,time-target.effort.chargeFrom),throwEffortBuildSecondsV103:target.effort.fullChargeSeconds,
              receiverReadySeconds:receiverEtaToBag,
              ...(obligations.length?{deadlineSeconds:Math.max(0,Math.min(runnerSeconds-(target.receiver.spec.gloveRadiusMeters+input.physics.ground.radiusM)/target.receiver.spec.gloveSpeedMps,
                target.effort.plannedControlAtSeconds-time)-LIVE_FIELD_TEST_MODEL_V1.controlSeconds),
                preferStrongestFeasibleV103:target.effort.reason==='STRONGEST_FEASIBLE_COMPETITIVE_THROW'}:{}),
              ...(materialSeamsActive?{materialOrientationAtRelease:ballAt(time).orientation}:{})});
          if(action.kind!=='planned'){reject('aero_throw_unreachable');continue;}
          target.effort={...target.effort,from:time,commandSpeedMps:action.commandSpeedMps,effort:action.effort,
            requiredChargeSeconds:action.chargeSeconds,readyAt:target.effort.chargeFrom+action.chargeSeconds,
            plannedFlightSeconds:action.flightSeconds,plannedArrivalAtSeconds:time+action.releaseDelaySeconds+action.flightSeconds,
            plannedControlAtSeconds:time+action.controlSeconds,receiverReadyAtSeconds:time+receiverEtaToBag};
          throwEffortCommandsV103.push(target.effort);target.outputRefreshedV110=true;
          if(time<target.effort.readyAt){releaseAt=Math.max(controlThrough,target.effort.readyAt);continue;}
        }
        const planned = planLiveThrowV1({ releasePosition: position, bodyVelocity: velocityAt(f.body, time), maximumThrowSpeedMps: target.effort.commandSpeedMps,
            spin, physics: input.physics, target: q, preferredFlightSecondsV103: target.effort.plannedFlightSeconds,
            ...(materialSeamsActive ? { materialOrientationAtRelease: ballAt(time).orientation } : {}) });
        if (planned.kind !== 'planned') { reject('aero_throw_unreachable'); continue; }
        const runnerTime = Math.max(...obligations.map(o => {
          const r = runners.find(r => r.spec.runnerId === o.runnerId)!;
          return runnerArrivalSeconds(r, target.base, time);
        }));
        if (!target.routineReturn && runnerTime <= planned.flightSeconds) { reject('aero_throw_arrives_after_runner', planned.flightSeconds); continue; }
        const relation = f.spec.fieldRelationshipsV99?.find(r => r.toPlayerId === target.receiver.spec.playerId),
          trust = relation?.trust ?? 50, coordination = relation?.coordination ?? 50,
          receiveOpportunityV152=originTick+':'+custodySince+':'+f.spec.playerId+':'+target.receiver.spec.playerId+':'+target.base,
          readiness = decideLiveReceiveTimingV99({ seed: fieldRandomSeedV152('receive-timing-v99:'+receiveOpportunityV152),
            opportunityId: receiveOpportunityV152,
            flightSeconds: planned.flightSeconds, receiverReadySeconds: receiverEtaToBag,
            receiverDistanceMeters: distToBag, immediateReachMeters: (target.receiver.spec.bodyModelV105 ? Math.max(0,individualV118
              ?liveFielderHorizontalReachV105(target.receiver.spec.bodyModelV105,knownActorV118(f,target.receiver,time).position,target.point.y)
              :horizontalReachV105(target.receiver,time,target.point.y)) : target.receiver.spec.gloveReachMeters) + touchR,
            trust, coordination, aggression: 1 / (f.spec.fieldingCognition?.pursuitCostWeight ?? 1) });
        receiveTimingV99.push({ elapsedSeconds: time, throwerPlayerId: f.spec.playerId, receiverPlayerId: target.receiver.spec.playerId,
          observationSeconds: seenReceiverWorld.t, predictedBallArrivalSeconds: time + planned.flightSeconds,
          predictedReceiverReadySeconds: time + receiverEtaToBag,
          base: target.base, receiverDistanceMeters: distToBag, receiverReadySeconds: receiverEtaToBag, flightSeconds: planned.flightSeconds,
          trust, coordination, explicitRelationship: !!relation, allow: readiness.allow, probability: readiness.probability,
          draw: readiness.draw, reason: readiness.reason, marginSeconds: readiness.marginSeconds });
        if (!readiness.allow) { releaseAt = controlThrough; if (releaseAt === time) releaseAt += LIVE_FIELD_TEST_MODEL_V1.controlSeconds; continue; }
        const override = executionErrorsV95.find(e => e.releaseOrdinal === throwDirectionCommands.length),
          bodyVelocity = velocityAt(f.body, time), actualDirection = applyLiveThrowDirectionV1({ velocity: planned.initialVelocity, bodyVelocity, spin,
          standardDeviationRadians: f.spec.throwDirectionStdRadians ?? 0, seed: fieldRandomSeedV152('throw-direction-v1:'+throwDirectionCommands.length), releaseOrdinal: throwDirectionCommands.length,
          ...(override === undefined ? {} : { angularErrorOverride: { yawRadians: override.yawRadians, pitchRadians: override.pitchRadians } }) }),
          velocity = actualDirection.velocity;
        throwDirectionCommands.push({ elapsedSeconds: time, plannedVelocity: planned.initialVelocity, bodyVelocity, actual: actualDirection });
        throwDecisions.push({ elapsedSeconds: time, base: target.base, reason: 'positive_margin_physical_throw', flightSeconds: planned.flightSeconds });
        kernel = build({ originTick, elapsedSeconds: time, ball: { tick: tick(time), position, velocity, spin } }); wallContact = null;
        emit('throw_release', time, { playerId: f.spec.playerId, base: target.base, position, runnerId: target.runnerId,
          reason: target.routineReturn && !obligations.some(o=>o.forced) ? 'routine_return' : target.intent === 'relay' ? 'relay_play' : obligations.some(o => o.appeal) ? 'appeal_play' : obligations.some(o => o.forced) ? 'force_play' : 'tag_play',
          receiverPlayerId: target.receiver.spec.playerId, target: q });
        if(individualV118&&input.recordDecisionTraceV118)decisionTraceV118.record(time,f.spec.playerId,{event:'actual_throw_release',
          commandId:target.effort.commandIdV118,factIndex:facts.length-1,receiverPlayerId:target.receiver.spec.playerId,
          position,target:q,authority:'actual_physical_execution_not_ai_input'},undefined,'execution');
        const visitKey = target.runnerId + ':' + target.base, visited = relayVisited.get(visitKey) ?? new Set<string>();
        visited.add(f.spec.playerId); relayVisited.set(visitKey, visited);
        hasThrown = true; lastThrowBases = Object.fromEntries(runners.filter(r => !r.retired && !r.scored).map(r => [r.spec.runnerId, r.base]));
        target.releasedAt = time; target.releasedFrom = position;
        handPreparation = null;
        custodyChargeFromV103 = null;
        releaseOpen = f; f.catchEnabledAfter = time + .15; possession = null; side = 'outgoing'; releaseAt = null; reboundEscape = null; observe(time); controlThrough = time;
      } else if (e.kind === 'arrival') {
        const r = e.runner!, leg = r.leg!, touch = leg.motion.touches[leg.nextTouchIndex];
        physicalBaseDepartures.delete(r.spec.runnerId);
        r.p = runnerAt(r, time); r.base = touch.base; r.scored = r.base === 4 && !leg.returning && r.retouchBase === null; leg.nextTouchIndex++;
        if (r.retouchBase === touch.base && firstFielderTouchSeconds !== null && time >= firstFielderTouchSeconds) {
          r.retouchBase = null; r.returnReadyAt = null;
        }
        leg.to = (leg.motion.touches[leg.nextTouchIndex]?.base ?? r.base) as BaseballBase;
        // A legal touch and finishing the running motor are distinct events.
        // Retain the actual path/velocity through the bag until its stop time.
        if (leg.motion.firstBaseOverrunV95) scheduleDeparture(leg, 1, touch.centerElapsedSeconds, leg.motion.firstBaseOverrunV95.brakingEndElapsedSeconds);
        else if (leg.nextTouchIndex < leg.motion.touches.length) {
          // A through-run leaves the actual bag region without starting a new
          // leg. Preserve that physical departure in the same rule-fact stream.
          let lo = touch.centerElapsedSeconds, hi = leg.motion.touches[leg.nextTouchIndex].centerElapsedSeconds;
          if (leg.returning) scheduleDeparture(leg, r.base as BaseballBase, lo, hi);
          else {
            for (let i = 0; i < 53 && (lo + hi) / 2 !== lo && (lo + hi) / 2 !== hi; i++) {
              const mid = (lo + hi) / 2, p = leg.motion.sampleAtElapsedSeconds(mid).position;
              if (distance(flat(v(p.x, 0, p.z)), flat(base(r.base))) <= (field.baseTouchRadiusMeters ?? .28)) lo = mid; else hi = mid;
            }
            leg.departure = { base: r.base as BaseballBase, elapsedSeconds: leg.from + hi };
          }
        }
        runnerTouches.push({ kind: 'runner_base_touch', runnerId: r.spec.runnerId, base: touch.base as BaseballBase, tick: tick(time) });
        emit('runner_base_touch', time, { runnerId: r.spec.runnerId, base: touch.base as BaseballBase, position: runnerTouchPointV115(r,time) });
        if (deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId && o.targetBase === touch.base))
          force = satisfyForceParticipantObligation(force, r.spec.runnerId);
        // Re-evaluate a further advance and newly vacated bases before closing
        // the play. A pre-arrival hold decision cannot settle the new state.
        runnerDecisionPending = true; controlThrough = time;
      } else if (e.kind === 'runner_stop') {
        const r = e.runner!; r.p = runnerAt(r, time); r.leg = null; runnerDecisionPending = true; controlThrough = time;
      } else if (e.kind === 'retired_runner_stop') {
        const r = e.runner!; r.p = runnerAt(r,time);
      } else if (e.kind === 'runner_departure') {
        const r = e.runner!, departure = r.leg!.departure!; r.leg!.departure = null;
        physicalBaseDepartures.set(r.spec.runnerId, { ...departure, tick: tick(time) });
        runnerDepartures.push({ kind: 'runner_base_departure', runnerId: r.spec.runnerId, base: departure.base, tick: tick(time) });
        emit('runner_base_departure', time, { runnerId: r.spec.runnerId, base: departure.base });
      } else if (e.kind === 'base') applyBaseControl(e.f!, e.base!, time);
      else if (e.kind === 'tag') {
        const r = e.runner!;
        const departure = physicalBaseDepartures.get(r.spec.runnerId), velocity = runnerVelocityAt(r, time),
          radial = departure ? flat(sub(runnerTouchPointV115(r,time), base(departure.base))) : v(),
          protectionEndedByDeparture = departure && departure.base === r.base && departure.tick === tick(time) && departure.elapsedSeconds <= time
            && !deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId)
            && norm(radial) > (field.baseTouchRadiusMeters ?? .28) && radial.x * velocity.x + radial.z * velocity.z > 0
            && runnerTagGapV115(r,time,at(e.f!.glove,time)) <= 0
            ? { base: departure.base, tick: departure.tick } : undefined;
        controlledRunnerTags.push({ kind: 'controlled_runner_tag', defenderId: e.f!.spec.playerId, runnerId: r.spec.runnerId, tick: tick(time),
          ...(protectionEndedByDeparture ? { protectionEndedByDeparture } : {}) });
        emit('controlled_runner_tag', time, { playerId: e.f!.spec.playerId, runnerId: r.spec.runnerId });
        if (r.retouchBase !== null) appeal(r, e.f!, time); else retire(r, time);
      } else if (e.kind === 'fence') {
        const b = kernel.evaluateAt(time, 'incoming').moment.ball, geometricFair = isFair(b.position),
          fair = territoryFixed ? territory === 'fair' : geometricFair, untouchedGround = !hasThrown && firstGroundContactTick === null;
        if (b.position.y - input.physics.ground.radiusM > field.fenceHeightMeters || !fair) {
          overFence = { tick: tick(time), fair, untouchedGround, cause: hasThrown ? 'throw' : 'batted',
            ...(hasThrown ? { awardFrom: lastThrowBases } : {}) }; determineTerritory(time, fair ? 'fair' : 'foul');
          emit('over_fence', time, { position: b.position }); dead = true;
          if (!fair) { terminal = true; endReason = 'foul_dead_ball'; }
        } else {
          const normal = mul(flat(sub(fenceCenter, b.position)), 1 / distance(flat(b.position), flat(fenceCenter)));
          let outgoing = respondToBallContact({ ball: b, normal, surfaceVelocity: v(), material: LIVE_FIELD_TEST_MODEL_V1.wallMaterial });
          const seamContact = kernel.evaluateAt(time, 'incoming');
          orientationBasis = seamContact.materialOrientation ?? multiplyQuaternions(seamContact.orientation, orientationBasis);
          const normalVelocity = outgoing.velocity.x * normal.x + outgoing.velocity.z * normal.z;
          const isGrounded = b.position.y === input.physics.ground.radiusM && b.velocity.y === 0;
          const elasticNormalEnergy = .5 * input.physics.air.aerodynamics.ballMassKg * normalVelocity ** 2;
          const remainingNormalEnergy = Math.max(0, elasticNormalEnergy - LIVE_FIELD_TEST_MODEL_V1.wallMaterial.groundNormalHysteresisLossJ);
          if (isGrounded && remainingNormalEnergy === 0) {
            const radial = flat(sub(b.position, fenceCenter)), r = norm(radial), tangent = v(radial.z / r, 0, -radial.x / r),
              speed = outgoing.velocity.x * tangent.x + outgoing.velocity.z * tangent.z;
            outgoing = { ...outgoing, velocity: mul(tangent, speed) };
            const constrained = createGroundWallRollingCurveV1({ initial: { originTick, elapsedSeconds: time, ball: outgoing }, throughElapsedSeconds: max,
              profile: input.physics, fenceCenter, nominalContactRadiusMeters: fenceRadius - input.physics.ground.radiusM,
              maximumCompressionMeters: LIVE_FIELD_TEST_MODEL_V1.wallMaterial.maximumCompressionMeters });
            kernel = constrained; wallKernelBuilds++; wallContact = constrained.support; wallSupports.push(constrained.support);
            constrainedWallCurveV170 = constrained;
            freeScope = null;
            emit('wall_support', time, { position: b.position, reason: 'normal_rebound_energy_dissipated_by_explicit_ground_wall_material' });
            fenceEscape = null;
          } else {
            if (isGrounded) outgoing = { ...outgoing, velocity: add(outgoing.velocity,
              mul(normal, Math.sqrt(2 * remainingNormalEnergy / input.physics.air.aerodynamics.ballMassKg) - normalVelocity)) };
            const moment = { originTick, elapsedSeconds: time, ball: outgoing };
            kernel = build(moment); wallContact = null;
            fenceEscape = { from: time, radius: fenceRadius - input.physics.ground.radiusM, outgoing: moment, witness: e.hit! };
          }
          side = 'outgoing';
        }
      }
    }
    if (releaseOpen && time >= releaseOpen.catchEnabledAfter) releaseOpen = null;
    if (retiredCount + input.outs >= 3) { endReason = 'third_out'; terminal = true; }
    const retiredSlidesCompleteV115 = runners.every(r => !r.retiredSlideV115 || time >= r.retiredSlideV115.from + r.retiredSlideV115.motion.durationSeconds);
    const runnersComplete = retiredSlidesCompleteV115 && runners.every(r => r.retired || r.retouchBase === null && !r.leg && (r.scored || r.base > 0 || !!flyCatch));
    if (overFence?.fair && overFence.untouchedGround && retiredSlidesCompleteV115 && runners.every(r => r.retired || r.scored && !r.leg)) { endReason = 'home_run_completed'; terminal = true; }
    const awardedFence = overFence;
    if (awardedFence?.fair && !awardedFence.untouchedGround && retiredSlidesCompleteV115 && runners.every(r => r.retired || !r.leg && r.base >= Math.min(4, (awardedFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + 2))) { endReason = 'ground_rule_award_completed'; terminal = true; }
    if (!dead && possession && runnersComplete && !runnerDecisionPending && time - custodySince >= Math.max(.6, effectiveTransferSeconds(possession))
      && (releaseAt === null || legacyOutTargetsV117().length === 0)) { endReason = 'live_action_complete'; terminal = true; }
    if (time === horizon && !e && horizon === max) break;
  }
  sampleFrame(time);
  const complete = ['third_out', 'foul_dead_ball', 'home_run_completed', 'ground_rule_award_completed', 'live_action_complete'].includes(endReason),
    playEnd: PlayEndFact = { kind: 'play_end', tick: tick(time), reason: dead ? 'dead_ball' : 'live_action_complete' };
  emit('play_end', time, { reason: endReason });
  const actualPoleContactsV148 = facts.filter(f => f.kind === 'pole_contact');
  const ruleFacts: LiveFieldRuleFactsV1 = { contactTick: input.ball.ball.tick, throughTick: tick(time), territory,
    ...(actualPoleContactsV148.length ? { pendingEquipmentPolicyV148: { firstContactTick: actualPoleContactsV148[0].tick,
      surfaceIds: [...new Set(actualPoleContactsV148.map(f => f.surfaceId!))] } } : {}),
    firstGroundContactTick, flyCatch, runnerTouches, controlledBaseContacts, controlledRunnerTags, runnerDepartures, defensiveAppeals, overFence, playEnd };
  const recoveryFramesV115: LiveFieldFrameV1[] = [], endSnapshotV115 = frames.at(-1)!,
    recoveringRunnersV115 = runners.filter(r => {
      const leg = r.leg ?? r.retiredSlideV115, slide = slideMotionV115(leg);
      return leg && slide && time >= leg.from + slide.slideV115.fromSeconds && time < leg.from + slide.durationSeconds;
    }),recoveringFieldersV115=defenders.filter(f=>athleticActiveV115(f,time));
  if (complete && (recoveringRunnersV115.length||recoveringFieldersV115.length)) {
    const through = Math.max(...recoveringFieldersV115.map(f=>f.athleticV115!.throughSeconds),...recoveringRunnersV115.map(r => { const leg = (r.leg ?? r.retiredSlideV115)!;
      return leg.from + leg.motion.durationSeconds; }));
    // Continue only already committed action curves, never new baseball
    // decisions or rule facts. An idle actor/free ball keeps the end snapshot.
    for (let index = 1; ; index++) {
      const elapsed = Math.min(through, time + index * frameSeconds);
      const recoveredFielders=endSnapshotV115.fielders.map(snapshot=>{
        const f=recoveringFieldersV115.find(f=>f.spec.playerId===snapshot.playerId);
        if(!f)return{...snapshot,velocity:v(),...(snapshot.bodyPoseV105?{bodyPoseV105:{...snapshot.bodyPoseV105,eyeVelocity:v()}}:{})};
        const action=f.athleticV115!,sample=action.sampleAtElapsedSeconds(elapsed),offset=sub(snapshot.glove,snapshot.bodyPoseV105!.shoulder),
          glove=add(sample.pose.shoulder,offset),pose={...sample.pose,reachMarginMeters:liveFielderReachMarginV105(f.spec.bodyModelV105!,sample.pose.shoulder,sample.pose.forward,glove)};
        return{...snapshot,position:sample.position,velocity:sample.velocity,glove,bodyPoseV105:pose,
          athleticV115:{kind:action.kind,phase:sample.phase,fromSeconds:action.fromSeconds,throughSeconds:action.throughSeconds}};
      }),heldBy=recoveredFielders.find(f=>f.playerId===endSnapshotV115.ball.possessedBy);
      recoveryFramesV115.push({ ...endSnapshotV115, elapsedSeconds: elapsed, tick: tick(elapsed),
        recoveryV115: { kind: recoveringFieldersV115.length?'athletic_action_recovery':'runner_action_recovery', officialEndTick: tick(time), readOnly: true },
        ball: { ...endSnapshotV115.ball,...(heldBy?{position:heldBy.glove}:{}),velocity: v(), spin: v() },
        fielders:recoveredFielders,
        runners: endSnapshotV115.runners.map(snapshot => {
          const runner = recoveringRunnersV115.find(r => r.spec.runnerId === snapshot.runnerId);
          if (!runner) return { ...snapshot, velocity: v(),
            ...(snapshot.bodyPoseV105 ? { bodyPoseV105: { ...snapshot.bodyPoseV105, eyeVelocity: v() } } : {}) };
          const bodyPoseV105 = runnerPostureV115(runner,elapsed), body = runnerSlideBodyV115(runner,elapsed)!;
          return { ...snapshot, position: runnerAt(runner,elapsed), velocity: runnerVelocityAt(runner,elapsed),
            ...(bodyPoseV105 ? { bodyPoseV105 } : {}),
            athleticV115: { kind: body.style === 'head_first' ? 'head_slide' as const : 'feet_slide' as const, phase: body.phase } };
        }) });
      if (elapsed === through) break;
    }
  }
  return freeze({ version: 'live_field_play_v1' as const, modelBasis: LIVE_FIELD_TEST_MODEL_V1.basis, model: LIVE_FIELD_TEST_MODEL_V1,
    fieldGeometry,
    frames, ...(recoveryFramesV115.length ? { recoveryFramesV115 } : {}), facts, ruleFacts,
    end: { elapsedSeconds: time, tick: tick(time), reason: complete && actualPoleContactsV148.length ? 'pole_legal_policy_unadopted_v148' : endReason,
      complete: complete && actualPoleContactsV148.length === 0 },
    finalRunners: runners.map(r => ({ runnerId: r.spec.runnerId, base: r.base, position: runnerAt(r, time), retired: r.retired, scored: r.scored,
      retouchRequiredBase: r.retouchBase })),
    diagnostics: { ...(randomnessV152?{randomnessV152:randomnessV152.captureTrace()}:{}),
      ...(poleSessionV148 ? { poleV148: { impulses: poleSessionV148.diagnostics(), advances: poleSessionV148.advances(),
        ...(poleContactWitnessesV213.length ? { contactWitnessesV213: poleContactWitnessesV213 } : {}),
        ...(constrainedPoleWindowsV170.length?{constrainedWindowsV170:constrainedPoleWindowsV170}: {}) } } : {}),
      ...(input.fielders.some(f => f.bodyModelV105) ? { bodyGeometryV105 } : {}), throwEffortCommandsV103, throwEffortCancellationsV103,
      athleticDecisionsV115,...(transferTimingsV101.length ? { transferTimingsV101 } : {}), ...(input.fielders.some(f => f.defensivePosition === 'P' && (f.technicalSkills?.pitcher_field_reaction ?? 0) > 0)
      ? { pitcherReactionTechnique: input.fielders.filter(f => f.defensivePosition === 'P' && (f.technicalSkills?.pitcher_field_reaction ?? 0) > 0)
        .map(f => ({ playerId: f.playerId, baselineReactionSeconds: f.reactionSeconds, effectiveReactionSeconds: f.reactionSeconds / (1 + .6 * f.technicalSkills!.pitcher_field_reaction!),
          scope: 'INITIAL_BATTED_BALL_BEFORE_FIRST_THROW' as const })) } : {}), kernelBuilds, kernelExtensions, wallKernelBuilds, wallSupports, simultaneousContacts, throwDecisions, throwDirectionCommands, handPreparationProofs, forecastBuilds, collisionQueries, unresolvedDetail, departureProofs,
      fielderSeparation: { basis: 'CONTINUOUS_ISSUED_BODY_COMMANDS_AND_PROJECTED_MAXIMUM_BRAKING' as const,
        planCount: avoidancePlanCount, candidateEvaluations: avoidanceCandidateEvaluations,
        minimumPlannedStepGapMeters: Number.isFinite(minimumPlannedStepGapMeters) ? minimumPlannedStepGapMeters : null,
        minimumStoppingGapMeters: Number.isFinite(minimumStoppingGapMeters) ? minimumStoppingGapMeters : null,
        actorCounts: [...fielderAvoidanceCounts].map(([playerId, counts]) => ({ playerId, ...counts })),
        physicalImpactResolved: false },
      playClosure: { lastRunnerEvaluationSeconds, runnerDecisionPending,
        activeRunnerIds: runners.filter(r => !r.retired && r.leg).map(r => r.spec.runnerId),
        possessedBy: possession?.spec.playerId ?? null, pendingCatchBy: pendingCatch?.fielder.spec.playerId ?? null,
        scheduledReleaseSeconds: releaseAt },
      aiTelemetry: { roleTransitions, defensiveOpportunityTransitions, throwTargetCancellations, contactDiagnostics, holderDecisions, runnerDecisions, runnerObservationsV95, relayPlans, receiveTimingV99, runnerMotions, fielderAvoidanceTransitions, doublePlayDecisionsV106,firstBaseAttemptDecisionsV108,
        ...(individualV118?{athleticSafetyV120,postActionEstimatesV120,psychologyConnectionV120:'NOT_CONNECTED'}:{}),
        ...(individualV118?{individualDecisionsV118:[...lastIndividualDecisionV118.values()],communicationV118:communicationV118.inspect()}:{}),
        ...(input.recordDecisionTraceV118?{decisionTraceV118:decisionTraceV118.finish()}:{}),
        ...(initialMovementV98 ? { firstMovementV98: [...initialMovementV98.values()] } : {}) },
      throwPhysicalMemoV113: getLiveThrowPhysicalMemoStatsV113(),
      runnerThrowPredictionV113: materialSeamsActive ? 'UNOBSERVABLE_SEAM_PHASE_AVERAGED' as const : 'FULL_PROFILE_WITHOUT_ACTIVE_SEAMS' as const,
      throwComparisonV113: materialSeamsActive ? 'MEAN_GRIP_ROUTES_FULL_MATERIAL_RELEASE_REVALIDATION' as const : 'FULL_PROFILE_WITHOUT_ACTIVE_SEAMS' as const,
      renderFramesOwnPhysics: false, namedLeagueCalibration: false, nativeActuation: false } });
}
