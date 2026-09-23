import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { OfficialStandingsSnapshot } from './OfficialStandings';
import type { PostseasonSeriesPlan } from './PostseasonSeries';
import { resolveWinterChampionship } from './WinterChampionship';

const clubs = ['a', 'b', 'c', 'd'];
const regularStandings: OfficialStandingsSnapshot = {
  seasonId: 'season-1', leagueId: 'dominican',
  tiebreakPolicyVersion: 'regular-v1', scheduleRevisionEventIds: [],
  rows: ['a', 'b', 'c', 'd', 'e', 'f'].map((clubId) => ({
    clubId, games: 100, wins: 50, losses: 50,
    ties: 0, runsFor: 300, runsAgainst: 300, cappedRunDifferential: 0 })),
  orderedClubIds: ['a', 'b', 'c', 'd', 'e', 'f'], unresolvedTieGroups: [],
  resultApplicationIds: [], tiebreakResolutions: [],
};
const games = clubs.flatMap((homeClubId, homeIndex) =>
  clubs.slice(homeIndex + 1).flatMap((awayClubId) => [
    { gameId: `${homeClubId}-${awayClubId}-1`, homeClubId, awayClubId },
    { gameId: `${homeClubId}-${awayClubId}-2`, homeClubId: awayClubId,
      awayClubId: homeClubId },
  ])).map((game, index) => ({ ...game, day: index + 1 }));
const official = (game: { gameId: string; homeClubId: string; awayClubId: string },
  winnerClubId: string): OfficialGameResult => {
  const homeRuns = winnerClubId === game.homeClubId ? 2 : 1;
  const awayRuns = winnerClubId === game.awayClubId ? 2 : 1;
  return {
    gameId: game.gameId, seasonId: 'season-1', homeClubId: game.homeClubId,
    awayClubId: game.awayClubId, winnerClubId, homeRuns, awayRuns,
    completionReason: 'BOTTOM_COMPLETE', ruleProfileId: asRuleProfileId('rules'),
    gamePolicyVersion: 'game-v1', closureId: `closure-${game.gameId}`,
    applicationId: `apply-${game.gameId}`, durableRevision: 1,
    lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
        away: { runs: awayRuns, hits: 0, errors: 0 } } },
  };
};
const roundResults = games.map((game) => official(game,
  [game.homeClubId, game.awayClubId].sort()[0]));
const finalPlan: PostseasonSeriesPlan = {
  seriesId: 'winter-final', seasonId: 'season-1',
  bestOf: 7, higherSeedClubId: 'a', lowerSeedClubId: 'b',
  scheduledGames: Array.from({ length: 7 }, (_, index) => {
    const homeClubId = index < 4 ? 'a' : 'b';
    return { gameId: `winter-final-${index}`, homeClubId,
      awayClubId: homeClubId === 'a' ? 'b' : 'a' };
  }),
};
const input = { version: 'winter-v1', regularSeasonStandings: regularStandings,
  games, results: roundResults,
  tiebreakPolicy: { version: 'round-v1', tieCreditNumerator: 1,
    tieCreditDenominator: 2, runDifferentialCapPerGame: 10 } };

it('validates a double round robin and advances its top two to a best-of-seven final', () => {
  const pending = resolveWinterChampionship(input, null);
  expect(pending).toMatchObject({ status: 'PENDING',
    regularSeasonWinnerClubId: 'a', championshipRoundWinnerClubId: 'a',
    nextFinal: { higherSeedClubId: 'a', lowerSeedClubId: 'b', bestOf: 7 } });
  expect(pending.championshipRoundStandings.orderedClubIds).toEqual(['a', 'b', 'c', 'd']);
  const finalResults = finalPlan.scheduledGames.slice(0, 4).map((game) => official(game, 'b'));
  expect(resolveWinterChampionship(input, { plan: finalPlan, results: finalResults }))
    .toMatchObject({ status: 'COMPLETE', championClubId: 'b', runnerUpClubId: 'a' });
  expect(() => resolveWinterChampionship({ ...input, games: games.slice(1) }, null))
    .toThrow('double round robin');
  const tied = games.map((game) => ({ ...official(game, game.homeClubId),
    homeRuns: 1, awayRuns: 1, winnerClubId: null as string | null,
    completionReason: 'TIE_LIMIT' as const,
    lineScore: { innings: [{ inning: 1, homeRuns: 1, awayRuns: 1 }],
      totals: { home: { runs: 1, hits: 0, errors: 0 },
        away: { runs: 1, hits: 0, errors: 0 } } },
  }));
  const unresolved = resolveWinterChampionship({ ...input, results: tied }, null);
  expect(unresolved).toMatchObject({ status: 'ROUND_TIE_UNRESOLVED',
    championClubId: null, nextFinal: null });
  expect(() => resolveWinterChampionship({ ...input, results: tied }, {
    plan: finalPlan, results: [],
  })).toThrow('round ties');
});

it('allows a match-scoped closure ID in a distinct final game', () => {
  const finalResult = official(finalPlan.scheduledGames[0], 'a');
  expect(resolveWinterChampionship(input, { plan: finalPlan,
    results: [{ ...finalResult, closureId: roundResults[0].closureId }],
  })).toMatchObject({ status: 'PENDING' });
});
