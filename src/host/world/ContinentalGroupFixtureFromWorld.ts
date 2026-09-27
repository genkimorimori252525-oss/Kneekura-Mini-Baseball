import { replayClubEvents } from '../../core/world/club/ClubEvents';
import type { MatchdayClubHistory } from
  '../../core/world/club/OfficialMatchdayRevenue';
import type { ClubWorldState } from
  '../../core/world/club/ClubTypes';
import type { OfficialGameVenueBinding } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqliteOfficialStateStore } from
  '../SqliteOfficialStateStore';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import type { SqliteContinentalHomeStore } from
  './SqliteContinentalHomeStore';
import type { SqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

export type ContinentalGroupFixtureBasis = Readonly<{
  careerId: string;
  editionId: string;
  competitionId: string;
  gameId: string;
  gameDay: number;
  homeClubId: string;
  clubRevision: number;
  stadiumId: string;
  drawPolicyVersion: string;
  homeFairnessPolicyVersion: string;
}>;
export type ContinentalGroupFixture = Readonly<{
  basis: ContinentalGroupFixtureBasis;
  binding: OfficialGameVenueBinding;
}>;

/** Shared Club venue authority for group and winner-home knockout games. */
export const readAcceptedContinentalHomeClub = (input: Readonly<{
  careerId: string;
  editionId: string;
  gameDay: number;
  homeClubId: string;
  history: MatchdayClubHistory;
}>): ClubWorldState => {
  const { history } = input;
  if (!input.careerId || !input.editionId || !input.homeClubId
    || !Number.isSafeInteger(input.gameDay) || input.gameDay < 0
    || !history || !Array.isArray(history.acceptedEvents)
    || history.checkpoint.careerId !== input.careerId
    || history.checkpoint.identity.clubId !== input.homeClubId
    || history.checkpoint.effectiveDay > input.gameDay) {
    throw new Error('invalid continental group fixture source');
  }
  const full = replayClubEvents(history.checkpoint,
    history.acceptedEvents);
  if (!full.ok) throw new Error('invalid accepted Club venue history');
  const accepted = history.acceptedEvents.filter((event) =>
    event.command.effectiveDay <= input.gameDay);
  const atGame = replayClubEvents(history.checkpoint, accepted);
  const next = history.acceptedEvents[accepted.length];
  if (!atGame.ok || atGame.value.effectiveDay > input.gameDay
    || (next && next.command.effectiveDay <= input.gameDay)) {
    throw new Error('continental group Club venue history is not current');
  }
  const club = atGame.value;
  if (!club.season.plan.competitionEditionIds.includes(input.editionId)
    || club.season.plan.startsOnDay > input.gameDay
    || !club.institutional.stadium.stadiumId
    || club.institutional.stadium.capacity <= 0) {
    throw new Error('continental group home Club or stadium mismatch');
  }
  return club;
};

/** Use the accepted home Club at the accepted game day, never a venue label. */
export const bindContinentalGroupFixture = (input: Readonly<{
  careerId: string;
  editionId: string;
  competitionId: string;
  gameId: string;
  gameDay: number;
  homeClubId: string;
  drawPolicyVersion: string;
  homeFairnessPolicyVersion: string;
  history: MatchdayClubHistory;
}>): ContinentalGroupFixture => {
  if (!input.competitionId || !input.gameId
    || !input.drawPolicyVersion || !input.homeFairnessPolicyVersion) {
    throw new Error('invalid continental group fixture source');
  }
  const club = readAcceptedContinentalHomeClub(input);
  const basis = Object.freeze({ careerId: input.careerId,
    editionId: input.editionId, competitionId: input.competitionId,
    gameId: input.gameId, gameDay: input.gameDay,
    homeClubId: input.homeClubId, clubRevision: club.revision,
    stadiumId: club.institutional.stadium.stadiumId,
    drawPolicyVersion: input.drawPolicyVersion,
    homeFairnessPolicyVersion: input.homeFairnessPolicyVersion });
  const binding = Object.freeze({ gameId: input.gameId,
    venueId: basis.stadiumId,
    fixtureEventId: JSON.stringify(['continental-group-fixture-v1',
      basis.careerId, basis.editionId, basis.gameId, basis.gameDay,
      basis.drawPolicyVersion, basis.homeFairnessPolicyVersion,
      basis.clubRevision, basis.stadiumId]),
    fixtureRevision: 1 });
  return Object.freeze({ basis, binding });
};

/** Resolve Edition, home allocation and Club history before pinning Match. */
export const registerContinentalGroupFixtureFromWorld = (
  stores: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    homes: Pick<SqliteContinentalHomeStore, 'readAssignment'>;
    world: Pick<SqliteWorldSettlementStore, 'readClubHistory'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>,
  input: Readonly<{ careerId: string; editionId: string;
    gameId: string; gameDay: number }>,
): ContinentalGroupFixture => {
  const edition = stores.editions.readEdition(input.careerId,
    input.editionId);
  const home = stores.homes.readAssignment(input.careerId,
    input.editionId);
  if (!edition || !home || edition.canonicalRole !== 'CONTINENTAL_CL'
    || edition.editionId !== home.groupGamePlan.editionId
    || edition.competitionId !== home.groupGamePlan.competitionId
    || edition.drawPolicyVersion !== home.groupGamePlan.drawPolicyVersion
    || !Number.isSafeInteger(input.gameDay)
    || input.gameDay < edition.calendarWindow.startsOnDay
    || input.gameDay > edition.calendarWindow.endsOnDay) {
    throw new Error('continental group fixture differs from accepted Edition');
  }
  const members = home.groupGamePlan.groups.flatMap((group) =>
    group.memberClubIds);
  if (members.length !== edition.participantIds.length
    || new Set(members).size !== members.length
    || members.some((clubId) => !edition.participantIds.includes(clubId))) {
    throw new Error('continental group fixture participants differ');
  }
  const game = home.groupGamePlan.groups.flatMap((group) =>
    group.games).find((item) => item.gameId === input.gameId);
  if (!game) throw new Error('continental group fixture game is absent');
  const history = stores.world.readClubHistory(input.careerId,
    game.homeClubId);
  if (!history) throw new Error('continental home Club history is missing');
  const fixture = bindContinentalGroupFixture({
    careerId: input.careerId, editionId: input.editionId,
    competitionId: edition.competitionId,
    gameId: game.gameId, gameDay: input.gameDay,
    homeClubId: game.homeClubId,
    drawPolicyVersion: home.groupGamePlan.drawPolicyVersion,
    homeFairnessPolicyVersion:
      home.groupGamePlan.homeFairnessPolicyVersion,
    history,
  });
  stores.matches.registerOfficialFixture(fixture.binding);
  return fixture;
};
