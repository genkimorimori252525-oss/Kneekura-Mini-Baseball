import type { Vec3 } from '../../model/geometry';

export type ObserverViewState = Readonly<{
  position: Vec3;
  forward: Vec3;
  velocity: Vec3;
}>;

export type ObservationTargetTruth = Readonly<{
  position: Vec3;
  velocity: Vec3;
}>;

export type ObservationGeometryParameters = Readonly<{
  fullQualityHalfAngleRadians: number;
  maxVisibleHalfAngleRadians: number;
  fullQualityDistanceMeters: number;
  maxObservableDistanceMeters: number;
  fullQualityRelativeSpeedMps: number;
  maxRelativeSpeedMps: number;
}>;

export type ObservationGeometryResult = Readonly<{
  distanceMeters: number;
  offAxisAngleRadians: number;
  relativeSpeedMps: number;
  fovQuality: number;
  distanceQuality: number;
  relativeSpeedQuality: number;
}>;

const validateVec3 = (name: string, value: Vec3): void => {
  if (![value.x, value.y, value.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain only finite coordinates`);
  }
};

const length3 = (value: Vec3): number => Math.hypot(value.x, value.y, value.z);

const subtract3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const clampedLinearQuality = (
  value: number,
  fullQualityAtOrBelow: number,
  zeroQualityAtOrAbove: number,
): number => {
  if (value <= fullQualityAtOrBelow) return 1;
  if (value >= zeroQualityAtOrAbove) return 0;
  return (
    zeroQualityAtOrAbove - value
  ) / (
    zeroQualityAtOrAbove - fullQualityAtOrBelow
  );
};

const validateThresholdPair = (
  fullName: string,
  fullValue: number,
  maxName: string,
  maxValue: number,
): void => {
  if (!Number.isFinite(fullValue) || fullValue < 0) {
    throw new Error(`${fullName} must be finite and non-negative`);
  }
  if (!Number.isFinite(maxValue) || maxValue <= fullValue) {
    throw new Error(`${maxName} must be finite and greater than ${fullName}`);
  }
};

const validateParameters = (parameters: ObservationGeometryParameters): void => {
  validateThresholdPair(
    'fullQualityHalfAngleRadians',
    parameters.fullQualityHalfAngleRadians,
    'maxVisibleHalfAngleRadians',
    parameters.maxVisibleHalfAngleRadians,
  );
  if (parameters.maxVisibleHalfAngleRadians > Math.PI) {
    throw new Error('maxVisibleHalfAngleRadians must not exceed pi');
  }
  validateThresholdPair(
    'fullQualityDistanceMeters',
    parameters.fullQualityDistanceMeters,
    'maxObservableDistanceMeters',
    parameters.maxObservableDistanceMeters,
  );
  validateThresholdPair(
    'fullQualityRelativeSpeedMps',
    parameters.fullQualityRelativeSpeedMps,
    'maxRelativeSpeedMps',
    parameters.maxRelativeSpeedMps,
  );
};

export const evaluateObservationGeometry = (
  observer: ObserverViewState,
  target: ObservationTargetTruth,
  parameters: ObservationGeometryParameters,
): ObservationGeometryResult => {
  validateVec3('observer.position', observer.position);
  validateVec3('observer.forward', observer.forward);
  validateVec3('observer.velocity', observer.velocity);
  validateVec3('target.position', target.position);
  validateVec3('target.velocity', target.velocity);
  validateParameters(parameters);

  const forwardLength = length3(observer.forward);
  if (forwardLength === 0) {
    throw new Error('observer forward vector must be non-zero');
  }

  const toTarget = subtract3(target.position, observer.position);
  const distanceMeters = length3(toTarget);
  let offAxisAngleRadians = 0;

  if (distanceMeters > 0) {
    const cosine = Math.max(-1, Math.min(1, (
      observer.forward.x * toTarget.x
      + observer.forward.y * toTarget.y
      + observer.forward.z * toTarget.z
    ) / (forwardLength * distanceMeters)));
    offAxisAngleRadians = Math.acos(cosine);
  }

  const relativeVelocity = subtract3(target.velocity, observer.velocity);
  const relativeSpeedMps = length3(relativeVelocity);

  return {
    distanceMeters,
    offAxisAngleRadians,
    relativeSpeedMps,
    fovQuality: clampedLinearQuality(
      offAxisAngleRadians,
      parameters.fullQualityHalfAngleRadians,
      parameters.maxVisibleHalfAngleRadians,
    ),
    distanceQuality: clampedLinearQuality(
      distanceMeters,
      parameters.fullQualityDistanceMeters,
      parameters.maxObservableDistanceMeters,
    ),
    relativeSpeedQuality: clampedLinearQuality(
      relativeSpeedMps,
      parameters.fullQualityRelativeSpeedMps,
      parameters.maxRelativeSpeedMps,
    ),
  };
};
