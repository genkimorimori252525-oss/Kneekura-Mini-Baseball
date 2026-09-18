import type { DeterministicRng } from '../../rng/DeterministicRng';
import { createObservationSample, type ObservationSample } from './Observation';
import type {
  PlanarMotionEstimate,
  SpatialMotionEstimate,
} from './ObservationMemory';

export type ObservationErrorParameters = Readonly<{
  minimumDetectionQuality: number;
  minimumPositionErrorMeters: number;
  maximumPositionErrorMeters: number;
  minimumVelocityErrorMps: number;
  maximumVelocityErrorMps: number;
}>;

const validateUnit = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be finite and within [0, 1]`);
  }
};

const validateErrorRange = (
  minimumName: string,
  minimum: number,
  maximumName: string,
  maximum: number,
): void => {
  if (!Number.isFinite(minimum) || minimum < 0) {
    throw new Error(`${minimumName} must be finite and non-negative`);
  }
  if (!Number.isFinite(maximum) || maximum < minimum) {
    throw new Error(`${maximumName} must be finite and at least ${minimumName}`);
  }
};

const validateParameters = (parameters: ObservationErrorParameters): void => {
  validateUnit('minimumDetectionQuality', parameters.minimumDetectionQuality);
  validateErrorRange(
    'minimumPositionErrorMeters',
    parameters.minimumPositionErrorMeters,
    'maximumPositionErrorMeters',
    parameters.maximumPositionErrorMeters,
  );
  validateErrorRange(
    'minimumVelocityErrorMps',
    parameters.minimumVelocityErrorMps,
    'maximumVelocityErrorMps',
    parameters.maximumVelocityErrorMps,
  );
};

const validateFiniteValues = (name: string, values: readonly number[]): void => {
  if (!values.every(Number.isFinite)) {
    throw new Error(`${name} must contain only finite values`);
  }
};

const errorScale = (
  minimum: number,
  maximum: number,
  quality: number,
): number => minimum + (maximum - minimum) * (1 - quality);

const sampleSymmetricTriangularError = (
  rng: DeterministicRng,
  scale: number,
): number => {
  const value = (rng.nextFloat() - rng.nextFloat()) * scale;
  return value === 0 ? 0 : value;
};

export const capturePlanarObservation = (
  truth: PlanarMotionEstimate,
  observedAt: number,
  quality: number,
  rng: DeterministicRng,
  parameters: ObservationErrorParameters,
): ObservationSample<PlanarMotionEstimate> | null => {
  validateUnit('quality', quality);
  validateParameters(parameters);
  validateFiniteValues('planar truth', [
    truth.position.x,
    truth.position.z,
    truth.velocity.x,
    truth.velocity.z,
  ]);

  if (quality < parameters.minimumDetectionQuality) {
    return null;
  }

  const positionScale = errorScale(
    parameters.minimumPositionErrorMeters,
    parameters.maximumPositionErrorMeters,
    quality,
  );
  const velocityScale = errorScale(
    parameters.minimumVelocityErrorMps,
    parameters.maximumVelocityErrorMps,
    quality,
  );

  return createObservationSample({
    position: {
      x: truth.position.x + sampleSymmetricTriangularError(rng, positionScale),
      z: truth.position.z + sampleSymmetricTriangularError(rng, positionScale),
    },
    velocity: {
      x: truth.velocity.x + sampleSymmetricTriangularError(rng, velocityScale),
      z: truth.velocity.z + sampleSymmetricTriangularError(rng, velocityScale),
    },
  }, observedAt, quality);
};

export const captureSpatialObservation = (
  truth: SpatialMotionEstimate,
  observedAt: number,
  quality: number,
  rng: DeterministicRng,
  parameters: ObservationErrorParameters,
): ObservationSample<SpatialMotionEstimate> | null => {
  validateUnit('quality', quality);
  validateParameters(parameters);
  validateFiniteValues('spatial truth', [
    truth.position.x,
    truth.position.y,
    truth.position.z,
    truth.velocity.x,
    truth.velocity.y,
    truth.velocity.z,
  ]);

  if (quality < parameters.minimumDetectionQuality) {
    return null;
  }

  const positionScale = errorScale(
    parameters.minimumPositionErrorMeters,
    parameters.maximumPositionErrorMeters,
    quality,
  );
  const velocityScale = errorScale(
    parameters.minimumVelocityErrorMps,
    parameters.maximumVelocityErrorMps,
    quality,
  );

  return createObservationSample({
    position: {
      x: truth.position.x + sampleSymmetricTriangularError(rng, positionScale),
      y: truth.position.y + sampleSymmetricTriangularError(rng, positionScale),
      z: truth.position.z + sampleSymmetricTriangularError(rng, positionScale),
    },
    velocity: {
      x: truth.velocity.x + sampleSymmetricTriangularError(rng, velocityScale),
      y: truth.velocity.y + sampleSymmetricTriangularError(rng, velocityScale),
      z: truth.velocity.z + sampleSymmetricTriangularError(rng, velocityScale),
    },
  }, observedAt, quality);
};
