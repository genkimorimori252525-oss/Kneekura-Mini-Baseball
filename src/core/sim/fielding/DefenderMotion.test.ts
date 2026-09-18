import { describe, expect, it } from 'vitest';
import {
  advanceDefenderMotion,
  buildDefenderMotionTrajectory,
  sampleDefenderMotionSegment,
  type DefenderMotionParameters,
  type DefenderMotionState,
} from './DefenderMotion';

const parameters: DefenderMotionParameters = {
  ticksPerSecond: 1_000_000,
  maxIntegrationStepTicks: 2_000,
  accelerationMps2: 4,
  brakingMps2: 4,
  topSpeedMps: 8,
  arrivalRadiusMeters: 0.05,
};

const rest = (): DefenderMotionState => ({
  tick: 1_000_000,
  position: { x: 0, z: 0 },
  velocity: { x: 0, z: 0 },
});

describe('DefenderMotion', () => {
  it('accelerates from rest toward a local target using canonical time', () => {
    const result = advanceDefenderMotion(
      rest(),
      { x: 100, z: 0 },
      1_000_000,
      parameters,
    );

    expect(result.tick).toBe(2_000_000);
    expect(result.position.x).toBeCloseTo(2, 10);
    expect(result.position.z).toBeCloseTo(0, 10);
    expect(result.velocity.x).toBeCloseTo(4, 10);
    expect(result.velocity.z).toBeCloseTo(0, 10);
  });

  it('caps at top speed and cruises without a result shortcut', () => {
    const result = advanceDefenderMotion(
      rest(),
      { x: 100, z: 0 },
      3_000_000,
      parameters,
    );

    expect(result.position.x).toBeCloseTo(16, 8);
    expect(result.velocity.x).toBeCloseTo(8, 10);
  });

  it('brakes a hold intent to zero without reversing', () => {
    const result = advanceDefenderMotion({
      tick: 0,
      position: { x: 0, z: 0 },
      velocity: { x: 4, z: 0 },
    }, null, 1_000_000, parameters);

    expect(result.position.x).toBeCloseTo(2, 8);
    expect(result.velocity).toEqual({ x: 0, z: 0 });
  });

  it('changes direction with finite acceleration instead of rotating velocity instantly', () => {
    const result = advanceDefenderMotion({
      tick: 0,
      position: { x: 0, z: 0 },
      velocity: { x: 4, z: 0 },
    }, { x: 0, z: 100 }, 2_000, parameters);

    expect(result.velocity.x).toBeGreaterThan(3.9);
    expect(result.velocity.z).toBeGreaterThan(0);
    expect(result.velocity.z).toBeLessThan(0.01);
  });

  it('brakes when the current stopping distance reaches the target', () => {
    const result = advanceDefenderMotion({
      tick: 0,
      position: { x: 8, z: 0 },
      velocity: { x: 4, z: 0 },
    }, { x: 10, z: 0 }, 1_000_000, parameters);

    expect(result.position.x).toBeCloseTo(10, 6);
    expect(result.velocity.x).toBeCloseTo(0, 8);
  });

  it('exposes the same constant-acceleration segments used by state advancement', () => {
    const segments = buildDefenderMotionTrajectory(
      rest(),
      { x: 100, z: 0 },
      10_000,
      parameters,
    );

    expect(segments).toHaveLength(5);
    expect(segments[0].startTick).toBe(1_000_000);
    expect(segments[0].endTick).toBe(1_002_000);
    expect(segments[0].acceleration).toEqual({ x: 4, z: 0 });

    const midpoint = sampleDefenderMotionSegment(segments[0], 1_001_000);
    expect(midpoint.position.x).toBeCloseTo(0.000002, 12);
    expect(midpoint.velocity.x).toBeCloseTo(0.004, 12);

    const finalFromSegment = sampleDefenderMotionSegment(
      segments[segments.length - 1],
      1_010_000,
    );
    const advanced = advanceDefenderMotion(
      rest(),
      { x: 100, z: 0 },
      10_000,
      parameters,
    );
    expect(finalFromSegment.position.x).toBeCloseTo(advanced.position.x, 12);
    expect(finalFromSegment.velocity.x).toBeCloseTo(advanced.velocity.x, 12);
  });
});
