import type { OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings, type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';
import type { WbcBerthAllocation } from './WbcBerths';

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const PAIRS: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

export type WbcFinalsGroupEdition = Readonly<{
  competitionId: string;
  editionId: string;
  canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP';
  formatVersion: string;
  ruleProfileVersion: string;
  gamePolicyVersion: string;
  hostingPolicyVersion: string;
  drawPolicyVersion: string;
  drawSnapshotId: string;
  qualificationSnapshotId: string;
  hostNationId: 'US';
  calendarWindow: Readonly<{ startsOnDay: number; endsOnDay: number }>;
  groupTiebreakPolicy: StandingsTiebreakPolicy;
  thirdPlacePolicy: Readonly<{ version: string;
    criteria: readonly ('WINS' | 'CAPPED_RUN_DIFFERENTIAL'
      | 'RUNS_AGAINST')[];
    drawSeed: string }>;
  groups: readonly Readonly<{ groupIndex: number;
    hostCityId: string; hostVenueId: string;
    nationIds: readonly string[] }>[];
}>;
export type WbcFinalsGroupGame = Readonly<{
  gameId: string;
  groupIndex: number;
  homeNationId: string;
  awayNationId: string;
  venueId: string;
}>;
export type WbcFinalsGroupPlan = Readonly<{
  competitionId: string;
  editionId: string;
  qualificationSnapshotId: string;
  drawSnapshotId: string;
  hostingPolicyVersion: string;
  groups: readonly Readonly<{ groupIndex: number;
    hostCityId: string; hostVenueId: string;
    nationIds: readonly string[];
    games: readonly WbcFinalsGroupGame[] }>[];
}>;
export type WbcFinalsGroupOutcome = Readonly<{
  plan: WbcFinalsGroupPlan;
  groups: readonly Readonly<{ groupIndex: number;
    standings: OfficialStandingsSnapshot;
    topTwoNationIds: readonly string[] | null;
    thirdPlaceNationId: string | null }>[];
  thirdPlacePolicyVersion: string;
  qualifiedThirdPlaceNationIds: readonly string[] | null;
  roundOf16NationIds: readonly string[] | null;
  resultApplicationIds: readonly string[];
}>;

const drawKey = (seed: string, nationId: string): number => {
  const source = JSON.stringify([seed, nationId]);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
};

/** Pins six US pool hosts and each nation to one three-game group. */
export const planWbcFinalsGroups = (
  edition: WbcFinalsGroupEdition,
  berths: WbcBerthAllocation,
): WbcFinalsGroupPlan => {
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || edition.canonicalRole !== 'NATIONAL_WORLD_CHAMPIONSHIP'
    || edition.hostNationId !== 'US'
    || !id(edition.formatVersion)
    || !id(edition.ruleProfileVersion)
    || !id(edition.gamePolicyVersion)
    || !id(edition.hostingPolicyVersion)
    || !id(edition.drawPolicyVersion)
    || !id(edition.drawSnapshotId)
    || !id(edition.qualificationSnapshotId)
    || !day(edition.calendarWindow?.startsOnDay)
    || !day(edition.calendarWindow?.endsOnDay)
    || edition.calendarWindow.endsOnDay
      < edition.calendarWindow.startsOnDay
    || !id(edition.groupTiebreakPolicy?.version)
    || !id(edition.thirdPlacePolicy?.version)
    || !id(edition.thirdPlacePolicy.drawSeed)
    || !Array.isArray(edition.thirdPlacePolicy.criteria)
    || edition.thirdPlacePolicy.criteria.length !== 3
    || new Set(edition.thirdPlacePolicy.criteria).size !== 3
    || !['WINS', 'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST']
      .every((criterion) => edition.thirdPlacePolicy.criteria
        .includes(criterion as typeof edition.thirdPlacePolicy.criteria[number]))
    || !Array.isArray(edition.groups) || edition.groups.length !== 6
    || berths?.editionId !== edition.editionId
    || berths.qualificationSnapshotId
      !== edition.qualificationSnapshotId
    || !Array.isArray(berths.entrantNationIds)
    || berths.entrantNationIds.length !== 24
    || new Set(berths.entrantNationIds).size !== 24) {
    throw new Error('WBC group edition must match 24 official berths');
  }
  const cities = new Set<string>();
  const venues = new Set<string>();
  const entrants = new Set<string>();
  const groups = edition.groups.map((group: WbcFinalsGroupEdition['groups'][number],
    groupIndex: number) => {
    if (!group || group.groupIndex !== groupIndex
      || !id(group.hostCityId) || cities.has(group.hostCityId)
      || !id(group.hostVenueId) || venues.has(group.hostVenueId)
      || !Array.isArray(group.nationIds)
      || group.nationIds.length !== 4
      || new Set(group.nationIds).size !== 4
      || group.nationIds.some((nationId) =>
        !id(nationId) || entrants.has(nationId)
        || !berths.entrantNationIds.includes(nationId))) {
      throw new Error('WBC group draw must partition entrants into six US pools');
    }
    cities.add(group.hostCityId);
    venues.add(group.hostVenueId);
    group.nationIds.forEach((nationId) => entrants.add(nationId));
    const nationIds = Object.freeze([...group.nationIds]);
    const games = Object.freeze(PAIRS.map((pair, gameIndex) =>
      Object.freeze({ gameId: JSON.stringify(['wbc-group',
        edition.competitionId, edition.editionId,
        groupIndex, gameIndex]), groupIndex,
      homeNationId: nationIds[pair[0]],
      awayNationId: nationIds[pair[1]],
      venueId: group.hostVenueId })));
    return Object.freeze({ groupIndex,
      hostCityId: group.hostCityId,
      hostVenueId: group.hostVenueId,
      nationIds, games });
  });
  if (entrants.size !== 24) {
    throw new Error('WBC group draw omits a qualified nation');
  }
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    qualificationSnapshotId: edition.qualificationSnapshotId,
    drawSnapshotId: edition.drawSnapshotId,
    hostingPolicyVersion: edition.hostingPolicyVersion,
    groups: Object.freeze(groups) });
};

/** Keeps unresolved ties visible until an official versioned rule settles them. */
export const finalizeWbcFinalsGroups = (
  plan: WbcFinalsGroupPlan,
  results: readonly OfficialGameResult[],
  edition: WbcFinalsGroupEdition,
  berths: WbcBerthAllocation,
): WbcFinalsGroupOutcome => {
  const expected = planWbcFinalsGroups(edition, berths);
  if (JSON.stringify(plan) !== JSON.stringify(expected)) {
    throw new Error('WBC group plan contradicts its edition and berths');
  }
  if (!Array.isArray(results) || results.length !== 36) {
    throw new Error('WBC groups require 36 official games');
  }
  const games = expected.groups.flatMap((group) => group.games);
  const byGame = new Map(games.map((game) => [game.gameId, game]));
  if (new Set(results.map((result) => result.gameId)).size !== 36
    || new Set(results.map((result) => result.applicationId)).size !== 36
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 36
    || results.some((result) => {
      const game = byGame.get(result.gameId);
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
    throw new Error('WBC group result lacks official venue-bound provenance');
  }
  const groups = expected.groups.map((group) => {
    const groupResults = results.filter((result) =>
      group.games.some((game) => game.gameId === result.gameId));
    const standings = buildOfficialStandings({
      seasonId: edition.editionId,
      leagueId: JSON.stringify(['wbc-group', edition.competitionId,
        group.groupIndex]),
      memberClubIds: group.nationIds,
      regularSeasonGamesPerClub: 3,
      games: group.games.map((game) => ({ gameId: game.gameId,
        homeClubId: game.homeNationId,
        awayClubId: game.awayNationId })),
      revisionEventIds: [] }, groupResults,
    edition.groupTiebreakPolicy);
    return Object.freeze({ groupIndex: group.groupIndex,
      standings, topTwoNationIds: standings.orderedClubIds === null
        ? null : Object.freeze(standings.orderedClubIds.slice(0, 2)),
      thirdPlaceNationId: standings.orderedClubIds?.[2] ?? null });
  });
  let qualifiedThirdPlaceNationIds: readonly string[] | null = null;
  let roundOf16NationIds: readonly string[] | null = null;
  if (groups.every((group) => group.thirdPlaceNationId !== null)) {
    const thirds = groups.map((group) => ({
      nationId: group.thirdPlaceNationId!,
      row: group.standings.rows.find((row) =>
        row.clubId === group.thirdPlaceNationId)!,
    }));
    thirds.sort((left, right) => {
      for (const criterion of edition.thirdPlacePolicy.criteria) {
        const comparison = criterion === 'WINS'
          ? right.row.wins - left.row.wins
          : criterion === 'CAPPED_RUN_DIFFERENTIAL'
            ? right.row.cappedRunDifferential
              - left.row.cappedRunDifferential
            : left.row.runsAgainst - right.row.runsAgainst;
        if (comparison !== 0) return comparison;
      }
      return drawKey(edition.thirdPlacePolicy.drawSeed, left.nationId)
        - drawKey(edition.thirdPlacePolicy.drawSeed, right.nationId)
        || (left.nationId < right.nationId ? -1 : 1);
    });
    qualifiedThirdPlaceNationIds = Object.freeze(thirds.slice(0, 4)
      .map((item) => item.nationId));
    roundOf16NationIds = Object.freeze([
      ...groups.flatMap((group) => group.topTwoNationIds!),
      ...qualifiedThirdPlaceNationIds]);
  }
  return Object.freeze({ plan: expected,
    groups: Object.freeze(groups),
    thirdPlacePolicyVersion: edition.thirdPlacePolicy.version,
    qualifiedThirdPlaceNationIds,
    roundOf16NationIds,
    resultApplicationIds: Object.freeze(results.map((result) =>
      result.applicationId)) });
};
