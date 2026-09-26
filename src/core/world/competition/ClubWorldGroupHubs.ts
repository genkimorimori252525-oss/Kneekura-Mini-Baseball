import { drawCompetitionGroups, type CompetitionDraw,
  type CompetitionDrawPolicyRegistry, type DrawParticipant }
  from './CompetitionDraw';
import type { CompetitionEditionSnapshot } from './CompetitionEdition';
import type { ClubWorldBerthAllocation } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { buildOfficialStandings, type OfficialStandingsSnapshot,
  type StandingsTiebreakPolicy } from './OfficialStandings';

export type ClubWorldGroupHubSource = Readonly<{
  edition: CompetitionEditionSnapshot;
  berths: ClubWorldBerthAllocation;
  drawSeed: string;
  drawParticipants: readonly DrawParticipant[];
  drawRegistry: CompetitionDrawPolicyRegistry;
  rematchPairs: readonly (readonly [string, string])[];
  hubPolicyVersion: string;
}>;
export type ClubWorldGroupGame = Readonly<{
  gameId: string;
  seriesId: string;
  gameIndex: 1 | 2 | 3;
  groupIndex: number;
  homeClubId: string;
  awayClubId: string;
  neutralVenueId: string;
  fixtureEventId: string;
}>;
export type ClubWorldGroupHubPlan = Readonly<{
  competitionId: string;
  editionId: string;
  qualificationPolicyVersion: string;
  draw: CompetitionDraw;
  hubPolicyVersion: string;
  groups: readonly Readonly<{
    groupIndex: number;
    memberClubIds: readonly string[];
    hub: Readonly<{ nationId: string; cityId: string; venueId: string }>;
    games: readonly ClubWorldGroupGame[];
  }>[];
}>;
export type ClubWorldGroupHubResults = Readonly<{
  plan: ClubWorldGroupHubPlan;
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

/** Pin 72 official game identities at four hubs inside the edition host. */
export const createClubWorldGroupHubPlan = (
  source: ClubWorldGroupHubSource,
): ClubWorldGroupHubPlan => {
  const edition = source?.edition;
  const berths = source?.berths;
  if (!id(edition?.competitionId) || !id(edition.editionId)
    || edition.canonicalRole !== 'CLUB_WORLD'
    || edition.formatVersion !== 'club-world-16-v1'
    || berths?.editionId !== edition.editionId
    || berths.policyVersion !== 'club-world-qualification-v1'
    || !id(source.hubPolicyVersion)
    || source.hubPolicyVersion !== edition.hostingPolicyVersion
    || !id(source.drawSeed)
    || !Array.isArray(source.drawParticipants)
    || source.drawParticipants.length !== 16
    || !Array.isArray(source.rematchPairs)
    || !Array.isArray(edition.groupHubs)
    || edition.groupHubs.length !== 4
    || !Array.isArray(berths.entrantClubIds)
    || berths.entrantClubIds.length !== 16
    || new Set(berths.entrantClubIds).size !== 16
    || !Array.isArray(berths.slots) || berths.slots.length !== 16
    || !Array.isArray(edition.participantIds)
    || edition.participantIds.length !== 16
    || new Set(edition.participantIds).size !== 16) {
    throw new Error('invalid Club World sixteen-club edition or qualification');
  }
  const berthByClub = new Map(berths.slots.map((slot) =>
    [slot.clubId, slot]));
  if (berthByClub.size !== 16
    || berths.slots.some((slot, index) => slot.berthIndex !== index
      || slot.clubId !== berths.entrantClubIds[index])
    || edition.participantIds.some((clubId) => !berthByClub.has(clubId))
    || source.drawParticipants.some((entry) =>
      !berthByClub.has(entry.teamId)
      || entry.regionId !== berthByClub.get(entry.teamId)!.region)) {
    throw new Error('Club World draw region or entrants contradict qualification');
  }
  const draw = drawCompetitionGroups({ editionId: edition.editionId,
    profile: edition, drawSeed: source.drawSeed, groupCount: 4,
    participants: source.drawParticipants,
    rematchPairs: source.rematchPairs }, source.drawRegistry);
  const cityIds = new Set<string>();
  const venueIds = new Set<string>();
  const groups = draw.groups.map((members, groupIndex) => {
    const hub = edition.groupHubs![groupIndex];
    if (!hub || hub.groupIndex !== groupIndex
      || hub.nationId !== edition.host.nationId
      || !edition.host.cityIds.includes(hub.cityId)
      || !edition.host.venueIds.includes(hub.venueId)
      || cityIds.has(hub.cityId) || venueIds.has(hub.venueId)) {
      throw new Error('Club World requires four distinct edition group hubs');
    }
    cityIds.add(hub.cityId);
    venueIds.add(hub.venueId);
    const memberClubIds = members.map((member) => member.teamId);
    const games = pairs.flatMap(([first, second]) => {
      const seriesId = JSON.stringify(['club-world-group-series',
        edition.competitionId, edition.editionId, groupIndex,
        memberClubIds[first], memberClubIds[second]]);
      const preferredHome = first === 0 && second === 3 ? second : first;
      return ([1, 2, 3] as const).map((gameIndex) => {
        const homeIndex = gameIndex === 2
          ? (preferredHome === first ? second : first) : preferredHome;
        const awayIndex = homeIndex === first ? second : first;
        const gameId = JSON.stringify(['club-world-group-game',
          seriesId, gameIndex]);
        return Object.freeze({ gameId, seriesId, gameIndex, groupIndex,
        homeClubId: memberClubIds[homeIndex],
        awayClubId: memberClubIds[awayIndex], neutralVenueId: hub.venueId,
        fixtureEventId: JSON.stringify(['club-world-fixture', gameId,
          hub.venueId]) });
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
    qualificationPolicyVersion: berths.policyVersion,
    draw, hubPolicyVersion: source.hubPolicyVersion,
    groups: Object.freeze(groups) });
};

/** Recompute the pinned plan and rank only complete venue-bound results. */
export const finalizeClubWorldGroupHubs = (
  plan: ClubWorldGroupHubPlan,
  results: readonly OfficialGameResult[],
  policy: StandingsTiebreakPolicy,
  source: ClubWorldGroupHubSource,
): ClubWorldGroupHubResults => {
  const expected = createClubWorldGroupHubPlan(source);
  if (!plan || plan.competitionId !== expected.competitionId
    || plan.editionId !== expected.editionId
    || plan.qualificationPolicyVersion !== expected.qualificationPolicyVersion
    || plan.hubPolicyVersion !== expected.hubPolicyVersion
    || JSON.stringify(plan.draw) !== JSON.stringify(expected.draw)
    || !Array.isArray(plan.groups) || plan.groups.length !== 4
    || plan.groups.some((group, index) => {
      const original = expected.groups[index];
      return group?.groupIndex !== original.groupIndex
        || JSON.stringify(group.memberClubIds)
          !== JSON.stringify(original.memberClubIds)
        || JSON.stringify(group.hub) !== JSON.stringify(original.hub)
        || !Array.isArray(group.games) || group.games.length !== 18
        || group.games.some((game: ClubWorldGroupGame, gameIndex: number) =>
          JSON.stringify(game) !== JSON.stringify(original.games[gameIndex]));
    })) {
    throw new Error('Club World group plan contradicts edition, draw or hubs');
  }
  const games = expected.groups.flatMap((group) => group.games);
  if (!Array.isArray(results) || results.length !== 72) {
    throw new Error('Club World groups require 72 complete official results');
  }
  const byGame = new Map(results.map((result) =>
    [result.gameId, result]));
  if (byGame.size !== 72
    || new Set(results.map((result) => result.applicationId)).size !== 72
    || new Set(results.map((result) =>
      result.venueBinding?.fixtureEventId)).size !== 72
    || games.some((game) => {
      const result = byGame.get(game.gameId);
      return !result || result.venueBinding?.gameId !== game.gameId
        || result.venueBinding.venueId !== game.neutralVenueId
        || result.venueBinding.fixtureEventId !== game.fixtureEventId
        || !Number.isSafeInteger(result.venueBinding.fixtureRevision)
        || result.venueBinding.fixtureRevision < 0;
    })) {
    throw new Error('Club World official games require unique hub venue bindings');
  }
  const groups = expected.groups.map((group, groupIndex) => {
    const standings = buildOfficialStandings({ seasonId: expected.editionId,
      leagueId: expected.competitionId,
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
