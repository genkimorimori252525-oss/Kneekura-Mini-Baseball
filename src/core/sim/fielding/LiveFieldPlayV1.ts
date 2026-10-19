import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldMoment } from '../ball/BallWorldContinuation';
import { createSourceFreeBallKernel, type SourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { respondToBallContact } from '../ball/BallContactResponse';
import { sourceRk4PositionBounds } from '../ball/SourceFreeBallSpeedBound';
import { quantizeEventTick } from '../ExactEventTime';
import { IDENTITY_QUATERNION, advanceBaseballOrientation, multiplyQuaternions, type Quaternion } from '../pitching/BaseballOrientation';
import { buildDefenderMotionTrajectory } from './DefenderMotion';
import { coordinateLiveFielderMotionV1, LIVE_FIELDER_AVOIDANCE_POLICY_V1 } from './LiveFielderAvoidanceV1';
import { resolveCatchRetention, type CatchRetentionParameters } from './CatchRetention';
import { createGroundWallRollingCurveV1 } from './GroundWallRollingCurveV1';
import { createLiveFieldForecastV1 } from './LiveFieldForecastV1';
import { predictLiveDefensiveOpportunityV1, LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1,
  type LiveDefensiveOpportunityV1 } from './LiveDefensiveOpportunityV1';
import { resolveGroundedActorContactResponseV1 } from './GroundedActorContactResponseV1';
import { planLiveThrowV1 } from './LiveThrowPlanV1';
import { createLiveHandPreparationV1 } from './LiveHandPreparationV1';
import { assignLiveFieldRolesV1, liveFieldArrivalSecondsV1, LIVE_FIELD_ROLE_POLICY_V1,
  type LiveFieldRoleV1, type LiveFieldRoleActorV1 } from './LiveFieldRoleAssignmentV1';
import { applyLiveThrowDirectionV1 } from './LiveThrowDirectionV1';
import { decideLiveRunnerAdvanceV1, estimateLiveRunnerLegSecondsV1 } from './LiveRunnerAdvancePolicyV1';
import { selectLiveFieldHandlerV1 } from './LiveFieldHandlerSelectionV1';
import { planLiveRelayV1, type LiveRelayPlanV1 } from './LiveRelayPlanV1';
import { createLiveRunnerMotionV1, type LiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';
import { createLiveRunnerRetreatMotionV1 } from '../running/LiveRunnerRetreatMotionV1';
import { SeedRoot } from '../../rng/SeedRoot';
import { validateTechnicalSkillControlsV75, type TechnicalSkillControlsV75 } from '../TechnicalSkillControlsV75';
import { createInitialForceObligationState, deriveCurrentForceObligations, retireForceParticipant,
  satisfyForceParticipantObligation } from '../../rules/ForceObligation';
import type { BaseballBase, RunnerBaseTouchFact, ControlledBaseContactFact, ControlledRunnerTagFact,
  RunnerBaseDepartureFact, DefensiveAppealAttemptFact, PlayEndFact } from '../../rules/PhysicalRuleFacts';

export type LiveFielderV1 = Readonly<{ playerId: string; position: Vec3; velocity?: Vec3;
  technicalSkills?: TechnicalSkillControlsV75;
  defensivePosition?: LiveFieldRoleActorV1['defensivePosition'];
  reactionSeconds: number; topSpeedMps: number; accelerationMps2: number;
  /** Explicit additional decision latency, independent of team assignment correctness. */
  fieldingCognition?: Readonly<{ decisionSeconds: number; pursuitCostWeight?: number }>;
  gloveSpeedMps: number; gloveReachMeters: number; gloveRadiusMeters: number;
  catchRetention: CatchRetentionParameters; transferSeconds: number; throwSpeedMps: number;
  throwDirectionStdRadians?: number;
  throwSpinRadPerSecond?: Vec3; throwBackspinRadPerSecond?: number }>;
export type LiveRunnerV1 = Readonly<{ runnerId: string; initialBase: 0 | 1 | 2 | 3;
  technicalSkills?: TechnicalSkillControlsV75;
  position?: Vec3; topSpeedMps: number; accelerationMps2: number; reactionSeconds: number;
  advanceSafetyMarginSeconds?: number; roundingRadiusMeters?: number; lateralAccelerationMps2?: number }>;
export type LiveFieldGeometryV1 = Readonly<{ bases: Readonly<Record<'home' | 'first' | 'second' | 'third', Vec3>>;
  fenceRadiusMeters: number; fenceHeightMeters: number; foulFenceRadiusMeters?: number; baseTouchRadiusMeters?: number }>;
export type LiveFieldPlayInputV1 = Readonly<{ ball: BallWorldMoment; physics: AeroGroundBallPhysicsV1;
  orientation?: Quaternion; field: LiveFieldGeometryV1; fielders: readonly LiveFielderV1[];
  runners: readonly LiveRunnerV1[]; outs: number; maxPlaySeconds?: number; frameSeconds?: number; seed?: number }>;
export type LiveFieldRuleFactsV1 = Readonly<{ contactTick: number; throughTick: number; territory: 'fair' | 'foul';
  firstGroundContactTick: number | null; flyCatch: Readonly<{ fielderId: string; firstTouchTick: number; secureCatchTick: number }> | null;
  runnerTouches: readonly RunnerBaseTouchFact[]; controlledBaseContacts: readonly ControlledBaseContactFact[];
  controlledRunnerTags: readonly ControlledRunnerTagFact[]; runnerDepartures: readonly RunnerBaseDepartureFact[];
  defensiveAppeals?: readonly DefensiveAppealAttemptFact[];
  overFence: Readonly<{ tick: number; fair: boolean; untouchedGround: boolean; cause?: 'batted' | 'throw';
    awardFrom?: Readonly<Record<string, number>> }> | null; playEnd: PlayEndFact }>;
export type LiveFieldFactV1 = Readonly<{ kind: 'ground_contact' | 'glove_contact' | 'body_contact' | 'catch_secured' | 'throw_release'
  | 'runner_base_touch' | 'runner_base_departure' | 'controlled_base_contact' | 'controlled_runner_tag' | 'over_fence' | 'territory_determined' | 'wall_support' | 'play_end';
  elapsedSeconds: number; tick: number; playerId?: string; runnerId?: string; base?: BaseballBase;
  position?: Vec3; reason?: string;
  /** At-release controller metadata, never inferred from a subsequent catch. */
  receiverPlayerId?: string; target?: Vec3 }>;
export type LiveFieldFrameV1 = Readonly<{ elapsedSeconds: number; tick: number;
  defensiveOpportunity: LiveDefensiveOpportunityV1 | null;
  ball: Readonly<{ position: Vec3; velocity: Vec3; spin: Vec3; orientation: Quaternion;
    visible: boolean; possessedBy: string | null; phase: string }>;
  fielders: readonly Readonly<{ playerId: string; position: Vec3; velocity: Vec3; glove: Vec3;
    intent: 'intercept' | 'base_cover' | 'relay' | 'backup' | 'hold' | 'tag'; targetBase: BaseballBase | null }>[];
  runners: readonly Readonly<{ runnerId: string; position: Vec3; velocity: Vec3; currentBase: number; targetBase: number | null;
    retired: boolean; scored: boolean }>[] }>;

/** Explicit kinematic research controller. These numbers are controller cadence
 * and geometry, never NLB/MLB ability or outcome probabilities. Player motor,
 * reaction, pocket energy, transfer and throw values are required SI inputs. */
export const LIVE_FIELD_TEST_MODEL_V1 = Object.freeze({ basis: 'EXPLICIT_SYNTHETIC_LIVE_FIELD_CONTROL_V1' as const,
  controlSeconds: .04, frameSeconds: .055, bodyRadiusMeters: .24,
  roleAssignment: LIVE_FIELD_ROLE_POLICY_V1,
  defensiveOpportunity: LIVE_DEFENSIVE_OPPORTUNITY_POLICY_V1,
  fielderAvoidance: LIVE_FIELDER_AVOIDANCE_POLICY_V1,
  catchApproachCostFraction: .3,
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
type Fielder = { spec: LiveFielderV1; body: Curve; glove: Curve; intent: LiveFieldFrameV1['fielders'][number]['intent'];
  targetBase: BaseballBase | null; catchEnabledAfter: number };
type HandPreparationState = { fielder: Fielder; base: BaseballBase;
  curve: Extract<ReturnType<typeof createLiveHandPreparationV1>, { kind: 'planned' }>; prepared: boolean };
type Leg = { from: number; to: BaseballBase; motion: LiveRunnerMotionV1; nextTouchIndex: number; height: number;
  departure: { base: BaseballBase; elapsedSeconds: number } | null; returning?: boolean };
type Runner = { spec: LiveRunnerV1; base: number; p: Vec3; leg: Leg | null; retired: boolean; scored: boolean;
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
  const input = cloneInert(raw), start = input.ball.elapsedSeconds, originTick = input.ball.originTick,
    tps = input.physics.air.ticksPerSecond, max = start + (input.maxPlaySeconds ?? 35), frameSeconds = input.frameSeconds ?? .055;
  assert(input.fielders.length === 9 && new Set(input.fielders.map(f => f.playerId)).size === 9, 'nine unique defenders required');
  assert(input.runners.length >= 1 && input.runners.length <= 4 && new Set(input.runners.map(r => r.runnerId)).size === input.runners.length
    && new Set(input.runners.map(r => r.initialBase)).size === input.runners.length && input.runners.some(r => r.initialBase === 0), 'complete unique runner population required');
  assert(Number.isInteger(input.outs) && input.outs >= 0 && input.outs <= 2 && Number.isFinite(max) && max > start && max - start <= 120
    && frameSeconds > 0 && Number.isFinite(frameSeconds)
    && (input.seed === undefined || Number.isSafeInteger(input.seed) && input.seed >= 0 && input.seed <= 0xffffffff), 'invalid finite play scope');
  assert(input.ball.ball.tick === quantizeEventTick(originTick, start, tps) && input.physics.ground.ticksPerSecond === tps, 'actual contact clock differs');
  const field = input.field, base = (n: number) => field.bases[(['home', 'first', 'second', 'third', 'home'] as const)[n]];
  assert(Object.values(field.bases).every(finite) && Number.isFinite(field.fenceRadiusMeters) && Number.isFinite(field.fenceHeightMeters)
    && field.fenceRadiusMeters > 0 && field.fenceHeightMeters >= 0, 'finite field geometry required');
  // One continuous solid stadium perimeter. CF/back distances remain the
  // specified values; changing a ball's fair/foul status never moves a wall.
  const fieldGeometry = deriveLiveFieldFenceGeometryV1(field), fenceCenter = fieldGeometry.fenceCenter, fenceRadius = fieldGeometry.fenceRadiusMeters;
  for (const f of input.fielders) assert(f.playerId && finite(f.position) && (!f.velocity || finite(f.velocity)) && f.position.y > 0
    && (f.defensivePosition === undefined || ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].includes(f.defensivePosition))
    && [f.topSpeedMps, f.accelerationMps2, f.gloveSpeedMps, f.gloveReachMeters, f.gloveRadiusMeters, f.throwSpeedMps].every(x => Number.isFinite(x) && x > 0)
    && [f.reactionSeconds, f.transferSeconds].every(x => Number.isFinite(x) && x >= 0)
    && f.catchRetention.ticksPerSecond === tps && f.catchRetention.ballRadiusMeters === input.physics.ground.radiusM
    && f.catchRetention.ballMassKg === input.physics.air.aerodynamics.ballMassKg
    && [f.catchRetention.pocketRadiusMeters, f.catchRetention.centerRetentionCapacityJ, f.catchRetention.captureDissipationPowerW].every(x => Number.isFinite(x) && x > 0)
    && [f.catchRetention.failedContactRestitution, f.catchRetention.failedTangentialDamping, f.catchRetention.failedSpinDamping].every(x => Number.isFinite(x) && x >= 0 && x <= 1)
    && (f.throwBackspinRadPerSecond === undefined || Number.isFinite(f.throwBackspinRadPerSecond) && f.throwBackspinRadPerSecond >= 0)
    && (!f.throwSpinRadPerSecond || finite(f.throwSpinRadPerSecond))
    && (f.throwDirectionStdRadians === undefined || Number.isFinite(f.throwDirectionStdRadians) && f.throwDirectionStdRadians >= 0 && f.throwDirectionStdRadians <= .12)
    && (f.fieldingCognition === undefined || Object.keys(f.fieldingCognition).every(k => ['decisionSeconds', 'pursuitCostWeight'].includes(k))
      && Number.isFinite(f.fieldingCognition.decisionSeconds) && f.fieldingCognition.decisionSeconds >= 0
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
  const facts: LiveFieldFactV1[] = [], frames: LiveFieldFrameV1[] = [], runnerTouches: RunnerBaseTouchFact[] = [],
    controlledBaseContacts: ControlledBaseContactFact[] = [], controlledRunnerTags: ControlledRunnerTagFact[] = [], runnerDepartures: RunnerBaseDepartureFact[] = [],
    defensiveAppeals: DefensiveAppealAttemptFact[] = [];
  const tick = (t: number) => quantizeEventTick(originTick, t, tps);
  const findContact = (gap: (t: number) => number, speed: number, rounding: number, lo: number, hi: number) => firstContact(gap, speed, rounding, lo, hi, 0, 1 / tps);
  const emit = (kind: LiveFieldFactV1['kind'], t: number, extra: Omit<LiveFieldFactV1, 'kind' | 'tick' | 'elapsedSeconds'> = {}) => facts.push({ kind, tick: tick(t), elapsedSeconds: t, ...extra });
  const defenders: Fielder[] = input.fielders.map(spec => ({ spec, body: { from: start, p: spec.position, velocity: spec.velocity ?? v(), acceleration: v() },
    glove: { from: start, p: spec.position, velocity: spec.velocity ?? v(), acceleration: v() }, intent: 'hold', targetBase: null, catchEnabledAfter: start }));
  const runners: Runner[] = input.runners.map(spec => ({ spec, base: spec.initialBase, p: spec.position ?? base(spec.initialBase), leg: null,
    retired: false, scored: false, retouchBase: null, returnReadyAt: null }));
  const tagUpAtFirstTouch = new Map<string, boolean>();
  const runnerReadBias = new Map(runners.map(r => [r.spec.runnerId,
    (2 * new SeedRoot(input.seed ?? 0).streamRng(0, 'fielding', 'runner-flight-read-v53:' + r.spec.initialBase).nextFloat() - 1)
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
  let freeScope: { initial: BallWorldMoment; spanSeconds: number; through: number } | null = null;
  let wallContact: ReturnType<typeof createGroundWallRollingCurveV1>['support'] | null = null;
  const wallSupports: ReturnType<typeof createGroundWallRollingCurveV1>['support'][] = [];
  const simultaneousContacts: ReturnType<typeof resolveGroundedActorContactResponseV1>['proof'][] = [];
  const throwDecisions: { elapsedSeconds: number; base: BaseballBase; reason: string; flightSeconds?: number }[] = [];
  const throwDirectionCommands: { elapsedSeconds: number; plannedVelocity: Vec3; bodyVelocity: Vec3;
    actual: ReturnType<typeof applyLiveThrowDirectionV1> }[] = [];
  const handPreparationProofs: { playerId: string; base: BaseballBase; from: number; through: number; target: Vec3;
    controls: ReturnType<HandPreparationState['curve']['cubicBezierControls']>; diagnostics: HandPreparationState['curve']['diagnostics'] }[] = [];
  const roleTransitions: { elapsedSeconds: number; previousHandlerId: string | null; handlerId: string;
    source: 'possession' | 'pending_catch' | 'throw_receiver' | 'forecast_retained' | 'forecast_best' | 'fallback_first';
    intercepted: boolean | null; eta: number | null; targetPoint: Vec3 | null; observedPosition: Vec3 | null;
    reactionGatedCount: number }[] = [];
  const throwTargetCancellations: { elapsedSeconds: number; base: BaseballBase; receiverPlayerId: string;
    releasedAt: number | null; seenAt: number; distanceToTargetMeters: number }[] = [];
  const contactDiagnostics: { elapsedSeconds: number; playerId: string; role: 'glove' | 'body';
    ballSpeedMps: number; bodySpeedMps: number; gloveOffsetMeters: number; intent: Fielder['intent'];
    targetBase: BaseballBase | null; distanceToTargetBaseMeters: number | null;
    retention?: { outcome: 'secured' | 'live-ball'; retentionLoadJ: number; effectiveCapacityJ: number;
      pocketOffsetMeters: number; bodyStability: number } }[] = [];
  const holderDecisions: { elapsedSeconds: number; playerId: string; state: string; base: BaseballBase | null;
    margin?: number; carrySeconds?: number; receivingSeconds?: number; receiverPlayerId?: string;
    receiverDistanceToBaseMeters?: number }[] = [];
  const rejectedThrows = new Set<string>();
  const relayPlans: { elapsedSeconds: number; playerId: string; runnerId: string; base: BaseballBase;
    kind: LiveRelayPlanV1['kind']; receivers: string[]; readySeconds: number; marginSeconds: number; aerodynamicSolveCount: number }[] = [];
  const relayCache = new Map<string, { at: number; plan: LiveRelayPlanV1 }>();
  const relayVisited = new Map<string, Set<string>>();
  const runnerMotions: { elapsedSeconds: number; runnerId: string; throughBases: number[]; position: Vec3; velocity: Vec3;
    durationSeconds: number; lengthMeters: number; route: LiveRunnerMotionV1['route'] }[] = [];
  const roundingRecheckAfter = new Map<string, number>();
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
  const build = (moment: BallWorldMoment) => {
    kernelBuilds++; const through = Math.min(max, moment.elapsedSeconds + 8), result = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
      initial: moment, throughElapsedSeconds: through, profile: input.physics });
    freeScope = { initial: result.descriptor.initial, spanSeconds: 8, through }; return result;
  };
  const ensureThrough = (through: number) => {
    if (!freeScope || through <= freeScope.through) return;
    let span = freeScope.spanSeconds;
    while (freeScope.initial.elapsedSeconds + span < through) span *= 2;
    const end = Math.min(max, freeScope.initial.elapsedSeconds + span);
    // The original impulse root and its RK lattice remain identical. This is
    // only a larger finite cache; no observed/render sample becomes a basis.
    kernel = createSourceFreeBallKernel({ kind: 'aero_ground_continuous_source_kernel_v2',
      initial: freeScope.initial, throughElapsedSeconds: end, profile: input.physics });
    freeScope = { ...freeScope, spanSeconds: span, through: end }; kernelExtensions++;
  };
  kernel = build(input.ball);
  let side: 'incoming' | 'outgoing' = 'incoming', possession: Fielder | null = null,
    pendingCatch: { fielder: Fielder; first: number; secure: number; firstTouchWasAirborne: boolean; offset: Vec3; spin: Vec3;
      initialPosition: Vec3; initialGlove: Vec3 } | null = null,
    throwTarget: { receiver: Fielder; base: BaseballBase; runnerId: string; forced: boolean; appeal: boolean;
      point: Vec3; receiverPoint: Vec3; issuedFrom: Vec3; intent: 'relay' | 'base_cover'; releasedAt?: number; releasedFrom?: Vec3 } | null = null,
    releaseAt: number | null = null, custodySince = Infinity;
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
    const leg = r.leg; if (!leg) return r.p;
    const p = leg.motion.sampleAtElapsedSeconds(t - leg.from).position;
    return v(p.x, leg.height, p.z);
  };
  const runnerVelocityAt = (r: Runner, t: number): Vec3 => {
    if (!r.leg) return v();
    const vel = r.leg.motion.sampleAtElapsedSeconds(t - r.leg.from).velocity; return v(vel.x, 0, vel.z);
  };
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
    return { ...b.moment.ball, orientation: multiplyQuaternions(b.orientation, orientationBasis), phase: dead ? 'dead' : wallContact ? 'wall_' + b.phase : b.phase };
  };
  const sampleFrame = (t: number) => {
    const b = ballAt(t);
    frames.push({ elapsedSeconds: t, tick: tick(t), defensiveOpportunity, ball: { position: b.position, velocity: b.velocity, spin: b.spin,
      orientation: b.orientation, phase: b.phase, visible: !dead && !possession && !pendingCatch, possessedBy: (possession ?? pendingCatch?.fielder)?.spec.playerId ?? null },
      fielders: defenders.map(f => ({ playerId: f.spec.playerId, position: at(f.body, t), velocity: velocityAt(f.body, t), glove: at(f.glove, t), intent: f.intent, targetBase: f.targetBase })),
      runners: runners.map(r => ({ runnerId: r.spec.runnerId, position: runnerAt(r, t), velocity: runnerVelocityAt(r, t),
        currentBase: r.base, targetBase: r.leg && r.leg.to !== r.base ? r.leg.to : null, retired: r.retired, scored: r.scored })) });
  };
  const retire = (r: Runner, t: number) => { if (r.retired) return; r.p = runnerAt(r, t); r.leg = null; r.retired = true; retiredCount++;
    force = retireForceParticipant(force, r.spec.runnerId);
    // Retiring a runner vacates both a physical bag and reserved future bags.
    // Remaining runners must decide against that new state before closure.
    runnerDecisionPending = true; controlThrough = t; };
  const scheduleDeparture = (leg: Leg, n: BaseballBase, from: number, through: number) => {
    if (through <= from) return;
    const gap = (t: number) => { const p = leg.motion.sampleAtElapsedSeconds(t).position;
      return (field.baseTouchRadiusMeters ?? .28) - distance(flat(v(p.x, 0, p.z)), flat(base(n))); };
    // Start at the closest passage through the bag, rather than the incoming
    // disk boundary. Departure is the outgoing disk crossing, not motor onset.
    if (gap(from) <= 0) return;
    const hit = findContact(gap, Math.max(...leg.motion.speedSegments.map(s => s.startSpeedMps), 0, rMaxSpeed), 128 * Number.EPSILON, from, through);
    if (hit && !hit.ambiguous) leg.departure = { base: n, elapsedSeconds: leg.from + hit.t };
  };
  const rMaxSpeed = Math.max(...runners.map(r => r.spec.topSpeedMps));
  const beginLeg = (r: Runner, n: BaseballBase, t: number) => {
    const p = runnerAt(r, t), motion = createLiveRunnerMotionV1({ position: p, velocity: runnerVelocityAt(r, t),
      bases: [{ base: n, position: base(n) }], topSpeedMps: r.spec.topSpeedMps, accelerationMps2: r.spec.accelerationMps2,
      baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28 });
    if (!motion) return;
    r.leg = { from: t, to: n, motion, nextTouchIndex: 0, height: p.y, departure: null };
    runnerMotions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, throughBases: [n], position: p, velocity: v(),
      durationSeconds: motion.durationSeconds, lengthMeters: motion.lengthMeters, route: motion.route });
    if (r.base > 0 && !physicalBaseDepartures.has(r.spec.runnerId))
      scheduleDeparture(r.leg, r.base as BaseballBase, 0, motion.touches[0]?.centerElapsedSeconds ?? motion.durationSeconds);
  };
  const runnerArrivalSeconds = (r: Runner, n: BaseballBase, t: number) => {
    const touch = r.leg?.motion.touches.slice(r.leg.nextTouchIndex).find(b => b.base === n);
    if (r.retouchBase === n && !r.leg?.returning) {
      const ready = Math.max(t, r.returnReadyAt ?? t), p = runnerAt(r, ready), velocity = runnerVelocityAt(r, ready),
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
  const outTargets = () => {
    const appeals = runners.filter(r => !r.retired && r.retouchBase !== null)
      .map(r => ({ runnerId: r.spec.runnerId, targetBase: r.retouchBase!, forced: false, appeal: true })),
      forced = deriveCurrentForceObligations(force).filter(o => !appeals.some(a => a.runnerId === o.runnerId)).map(o => ({ ...o, forced: true, appeal: false }));
    return [...appeals, ...forced, ...runners.filter(r => !r.retired && !r.scored && r.leg && r.leg.to > r.base
      && !r.retouchBase && !forced.some(o => o.runnerId === r.spec.runnerId))
      .map(r => ({ runnerId: r.spec.runnerId, targetBase: r.leg!.to, forced: false, appeal: false }))];
  };
  const history: { t: number; position: Vec3; velocity: Vec3; spin: Vec3; phase: string }[] = [];
  const observe = (t: number) => { const b = ballAt(t); history.push({ t, position: b.position, velocity: b.velocity, spin: b.spin, phase: b.phase }); };
  // One local technique owner: authored SI remains intact in movement, relay and forecasts.
  const effectiveTransferSeconds = (f: Fielder) => { const skill = f.spec.technicalSkills?.advanced_fielding ?? 0;
    return skill > 0 ? f.spec.transferSeconds * (1 - .08 * skill) : f.spec.transferSeconds; };
  const responseSeconds = (f: Fielder) => f.spec.reactionSeconds + (f.spec.fieldingCognition?.decisionSeconds ?? 0);
  const seenBy = (f: Fielder, t: number) => {
    const delay = hasThrown && f === throwTarget?.receiver ? f.spec.reactionSeconds : responseSeconds(f);
    for (let i = history.length - 1; i >= 0; i--) if (history[i].t <= t - delay) return history[i];
    return null;
  };
  const predictions: { observation: typeof history[number]; curve: ReturnType<typeof createLiveFieldForecastV1> }[] = [];
  let forecastBuilds = 0;
  const predictObservation = (seen: typeof history[number] | null, t: number, response: number) => {
    if (!seen || seen.phase === 'possessed' || possession || pendingCatch || dead || t - seen.t >= LIVE_FIELD_TEST_MODEL_V1.sensorPrediction.horizonSeconds) return null;
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
  const predict = (f: Fielder, t: number) => predictObservation(seenBy(f, t) ?? (!hasThrown && history.length ? history[0] : null), t, responseSeconds(f));
  const roleActor = (f: Fielder, t: number): LiveFieldRoleActorV1 => ({ playerId: f.spec.playerId,
    position: at(f.body, t), velocity: velocityAt(f.body, t), homePosition: f.spec.position,
    topSpeedMps: f.spec.topSpeedMps, accelerationMps2: f.spec.accelerationMps2, throwSpeedMps: f.spec.throwSpeedMps,
    remainingReactionSeconds: Math.max(0, start + responseSeconds(f) - t),
    ...(f.spec.defensivePosition === undefined ? {} : { defensivePosition: f.spec.defensivePosition }),
    ...(f.spec.fieldingCognition?.pursuitCostWeight === undefined ? {} : { pursuitCostWeight: f.spec.fieldingCognition.pursuitCostWeight }) });
  const forecast = (f: Fielder, t: number) => {
    const prediction = predict(f, t); if (!prediction) return null;
    const bodyPos = flat(at(f.body, t)), bodyVel = velocityAt(f.body, t),
      activeAt = start + Math.ceil(Math.max(0, responseSeconds(f) - 1e-12) / LIVE_FIELD_TEST_MODEL_V1.controlSeconds) * LIVE_FIELD_TEST_MODEL_V1.controlSeconds,
      wait = Math.max(0, activeAt - t),
      a = f.spec.accelerationMps2, vmax = f.spec.topSpeedMps,
      gloveFloor = Math.max(f.spec.gloveRadiusMeters, input.physics.ground.radiusM);
    const horizontalReachAt = (y: number) => {
      const dy = f.spec.position.y - Math.max(gloveFloor, y);
      return Math.sqrt(Math.max(0, f.spec.gloveReachMeters * f.spec.gloveReachMeters - dy * dy)) + f.spec.gloveRadiusMeters * .5;
    };
    const travelTo = (p: Vec3) => {
      const toP = sub(flat(p), bodyPos), dist = norm(toP);
      let run = Math.max(0, dist - horizontalReachAt(p.y));
      if (run === 0) return wait;
      const rawAlong = dist > 1e-9 ? (bodyVel.x * toP.x + bodyVel.z * toP.z) / dist : 0;
      let along = Math.min(vmax, rawAlong), reversal = 0;
      if (along < 0) { reversal = -along / a; run += along * along / (2 * a); along = 0; }
      const accelDist = Math.max(0, (vmax * vmax - along * along) / (2 * a)),
        move = run <= accelDist ? (Math.sqrt(along * along + 2 * a * run) - along) / a
          : (vmax - along) / a + (run - accelDist) / vmax;
      return wait + reversal + move;
    };
    const observed = prediction.observedPosition, fallbackTravel = travelTo(observed);
    let best = { point: observed, eta: fallbackTravel + Math.max(0, observed.y - f.spec.position.y - f.spec.gloveReachMeters), prediction, intercepted: false };
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
      if (p.y <= f.spec.position.y + f.spec.gloveReachMeters && travel <= h) {
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
    return best;
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
  const shifted = (c: Curve, offset: Vec3, velocity = v()): Curve => ({ ...c, p: add(c.p, offset), velocity: add(c.velocity, velocity),
    ...(c.stopAfter !== undefined ? { continuingVelocity: add(c.continuingVelocity ?? v(), velocity) } : {}) });
  const stopPoint = (c: Curve, t: number, acceleration: number) => {
    const speed = norm(velocityAt(c, t)); return add(at(c, t), mul(velocityAt(c, t), speed / (2 * acceleration)));
  };
  const targetInside = (p: Vec3, radius: number) => {
    const d = flat(sub(p, fenceCenter)), length = norm(d);
    return length <= radius ? p : add(fenceCenter, add(mul(d, radius / length), v(0, p.y - fenceCenter.y, 0)));
  };
  const throwOffset = (f: Fielder, position: Vec3, target: Vec3) => {
    const direction = flat(sub(target, position)), length = norm(direction), model = LIVE_FIELD_TEST_MODEL_V1.throwHand,
      desired = add(mul(direction, model.forwardMeters / Math.max(length, 1e-30)), v(0, model.heightAboveHipMeters, 0));
    return mul(desired, Math.min(1, f.spec.gloveReachMeters / norm(desired)));
  };
  let motorBoundaryFailure: unknown = null;
  let previousRoles: readonly LiveFieldRoleV1[] = [], previousHandlerId: string | null = null;
  const plan = (t: number, through: number) => {
    observe(t);
    if (!possession && throwTarget) {
      const seen = seenBy(throwTarget.receiver, t), target = throwTarget.point;
      if (seen && seen.phase !== 'possessed' && (throwTarget.releasedAt === undefined || seen.t >= throwTarget.releasedAt)
        && (target.x - seen.position.x) * seen.velocity.x + (target.z - seen.position.z) * seen.velocity.z < 0
        && distance(flat(seen.position), flat(target)) > throwTarget.receiver.spec.gloveReachMeters) {
        throwTargetCancellations.push({ elapsedSeconds: t, base: throwTarget.base, receiverPlayerId: throwTarget.receiver.spec.playerId,
          releasedAt: throwTarget.releasedAt ?? null, seenAt: seen.t, distanceToTargetMeters: distance(flat(seen.position), flat(target)) });
        throwTarget = null;
      }
    }
    const forecasts = defenders.map(f => ({ f, predicted: forecast(f, t) }));
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
            gloveReachMeters: f.spec.gloveReachMeters, gloveRadiusMeters: f.spec.gloveRadiusMeters,
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
    const selection = selectLiveFieldHandlerV1({ candidates: forecasts.flatMap(({ f, predicted }) => {
      if (!predicted) return [];
      const route = flat(sub(predicted.point, at(f.body, t))), incoming = flat(predicted.prediction.sample(Math.min(predicted.eta, predicted.prediction.maximumSeconds)).velocity),
        arrivalSeconds = liveFieldArrivalSecondsV1(roleActor(f, t), predicted.point, f.spec.gloveReachMeters),
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
    const handler = possession ?? pendingCatch?.fielder ?? throwTarget?.receiver ?? retained ?? defenders[0];
    const handlerPrediction = forecasts.find(x => x.f === handler)?.predicted;
    if (handler.spec.playerId !== previousHandlerId) {
      const source = possession ? 'possession' : pendingCatch ? 'pending_catch' : throwTarget ? 'throw_receiver'
        : retained && retained === incumbent?.f ? 'forecast_retained' : best?.f === handler ? 'forecast_best' : 'fallback_first';
      roleTransitions.push({ elapsedSeconds: t, previousHandlerId, handlerId: handler.spec.playerId, source,
        intercepted: handlerPrediction?.intercepted ?? null, eta: handlerPrediction?.eta ?? null,
        targetPoint: handlerPrediction?.point ?? null, observedPosition: handlerPrediction?.prediction.observedPosition ?? null,
        reactionGatedCount: forecasts.filter(x => !x.predicted).length });
    }
    previousHandlerId = handler.spec.playerId;
    let holderTask: { point: Vec3; intent: Fielder['intent']; base: BaseballBase | null } = { point: at(handler.body, t), intent: 'hold', base: null };
    if ((possession || pendingCatch) && !throwTarget && releaseAt === null) {
      const activeObligations = deriveCurrentForceObligations(force);
      const nearForcedBase = activeObligations
        .map(o => {
          const r = runners.find(x => x.spec.runnerId === o.runnerId)!, b = base(o.targetBase),
            runnerSec = runnerArrivalSeconds(r, o.targetBase, t),
            holderSec = liveFieldArrivalSecondsV1({ ...roleActor(handler, t), remainingReactionSeconds: 0 }, b, field.baseTouchRadiusMeters ?? .28),
            otherSec = Math.min(...defenders.filter(f => f !== handler).map(f => liveFieldArrivalSecondsV1(roleActor(f, t), b, field.baseTouchRadiusMeters ?? .28))),
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
    for (const runner of runners.filter(r => !r.retired && !r.scored)) {
      const n = runner.retouchBase ?? runner.leg?.to ?? (runner.base < 4 ? runner.base + 1 : null);
      if (n === null) continue;
      const eta = runnerArrivalSeconds(runner, n as BaseballBase, t);
      threats.push({ base: n as BaseballBase, arrivalSeconds: eta });
      // Protect the next advance as well, without reserving every unthreatened
      // base. The estimate is tactical evidence, never a runner arrival fact.
      if (n < 4 && runner.retouchBase === null) threats.push({ base: (n + 1) as BaseballBase,
        arrivalSeconds: eta + estimateLiveRunnerLegSecondsV1(distance(flat(base(n)), flat(base(n + 1))), runner.spec.topSpeedMps, runner.spec.accelerationMps2) });
    }
    const assignment = () => {
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
        pickupPoint: handlerPrediction?.point ?? at(handler.body, t), threats, reservations, previous: previousRoles });
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
    if (possession && !pendingCatch && t >= custodySince + effectiveTransferSeconds(possession) && releaseAt === null) {
      const arrive = (f: Fielder, target: Vec3) =>
        liveFieldArrivalSecondsV1({ ...roleActor(f, t), remainingReactionSeconds: 0 }, target, field.baseTouchRadiusMeters ?? .28);
      const candidates = outTargets().map(o => {
        const r = runners.find(r => r.spec.runnerId === o.runnerId)!, target = base(o.targetBase),
          receiver = defenders.find(f => f !== possession && assigned.get(f)?.intent === 'base_cover' && assigned.get(f)?.base === o.targetBase)
            ?? defenders.filter(f => f !== possession).sort((a, b) => liveFieldArrivalSecondsV1(roleActor(a, t), target)
              - liveFieldArrivalSecondsV1(roleActor(b, t), target))[0],
          throwSeconds = Math.max(.05, distance(at(possession!.glove, t), add(target, v(0, receiver.spec.position.y, 0))) / possession!.spec.throwSpeedMps)
            + (receiver.spec.gloveRadiusMeters + input.physics.ground.radiusM) / receiver.spec.gloveSpeedMps,
          runnerSeconds = runnerArrivalSeconds(r, o.targetBase, t),
          preparation = createLiveHandPreparationV1({ fromElapsedSeconds: t,
            initialOffset: sub(at(possession!.glove, t), at(possession!.body, t)),
            initialRelativeVelocity: sub(velocityAt(possession!.glove, t), velocityAt(possession!.body, t)),
            targetOffset: throwOffset(possession!, at(possession!.body, t), target), maximumRelativeSpeedMps: possession!.spec.gloveSpeedMps,
            maximumReachMeters: possession!.spec.gloveReachMeters }),
          // A non-force carry seeks the actual runner, not a bare bag. Using
          // the bag ETA after starting a tag pursuit made the holder reverse
          // toward that bag or prepare an unnecessary second throw.
          carrySeconds = o.forced || o.appeal ? arrive(possession!, target)
            : liveFieldArrivalSecondsV1({ ...roleActor(possession!, t), remainingReactionSeconds: 0 }, runnerAt(r, t), possession!.spec.gloveReachMeters),
          receiverArriveSeconds = arrive(receiver, target),
          holderDist = distance(flat(at(possession!.body, t)), flat(target)),
          directReceivingSeconds = Math.max(receiverArriveSeconds,
            (preparation.kind === 'planned' ? preparation.durationSeconds : Infinity) + throwSeconds);
        const cacheKey = custodySince + ':' + possession!.spec.playerId + ':' + r.spec.runnerId + ':' + o.targetBase,
          cached = relayCache.get(cacheKey);
        let relayPlan: LiveRelayPlanV1 | null = null;
        if (holderDist > 3.5) {
          relayPlan = cached && t - cached.at < .12 ? cached.plan : planLiveRelayV1({
            actors: defenders.map(f => ({ ...roleActor(f, t), glovePosition: at(f.glove, t), gloveVelocity: velocityAt(f.glove, t),
              gloveSpeedMps: f.spec.gloveSpeedMps, gloveReachMeters: f.spec.gloveReachMeters, gloveRadiusMeters: f.spec.gloveRadiusMeters,
              transferSeconds: effectiveTransferSeconds(f),
              ...(f.spec.throwDirectionStdRadians === undefined ? {} : { throwDirectionStdRadians: f.spec.throwDirectionStdRadians }),
              ...(f.spec.throwBackspinRadPerSecond === undefined ? {} : { throwBackspinRadPerSecond: f.spec.throwBackspinRadPerSecond }),
              ...(f.spec.throwSpinRadPerSecond === undefined ? {} : { throwSpinRadPerSecond: f.spec.throwSpinRadPerSecond }) })),
            holderPlayerId: possession!.spec.playerId, receiverPlayerId: receiver.spec.playerId, finalBase: o.targetBase,
            runnerId: r.spec.runnerId, target: add(target, v(0, receiver.spec.position.y, 0)), runnerArrivalSeconds: runnerSeconds,
            holderTransferRemainingSeconds: 0, physics: input.physics,
            excludedRelayPlayerIds: [...(relayVisited.get(r.spec.runnerId + ':' + o.targetBase) ?? [])],
            throwHandOffset: { forwardMeters: LIVE_FIELD_TEST_MODEL_V1.throwHand.forwardMeters,
              heightAboveHipMeters: LIVE_FIELD_TEST_MODEL_V1.throwHand.heightAboveHipMeters } });
          if (!cached || relayPlan !== cached.plan) {
            relayCache.set(cacheKey, { at: t, plan: relayPlan });
            relayPlans.push({ elapsedSeconds: t, playerId: possession!.spec.playerId, runnerId: r.spec.runnerId, base: o.targetBase,
              kind: relayPlan.kind, receivers: relayPlan.legs.map(l => l.receiverPlayerId), readySeconds: relayPlan.readySeconds,
              marginSeconds: relayPlan.marginSeconds, aerodynamicSolveCount: relayPlan.diagnostics.aerodynamicSolveCount });
          }
        }
        const receivingSeconds = relayPlan ? relayPlan.firstHop ? relayPlan.readySeconds : Infinity : directReceivingSeconds;
        return { runnerId: r.spec.runnerId, forced: o.forced, appeal: o.appeal, base: o.targetBase, receiver, relayPlan, margin: runnerSeconds - Math.min(carrySeconds, receivingSeconds), target,
          carrySeconds, receivingSeconds,
          carryPreferred: carrySeconds <= receivingSeconds || ((carrySeconds <= receiverArriveSeconds + .5 || holderDist <= 7.5) && runnerSeconds - carrySeconds > .45) };
      }).filter(c => !rejectedThrows.has(c.runnerId + ':' + c.base)).sort((a, b) => b.margin - a.margin || b.base - a.base);
      // A losing force throw relinquishes control without a defensible out
      // opportunity. Keep the ball, or pursue an actual reachable tag instead.
      const pick = candidates.find(candidate => candidate.margin > 0);
      if (pick) {
        const here = distance(flat(at(possession.body, t)), flat(pick.target));
        if (!pick.forced && !pick.appeal && (here <= possession.spec.gloveReachMeters + .5 || pick.carryPreferred)) {
          holderTask = { point: runnerAt(runners.find(r => r.spec.runnerId === pick.runnerId)!, t), intent: 'tag', base: null };
        } else if (here <= (field.baseTouchRadiusMeters ?? .28)) {
          holderTask = { point: pick.target, intent: 'base_cover', base: pick.base };
          holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: 'on_base_cover', base: pick.base,
            margin: pick.margin, carrySeconds: pick.carrySeconds, receivingSeconds: pick.receivingSeconds, receiverDistanceToBaseMeters: here });
        } else if (pick.carryPreferred) {
          holderTask = { point: pick.target, intent: 'base_cover', base: pick.base };
          holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: 'carry_to_base', base: pick.base,
            margin: pick.margin, carrySeconds: pick.carrySeconds, receivingSeconds: pick.receivingSeconds, receiverDistanceToBaseMeters: here });
        } else {
          const hop = pick.relayPlan?.firstHop;
          holderTask = { point: at(possession.body, t), intent: 'hold', base: null };
          throwTarget = { receiver: hop ? defenders.find(f => f.spec.playerId === hop.receiverPlayerId)! : pick.receiver,
            base: pick.base, runnerId: pick.runnerId, forced: pick.forced, appeal: pick.appeal, point: hop?.target ?? add(pick.target, v(0, pick.receiver.spec.position.y, 0)),
            receiverPoint: hop?.receiverPoint ?? pick.target, issuedFrom: at(possession.glove, t), intent: hop?.intent ?? 'base_cover' }; releaseAt = through;
          holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: 'prepare_throw', base: pick.base,
            margin: pick.margin, carrySeconds: pick.carrySeconds, receivingSeconds: pick.receivingSeconds,
            receiverPlayerId: pick.receiver.spec.playerId,
            receiverDistanceToBaseMeters: distance(flat(at(pick.receiver.body, t)), flat(pick.target)) });
        }
      } else {
        const bestCand = candidates[0];
        const offBase = runners.filter(r => !r.retired && !r.scored && r.leg).sort((a, b) => distance(at(possession!.body, t), runnerAt(a, t)) - distance(at(possession!.body, t), runnerAt(b, t)))[0];
        if (offBase) holderTask = { point: runnerAt(offBase, t), intent: 'tag', base: null };
        else holderTask = { point: at(possession.body, t), intent: 'hold', base: null };
        holderDecisions.push({ elapsedSeconds: t, playerId: possession.spec.playerId, state: offBase ? 'pursue_tag' : 'hold_no_positive_margin',
          base: bestCand?.base ?? null, margin: bestCand?.margin, carrySeconds: bestCand?.carrySeconds, receivingSeconds: bestCand?.receivingSeconds });
      }
      planned = assignment(); assigned = planned.targets;
    }
    if (defensiveOpportunity && !possession && !pendingCatch && !hasThrown) {
      const roles: LiveFieldRoleV1[] = defenders.map(f => ({ playerId: f.spec.playerId, taskId: 'no-defensive-opportunity',
        point: at(f.body, t), intent: 'hold', targetBase: null }));
      planned = { roles, targets: new Map(defenders.map(f => [f, { point: at(f.body, t), intent: 'hold' as const, base: null }])) };
      assigned = planned.targets;
    }
    previousRoles = planned.roles;
    // Plan all bodies from the same world before moving any glove. Teammate
    // avoidance changes bounded acceleration, never a position or velocity.
    const bodyPlans = new Map<Fielder, { before: Vec3; vel: Vec3; target: { point: Vec3; intent: LiveFieldFrameV1['fielders'][number]['intent']; base: BaseballBase | null };
      delta: number; active: boolean; body: Curve; bodyBoundaryLimited: boolean; currentOffset: Vec3; gloveRadius: number;
      accepts: (motion: Readonly<{ acceleration: Vec3; stopAfter?: number }>) => boolean }>();
    for (const f of defenders) {
      const before = at(f.body, t), vel = velocityAt(f.body, t), target = assigned.get(f)!, delta = through - t;
      const active = !dead && t >= start + responseSeconds(f);
      const bodyRadius = LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters, gloveRadius = Math.max(f.spec.gloveRadiusMeters, input.physics.ground.radiusM),
        grip = at(f.glove, t), currentOffset = sub(grip, before);
      let motorPoint = target.point;
      if (active && target.intent === 'intercept' && target.point.y <= gloveRadius + .2
        && (forecasts.find(x => x.f === f)?.predicted?.prediction.observedPosition.y ?? Infinity) <= gloveRadius + .2) {
        const pred = forecasts.find(x => x.f === f)?.predicted,
          toT = flat(sub(target.point, before)), distT = norm(toT),
          stopTime = liveFieldArrivalSecondsV1({ ...roleActor(f, t), remainingReactionSeconds: 0 }, target.point, .02) + norm(vel) / f.spec.accelerationMps2;
        const chargeSkill = f.spec.technicalSkills?.slow_ball_charge ?? 0, seen = chargeSkill > 0 ? seenBy(f, t) : null,
          charging = chargeSkill > 0 && !possession && !pendingCatch && !hasThrown && !throwTarget
            && firstGroundContactSeconds !== null && seen !== null && seen.t >= firstGroundContactSeconds
            && seen.position.y <= input.physics.ground.radiusM + .05 && norm(seen.velocity) <= 10;
        if (distT > (charging ? .15 : .35) && (charging || !pred || !pred.intercepted || pred.eta < stopTime)) {
          const runThrough = (f.spec.topSpeedMps * f.spec.topSpeedMps) / (2 * f.spec.accelerationMps2) + .5;
          motorPoint = add(target.point, mul(toT, runThrough / distT));
          // A bounded observed-ball lead changes the approach route; all motor/avoidance limits still apply.
          if (charging) motorPoint = add(motorPoint, mul(flat(seen!.velocity), .03 * chargeSkill));
        }
      }
      const seg = buildDefenderMotionTrajectory({ tick: 0, position: flat(before), velocity: flat(vel) }, active && !defensiveOpportunity ? flat(targetInside(motorPoint, fenceRadius - bodyRadius - .02)) : null,
        Math.max(1, Math.round(delta * tps)), { ticksPerSecond: tps, maxIntegrationStepTicks: Math.max(1, Math.round(delta * tps)),
          accelerationMps2: f.spec.accelerationMps2, brakingMps2: f.spec.accelerationMps2, topSpeedMps: f.spec.topSpeedMps, arrivalRadiusMeters: .02 })[0];
      const proposed: Curve = { from: t, p: before, velocity: vel, acceleration: v(seg.acceleration.x, 0, seg.acceleration.z) },
        speed = norm(vel), emergency: Curve = { from: t, p: before, velocity: vel,
          acceleration: speed > 0 ? mul(vel, -f.spec.accelerationMps2 / speed) : v(), stopAfter: speed / f.spec.accelerationMps2 };
      const bodySafe = (c: Curve, stoppingReserve: number = LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters) => [ { offset: v(), radius: bodyRadius }, { offset: currentOffset, radius: gloveRadius } ].every(o => {
        const translated = shifted(c, o.offset);
        return curveInside(translated, t, through, fenceRadius - o.radius, 0)
          && pointInside(add(stopPoint(c, through, f.spec.accelerationMps2), o.offset), fenceRadius - o.radius - stoppingReserve);
      });
      let body = proposed, bodyBoundaryLimited = false;
      if (!bodySafe(body)) {
        bodyBoundaryLimited = true;
        if (!bodySafe(emergency, 0)) { motorBoundaryFailure = { kind: 'body_fence_motor_infeasible', playerId: f.spec.playerId, position: before, velocity: vel,
          currentOffset, emergencyStop: stopPoint(emergency, through, f.spec.accelerationMps2), emergencyEnd: at(emergency, through) }; return; }
        body = emergency; let low = 0, high = 1;
        for (let i = 0; i < 32; i++) {
          const u = (low + high) / 2, candidate = { ...proposed, acceleration: add(mul(emergency.acceleration, 1 - u), mul(proposed.acceleration, u)) };
          if (bodySafe(candidate)) { low = u; body = candidate; } else high = u;
        }
      }
      const asCurve = (motion: Readonly<{ acceleration: Vec3; stopAfter?: number }>): Curve => ({ from: t, p: before, velocity: vel,
        acceleration: motion.acceleration, ...(motion.stopAfter === undefined ? {} : { stopAfter: motion.stopAfter }) });
      bodyPlans.set(f, { before, vel, target, delta, active, body, bodyBoundaryLimited, currentOffset, gloveRadius,
        accepts: motion => bodySafe(asCurve(motion)) || (motion.stopAfter === emergency.stopAfter
          && distance(motion.acceleration, emergency.acceleration) <= 1e-12 && bodySafe(asCurve(motion), 0)) });
    }
    const coordination = coordinateLiveFielderMotionV1({ fromSeconds: t, throughSeconds: through,
      actors: defenders.map(f => { const p = bodyPlans.get(f)!;
        return { playerId: f.spec.playerId, position: p.before, velocity: p.vel,
          accelerationMps2: f.spec.accelerationMps2, topSpeedMps: f.spec.topSpeedMps, bodyRadiusMeters: LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters,
          priority: f === possession || f === pendingCatch?.fielder ? 700 : f === throwTarget?.receiver ? 600 : f === handler ? 500
            : p.target.intent === 'tag' ? 450 : p.target.intent === 'base_cover' ? 300 : p.target.intent === 'relay' ? 200 : p.target.intent === 'backup' ? 100 : 0,
          canSteer: t >= start + responseSeconds(f),
          preferred: { acceleration: p.body.acceleration, ...(p.body.stopAfter === undefined ? {} : { stopAfter: p.body.stopAfter }) }, accepts: p.accepts };
      }) });
    if (!coordination.safe) { motorBoundaryFailure = { kind: 'fielder_separation_plan_required', elapsedSeconds: t, diagnostics: coordination.diagnostics }; return; }
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
      f.body = { from: t, p: p.before, velocity: p.vel, acceleration: command.motion.acceleration,
        ...(command.motion.stopAfter === undefined ? {} : { stopAfter: command.motion.stopAfter }) };
      f.intent = p.active ? p.target.intent : 'hold'; f.targetBase = p.target.base;
    }
    for (const f of defenders) {
      const { vel, target, delta, active, bodyBoundaryLimited, currentOffset, gloveRadius } = bodyPlans.get(f)!, body = f.body, grip = at(f.glove, t);
      const heldOffset = throwTarget && f === possession ? throwOffset(f, at(f.body, through), throwTarget.point) : v(0, 0, -.5);
      const expected = forecasts.find(x => x.f === f)?.predicted,
        sampledNext = expected ? expected.prediction.sample(Math.min(delta, expected.prediction.maximumSeconds)).position : null,
        perceivedTarget = expected
          ? expected.intercepted || (sampledNext && distance(flat(sampledNext), flat(fenceCenter)) <= fenceRadius - input.physics.ground.radiusM)
            ? sampledNext! : expected.point
          : at(f.body, through);
      let anticipated = f === handler || f === throwTarget?.receiver ? expected?.point ?? perceivedTarget : perceivedTarget;
      if (distance(perceivedTarget, at(f.body, through)) <= f.spec.gloveReachMeters + f.spec.gloveRadiusMeters + input.physics.ground.radiusM)
        anticipated = perceivedTarget;
      if (f === throwTarget?.receiver) {
        const bodyAtThrough = at(f.body, through),
          q = throwTarget.point,
          frontDist = Math.min(f.spec.gloveReachMeters * .55, LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + f.spec.gloveRadiusMeters + .12),
          seen = seenBy(f, t),
          sourcePos = possession ? at(possession.glove, t) : (throwTarget.releasedFrom ?? seen?.position ?? bodyAtThrough),
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
      const tagRunner = f === possession && target.intent === 'tag' ? runners.filter(r => !r.retired && !r.scored && r.leg)
        .sort((a, b) => distance(at(f.body, through), runnerAt(a, through)) - distance(at(f.body, through), runnerAt(b, through)))[0] : null;
      const relative = sub(bodyBoundaryLimited ? at(f.body, through) : tagRunner ? add(runnerAt(tagRunner, through), v(0, .9, 0))
        : defensiveOpportunity ? at(f.body, through)
        : (f === possession || f === pendingCatch?.fielder) ? add(at(f.body, through), heldOffset)
        : f === handler || f === throwTarget?.receiver ? reachableTarget : at(f.body, through), at(f.body, through));
      const desired = add(at(f.body, through), mul(relative, Math.min(1, f.spec.gloveReachMeters / Math.max(norm(relative), 1e-30)))),
        limited = targetInside(v(desired.x, Math.max(gloveRadius, desired.y), desired.z), fenceRadius - gloveRadius - .02),
        wantedOffset = sub(limited, at(f.body, through)), targetOffset = mul(wantedOffset, Math.min(1, f.spec.gloveReachMeters / Math.max(norm(wantedOffset), 1e-30))),
        relativeMove = sub(targetOffset, currentOffset), relativeVelocity = active ? mul(relativeMove, Math.min(1, f.spec.gloveSpeedMps * delta / Math.max(norm(relativeMove), 1e-30)) / delta) : v();
      const gloveCurve = (u: number): Curve => ({ ...body, p: grip, velocity: add(vel, mul(relativeVelocity, u)),
        ...(body.stopAfter !== undefined ? { continuingVelocity: mul(relativeVelocity, u) } : {}) });
      const gloveSafe = (c: Curve, stoppingReserve: number = LIVE_FIELD_TEST_MODEL_V1.fenceMotorStoppingReserveMeters, motorThrough = through) => {
        if (!curveInside(c, t, motorThrough, fenceRadius - gloveRadius, gloveRadius)
          || !pointInside(add(stopPoint(body, motorThrough, f.spec.accelerationMps2), sub(at(c, motorThrough), at(body, motorThrough))), fenceRadius - gloveRadius - stoppingReserve)) return false;
        if (pendingCatch?.fielder === f) {
          const capture = pendingCatch, duration = capture.secure - capture.first, until = Math.min(through, capture.secure),
            offset = mul(capture.offset, Math.max(0, 1 - (t - capture.first) / duration)), captureCurve = shifted(c, offset, mul(capture.offset, -1 / duration));
          if (until > t && !curveInside(captureCurve, t, until, fenceRadius - input.physics.ground.radiusM + LIVE_FIELD_TEST_MODEL_V1.wallMaterial.maximumCompressionMeters,
            input.physics.ground.radiusM - roundBound(at(captureCurve, t)))) return false;
        }
        return true;
      };
      if (f === possession && throwTarget && (!bodyBoundaryLimited || handPreparation?.fielder === f)) {
        if (!handPreparation || handPreparation.fielder !== f || handPreparation.base !== throwTarget.base) {
          const preparation = createLiveHandPreparationV1({ fromElapsedSeconds: t, initialOffset: currentOffset,
            initialRelativeVelocity: sub(velocityAt(f.glove, t), vel), targetOffset: heldOffset,
            maximumRelativeSpeedMps: f.spec.gloveSpeedMps, maximumReachMeters: f.spec.gloveReachMeters });
          if (preparation.kind === 'planned') {
            handPreparation = { fielder: f, base: throwTarget.base, curve: preparation, prepared: preparation.throughElapsedSeconds === t };
            handPreparationProofs.push({ playerId: f.spec.playerId, base: throwTarget.base, from: preparation.fromElapsedSeconds,
              through: preparation.throughElapsedSeconds, target: throwTarget.point,
              controls: preparation.cubicBezierControls(preparation.fromElapsedSeconds, preparation.throughElapsedSeconds),
              diagnostics: preparation.diagnostics });
          }
          else {
            for (const o of deriveCurrentForceObligations(force).filter(o => o.targetBase === throwTarget!.base)) rejectedThrows.add(o.runnerId + ':' + o.targetBase);
            throwDecisions.push({ elapsedSeconds: t, base: throwTarget.base, reason: 'c1_hand_preparation_unreachable' });
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
      if (!gloveSafe(glove)) {
        if (!gloveSafe(gloveCurve(0), 0)) { motorBoundaryFailure = { kind: 'glove_fence_motor_infeasible', playerId: f.spec.playerId, position: grip }; return; }
        glove = gloveCurve(0); let low = 0, high = 1;
        for (let i = 0; i < 32; i++) { const u = (low + high) / 2, candidate = gloveCurve(u);
          if (gloveSafe(candidate)) { low = u; glove = candidate; } else high = u; }
      }
      f.glove = glove;
    }
    runnerDecisionPending = false;
    lastRunnerEvaluationSeconds = t;
    const defenseControlCache = new Map<number, number | null>();
    const estimateDefenseControl = (n: number): number | null => {
      if (defenseControlCache.has(n)) return defenseControlCache.get(n)!;
      const fastestArm = Math.max(...defenders.map(f => f.spec.throwSpeedMps + norm(velocityAt(f.body, t)))),
        estimates = defenders.flatMap(f => {
          const controlled = possession ?? pendingCatch?.fielder;
          if (controlled && controlled !== f) return [];
          const predicted = forecasts.find(x => x.f === f)?.predicted;
          if (!controlled && !predicted) return [];
          const pickupSeconds = possession ? 0 : pendingCatch ? Math.max(0, pendingCatch.secure - t) : predicted!.eta,
            point = controlled ? at(f.glove, t) : predicted!.point,
            transfer = possession ? Math.max(0, custodySince + effectiveTransferSeconds(f) - t) : effectiveTransferSeconds(f),
            // The fastest available arm is a lower bound for any direct/relay
            // route. Do not let a weak holder hide a possible strong cutoff.
            throwSeconds = distance(point, add(base(n), v(0, .9, 0))) / fastestArm,
            receiverSeconds = Math.min(...defenders.filter(other => other !== f).map(other => liveFieldArrivalSecondsV1(roleActor(other, t), base(n), other.spec.gloveReachMeters)));
          return [Math.min(pickupSeconds + liveFieldArrivalSecondsV1({ ...roleActor(f, t), position: point }, base(n), f.spec.gloveReachMeters),
            Math.max(pickupSeconds + transfer + throwSeconds, receiverSeconds))];
        });
      const result = estimates.length ? Math.min(...estimates) : null; defenseControlCache.set(n, result); return result;
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
        for (const f of defenders) if (point.y <= f.spec.position.y + f.spec.gloveReachMeters)
          catchMarginSeconds = Math.max(catchMarginSeconds, h - liveFieldArrivalSecondsV1(roleActor(f, t), point, f.spec.gloveReachMeters));
      }
      return { observedAtSeconds: seen.t, catchMarginSeconds: catchMarginSeconds + runnerReadBias.get(r.spec.runnerId)! };
    };
    for (const r of runners.slice().sort((a, b) => b.base - a.base)) {
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
      const defenderControlSeconds = estimateDefenseControl(next);
      const awardTarget = overFence?.fair ? Math.min(4, (overFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + (overFence.untouchedGround ? 4 : 2)) : null;
      const decision = decideLiveRunnerAdvanceV1({ nowSeconds: t, playStartedAtSeconds: start, currentBase: r.base as 0 | 1 | 2 | 3, outs: input.outs as 0 | 1 | 2,
        distanceToNextBaseMeters: distance(flat(runnerAt(r, t)), flat(base(next))), baseTouchRadiusMeters: field.baseTouchRadiusMeters ?? .28,
        targetOccupied, runner: r.spec, forced,
        awardThroughBase: awardTarget as BaseballBase | null,
        firstGroundContactElapsedSeconds: firstGroundContactSeconds,
        firstFielderTouchElapsedSeconds: firstFielderTouchSeconds,
        defenderControlSeconds, airborneAssessment: airborneAssessment(r), policy: { safetyMarginSeconds: r.spec.advanceSafetyMarginSeconds } });
      if (decision.reason === 'recognizing_departure_cue' && !targetOccupied) runnerDecisionPending = true;
      const previous = runnerDecisions.slice().reverse().find(d => d.runnerId === r.spec.runnerId);
      if (!previous || previous.targetBase !== next || previous.reason !== decision.reason || decision.advance)
        runnerDecisions.push({ elapsedSeconds: t, runnerId: r.spec.runnerId, targetBase: next, defenderControlSeconds, ...decision });
      if (decision.advance && !(r.base === 0 && flyCatch) && !(dead && awardTarget === null)) beginLeg(r, next as BaseballBase, t);
    }
    for (const r of runners.slice().sort((a, b) => b.base - a.base)) {
      const leg = r.leg;
      if (!leg || leg.returning || r.retouchBase !== null || r.retired || r.scored || leg.departure !== null && leg.nextTouchIndex > 0 || leg.nextTouchIndex >= leg.motion.touches.length
        || leg.motion.touches.length - leg.nextTouchIndex > 1 || leg.to >= 4
        || t < (roundingRecheckAfter.get(r.spec.runnerId) ?? -Infinity)) continue;
      const awardThrough = overFence?.fair ? Math.min(4, (overFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + (overFence.untouchedGround ? 4 : 2)) : null,
        cue = firstGroundContactSeconds ?? firstFielderTouchSeconds;
      const airborne = cue === null ? airborneAssessment(r) : undefined;
      if (awardThrough === null && (dead || (cue === null ? !airborne || airborne.catchMarginSeconds >= -(r.spec.advanceSafetyMarginSeconds ?? .35)
        : t < cue + r.spec.reactionSeconds))) continue;
      const finalBase = awardThrough !== null ? awardThrough : leg.to + 1;
      if (finalBase <= leg.to || Array.from({ length: finalBase - leg.to + 1 }, (_, i) => leg.to + i).some(n => targetOccupiedByOther(r, n))) continue;
      roundingRecheckAfter.set(r.spec.runnerId, t + .12);
      const defense = estimateDefenseControl(finalBase);
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
  observe(start);
  while (time < max && !terminal) {
    if (time === controlThrough) { controlThrough = Math.min(max, time + LIVE_FIELD_TEST_MODEL_V1.controlSeconds); ensureThrough(controlThrough); plan(time, controlThrough);
      if (motorBoundaryFailure) { unresolvedDetail = motorBoundaryFailure; endReason = 'actor_boundary_motor_required'; break; } }
    let horizon = controlThrough, event: { kind: string; t: number; f?: Fielder; role?: 'glove' | 'body'; hit?: Hit; base?: BaseballBase; runner?: Runner } | null = null;
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
          const c = role === 'glove' ? f.glove : f.body, radius = role === 'glove' ? f.spec.gloveRadiusMeters : LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters;
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
    if (possession && !dead) {
      const f = possession, speed = Math.max(norm(velocityAt(f.body, time)), norm(velocityAt(f.body, horizon)));
      for (const n of [1, 2, 3, 4] as const) {
        const relevant = outTargets().some(o => (o.forced || o.appeal) && o.targetBase === n);
        if (!relevant) continue;
        const hit = findContact(t => distance(flat(at(f.body, t)), flat(base(n))) - (field.baseTouchRadiusMeters ?? .28), speed, 128 * Number.EPSILON, time, horizon);
        if (hit && !hit.ambiguous) choose({ kind: 'base', t: hit.t, f, base: n });
      }
      for (const r of runners) if (!r.retired && !r.scored) {
        const forced = deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId);
        if (!r.leg && !forced && r.retouchBase === null) continue;
        const hit = findContact(t => Math.max(distance(at(f.glove, t), add(runnerAt(r, t), v(0, .9, 0))) - .28,
          r.base > 0 && !forced && r.retouchBase === null ? (field.baseTouchRadiusMeters ?? .28) - distance(flat(runnerAt(r, t)), flat(base(r.base))) : -Infinity),
          maximumCurveSpeed(f.glove, time, horizon) + r.spec.topSpeedMps, 128 * Number.EPSILON, time, horizon);
        if (hit && !hit.ambiguous) choose({ kind: 'tag', t: hit.t, f, runner: r });
      }
    }
    while (nextFrame < horizon) { sampleFrame(nextFrame); nextFrame = start + frames.length * frameSeconds; }
    time = horizon;
    // The explicit cast prevents TS losing mutations performed by choose().
    const e = event as { kind: string; t: number; f?: Fielder; role?: 'glove' | 'body'; hit?: Hit; base?: BaseballBase; runner?: Runner } | null;
    if (e) {
      if (e.kind === 'unresolved') { endReason = 'numerical_contact_refinement_required'; terminal = true; }
      else if (e.kind === 'ground' || e.kind === 'rolling_stop') {
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
        const f = e.f!, c = e.role === 'glove' ? f.glove : f.body, incoming = kernel.evaluateAt(time, 'incoming'), center = at(c, time), delta = sub(incoming.moment.ball.position, center), normal = mul(delta, 1 / norm(delta));
        const phase = multiplyQuaternions(incoming.orientation, orientationBasis);
        if (!territoryFixed) determineTerritory(time, isFair(incoming.moment.ball.position) ? 'fair' : 'foul');
        if (firstTouchTick === null) for (const r of runners) if (r.spec.initialBase > 0)
          tagUpAtFirstTouch.set(r.spec.runnerId, distance(flat(runnerAt(r, time)), flat(base(r.spec.initialBase))) <= (field.baseTouchRadiusMeters ?? .28));
        firstTouchTick ??= tick(time); firstFielderTouchSeconds ??= time;
        if (territory === 'foul' && firstGroundContactTick !== null) { dead = true; terminal = true; endReason = 'foul_dead_ball'; continue; }
        let outgoing;
        if (e.kind === 'glove') {
          emit('glove_contact', time, { playerId: f.spec.playerId, position: incoming.moment.ball.position });
          // The spherical capture-volume model has a local entry plane at the
          // contact normal. Normal radii are not a lateral miss of the pocket.
          // A future oriented aperture may supply a different entry-center pose.
          const ballSurfacePoint = sub(incoming.moment.ball.position, mul(normal, input.physics.ground.radiusM));
          const pocketEntryCenter = add(center, mul(normal, f.spec.gloveRadiusMeters));
          const pocketOffsetMeters = distance(ballSurfacePoint, pocketEntryCenter);
          const bodySpd = norm(velocityAt(f.body, time)), gloveExt = distance(center, at(f.body, time)),
            gloveRelSpd = norm(sub(velocityAt(c, time), velocityAt(f.body, time))),
            speedRatio = clamp(bodySpd / Math.max(f.spec.topSpeedMps, .1), 0, 1),
            extRatio = clamp(gloveExt / Math.max(f.spec.gloveReachMeters, .1), 0, 1),
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
              effectiveCapacityJ: retention.diagnostics.effectiveCapacityJ, pocketOffsetMeters, bodyStability } });
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
        const moment = { ...incoming.moment, ball: outgoing }; kernel = build(moment); wallContact = null; orientationBasis = phase; side = 'outgoing';
        reboundEscape = { fielder: f, role: e.role!, hit: e.hit!, normal, outgoing: kernel.evaluateAt(time, 'outgoing').moment };
      } else if (e.kind === 'hand_prepared') {
        handPreparation!.prepared = true; controlThrough = time; if (releaseAt !== null) releaseAt = time;
      } else if (e.kind === 'secure') {
        const c = pendingCatch!; orientationBasis = ballAt(time).orientation; possession = c.fielder; pendingCatch = null; custodySince = time;
        rejectedThrows.clear(); relayCache.clear(); handPreparation = null;
        emit('catch_secured', time, { playerId: possession.spec.playerId, position: at(possession.glove, time) });
        if (c.firstTouchWasAirborne && !flyCatch) {
          flyCatch = { fielderId: possession.spec.playerId, firstTouchTick: firstTouchTick!, secureCatchTick: tick(time) }; retire(batter, time);
          for (const r of runners) if (!r.retired && r.spec.initialBase > 0 && !tagUpAtFirstTouch.get(r.spec.runnerId)) {
            const left = runnerDepartures.slice().reverse().find(d => d.runnerId === r.spec.runnerId && d.base === r.spec.initialBase
              && d.tick <= firstTouchTick!), retouched = runnerTouches.some(b => b.runnerId === r.spec.runnerId && b.base === r.spec.initialBase
                && b.tick >= firstTouchTick! && b.tick <= tick(time));
            // The official fact clock treats first-touch and departure on the
            // same tick as a legal departure. A completed retouch between first
            // contact and secure possession also cures the obligation.
            if (retouched || left && left.tick === firstTouchTick) continue;
            r.retouchBase = r.spec.initialBase as 1 | 2 | 3; r.returnReadyAt = time + r.spec.reactionSeconds; r.scored = false;
          }
        }
      } else if (e.kind === 'release') {
        const f = possession!, target = throwTarget!, position = at(f.glove, time), q = target.point, d = sub(q, position), speed = f.spec.throwSpeedMps;
        if (!pointInside(position, fenceRadius - input.physics.ground.radiusM)) {
          unresolvedDetail = { kind: 'held_ball_fence_constraint', playerId: f.spec.playerId, position };
          terminal = true; endReason = 'actor_boundary_motor_required'; continue;
        }
        const obligations = outTargets().filter(o => o.targetBase === target.base && o.runnerId === target.runnerId);
        const reject = (reason: string, flightSeconds?: number) => {
          for (const o of obligations) rejectedThrows.add(o.runnerId + ':' + o.targetBase);
          throwDecisions.push({ elapsedSeconds: time, base: target.base, reason, ...(flightSeconds === undefined ? {} : { flightSeconds }) });
          throwTarget = null; releaseAt = null; handPreparation = null;
        };
        // A target may disappear while the physical hand/receiver is preparing.
        // Cancel before readiness guards can keep a stale command waiting.
        if (!obligations.length) { reject('force_already_satisfied'); continue; }
        const radial = sub(position, at(f.body, time));
        const preparation = handPreparation as HandPreparationState | null,
          preparationReady = preparation?.fielder === f && preparation.base === target.base && preparation.prepared,
          desiredOffset = preparationReady ? preparation!.curve.sampleAtElapsedSeconds(preparation!.curve.throughElapsedSeconds).offset : throwOffset(f, at(f.body, time), q),
          otherShapeClear = defenders.filter(other => other !== f).every(other =>
          distance(position, at(other.body, time)) > LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + input.physics.ground.radiusM
          && distance(position, at(other.glove, time)) > other.spec.gloveRadiusMeters + input.physics.ground.radiusM);
        const distToBag = distance(flat(at(target.receiver.body, time)), flat(target.receiverPoint)),
          touchR = field.baseTouchRadiusMeters ?? .28,
          brakeEtaToBag = distToBag <= touchR ? 0
            : Math.sqrt(2 * distToBag / target.receiver.spec.accelerationMps2) - Math.sqrt(2 * touchR / target.receiver.spec.accelerationMps2),
          receiverEtaToBag = Math.max(
            liveFieldArrivalSecondsV1({ ...roleActor(target.receiver, time), remainingReactionSeconds: 0 }, target.receiverPoint, touchR),
            brakeEtaToBag);
        const receiverPrepared = distToBag <= target.receiver.spec.gloveReachMeters + touchR
          && receiverEtaToBag <= distance(position, q) / speed;
        if (norm(radial) <= LIVE_FIELD_TEST_MODEL_V1.bodyRadiusMeters + input.physics.ground.radiusM
          || !preparationReady || distance(radial, desiredOffset) > input.physics.ground.radiusM
          || !otherShapeClear || !receiverPrepared) { releaseAt = controlThrough; if (releaseAt === time) releaseAt += LIVE_FIELD_TEST_MODEL_V1.controlSeconds; continue; }
        const horizontalSpeed = norm(flat(d)), backspin = f.spec.throwBackspinRadPerSecond ?? 0;
        assert(Number.isFinite(backspin) && backspin >= 0 && (!f.spec.throwSpinRadPerSecond || finite(f.spec.throwSpinRadPerSecond)), 'explicit throw spin differs');
        const spin = f.spec.throwSpinRadPerSecond ?? (horizontalSpeed > 0 ? v(-d.z / horizontalSpeed * backspin, 0, d.x / horizontalSpeed * backspin) : v()),
          planned = planLiveThrowV1({ releasePosition: position, bodyVelocity: velocityAt(f.body, time), maximumThrowSpeedMps: speed,
            spin, physics: input.physics, target: q });
        if (planned.kind !== 'planned') { reject('aero_throw_unreachable'); continue; }
        const runnerTime = Math.max(...obligations.map(o => {
          const r = runners.find(r => r.spec.runnerId === o.runnerId)!;
          return runnerArrivalSeconds(r, target.base, time);
        }));
        if (runnerTime <= planned.flightSeconds) { reject('aero_throw_arrives_after_runner', planned.flightSeconds); continue; }
        const bodyVelocity = velocityAt(f.body, time), actualDirection = applyLiveThrowDirectionV1({ velocity: planned.initialVelocity, bodyVelocity, spin,
          standardDeviationRadians: f.spec.throwDirectionStdRadians ?? 0, seed: input.seed ?? 0, releaseOrdinal: throwDirectionCommands.length }),
          velocity = actualDirection.velocity;
        throwDirectionCommands.push({ elapsedSeconds: time, plannedVelocity: planned.initialVelocity, bodyVelocity, actual: actualDirection });
        throwDecisions.push({ elapsedSeconds: time, base: target.base, reason: 'positive_margin_physical_throw', flightSeconds: planned.flightSeconds });
        kernel = build({ originTick, elapsedSeconds: time, ball: { tick: tick(time), position, velocity, spin } }); wallContact = null;
        emit('throw_release', time, { playerId: f.spec.playerId, base: target.base, position, runnerId: target.runnerId,
          reason: target.intent === 'relay' ? 'relay_play' : obligations.some(o => o.appeal) ? 'appeal_play' : obligations.some(o => o.forced) ? 'force_play' : 'tag_play',
          receiverPlayerId: target.receiver.spec.playerId, target: q });
        const visitKey = target.runnerId + ':' + target.base, visited = relayVisited.get(visitKey) ?? new Set<string>();
        visited.add(f.spec.playerId); relayVisited.set(visitKey, visited);
        hasThrown = true; lastThrowBases = Object.fromEntries(runners.filter(r => !r.retired && !r.scored).map(r => [r.spec.runnerId, r.base]));
        target.releasedAt = time; target.releasedFrom = position;
        handPreparation = null;
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
        if (leg.nextTouchIndex < leg.motion.touches.length) {
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
        emit('runner_base_touch', time, { runnerId: r.spec.runnerId, base: touch.base as BaseballBase, position: r.p });
        if (deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId && o.targetBase === touch.base))
          force = satisfyForceParticipantObligation(force, r.spec.runnerId);
        // Re-evaluate a further advance and newly vacated bases before closing
        // the play. A pre-arrival hold decision cannot settle the new state.
        runnerDecisionPending = true; controlThrough = time;
      } else if (e.kind === 'runner_stop') {
        const r = e.runner!; r.p = runnerAt(r, time); r.leg = null; runnerDecisionPending = true; controlThrough = time;
      } else if (e.kind === 'runner_departure') {
        const r = e.runner!, departure = r.leg!.departure!; r.leg!.departure = null;
        physicalBaseDepartures.set(r.spec.runnerId, { ...departure, tick: tick(time) });
        runnerDepartures.push({ kind: 'runner_base_departure', runnerId: r.spec.runnerId, base: departure.base, tick: tick(time) });
        emit('runner_base_departure', time, { runnerId: r.spec.runnerId, base: departure.base });
      } else if (e.kind === 'base') applyBaseControl(e.f!, e.base!, time);
      else if (e.kind === 'tag') {
        const r = e.runner!;
        const departure = physicalBaseDepartures.get(r.spec.runnerId), position = runnerAt(r, time), velocity = runnerVelocityAt(r, time),
          radial = departure ? flat(sub(position, base(departure.base))) : v(),
          protectionEndedByDeparture = departure && departure.base === r.base && departure.tick === tick(time) && departure.elapsedSeconds <= time
            && !deriveCurrentForceObligations(force).some(o => o.runnerId === r.spec.runnerId)
            && norm(radial) > (field.baseTouchRadiusMeters ?? .28) && radial.x * velocity.x + radial.z * velocity.z > 0
            && distance(at(e.f!.glove, time), add(position, v(0, .9, 0))) <= .28
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
          orientationBasis = multiplyQuaternions(kernel.evaluateAt(time, 'incoming').orientation, orientationBasis);
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
    const runnersComplete = runners.every(r => r.retired || r.retouchBase === null && !r.leg && (r.scored || r.base > 0 || !!flyCatch));
    if (overFence?.fair && overFence.untouchedGround && runners.every(r => r.retired || r.scored && !r.leg)) { endReason = 'home_run_completed'; terminal = true; }
    const awardedFence = overFence;
    if (awardedFence?.fair && !awardedFence.untouchedGround && runners.every(r => r.retired || !r.leg && r.base >= Math.min(4, (awardedFence.awardFrom?.[r.spec.runnerId] ?? r.spec.initialBase) + 2))) { endReason = 'ground_rule_award_completed'; terminal = true; }
    if (!dead && possession && runnersComplete && !runnerDecisionPending && time - custodySince >= Math.max(.6, effectiveTransferSeconds(possession))
      && (releaseAt === null || outTargets().length === 0)) { endReason = 'live_action_complete'; terminal = true; }
    if (time === horizon && !e && horizon === max) break;
  }
  sampleFrame(time);
  const complete = ['third_out', 'foul_dead_ball', 'home_run_completed', 'ground_rule_award_completed', 'live_action_complete'].includes(endReason),
    playEnd: PlayEndFact = { kind: 'play_end', tick: tick(time), reason: dead ? 'dead_ball' : 'live_action_complete' };
  emit('play_end', time, { reason: endReason });
  const ruleFacts: LiveFieldRuleFactsV1 = { contactTick: input.ball.ball.tick, throughTick: tick(time), territory,
    firstGroundContactTick, flyCatch, runnerTouches, controlledBaseContacts, controlledRunnerTags, runnerDepartures, defensiveAppeals, overFence, playEnd };
  return freeze({ version: 'live_field_play_v1' as const, modelBasis: LIVE_FIELD_TEST_MODEL_V1.basis, model: LIVE_FIELD_TEST_MODEL_V1,
    fieldGeometry,
    frames, facts, ruleFacts, end: { elapsedSeconds: time, tick: tick(time), reason: endReason, complete },
    finalRunners: runners.map(r => ({ runnerId: r.spec.runnerId, base: r.base, position: runnerAt(r, time), retired: r.retired, scored: r.scored,
      retouchRequiredBase: r.retouchBase })),
    diagnostics: { kernelBuilds, kernelExtensions, wallKernelBuilds, wallSupports, simultaneousContacts, throwDecisions, throwDirectionCommands, handPreparationProofs, forecastBuilds, collisionQueries, unresolvedDetail, departureProofs,
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
      aiTelemetry: { roleTransitions, defensiveOpportunityTransitions, throwTargetCancellations, contactDiagnostics, holderDecisions, runnerDecisions, relayPlans, runnerMotions, fielderAvoidanceTransitions },
      renderFramesOwnPhysics: false, namedLeagueCalibration: false, nativeActuation: false } });
}
