import { replayClubEvents } from '../club/ClubEvents';
import type { ClubTransitionEvent, ClubWorldState } from '../club/ClubTypes';
import { applyScheduleRevisions, type BaseScheduleSnapshot,
  type ScheduleRevisionEvent } from './LeagueSchedule';
import type { OfficialGameVenueBinding } from './OfficialGameCompletion';
import { captureOfficialStandingsSchedule } from './OfficialStandingsScheduleSource';

export type DomesticFixtureVenueHistory = Readonly<{
  checkpoint: ClubWorldState;
  acceptedEvents: readonly ClubTransitionEvent[];
}>;
export type DomesticFixtureVenueBasis = Readonly<{
  seasonId: string;
  leagueId: string;
  gameId: string;
  gameDay: number;
  homeClubId: string;
  scheduleRevisionEventIds: readonly string[];
  venueRevision: number;
  venueEventIds: readonly string[];
  stadiumId: string;
}>;
export type DomesticFixtureVenue = Readonly<{
  binding: OfficialGameVenueBinding;
  basis: DomesticFixtureVenueBasis;
}>;

/** Pin the scheduled home venue from accepted Club history before match setup. */
export const bindDomesticFixtureVenue = (input: Readonly<{
  baseSchedule: BaseScheduleSnapshot;
  revisions: readonly ScheduleRevisionEvent[];
  gameId: string;
  venueRevisionAtGame: number;
  history: DomesticFixtureVenueHistory;
}>): DomesticFixtureVenue => {
  const { baseSchedule, revisions, history } = input;
  // Reconstructing from the series prevents a caller from swapping fixtures.
  captureOfficialStandingsSchedule(baseSchedule, revisions);
  const current = applyScheduleRevisions(baseSchedule, revisions);
  const game = current.games.find((item) => item.gameId === input.gameId);
  if (!game) throw new Error('domestic venue requires a scheduled game');
  if (!Number.isSafeInteger(input.venueRevisionAtGame)
    || input.venueRevisionAtGame < 0
    || !history || !Array.isArray(history.acceptedEvents)
    || history.checkpoint.revision > input.venueRevisionAtGame) {
    throw new Error('invalid domestic venue revision history');
  }
  const full = replayClubEvents(history.checkpoint, history.acceptedEvents);
  if (!full.ok) throw new Error('invalid accepted Club venue history');
  const priorEvents = history.acceptedEvents.filter((event) =>
    event.afterRevision <= input.venueRevisionAtGame);
  const atGame = replayClubEvents(history.checkpoint, priorEvents);
  const nextEvent = history.acceptedEvents[priorEvents.length];
  if (!atGame.ok || atGame.value.revision !== input.venueRevisionAtGame
    || atGame.value.effectiveDay > game.day
    || (nextEvent && nextEvent.command.effectiveDay <= game.day)) {
    throw new Error('domestic venue revision is not current at game day');
  }
  const club = atGame.value;
  if (club.identity.clubId !== game.homeClubId
    || club.season.closureRef !== null
    || !club.season.plan.competitionEditionIds.includes(current.seasonId)
    || club.season.plan.financialProfile.leagueId !== current.leagueId
    || club.season.plan.startsOnDay > game.day
    || !club.institutional.stadium.stadiumId
    || club.institutional.stadium.capacity <= 0) {
    throw new Error('domestic fixture home Club or stadium mismatch');
  }
  const gameRevisions = revisions.filter((event) =>
    event.gameId === input.gameId);
  const fixtureRevision = 1 + gameRevisions.length;
  if (!Number.isSafeInteger(fixtureRevision)) {
    throw new Error('domestic fixture revision overflow');
  }
  const venueEventIds = priorEvents.map((event) => event.command.eventId);
  const fixtureEventId = JSON.stringify(['domestic-fixture-venue-v1',
    club.careerId, current.seasonId, game.gameId,
    ...gameRevisions.map((event) => event.eventId), club.revision,
    club.institutional.stadium.stadiumId]);
  return Object.freeze({ binding: Object.freeze({ gameId: game.gameId,
    venueId: club.institutional.stadium.stadiumId,
    fixtureEventId, fixtureRevision }),
  basis: Object.freeze({ seasonId: current.seasonId,
    leagueId: current.leagueId, gameId: game.gameId,
    gameDay: game.day, homeClubId: game.homeClubId,
    scheduleRevisionEventIds: Object.freeze(gameRevisions.map((event) => event.eventId)),
    venueRevision: club.revision,
    venueEventIds: Object.freeze(venueEventIds),
    stadiumId: club.institutional.stadium.stadiumId }) });
};

/** Check that a pinned fixture still cites this game's accepted revision chain. */
export const matchesDomesticFixtureRevision = (
  binding: OfficialGameVenueBinding,
  careerId: string,
  baseSchedule: BaseScheduleSnapshot,
  revisions: readonly ScheduleRevisionEvent[],
): boolean => {
  try {
    captureOfficialStandingsSchedule(baseSchedule, revisions);
    const current = applyScheduleRevisions(baseSchedule, revisions);
    if (!current.games.some((game) => game.gameId === binding.gameId)) {
      return false;
    }
    const gameRevisions = revisions.filter((event) =>
      event.gameId === binding.gameId);
    const parts = JSON.parse(binding.fixtureEventId) as unknown;
    return Array.isArray(parts)
      && parts.length === gameRevisions.length + 6
      && parts[0] === 'domestic-fixture-venue-v1'
      && parts[1] === careerId
      && parts[2] === current.seasonId
      && parts[3] === binding.gameId
      && gameRevisions.every((event, index) =>
        parts[4 + index] === event.eventId)
      && Number.isSafeInteger(parts[parts.length - 2])
      && parts[parts.length - 2] >= 0
      && parts[parts.length - 1] === binding.venueId
      && binding.fixtureRevision === gameRevisions.length + 1;
  } catch {
    return false;
  }
};
