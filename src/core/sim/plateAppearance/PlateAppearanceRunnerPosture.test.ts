import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  applyPlateAppearanceRunnerPosture,
} from './PlateAppearanceRunnerPosture';

const basePolicy = {
  battingTeam: 'away' as const,
  battingRuns: 2,
  defendingRuns: 2,
  runDifferentialForOffense: 0,
  lateInning: false,
  minimumAdvanceSafetyMarginTicks: 60_000,
};

const calibration = {
  conservativeAdjustmentTicks: 25_000,
  aggressiveAdjustmentTicks: -25_000,
  minimumAdvanceSafetyMarginTicks: 0,
  maximumAdvanceSafetyMarginTicks: 120_000,
} as const;

const command = (
  posture: 'conservative' | 'balanced' | 'aggressive',
) => createPlateAppearanceCommand({
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
    posture,
  },
});

describe('PlateAppearanceRunnerPosture', () => {
  it('keeps balanced posture at the P6 game-state margin', () => {
    expect(applyPlateAppearanceRunnerPosture(
      basePolicy,
      command('balanced'),
      calibration,
    ).minimumAdvanceSafetyMarginTicks)
      .toBe(60_000);
  });

  it('makes conservative posture require more perceived safety margin', () => {
    expect(applyPlateAppearanceRunnerPosture(
      basePolicy,
      command('conservative'),
      calibration,
    ).minimumAdvanceSafetyMarginTicks)
      .toBe(85_000);
  });

  it('makes aggressive posture require less perceived safety margin without changing any speed parameter', () => {
    expect(applyPlateAppearanceRunnerPosture(
      basePolicy,
      command('aggressive'),
      calibration,
    )).toEqual({
      ...basePolicy,
      minimumAdvanceSafetyMarginTicks: 35_000,
    });
  });

  it('clamps posture adjustment to explicit bounds', () => {
    expect(applyPlateAppearanceRunnerPosture(
      {
        ...basePolicy,
        minimumAdvanceSafetyMarginTicks: 10_000,
      },
      command('aggressive'),
      calibration,
    ).minimumAdvanceSafetyMarginTicks)
      .toBe(0);
  });
});
