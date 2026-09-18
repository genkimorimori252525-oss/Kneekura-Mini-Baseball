import { describe, expect, it } from 'vitest';
import { SeedRoot } from '../../rng/SeedRoot';
import type {
  PlanarMotionEstimate,
  SpatialMotionEstimate,
} from './ObservationMemory';
import {
  capturePlanarObservation,
  captureSpatialObservation,
  type ObservationErrorParameters,
} from './ObservationCapture';

const zeroMinimumError: ObservationErrorParameters = {
  minimumDetectionQuality: 0.2,
  minimumPositionErrorMeters: 0,
  maximumPositionErrorMeters: 2,
  minimumVelocityErrorMps: 0,
  maximumVelocityErrorMps: 4,
};

const planarTruth: PlanarMotionEstimate = {
  position: { x: 8, z: 20 },
  velocity: { x: -2, z: 1 },
};

describe('ObservationCapture', () => {
  it('captures exact truth at quality 1 when calibrated minimum error is zero', () => {
    const sample = capturePlanarObservation(
      planarTruth,
      2_000_000,
      1,
      new SeedRoot(44).streamRng(5, 'perception', 'runner-1|ss-6|2000000'),
      zeroMinimumError,
    );

    expect(sample).toEqual({
      estimate: planarTruth,
      observedAt: 2_000_000,
      confidence: 1,
    });
  });

  it('replays the same noisy estimate from the same named stream', () => {
    const root = new SeedRoot(44);
    const a = capturePlanarObservation(
      planarTruth,
      2_000_000,
      0.5,
      root.streamRng(5, 'perception', 'runner-1|ss-6|2000000'),
      zeroMinimumError,
    );
    const b = capturePlanarObservation(
      planarTruth,
      2_000_000,
      0.5,
      root.streamRng(5, 'perception', 'runner-1|ss-6|2000000'),
      zeroMinimumError,
    );

    expect(a).toEqual(b);
    expect(a?.confidence).toBe(0.5);
    expect(a?.estimate).not.toEqual(planarTruth);
  });

  it('keeps each planar error component within its quality-scaled bound', () => {
    const quality = 0.5;
    const sample = capturePlanarObservation(
      planarTruth,
      2_000_000,
      quality,
      new SeedRoot(91).streamRng(2, 'perception', 'bounded'),
      zeroMinimumError,
    );
    expect(sample).not.toBeNull();

    const positionBound = 1; // lerp(2 -> 0, quality=.5)
    const velocityBound = 2; // lerp(4 -> 0, quality=.5)
    expect(Math.abs(sample!.estimate.position.x - planarTruth.position.x))
      .toBeLessThanOrEqual(positionBound);
    expect(Math.abs(sample!.estimate.position.z - planarTruth.position.z))
      .toBeLessThanOrEqual(positionBound);
    expect(Math.abs(sample!.estimate.velocity.x - planarTruth.velocity.x))
      .toBeLessThanOrEqual(velocityBound);
    expect(Math.abs(sample!.estimate.velocity.z - planarTruth.velocity.z))
      .toBeLessThanOrEqual(velocityBound);
  });

  it('uses a fixed eight random draws for a successful planar observation', () => {
    const root = new SeedRoot(77);
    const captureRng = root.streamRng(9, 'perception', 'fixed-draws');
    const controlRng = root.streamRng(9, 'perception', 'fixed-draws');

    capturePlanarObservation(
      planarTruth,
      1_000,
      0.7,
      captureRng,
      zeroMinimumError,
    );
    for (let index = 0; index < 8; index += 1) {
      controlRng.nextFloat();
    }

    expect(captureRng.nextUint32()).toBe(controlRng.nextUint32());
  });

  it('returns no observation below a deterministic detection-quality threshold', () => {
    expect(capturePlanarObservation(
      planarTruth,
      2_000_000,
      0.19,
      new SeedRoot(44).streamRng(5, 'perception', 'too-poor'),
      zeroMinimumError,
    )).toBeNull();
  });

  it('captures spatial ball position and velocity without mutating canonical truth', () => {
    const truth: SpatialMotionEstimate = {
      position: { x: 1, y: 3, z: 12 },
      velocity: { x: 2, y: -1, z: -18 },
    };
    const original = JSON.parse(JSON.stringify(truth)) as SpatialMotionEstimate;

    const sample = captureSpatialObservation(
      truth,
      3_000_000,
      0.8,
      new SeedRoot(83).streamRng(7, 'perception', 'fielder-8|ball|3000000'),
      zeroMinimumError,
    );

    expect(sample).not.toBeNull();
    expect(sample?.confidence).toBe(0.8);
    expect(truth).toEqual(original);
  });
});
