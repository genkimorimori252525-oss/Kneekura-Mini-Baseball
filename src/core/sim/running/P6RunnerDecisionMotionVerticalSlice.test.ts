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

const context: RunnerKnownContext = {
  currentBase: 1,
  nextBase: 2,
  forcedToAdvance: false,
  tagUp: { kind: 'none' },
};

const perceivedWorld:
  PlayerPerceivedWorldState<RunnerKnownContext> = {
    observerId: 'runner',
    observationTime: 1_000_000,
    attention: {
      target: { kind: 'base', base: 2 },
      focusedSinceTick: 900_000,
    },
    ball: null,
    players: [],
    communications: [],
    knownContext: context,
  };

const motionState: RunnerMotionState = {
  tick: 1_000_000,
  routeDistanceMeters: 0,
  speedMps: 0,
  driveDirection: 0,
  bodyMode: 'upright',
};

const motionParameters:
  RunnerMotionParameters = {
    ticksPerSecond: 1_000_000,
    reactionDelayTicks: 100_000,
    accelerationMps2: 4,
    brakingMps2: 4,
    slideDecelerationMps2: 5,
    topSpeedMps: 8,
  };

const decision = (
  decisionAbility: number,
) => decideRunnerMotionIntent({
  runnerId: 'runner',
  perceivedWorld,
  perceivedCues: [{
    kind: 'next_base_race',
    observedAt: 980_000,
    confidence: 0.9,
    runnerArrivalTick: 1_800_000,
    defenderControlTick: 2_000_000,
  }],
  minimumCueConfidence: 0.5,
  coachTrust: 1,
  minimumAdvanceSafetyMarginTicks: 50_000,
  decisionAbility,
  timingParameters: {
    minimumDecisionDelayTicks: 30_000,
    maximumDecisionDelayTicks: 180_000,
    fixedRecognitionOffsetTicks: 10_000,
  },
});

describe('P6 runner decision -> motion vertical slice', () => {
  it('turns decision ability into a real position difference without changing running physics', () => {
    const slowDecision = decision(0);
    const fastDecision = decision(1);

    expect(slowDecision.motionIntent.kind)
      .toBe('advance');
    expect(fastDecision.motionIntent.kind)
      .toBe('advance');
    expect(fastDecision.decisionTick)
      .toBeLessThan(slowDecision.decisionTick);

    const commonTick = 1_500_000;

    const slow = advanceRunnerMotion(
      motionState,
      slowDecision.motionIntent,
      commonTick - motionState.tick,
      motionParameters,
    );
    const fast = advanceRunnerMotion(
      motionState,
      fastDecision.motionIntent,
      commonTick - motionState.tick,
      motionParameters,
    );

    expect(slow.tick).toBe(commonTick);
    expect(fast.tick).toBe(commonTick);
    expect(fast.routeDistanceMeters)
      .toBeGreaterThan(slow.routeDistanceMeters);

    expect(fast.speedMps)
      .toBeGreaterThan(slow.speedMps);

    expect(motionParameters.topSpeedMps).toBe(8);
    expect(motionParameters.accelerationMps2).toBe(4);
    expect(motionParameters.reactionDelayTicks)
      .toBe(100_000);
  });

  it('keeps cognitive decision delay separate from the existing motor reaction delay', () => {
    const fastDecision = decision(1);

    expect(fastDecision.decisionTick)
      .toBe(1_020_000);

    const beforeMotorReaction =
      advanceRunnerMotion(
        motionState,
        fastDecision.motionIntent,
        100_000,
        motionParameters,
      );

    expect(beforeMotorReaction.tick)
      .toBe(1_100_000);
    expect(beforeMotorReaction.routeDistanceMeters)
      .toBe(0);
    expect(beforeMotorReaction.speedMps).toBe(0);

    const afterMotorReaction =
      advanceRunnerMotion(
        motionState,
        fastDecision.motionIntent,
        200_000,
        motionParameters,
      );

    expect(afterMotorReaction.routeDistanceMeters)
      .toBeGreaterThan(0);
  });
});
