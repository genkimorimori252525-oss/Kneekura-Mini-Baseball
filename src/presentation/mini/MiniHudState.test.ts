import { describe, expect, it } from 'vitest';
import {
  asRuleProfileId,
} from '../../core/model/RuleProfileRef';
import type {
  CanonicalMatchState,
} from '../../core/model/CanonicalMatchState';
import {
  createCanonicalLineScoreSnapshot,
} from '../../core/model/CanonicalLineScoreSnapshot';
import {
  buildMiniHudState,
} from './MiniHudState';


const lineScore = createCanonicalLineScoreSnapshot({
  innings: [
    { inning: 1, awayRuns: 1, homeRuns: 0 },
    { inning: 2, awayRuns: 0, homeRuns: 1 },
    { inning: 3, awayRuns: 2, homeRuns: 0 },
    { inning: 4, awayRuns: 0, homeRuns: 2 },
    { inning: 5, awayRuns: 1, homeRuns: 0 },
    { inning: 6, awayRuns: 0, homeRuns: 1 },
    { inning: 7, awayRuns: 0, homeRuns: 1 },
  ],
  totals: {
    away: { runs: 4, hits: 8, errors: 1 },
    home: { runs: 5, hits: 9, errors: 0 },
  },
});

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 7,
  half: 'bottom',
  outs: 2,
  balls: 3,
  strikes: 2,
  bases: {
    first: 'r1',
    second: null,
    third: 'r3',
  },
  score: {
    away: 4,
    home: 5,
  },
  playId: 88,
};

describe('MiniHudState', () => {
  it('projects canonical inning, count, outs, score, and base occupancy without reinterpretation', () => {
    expect(buildMiniHudState(match)).toEqual({
      inning: 7,
      half: 'bottom',
      offense: 'home',
      defense: 'away',
      count: {
        balls: 3,
        strikes: 2,
        outs: 2,
      },
      bases: {
        first: {
          occupied: true,
          runnerId: 'r1',
        },
        second: {
          occupied: false,
          runnerId: null,
        },
        third: {
          occupied: true,
          runnerId: 'r3',
        },
      },
      score: {
        away: 4,
        home: 5,
      },
      playId: 88,
    });
  });

  it('projects authoritative nine-inning R/H/E state without inventing missing innings', () => {
    const hud = buildMiniHudState(
      match,
      lineScore,
    );

    expect(hud.lineScore?.innings).toHaveLength(9);
    expect(hud.lineScore?.innings[6]).toEqual({
      inning: 7,
      awayRuns: 0,
      homeRuns: 1,
    });
    expect(hud.lineScore?.innings[8]).toEqual({
      inning: 9,
      awayRuns: null,
      homeRuns: null,
    });
    expect(hud.lineScore?.totals).toEqual({
      away: { runs: 4, hits: 8, errors: 1 },
      home: { runs: 5, hits: 9, errors: 0 },
    });
  });

  it('rejects line-score run totals that disagree with CanonicalMatchState.score', () => {
    const mismatch = createCanonicalLineScoreSnapshot({
      innings: [
        { inning: 1, awayRuns: 3, homeRuns: 5 },
      ],
      totals: {
        away: { runs: 3, hits: 8, errors: 1 },
        home: { runs: 5, hits: 9, errors: 0 },
      },
    });

    expect(() => buildMiniHudState(
      match,
      mismatch,
    )).toThrow(
      'line-score run totals must match CanonicalMatchState.score',
    );
  });

  it('does not mutate CanonicalMatchState', () => {
    const before = structuredClone(match);

    buildMiniHudState(match);

    expect(match).toEqual(before);
  });

  it('keeps base-marker identity instead of reducing occupancy to anonymous booleans', () => {
    const hud = buildMiniHudState(match);

    expect(hud.bases.first.runnerId).toBe('r1');
    expect(hud.bases.third.runnerId).toBe('r3');
  });
});
