import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import type { OfficialStateApplicationReceipt } from '../../adjudication/NextPlayActivation';
import { resolveOfficialGameBoundary } from './OfficialGameCompletion';

const prior = (half: 'top' | 'bottom', away: number, home: number): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('fixture-rules'), inning: 9, half, outs: 2,
  balls: 0, strikes: 0, bases: { first: null, second: null, third: null },
  score: { away, home }, playId: 8,
});
const receipt = (appliedMatchState: CanonicalMatchState): OfficialStateApplicationReceipt => ({
  applicationId: 'application-9', closureId: 'closure-9', previousPlayId: 8,
  durableRevision: 9, appliedMatchState,
});
const lineScore = (away: number, home: number, homeNinth: number | null) => ({
  innings: Array.from({ length: 9 }, (_, index) => ({
    inning: index + 1,
    awayRuns: index === 0 ? away : 0,
    homeRuns: index === 0 ? home : index === 8 ? homeNinth : 0,
  })),
  totals: {
    away: { runs: away, hits: 5, errors: 0 },
    home: { runs: home + (homeNinth ?? 0), hits: 6, errors: 1 },
  },
});
const base = {
  gameId: 'game-9', seasonId: 'season-1', homeClubId: 'home', awayClubId: 'away',
  policy: { version: 'game-rules-v1', minimumInnings: 9, maximumInnings: 12, tiesAllowed: true },
};

describe('official game completion', () => {
  it('ends after the visiting ninth when home already leads and no bottom is played', () => {
    const before = prior('top', 2, 3);
    const after = { ...before, inning: 9, half: 'bottom' as const, outs: 0, playId: 9 };
    const boundary = resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after),
      lineScore: lineScore(2, 3, null),
    });
    expect(boundary.kind).toBe('GAME_FINAL');
    if (boundary.kind !== 'GAME_FINAL') return;
    expect(boundary.result).toMatchObject({
      gameId: 'game-9', winnerClubId: 'home', completionReason: 'HOME_LEADS_AFTER_TOP',
      homeRuns: 3, awayRuns: 2, closureId: 'closure-9', durableRevision: 9,
    });
  });

  it('ends immediately on a durable bottom-ninth walkoff score', () => {
    const before = prior('bottom', 2, 2);
    const after = { ...before, outs: 2, score: { away: 2, home: 3 }, playId: 9 };
    const boundary = resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after),
      lineScore: lineScore(2, 2, 1),
    });
    expect(boundary.kind).toBe('GAME_FINAL');
    if (boundary.kind !== 'GAME_FINAL') return;
    expect(boundary.result.completionReason).toBe('WALK_OFF');
    expect(boundary.result.winnerClubId).toBe('home');
  });

  it('continues when home trails after the visiting ninth', () => {
    const before = prior('top', 3, 2);
    const after = { ...before, inning: 9, half: 'bottom' as const, outs: 0, playId: 9 };
    expect(resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after),
      lineScore: lineScore(3, 2, null),
    })).toMatchObject({ kind: 'GAME_CONTINUES' });
  });

  it('rejects a score credited to the fielding team and a missing played bottom half', () => {
    const top = prior('top', 2, 2);
    const invalidTop = { ...top, inning: 9, half: 'bottom' as const, outs: 0,
      score: { away: 2, home: 3 }, playId: 9 };
    expect(() => resolveOfficialGameBoundary({
      ...base, priorMatch: top, application: receipt(invalidTop),
      lineScore: lineScore(2, 2, 1),
    })).toThrow('fielding team');

    const bottom = prior('bottom', 3, 2);
    const after = { ...bottom, inning: 10, half: 'top' as const, outs: 0, playId: 9 };
    expect(() => resolveOfficialGameBoundary({
      ...base, priorMatch: bottom, application: receipt(after),
      lineScore: lineScore(3, 2, null),
    })).toThrow('played bottom half');
  });

  it('finishes a completed bottom ninth or a permitted tied inning limit', () => {
    const before = prior('bottom', 3, 2);
    const after = { ...before, inning: 10, half: 'top' as const, outs: 0,
      score: { away: 3, home: 2 }, playId: 9 };
    const normal = resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after),
      lineScore: lineScore(3, 2, 0),
    });
    expect(normal).toMatchObject({ kind: 'GAME_FINAL',
      result: { winnerClubId: 'away', completionReason: 'BOTTOM_COMPLETE' } });

    const tiedBefore = prior('bottom', 2, 2);
    const tiedAfter = { ...after, score: { away: 2, home: 2 } };
    const tied = resolveOfficialGameBoundary({
      ...base, policy: { ...base.policy, maximumInnings: 9 },
      priorMatch: tiedBefore, application: receipt(tiedAfter),
      lineScore: lineScore(2, 2, 0),
    });
    expect(tied).toMatchObject({ kind: 'GAME_FINAL',
      result: { winnerClubId: null, completionReason: 'TIE_LIMIT' } });
  });

  it('rejects a null run count for a played top half', () => {
    const before = prior('top', 2, 3);
    const after = { ...before, half: 'bottom' as const, outs: 0, playId: 9 };
    const score = lineScore(2, 3, null);
    const invalid = { ...score, innings: score.innings.map((inning) =>
      inning.inning === 9 ? { ...inning, awayRuns: null } : inning) };
    expect(() => resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after), lineScore: invalid,
    })).toThrow('played top');
  });

  it('accepts future empty inning slots but rejects future scoring', () => {
    const before = prior('top', 2, 3);
    const after = { ...before, half: 'bottom' as const, outs: 0, playId: 9 };
    const score = lineScore(2, 3, null);
    const future = { ...score, innings: [...score.innings,
      { inning: 10, awayRuns: null, homeRuns: null }] };
    const boundary = resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after), lineScore: future,
    });
    expect(boundary.kind).toBe('GAME_FINAL');
    if (boundary.kind === 'GAME_FINAL') expect(boundary.result.lineScore.innings).toHaveLength(9);
    expect(() => resolveOfficialGameBoundary({
      ...base, priorMatch: before, application: receipt(after),
      lineScore: { ...future, innings: future.innings.map((inning) =>
        inning.inning === 10 ? { ...inning, awayRuns: 0 } : inning) },
    })).toThrow('future inning');
  });
});
