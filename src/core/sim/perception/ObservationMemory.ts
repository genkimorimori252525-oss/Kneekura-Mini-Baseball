import type { Vec2, Vec3 } from '../../model/geometry';
import type { ObservationSample } from './Observation';

export type PlanarMotionEstimate = Readonly<{
  position: Vec2;
  velocity: Vec2;
}>;

export type SpatialMotionEstimate = Readonly<{
  position: Vec3;
  velocity: Vec3;
}>;

export type ObservationMemoryDecayParameters = Readonly<{
  ticksPerSecond: number;
  confidenceLossPerSecond: number;
  confidenceFloor: number;
}>;

export type RememberedPrediction<T> = Readonly<{
  estimate: T;
  sourceObservedAt: number;
  predictedAt: number;
  confidence: number;
}>;

const validateParameters = (
  parameters: ObservationMemoryDecayParameters,
): void => {
  if (!Number.isSafeInteger(parameters.ticksPerSecond) || parameters.ticksPerSecond <= 0) {
    throw new Error('ticksPerSecond must be a positive safe integer');
  }
  if (
    !Number.isFinite(parameters.confidenceLossPerSecond)
    || parameters.confidenceLossPerSecond < 0
  ) {
    throw new Error('confidenceLossPerSecond must be finite and non-negative');
  }
  if (
    !Number.isFinite(parameters.confidenceFloor)
    || parameters.confidenceFloor < 0
    || parameters.confidenceFloor > 1
  ) {
    throw new Error('confidenceFloor must be finite and within [0, 1]');
  }
};

const elapsedSeconds = (
  observedAt: number,
  predictedAt: number,
  ticksPerSecond: number,
): number => {
  if (!Number.isSafeInteger(predictedAt) || predictedAt < 0) {
    throw new Error('predictedAt must be a non-negative safe integer tick');
  }
  if (predictedAt < observedAt) {
    throw new Error('predictedAt must be at or after the source observation');
  }
  return (predictedAt - observedAt) / ticksPerSecond;
};

const decayedConfidence = (
  initialConfidence: number,
  elapsed: number,
  parameters: ObservationMemoryDecayParameters,
): number => Math.min(
  initialConfidence,
  Math.max(
    parameters.confidenceFloor,
    initialConfidence - elapsed * parameters.confidenceLossPerSecond,
  ),
);

export const predictPlanarObservationMemory = (
  sample: ObservationSample<PlanarMotionEstimate>,
  predictedAt: number,
  parameters: ObservationMemoryDecayParameters,
): RememberedPrediction<PlanarMotionEstimate> => {
  validateParameters(parameters);
  const elapsed = elapsedSeconds(sample.observedAt, predictedAt, parameters.ticksPerSecond);

  return {
    estimate: {
      position: {
        x: sample.estimate.position.x + sample.estimate.velocity.x * elapsed,
        z: sample.estimate.position.z + sample.estimate.velocity.z * elapsed,
      },
      velocity: sample.estimate.velocity,
    },
    sourceObservedAt: sample.observedAt,
    predictedAt,
    confidence: decayedConfidence(sample.confidence, elapsed, parameters),
  };
};

export const predictSpatialObservationMemory = (
  sample: ObservationSample<SpatialMotionEstimate>,
  predictedAt: number,
  parameters: ObservationMemoryDecayParameters,
): RememberedPrediction<SpatialMotionEstimate> => {
  validateParameters(parameters);
  const elapsed = elapsedSeconds(sample.observedAt, predictedAt, parameters.ticksPerSecond);

  return {
    estimate: {
      position: {
        x: sample.estimate.position.x + sample.estimate.velocity.x * elapsed,
        y: sample.estimate.position.y + sample.estimate.velocity.y * elapsed,
        z: sample.estimate.position.z + sample.estimate.velocity.z * elapsed,
      },
      velocity: sample.estimate.velocity,
    },
    sourceObservedAt: sample.observedAt,
    predictedAt,
    confidence: decayedConfidence(sample.confidence, elapsed, parameters),
  };
};
