import { describe, expect, it } from 'vitest';
import {
  normalizeInningInfieldSideLockViolation,
  normalizePitchReleaseInfieldSideViolation,
} from './DefensiveAlignmentViolation';
import type {
  PitchReleaseInfieldSideResult,
} from './PitchReleaseInfieldSideRule';
import type {
  InningInfieldSideLockResult,
} from './InningInfieldSideAssignment';

const raw = (
  overrides: Partial<PitchReleaseInfieldSideResult> = {},
): PitchReleaseInfieldSideResult => ({
  kind: 'legal',
  pitchReleaseTick: 2_000_000,
  firstBaseSideCount: 2,
  thirdBaseSideCount: 2,
  invalidInfielders: [],
  placements: [
    { playerId: '1b', registeredPosition: '1B', side: 'first_base_side' },
    { playerId: '2b', registeredPosition: '2B', side: 'first_base_side' },
    { playerId: 'ss', registeredPosition: 'SS', side: 'third_base_side' },
    { playerId: '3b', registeredPosition: '3B', side: 'third_base_side' },
  ],
  ...overrides,
});

describe('DefensiveAlignmentViolation', () => {
  it('preserves a legal raw alignment as no violation', () => {
    expect(normalizePitchReleaseInfieldSideViolation(raw())).toEqual({
      kind: 'no_violation',
    });
  });

  it('keeps a raw 3+1 violation team-only instead of inventing the offending infielder', () => {
    expect(normalizePitchReleaseInfieldSideViolation(raw({
      kind: 'violation',
      firstBaseSideCount: 3,
      thirdBaseSideCount: 1,
      placements: [
        { playerId: '1b', registeredPosition: '1B', side: 'first_base_side' },
        { playerId: '2b', registeredPosition: '2B', side: 'first_base_side' },
        { playerId: 'ss', registeredPosition: 'SS', side: 'first_base_side' },
        { playerId: '3b', registeredPosition: '3B', side: 'third_base_side' },
      ],
    }))).toEqual({
      kind: 'violation',
      identity: 'team_only',
      violatingPlayerIds: [],
    });
  });

  it('identifies a sole straddling infielder when fixing that placement would restore 2+2', () => {
    expect(normalizePitchReleaseInfieldSideViolation(raw({
      kind: 'violation',
      firstBaseSideCount: 2,
      thirdBaseSideCount: 1,
      invalidInfielders: ['ss'],
      placements: [
        { playerId: '1b', registeredPosition: '1B', side: 'first_base_side' },
        { playerId: '2b', registeredPosition: '2B', side: 'first_base_side' },
        { playerId: 'ss', registeredPosition: 'SS', side: 'straddling_or_on_division' },
        { playerId: '3b', registeredPosition: '3B', side: 'third_base_side' },
      ],
    }))).toEqual({
      kind: 'violation',
      identity: 'concrete_players',
      violatingPlayerIds: ['ss'],
    });
  });

  it('does not claim complete identity when a straddler coexists with a separate 3+ side imbalance', () => {
    expect(normalizePitchReleaseInfieldSideViolation(raw({
      kind: 'violation',
      firstBaseSideCount: 3,
      thirdBaseSideCount: 0,
      invalidInfielders: ['3b'],
      placements: [
        { playerId: '1b', registeredPosition: '1B', side: 'first_base_side' },
        { playerId: '2b', registeredPosition: '2B', side: 'first_base_side' },
        { playerId: 'ss', registeredPosition: 'SS', side: 'first_base_side' },
        { playerId: '3b', registeredPosition: '3B', side: 'straddling_or_on_division' },
      ],
    }))).toEqual({
      kind: 'violation',
      identity: 'team_only',
      violatingPlayerIds: [],
    });
  });

  it('preserves concrete moved/invalid player identity from the inning side lock', () => {
    const lock: InningInfieldSideLockResult = {
      kind: 'violation',
      movedPlayers: ['2b', 'ss'],
      invalidPlayers: [],
    };

    expect(normalizeInningInfieldSideLockViolation(lock)).toEqual({
      kind: 'violation',
      identity: 'concrete_players',
      violatingPlayerIds: ['2b', 'ss'],
    });
  });

  it('refuses to normalize an unsupported participant change as a rules violation', () => {
    expect(() => normalizeInningInfieldSideLockViolation({
      kind: 'unsupported_participant_change',
      expectedPlayerIds: ['1b', '2b', 'ss', '3b'],
      currentPlayerIds: ['1b', 'new-2b', 'ss', '3b'],
    })).toThrow(
      'cannot normalize unsupported participant change as an alignment violation',
    );
  });
});
