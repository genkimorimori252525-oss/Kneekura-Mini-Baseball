import { describe, expect, it } from 'vitest';
import {
  advanceRunnerMotion,
  type RunnerMotionParameters,
  type RunnerMotionState,
} from './RunnerMotion';

const parameters: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 100_000,
  accelerationMps2: 4,
  brakingMps2: 4,
  slideDecelerationMps2: 5,
  topSpeedMps: 8,
};

const state = (overrides: Partial<RunnerMotionState> = {}): RunnerMotionState => ({
  tick: 1_000_000,
  routeDistanceMeters: 0,
  speedMps: 0,
  driveDirection: 0,
  bodyMode: 'upright',
  ...overrides,
});

describe('advanceRunnerMotion', () => {
  it('waits for reaction delay before applying a new advance intent', () => {
    const result = advanceRunnerMotion(
      state(),
      { kind: 'advance', issuedTick: 1_000_000 },
      200_000,
      parameters,
    );

    expect(result.tick).toBe(1_200_000);
    expect(result.driveDirection).toBe(1);
    expect(result.bodyMode).toBe('upright');
    expect(result.speedMps).toBeCloseTo(0.4, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(0.02, 12);
  });

  it('keeps the previous drive active until the new intent reaction gate opens', () => {
    const result = advanceRunnerMotion(
      state({ speedMps: 1, driveDirection: 1 }),
      { kind: 'retreat', issuedTick: 1_000_000 },
      500_000,
      { ...parameters, reactionDelayTicks: 500_000 },
    );

    expect(result.tick).toBe(1_500_000);
    expect(result.driveDirection).toBe(-1);
    expect(result.speedMps).toBeCloseTo(3, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(1, 12);
  });

  it('accelerates to top speed and cruises for the remaining interval', () => {
    const result = advanceRunnerMotion(
      state(),
      { kind: 'advance', issuedTick: 1_000_000 },
      3_000_000,
      { ...parameters, reactionDelayTicks: 0 },
    );

    expect(result.tick).toBe(4_000_000);
    expect(result.speedMps).toBeCloseTo(8, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(16, 12);
  });

  it('brakes toward zero without reversing for a hold intent', () => {
    const result = advanceRunnerMotion(
      state({ speedMps: 6, driveDirection: 1 }),
      { kind: 'hold', issuedTick: 1_000_000 },
      1_000_000,
      { ...parameters, reactionDelayTicks: 0, brakingMps2: 3 },
    );

    expect(result.driveDirection).toBe(0);
    expect(result.speedMps).toBeCloseTo(3, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(4.5, 12);
  });

  it('brakes to zero before accelerating in the opposite direction', () => {
    const result = advanceRunnerMotion(
      state({ speedMps: 4, driveDirection: 1 }),
      { kind: 'retreat', issuedTick: 1_000_000 },
      2_000_000,
      { ...parameters, reactionDelayTicks: 0 },
    );

    expect(result.driveDirection).toBe(-1);
    expect(result.speedMps).toBeCloseTo(-4, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(0, 12);
  });

  it('does not start a slide before the runner has reacted to the slide intent', () => {
    const result = advanceRunnerMotion(
      state({ speedMps: 6, driveDirection: 1 }),
      { kind: 'slide', issuedTick: 1_000_000 },
      50_000,
      parameters,
    );

    expect(result.bodyMode).toBe('upright');
    expect(result.driveDirection).toBe(1);
    expect(result.speedMps).toBeCloseTo(6.2, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(0.305, 12);
  });

  it('switches to sliding after reaction delay and decelerates without reversing', () => {
    const result = advanceRunnerMotion(
      state({ speedMps: 6, driveDirection: 1 }),
      { kind: 'slide', issuedTick: 1_000_000 },
      300_000,
      parameters,
    );

    expect(result.bodyMode).toBe('sliding');
    expect(result.driveDirection).toBe(0);
    expect(result.speedMps).toBeCloseTo(5.4, 12);
    expect(result.routeDistanceMeters).toBeCloseTo(1.8, 12);
  });

  it('lets a slide come to rest without crossing through zero into reverse motion', () => {
    const result = advanceRunnerMotion(
      state({ speedMps: 1, driveDirection: 1 }),
      { kind: 'slide', issuedTick: 1_000_000 },
      1_000_000,
      { ...parameters, reactionDelayTicks: 0 },
    );

    expect(result.bodyMode).toBe('sliding');
    expect(result.speedMps).toBe(0);
    expect(result.routeDistanceMeters).toBeCloseTo(0.1, 12);
  });
});
