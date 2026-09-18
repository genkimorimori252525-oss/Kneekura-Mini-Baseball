import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createCanonicalPlateAppearanceTimeline,
  recordCountedPitch,
} from './CanonicalPlateAppearanceTimeline';
import {
  applyStrikeoutPlateAppearanceToMatchState,
  applyWalkPlateAppearanceToMatchState,
} from './PlateAppearanceMatchState';

const match = (
  outs: number,
  half: 'top' | 'bottom' = 'top',
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 4,
  half,
  outs,
  balls: 0,
  strikes: 2,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 2,
    home: 1,
  },
  playId: 12,
});

const strikeoutTimeline = (
  state: CanonicalMatchState,
) => recordCountedPitch(
  createCanonicalPlateAppearanceTimeline(
    state,
    10_000_000,
  ),
  10_100_000,
  { kind: 'swinging_strike' },
);

describe('PlateAppearanceMatchState strikeout application', () => {
  it('adds one out, resets the count, preserves runners, and advances playId before the third out', () => {
    const before = match(1);
    const after = applyStrikeoutPlateAppearanceToMatchState(
      before,
      strikeoutTimeline(before),
    );

    expect(after).toEqual({
      ...before,
      outs: 2,
      balls: 0,
      strikes: 0,
      playId: 13,
    });
  });

  it('uses the P1 half-inning transition on strikeout third out', () => {
    const before = match(2, 'bottom');
    const after = applyStrikeoutPlateAppearanceToMatchState(
      before,
      strikeoutTimeline(before),
    );

    expect(after).toEqual({
      ruleProfileId: before.ruleProfileId,
      inning: 5,
      half: 'top',
      outs: 0,
      balls: 0,
      strikes: 0,
      bases: {
        first: null,
        second: null,
        third: null,
      },
      score: before.score,
      playId: 13,
    });
  });

  it('rejects a timeline from another playId', () => {
    const before = match(1);
    const other = {
      ...strikeoutTimeline(before),
      playId: before.playId + 1,
    };

    expect(() => applyStrikeoutPlateAppearanceToMatchState(
      before,
      other,
    )).toThrow(
      'plate appearance timeline playId must match CanonicalMatchState.playId',
    );
  });

  it('rejects a non-strikeout terminal state', () => {
    const before = {
      ...match(1),
      balls: 3,
      strikes: 1,
    };
    const walk = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(
        before,
        20_000_000,
      ),
      20_100_000,
      { kind: 'ball' },
    );

    expect(() => applyStrikeoutPlateAppearanceToMatchState(
      before,
      walk,
    )).toThrow(
      'strikeout match-state application requires a strikeout timeline',
    );
  });
});


describe('PlateAppearanceMatchState walk application', () => {
  it('applies a walk to bases, resets the count, and advances playId', () => {
    const before: CanonicalMatchState = {
      ...match(1),
      balls: 3,
      strikes: 1,
      bases: {
        first: 'r1',
        second: null,
        third: 'r3',
      },
    };
    const walk = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(
        before,
        30_000_000,
      ),
      30_100_000,
      { kind: 'ball' },
    );

    expect(applyWalkPlateAppearanceToMatchState(
      before,
      walk,
      'batter',
    )).toEqual({
      ...before,
      balls: 0,
      strikes: 0,
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r3',
      },
      playId: 13,
    });
  });

  it('scores the forced runner from third on a bases-loaded walk for the batting team', () => {
    const before: CanonicalMatchState = {
      ...match(2, 'bottom'),
      balls: 3,
      strikes: 2,
      bases: {
        first: 'r1',
        second: 'r2',
        third: 'r3',
      },
    };
    const walk = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(
        before,
        40_000_000,
      ),
      40_100_000,
      { kind: 'ball' },
    );

    expect(applyWalkPlateAppearanceToMatchState(
      before,
      walk,
      'batter',
    )).toEqual({
      ...before,
      balls: 0,
      strikes: 0,
      bases: {
        first: 'batter',
        second: 'r1',
        third: 'r2',
      },
      score: {
        away: 2,
        home: 2,
      },
      playId: 13,
    });
  });

  it('rejects applying a non-walk timeline as a walk', () => {
    const before = match(0);
    const active = recordCountedPitch(
      createCanonicalPlateAppearanceTimeline(
        before,
        50_000_000,
      ),
      50_100_000,
      { kind: 'ball' },
    );

    expect(() => applyWalkPlateAppearanceToMatchState(
      before,
      active,
      'batter',
    )).toThrow(
      'walk match-state application requires a walk timeline',
    );
  });
});
