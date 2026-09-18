import type { Vec3 } from '../../model/geometry';
import type { DeterministicRng } from '../../rng/DeterministicRng';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';

/** Calibration is supplied by the caller; Core does not hard-code player error widths. */
export type CatchExecutionErrorCalibration = Readonly<{
  minimumTargetErrorMeters: number;
  maximumTargetErrorMeters: number;
}>;

export type CatchBodyStabilityCalibration = Readonly<{
  lowestAbilityFullReachStability: number;
  highestAbilityFullReachStability: number;
}>;

export type CatchReachEffort = Readonly<{
  reachDistanceMeters: number;
  maximumReachMeters: number;
}>;

export type CatchExecutionTargetAssessment =
  PerceivedGloveTargetAssessment & Readonly<{
    errorScaleMeters: number;
    executionError: Vec3;
    aimedGlovePosition: Vec3;
  }>;

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validateCalibration = (
  calibration: CatchExecutionErrorCalibration,
): void => {
  if (
    !Number.isFinite(calibration.minimumTargetErrorMeters)
    || calibration.minimumTargetErrorMeters < 0
  ) {
    throw new Error(
      'minimumTargetErrorMeters must be finite and non-negative',
    );
  }
  if (
    !Number.isFinite(calibration.maximumTargetErrorMeters)
    || calibration.maximumTargetErrorMeters
      < calibration.minimumTargetErrorMeters
  ) {
    throw new Error(
      'maximumTargetErrorMeters must be finite and at least minimumTargetErrorMeters',
    );
  }
};

const sampleSymmetricTriangular = (
  rng: DeterministicRng,
  scale: number,
): number => (rng.nextFloat() - rng.nextFloat()) * scale;

const add = (first: Vec3, second: Vec3): Vec3 => ({
  x: first.x + second.x,
  y: first.y + second.y,
  z: first.z + second.z,
});

export const applyCatchExecutionTargetError = (
  target: PerceivedGloveTargetAssessment,
  catchingAbility: number,
  rng: DeterministicRng,
  calibration: CatchExecutionErrorCalibration,
): CatchExecutionTargetAssessment => {
  validateUnit('catchingAbility', catchingAbility);
  validateCalibration(calibration);

  const errorScaleMeters = (
    calibration.maximumTargetErrorMeters
    + (
      calibration.minimumTargetErrorMeters
      - calibration.maximumTargetErrorMeters
    ) * catchingAbility
  );

  const executionError: Vec3 = {
    x: sampleSymmetricTriangular(rng, errorScaleMeters),
    y: sampleSymmetricTriangular(rng, errorScaleMeters),
    z: sampleSymmetricTriangular(rng, errorScaleMeters),
  };
  const desiredOffset = add(target.desiredOffset, executionError);
  const aimedGlovePosition = add(
    target.predictedBodyPosition,
    desiredOffset,
  );
  const reachDistanceMeters = Math.hypot(
    desiredOffset.x,
    desiredOffset.y,
    desiredOffset.z,
  );

  return {
    ...target,
    desiredOffset,
    reachDistanceMeters,
    withinReach: reachDistanceMeters <= target.maximumReachMeters,
    errorScaleMeters,
    executionError,
    aimedGlovePosition,
  };
};


export const evaluateCatchBodyStability = (
  reach: CatchReachEffort,
  bodyControlAbility: number,
  calibration: CatchBodyStabilityCalibration,
): number => {
  validateUnit('bodyControlAbility', bodyControlAbility);
  validateUnit(
    'lowestAbilityFullReachStability',
    calibration.lowestAbilityFullReachStability,
  );
  validateUnit(
    'highestAbilityFullReachStability',
    calibration.highestAbilityFullReachStability,
  );
  if (
    calibration.highestAbilityFullReachStability
    < calibration.lowestAbilityFullReachStability
  ) {
    throw new Error(
      'highestAbilityFullReachStability must be at least lowestAbilityFullReachStability',
    );
  }
  if (
    !Number.isFinite(reach.reachDistanceMeters)
    || reach.reachDistanceMeters < 0
  ) {
    throw new Error('reachDistanceMeters must be finite and non-negative');
  }
  if (
    !Number.isFinite(reach.maximumReachMeters)
    || reach.maximumReachMeters <= 0
  ) {
    throw new Error('maximumReachMeters must be finite and positive');
  }
  if (reach.reachDistanceMeters > reach.maximumReachMeters) {
    return 0;
  }

  const fullReachStability = (
    calibration.lowestAbilityFullReachStability
    + (
      calibration.highestAbilityFullReachStability
      - calibration.lowestAbilityFullReachStability
    ) * bodyControlAbility
  );
  const reachEffort = (
    reach.reachDistanceMeters / reach.maximumReachMeters
  );

  return 1 - (1 - fullReachStability) * reachEffort;
};
