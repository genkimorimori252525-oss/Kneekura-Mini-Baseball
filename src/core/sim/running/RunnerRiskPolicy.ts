import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';

export type RunnerRiskPolicyCalibration = Readonly<{
  baseAdvanceSafetyMarginTicks: number;
  twoOutAdjustmentTicks: number;
  lateTrailingAdjustmentTicks: number;
  lateLeadingAdjustmentTicks: number;
  minimumAdvanceSafetyMarginTicks: number;
  maximumAdvanceSafetyMarginTicks: number;
}>;

export type RunnerRiskPolicyInput = Readonly<{
  regulationInnings: number;
  calibration: RunnerRiskPolicyCalibration;
}>;

export type RunnerAdvanceRiskPolicy = Readonly<{
  battingTeam: 'home' | 'away';
  battingRuns: number;
  defendingRuns: number;
  runDifferentialForOffense: number;
  lateInning: boolean;
  minimumAdvanceSafetyMarginTicks: number;
}>;

const validateNonNegativeTick = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const validateSignedTick = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${name} must be a safe integer tick adjustment`,
    );
  }
};

export const deriveRunnerAdvanceRiskPolicy = (
  match: CanonicalMatchState,
  input: RunnerRiskPolicyInput,
): RunnerAdvanceRiskPolicy => {
  if (
    !Number.isSafeInteger(input.regulationInnings)
    || input.regulationInnings <= 0
  ) {
    throw new Error(
      'regulationInnings must be a positive safe integer',
    );
  }
  if (
    !Number.isSafeInteger(match.outs)
    || match.outs < 0
  ) {
    throw new Error(
      'match outs must be a non-negative safe integer',
    );
  }

  const calibration = input.calibration;
  validateNonNegativeTick(
    'baseAdvanceSafetyMarginTicks',
    calibration.baseAdvanceSafetyMarginTicks,
  );
  validateSignedTick(
    'twoOutAdjustmentTicks',
    calibration.twoOutAdjustmentTicks,
  );
  validateSignedTick(
    'lateTrailingAdjustmentTicks',
    calibration.lateTrailingAdjustmentTicks,
  );
  validateSignedTick(
    'lateLeadingAdjustmentTicks',
    calibration.lateLeadingAdjustmentTicks,
  );
  validateNonNegativeTick(
    'minimumAdvanceSafetyMarginTicks',
    calibration.minimumAdvanceSafetyMarginTicks,
  );
  validateNonNegativeTick(
    'maximumAdvanceSafetyMarginTicks',
    calibration.maximumAdvanceSafetyMarginTicks,
  );
  if (
    calibration.maximumAdvanceSafetyMarginTicks
    < calibration.minimumAdvanceSafetyMarginTicks
  ) {
    throw new Error(
      'maximumAdvanceSafetyMarginTicks must be >= minimumAdvanceSafetyMarginTicks',
    );
  }

  const battingTeam: 'home' | 'away' = (
    match.half === 'top'
      ? 'away'
      : 'home'
  );
  const battingRuns = (
    battingTeam === 'away'
      ? match.score.away
      : match.score.home
  );
  const defendingRuns = (
    battingTeam === 'away'
      ? match.score.home
      : match.score.away
  );
  const runDifferentialForOffense = (
    battingRuns - defendingRuns
  );
  const lateInning = (
    match.inning >= input.regulationInnings
  );

  let margin =
    calibration.baseAdvanceSafetyMarginTicks;

  if (match.outs === 2) {
    margin += calibration.twoOutAdjustmentTicks;
  }

  if (lateInning && runDifferentialForOffense < 0) {
    margin += calibration.lateTrailingAdjustmentTicks;
  } else if (
    lateInning
    && runDifferentialForOffense > 0
  ) {
    margin += calibration.lateLeadingAdjustmentTicks;
  }

  const minimumAdvanceSafetyMarginTicks = Math.max(
    calibration.minimumAdvanceSafetyMarginTicks,
    Math.min(
      calibration.maximumAdvanceSafetyMarginTicks,
      margin,
    ),
  );

  return {
    battingTeam,
    battingRuns,
    defendingRuns,
    runDifferentialForOffense,
    lateInning,
    minimumAdvanceSafetyMarginTicks,
  };
};

/** Authored live-path risk shape, UNMEASURED: no real-game calibration. Ticks are 1e-6 s here so the
 * existing tick policy is reused unchanged; the runner's own margin is the base. */
export const LIVE_RUNNER_RISK_V1 = Object.freeze({
  ticksPerSecond: 1_000_000, twoOutAdjustmentTicks: -50_000, lateTrailingAdjustmentTicks: -100_000,
  lateLeadingAdjustmentTicks: 100_000, thirdBaseOutPenaltyTicks: 150_000, minimumMarginTicks: 50_000, maximumMarginTicks: 1_000_000,
});

/** Only facts a runner knows: outs, inning, score and the base he is thinking of taking. */
export type LiveRunnerRiskFactsV1 = Readonly<{
  baseMarginSeconds: number; outs: 0 | 1 | 2; inning: number; regulationInnings: number;
  battingRuns: number; defendingRuns: number; targetBase: 1 | 2 | 3 | 4; forced: boolean;
}>;

/** Elective advance margin in seconds. More aggressive with two outs and when trailing late, more careful when
 * leading late, and never the first or third out of an inning at third base unless forced. */
export const deriveLiveRunnerSafetyMarginSecondsV1 = (facts: LiveRunnerRiskFactsV1): number => {
  const L = LIVE_RUNNER_RISK_V1, baseTicks = Math.round(facts.baseMarginSeconds * L.ticksPerSecond);
  const policy = deriveRunnerAdvanceRiskPolicy({
    ruleProfileId: 'live-runner-risk-v1' as CanonicalMatchState['ruleProfileId'], inning: facts.inning, half: 'top', outs: facts.outs, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: facts.battingRuns, home: facts.defendingRuns }, playId: 0,
  }, { regulationInnings: facts.regulationInnings, calibration: {
    baseAdvanceSafetyMarginTicks: baseTicks, twoOutAdjustmentTicks: L.twoOutAdjustmentTicks,
    lateTrailingAdjustmentTicks: L.lateTrailingAdjustmentTicks, lateLeadingAdjustmentTicks: L.lateLeadingAdjustmentTicks,
    minimumAdvanceSafetyMarginTicks: Math.min(baseTicks, L.minimumMarginTicks), maximumAdvanceSafetyMarginTicks: Math.max(baseTicks, L.maximumMarginTicks) } });
  const penalty = facts.targetBase === 3 && !facts.forced && facts.outs !== 1 ? L.thirdBaseOutPenaltyTicks : 0;
  return (policy.minimumAdvanceSafetyMarginTicks + penalty) / L.ticksPerSecond;
};
