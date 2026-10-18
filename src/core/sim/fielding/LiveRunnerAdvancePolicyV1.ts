/** Shared controller settings, not player abilities or empirical calibration.
 * Existing runner reaction is added to each new legal departure cue. */
export const LIVE_RUNNER_ADVANCE_POLICY_V1 = Object.freeze({
  safetyMarginSeconds: .35,
  recognitionSeconds: 0,
});

export type LiveRunnerAdvanceInputV1 = Readonly<{
  nowSeconds: number;
  playStartedAtSeconds: number;
  currentBase: 0 | 1 | 2 | 3;
  distanceToNextBaseMeters: number;
  /** Actual contact geometry. Omitted keeps the legacy center-stop estimate. */
  baseTouchRadiusMeters?: number;
  targetOccupied: boolean;
  runner: Readonly<{ topSpeedMps: number; accelerationMps2: number; reactionSeconds: number }>;
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
  airborneAssessment?: Readonly<{ observedAtSeconds: number; catchMarginSeconds: number }>;
  policy?: Readonly<{ safetyMarginSeconds?: number; recognitionSeconds?: number }>;
}>;

export type LiveRunnerAdvanceReasonV1 = 'target_occupied' | 'awaiting_legal_departure'
  | 'recognizing_departure_cue' | 'batter_advance' | 'award_advance' | 'forced_advance' | 'two_out_advance'
  | 'no_defense_forecast' | 'insufficient_safety_margin' | 'safe_race_advance'
  | 'airborne_catch_risk_hold' | 'airborne_hit_read_advance';

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
  const peak = Math.min(topSpeedMps, Math.sqrt(accelerationMps2 * distanceMeters)),
    accelerateFor = peak / accelerationMps2,
    coastFor = Math.max(0, (distanceMeters - peak * peak / accelerationMps2) / peak),
    duration = 2 * accelerateFor + coastFor;
  assert(Number.isFinite(duration), 'runner duration exceeds finite SI');
  if (touchRadiusMeters === 0) return duration;
  const travel = distanceMeters - touchRadiusMeters, acceleratingDistance = peak * peak / (2 * accelerationMps2),
    coastingDistance = peak * coastFor;
  return travel <= acceleratingDistance ? Math.sqrt(2 * travel / accelerationMps2)
    : travel <= acceleratingDistance + coastingDistance ? accelerateFor + (travel - acceleratingDistance) / peak
      : duration - Math.sqrt(2 * touchRadiusMeters / accelerationMps2);
}

/** Pure single-runner policy. The host supplies observed physical facts and a
 * defense forecast, never a future result. A first fielder touch permits a
 * legal tag-up departure before catch security; it does not retire the batter.
 * A force bypasses elective risk only after recognized ground contact: a
 * pending fly catch must not inherit the still-live batter's force obligation.
 * Awards, legality, reaction and occupancy remain separate from adjudication. */
export function decideLiveRunnerAdvanceV1(input: LiveRunnerAdvanceInputV1): LiveRunnerAdvanceDecisionV1 {
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
    twoOuts = input.outs === 2 && input.firstGroundContactElapsedSeconds === null && input.firstFielderTouchElapsedSeconds === null,
    groundedForce = input.forced && input.firstGroundContactElapsedSeconds !== null,
    available = cues.filter((cue): cue is number => cue !== null),
    airborne = available.length === 0 && input.airborneAssessment !== undefined,
    legalCue = batter || award || twoOuts ? input.playStartedAtSeconds : groundedForce ? input.firstGroundContactElapsedSeconds
      : available.length ? Math.min(...available) : airborne ? input.playStartedAtSeconds : null,
    readyAtElapsedSeconds = legalCue === null ? null : legalCue + (reaction + recognition);
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
  if (airborne && input.airborneAssessment!.catchMarginSeconds >= -safetyMargin) return result(false, 'airborne_catch_risk_hold');
  if (raceMarginSeconds === null) return result(false, 'no_defense_forecast');
  return raceMarginSeconds > safetyMargin ? result(true, airborne ? 'airborne_hit_read_advance' : 'safe_race_advance') : result(false, 'insufficient_safety_margin');
}
