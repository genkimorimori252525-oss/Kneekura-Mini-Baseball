import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
  recordCountedPitch,
} from '../plateAppearance/CanonicalPlateAppearanceTimeline';
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
  createCatcherLedCommandedPitch,
} from './CatcherLeadCommandAdapter';
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
  playId: 8,
});

const managerSession =
  createPlateAppearanceCommandSession({
    playId: 8,
    batterRunnerId: 'batter-1',
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
          approach: 'balanced',
          swingBias: 'neutral',
        },
        runners: {
          posture: 'balanced',
        },
      }),
  });

const catcherLead: CatcherLeadProfile = {
  catcherId: 'catcher-1',
  pitcherId: 'pitcher-1',
  pitchSkillWeights: {
    'skill-fast': 2,
    'skill-break': 4,
  },
  defaultPitchSkillWeight: 1,
  attackZoneWeights: {
    inside: 1,
    middle: 1,
    outside: 1,
  },
  verticalPlanWeights: {
    low: 1,
    middle: 1,
    high: 1,
  },
  aggressionWeights: {
    challenge: 1,
    balanced: 2,
    waste: 1,
  },
  managerDirectiveMultiplier: 20,
  repeatPitchSkillMultiplier: 0.6,
  repeatAttackZoneMultiplier: 0.7,
  repeatVerticalPlanMultiplier: 0.7,
  countAdjustments: [
    {
      strikes: 2,
      pitchSkillMultipliers: {
        'skill-break': 5,
      },
      aggressionMultipliers: {
        waste: 3,
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
    y: 1.8,
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
    challengeHorizontalZoneFraction: 0.4,
    balancedHorizontalZoneFraction: 0.7,
    wasteHorizontalZoneFraction: 1.2,
    lowVerticalZoneFraction: 0.2,
    middleVerticalZoneFraction: 0.5,
    highVerticalZoneFraction: 0.8,
  },
  batterCalibration: {
    balancedSwingProbability: 0,
    aggressiveSwingProbability: 1,
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

describe('catcher lead command adapter', () => {
  it('uses canonical count and catcher call to derive one pitch while preserving manager macro command', () => {
    let timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );
    timeline = recordCountedPitch(
      timeline,
      950_000,
      {
        kind: 'called_strike',
      },
    );
    timeline = recordCountedPitch(
      timeline,
      960_000,
      {
        kind: 'called_strike',
      },
    );

    const result =
      createCatcherLedCommandedPitch({
        managerSession,
        timeline,
        catcherLead,
        environment: environment(2),
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
        ],
      });

    expect(result.call.count)
      .toEqual({
        balls: 0,
        strikes: 2,
      });
    expect(
      managerSession.command.pitcher,
    ).toEqual({
      attackZone: 'outside',
      verticalPlan: 'low',
      aggression: 'balanced',
    });
    expect(
      result.perPitchSession.command.pitcher,
    ).toEqual({
      attackZone:
        result.call.attackZone,
      verticalPlan:
        result.call.verticalPlan,
      aggression:
        result.call.aggression,
    });
    expect(result.commanded.pitchOrdinal)
      .toBe(2);
  });

  it('carries catcher-selected pitchSkillId beside the existing commanded pitch input', () => {
    const timeline =
      createCanonicalPlateAppearanceTimeline(
        match(),
        900_000,
      );

    const result =
      createCatcherLedCommandedPitch({
        managerSession,
        timeline,
        catcherLead,
        environment: environment(0),
        availablePitchSkillIds: [
          'skill-break',
        ],
      });

    expect(result.call.pitchSkillId)
      .toBe('skill-break');
    expect(result.commanded.input)
      .toBeDefined();
  });

  it('refuses catcher calling after the plate appearance is no longer active', () => {
    let timeline =
      createCanonicalPlateAppearanceTimeline(
        {
          ...match(),
          balls: 3,
        },
        900_000,
      );
    timeline = recordCountedPitch(
      timeline,
      950_000,
      {
        kind: 'ball',
      },
    );

    expect(() =>
      createCatcherLedCommandedPitch({
        managerSession,
        timeline,
        catcherLead,
        environment: environment(1),
        availablePitchSkillIds: [
          'skill-fast',
        ],
      }),
    ).toThrow(
      'catcher lead requires an active plate appearance timeline',
    );
  });
});
