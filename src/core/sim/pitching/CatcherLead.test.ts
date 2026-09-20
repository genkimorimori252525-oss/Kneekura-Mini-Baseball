import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from '../plateAppearance/PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';
import {
  createCatcherPitchCall,
  type CatcherLeadProfile,
} from './CatcherLead';

const session = (
  attackZone:
    'inside' | 'middle' | 'outside' =
      'inside',
) =>
  createPlateAppearanceCommandSession({
    playId: 4,
    batterRunnerId: 'batter-1',
    acceptedAtTick: 900_000,
    matchSeed: 20260921,
    command:
      createPlateAppearanceCommand({
        pitcher: {
          attackZone,
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

const profile = (
  managerDirectiveMultiplier = 1,
): CatcherLeadProfile => ({
  catcherId: 'catcher-2',
  pitcherId: 'pitcher-7',
  pitchSkillWeights: {
    'skill-fast': 4,
    'skill-break': 2,
    'skill-split': 1,
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
  managerDirectiveMultiplier,
  repeatPitchSkillMultiplier: 0.4,
  repeatAttackZoneMultiplier: 0.7,
  repeatVerticalPlanMultiplier: 0.7,
  countAdjustments: [
    {
      balls: 0,
      strikes: 2,
      pitchSkillMultipliers: {
        'skill-break': 4,
        'skill-split': 3,
      },
      aggressionMultipliers: {
        waste: 2,
      },
    },
  ],
});

describe('catcher lead', () => {
  it('is deterministic for the same battery, count, and pitch ordinal', () => {
    const input = {
      session: session(),
      profile: profile(2),
      count: {
        balls: 1,
        strikes: 1,
      } as const,
      pitchOrdinal: 2,
      availablePitchSkillIds: [
        'skill-fast',
        'skill-break',
        'skill-split',
      ],
    };

    expect(
      createCatcherPitchCall(input),
    ).toEqual(
      createCatcherPitchCall(input),
    );
  });

  it('chooses only from stable available pitchSkillIds rather than pitch names', () => {
    const call =
      createCatcherPitchCall({
        session: session(),
        profile: profile(),
        count: {
          balls: 0,
          strikes: 0,
        },
        pitchOrdinal: 0,
        availablePitchSkillIds: [
          'skill-break',
        ],
      });

    expect(call.pitchSkillId)
      .toBe('skill-break');
  });

  it('treats the manager instruction as a broad bias, not an exact per-pitch order', () => {
    const weakManager =
      createCatcherPitchCall({
        session: session('inside'),
        profile: profile(1),
        count: {
          balls: 1,
          strikes: 0,
        },
        pitchOrdinal: 1,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });
    const strongManager =
      createCatcherPitchCall({
        session: session('inside'),
        profile: profile(1000),
        count: {
          balls: 1,
          strikes: 0,
        },
        pitchOrdinal: 1,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });

    expect(strongManager.attackZone)
      .toBe('inside');
    expect(weakManager.pitchSkillId)
      .toBe(strongManager.pitchSkillId);
  });

  it('can change its per-pitch call from count context without changing manager command', () => {
    const neutral =
      createCatcherPitchCall({
        session: session(),
        profile: profile(),
        count: {
          balls: 0,
          strikes: 0,
        },
        pitchOrdinal: 5,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });
    const twoStrike =
      createCatcherPitchCall({
        session: session(),
        profile: profile(),
        count: {
          balls: 0,
          strikes: 2,
        },
        pitchOrdinal: 5,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });

    expect(twoStrike.managerDirective)
      .toEqual(neutral.managerDirective);
    expect(
      [
        twoStrike.pitchSkillId,
        twoStrike.aggression,
      ],
    ).not.toEqual([
      neutral.pitchSkillId,
      neutral.aggression,
    ]);
  });

  it('can use sequence memory to reduce immediate repetition', () => {
    const previous =
      createCatcherPitchCall({
        session: session(),
        profile: profile(),
        count: {
          balls: 0,
          strikes: 0,
        },
        pitchOrdinal: 0,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
      });
    const next =
      createCatcherPitchCall({
        session: session(),
        profile: {
          ...profile(),
          repeatPitchSkillMultiplier:
            0.000001,
        },
        count: {
          balls: 0,
          strikes: 0,
        },
        pitchOrdinal: 1,
        availablePitchSkillIds: [
          'skill-fast',
          'skill-break',
          'skill-split',
        ],
        previousCall: previous,
      });

    expect(next.pitchSkillId)
      .not.toBe(previous.pitchSkillId);
  });
});
