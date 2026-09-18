import { describe, expect, it } from 'vitest';
import {
  advanceRunnerMotion,
  buildRunnerMotionTrajectory,
  sampleRunnerMotionTrajectory,
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

describe('sampleRunnerMotionTrajectory', () => {
  it('samples existing analytic segments and gives the exact reaction boundary to the new control', () => {
    const trajectory = buildRunnerMotionTrajectory(
      state(),
      { kind: 'advance', issuedTick: 1_000_000 },
      300_000,
      parameters,
    );

    expect(sampleRunnerMotionTrajectory(
      trajectory,
      1_050_000,
    )).toEqual({
      tick: 1_050_000,
      routeDistanceMeters: 0,
      speedMps: 0,
      driveDirection: 0,
      bodyMode: 'upright',
    });

    expect(sampleRunnerMotionTrajectory(
      trajectory,
      1_100_000,
    )).toEqual({
      tick: 1_100_000,
      routeDistanceMeters: 0,
      speedMps: 0,
      driveDirection: 1,
      bodyMode: 'upright',
    });

    const afterReaction = sampleRunnerMotionTrajectory(
      trajectory,
      1_150_000,
    );
    expect(afterReaction.driveDirection).toBe(1);
    expect(afterReaction.speedMps).toBeCloseTo(0.2, 12);
    expect(afterReaction.routeDistanceMeters).toBeCloseTo(0.005, 12);
  });

  it('uses endState at the exact end tick, including a reaction gate that opens there', () => {
    const trajectory = buildRunnerMotionTrajectory(
      state({ speedMps: 1, driveDirection: 1 }),
      { kind: 'retreat', issuedTick: 1_000_000 },
      500_000,
      { ...parameters, reactionDelayTicks: 500_000 },
    );

    expect(sampleRunnerMotionTrajectory(
      trajectory,
      1_500_000,
    )).toEqual(trajectory.endState);
    expect(trajectory.endState.driveDirection).toBe(-1);
  });

  it('gives the later cruise segment ownership of an exact acceleration-to-top-speed boundary', () => {
    const trajectory = buildRunnerMotionTrajectory(
      state(),
      { kind: 'advance', issuedTick: 1_000_000 },
      3_000_000,
      { ...parameters, reactionDelayTicks: 0 },
    );

    const atTopSpeed = sampleRunnerMotionTrajectory(
      trajectory,
      3_000_000,
    );

    expect(atTopSpeed.driveDirection).toBe(1);
    expect(atTopSpeed.speedMps).toBeCloseTo(8, 12);
    expect(atTopSpeed.routeDistanceMeters).toBeCloseTo(8, 12);
  });

  it('matches independently advanced RunnerMotion at arbitrary authoritative ticks', () => {
    const start = state({ speedMps: 1, driveDirection: 1 });
    const intent = {
      kind: 'retreat' as const,
      issuedTick: 1_000_000,
    };
    const duration = 800_000;
    const localParameters = {
      ...parameters,
      reactionDelayTicks: 200_000,
    };
    const trajectory = buildRunnerMotionTrajectory(
      start,
      intent,
      duration,
      localParameters,
    );

    for (const deltaTicks of [0, 50_000, 200_000, 350_000, 800_000]) {
      expect(sampleRunnerMotionTrajectory(
        trajectory,
        start.tick + deltaTicks,
      )).toEqual(advanceRunnerMotion(
        start,
        intent,
        deltaTicks,
        localParameters,
      ));
    }
  });

  it('rejects ticks outside the built trajectory interval', () => {
    const trajectory = buildRunnerMotionTrajectory(
      state(),
      { kind: 'advance', issuedTick: 1_000_000 },
      100_000,
      parameters,
    );

    expect(() => sampleRunnerMotionTrajectory(
      trajectory,
      999_999,
    )).toThrow(
      'runner motion trajectory sample tick must lie inside the trajectory interval',
    );
    expect(() => sampleRunnerMotionTrajectory(
      trajectory,
      1_100_001,
    )).toThrow(
      'runner motion trajectory sample tick must lie inside the trajectory interval',
    );
  });
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
