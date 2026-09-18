import { describe, expect, it } from 'vitest';
import {
  createPlateAppearanceCommand,
} from './PlateAppearanceCommand';
import {
  createPlateAppearanceCommandSession,
  assertCommandSessionCanDriveTimeline,
} from './PlateAppearanceCommandSession';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
  recordCountedPitch,
} from './CanonicalPlateAppearanceTimeline';

const command = createPlateAppearanceCommand({
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
});

const match = {
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
  playId: 17,
};

describe('PlateAppearanceCommandSession', () => {
  it('binds one command to one play and batter', () => {
    expect(createPlateAppearanceCommandSession({
      playId: 17,
      batterRunnerId: 'batter-17',
      acceptedAtTick: 1_000_000,
      matchSeed: 12345,
      command,
    })).toEqual({
      playId: 17,
      batterRunnerId: 'batter-17',
      acceptedAtTick: 1_000_000,
      matchSeed: 12345,
      command,
    });
  });

  it('accepts the same session while its canonical timeline is active', () => {
    const session = createPlateAppearanceCommandSession({
      playId: 17,
      batterRunnerId: 'batter-17',
      acceptedAtTick: 1_000_000,
      matchSeed: 12345,
      command,
    });
    const timeline = createCanonicalPlateAppearanceTimeline(
      match,
      1_000_000,
    );

    expect(() => assertCommandSessionCanDriveTimeline(
      session,
      timeline,
    )).not.toThrow();
  });

  it('rejects use against another playId', () => {
    const session = createPlateAppearanceCommandSession({
      playId: 18,
      batterRunnerId: 'batter-17',
      acceptedAtTick: 1_000_000,
      matchSeed: 12345,
      command,
    });
    const timeline = createCanonicalPlateAppearanceTimeline(
      match,
      1_000_000,
    );

    expect(() => assertCommandSessionCanDriveTimeline(
      session,
      timeline,
    )).toThrow(
      'command session playId must match the canonical plate appearance',
    );
  });

  it('rejects generation after the plate appearance has become terminal', () => {
    const session = createPlateAppearanceCommandSession({
      playId: 17,
      batterRunnerId: 'batter-17',
      acceptedAtTick: 1_000_000,
      matchSeed: 12345,
      command,
    });

    let timeline = createCanonicalPlateAppearanceTimeline(
      {
        ...match,
        strikes: 2,
      },
      1_000_000,
    );
    timeline = recordCountedPitch(
      timeline,
      1_100_000,
      { kind: 'called_strike' },
    );

    expect(timeline.status.kind).toBe('strikeout');
    expect(() => assertCommandSessionCanDriveTimeline(
      session,
      timeline,
    )).toThrow(
      'command session cannot generate another pitch after the plate appearance stopped accepting pitches',
    );
  });
});
