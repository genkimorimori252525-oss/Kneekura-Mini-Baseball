import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  validatePlateAppearanceCommandContext,
} from './PlateAppearanceCommandValidation';

const match = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 9,
  half: 'top' as const,
  outs: 1,
  balls: 3,
  strikes: 2,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 2,
    home: 2,
  },
  playId: 42,
};

describe('PlateAppearanceCommandValidation', () => {
  it('explains a take approach with two strikes as a risk rather than forbidding it', () => {
    const result = validatePlateAppearanceCommandContext(
      match,
      createPlateAppearanceCommand({
        pitcher: {
          attackZone: 'middle',
          verticalPlan: 'middle',
          aggression: 'balanced',
        },
        batter: {
          approach: 'take',
          swingBias: 'neutral',
        },
        runners: {
          posture: 'balanced',
        },
      }),
    );

    expect(result.issues).toContainEqual({
      code: 'take_with_two_strikes',
      severity: 'warning',
      message:
        'take approach with two strikes can end the plate appearance on a called strike',
    });
    expect(result.executable).toBe(true);
  });

  it('explains waste pitching with three balls as walk risk', () => {
    const result = validatePlateAppearanceCommandContext(
      match,
      createPlateAppearanceCommand({
        pitcher: {
          attackZone: 'outside',
          verticalPlan: 'low',
          aggression: 'waste',
        },
        batter: {
          approach: 'balanced',
          swingBias: 'neutral',
        },
        runners: {
          posture: 'balanced',
        },
      }),
    );

    expect(result.issues).toContainEqual({
      code: 'waste_with_three_balls',
      severity: 'warning',
      message:
        'waste pitching with three balls increases the risk of an immediate walk',
    });
  });

  it('explains non-balanced runner posture as no-effect when no baserunners exist', () => {
    const result = validatePlateAppearanceCommandContext(
      match,
      createPlateAppearanceCommand({
        pitcher: {
          attackZone: 'middle',
          verticalPlan: 'middle',
          aggression: 'balanced',
        },
        batter: {
          approach: 'balanced',
          swingBias: 'neutral',
        },
        runners: {
          posture: 'aggressive',
        },
      }),
    );

    expect(result.issues).toContainEqual({
      code: 'runner_posture_without_baserunner',
      severity: 'no_effect',
      message:
        'runner posture has no current baserunner to influence',
    });
  });

  it('returns no issues for an ordinary executable command', () => {
    const result = validatePlateAppearanceCommandContext(
      {
        ...match,
        balls: 1,
        strikes: 1,
        bases: {
          first: 'runner-1',
          second: null,
          third: null,
        },
      },
      createPlateAppearanceCommand({
        pitcher: {
          attackZone: 'outside',
          verticalPlan: 'low',
          aggression: 'balanced',
        },
        batter: {
          approach: 'balanced',
          swingBias: 'neutral',
        },
        runners: {
          posture: 'balanced',
        },
      }),
    );

    expect(result).toEqual({
      executable: true,
      issues: [],
    });
  });
});
