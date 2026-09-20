import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createPlateAppearanceCommand,
} from '../plateAppearance/PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import type {
  CommandPitchEnvironment,
} from '../plateAppearance/PlateAppearanceCommandPitchAdapter';
import {
  resolveCatcherLedPlateAppearanceSequence,
} from './CatcherLedPlateAppearanceSequence';
import type {
  CatcherLeadProfile,
} from './CatcherLead';

const match = (): CanonicalMatchState => ({
  ruleProfileId:
    asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
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
});

const managerSession =
  createPlateAppearanceCommandSession({
    playId: 31,
    batterRunnerId: 'batter-31',
    acceptedAtTick: 900_000,
    matchSeed: 20260921,
    command:
      createPlateAppearanceCommand({
        pitcher: {
          attackZone: 'outside',
          verticalPlan: 'low',
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
  });

const catcherLead:
  CatcherLeadProfile = {
    catcherId: 'catcher-1',
    pitcherId: 'pitcher-1',
    pitchSkillWeights: {
      'skill-fast': 4,
      'skill-break': 3,
      'skill-split': 2,
    },
    defaultPitchSkillWeight: 1,
    attackZoneWeights: {
      inside: 1,
      middle: 1,
      outside: 1,
    },
    verticalPlanWeights: {
      low: 2,
      middle: 1,
      high: 1,
    },
    aggressionWeights: {
      challenge: 1,
      balanced: 3,
      waste: 1,
    },
    managerDirectiveMultiplier: 3,
    repeatPitchSkillMultiplier: 0.25,
    repeatAttackZoneMultiplier: 0.5,
    repeatVerticalPlanMultiplier: 0.5,
    countAdjustments: [
      {
        strikes: 2,
        pitchSkillMultipliers: {
          'skill-break': 5,
          'skill-split': 5,
        },
      },
    ],
  };

const environment = (
  pitchOrdinal: number,
): CommandPitchEnvironment => ({
  pitchStartTick:
    1_000_000
    + pitchOrdinal * 600_000,
  pitchOrdinal,
  ticksPerSecond: 1_000_000,
  pitchDurationTicks: 500_000,
  releasePosition: {
    x: 0,
    y: 1.0,
    z: 10,
  },
  acceleration: {
    x: 0,
    y: 0,
    z: 0,
  },
  plateZ: 0,
  strikeZone: {
    centerX: 0,
    halfWidth: 0.2159,
    lowerY: 0.5,
    upperY: 1.5,
  },
  ballRadiusMeters: 0.0366,
  insideXDirection: -1,
  targetCalibration: {
    challengeHorizontalZoneFraction:
      0.3,
    balancedHorizontalZoneFraction:
      0.6,
    wasteHorizontalZoneFraction:
      1.1,
    lowVerticalZoneFraction: 0.3,
    middleVerticalZoneFraction: 0.5,
    highVerticalZoneFraction: 0.7,
  },
  batterCalibration: {
    balancedSwingProbability: 0,
    aggressiveSwingProbability: 0,
    earlyTimingOffsetTicks: -20_000,
    lateTimingOffsetTicks: 20_000,
    swingWindowHalfWidthTicks: 40_000,
  },
  swingStateAtWindowStart: {
    pose: {
      grip: {
        x: -0.42,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.42,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
    angularVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
});

describe('catcher-led plate appearance sequence', () => {
  it('keeps one manager macro instruction while catcher produces the pitch-by-pitch sequence', () => {
    const result =
      resolveCatcherLedPlateAppearanceSequence({
        match: match(),
        managerSession,
        catcherLead,
        startedAtTick: 900_000,
        environments: [
          environment(0),
          environment(1),
          environment(2),
        ],
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });

    expect(
      managerSession.command.pitcher,
    ).toEqual({
      attackZone: 'outside',
      verticalPlan: 'low',
      aggression: 'balanced',
    });
    expect(result.catcherCalls.length)
      .toBe(result.pitchesGenerated);
    expect(
      result.catcherCalls.every(
        (call) =>
          call.managerDirective
            .attackZone === 'outside',
      ),
    ).toBe(true);
  });

  it('uses the evolving canonical count on each catcher call', () => {
    const result =
      resolveCatcherLedPlateAppearanceSequence({
        match: match(),
        managerSession,
        catcherLead,
        startedAtTick: 900_000,
        environments: [
          environment(0),
          environment(1),
          environment(2),
        ],
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });

    expect(result.catcherCalls[0]!.count)
      .toEqual({
        balls: 0,
        strikes: 0,
      });
    if (
      result.catcherCalls.length > 1
    ) {
      expect(
        result.catcherCalls[1]!.count,
      ).not.toEqual(
        result.catcherCalls[0]!.count,
      );
    }
  });

  it('is deterministic for the same game state, catcher, pitcher and manager intent', () => {
    const input = {
      match: match(),
      managerSession,
      catcherLead,
      startedAtTick: 900_000,
      environments: [
        environment(0),
        environment(1),
        environment(2),
      ],
      availablePitchSkillIds: [
        'skill-fast',
        'skill-break',
        'skill-split',
      ],
    } as const;

    expect(
      resolveCatcherLedPlateAppearanceSequence(
        input,
      ),
    ).toEqual(
      resolveCatcherLedPlateAppearanceSequence(
        input,
      ),
    );
  });
});
