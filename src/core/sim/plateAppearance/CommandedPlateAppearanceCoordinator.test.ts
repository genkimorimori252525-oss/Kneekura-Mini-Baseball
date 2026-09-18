import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from './PlateAppearanceCommandSession';
import {
  resolveCommandedPlateAppearanceToMatchState,
} from './CommandedPlateAppearanceCoordinator';

const baseMatch = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top' as const,
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 31,
};

const environment = (
  ordinal: number,
  startTick: number,
) => ({
  pitchStartTick: startTick,
  pitchOrdinal: ordinal,
  ticksPerSecond: 1_000_000,
  pitchDurationTicks: 400_000,
  releasePosition: { x: 0, y: 1.8, z: 18 },
  acceleration: { x: 0, y: -9.8, z: 0 },
  plateZ: 0,
  strikeZone: {
    centerX: 0,
    halfWidth: 0.22,
    lowerY: 0.55,
    upperY: 1.15,
  },
  ballRadiusMeters: 0.0366,
  insideXDirection: 1 as const,
  targetCalibration: {
    challengeHorizontalZoneFraction: 0.45,
    balancedHorizontalZoneFraction: 0.8,
    wasteHorizontalZoneFraction: 1.3,
    lowVerticalZoneFraction: 0.2,
    middleVerticalZoneFraction: 0.5,
    highVerticalZoneFraction: 0.8,
  },
  batterCalibration: {
    balancedSwingProbability: 0.5,
    aggressiveSwingProbability: 1,
    earlyTimingOffsetTicks: -30_000,
    lateTimingOffsetTicks: 30_000,
    swingWindowHalfWidthTicks: 70_000,
  },
  swingStateAtWindowStart: {
    pose: {
      grip: { x: -0.5, y: 1, z: 0.3 },
      tip: { x: 0.4, y: 1, z: 0.3 },
    },
    linearVelocity: { x: 0, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 12, z: 0 },
  },
});

describe('CommandedPlateAppearanceCoordinator', () => {
  it('applies a commanded three-strike sequence to CanonicalMatchState', () => {
    const command = createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'middle',
        verticalPlan: 'middle',
        aggression: 'challenge',
      },
      batter: {
        approach: 'take',
        swingBias: 'neutral',
      },
      runners: {
        posture: 'balanced',
      },
    });
    const session = createPlateAppearanceCommandSession({
      playId: 31,
      batterRunnerId: 'batter-31',
      acceptedAtTick: 1_000_000,
      matchSeed: 111,
      command,
    });

    const result =
      resolveCommandedPlateAppearanceToMatchState({
        match: baseMatch,
        session,
        startedAtTick: 1_000_000,
        environments: [
          environment(0, 1_100_000),
          environment(1, 1_700_000),
          environment(2, 2_300_000),
          environment(3, 2_900_000),
        ],
      });

    expect(result.kind).toBe('complete');
    if (result.kind !== 'complete') {
      throw new Error('fixture must strike out');
    }

    expect(result.terminalKind).toBe('strikeout');
    expect(result.pitchesGenerated).toBe(3);
    expect(result.unusedEnvironmentCount).toBe(1);
    expect(result.nextMatchState.outs).toBe(1);
    expect(result.nextMatchState.playId).toBe(32);
  });

  it('applies four commanded balls as a walk using the existing match-state adapter', () => {
    const command = createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'outside',
        verticalPlan: 'middle',
        aggression: 'waste',
      },
      batter: {
        approach: 'take',
        swingBias: 'neutral',
      },
      runners: {
        posture: 'balanced',
      },
    });
    const session = createPlateAppearanceCommandSession({
      playId: 31,
      batterRunnerId: 'batter-31',
      acceptedAtTick: 1_000_000,
      matchSeed: 222,
      command,
    });

    const result =
      resolveCommandedPlateAppearanceToMatchState({
        match: baseMatch,
        session,
        startedAtTick: 1_000_000,
        environments: [
          environment(0, 1_100_000),
          environment(1, 1_700_000),
          environment(2, 2_300_000),
          environment(3, 2_900_000),
          environment(4, 3_500_000),
        ],
      });

    expect(result.kind).toBe('complete');
    if (result.kind !== 'complete') {
      throw new Error('fixture must walk');
    }

    expect(result.terminalKind).toBe('walk');
    expect(result.pitchesGenerated).toBe(4);
    expect(result.nextMatchState.bases.first)
      .toBe('batter-31');
    expect(result.nextMatchState.playId).toBe(32);
  });

  it('returns active when the supplied autonomous schedule ends before the plate appearance', () => {
    const command = createPlateAppearanceCommand({
      pitcher: {
        attackZone: 'middle',
        verticalPlan: 'middle',
        aggression: 'challenge',
      },
      batter: {
        approach: 'take',
        swingBias: 'neutral',
      },
      runners: {
        posture: 'balanced',
      },
    });
    const session = createPlateAppearanceCommandSession({
      playId: 31,
      batterRunnerId: 'batter-31',
      acceptedAtTick: 1_000_000,
      matchSeed: 333,
      command,
    });

    const result =
      resolveCommandedPlateAppearanceToMatchState({
        match: baseMatch,
        session,
        startedAtTick: 1_000_000,
        environments: [
          environment(0, 1_100_000),
        ],
      });

    expect(result.kind).toBe('active');
    expect(result.pitchesGenerated).toBe(1);
    expect(result.matchState).toEqual(baseMatch);
  });
});
