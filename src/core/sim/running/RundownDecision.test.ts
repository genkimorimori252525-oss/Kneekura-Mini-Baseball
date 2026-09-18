import { describe, expect, it } from 'vitest';
import {
  decideRundownMotionIntent,
} from './RundownDecision';

const timing = {
  minimumDecisionDelayTicks: 20_000,
  maximumDecisionDelayTicks: 120_000,
  fixedRecognitionOffsetTicks: 10_000,
} as const;

describe('RundownDecision', () => {
  it('reverses toward the safer base when the alternative margin clearly exceeds hysteresis', () => {
    const result = decideRundownMotionIntent({
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
      decisionAbility: 0.8,
      timingParameters: timing,
    });

    expect(result.advanceSafetyMarginTicks).toBe(-80_000);
    expect(result.retreatSafetyMarginTicks).toBe(170_000);
    expect(result.motionIntent.kind).toBe('retreat');
    expect(result.switchedDirection).toBe(true);
  });

  it('keeps the current direction when the advantage is inside hysteresis', () => {
    const result = decideRundownMotionIntent({
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
      decisionAbility: 0.8,
      timingParameters: timing,
    });

    expect(result.advanceSafetyMarginTicks).toBe(100_000);
    expect(result.retreatSafetyMarginTicks).toBe(130_000);
    expect(result.motionIntent.kind).toBe('advance');
    expect(result.switchedDirection).toBe(false);
  });

  it('chooses the safer direction from a stationary state', () => {
    const result = decideRundownMotionIntent({
      observationTick: 2_000_000,
      currentDirection: 0,
      towardAdvance: {
        runnerArrivalTick: 2_500_000,
        defenderTagTick: 2_520_000,
      },
      towardRetreat: {
        runnerArrivalTick: 2_450_000,
        defenderTagTick: 2_600_000,
      },
      switchHysteresisTicks: 50_000,
      decisionAbility: 0.8,
      timingParameters: timing,
    });

    expect(result.motionIntent.kind).toBe('retreat');
  });

  it('changes decision issue time with ability without changing the chosen safer direction', () => {
    const common = {
      observationTick: 2_000_000,
      currentDirection: 1 as const,
      towardAdvance: {
        runnerArrivalTick: 2_500_000,
        defenderTagTick: 2_420_000,
      },
      towardRetreat: {
        runnerArrivalTick: 2_450_000,
        defenderTagTick: 2_620_000,
      },
      switchHysteresisTicks: 50_000,
      timingParameters: timing,
    };

    const slow = decideRundownMotionIntent({
      ...common,
      decisionAbility: 0,
    });
    const fast = decideRundownMotionIntent({
      ...common,
      decisionAbility: 1,
    });

    expect(slow.motionIntent.kind).toBe('retreat');
    expect(fast.motionIntent.kind).toBe('retreat');
    expect(fast.decisionTick).toBeLessThan(
      slow.decisionTick,
    );
  });

  it('supports an unguarded direction without inventing a finite defender arrival', () => {
    const result = decideRundownMotionIntent({
      observationTick: 2_000_000,
      currentDirection: -1,
      towardAdvance: {
        runnerArrivalTick: 2_500_000,
        defenderTagTick: null,
      },
      towardRetreat: {
        runnerArrivalTick: 2_450_000,
        defenderTagTick: 2_500_000,
      },
      switchHysteresisTicks: 50_000,
      decisionAbility: 0.8,
      timingParameters: timing,
    });

    expect(result.advanceSafetyMarginTicks)
      .toBe(Number.POSITIVE_INFINITY);
    expect(result.motionIntent.kind).toBe('advance');
  });
});
