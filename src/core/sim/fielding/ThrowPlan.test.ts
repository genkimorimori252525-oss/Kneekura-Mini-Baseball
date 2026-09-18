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
import {
  selectThrowPlan,
} from './ThrowPlan';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 9,
  half: 'bottom',
  outs: 1,
  balls: 0,
  strikes: 0,
  bases: {
    first: 'batter',
    second: null,
    third: 'winning-run',
  },
  score: {
    away: 3,
    home: 3,
  },
  playId: 90,
};

describe('ThrowPlan', () => {
  it('prioritizes preventing the walk-off run over an easier fixed out', () => {
    const result = selectThrowPlan(
      createDefenseContext(
        match,
        { regulationInnings: 9 },
      ),
      [
        {
          id: 'easy-first-base-out',
          targetBase: 1,
          receiverId: 'first-baseman',
          estimatedCompletionTick: 5_300_000,
          outProbability: 0.95,
          scoringThreats: [{
            runnerId: 'winning-run',
            scoreProbability: 0.8,
          }],
          expectedExtraBasesAllowed: 0.2,
        },
        {
          id: 'throw-home',
          targetBase: 4,
          receiverId: 'catcher',
          estimatedCompletionTick: 5_360_000,
          outProbability: 0.62,
          scoringThreats: [{
            runnerId: 'winning-run',
            scoreProbability: 0.08,
          }],
          expectedExtraBasesAllowed: 0.7,
        },
      ],
    );

    expect(result.selected.id).toBe('throw-home');

    const first = result.evaluations.find(
      (entry) => entry.id === 'easy-first-base-out',
    );
    const home = result.evaluations.find(
      (entry) => entry.id === 'throw-home',
    );

    expect(first?.immediateLossProbability)
      .toBeCloseTo(0.8, 12);
    expect(home?.immediateLossProbability)
      .toBeCloseTo(0.08, 12);
  });

  it('uses out probability when scoring risk is otherwise identical', () => {
    const context = createDefenseContext(
      {
        ...match,
        inning: 5,
        half: 'top',
        score: {
          away: 1,
          home: 4,
        },
      },
      { regulationInnings: 9 },
    );

    const result = selectThrowPlan(
      context,
      [
        {
          id: 'hard-out',
          targetBase: 3,
          receiverId: 'third-baseman',
          estimatedCompletionTick: 2_300_000,
          outProbability: 0.4,
          scoringThreats: [],
          expectedExtraBasesAllowed: 0,
        },
        {
          id: 'easy-out',
          targetBase: 1,
          receiverId: 'first-baseman',
          estimatedCompletionTick: 2_350_000,
          outProbability: 0.9,
          scoringThreats: [],
          expectedExtraBasesAllowed: 0,
        },
      ],
    );

    expect(result.selected.id).toBe('easy-out');
  });

  it('computes multi-run critical-score probability from independent runner threats', () => {
    const context = createDefenseContext(
      {
        ...match,
        score: {
          away: 4,
          home: 2,
        },
      },
      { regulationInnings: 9 },
    );

    const result = selectThrowPlan(
      context,
      [{
        id: 'two-threats',
        targetBase: 2,
        receiverId: 'shortstop',
        estimatedCompletionTick: 3_000_000,
        outProbability: 0.5,
        scoringThreats: [
          {
            runnerId: 'r3',
            scoreProbability: 0.5,
          },
          {
            runnerId: 'r2',
            scoreProbability: 0.4,
          },
        ],
        expectedExtraBasesAllowed: 0.5,
      }],
    );

    const evaluation = result.evaluations[0];

    // Defense leads by two. Two runs are required to reach a tie.
    expect(evaluation.criticalScoreSwingProbability)
      .toBeCloseTo(0.2, 12);

    // Three runs would be required for an immediate walk-off lead,
    // so two threats cannot end the game.
    expect(evaluation.immediateLossProbability)
      .toBe(0);
  });

  it('is deterministic and never mutates the candidate physics estimates', () => {
    const candidates = [{
      id: 'first',
      targetBase: 1 as const,
      receiverId: '1b',
      estimatedCompletionTick: 1_500_000,
      outProbability: 0.7,
      scoringThreats: [{
        runnerId: 'r3',
        scoreProbability: 0.2,
      }],
      expectedExtraBasesAllowed: 0.3,
    }];
    const before = structuredClone(candidates);

    const first = selectThrowPlan(
      createDefenseContext(
        match,
        { regulationInnings: 9 },
      ),
      candidates,
    );
    const second = selectThrowPlan(
      createDefenseContext(
        match,
        { regulationInnings: 9 },
      ),
      candidates,
    );

    expect(first).toEqual(second);
    expect(candidates).toEqual(before);
  });
});
