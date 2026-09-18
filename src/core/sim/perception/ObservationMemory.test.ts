import { describe, expect, it } from 'vitest';
import { createObservationSample } from './Observation';
import {
  predictPlanarObservationMemory,
  predictSpatialObservationMemory,
  type ObservationMemoryDecayParameters,
} from './ObservationMemory';

const parameters: ObservationMemoryDecayParameters = {
  ticksPerSecond: 1_000_000,
  confidenceLossPerSecond: 0.2,
  confidenceFloor: 0.1,
};

describe('ObservationMemory', () => {
  it('preserves the exact observation at zero elapsed time', () => {
    const sample = createObservationSample({
      position: { x: 3, z: -1 },
      velocity: { x: 2, z: 4 },
    }, 1_000_000, 0.9);

    expect(predictPlanarObservationMemory(sample, 1_000_000, parameters)).toEqual({
      estimate: sample.estimate,
      sourceObservedAt: 1_000_000,
      predictedAt: 1_000_000,
      confidence: 0.9,
    });
  });

  it('predicts planar position forward using remembered velocity and decays confidence', () => {
    const sample = createObservationSample({
      position: { x: 3, z: -1 },
      velocity: { x: 2, z: 4 },
    }, 1_000_000, 0.9);

    expect(predictPlanarObservationMemory(sample, 2_500_000, parameters)).toEqual({
      estimate: {
        position: { x: 6, z: 5 },
        velocity: { x: 2, z: 4 },
      },
      sourceObservedAt: 1_000_000,
      predictedAt: 2_500_000,
      confidence: 0.6,
    });
  });

  it('predicts 3D ball memory without calling authoritative ball physics', () => {
    const sample = createObservationSample({
      position: { x: 1, y: 2, z: 3 },
      velocity: { x: -2, y: 1, z: 4 },
    }, 2_000_000, 0.75);

    expect(predictSpatialObservationMemory(sample, 2_500_000, parameters)).toEqual({
      estimate: {
        position: { x: 0, y: 2.5, z: 5 },
        velocity: { x: -2, y: 1, z: 4 },
      },
      sourceObservedAt: 2_000_000,
      predictedAt: 2_500_000,
      confidence: 0.65,
    });
  });

  it('never decays below the configured confidence floor', () => {
    const sample = createObservationSample({
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
    }, 0, 0.8);

    expect(
      predictPlanarObservationMemory(sample, 20_000_000, parameters).confidence,
    ).toBe(0.1);
  });

  it('rejects prediction before the source observation', () => {
    const sample = createObservationSample({
      position: { x: 0, z: 0 },
      velocity: { x: 0, z: 0 },
    }, 100, 0.8);

    expect(() => predictPlanarObservationMemory(sample, 99, parameters)).toThrow();
  });
});
