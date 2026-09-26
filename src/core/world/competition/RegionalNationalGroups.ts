import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings, type OfficialStandingRow,
  type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const PAIRS: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const seededKey = (seed: string, nationId: string): number => {
  const source = JSON.stringify([seed, nationId]);
  let value = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    value = Math.imul(value ^ source.charCodeAt(index), 16777619);
  }
  return value >>> 0;
};

export type RegionalNationalEdition = Readonly<{
  competitionId: string;
  editionId: string;
  canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP';
  region: ClubWorldRegion;
  formatVersion: string;
  ruleProfileVersion: string;
  gamePolicyVersion: string;
  hostingPolicyVersion: string;
  qualificationSnapshotId: string;
  drawSnapshotId: string;
  tiebreakPolicy: StandingsTiebreakPolicy;
  bestThirdPolicy: Readonly<{ version: string;
    criteria: readonly ('WINS' | 'CAPPED_RUN_DIFFERENTIAL'
      | 'RUNS_AGAINST')[];
    drawSeed: string }>;
  hostNationIds: readonly string[];
  groups: readonly Readonly<{ groupIndex: number;
    nationIds: readonly string[];
    hostNationId: string;
    hostCityId: string;
    hostVenueId: string }>[];
  calendarWindow: Readonly<{ startsOnDay: number; endsOnDay: number }>;
}>;
export type RegionalNationalAuthority = Readonly<{
  nationCompetitionRegion: (nationId: string,
    beforeDay: number) => ClubWorldRegion | null;
}>;
export type RegionalNationalGroupGame = Readonly<{
  gameId: string;
  groupIndex: number;
  homeNationId: string;
  awayNationId: string;
  venueId: string;
}>;
export type RegionalNationalGroupPlan = Readonly<{
  competitionId: string;
  editionId: string;
  region: ClubWorldRegion;
  formatVersion: string;
  qualificationSnapshotId: string;
  drawSnapshotId: string;
  groups: readonly Readonly<{ groupIndex: number;
    nationIds: readonly string[];
    hostNationId: string; hostCityId: string;
    hostVenueId: string;
    games: readonly RegionalNationalGroupGame[] }>[];
}>;
export type RegionalNationalGroupOutcome = Readonly<{
  plan: RegionalNationalGroupPlan;
  groups: readonly Readonly<{ groupIndex: number;
    standings: OfficialStandingsSnapshot;
    topTwoNationIds: readonly string[] | null;
    thirdPlaceNationId: string | null }>[];
  bestThirdNationIds: readonly string[] | null;
  knockoutNationIds: readonly string[] | null;
  resultApplicationIds: readonly string[];
}>;

export const planRegionalNationalGroups = (
  edition: RegionalNationalEdition,
  authority: RegionalNationalAuthority,
): RegionalNationalGroupPlan => {
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || edition.canonicalRole !== 'REGIONAL_NATIONAL_CHAMPIONSHIP'
    || !REGIONS.includes(edition.region)
    || !id(edition.formatVersion)
    || !id(edition.ruleProfileVersion)
    || !id(edition.gamePolicyVersion)
    || !id(edition.hostingPolicyVersion)
    || !id(edition.qualificationSnapshotId)
    || !id(edition.drawSnapshotId)
    || !id(edition.tiebreakPolicy?.version)
    || !id(edition.bestThirdPolicy?.version)
    || !id(edition.bestThirdPolicy.drawSeed)
    || !Array.isArray(edition.bestThirdPolicy.criteria)
    || edition.bestThirdPolicy.criteria.length !== 3
    || new Set(edition.bestThirdPolicy.criteria).size !== 3
    || !['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST']
      .every((criterion) => edition.bestThirdPolicy.criteria
        .includes(criterion as typeof edition.bestThirdPolicy.criteria[number]))
    || !day(edition.calendarWindow?.startsOnDay)
    || !day(edition.calendarWindow?.endsOnDay)
    || edition.calendarWindow.endsOnDay
      < edition.calendarWindow.startsOnDay
    || typeof authority?.nationCompetitionRegion !== 'function'
    || !Array.isArray(edition.hostNationIds)
    || edition.hostNationIds.length < 1
    || edition.hostNationIds.length > 2
    || edition.hostNationIds.some((nationId) => !id(nationId))
    || new Set(edition.hostNationIds).size
      !== edition.hostNationIds.length
    || !Array.isArray(edition.groups)
    || ![2, 3, 4].includes(edition.groups.length)) {
    throw new Error('invalid versioned regional national edition');
  }
  const entrantIds = new Set<string>();
  const groups = edition.groups.map((group: RegionalNationalEdition['groups'][number],
    groupIndex: number) => {
    if (!group || group.groupIndex !== groupIndex
      || !Array.isArray(group.nationIds)
      || group.nationIds.length !== 4
      || new Set(group.nationIds).size !== 4
      || group.nationIds.some((nationId) => !id(nationId)
        || entrantIds.has(nationId)
        || authority.nationCompetitionRegion(nationId,
          edition.calendarWindow.startsOnDay) !== edition.region)
      || !edition.hostNationIds.includes(group.hostNationId)
      || !id(group.hostCityId) || !id(group.hostVenueId)) {
      throw new Error('regional national draw needs distinct eligible nations');
    }
    group.nationIds.forEach((nationId) => entrantIds.add(nationId));
    const nationIds = Object.freeze([...group.nationIds]);
    const games = Object.freeze(PAIRS.map((pair, gameIndex) =>
      Object.freeze({ gameId: JSON.stringify(['regional-national-group',
        edition.competitionId, edition.editionId,
        groupIndex, gameIndex]), groupIndex,
      homeNationId: nationIds[pair[0]],
      awayNationId: nationIds[pair[1]],
      venueId: group.hostVenueId })));
    return Object.freeze({ groupIndex, nationIds,
      hostNationId: group.hostNationId,
      hostCityId: group.hostCityId,
      hostVenueId: group.hostVenueId, games });
  });
  if (entrantIds.size !== edition.groups.length * 4) {
    throw new Error('regional national draw is incomplete');
  }
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId, region: edition.region,
    formatVersion: edition.formatVersion,
    qualificationSnapshotId: edition.qualificationSnapshotId,
    drawSnapshotId: edition.drawSnapshotId,
    groups: Object.freeze(groups) });
};

const compareThird = (left: Readonly<{ nationId: string;
  row: OfficialStandingRow }>,
right: Readonly<{ nationId: string; row: OfficialStandingRow }>,
policy: RegionalNationalEdition['bestThirdPolicy']): number => {
  for (const criterion of policy.criteria) {
    const difference = criterion === 'WINS'
      ? right.row.wins - left.row.wins
      : criterion === 'CAPPED_RUN_DIFFERENTIAL'
        ? right.row.cappedRunDifferential
          - left.row.cappedRunDifferential
        : left.row.runsAgainst - right.row.runsAgainst;
    if (difference !== 0) return difference;
  }
  return seededKey(policy.drawSeed, left.nationId)
    - seededKey(policy.drawSeed, right.nationId)
    || (left.nationId < right.nationId ? -1 : 1);
};

/** One game per opponent; unresolved group ties block knockout advancement. */
export const finalizeRegionalNationalGroups = (
  plan: RegionalNationalGroupPlan,
  results: readonly OfficialGameResult[],
  edition: RegionalNationalEdition,
  authority: RegionalNationalAuthority,
): RegionalNationalGroupOutcome => {
  const expected = planRegionalNationalGroups(edition, authority);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('regional national plan contradicts its edition');
  }
  const requiredGames = expected.groups.length * 6;
  if (!Array.isArray(results) || results.length !== requiredGames
    || new Set(results.map((result) => result.gameId)).size
      !== requiredGames
    || new Set(results.map((result) => result.applicationId)).size
      !== requiredGames
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== requiredGames) {
    throw new Error('regional national groups require complete official games');
  }
  const groups = expected.groups.map((group) => {
    const groupResults = results.filter((result) =>
      group.games.some((game) => game.gameId === result.gameId));
    if (groupResults.length !== 6
      || groupResults.some((result) => {
        const game = group.games.find((planned) =>
          planned.gameId === result.gameId);
        return !game || result.seasonId !== edition.editionId
          || result.homeClubId !== game.homeNationId
          || result.awayClubId !== game.awayNationId
          || result.ruleProfileId !== edition.ruleProfileVersion
          || result.gamePolicyVersion !== edition.gamePolicyVersion
          || result.venueBinding?.gameId !== game.gameId
          || result.venueBinding.venueId !== game.venueId
          || !id(result.venueBinding.fixtureEventId)
          || !day(result.venueBinding.fixtureRevision)
          || !id(result.closureId) || !id(result.applicationId)
          || !day(result.durableRevision);
      })) {
      throw new Error('regional national result lacks official venue binding');
    }
    const standings = buildOfficialStandings({
      seasonId: edition.editionId,
      leagueId: JSON.stringify(['regional-national',
        edition.competitionId, group.groupIndex]),
      memberClubIds: group.nationIds,
      regularSeasonGamesPerClub: 3,
      games: group.games.map((game) => ({ gameId: game.gameId,
        homeClubId: game.homeNationId,
        awayClubId: game.awayNationId })),
      revisionEventIds: [] }, groupResults, edition.tiebreakPolicy);
    return Object.freeze({ groupIndex: group.groupIndex, standings,
      topTwoNationIds: standings.orderedClubIds === null
        ? null : Object.freeze(standings.orderedClubIds.slice(0, 2)),
      thirdPlaceNationId: standings.orderedClubIds?.[2] ?? null });
  });
  let bestThirdNationIds: readonly string[] | null = null;
  let knockoutNationIds: readonly string[] | null = null;
  if (groups.every((group) => group.topTwoNationIds !== null)) {
    const topTwo = groups.flatMap((group) => group.topTwoNationIds!);
    if (groups.length === 3) {
      const thirds = groups.map((group) => ({
        nationId: group.thirdPlaceNationId!,
        row: group.standings.rows.find((row) =>
          row.clubId === group.thirdPlaceNationId)!,
      })).sort((left, right) => compareThird(left, right,
        edition.bestThirdPolicy));
      bestThirdNationIds = Object.freeze(thirds.slice(0, 2)
        .map((item) => item.nationId));
    } else {
      bestThirdNationIds = Object.freeze([]);
    }
    knockoutNationIds = Object.freeze([
      ...topTwo, ...bestThirdNationIds]);
  }
  return Object.freeze({ plan: expected,
    groups: Object.freeze(groups), bestThirdNationIds,
    knockoutNationIds,
    resultApplicationIds: Object.freeze(results.map((result) =>
      result.applicationId)) });
};
