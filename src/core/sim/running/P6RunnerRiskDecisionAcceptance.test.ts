import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import {
  decideRunnerMotionIntent,
  type RunnerKnownContext,
} from './RunnerDecision';
import {
  deriveRunnerAdvanceRiskPolicy,
} from './RunnerRiskPolicy';

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

const match = (
  inning: number,
  outs: number,
  away: number,
  home: number,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning,
  half: 'top',
  outs,
  balls: 0,
  strikes: 0,
  bases: {
    first: 'runner',
    second: null,
    third: null,
  },
  score: { away, home },
  playId: 1,
});

const calibration = {
  baseAdvanceSafetyMarginTicks: 60_000,
  twoOutAdjustmentTicks: -20_000,
  lateTrailingAdjustmentTicks: -25_000,
  lateLeadingAdjustmentTicks: 20_000,
  minimumAdvanceSafetyMarginTicks: 0,
  maximumAdvanceSafetyMarginTicks: 120_000,
} as const;

const decide = (
  state: CanonicalMatchState,
) => {
  const policy = deriveRunnerAdvanceRiskPolicy(
    state,
    {
      regulationInnings: 9,
      calibration,
    },
  );

  return decideRunnerMotionIntent({
    runnerId: 'runner',
    perceivedWorld,
    perceivedCues: [{
      kind: 'next_base_race',
      observedAt: 980_000,
      confidence: 0.9,
      runnerArrivalTick: 1_800_000,
      defenderControlTick: 1_840_000,
    }],
    minimumCueConfidence: 0.5,
    coachTrust: 1,
    minimumAdvanceSafetyMarginTicks:
      policy.minimumAdvanceSafetyMarginTicks,
    decisionAbility: 0.8,
    timingParameters: {
      minimumDecisionDelayTicks: 30_000,
      maximumDecisionDelayTicks: 180_000,
      fixedRecognitionOffsetTicks: 10_000,
    },
  });
};

describe('P6 runner risk-policy decision acceptance', () => {
  it('changes only the optional advance choice when game context changes around the same perceived race', () => {
    const neutral = decide(
      match(3, 1, 2, 2),
    );
    const lateTrailingTwoOut = decide(
      match(9, 2, 2, 4),
    );

    expect(neutral.perceivedRaceMarginTicks)
      .toBe(40_000);
    expect(lateTrailingTwoOut.perceivedRaceMarginTicks)
      .toBe(40_000);

    expect(neutral.motionIntent.kind)
      .toBe('hold');
    expect(lateTrailingTwoOut.motionIntent.kind)
      .toBe('advance');
  });
});
