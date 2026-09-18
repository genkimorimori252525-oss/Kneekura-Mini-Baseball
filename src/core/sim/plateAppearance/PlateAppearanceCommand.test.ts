import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';

describe('PlateAppearanceCommand', () => {
  it('creates a validated one-plate-appearance command', () => {
    expect(createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'outside',
        verticalPlan: 'low',
        aggression: 'balanced',
      },
      batter: {
        approach: 'aggressive',
        swingBias: 'early',
      },
      runners: {
        posture: 'balanced',
      },
    })).toEqual({
      pitcher: {
        attackZone: 'outside',
        verticalPlan: 'low',
        aggression: 'balanced',
      },
      batter: {
        approach: 'aggressive',
        swingBias: 'early',
      },
      runners: {
        posture: 'balanced',
      },
    });
  });

  it('rejects unknown command values instead of silently coercing them', () => {
    expect(() => createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'center' as 'inside',
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
    })).toThrow(
      'pitcher.attackZone must be inside, middle, or outside',
    );
  });
});
