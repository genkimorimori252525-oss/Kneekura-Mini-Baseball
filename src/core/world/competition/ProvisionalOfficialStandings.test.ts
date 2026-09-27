import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { projectProvisionalOfficialStandings } from './ProvisionalOfficialStandings';

const schedule = { seasonId: 'season-1', leagueId: 'league-1',
  memberClubIds: ['a', 'b', 'c', 'd'], regularSeasonGamesPerClub: 2,
  revisionEventIds: ['schedule-v1'], games: [
    { gameId: 'ab', homeClubId: 'a', awayClubId: 'b' },
    { gameId: 'bc', homeClubId: 'b', awayClubId: 'c' },
    { gameId: 'cd', homeClubId: 'c', awayClubId: 'd' },
    { gameId: 'da', homeClubId: 'd', awayClubId: 'a' },
  ] };
const policy = { version: 'standing-v1', tieCreditNumerator: 1,
  tieCreditDenominator: 2, runDifferentialCapPerGame: 10 };
const result = (gameId: string, homeClubId: string,
  awayClubId: string, homeRuns: number,
  awayRuns: number): OfficialGameResult => ({
  gameId, seasonId: 'season-1', homeClubId, awayClubId,
  homeRuns, awayRuns,
  winnerClubId: homeRuns > awayRuns ? homeClubId
    : awayRuns > homeRuns ? awayClubId : null,
  completionReason: homeRuns === awayRuns ? 'TIE_LIMIT' : 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId('rules-v1'), gamePolicyVersion: 'game-v1',
  closureId: `closure-${gameId}`, applicationId: `application-${gameId}`,
  durableRevision: 1,
  lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
    totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
      away: { runs: awayRuns, hits: 0, errors: 0 } } },
});

it('ranks played clubs by versioned winning-credit percentage and separates unplayed clubs', () => {
  const projection = projectProvisionalOfficialStandings(schedule, [
    result('ab', 'a', 'b', 2, 1),
    result('bc', 'b', 'c', 2, 1),
  ], policy);
  expect(projection).toMatchObject({ kind: 'PROVISIONAL',
    provisionalGroups: [['a'], ['b'], ['c']],
    unplayedClubIds: ['d'], playedGameIds: ['ab', 'bc'],
    pendingGameIds: ['cd', 'da'],
    resultApplicationIds: ['application-ab', 'application-bc'] });
  expect(projection.rows).toMatchObject([
    { clubId: 'a', games: 1, wins: 1 },
    { clubId: 'b', games: 2, wins: 1, losses: 1 },
    { clubId: 'c', games: 1, losses: 1 },
    { clubId: 'd', games: 0 },
  ]);
});

it('keeps exact provisional percentage ties grouped and rejects duplicate or forged results', () => {
  const tied = projectProvisionalOfficialStandings(schedule, [
    result('ab', 'a', 'b', 1, 1),
  ], policy);
  expect(tied.provisionalGroups).toEqual([['a', 'b']]);
  const game = result('ab', 'a', 'b', 1, 1);
  expect(() => projectProvisionalOfficialStandings(schedule,
    [game, game], policy)).toThrow();
  expect(() => projectProvisionalOfficialStandings(schedule,
    [{ ...game, winnerClubId: 'a' }], policy)).toThrow();
  expect(() => projectProvisionalOfficialStandings(schedule,
    [{ ...game, seasonId: 'other' }], policy)).toThrow();
});

it('rejects unsafe accumulation of capped run differential', () => {
  const huge = Number.MAX_SAFE_INTEGER;
  expect(() => projectProvisionalOfficialStandings(schedule, [
    result('ab', 'a', 'b', huge, 0),
    result('da', 'd', 'a', 0, huge),
  ], { ...policy, runDifferentialCapPerGame: huge })).toThrow('overflow');
});
