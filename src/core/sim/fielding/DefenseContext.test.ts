import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  createDefenseContext,
} from './DefenseContext';

const match = (
  inning: number,
  half: 'top' | 'bottom',
  away: number,
  home: number,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning,
  half,
  outs: 1,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: { away, home },
  playId: 1,
});

describe('DefenseContext', () => {
  it('marks bottom ninth or later as walk-off eligible for the away defense', () => {
    expect(createDefenseContext(
      match(9, 'bottom', 3, 3),
      { regulationInnings: 9 },
    )).toEqual({
      inning: 9,
      half: 'bottom',
      outs: 1,
      defendingTeam: 'away',
      battingTeam: 'home',
      defendingRuns: 3,
      battingRuns: 3,
      runDifferentialForDefense: 0,
      walkOffEligible: true,
    });
  });

  it('does not mark the top half as walk-off eligible', () => {
    expect(createDefenseContext(
      match(9, 'top', 3, 3),
      { regulationInnings: 9 },
    ).walkOffEligible).toBe(false);
  });

  it('keeps score orientation from the defenders perspective', () => {
    expect(createDefenseContext(
      match(7, 'top', 4, 6),
      { regulationInnings: 9 },
    ).runDifferentialForDefense).toBe(2);

    expect(createDefenseContext(
      match(7, 'bottom', 4, 6),
      { regulationInnings: 9 },
    ).runDifferentialForDefense).toBe(-2);
  });
});
