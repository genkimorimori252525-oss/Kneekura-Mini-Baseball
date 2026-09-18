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

  const battingTeam = (
    match.half === 'top'
      ? 'away'
      : 'home'
  ) as const;
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
