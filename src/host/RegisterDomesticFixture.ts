import { isDeepStrictEqual } from 'node:util';
import { bindDomesticFixtureVenue, matchesDomesticFixtureRevision,
  type DomesticFixtureVenue,
  type DomesticFixtureVenueHistory } from '../core/world/competition/DomesticFixtureVenue';
import type { BaseScheduleSnapshot,
  ScheduleRevisionEvent } from '../core/world/competition/LeagueSchedule';
import { applyScheduleRevisions } from
  '../core/world/competition/LeagueSchedule';
import { captureOfficialStandingsSchedule } from
  '../core/world/competition/OfficialStandingsScheduleSource';
import { SqliteOfficialStateStore } from './SqliteOfficialStateStore';
import type { SqliteWorldSettlementStore } from
  './world/SqliteWorldSettlementStore';
import type { SqliteDomesticScheduleStore } from
  './world/SqliteDomesticScheduleStore';

/** Register the Club's actual scheduled home stadium before match setup. */
export const registerDomesticFixture = (
  store: SqliteOfficialStateStore,
  input: Readonly<{
    baseSchedule: BaseScheduleSnapshot;
    revisions: readonly ScheduleRevisionEvent[];
    gameId: string;
    venueRevisionAtGame: number;
    history: DomesticFixtureVenueHistory;
  }>,
): DomesticFixtureVenue => {
  const fixture = bindDomesticFixtureVenue(input);
  store.registerOfficialFixture(fixture.binding);
  return fixture;
};

/** Authenticate a retained fixture against its original accepted Club prefix. */
export const readDomesticFixtureFromWorld = (
  world: SqliteWorldSettlementStore,
  archive: SqliteDomesticScheduleStore,
  match: SqliteOfficialStateStore,
  input: Readonly<{
    careerId: string;
    seasonId: string;
    gameId: string;
  }>,
): DomesticFixtureVenue | null => {
  const pinned = match.getOfficialFixture(input.gameId);
  if (!pinned) return null;
  return resolveDomesticFixtureFromWorld(world, archive, input, pinned);
};

const resolveDomesticFixtureFromWorld = (
  world: SqliteWorldSettlementStore, archive: SqliteDomesticScheduleStore,
  input: Readonly<{ careerId: string; seasonId: string; gameId: string }>,
  pinned: ReturnType<SqliteOfficialStateStore['getOfficialFixture']>,
): DomesticFixtureVenue => {
  const history = archive.read(input.careerId, input.seasonId);
  if (!history) throw new Error('durable domestic schedule is missing');
  const { baseSchedule, revisions } = history;
  const schedule = captureOfficialStandingsSchedule(baseSchedule, revisions);
  const season = world.readSeason(input.careerId, input.seasonId);
  if (!season || !isDeepStrictEqual(season.schedule, schedule)) {
    throw new Error('domestic fixture does not match durable World season');
  }
  const game = applyScheduleRevisions(baseSchedule,
    revisions).games.find((item) => item.gameId === input.gameId);
  if (!game) throw new Error('domestic venue requires a scheduled game');
  const clubHistory = world.readClubHistory(input.careerId,
    game.homeClubId);
  if (!clubHistory) {
    throw new Error('domestic fixture home Club history is missing');
  }
  const acceptedByGameDay = clubHistory.acceptedEvents.filter((event) =>
    event.command.effectiveDay <= game.day);
  if (pinned && !matchesDomesticFixtureRevision(pinned, input.careerId, baseSchedule, revisions)) {
    throw new Error('domestic fixture original schedule differs');
  }
  const parts = pinned ? JSON.parse(pinned.fixtureEventId) as unknown[] : null;
  const venueRevisionAtGame = parts ? parts[parts.length - 2] as number : acceptedByGameDay.at(-1)?.afterRevision
    ?? clubHistory.checkpoint.revision;
  const fixture = bindDomesticFixtureVenue({
    baseSchedule, revisions, gameId: input.gameId, venueRevisionAtGame,
    history: pinned ? { ...clubHistory, acceptedEvents: clubHistory.acceptedEvents.filter(event =>
      event.afterRevision <= venueRevisionAtGame) } : clubHistory,
  });
  if (pinned && !isDeepStrictEqual(fixture.binding, pinned)) throw new Error('domestic fixture original Club prefix differs');
  return fixture;
};

/** Retry retains the accepted venue revision even after later same-day events. */
export const registerDomesticFixtureFromWorld = (
  world: SqliteWorldSettlementStore, archive: SqliteDomesticScheduleStore,
  match: SqliteOfficialStateStore,
  input: Readonly<{ careerId: string; seasonId: string; gameId: string }>,
  acceptedDay?: number,
): DomesticFixtureVenue => {
  const fixture = resolveDomesticFixtureFromWorld(world, archive, input, match.getOfficialFixture(input.gameId));
  if (world.readSeason(input.careerId, input.seasonId)?.results.some(result => result.gameId === input.gameId)) {
    throw new Error('domestic fixture does not match durable World season');
  }
  if (acceptedDay === undefined) match.registerOfficialFixture(fixture.binding);
  else match.registerOfficialFixture(fixture.binding, (db, binding) =>
    archive.assertFixtureDayAtWrite(db, { ...input, day: acceptedDay }, binding));
  return fixture;
};
