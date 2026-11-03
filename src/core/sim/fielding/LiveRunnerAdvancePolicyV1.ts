import { validateTechnicalSkillControlsV75, type TechnicalSkillControlsV75 } from '../TechnicalSkillControlsV75';
import { buildLiveSpeedPlanV84, createLiveLocomotionProfileV84 } from '../locomotion/LiveLocomotionV84';

/** Shared controller settings, not player abilities or empirical calibration.
 * Existing runner reaction is added to each new legal departure cue. */
export const LIVE_RUNNER_ADVANCE_POLICY_V1 = Object.freeze({
  safetyMarginSeconds: .35,
  recognitionSeconds: 0,
});

/** Authored tactical shape, UNMEASURED: no real-game calibration. Used only when `tacticsV1` is passed. */
export const LIVE_RUNNER_TACTICS_POLICY_V1 = Object.freeze({
  lineDriveReadSeconds: .25, lineDriveMarginScale: 2,
  halfwayMaxLandingDepthMeters: 60, halfwayMaxCatchMarginSeconds: .8, halfwayLongHangSeconds: 1.2, halfwayShortHangSeconds: .6,
  halfwayLongFraction: .5, halfwayShortFraction: .3,
});

export type LiveRunnerAdvanceInputV1 = Readonly<{
  nowSeconds: number;
  playStartedAtSeconds: number;
  currentBase: 0 | 1 | 2 | 3;
  distanceToNextBaseMeters: number;
  /** Actual contact geometry. Omitted keeps the legacy center-stop estimate. */
  baseTouchRadiusMeters?: number;
  targetOccupied: boolean;
  runner: Readonly<{ topSpeedMps: number; accelerationMps2: number; reactionSeconds: number; technicalSkills?: TechnicalSkillControlsV75 }>;
  forced: boolean;
  outs?: 0 | 1 | 2;
  awardThroughBase?: 1 | 2 | 3 | 4 | null;
  firstGroundContactElapsedSeconds: number | null;
  firstFielderTouchElapsedSeconds: number | null;
  /** Earliest estimated physical control/tag of the next base, relative to now.
   * The caller includes pickup, transfer, throw, receiver and tag preparation.
   * Null means unknown; Infinity means a known unreachable defense. */
  defenderControlSeconds: number | null;
  /** Perceived pre-ground interception margin from an already observed ball.
   * Positive favours a catch; negative favours a hit. This is not a result. */
  airborneAssessment?: Readonly<{ observedAtSeconds: number; catchMarginSeconds: number;
    /** Observed flat and hard launch. Only read when `tacticsV1` is passed. */
    lineDrive?: boolean }>;
  /** Opt-in runner tactics. Omitted keeps the legacy decision. `contactLeg` is true while the runner has not yet
   * left his origin base; with two outs that leg is a go-on-contact for the whole play, not only before first contact. */
  tacticsV1?: Readonly<{ contactLeg: boolean }>;
  policy?: Readonly<{ safetyMarginSeconds?: number; recognitionSeconds?: number }>;
}>;

export type LiveRunnerAdvanceReasonV1 = 'target_occupied' | 'awaiting_legal_departure'
  | 'recognizing_departure_cue' | 'batter_advance' | 'award_advance' | 'forced_advance' | 'two_out_advance'
  | 'no_defense_forecast' | 'insufficient_safety_margin' | 'safe_race_advance'
  | 'airborne_catch_risk_hold' | 'airborne_hit_read_advance' | 'line_drive_freeze_hold' | 'halfway_wait';

export type LiveRunnerAdvanceDecisionV1 = Readonly<{
  advance: boolean;
  reason: LiveRunnerAdvanceReasonV1;
  readyAtElapsedSeconds: number | null;
  runnerTravelSeconds: number;
  /** Includes remaining recognition delay when a departure cue is known. */
  runnerArrivalSeconds: number | null;
  raceMarginSeconds: number | null;
}>;

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('live runner advance: ' + message);
}
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;

/** Matches the actual rest-to-rest line leg: accelerate, coast, then brake.
 * This estimate is tactical evidence and cannot establish a physical touch. */
export function estimateLiveRunnerLegSecondsV1(distanceMeters: number, topSpeedMps: number, accelerationMps2: number, touchRadiusMeters = 0): number {
  assert(nonnegative(distanceMeters) && Number.isFinite(topSpeedMps) && topSpeedMps > 0
    && Number.isFinite(accelerationMps2) && accelerationMps2 > 0 && nonnegative(touchRadiusMeters), 'finite runner route SI required');
  if (distanceMeters <= touchRadiusMeters) return 0;
  const profile = createLiveLocomotionProfileV84({ topSpeedMps, accelerationMps2 }),
    plan = buildLiveSpeedPlanV84({ profile, distanceMeters, initialSpeedMps: 0, finalSpeedMps: 0 });
  assert(plan && Number.isFinite(plan.durationSeconds), 'runner duration exceeds finite SI');
  if (touchRadiusMeters === 0) return plan.durationSeconds;
  const travel = distanceMeters - touchRadiusMeters,
    segment = plan.segments.find(s => travel <= s.endDistanceMeters) ?? plan.segments[plan.segments.length - 1],
    local = Math.max(0, travel - segment.startDistanceMeters),
    speed = Math.sqrt(Math.max(0, segment.startSpeedMps ** 2 + 2 * segment.accelerationMps2 * local));
  return segment.startElapsedSeconds + (local === 0 ? 0 : 2 * local / (segment.startSpeedMps + speed));
}

/** Pure single-runner policy. The host supplies observed physical facts and a
 * defense forecast, never a future result. A first fielder touch permits a
 * legal tag-up departure before catch security; it does not retire the batter.
 * A force bypasses elective risk only after recognized ground contact: a
 * pending fly catch must not inherit the still-live batter's force obligation.
 * Awards, legality, reaction and occupancy remain separate from adjudication. */
export function decideLiveRunnerAdvanceV1(input: LiveRunnerAdvanceInputV1): LiveRunnerAdvanceDecisionV1 {
  if (input.runner.technicalSkills !== undefined) validateTechnicalSkillControlsV75(input.runner.technicalSkills);
  const safetyMargin = input.policy?.safetyMarginSeconds ?? LIVE_RUNNER_ADVANCE_POLICY_V1.safetyMarginSeconds,
    recognition = input.policy?.recognitionSeconds ?? LIVE_RUNNER_ADVANCE_POLICY_V1.recognitionSeconds,
    reaction = input.runner.reactionSeconds;
  assert(nonnegative(input.nowSeconds) && nonnegative(input.playStartedAtSeconds)
    && input.playStartedAtSeconds <= input.nowSeconds, 'finite ordered play clock required');
  assert([0, 1, 2, 3].includes(input.currentBase) && typeof input.targetOccupied === 'boolean'
    && typeof input.forced === 'boolean', 'explicit runner base and obligation required');
  assert(input.outs === undefined || [0, 1, 2].includes(input.outs), 'invalid active out count');
  assert(nonnegative(reaction) && nonnegative(safetyMargin) && nonnegative(recognition), 'finite reaction and policy SI required');
  assert(input.awardThroughBase === undefined || input.awardThroughBase === null
    || [1, 2, 3, 4].includes(input.awardThroughBase), 'invalid physical award target');
  const cues = [input.firstGroundContactElapsedSeconds, input.firstFielderTouchElapsedSeconds];
  assert(cues.every(cue => cue === null || nonnegative(cue) && cue >= input.playStartedAtSeconds && cue <= input.nowSeconds),
    'departure cue must be an occurred physical event');
  assert(input.defenderControlSeconds === null || nonnegative(input.defenderControlSeconds) || input.defenderControlSeconds === Infinity,
    'invalid defense control forecast');
  assert(input.airborneAssessment === undefined || nonnegative(input.airborneAssessment.observedAtSeconds)
    && input.airborneAssessment.observedAtSeconds >= input.playStartedAtSeconds && input.airborneAssessment.observedAtSeconds <= input.nowSeconds
    && Number.isFinite(input.airborneAssessment.catchMarginSeconds), 'airborne assessment must come from occurred observation');
  const runnerTravelSeconds = estimateLiveRunnerLegSecondsV1(input.distanceToNextBaseMeters,
    input.runner.topSpeedMps, input.runner.accelerationMps2, input.baseTouchRadiusMeters ?? 0),
    award = input.awardThroughBase !== undefined && input.awardThroughBase !== null && input.awardThroughBase > input.currentBase,
    batter = input.currentBase === 0,
    twoOuts = input.outs === 2 && (input.tacticsV1 !== undefined ? input.tacticsV1.contactLeg
      : input.firstGroundContactElapsedSeconds === null && input.firstFielderTouchElapsedSeconds === null),
    groundedForce = input.forced && input.firstGroundContactElapsedSeconds !== null,
    available = cues.filter((cue): cue is number => cue !== null),
    airborne = available.length === 0 && input.airborneAssessment !== undefined,
    legalCue = batter || award || twoOuts ? input.playStartedAtSeconds : groundedForce ? input.firstGroundContactElapsedSeconds
      : available.length ? Math.min(...available) : airborne ? input.playStartedAtSeconds : null,
    startSkill = batter ? input.runner.technicalSkills?.bat_to_run_transition ?? 0 : 0,
    departureReaction = startSkill > 0 ? reaction * (1 - .15 * startSkill) : reaction,
    readyAtElapsedSeconds = legalCue === null ? null : legalCue + (departureReaction + recognition);
  assert(readyAtElapsedSeconds === null || Number.isFinite(readyAtElapsedSeconds), 'recognition exceeds finite play clock');
  const runnerArrivalSeconds = readyAtElapsedSeconds === null ? null
    : Math.max(0, readyAtElapsedSeconds - input.nowSeconds) + runnerTravelSeconds,
    raceMarginSeconds = input.defenderControlSeconds === null || runnerArrivalSeconds === null
      ? null : input.defenderControlSeconds - runnerArrivalSeconds;
  const result = (advance: boolean, reason: LiveRunnerAdvanceReasonV1): LiveRunnerAdvanceDecisionV1 => Object.freeze({
    advance, reason, readyAtElapsedSeconds, runnerTravelSeconds, runnerArrivalSeconds, raceMarginSeconds,
  });
  if (input.targetOccupied) return result(false, 'target_occupied');
  if (readyAtElapsedSeconds === null) return result(false, 'awaiting_legal_departure');
  if (input.nowSeconds < readyAtElapsedSeconds) return result(false, 'recognizing_departure_cue');
  if (award) return result(true, 'award_advance');
  if (batter) return result(true, 'batter_advance');
  if (twoOuts) return result(true, 'two_out_advance');
  if (groundedForce) return result(true, 'forced_advance');
  if (airborne && input.tacticsV1 !== undefined && input.airborneAssessment!.lineDrive) {
    const T = LIVE_RUNNER_TACTICS_POLICY_V1;
    if (input.nowSeconds < input.airborneAssessment!.observedAtSeconds + T.lineDriveReadSeconds
      || input.airborneAssessment!.catchMarginSeconds >= -safetyMargin * T.lineDriveMarginScale) return result(false, 'line_drive_freeze_hold');
  }
  if (airborne && input.airborneAssessment!.catchMarginSeconds >= -safetyMargin) return result(false, 'airborne_catch_risk_hold');
  if (raceMarginSeconds === null) return result(false, 'no_defense_forecast');
  return raceMarginSeconds > safetyMargin ? result(true, airborne ? 'airborne_hit_read_advance' : 'safe_race_advance') : result(false, 'insufficient_safety_margin');
}

export type LiveRunnerHalfwayInputV1 = Readonly<{
  outs: 0 | 1 | 2; currentBase: 0 | 1 | 2 | 3; atOrigin: boolean; hasGroundOrFielderCue: boolean; safetyMarginSeconds: number;
  /** Observed ball read only: no result. Landing depth is the predicted ground point from home plate. */
  airborne?: Readonly<{ catchMarginSeconds: number; lineDrive?: boolean; landingDepthMeters?: number; hangSeconds?: number }>;
}>;

/** Under two outs, a non-tag runner on a catchable shallow fly goes partway and waits: retreat on a catch,
 * go on a drop. Deep flies stay a tag-up; liners freeze; a sure catch holds the bag. Pure, no random draws. */
export function decideLiveRunnerHalfwayV1(input: LiveRunnerHalfwayInputV1): Readonly<{ halfway: boolean; fraction: number }> {
  const T = LIVE_RUNNER_TACTICS_POLICY_V1, a = input.airborne, none = Object.freeze({ halfway: false, fraction: 0 });
  if (input.outs >= 2 || input.currentBase < 1 || input.currentBase > 2 || !input.atOrigin || input.hasGroundOrFielderCue || !a || a.lineDrive
    || a.landingDepthMeters === undefined || !Number.isFinite(a.landingDepthMeters) || a.landingDepthMeters >= T.halfwayMaxLandingDepthMeters
    || a.hangSeconds === undefined || !Number.isFinite(a.hangSeconds)
    || a.catchMarginSeconds < -input.safetyMarginSeconds || a.catchMarginSeconds > T.halfwayMaxCatchMarginSeconds) return none;
  return a.hangSeconds >= T.halfwayLongHangSeconds ? Object.freeze({ halfway: true, fraction: T.halfwayLongFraction })
    : a.hangSeconds >= T.halfwayShortHangSeconds ? Object.freeze({ halfway: true, fraction: T.halfwayShortFraction }) : none;
}
