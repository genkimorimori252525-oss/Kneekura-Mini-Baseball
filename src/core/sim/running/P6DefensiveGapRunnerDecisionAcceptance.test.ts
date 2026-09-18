import { describe, expect, it } from 'vitest';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
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

const decide = (
  defenderControlTick: number | null,
) => decideRunnerMotionIntent({
  runnerId: 'runner',
  perceivedWorld,
  perceivedCues: [{
    kind: 'next_base_race',
    observedAt: 980_000,
    confidence: 0.9,
    runnerArrivalTick: 1_800_000,
    defenderControlTick,
  }],
  minimumCueConfidence: 0.5,
  coachTrust: 1,
  minimumAdvanceSafetyMarginTicks: 60_000,
  decisionAbility: 0.8,
  timingParameters: {
    minimumDecisionDelayTicks: 30_000,
    maximumDecisionDelayTicks: 180_000,
    fixedRecognitionOffsetTicks: 10_000,
  },
});

describe('P6 defensive-gap runner-decision acceptance', () => {
  it('advances through a perceived uncovered base without changing runner speed physics', () => {
    const covered = decide(1_820_000);
    const uncovered = decide(null);

    expect(covered.motionIntent.kind).toBe('hold');
    expect(covered.perceivedRaceMarginTicks)
      .toBe(20_000);

    expect(uncovered.motionIntent.kind)
      .toBe('advance');
    expect(uncovered.perceivedRaceMarginTicks)
      .toBeNull();

    expect(uncovered.decisionTick)
      .toBe(covered.decisionTick);
  });

  it('advances when a perceived defender is simply late enough to the same base', () => {
    const lateCover = decide(1_900_000);

    expect(lateCover.perceivedRaceMarginTicks)
      .toBe(100_000);
    expect(lateCover.motionIntent.kind)
      .toBe('advance');
  });
});
