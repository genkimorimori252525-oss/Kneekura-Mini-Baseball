import type { CompetitionDraw } from './CompetitionDraw';
import type { CompetitionEditionSnapshot } from './CompetitionEdition';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings, type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';

export type AfricaGroupHubSource = Readonly<{
  edition: CompetitionEditionSnapshot;
  draw: CompetitionDraw;
  hubPolicyVersion: string;
}>;
export type AfricaGroupHubGame = Readonly<{
  gameId: string;
  seriesId: string;
  gameIndex: 1 | 2 | 3;
  groupIndex: number;
  homeClubId: string;
  awayClubId: string;
  neutralVenueId: string;
}>;
export type AfricaGroupHubPlan = Readonly<{
  competitionId: string;
  editionId: string;
  drawPolicyVersion: string;
  hubPolicyVersion: string;
  groups: readonly Readonly<{
    groupIndex: number;
    memberClubIds: readonly string[];
    hub: Readonly<{ nationId: string; cityId: string; venueId: string }>;
    games: readonly AfricaGroupHubGame[];
  }>[];
}>;
export type AfricaGroupHubResults = Readonly<{
  plan: AfricaGroupHubPlan;
  tiebreakPolicyVersion: string;
  groups: readonly Readonly<{
    groupIndex: number;
    standings: OfficialStandingsSnapshot;
    qualifierClubIds: readonly string[] | null;
  }>[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const pairs = [[0, 1], [0, 2], [0, 3],
  [1, 2], [1, 3], [2, 3]] as const;

/** Pins 36 game identities at two preselected hubs, without a calendar. */
export const createAfricaGroupHubPlan = (
  source: AfricaGroupHubSource,
): AfricaGroupHubPlan => {
  const edition = source?.edition;
  const draw = source?.draw;
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || edition.canonicalRole !== 'AFBCL'
    || !id(source.hubPolicyVersion)
    || source.hubPolicyVersion !== edition.hostingPolicyVersion
    || draw?.editionId !== edition.editionId
    || !id(draw.drawPolicyVersion)
    || draw.drawPolicyVersion !== edition.drawPolicyVersion
    || !Array.isArray(draw.groups) || draw.groups.length !== 2
    || !Array.isArray(edition.groupHubs)
    || edition.groupHubs.length !== 2
    || !Array.isArray(edition.participantIds)
    || edition.participantIds.length !== 8
    || new Set(edition.participantIds).size !== 8) {
    throw new Error('invalid Africa eight-club edition or versioned hubs');
  }
  const seenClubs = new Set<string>();
  const plannedGroups = draw.groups;
  const hubs = edition.groupHubs;
  const groups = plannedGroups.map((members, groupIndex) => {
    const hub = hubs[groupIndex];
    if (!Array.isArray(members) || members.length !== 4
      || !hub || hub.groupIndex !== groupIndex
      || !id(hub.nationId) || !id(hub.cityId) || !id(hub.venueId)
      || !edition.host.cityIds.includes(hub.cityId)
      || !edition.host.venueIds.includes(hub.venueId)) {
      throw new Error('invalid Africa group hub or membership');
    }
    const memberClubIds = members.map((member) => member.teamId);
    if (memberClubIds.some((clubId) =>
      !id(clubId) || seenClubs.has(clubId)
      || !edition.participantIds.includes(clubId))
      || new Set(memberClubIds).size !== 4) {
      throw new Error('Africa draw must contain eight unique edition clubs');
    }
    memberClubIds.forEach((clubId) => seenClubs.add(clubId));
    const games = pairs.flatMap(([first, second]) => {
      const seriesId = JSON.stringify(['africa-group-series',
        edition.competitionId, edition.editionId,
        groupIndex, memberClubIds[first], memberClubIds[second]]);
      const preferredHome = first === 0 && second === 3
        ? second : first;
      return ([1, 2, 3] as const).map((gameIndex) => {
        const homeIndex = gameIndex === 2
          ? (preferredHome === first ? second : first)
          : preferredHome;
        const awayIndex = homeIndex === first ? second : first;
        return Object.freeze({ gameId: JSON.stringify(['africa-group-game',
          seriesId, gameIndex]), seriesId, gameIndex, groupIndex,
        homeClubId: memberClubIds[homeIndex],
        awayClubId: memberClubIds[awayIndex],
        neutralVenueId: hub.venueId });
      });
    });
    return Object.freeze({ groupIndex,
      memberClubIds: Object.freeze(memberClubIds),
      hub: Object.freeze({ nationId: hub.nationId,
        cityId: hub.cityId, venueId: hub.venueId }),
      games: Object.freeze(games) });
  });
  return Object.freeze({ competitionId: edition.competitionId,
    editionId: edition.editionId,
    drawPolicyVersion: draw.drawPolicyVersion,
    hubPolicyVersion: source.hubPolicyVersion,
    groups: Object.freeze(groups) });
};

/** Ranks only complete, venue-matched official hub games. */
export const finalizeAfricaGroupHubs = (
  plan: AfricaGroupHubPlan,
  results: readonly OfficialGameResult[],
  policy: StandingsTiebreakPolicy,
  source: AfricaGroupHubSource,
): AfricaGroupHubResults => {
  const expected = createAfricaGroupHubPlan(source);
  const planGroups: AfricaGroupHubPlan['groups'] = plan.groups;
  if (!plan || plan.competitionId !== expected.competitionId
    || plan.editionId !== expected.editionId
    || plan.drawPolicyVersion !== expected.drawPolicyVersion
    || plan.hubPolicyVersion !== expected.hubPolicyVersion
    || !Array.isArray(planGroups) || planGroups.length !== 2
    || planGroups.some((group, index) => {
      const original = expected.groups[index];
      const plannedGames: AfricaGroupHubPlan['groups'][number]['games'] =
        group.games;
      return group.groupIndex !== original.groupIndex
        || !Array.isArray(group.memberClubIds)
        || group.memberClubIds.join(',')
          !== original.memberClubIds.join(',')
        || group.hub?.nationId !== original.hub.nationId
        || group.hub.cityId !== original.hub.cityId
        || group.hub.venueId !== original.hub.venueId
        || !Array.isArray(plannedGames) || plannedGames.length !== 18
        || plannedGames.some((game, gameIndex) => {
          const scheduled = original.games[gameIndex];
          return game.gameId !== scheduled.gameId
            || game.seriesId !== scheduled.seriesId
            || game.gameIndex !== scheduled.gameIndex
            || game.groupIndex !== scheduled.groupIndex
            || game.homeClubId !== scheduled.homeClubId
            || game.awayClubId !== scheduled.awayClubId
            || game.neutralVenueId !== scheduled.neutralVenueId;
        });
    })) {
    throw new Error('Africa group hub plan contradicts edition or draw');
  }
  const games = expected.groups.flatMap((group) => group.games);
  if (!Array.isArray(results) || results.length !== 36) {
    throw new Error('Africa groups require 36 complete official results');
  }
  const byGame = new Map(results.map((result) =>
    [result.gameId, result]));
  if (byGame.size !== 36
    || new Set(results.map((result) => result.applicationId)).size !== 36
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 36
    || games.some((game) => {
      const result = byGame.get(game.gameId);
      return !result || result.venueBinding?.gameId !== game.gameId
        || result.venueBinding.venueId !== game.neutralVenueId
        || !id(result.venueBinding.fixtureEventId)
        || !Number.isSafeInteger(result.venueBinding.fixtureRevision)
        || result.venueBinding.fixtureRevision < 0;
    })) {
    throw new Error('Africa official games require unique hub venue bindings');
  }
  const groups = expected.groups.map((group, groupIndex) => {
    const standings = buildOfficialStandings({
      seasonId: expected.editionId, leagueId: expected.competitionId,
      memberClubIds: group.memberClubIds,
      regularSeasonGamesPerClub: 9,
      games: group.games, revisionEventIds: [],
    }, group.games.map((game) => byGame.get(game.gameId)!), policy);
    const topTwo = standings.rows.slice(0, 2).map((row) => row.clubId);
    const unresolved = standings.unresolvedTieGroups.some((tie) =>
      tie.some((clubId) => topTwo.includes(clubId)));
    return Object.freeze({ groupIndex, standings,
      qualifierClubIds: unresolved ? null : Object.freeze(topTwo) });
  });
  return Object.freeze({ plan: expected,
    tiebreakPolicyVersion: policy.version,
    groups: Object.freeze(groups) });
};
