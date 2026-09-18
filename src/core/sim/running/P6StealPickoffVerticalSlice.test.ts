import { describe, expect, it } from 'vitest';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import {
  advanceRunnerMotion,
  type RunnerMotionParameters,
  type RunnerMotionState,
} from './RunnerMotion';
import {
  decideRunnerMotionIntent,
  type RunnerKnownContext,
} from './RunnerDecision';

const timing = {
  minimumDecisionDelayTicks: 20_000,
  maximumDecisionDelayTicks: 120_000,
  fixedRecognitionOffsetTicks: 10_000,
} as const;

const motion: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 80_000,
  accelerationMps2: 4,
  brakingMps2: 5,
  slideDecelerationMps2: 6,
  topSpeedMps: 8,
};

const world = (
  context: RunnerKnownContext,
): PlayerPerceivedWorldState<RunnerKnownContext> => ({
  observerId: 'runner',
  observationTime: 1_000_000,
  attention: {
    target: { kind: 'base', base: context.nextBase },
    focusedSinceTick: 900_000,
  },
  ball: null,
  players: [],
  communications: [],
  knownContext: context,
});

describe('P6 steal / pickoff physical vertical slice', () => {
  it('turns a perceived steal window into forward RunnerMotion without changing speed parameters', () => {
    const context: RunnerKnownContext = {
      currentBase: 1,
      nextBase: 2,
      forcedToAdvance: false,
      tagUp: { kind: 'none' },
    };

    const decision = decideRunnerMotionIntent({
      runnerId: 'runner',
      perceivedWorld: world(context),
      perceivedCues: [{
        kind: 'next_base_race',
        observedAt: 980_000,
        confidence: 0.95,
        runnerArrivalTick: 2_250_000,
        defenderControlTick: 2_420_000,
      }],
      minimumCueConfidence: 0.5,
      coachTrust: 1,
      minimumAdvanceSafetyMarginTicks: 60_000,
      decisionAbility: 0.9,
      timingParameters: timing,
    });

    expect(decision.motionIntent.kind)
      .toBe('advance');

    const start: RunnerMotionState = {
      tick: 1_000_000,
      routeDistanceMeters: 1.2,
      speedMps: 0,
      driveDirection: 0,
      bodyMode: 'upright',
    };

    const result = advanceRunnerMotion(
      start,
      decision.motionIntent,
      500_000,
      motion,
    );

    expect(result.routeDistanceMeters)
      .toBeGreaterThan(start.routeDistanceMeters);
    expect(motion.topSpeedMps).toBe(8);
    expect(motion.accelerationMps2).toBe(4);
  });

  it('turns a perceived pickoff threat into retreat and physically reverses an advancing lead', () => {
    const context: RunnerKnownContext = {
      currentBase: 1,
      nextBase: 2,
      forcedToAdvance: false,
      tagUp: { kind: 'none' },
    };

    const decision = decideRunnerMotionIntent({
      runnerId: 'runner',
      perceivedWorld: world(context),
      perceivedCues: [
        {
          kind: 'next_base_race',
          observedAt: 970_000,
          confidence: 0.8,
          runnerArrivalTick: 2_200_000,
          defenderControlTick: 2_500_000,
        },
        {
          kind: 'current_base_threat',
          observedAt: 990_000,
          confidence: 0.95,
          runnerReturnTick: 1_400_000,
          defenderTagTick: 1_330_000,
        },
      ],
      minimumCueConfidence: 0.5,
      coachTrust: 1,
      minimumAdvanceSafetyMarginTicks: 60_000,
      decisionAbility: 0.9,
      timingParameters: timing,
    });

    expect(decision.reason)
      .toBe('current_base_threat');
    expect(decision.motionIntent.kind)
      .toBe('retreat');

    const start: RunnerMotionState = {
      tick: 1_000_000,
      routeDistanceMeters: 1.5,
      speedMps: 2,
      driveDirection: 1,
      bodyMode: 'upright',
    };

    const result = advanceRunnerMotion(
      start,
      decision.motionIntent,
      1_000_000,
      motion,
    );

    expect(result.routeDistanceMeters)
      .toBeLessThan(
        start.routeDistanceMeters + 2,
      );
    expect(result.speedMps).toBeLessThan(0);
    expect(result.driveDirection).toBe(-1);
  });
});
