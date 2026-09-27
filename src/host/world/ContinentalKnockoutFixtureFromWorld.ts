import type { OfficialGameVenueBinding } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqliteOfficialStateStore } from
  '../SqliteOfficialStateStore';
import { readAcceptedContinentalHomeClub } from
  './ContinentalGroupFixtureFromWorld';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import type { SqliteContinentalFinalFourStore } from
  './SqliteContinentalFinalFourStore';
import type { SqliteContinentalQuarterfinalStore } from
  './SqliteContinentalQuarterfinalStore';
import type { SqliteWorldSettlementStore } from
  './SqliteWorldSettlementStore';

const assertDay = (day: number, startsOnDay: number,
  endsOnDay: number): void => {
  if (!Number.isSafeInteger(day) || day < startsOnDay
    || day > endsOnDay) {
    throw new Error('continental knockout day is outside accepted Edition');
  }
};

/** A group winner hosts its single quarterfinal at its actual Club venue. */
export const registerContinentalQuarterfinalFixtureFromWorld = (
  stores: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    quarterfinals: Pick<SqliteContinentalQuarterfinalStore, 'readPlan'>;
    world: Pick<SqliteWorldSettlementStore, 'readClubHistory'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>,
  input: Readonly<{ careerId: string; editionId: string;
    gameId: string; gameDay: number }>,
): OfficialGameVenueBinding => {
  const edition = stores.editions.readEdition(input.careerId,
    input.editionId);
  const plan = stores.quarterfinals.readPlan(input.careerId,
    input.editionId);
  if (!edition || !plan || edition.canonicalRole !== 'CONTINENTAL_CL'
    || edition.editionId !== plan.editionId
    || edition.competitionId !== plan.competitionId) {
    throw new Error('quarterfinal fixture lacks accepted Edition plan');
  }
  assertDay(input.gameDay, edition.calendarWindow.startsOnDay,
    edition.calendarWindow.endsOnDay);
  const game = plan.games.find((item) => item.gameId === input.gameId);
  if (!game) throw new Error('quarterfinal fixture game is absent');
  const history = stores.world.readClubHistory(input.careerId,
    game.homeClubId);
  if (!history) throw new Error('quarterfinal home Club history is missing');
  const club = readAcceptedContinentalHomeClub({
    careerId: input.careerId, editionId: input.editionId,
    gameDay: input.gameDay, homeClubId: game.homeClubId, history,
  });
  const venueId = club.institutional.stadium.stadiumId;
  const binding = Object.freeze({ gameId: game.gameId, venueId,
    fixtureEventId: JSON.stringify(['continental-quarterfinal-fixture-v1',
      input.careerId, input.editionId, game.gameId,
      input.gameDay, plan.policyVersion, plan.drawSeed,
      club.revision, venueId]), fixtureRevision: 1 });
  stores.matches.registerOfficialFixture(binding);
  return binding;
};

/** Both semifinals and the final use the venue frozen by Edition policy. */
export const registerContinentalFinalFourFixtureFromWorld = (
  stores: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    finalFours: Pick<SqliteContinentalFinalFourStore, 'readPlan'>;
    matches: Pick<SqliteOfficialStateStore, 'registerOfficialFixture'>;
  }>,
  input: Readonly<{ careerId: string; editionId: string;
    gameId: string; gameDay: number }>,
): OfficialGameVenueBinding => {
  const edition = stores.editions.readEdition(input.careerId,
    input.editionId);
  const plan = stores.finalFours.readPlan(input.careerId,
    input.editionId);
  if (!edition || !plan || edition.canonicalRole !== 'CONTINENTAL_CL'
    || edition.editionId !== plan.editionId
    || edition.competitionId !== plan.competitionId
    || edition.hostingPolicyVersion !== plan.hostingPolicyVersion
    || edition.finalFourHost?.selectedVenueId !== plan.hostVenueId
    || !edition.host.venueIds.includes(plan.hostVenueId)
    || !plan.semifinalGames.every((game) =>
      game.neutralVenueId === plan.hostVenueId)) {
    throw new Error('final four fixture lacks accepted Edition host');
  }
  assertDay(input.gameDay, edition.calendarWindow.startsOnDay,
    edition.calendarWindow.endsOnDay);
  if (input.gameId !== plan.finalGameId
    && !plan.semifinalGames.some((game) =>
      game.gameId === input.gameId)) {
    throw new Error('final four fixture game is absent');
  }
  const binding = Object.freeze({ gameId: input.gameId,
    venueId: plan.hostVenueId,
    fixtureEventId: JSON.stringify(['continental-final-four-fixture-v1',
      input.careerId, input.editionId, input.gameId,
      input.gameDay, plan.hostingPolicyVersion,
      plan.pairingPolicyVersion, plan.hostVenueId]),
    fixtureRevision: 1 });
  stores.matches.registerOfficialFixture(binding);
  return binding;
};
