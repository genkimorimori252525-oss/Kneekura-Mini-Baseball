import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  TeamCoveragePlan,
} from './TeamCoveragePlan';
import {
  createDefenseContext,
} from './DefenseContext';
import {
  selectThrowPlanForCoverage,
} from './CoverageThrowPlan';

const coverage: TeamCoveragePlan = {
  totalPriority: 6,
  assignments: [
    {
      playerId: '1b',
      registeredPosition: '1B',
      intent: { kind: 'ball_handler' },
      selectedPriority: 0.95,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'p',
      registeredPosition: 'P',
      intent: { kind: 'base_cover', base: 1 },
      selectedPriority: 0.9,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      intent: { kind: 'base_cover', base: 2 },
      selectedPriority: 0.8,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      intent: { kind: 'base_cover', base: 3 },
      selectedPriority: 0.8,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      intent: { kind: 'base_cover', base: 4 },
      selectedPriority: 0.8,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      intent: {
        kind: 'relay',
        target: { x: 12, z: 28 },
      },
      selectedPriority: 0.6,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      intent: {
        kind: 'deep_coverage',
        target: { x: -28, z: 60 },
      },
      selectedPriority: 0.5,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      intent: {
        kind: 'backup',
        target: { x: 0, z: 40 },
      },
      selectedPriority: 0.5,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      intent: { kind: 'hold' },
      selectedPriority: 0.15,
      evidenceAvailableAt: 1_000_000,
      evidenceKinds: ['fixture'],
    },
  ],
};

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

const candidates = [
  {
    id: 'first',
    targetBase: 1 as const,
    receiverId: 'p',
    estimatedCompletionTick: 5_300_000,
    outProbability: 0.95,
    scoringThreats: [{
      runnerId: 'winning-run',
      scoreProbability: 0.8,
    }],
    expectedExtraBasesAllowed: 0.2,
  },
  {
    id: 'home',
    targetBase: 4 as const,
    receiverId: 'c',
    estimatedCompletionTick: 5_360_000,
    outProbability: 0.62,
    scoringThreats: [{
      runnerId: 'winning-run',
      scoreProbability: 0.08,
    }],
    expectedExtraBasesAllowed: 0.7,
  },
];

describe('CoverageThrowPlan', () => {
  it('binds the team ball handler to a throw candidate whose receiver owns the target-base cover', () => {
    const result = selectThrowPlanForCoverage(
      createDefenseContext(
        match,
        { regulationInnings: 9 },
      ),
      coverage,
      candidates,
    );

    expect(result.throwerId).toBe('1b');
    expect(result.selection.selected.id).toBe('home');
    expect(result.selection.selected.receiverId)
      .toBe('c');
  });

  it('rejects a throw to a receiver that does not own the matching base-cover role', () => {
    expect(() => selectThrowPlanForCoverage(
      createDefenseContext(
        match,
        { regulationInnings: 9 },
      ),
      coverage,
      [{
        ...candidates[0],
        receiverId: 'ss',
      }],
    )).toThrow(
      'throw-plan receiver must own the matching base-cover assignment',
    );
  });

  it('requires exactly one team ball handler', () => {
    const noHandler: TeamCoveragePlan = {
      ...coverage,
      assignments: coverage.assignments.map(
        (assignment) => (
          assignment.intent.kind === 'ball_handler'
            ? {
                ...assignment,
                intent: {
                  kind: 'hold' as const,
                },
              }
            : assignment
        ),
      ),
    };

    expect(() => selectThrowPlanForCoverage(
      createDefenseContext(
        match,
        { regulationInnings: 9 },
      ),
      noHandler,
      candidates,
    )).toThrow(
      'coverage throw planning requires exactly one ball handler',
    );
  });
});
