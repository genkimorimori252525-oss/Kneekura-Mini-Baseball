import type { OfficialGameResult } from './OfficialGameCompletion';
import { captureOfficialStandingsBasis,
  snapshotLeagueGroupAlignment,
  type LeagueGroupAlignment, type OfficialGroupStandingsSnapshot,
  type OfficialStandingRow, type OfficialStandingsBasis } from './OfficialStandings';
import { resolvePostseasonSeries, type PostseasonSeriesPlan,
  type PostseasonSeriesState } from './PostseasonSeries';

export type NorthAmericaSeedSource = 'DIVISION_WINNER_1' | 'DIVISION_WINNER_2'
  | 'DIVISION_WINNER_3' | 'WILD_CARD_1' | 'WILD_CARD_2' | 'WILD_CARD_3';
export type NorthAmericaBracket = Readonly<{
  /** Seed numbers; the exact pairing is an edition policy, not a frozen league constant. */
  seedSources: readonly NorthAmericaSeedSource[];
  wildCardPairings: readonly (readonly [number, number])[];
  divisionByes: readonly number[];
  /** Each tuple assigns a bye seed to one zero-based wild-card series winner. */
  divisionPairings: readonly (readonly [number, number])[];
}>;
export type NorthAmericaPostseasonPolicy = Readonly<{
  version: string;
  championshipHigherSeedConferenceId: string;
  bracket: NorthAmericaBracket;
}>;
export type NorthAmericaStage = 'wild-card-1' | 'wild-card-2'
  | 'division-1' | 'division-2' | 'conference-championship';
export type NorthAmericaSeriesEntry = Readonly<{
  stage: NorthAmericaStage;
  plan: PostseasonSeriesPlan;
  results: readonly OfficialGameResult[];
}>;
export type NorthAmericaConferenceInput = Readonly<{
  conferenceId: string;
  standings: OfficialGroupStandingsSnapshot;
  divisions: readonly Readonly<{
    divisionId: string;
    standings: OfficialGroupStandingsSnapshot;
  }>[];
  series: readonly NorthAmericaSeriesEntry[];
}>;
export type NorthAmericaPostseasonState = Readonly<{
  seasonId: string;
  regularSeasonBasis: OfficialStandingsBasis;
  conferenceAlignmentSnapshot: LeagueGroupAlignment;
  divisionAlignmentSnapshot: LeagueGroupAlignment;
  conferenceAlignmentVersion: string;
  divisionAlignmentVersion: string;
  policyVersion: string;
  status: 'PENDING' | 'COMPLETE';
  conferenceSeeds: readonly Readonly<{
    conferenceId: string;
    divisionWinnerClubIds: readonly string[];
    wildCardClubIds: readonly string[];
    seededClubIds: readonly string[];
  }>[];
  conferenceChampions: readonly Readonly<{
    conferenceId: string;
    clubId: string | null;
  }>[];
  series: readonly Readonly<{ conferenceId: string; stage: NorthAmericaStage;
    state: PostseasonSeriesState }>[];
  nextConferenceSeries: readonly Readonly<{ conferenceId: string; stage: NorthAmericaStage;
    higherSeedClubId: string; lowerSeedClubId: string; bestOf: number }>[];
  nextChampionship: Readonly<{ higherSeedClubId: string;
    lowerSeedClubId: string; bestOf: 7 }> | null;
  championship: PostseasonSeriesState | null;
  championClubId: string | null;
  runnerUpClubId: string | null;
}>;

const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const sameIdSet = (left: readonly string[], right: readonly string[]): boolean =>
  new Set(left).size === left.length && new Set(right).size === right.length
    && sameIds(sorted(left), sorted(right));
const sameRow = (left: OfficialStandingRow, right: OfficialStandingRow): boolean =>
  left.clubId === right.clubId && left.games === right.games
    && left.wins === right.wins && left.losses === right.losses
    && left.ties === right.ties && left.runsFor === right.runsFor
    && left.runsAgainst === right.runsAgainst
    && left.cappedRunDifferential === right.cappedRunDifferential;
const sorted = (ids: readonly string[]): string[] => [...ids].sort();

/** Selects six qualifiers in each conference and advances only official series. */
export const resolveNorthAmericaPostseason = (
  policy: NorthAmericaPostseasonPolicy,
  conferenceAlignment: LeagueGroupAlignment,
  divisionAlignment: LeagueGroupAlignment,
  conferences: readonly NorthAmericaConferenceInput[],
  championship: Readonly<{ plan: PostseasonSeriesPlan;
    results: readonly OfficialGameResult[] }> | null,
): NorthAmericaPostseasonState => {
  const bracket = policy.bracket;
  const wildSeeds = bracket.wildCardPairings.flat();
  const divisionSeeds = bracket.divisionPairings.map(([seed]) => seed);
  const winnerIndices = bracket.divisionPairings.map(([, winnerIndex]) => winnerIndex);
  const expectedSources: NorthAmericaSeedSource[] = ['DIVISION_WINNER_1',
    'DIVISION_WINNER_2', 'DIVISION_WINNER_3', 'WILD_CARD_1',
    'WILD_CARD_2', 'WILD_CARD_3'];
  const byes = bracket.divisionByes;
  if (!policy.version || !policy.championshipHigherSeedConferenceId
    || bracket.wildCardPairings.length !== 2 || bracket.divisionByes.length !== 2
    || bracket.divisionPairings.length !== 2
    || !sameIdSet(bracket.seedSources, expectedSources)
    || [1, 2, 3].some((rank) => bracket.seedSources.indexOf(
      `DIVISION_WINNER_${rank}` as NorthAmericaSeedSource) > bracket.seedSources.indexOf(
      `WILD_CARD_${rank}` as NorthAmericaSeedSource))
    || !sameIdSet([...wildSeeds, ...byes].map(String), ['1', '2', '3', '4', '5', '6'])
    || bracket.wildCardPairings.some(([high, low]) => high >= low)
    || !sameIdSet(divisionSeeds.map(String), byes.map(String))
    || !sameIds(sorted(winnerIndices.map(String)), ['0', '1'])) {
    throw new Error('invalid versioned North America bracket');
  }
  const seasonId = conferenceAlignment.seasonId;
  if (!seasonId || !conferenceAlignment.version || !divisionAlignment.version
    || conferenceAlignment.leagueId !== 'league-008'
    || divisionAlignment.leagueId !== 'league-008'
    || divisionAlignment.seasonId !== seasonId
    || conferenceAlignment.groups.length !== 2
    || divisionAlignment.groups.length !== 6
    || conferences.length !== 2
    || !conferences.some((item) =>
      item.conferenceId === policy.championshipHigherSeedConferenceId)) {
    throw new Error('North America alignments, season or conference count mismatch');
  }
  const conferenceIds = new Set<string>();
  const divisionIds = new Set<string>();
  const allClubIds = new Set<string>();
  const usedSeriesIds = new Set<string>();
  const usedGameIds = new Set<string>();
  const regularApplicationIds = conferences[0].standings.resultApplicationIds;
  const regularSeasonBasis = captureOfficialStandingsBasis(conferences[0].standings, false);
  const usedApplicationIds = new Set(regularApplicationIds);
  const tiebreakByApplication = new Map<string, string>();
  for (const conference of conferences) {
    for (const table of [conference.standings,
      ...conference.divisions.map((division) => division.standings)]) {
      for (const resolution of table.tiebreakResolutions) {
        if (!resolution.applicationId
          || regularApplicationIds.includes(resolution.applicationId)) {
          throw new Error('North America tiebreak application is invalid');
        }
        const provenance = JSON.stringify([resolution.policyVersion, resolution.gameId,
          resolution.winnerClubId, resolution.loserClubId]);
        const prior = tiebreakByApplication.get(resolution.applicationId);
        if (prior !== undefined && prior !== provenance) {
          throw new Error('North America tiebreak application provenance conflicts');
        }
        tiebreakByApplication.set(resolution.applicationId, provenance);
        usedApplicationIds.add(resolution.applicationId);
      }
    }
  }
  const conferenceSeeds: NorthAmericaPostseasonState['conferenceSeeds'][number][] = [];
  const conferenceChampions: NorthAmericaPostseasonState['conferenceChampions'][number][] = [];
  const series: NorthAmericaPostseasonState['series'][number][] = [];
  const nextConferenceSeries: NorthAmericaPostseasonState['nextConferenceSeries'][number][] = [];
  const validateTable = (table: OfficialGroupStandingsSnapshot,
    groupId: string, alignment: LeagueGroupAlignment, count: number): void => {
    const group = alignment.groups.find((item) => item.groupId === groupId);
    const order = table.orderedClubIds;
    if (!group || table.groupId !== groupId || table.alignmentVersion !== alignment.version
      || table.seasonId !== seasonId || table.leagueId !== 'league-008'
      || table.tiebreakPolicyVersion !== conferences[0].standings.tiebreakPolicyVersion
      || !sameIdSet(table.resultApplicationIds, regularApplicationIds)
      || !sameIds(table.scheduleRevisionEventIds,
        conferences[0].standings.scheduleRevisionEventIds)
      || table.unresolvedTieGroups.length > 0 || order === null
      || order.length !== count || table.rows.length !== count
      || new Set(group.clubIds).size !== count
      || !sameIds(sorted(group.clubIds), sorted(table.memberClubIds))
      || !sameIds(sorted(group.clubIds), sorted(order))
      || !sameIds(sorted(group.clubIds), sorted(table.rows.map((row) => row.clubId)))) {
      throw new Error('North America official standings or alignment mismatch');
    }
  };
  const validateSeries = (entry: { plan: PostseasonSeriesPlan;
    results: readonly OfficialGameResult[] }): void => {
    if (entry.plan.seasonId !== seasonId || usedSeriesIds.has(entry.plan.seriesId)) {
      throw new Error('North America series season or identity mismatch');
    }
    usedSeriesIds.add(entry.plan.seriesId);
    for (const game of entry.plan.scheduledGames) {
      if (usedGameIds.has(game.gameId)) throw new Error('North America game is scheduled twice');
      usedGameIds.add(game.gameId);
    }
    for (const result of entry.results) {
      if (usedApplicationIds.has(result.applicationId)) {
        throw new Error('official application is reused across North America series');
      }
      usedApplicationIds.add(result.applicationId);
    }
  };
  for (const conference of conferences) {
    const conferenceId = conference.conferenceId;
    if (conferenceIds.has(conferenceId)) throw new Error('duplicate North America conference');
    conferenceIds.add(conferenceId);
    validateTable(conference.standings, conferenceId, conferenceAlignment, 15);
    if (conference.divisions.length !== 3) {
      throw new Error('North America conference requires three divisions');
    }
    const order = conference.standings.orderedClubIds!;
    const rowByClub = new Map(conference.standings.rows.map((row) => [row.clubId, row]));
    const winnerIds = new Set<string>();
    const conferenceMembers = new Set(order);
    const covered = new Set<string>();
    for (const division of conference.divisions) {
      if (divisionIds.has(division.divisionId)) {
        throw new Error('duplicate North America division');
      }
      divisionIds.add(division.divisionId);
      validateTable(division.standings, division.divisionId, divisionAlignment, 5);
      for (const row of division.standings.rows) {
        if (!conferenceMembers.has(row.clubId) || covered.has(row.clubId)
          || !sameRow(row, rowByClub.get(row.clubId)!)) {
          throw new Error('North America division standings contradict conference results');
        }
        covered.add(row.clubId);
      }
      winnerIds.add(division.standings.orderedClubIds![0]);
    }
    if (covered.size !== 15 || winnerIds.size !== 3) {
      throw new Error('North America divisions must partition conference membership');
    }
    for (const clubId of order) {
      if (allClubIds.has(clubId)) throw new Error('North America conferences overlap');
      allClubIds.add(clubId);
    }
    const divisionWinnerClubIds = order.filter((id) => winnerIds.has(id));
    const wildCardClubIds = order.filter((id) => !winnerIds.has(id)).slice(0, 3);
    const seedClubs = new Map<NorthAmericaSeedSource, string>([
      ...divisionWinnerClubIds.map((id, index) =>
        [`DIVISION_WINNER_${index + 1}` as NorthAmericaSeedSource, id] as const),
      ...wildCardClubIds.map((id, index) =>
        [`WILD_CARD_${index + 1}` as NorthAmericaSeedSource, id] as const),
    ]);
    const seededClubIds = bracket.seedSources.map((source) => seedClubs.get(source)!);
    conferenceSeeds.push(Object.freeze({ conferenceId,
      divisionWinnerClubIds: Object.freeze(divisionWinnerClubIds),
      wildCardClubIds: Object.freeze(wildCardClubIds),
      seededClubIds: Object.freeze(seededClubIds) }));
    const entries = new Map<NorthAmericaStage, NorthAmericaSeriesEntry>();
    for (const entry of conference.series) {
      if (entries.has(entry.stage)) throw new Error('duplicate North America series stage');
      entries.set(entry.stage, entry);
    }
    const allowedStages = new Set<NorthAmericaStage>();
    const resolve = (stage: NorthAmericaStage, high: string | null,
      low: string | null, bestOf: number): PostseasonSeriesState | null => {
      allowedStages.add(stage);
      const entry = entries.get(stage);
      if (high === null || low === null) {
        if (entry) throw new Error('North America series cannot start before upstream winner');
        return null;
      }
      if (!entry) {
        nextConferenceSeries.push(Object.freeze({ conferenceId, stage,
          higherSeedClubId: high, lowerSeedClubId: low, bestOf }));
        return null;
      }
      if (entry.plan.bestOf !== bestOf || entry.plan.higherSeedClubId !== high
        || entry.plan.lowerSeedClubId !== low) {
        throw new Error('North America series format or seeding mismatch');
      }
      validateSeries(entry);
      const state = resolvePostseasonSeries(entry.plan, entry.results);
      series.push(Object.freeze({ conferenceId, stage, state }));
      return state;
    };
    const wildCards = bracket.wildCardPairings.map(([high, low], index) =>
      resolve(index === 0 ? 'wild-card-1' : 'wild-card-2',
        seededClubIds[high - 1], seededClubIds[low - 1], 3));
    const divisions = bracket.divisionPairings.map(([byeSeed, winnerIndex], index) => {
      const byeClub = seededClubIds[byeSeed - 1];
      const wildCardWinner = wildCards[winnerIndex]?.winnerClubId ?? null;
      const byeIsHigher = wildCardWinner === null
        || byeSeed - 1 < seededClubIds.indexOf(wildCardWinner);
      return resolve(index === 0 ? 'division-1' : 'division-2',
        byeIsHigher ? byeClub : wildCardWinner,
        byeIsHigher ? wildCardWinner : byeClub, 5);
    });
    const winners = divisions.map((item) => item?.winnerClubId ?? null);
    const higher = winners[0] && winners[1]
      ? seededClubIds.indexOf(winners[0]) < seededClubIds.indexOf(winners[1])
        ? winners[0] : winners[1] : null;
    const lower = higher ? winners.find((id) => id !== higher) ?? null : null;
    const conferenceFinal = resolve('conference-championship', higher, lower, 7);
    if ([...entries.keys()].some((stage) => !allowedStages.has(stage))) {
      throw new Error('North America series stage is not allowed');
    }
    conferenceChampions.push(Object.freeze({ conferenceId,
      clubId: conferenceFinal?.winnerClubId ?? null }));
  }
  if (conferenceIds.size !== conferenceAlignment.groups.length
    || divisionIds.size !== divisionAlignment.groups.length
    || allClubIds.size !== 30) {
    throw new Error('North America alignments do not cover all clubs');
  }
  const highConference = conferenceChampions.find((item) =>
    item.conferenceId === policy.championshipHigherSeedConferenceId)!;
  const lowConference = conferenceChampions.find((item) =>
    item.conferenceId !== policy.championshipHigherSeedConferenceId)!;
  let nextChampionship: NorthAmericaPostseasonState['nextChampionship'] = null;
  let championshipState: PostseasonSeriesState | null = null;
  if (highConference.clubId && lowConference.clubId) {
    if (championship === null) {
      nextChampionship = Object.freeze({ higherSeedClubId: highConference.clubId,
        lowerSeedClubId: lowConference.clubId, bestOf: 7 });
    } else {
      if (championship.plan.bestOf !== 7
        || championship.plan.higherSeedClubId !== highConference.clubId
        || championship.plan.lowerSeedClubId !== lowConference.clubId) {
        throw new Error('North America championship format or priority mismatch');
      }
      validateSeries(championship);
      championshipState = resolvePostseasonSeries(championship.plan, championship.results);
    }
  } else if (championship !== null) {
    throw new Error('North America championship cannot start before conference champions');
  }
  return Object.freeze({ seasonId, regularSeasonBasis,
    conferenceAlignmentSnapshot: snapshotLeagueGroupAlignment(conferenceAlignment),
    divisionAlignmentSnapshot: snapshotLeagueGroupAlignment(divisionAlignment),
    conferenceAlignmentVersion: conferenceAlignment.version,
    divisionAlignmentVersion: divisionAlignment.version,
    policyVersion: policy.version,
    status: championshipState?.status === 'COMPLETE' ? 'COMPLETE' : 'PENDING',
    conferenceSeeds: Object.freeze(conferenceSeeds),
    conferenceChampions: Object.freeze(conferenceChampions),
    series: Object.freeze(series), nextConferenceSeries: Object.freeze(nextConferenceSeries),
    nextChampionship, championship: championshipState,
    championClubId: championshipState?.winnerClubId ?? null,
    runnerUpClubId: championshipState?.runnerUpClubId ?? null });
};
