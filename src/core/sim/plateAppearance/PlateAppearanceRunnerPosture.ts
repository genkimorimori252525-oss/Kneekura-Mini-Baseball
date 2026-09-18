import type {
  RunnerAdvanceRiskPolicy,
} from '../running/RunnerRiskPolicy';
import type {
  PlateAppearanceCommand,
} from './PlateAppearanceCommand';

export type PlateAppearanceRunnerPostureCalibration = Readonly<{
  conservativeAdjustmentTicks: number;
  aggressiveAdjustmentTicks: number;
  minimumAdvanceSafetyMarginTicks: number;
  maximumAdvanceSafetyMarginTicks: number;
}>;

const validateTick = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const validateAdjustment = (
  name: string,
  value: number,
): void => {
  if (!Number.isSafeInteger(value)) {
    throw new Error(
      `${name} must be a safe integer tick adjustment`,
    );
  }
};

export const applyPlateAppearanceRunnerPosture = (
  policy: RunnerAdvanceRiskPolicy,
  command: PlateAppearanceCommand,
  calibration: PlateAppearanceRunnerPostureCalibration,
): RunnerAdvanceRiskPolicy => {
  validateAdjustment(
    'conservativeAdjustmentTicks',
    calibration.conservativeAdjustmentTicks,
  );
  validateAdjustment(
    'aggressiveAdjustmentTicks',
    calibration.aggressiveAdjustmentTicks,
  );
  validateTick(
    'minimumAdvanceSafetyMarginTicks',
    calibration.minimumAdvanceSafetyMarginTicks,
  );
  validateTick(
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

  const adjustment = (
    command.runners.posture === 'conservative'
      ? calibration.conservativeAdjustmentTicks
      : command.runners.posture === 'aggressive'
        ? calibration.aggressiveAdjustmentTicks
        : 0
  );

  return {
    ...policy,
    minimumAdvanceSafetyMarginTicks: Math.max(
      calibration.minimumAdvanceSafetyMarginTicks,
      Math.min(
        calibration.maximumAdvanceSafetyMarginTicks,
        policy.minimumAdvanceSafetyMarginTicks
          + adjustment,
      ),
    ),
  };
};
