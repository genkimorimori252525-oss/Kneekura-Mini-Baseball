import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  createRatedThrowLaunch,
} from './ThrowLaunch';

const calibration = {
  minimumReleaseSpeedMps: 20,
  maximumReleaseSpeedMps: 40,
  minimumTargetErrorMeters: 0.02,
  maximumTargetErrorMeters: 0.42,
} as const;

describe('ThrowLaunch', () => {
  it('maps arm strength only into release speed', () => {
    const low = createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 0, y: 1.5, z: 0 },
      intendedTarget: { x: 20, y: 1, z: 0 },
      armStrength: 0,
      throwingAccuracy: 0.5,
      rng: new DeterministicRng(123),
      calibration,
    });
    const high = createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 0, y: 1.5, z: 0 },
      intendedTarget: { x: 20, y: 1, z: 0 },
      armStrength: 1,
      throwingAccuracy: 0.5,
      rng: new DeterministicRng(123),
      calibration,
    });

    expect(low.releaseSpeedMps).toBe(20);
    expect(high.releaseSpeedMps).toBe(40);
    expect(low.targetError).toEqual(high.targetError);
    expect(low.aimedTarget).toEqual(high.aimedTarget);
    expect(Math.hypot(
      low.initialVelocity.x,
      low.initialVelocity.y,
      low.initialVelocity.z,
    )).toBeCloseTo(20, 12);
    expect(Math.hypot(
      high.initialVelocity.x,
      high.initialVelocity.y,
      high.initialVelocity.z,
    )).toBeCloseTo(40, 12);
  });

  it('maps throwing accuracy only into deterministic target error scale', () => {
    const low = createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 0, y: 1.5, z: 0 },
      intendedTarget: { x: 20, y: 1, z: 0 },
      armStrength: 0.5,
      throwingAccuracy: 0,
      rng: new DeterministicRng(999),
      calibration,
    });
    const high = createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 0, y: 1.5, z: 0 },
      intendedTarget: { x: 20, y: 1, z: 0 },
      armStrength: 0.5,
      throwingAccuracy: 1,
      rng: new DeterministicRng(999),
      calibration,
    });

    expect(low.releaseSpeedMps).toBe(30);
    expect(high.releaseSpeedMps).toBe(30);
    expect(low.targetErrorScaleMeters).toBeCloseTo(0.42, 12);
    expect(high.targetErrorScaleMeters).toBeCloseTo(0.02, 12);
    expect(low.targetError).not.toEqual(high.targetError);
  });

  it('replays the exact same launch for the same RNG seed and inputs', () => {
    const run = () => createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 2, y: 1.4, z: 3 },
      intendedTarget: { x: 27, y: 1, z: 0 },
      armStrength: 0.7,
      throwingAccuracy: 0.8,
      rng: new DeterministicRng(20260918),
      calibration,
    });

    expect(run()).toEqual(run());
  });

  it('rejects zero-distance intended throws and invalid calibration', () => {
    expect(() => createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 1, y: 1, z: 1 },
      intendedTarget: { x: 1, y: 1, z: 1 },
      armStrength: 0.5,
      throwingAccuracy: 0.5,
      rng: new DeterministicRng(1),
      calibration,
    })).toThrow(
      'intendedTarget must be distinct from origin',
    );

    expect(() => createRatedThrowLaunch({
      releaseTick: 3_000_000,
      origin: { x: 0, y: 1, z: 0 },
      intendedTarget: { x: 10, y: 1, z: 0 },
      armStrength: 0.5,
      throwingAccuracy: 0.5,
      rng: new DeterministicRng(1),
      calibration: {
        ...calibration,
        minimumReleaseSpeedMps: 50,
      },
    })).toThrow(
      'maximumReleaseSpeedMps must be at least minimumReleaseSpeedMps',
    );
  });
});
