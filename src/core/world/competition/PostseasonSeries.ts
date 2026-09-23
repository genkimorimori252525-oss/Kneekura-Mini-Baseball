import { createCanonicalLineScoreSnapshot } from '../../model/CanonicalLineScoreSnapshot';
import type { OfficialGameResult } from './OfficialGameCompletion';

export type PostseasonSeriesPlan = Readonly<{
  seriesId: string;
  seasonId: string;
  bestOf: number;
  higherSeedClubId: string;
  lowerSeedClubId: string;
  scheduledGames: readonly Readonly<{
    gameId: string;
    homeClubId: string;
    awayClubId: string;
  }>[];
}>;

export type PostseasonSeriesState = Readonly<{
  seriesId: string;
  status: 'PENDING' | 'COMPLETE';
  winnerClubId: string | null;
  runnerUpClubId: string | null;
  higherSeedWins: number;
  lowerSeedWins: number;
  resultApplicationIds: readonly string[];
}>;

export const resolvePostseasonSeries = (
  plan: PostseasonSeriesPlan,
  results: readonly OfficialGameResult[],
): PostseasonSeriesState => {
  if (
    !plan.seriesId || !plan.seasonId || !plan.higherSeedClubId || !plan.lowerSeedClubId
    || plan.higherSeedClubId === plan.lowerSeedClubId
    || !Number.isSafeInteger(plan.bestOf) || plan.bestOf < 1 || plan.bestOf % 2 !== 1
    || plan.scheduledGames.length !== plan.bestOf
    || results.length > plan.bestOf
  ) throw new Error('invalid postseason series plan');
  const scheduledIds = new Set<string>();
  let higherHomeGames = 0;
  for (const game of plan.scheduledGames) {
    if (!game.gameId || scheduledIds.has(game.gameId)
      || ![plan.higherSeedClubId, plan.lowerSeedClubId].includes(game.homeClubId)
      || ![plan.higherSeedClubId, plan.lowerSeedClubId].includes(game.awayClubId)
      || game.homeClubId === game.awayClubId) {
      throw new Error('postseason series schedule has invalid participants');
    }
    scheduledIds.add(game.gameId);
    if (game.homeClubId === plan.higherSeedClubId) higherHomeGames += 1;
  }
  if (higherHomeGames <= plan.bestOf - higherHomeGames) {
    throw new Error('higher postseason seed must retain home-field priority');
  }
  let higherSeedWins = 0;
  let lowerSeedWins = 0;
  const winsNeeded = Math.floor(plan.bestOf / 2) + 1;
  const applicationIds = new Set<string>();
  for (let index = 0; index < results.length; index += 1) {
    if (higherSeedWins === winsNeeded || lowerSeedWins === winsNeeded) {
      throw new Error('official game recorded after a series winner was settled');
    }
    const result = results[index];
    const scheduled = plan.scheduledGames[index];
    const expectedWinner = result.homeRuns > result.awayRuns ? result.homeClubId
      : result.awayRuns > result.homeRuns ? result.awayClubId : null;
    const lineScore = createCanonicalLineScoreSnapshot(result.lineScore);
    if (
      result.gameId !== scheduled.gameId || result.seasonId !== plan.seasonId
      || result.homeClubId !== scheduled.homeClubId
      || result.awayClubId !== scheduled.awayClubId
      || result.winnerClubId === null || result.winnerClubId !== expectedWinner
      || !result.applicationId || applicationIds.has(result.applicationId)
      || !result.closureId
      || lineScore.totals.home.runs !== result.homeRuns
      || lineScore.totals.away.runs !== result.awayRuns
    ) throw new Error('postseason series requires unique official decided games');
    applicationIds.add(result.applicationId);
    if (result.winnerClubId === plan.higherSeedClubId) higherSeedWins += 1;
    else lowerSeedWins += 1;
  }
  const winnerClubId = higherSeedWins === winsNeeded ? plan.higherSeedClubId
    : lowerSeedWins === winsNeeded ? plan.lowerSeedClubId : null;
  return Object.freeze({
    seriesId: plan.seriesId,
    status: winnerClubId === null ? 'PENDING' : 'COMPLETE',
    winnerClubId,
    runnerUpClubId: winnerClubId === null ? null
      : winnerClubId === plan.higherSeedClubId ? plan.lowerSeedClubId : plan.higherSeedClubId,
    higherSeedWins,
    lowerSeedWins,
    resultApplicationIds: Object.freeze([...applicationIds]),
  });
};
