import { describe, expect, it } from 'vitest';
import {
  advanceRunnerMotion,
  type RunnerMotionParameters,
  type RunnerMotionState,
} from './RunnerMotion';
import {
  decideRundownMotionIntent,
} from './RundownDecision';

const motionParameters: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 80_000,
  accelerationMps2: 4,
  brakingMps2: 5,
  slideDecelerationMps2: 6,
  topSpeedMps: 8,
};

const start: RunnerMotionState = {
  tick: 2_000_000,
  routeDistanceMeters: 10,
  speedMps: 3,
  driveDirection: 1,
  bodyMode: 'upright',
};

describe('P6 rundown decision -> motion vertical slice', () => {
  it('physically reverses after the perceived retreat side becomes materially safer', () => {
    const decision = decideRundownMotionIntent({
      observationTick: 2_000_000,
      currentDirection: 1,
      towardAdvance: {
        runnerArrivalTick: 2_500_000,
        defenderTagTick: 2_420_000,
      },
      towardRetreat: {
        runnerArrivalTick: 2_450_000,
        defenderTagTick: 2_620_000,
      },
      switchHysteresisTicks: 50_000,
      decisionAbility: 0.9,
      timingParameters: {
        minimumDecisionDelayTicks: 20_000,
        maximumDecisionDelayTicks: 120_000,
        fixedRecognitionOffsetTicks: 10_000,
      },
    });

    expect(decision.motionIntent.kind)
      .toBe('retreat');

    const result = advanceRunnerMotion(
      start,
      decision.motionIntent,
      1_200_000,
      motionParameters,
    );

    expect(result.driveDirection).toBe(-1);
    expect(result.speedMps).toBeLessThan(0);
    expect(result.routeDistanceMeters)
      .toBeLessThan(
        start.routeDistanceMeters
        + start.speedMps * 1.2,
      );
  });

  it('does not reverse when the alternative is only marginally safer inside hysteresis', () => {
    const decision = decideRundownMotionIntent({
      observationTick: 2_000_000,
      currentDirection: 1,
      towardAdvance: {
        runnerArrivalTick: 2_500_000,
        defenderTagTick: 2_600_000,
      },
      towardRetreat: {
        runnerArrivalTick: 2_480_000,
        defenderTagTick: 2_610_000,
      },
      switchHysteresisTicks: 50_000,
      decisionAbility: 0.9,
      timingParameters: {
        minimumDecisionDelayTicks: 20_000,
        maximumDecisionDelayTicks: 120_000,
        fixedRecognitionOffsetTicks: 10_000,
      },
    });

    expect(decision.motionIntent.kind)
      .toBe('advance');

    const result = advanceRunnerMotion(
      start,
      decision.motionIntent,
      400_000,
      motionParameters,
    );

    expect(result.driveDirection).toBe(1);
    expect(result.speedMps).toBeGreaterThan(3);
  });
});
