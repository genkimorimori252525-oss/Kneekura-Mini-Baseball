import type { CatchRetentionParameters } from './CatchRetention';

export type CatchRetentionSkillCalibration = Readonly<{
  lowAbilityCenterRetentionCapacityMultiplier: number;
  highAbilityCenterRetentionCapacityMultiplier: number;
  lowAbilityCaptureDissipationPowerMultiplier: number;
  highAbilityCaptureDissipationPowerMultiplier: number;
}>;

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validatePositive = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be finite and positive`);
  }
};

const validateCalibration = (
  calibration: CatchRetentionSkillCalibration,
): void => {
  validatePositive(
    'lowAbilityCenterRetentionCapacityMultiplier',
    calibration.lowAbilityCenterRetentionCapacityMultiplier,
  );
  validatePositive(
    'highAbilityCenterRetentionCapacityMultiplier',
    calibration.highAbilityCenterRetentionCapacityMultiplier,
  );
  validatePositive(
    'lowAbilityCaptureDissipationPowerMultiplier',
    calibration.lowAbilityCaptureDissipationPowerMultiplier,
  );
  validatePositive(
    'highAbilityCaptureDissipationPowerMultiplier',
    calibration.highAbilityCaptureDissipationPowerMultiplier,
  );

  if (
    calibration.highAbilityCenterRetentionCapacityMultiplier
    < calibration.lowAbilityCenterRetentionCapacityMultiplier
  ) {
    throw new Error(
      'highAbilityCenterRetentionCapacityMultiplier must be at least lowAbilityCenterRetentionCapacityMultiplier',
    );
  }
  if (
    calibration.highAbilityCaptureDissipationPowerMultiplier
    < calibration.lowAbilityCaptureDissipationPowerMultiplier
  ) {
    throw new Error(
      'highAbilityCaptureDissipationPowerMultiplier must be at least lowAbilityCaptureDissipationPowerMultiplier',
    );
  }
};

const interpolate = (
  low: number,
  high: number,
  ability: number,
): number => low + (high - low) * ability;

export const deriveCatchRetentionParameters = (
  base: CatchRetentionParameters,
  catchingAbility: number,
  calibration: CatchRetentionSkillCalibration,
): CatchRetentionParameters => {
  validateUnit('catchingAbility', catchingAbility);
  validateCalibration(calibration);

  const capacityMultiplier = interpolate(
    calibration.lowAbilityCenterRetentionCapacityMultiplier,
    calibration.highAbilityCenterRetentionCapacityMultiplier,
    catchingAbility,
  );
  const dissipationMultiplier = interpolate(
    calibration.lowAbilityCaptureDissipationPowerMultiplier,
    calibration.highAbilityCaptureDissipationPowerMultiplier,
    catchingAbility,
  );

  return {
    ...base,
    centerRetentionCapacityJ:
      base.centerRetentionCapacityJ * capacityMultiplier,
    captureDissipationPowerW:
      base.captureDissipationPowerW * dissipationMultiplier,
  };
};
