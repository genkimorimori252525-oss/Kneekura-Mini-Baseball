import type { DomesticChampionshipFormat } from './LeagueProfiles';
import { captureOfficialStandingsBasis,
  type OfficialStandingsBasis, type OfficialStandingsSnapshot } from './OfficialStandings';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { resolvePostseasonSeries, type PostseasonSeriesPlan,
  type PostseasonSeriesState } from './PostseasonSeries';

export type DirectPostseasonFormat = Extract<DomesticChampionshipFormat,
  'TABLE_TITLE' | 'TOP4_SERIES' | 'EURO_TOP4' | 'LADDER' | 'TOP2_FINAL'>;
export type DomesticPostseasonStage =
  | 'semifinal-1' | 'semifinal-2' | 'ladder-1' | 'ladder-2' | 'ladder-3' | 'final';
export type DomesticPostseasonEntry = Readonly<{
  stage: DomesticPostseasonStage;
  plan: PostseasonSeriesPlan;
  results: readonly OfficialGameResult[];
}>;
export type ExpectedPostseasonSeries = Readonly<{
  stage: DomesticPostseasonStage;
  higherSeedClubId: string;
  lowerSeedClubId: string;
  bestOf: number;
}>;
export type DomesticPostseasonState = Readonly<{
  seasonId: string;
  regularSeasonBasis: OfficialStandingsBasis;
  regularSeasonOrder: readonly string[];
  format: DirectPostseasonFormat;
  status: 'PENDING' | 'COMPLETE';
  regularSeasonChampionClubId: string;
  championClubId: string | null;
  runnerUpClubId: string | null;
  series: readonly Readonly<{ stage: DomesticPostseasonStage; state: PostseasonSeriesState }>[];
  nextSeries: readonly ExpectedPostseasonSeries[];
}>;

/** A bracket advances only after each preceding official series has a winner. */
export const resolveDomesticPostseason = (
  format: DirectPostseasonFormat,
  standings: OfficialStandingsSnapshot,
  entries: readonly DomesticPostseasonEntry[],
): DomesticPostseasonState => {
  const orderedClubIds = standings.orderedClubIds;
  if (!standings.seasonId || orderedClubIds === null
    || standings.unresolvedTieGroups.length > 0) {
    throw new Error('postseason cannot use unresolved official regular-season standings');
  }
  const minimumClubs = format === 'TABLE_TITLE' ? 1 : format === 'TOP2_FINAL' ? 2
    : format === 'LADDER' ? 5 : 4;
  if (orderedClubIds.length < minimumClubs
    || orderedClubIds.some((clubId) => typeof clubId !== 'string' || !clubId)
    || new Set(orderedClubIds).size !== orderedClubIds.length
    || standings.rows.length !== orderedClubIds.length
    || new Set(standings.rows.map((row) => row.clubId)).size !== orderedClubIds.length
    || standings.rows.some((row) => !orderedClubIds.includes(row.clubId))) {
    throw new Error('postseason requires an ordered unique regular-season standing');
  }
  const entryByStage = new Map<DomesticPostseasonStage, DomesticPostseasonEntry>();
  const seasonIds = new Set<string>();
  for (const entry of entries) {
    if (entryByStage.has(entry.stage)) throw new Error('duplicate postseason stage');
    if (!entry.plan.seasonId || entry.plan.seasonId !== standings.seasonId) {
      throw new Error('postseason series season must match official standings');
    }
    seasonIds.add(entry.plan.seasonId);
    entryByStage.set(entry.stage, entry);
  }
  if (seasonIds.size > 1) throw new Error('postseason series must belong to one season');
  const nextSeries: ExpectedPostseasonSeries[] = [];
  const series: { stage: DomesticPostseasonStage; state: PostseasonSeriesState }[] = [];
  const usedSeriesIds = new Set<string>();
  const usedGames = new Set<string>();
  const usedApplications = new Set<string>([
    ...standings.resultApplicationIds,
    ...standings.tiebreakResolutions.map((item) => item.applicationId),
  ]);
  const allowedStages = new Set<DomesticPostseasonStage>();
  const resolve = (
    stage: DomesticPostseasonStage, high: string | null, low: string | null, bestOf: number,
  ): PostseasonSeriesState | null => {
    allowedStages.add(stage);
    const entry = entryByStage.get(stage);
    if (high === null || low === null) {
      if (entry) throw new Error('postseason series cannot start before upstream winner');
      return null;
    }
    if (!entry) {
      nextSeries.push(Object.freeze({ stage, higherSeedClubId: high,
        lowerSeedClubId: low, bestOf }));
      return null;
    }
    if (entry.plan.bestOf !== bestOf || entry.plan.higherSeedClubId !== high
      || entry.plan.lowerSeedClubId !== low) throw new Error('postseason series format or seeding mismatch');
    if (usedSeriesIds.has(entry.plan.seriesId)) {
      throw new Error('postseason series identity is reused');
    }
    usedSeriesIds.add(entry.plan.seriesId);
    for (const game of entry.plan.scheduledGames) {
      if (usedGames.has(game.gameId)) throw new Error('postseason game appears in multiple series');
      usedGames.add(game.gameId);
    }
    for (const result of entry.results) {
      if (usedApplications.has(result.applicationId)) {
        throw new Error('official application appears in multiple postseason series');
      }
      usedApplications.add(result.applicationId);
    }
    const state = resolvePostseasonSeries(entry.plan, entry.results);
    series.push(Object.freeze({ stage, state }));
    return state;
  };
  let finalState: PostseasonSeriesState | null = null;
  if (format === 'TABLE_TITLE') {
    if (entries.length > 0) throw new Error('table title has no postseason series');
    return Object.freeze({ seasonId: standings.seasonId,
      regularSeasonBasis: captureOfficialStandingsBasis(standings),
      regularSeasonOrder: Object.freeze([...orderedClubIds]),
      format, status: 'COMPLETE',
      regularSeasonChampionClubId: orderedClubIds[0],
      championClubId: orderedClubIds[0], runnerUpClubId: null,
      series: Object.freeze([]), nextSeries: Object.freeze([]) });
  }
  if (format === 'TOP2_FINAL') {
    finalState = resolve('final', orderedClubIds[0], orderedClubIds[1], 5);
  } else if (format === 'LADDER') {
    const first = resolve('ladder-1', orderedClubIds[3], orderedClubIds[4], 3);
    const second = resolve('ladder-2', orderedClubIds[2], first?.winnerClubId ?? null, 5);
    const third = resolve('ladder-3', orderedClubIds[1], second?.winnerClubId ?? null, 5);
    finalState = resolve('final', orderedClubIds[0], third?.winnerClubId ?? null, 7);
  } else {
    const semifinalBestOf = format === 'EURO_TOP4' ? 3 : 5;
    const first = resolve('semifinal-1', orderedClubIds[0], orderedClubIds[3], semifinalBestOf);
    const second = resolve('semifinal-2', orderedClubIds[1], orderedClubIds[2], semifinalBestOf);
    const firstWinner = first?.winnerClubId;
    const secondWinner = second?.winnerClubId;
    const finalHigh = firstWinner && secondWinner
      ? orderedClubIds.indexOf(firstWinner) < orderedClubIds.indexOf(secondWinner)
        ? firstWinner : secondWinner : null;
    const finalLow = firstWinner && secondWinner
      ? finalHigh === firstWinner ? secondWinner : firstWinner : null;
    finalState = resolve('final', finalHigh, finalLow, format === 'EURO_TOP4' ? 5 : 7);
  }
  if ([...entryByStage.keys()].some((stage) => !allowedStages.has(stage))) {
    throw new Error('postseason stage does not belong to the selected format');
  }
  return Object.freeze({ seasonId: standings.seasonId,
    regularSeasonBasis: captureOfficialStandingsBasis(standings),
    regularSeasonOrder: Object.freeze([...orderedClubIds]), format,
    status: finalState?.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING',
    regularSeasonChampionClubId: orderedClubIds[0],
    championClubId: finalState?.winnerClubId ?? null,
    runnerUpClubId: finalState?.runnerUpClubId ?? null,
    series: Object.freeze(series), nextSeries: Object.freeze(nextSeries) });
};
