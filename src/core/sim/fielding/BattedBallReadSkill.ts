import type {
  Vec3,
} from '../../model/geometry';
import type {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import type {
  RememberedPrediction,
  SpatialMotionEstimate,
} from '../perception/ObservationMemory';

export type BattedBallReadCalibration = Readonly<{
  minimumPositionErrorMeters: number;
  maximumPositionErrorMeters: number;
  minimumVelocityErrorMps: number;
  maximumVelocityErrorMps: number;
}>;

export type BattedBallReadPredictionAssessment = Readonly<{
  prediction: RememberedPrediction<SpatialMotionEstimate>;
  positionErrorScaleMeters: number;
  velocityErrorScaleMps: number;
  positionError: Vec3;
  velocityError: Vec3;
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

const validateRange = (
  minimumName: string,
  minimum: number,
  maximumName: string,
  maximum: number,
): void => {
  validateNonNegative(minimumName, minimum);
  validateNonNegative(maximumName, maximum);
  if (maximum < minimum) {
    throw new Error(
      `${maximumName} must be at least ${minimumName}`,
    );
  }
};

const sampleSymmetricTriangular = (
  rng: DeterministicRng,
  scale: number,
): number => (
  (rng.nextFloat() - rng.nextFloat()) * scale
);

const sampleErrorVec3 = (
  rng: DeterministicRng,
  scale: number,
): Vec3 => ({
  x: sampleSymmetricTriangular(rng, scale),
  y: sampleSymmetricTriangular(rng, scale),
  z: sampleSymmetricTriangular(rng, scale),
});

export const applyBattedBallReadPredictionError = (
  perceivedBall:
    RememberedPrediction<SpatialMotionEstimate>,
  battedBallRead: number,
  rng: DeterministicRng,
  calibration: BattedBallReadCalibration,
): BattedBallReadPredictionAssessment => {
  validateUnit('battedBallRead', battedBallRead);
  validateRange(
    'minimumPositionErrorMeters',
    calibration.minimumPositionErrorMeters,
    'maximumPositionErrorMeters',
    calibration.maximumPositionErrorMeters,
  );
  validateRange(
    'minimumVelocityErrorMps',
    calibration.minimumVelocityErrorMps,
    'maximumVelocityErrorMps',
    calibration.maximumVelocityErrorMps,
  );

  const positionErrorScaleMeters = (
    calibration.maximumPositionErrorMeters
    + (
      calibration.minimumPositionErrorMeters
      - calibration.maximumPositionErrorMeters
    ) * battedBallRead
  );
  const velocityErrorScaleMps = (
    calibration.maximumVelocityErrorMps
    + (
      calibration.minimumVelocityErrorMps
      - calibration.maximumVelocityErrorMps
    ) * battedBallRead
  );

  const positionError = sampleErrorVec3(
    rng,
    positionErrorScaleMeters,
  );
  const velocityError = sampleErrorVec3(
    rng,
    velocityErrorScaleMps,
  );

  return {
    prediction: {
      estimate: {
        position: {
          x: perceivedBall.estimate.position.x
            + positionError.x,
          y: perceivedBall.estimate.position.y
            + positionError.y,
          z: perceivedBall.estimate.position.z
            + positionError.z,
        },
        velocity: {
          x: perceivedBall.estimate.velocity.x
            + velocityError.x,
          y: perceivedBall.estimate.velocity.y
            + velocityError.y,
          z: perceivedBall.estimate.velocity.z
            + velocityError.z,
        },
      },
      sourceObservedAt:
        perceivedBall.sourceObservedAt,
      predictedAt: perceivedBall.predictedAt,
      confidence: perceivedBall.confidence,
    },
    positionErrorScaleMeters,
    velocityErrorScaleMps,
    positionError,
    velocityError,
  };
};
