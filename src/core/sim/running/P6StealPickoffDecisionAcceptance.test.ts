import { describe, expect, it } from 'vitest';
import type {
  PlayerPerceivedWorldState,
} from '../perception/PlayerPerceivedWorldState';
import {
  decideRunnerMotionIntent,
  type RunnerKnownContext,
} from './RunnerDecision';
import {
  buildPerceivedStealRaceCue,
} from './PerceivedStealRace';
import {
  buildPerceivedPickoffThreatCue,
} from './PerceivedPickoffThreat';

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
  perceivedCues:
    Parameters<typeof decideRunnerMotionIntent>[0]['perceivedCues'],
) => decideRunnerMotionIntent({
  runnerId: 'runner',
  perceivedWorld,
  perceivedCues,
  minimumCueConfidence: 0.5,
  coachTrust: 1,
  minimumAdvanceSafetyMarginTicks: 60_000,
  decisionAbility: 0.9,
  timingParameters: {
    minimumDecisionDelayTicks: 20_000,
    maximumDecisionDelayTicks: 120_000,
    fixedRecognitionOffsetTicks: 10_000,
  },
});

describe('P6 steal / pickoff perception -> decision acceptance', () => {
  it('takes the steal when the perceived battery/tag sequence loses the race', () => {
    const steal = buildPerceivedStealRaceCue({
      observedAt: 980_000,
      confidence: 0.95,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 500_000,
      catcherTransferTicks: 200_000,
      throwFlightTicks: 650_000,
      fielderTagTicks: 100_000,
    });

    const result = decide([steal]);

    expect(steal.defenderControlTick)
      .toBe(2_470_000);
    expect(result.perceivedRaceMarginTicks)
      .toBe(270_000);
    expect(result.motionIntent.kind)
      .toBe('advance');
  });

  it('abandons the optional advance when a perceived pickoff threat arrives', () => {
    const steal = buildPerceivedStealRaceCue({
      observedAt: 970_000,
      confidence: 0.85,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 500_000,
      catcherTransferTicks: 200_000,
      throwFlightTicks: 650_000,
      fielderTagTicks: 100_000,
    });
    const pickoff = buildPerceivedPickoffThreatCue({
      observedAt: 990_000,
      confidence: 0.95,
      runnerReturnTick: 1_420_000,
      perceivedPickoffCommitmentTick: 1_020_000,
      pitcherReleaseDelayTicks: 90_000,
      throwFlightTicks: 180_000,
      fielderTagTicks: 70_000,
    });

    const result = decide([
      steal,
      pickoff,
    ]);

    expect(result.reason)
      .toBe('current_base_threat');
    expect(result.motionIntent.kind)
      .toBe('retreat');
  });

  it('can reject a steal against a quicker perceived battery with the same runner arrival', () => {
    const quickBattery = buildPerceivedStealRaceCue({
      observedAt: 980_000,
      confidence: 0.95,
      runnerArrivalTick: 2_200_000,
      perceivedPitchCommitmentTick: 1_020_000,
      pitcherToCatcherTicks: 350_000,
      catcherTransferTicks: 120_000,
      throwFlightTicks: 580_000,
      fielderTagTicks: 70_000,
    });

    const result = decide([
      quickBattery,
    ]);

    expect(quickBattery.defenderControlTick)
      .toBe(2_140_000);
    expect(result.perceivedRaceMarginTicks)
      .toBe(-60_000);
    expect(result.motionIntent.kind)
      .toBe('hold');
  });
});
