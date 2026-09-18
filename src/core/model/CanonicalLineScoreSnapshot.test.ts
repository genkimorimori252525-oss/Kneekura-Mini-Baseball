import { describe, expect, it } from 'vitest';
import {
  createCanonicalLineScoreSnapshot,
} from './CanonicalLineScoreSnapshot';

describe('CanonicalLineScoreSnapshot', () => {
  it('validates authoritative inning runs and R/H/E totals without deriving hits or errors', () => {
    expect(createCanonicalLineScoreSnapshot({
      innings: [
        { inning: 1, awayRuns: 1, homeRuns: 0 },
        { inning: 2, awayRuns: 0, homeRuns: 2 },
        { inning: 3, awayRuns: 0, homeRuns: 0 },
        { inning: 4, awayRuns: null, homeRuns: null },
      ],
      totals: {
        away: { runs: 1, hits: 4, errors: 0 },
        home: { runs: 2, hits: 5, errors: 1 },
      },
    })).toEqual({
      innings: [
        { inning: 1, awayRuns: 1, homeRuns: 0 },
        { inning: 2, awayRuns: 0, homeRuns: 2 },
        { inning: 3, awayRuns: 0, homeRuns: 0 },
        { inning: 4, awayRuns: null, homeRuns: null },
      ],
      totals: {
        away: { runs: 1, hits: 4, errors: 0 },
        home: { runs: 2, hits: 5, errors: 1 },
      },
    });
  });

  it('rejects total runs that disagree with recorded inning runs', () => {
    expect(() => createCanonicalLineScoreSnapshot({
      innings: [
        { inning: 1, awayRuns: 1, homeRuns: 0 },
      ],
      totals: {
        away: { runs: 2, hits: 4, errors: 0 },
        home: { runs: 0, hits: 3, errors: 0 },
      },
    })).toThrow(
      'line-score total runs must equal the sum of recorded inning runs',
    );
  });

  it('requires sequential inning slots beginning at one', () => {
    expect(() => createCanonicalLineScoreSnapshot({
      innings: [
        { inning: 2, awayRuns: 0, homeRuns: 0 },
      ],
      totals: {
        away: { runs: 0, hits: 0, errors: 0 },
        home: { runs: 0, hits: 0, errors: 0 },
      },
    })).toThrow(
      'line-score innings must be sequential starting at 1',
    );
  });

  it('does not invent H/E from score data', () => {
    const snapshot = createCanonicalLineScoreSnapshot({
      innings: [
        { inning: 1, awayRuns: 0, homeRuns: 0 },
      ],
      totals: {
        away: { runs: 0, hits: 7, errors: 2 },
        home: { runs: 0, hits: 1, errors: 0 },
      },
    });

    expect(snapshot.totals.away.hits).toBe(7);
    expect(snapshot.totals.away.errors).toBe(2);
  });
});
