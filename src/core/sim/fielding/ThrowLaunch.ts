import type {
  Vec3,
} from '../../model/geometry';
import type {
  DeterministicRng,
} from '../../rng/DeterministicRng';

export type ThrowLaunchCalibration = Readonly<{
  minimumReleaseSpeedMps: number;
  maximumReleaseSpeedMps: number;
  minimumTargetErrorMeters: number;
  maximumTargetErrorMeters: number;
}>;

export type ThrowLaunch = Readonly<{
  releaseTick: number;
  origin: Vec3;
  intendedTarget: Vec3;
  aimedTarget: Vec3;
  targetError: Vec3;
  targetErrorScaleMeters: number;
  releaseSpeedMps: number;
  initialVelocity: Vec3;
}>;

export type RatedThrowLaunchInput = Readonly<{
  releaseTick: number;
  origin: Vec3;
  intendedTarget: Vec3;
  armStrength: number;
  throwingAccuracy: number;
  rng: DeterministicRng;
  calibration: ThrowLaunchCalibration;
}>;

const validateUnit = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      `${name} must be finite and within [0, 1]`,
    );
  }
};

const validateNonNegative = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be finite and non-negative`,
    );
  }
};

const validatePositive = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${name} must be finite and positive`,
    );
  }
};

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(
      `${name} must contain finite coordinates`,
    );
  }
};

const sampleSymmetricTriangular = (
  rng: DeterministicRng,
  scale: number,
): number => (
  (rng.nextFloat() - rng.nextFloat()) * scale
);

export const createRatedThrowLaunch = (
  input: RatedThrowLaunchInput,
): ThrowLaunch => {
  if (
    !Number.isSafeInteger(input.releaseTick)
    || input.releaseTick < 0
  ) {
    throw new Error(
      'releaseTick must be a non-negative safe integer tick',
    );
  }
  validateVec3('origin', input.origin);
  validateVec3(
    'intendedTarget',
    input.intendedTarget,
  );
  validateUnit('armStrength', input.armStrength);
  validateUnit(
    'throwingAccuracy',
    input.throwingAccuracy,
  );

  validatePositive(
    'minimumReleaseSpeedMps',
    input.calibration.minimumReleaseSpeedMps,
  );
  validatePositive(
    'maximumReleaseSpeedMps',
    input.calibration.maximumReleaseSpeedMps,
  );
  if (
    input.calibration.maximumReleaseSpeedMps
    < input.calibration.minimumReleaseSpeedMps
  ) {
    throw new Error(
      'maximumReleaseSpeedMps must be at least minimumReleaseSpeedMps',
    );
  }

  validateNonNegative(
    'minimumTargetErrorMeters',
    input.calibration.minimumTargetErrorMeters,
  );
  validateNonNegative(
    'maximumTargetErrorMeters',
    input.calibration.maximumTargetErrorMeters,
  );
  if (
    input.calibration.maximumTargetErrorMeters
    < input.calibration.minimumTargetErrorMeters
  ) {
    throw new Error(
      'maximumTargetErrorMeters must be at least minimumTargetErrorMeters',
    );
  }

  const intendedDelta: Vec3 = {
    x: input.intendedTarget.x - input.origin.x,
    y: input.intendedTarget.y - input.origin.y,
    z: input.intendedTarget.z - input.origin.z,
  };
  const intendedDistance = Math.hypot(
    intendedDelta.x,
    intendedDelta.y,
    intendedDelta.z,
  );
  if (intendedDistance <= 1e-12) {
    throw new Error(
      'intendedTarget must be distinct from origin',
    );
  }

  const releaseSpeedMps = (
    input.calibration.minimumReleaseSpeedMps
    + (
      input.calibration.maximumReleaseSpeedMps
      - input.calibration.minimumReleaseSpeedMps
    ) * input.armStrength
  );
  const targetErrorScaleMeters = (
    input.calibration.maximumTargetErrorMeters
    + (
      input.calibration.minimumTargetErrorMeters
      - input.calibration.maximumTargetErrorMeters
    ) * input.throwingAccuracy
  );
  const targetError: Vec3 = {
    x: sampleSymmetricTriangular(
      input.rng,
      targetErrorScaleMeters,
    ),
    y: sampleSymmetricTriangular(
      input.rng,
      targetErrorScaleMeters,
    ),
    z: sampleSymmetricTriangular(
      input.rng,
      targetErrorScaleMeters,
    ),
  };
  const aimedTarget: Vec3 = {
    x: input.intendedTarget.x + targetError.x,
    y: input.intendedTarget.y + targetError.y,
    z: input.intendedTarget.z + targetError.z,
  };
  const aimedDelta: Vec3 = {
    x: aimedTarget.x - input.origin.x,
    y: aimedTarget.y - input.origin.y,
    z: aimedTarget.z - input.origin.z,
  };
  const aimedDistance = Math.hypot(
    aimedDelta.x,
    aimedDelta.y,
    aimedDelta.z,
  );
  if (aimedDistance <= 1e-12) {
    throw new Error(
      'sampled aimedTarget must be distinct from origin',
    );
  }

  const speedScale = releaseSpeedMps / aimedDistance;
  const initialVelocity: Vec3 = {
    x: aimedDelta.x * speedScale,
    y: aimedDelta.y * speedScale,
    z: aimedDelta.z * speedScale,
  };

  return {
    releaseTick: input.releaseTick,
    origin: input.origin,
    intendedTarget: input.intendedTarget,
    aimedTarget,
    targetError,
    targetErrorScaleMeters,
    releaseSpeedMps,
    initialVelocity,
  };
};
