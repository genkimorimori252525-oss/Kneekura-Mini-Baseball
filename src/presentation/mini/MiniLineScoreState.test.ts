import { describe, expect, it } from 'vitest';
import {
  createCanonicalLineScoreSnapshot,
} from '../../core/model/CanonicalLineScoreSnapshot';
import {
  buildMiniLineScoreState,
} from './MiniLineScoreState';

const snapshot = createCanonicalLineScoreSnapshot({
  innings: [
    { inning: 1, awayRuns: 1, homeRuns: 0 },
    { inning: 2, awayRuns: 0, homeRuns: 2 },
    { inning: 3, awayRuns: 0, homeRuns: 0 },
    { inning: 4, awayRuns: 2, homeRuns: 0 },
    { inning: 5, awayRuns: 0, homeRuns: 1 },
  ],
  totals: {
    away: { runs: 3, hits: 7, errors: 1 },
    home: { runs: 3, hits: 6, errors: 0 },
  },
});

describe('MiniLineScoreState', () => {
  it('projects authoritative inning runs into at least nine display columns plus R/H/E totals', () => {
    const result = buildMiniLineScoreState(
      snapshot,
      {
        currentInning: 5,
        minimumInningColumns: 9,
      },
    );

    expect(result.innings).toHaveLength(9);
    expect(result.innings.slice(0, 5)).toEqual([
      { inning: 1, awayRuns: 1, homeRuns: 0 },
      { inning: 2, awayRuns: 0, homeRuns: 2 },
      { inning: 3, awayRuns: 0, homeRuns: 0 },
      { inning: 4, awayRuns: 2, homeRuns: 0 },
      { inning: 5, awayRuns: 0, homeRuns: 1 },
    ]);
    expect(result.innings[8]).toEqual({
      inning: 9,
      awayRuns: null,
      homeRuns: null,
    });
    expect(result.totals).toEqual({
      away: { runs: 3, hits: 7, errors: 1 },
      home: { runs: 3, hits: 6, errors: 0 },
    });
  });

  it('preserves extra innings instead of truncating at nine', () => {
    const extra = createCanonicalLineScoreSnapshot({
      innings: Array.from({ length: 11 }, (_, index) => ({
        inning: index + 1,
        awayRuns: index === 10 ? 1 : 0,
        homeRuns: 0,
      })),
      totals: {
        away: { runs: 1, hits: 5, errors: 0 },
        home: { runs: 0, hits: 4, errors: 0 },
      },
    });

    const result = buildMiniLineScoreState(
      extra,
      {
        currentInning: 11,
        minimumInningColumns: 9,
      },
    );

    expect(result.innings).toHaveLength(11);
    expect(result.innings[10]).toEqual({
      inning: 11,
      awayRuns: 1,
      homeRuns: 0,
    });
  });

  it('does not mutate or derive H/E from run totals', () => {
    const before = structuredClone(snapshot);

    const result = buildMiniLineScoreState(
      snapshot,
      {
        currentInning: 5,
        minimumInningColumns: 9,
      },
    );

    expect(result.totals.away.hits).toBe(7);
    expect(result.totals.away.errors).toBe(1);
    expect(snapshot).toEqual(before);
  });

  it('rejects a current inning that predates authoritative recorded slots', () => {
    expect(() => buildMiniLineScoreState(
      snapshot,
      {
        currentInning: 3,
        minimumInningColumns: 9,
      },
    )).toThrow(
      'currentInning must not precede the latest recorded line-score inning',
    );
  });
});
