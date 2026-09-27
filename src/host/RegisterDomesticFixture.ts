import { isDeepStrictEqual } from 'node:util';
import { bindDomesticFixtureVenue,
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

/** Resolve a fixture from durable World heads, not caller-supplied Club data. */
export const registerDomesticFixtureFromWorld = (
  world: SqliteWorldSettlementStore,
  archive: SqliteDomesticScheduleStore,
  match: SqliteOfficialStateStore,
  input: Readonly<{
    careerId: string;
    seasonId: string;
    gameId: string;
  }>,
): DomesticFixtureVenue => {
  const history = archive.read(input.careerId, input.seasonId);
  if (!history) throw new Error('durable domestic schedule is missing');
  const { baseSchedule, revisions } = history;
  const schedule = captureOfficialStandingsSchedule(baseSchedule, revisions);
  const season = world.readSeason(input.careerId, input.seasonId);
  if (!season || !isDeepStrictEqual(season.schedule, schedule)
    || season.results.some((result) => result.gameId === input.gameId)) {
    throw new Error('domestic fixture does not match durable World season');
  }
  const game = applyScheduleRevisions(baseSchedule,
    revisions).games.find((item) => item.gameId === input.gameId);
  if (!game) throw new Error('domestic venue requires a scheduled game');
  const home = world.readClub(input.careerId, game.homeClubId);
  if (!home) throw new Error('domestic fixture home Club is missing');
  return registerDomesticFixture(match, {
    baseSchedule, revisions,
    gameId: input.gameId, venueRevisionAtGame: home.revision,
    history: { checkpoint: home.state, acceptedEvents: [] },
  });
};
