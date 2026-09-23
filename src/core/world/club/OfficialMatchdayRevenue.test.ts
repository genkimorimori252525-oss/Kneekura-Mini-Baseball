import { describe, expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { resolveOfficialGameBoundary } from '../competition/OfficialGameCompletion';
import { state } from './ClubFixtures.test-support';
import { applyClubCommand } from './ClubLifecycle';
import { applyOfficialMatchdayRevenue as applyWithSources } from './OfficialMatchdayRevenue';

const officialResult = () => {
  const prior: CanonicalMatchState = {
    ruleProfileId: asRuleProfileId('fixture-rules'), inning: 9,
    half: 'top', outs: 2, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null },
    score: { away: 0, home: 1 }, playId: 8,
  };
  const boundary = resolveOfficialGameBoundary({
    gameId: 'game-1', seasonId: 'league-season-1',
    homeClubId: 'club-a', awayClubId: 'club-b',
    policy: { version: 'test-1', minimumInnings: 9, tiesAllowed: false },
    priorMatch: prior,
    application: { applicationId: 'application-9', closureId: 'closure-9',
      previousPlayId: 8, durableRevision: 9,
      appliedMatchState: { ...prior, half: 'bottom', outs: 0, playId: 9 } },
    lineScore: { innings: Array.from({ length: 9 }, (_, index) => ({
      inning: index + 1, awayRuns: 0,
      homeRuns: index === 8 ? null : index === 0 ? 1 : 0,
    })), totals: {
      away: { runs: 0, hits: 0, errors: 0 },
      home: { runs: 1, hits: 1, errors: 0 },
    } },
  });
  if (boundary.kind !== 'GAME_FINAL') throw new Error('fixture not final');
  return boundary.result;
};
const attendance = { factId: 'attendance-1', careerId: 'career-a',
  sourceEventId: 'turnstile-1',
  gameId: 'game-1', stadiumId: 'stadium-a', observedAtDay: 11,
  availableAtDay: 11, venueRevisionAtObservation: 0, count: 120 };
const policy = { version: 'matchday-1', availableAtDay: 10,
  seasonId: 'league-season-1', currency: 'SIM',
  recognizedMinorUnitsPerAttendee: 5 };
const applyOfficialMatchdayRevenue = (
  club: Parameters<typeof applyWithSources>[0],
  result: Parameters<typeof applyWithSources>[1],
  fact: Parameters<typeof applyWithSources>[2],
  rules: Parameters<typeof applyWithSources>[3],
  history: Parameters<typeof applyWithSources>[4] = {
    checkpoint: club, acceptedEvents: [],
  }, finalizedAtDay = 11,
) => applyWithSources(club, result, fact, rules,
  history, finalizedAtDay);

describe('automatic official matchday revenue', () => {
  it('records exact home revenue with official and attendance causes', () => {
    const applied = applyOfficialMatchdayRevenue(
      state(), officialResult(), attendance, policy,
    );
    expect(applied.kind).toBe('RECORDED');
    if (applied.kind !== 'RECORDED') return;
    expect(applied.state.live.finance.cash).toBe(1600);
    expect(applied.state.live.finance.revenue.matchday).toBe(600);
    expect(applied.basis).toMatchObject({ amount: 600,
      gameId: 'game-1', applicationId: 'application-9',
      attendanceFactId: 'attendance-1', policyVersion: 'matchday-1' });
    expect(applied.state.live.finance.receipts[0]).toMatchObject({
      category: 'matchday', amount: 600,
      causeEventIds: ['application-9', 'turnstile-1'],
    });
    expect(() => applyOfficialMatchdayRevenue(applied.state,
      officialResult(), attendance, policy)).toThrow('DUPLICATE_ID');
  });

  it('records a zero-amount receipt for a closed-door game so it cannot be replayed for cash', () => {
    const original = state();
    const applied = applyOfficialMatchdayRevenue(original, officialResult(),
      { ...attendance, count: 0 }, policy);
    expect(applied.state.live.finance.cash).toBe(original.live.finance.cash);
    expect(applied.state.live.finance.receipts[0].amount).toBe(0);
    expect(() => applyOfficialMatchdayRevenue(applied.state, officialResult(),
      attendance, policy)).toThrow('DUPLICATE_ID');
  });

  it('rejects mismatched game, stadium, future policy and over-capacity attendance', () => {
    const club = state();
    const result = officialResult();
    expect(() => applyOfficialMatchdayRevenue(club, result,
      { ...attendance, gameId: 'other' }, policy)).toThrow();
    expect(() => applyOfficialMatchdayRevenue(club, result,
      { ...attendance, careerId: 'other' }, policy)).toThrow();
    expect(() => applyOfficialMatchdayRevenue(club, result,
      { ...attendance, stadiumId: 'other' }, policy)).toThrow();
    expect(() => applyOfficialMatchdayRevenue(club, result,
      { ...attendance, count: 10001 }, policy)).toThrow();
    expect(() => applyOfficialMatchdayRevenue(club, result,
      attendance, { ...policy, availableAtDay: 12 })).toThrow();
    expect(() => applyOfficialMatchdayRevenue(club, result,
      attendance, { ...policy, seasonId: 'other' })).toThrow();
    const later = applyClubCommand(club, { eventId: 'venue-12',
      careerId: club.careerId, clubId: club.identity.clubId,
      expectedRevision: club.revision, effectiveDay: 12,
      causeEventIds: ['venue-cause'],
      operations: [{ kind: 'REPLACE_STADIUM',
        stadium: { ...club.institutional.stadium,
          stadiumId: 'new-stadium', capacity: 50 } }],
    });
    if (!later.ok) throw new Error('fixture venue change failed');
    const delayed = applyOfficialMatchdayRevenue(later.state, result,
      attendance, policy,
      { checkpoint: club, acceptedEvents: [later.event] }, 13);
    expect(delayed.state.live.finance.revenue.matchday).toBe(600);
    expect(delayed.state.live.finance.receipts[0].effectiveDay).toBe(13);
    expect(delayed.basis.venueCapacity).toBe(10000);
    expect(() => applyOfficialMatchdayRevenue(later.state, result,
      attendance, policy,
      { checkpoint: later.state, acceptedEvents: [] }, 13)).toThrow();
    const beforeGame = applyClubCommand(club, { eventId: 'venue-10',
      careerId: club.careerId, clubId: club.identity.clubId,
      expectedRevision: club.revision, effectiveDay: 10,
      causeEventIds: ['venue-cause-10'],
      operations: [{ kind: 'REPLACE_STADIUM',
        stadium: { ...club.institutional.stadium,
          stadiumId: 'new-stadium', capacity: 50 } }],
    });
    if (!beforeGame.ok) throw new Error('fixture pre-game venue change failed');
    expect(() => applyOfficialMatchdayRevenue(beforeGame.state, result,
      attendance, policy,
      { checkpoint: club, acceptedEvents: [beforeGame.event] })).toThrow();
  });
});
