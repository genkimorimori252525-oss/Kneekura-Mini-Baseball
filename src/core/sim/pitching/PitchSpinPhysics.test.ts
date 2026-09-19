import { describe, expect, it } from 'vitest';
import {
  decomposePitchSpin,
} from './PitchSpinPhysics';

describe('pitch spin physics', () => {
  it('treats spin perpendicular to flight as fully active', () => {
    const result = decomposePitchSpin(
      { x: 0, y: 0, z: -40 },
      { x: -200, y: 0, z: 0 },
    );

    expect(result.activeSpinFraction)
      .toBeCloseTo(1, 12);
    expect(result.gyroSpinFraction)
      .toBeCloseTo(0, 12);
    expect(result.gyroSpin)
      .toEqual({ x: 0, y: 0, z: 0 });
    expect(result.magnusDirection?.y)
      .toBeGreaterThan(0);
  });

  it('treats spin parallel to flight as gyro spin with no Magnus direction', () => {
    const result = decomposePitchSpin(
      { x: 0, y: 0, z: -40 },
      { x: 0, y: 0, z: -200 },
    );

    expect(result.activeSpinFraction)
      .toBeCloseTo(0, 12);
    expect(result.gyroSpinFraction)
      .toBeCloseTo(1, 12);
    expect(result.activeSpin)
      .toEqual({ x: 0, y: 0, z: 0 });
    expect(result.magnusDirection)
      .toBeNull();
  });

  it('decomposes mixed spin without changing total spin', () => {
    const result = decomposePitchSpin(
      { x: 0, y: 0, z: -40 },
      { x: -120, y: 0, z: -160 },
    );

    expect(result.totalSpinRadPerSecond)
      .toBeCloseTo(200, 12);
    expect(result.activeSpinRadPerSecond)
      .toBeCloseTo(120, 12);
    expect(result.gyroSpinRadPerSecond)
      .toBeCloseTo(160, 12);
    expect(result.activeSpinFraction)
      .toBeCloseTo(0.6, 12);
    expect(result.gyroSpinFraction)
      .toBeCloseTo(0.8, 12);
  });
});
