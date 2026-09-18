import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  deriveRunnerAdvanceRiskPolicy,
} from './RunnerRiskPolicy';

const match = (
  inning: number,
  half: 'top' | 'bottom',
  outs: number,
  away: number,
  home: number,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning,
  half,
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

describe('RunnerRiskPolicy', () => {
  it('uses the baseline margin in a neutral early-inning state', () => {
    expect(deriveRunnerAdvanceRiskPolicy(
      match(3, 'top', 1, 2, 2),
      {
        regulationInnings: 9,
        calibration,
      },
    )).toEqual({
      battingTeam: 'away',
      battingRuns: 2,
      defendingRuns: 2,
      runDifferentialForOffense: 0,
      lateInning: false,
      minimumAdvanceSafetyMarginTicks: 60_000,
    });
  });

  it('becomes more aggressive with two outs and when trailing late', () => {
    const result = deriveRunnerAdvanceRiskPolicy(
      match(9, 'top', 2, 2, 4),
      {
        regulationInnings: 9,
        calibration,
      },
    );

    expect(result.runDifferentialForOffense).toBe(-2);
    expect(result.lateInning).toBe(true);
    expect(result.minimumAdvanceSafetyMarginTicks)
      .toBe(15_000);
  });

  it('can become more conservative when leading late', () => {
    const result = deriveRunnerAdvanceRiskPolicy(
      match(9, 'top', 0, 5, 3),
      {
        regulationInnings: 9,
        calibration,
      },
    );

    expect(result.minimumAdvanceSafetyMarginTicks)
      .toBe(80_000);
  });

  it('clamps the derived margin to explicit calibration bounds', () => {
    const result = deriveRunnerAdvanceRiskPolicy(
      match(12, 'bottom', 2, 1, 0),
      {
        regulationInnings: 9,
        calibration: {
          ...calibration,
          twoOutAdjustmentTicks: -100_000,
          lateTrailingAdjustmentTicks: -100_000,
        },
      },
    );

    expect(result.minimumAdvanceSafetyMarginTicks)
      .toBe(0);
  });
});
