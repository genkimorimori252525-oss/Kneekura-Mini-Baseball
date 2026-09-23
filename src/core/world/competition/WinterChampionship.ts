import type { OfficialGameResult } from './OfficialGameCompletion';
import {
  applyOfficialTiebreakGame,
  buildOfficialStandings,
  type OfficialStandingsSnapshot,
  type OfficialTiebreakGamePlan,
  type StandingsTiebreakPolicy,
  type OfficialStandingsSchedule,
} from './OfficialStandings';
import { resolvePostseasonSeries, type PostseasonSeriesPlan,
  type PostseasonSeriesState } from './PostseasonSeries';

export type WinterRoundGame = Readonly<{
  gameId: string;
  day: number;
  homeClubId: string;
  awayClubId: string;
}>;
export type WinterChampionshipInput = Readonly<{
  version: string;
  regularSeasonStandings: OfficialStandingsSnapshot;
  games: readonly WinterRoundGame[];
  results: readonly OfficialGameResult[];
  tiebreakPolicy: StandingsTiebreakPolicy;
  tiebreakGames?: readonly Readonly<{
    plan: OfficialTiebreakGamePlan;
    result: OfficialGameResult;
  }>[];
}>;
export type WinterChampionshipState = Readonly<{
  seasonId: string;
  policyVersion: string;
  status: 'ROUND_TIE_UNRESOLVED' | 'PENDING' | 'COMPLETE';
  regularSeasonWinnerClubId: string;
  championshipRoundStandings: OfficialStandingsSnapshot;
  championshipRoundWinnerClubId: string | null;
  nextFinal: Readonly<{ higherSeedClubId: string;
    lowerSeedClubId: string; bestOf: 7 }> | null;
  final: PostseasonSeriesState | null;
  championClubId: string | null;
  runnerUpClubId: string | null;
}>;

/** Dominican v1: four-club double round robin, then a best-of-seven final. */
export const resolveWinterChampionship = (
  input: WinterChampionshipInput,
  final: Readonly<{ plan: PostseasonSeriesPlan;
    results: readonly OfficialGameResult[] }> | null,
): WinterChampionshipState => {
  const regular = input.regularSeasonStandings;
  const ranking = regular.orderedClubIds;
  if (!input.version || !regular.seasonId || !regular.leagueId
    || ranking === null || regular.unresolvedTieGroups.length > 0
    || ranking.length !== 6 || new Set(ranking).size !== 6
    || regular.rows.length !== 6
    || new Set(regular.rows.map((row) => row.clubId)).size !== 6
    || regular.rows.some((row) => !ranking.includes(row.clubId))) {
    throw new Error('winter championship requires resolved six-club regular-season standings');
  }
  const entrants = ranking.slice(0, 4);
  const entrantSet = new Set(entrants);
  const gameIds = new Set<string>();
  const occupied = new Set<string>();
  const directedPairs = new Map<string, number>();
  if (input.games.length !== 12) throw new Error('winter championship requires a double round robin');
  for (const game of input.games) {
    if (!game.gameId || gameIds.has(game.gameId)
      || !Number.isSafeInteger(game.day) || game.day < 0
      || !entrantSet.has(game.homeClubId) || !entrantSet.has(game.awayClubId)
      || game.homeClubId === game.awayClubId) {
      throw new Error('invalid winter championship round game');
    }
    gameIds.add(game.gameId);
    for (const clubId of [game.homeClubId, game.awayClubId]) {
      const key = JSON.stringify([game.day, clubId]);
      if (occupied.has(key)) throw new Error('winter club has simultaneous games');
      occupied.add(key);
    }
    const pair = JSON.stringify([game.homeClubId, game.awayClubId]);
    directedPairs.set(pair, (directedPairs.get(pair) ?? 0) + 1);
  }
  if (directedPairs.size !== 12 || [...directedPairs.values()].some((count) => count !== 1)) {
    throw new Error('winter championship requires one home game per directed pair');
  }
  const schedule: OfficialStandingsSchedule = {
    seasonId: regular.seasonId,
    leagueId: `${regular.leagueId}:championship-round`,
    memberClubIds: entrants,
    regularSeasonGamesPerClub: 6,
    revisionEventIds: [],
    games: input.games.map((game) => ({ ...game, seriesId: input.version })),
  };
  let roundStandings = buildOfficialStandings(schedule, input.results, input.tiebreakPolicy);
  const regularApplications = new Set([
    ...regular.resultApplicationIds,
    ...regular.tiebreakResolutions.map((item) => item.applicationId),
  ]);
  if (input.results.some((result) => regularApplications.has(result.applicationId))) {
    throw new Error('winter round result reuses a regular-season official application');
  }
  for (const deciding of input.tiebreakGames ?? []) {
    if (regularApplications.has(deciding.result.applicationId)
      || gameIds.has(deciding.plan.gameId)) {
      throw new Error('winter tiebreak reuses a scheduled game or official application');
    }
    roundStandings = applyOfficialTiebreakGame(roundStandings, deciding.plan, deciding.result);
  }
  const roundRanking = roundStandings.orderedClubIds;
  if (roundRanking === null) {
    if (final !== null) throw new Error('winter final cannot start before round ties are resolved');
    return Object.freeze({ seasonId: regular.seasonId, policyVersion: input.version,
      status: 'ROUND_TIE_UNRESOLVED', regularSeasonWinnerClubId: ranking[0],
      championshipRoundStandings: roundStandings,
      championshipRoundWinnerClubId: null, nextFinal: null, final: null,
      championClubId: null, runnerUpClubId: null });
  }
  let finalState: PostseasonSeriesState | null = null;
  let nextFinal: WinterChampionshipState['nextFinal'] = null;
  if (final === null) {
    nextFinal = Object.freeze({ higherSeedClubId: roundRanking[0],
      lowerSeedClubId: roundRanking[1], bestOf: 7 });
  } else {
    if (final.plan.seasonId !== regular.seasonId || final.plan.bestOf !== 7
      || final.plan.higherSeedClubId !== roundRanking[0]
      || final.plan.lowerSeedClubId !== roundRanking[1]) {
      throw new Error('winter final season, participants or series length mismatch');
    }
    if (final.plan.scheduledGames.some((game) => gameIds.has(game.gameId)
      || roundStandings.tiebreakResolutions.some((item) => item.gameId === game.gameId))
      || final.results.some((result) => regularApplications.has(result.applicationId)
        || roundStandings.resultApplicationIds.includes(result.applicationId)
        || roundStandings.tiebreakResolutions.some((item) =>
          item.applicationId === result.applicationId))) {
      throw new Error('winter final reuses a scheduled game or official application');
    }
    finalState = resolvePostseasonSeries(final.plan, final.results);
  }
  return Object.freeze({ seasonId: regular.seasonId, policyVersion: input.version,
    status: finalState?.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING',
    regularSeasonWinnerClubId: ranking[0],
    championshipRoundStandings: roundStandings,
    championshipRoundWinnerClubId: roundRanking[0], nextFinal,
    final: finalState,
    championClubId: finalState?.winnerClubId ?? null,
    runnerUpClubId: finalState?.runnerUpClubId ?? null });
};
