import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { DomesticFixtureVenue } from
  '../../core/world/competition/DomesticFixtureVenue';
import { matchesDomesticFixtureRevision } from
  '../../core/world/competition/DomesticFixtureVenue';
import type { BaseScheduleSnapshot,
  ScheduleRevisionEvent } from '../../core/world/competition/LeagueSchedule';
import { createLeagueSeasonEventSnapshot,
  type LeagueSeasonEventProfile } from
  '../../core/world/competition/LeagueSeasonEvents';
import { captureOfficialStandingsSchedule } from
  '../../core/world/competition/OfficialStandingsScheduleSource';
import { registerDomesticFixtureFromWorld } from
  '../RegisterDomesticFixture';
import type { PersistedMatch,
  SqliteOfficialStateStore } from '../SqliteOfficialStateStore';
import type { DurableDomesticSchedule,
  SqliteDomesticScheduleStore } from './SqliteDomesticScheduleStore';
import type { DurableOfficialWorldSettlementRequest,
  SqliteOfficialWorldSettlementOutbox } from
  './SqliteOfficialWorldSettlementOutbox';
import type { OfficialWorldSettlementResult } from
  './OfficialWorldSettlementDriver';
import type { InitializeWorldSeason,
  SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';

export type DomesticSeasonStores = Readonly<{
  world: SqliteWorldSettlementStore;
  archive: SqliteDomesticScheduleStore;
  match: SqliteOfficialStateStore;
}>;
export type PreparedDomesticMatch = Readonly<{
  fixture: DomesticFixtureVenue;
  match: PersistedMatch;
}>;

/** First commit the World head, then archive its exact base schedule. Both retry. */
export const initializeDomesticSeason = (stores: DomesticSeasonStores,
  input: Omit<InitializeWorldSeason, 'schedule'> & Readonly<{
    baseSchedule: BaseScheduleSnapshot;
    eventProfile: LeagueSeasonEventProfile;
  }>): DurableDomesticSchedule => {
  const members = input.baseSchedule.memberClubIds;
  const clubs = input.clubs.map((club) => club.identity.clubId);
  if (clubs.length !== members.length
    || new Set(clubs).size !== clubs.length
    || members.some((clubId) => !clubs.includes(clubId))) {
    throw new Error('domestic season Club membership is incomplete');
  }
  createLeagueSeasonEventSnapshot(input.baseSchedule, input.eventProfile);
  stores.world.initialize({ careerId: input.careerId,
    schedule: captureOfficialStandingsSchedule(input.baseSchedule, []),
    standingsPolicy: input.standingsPolicy, clubs: input.clubs });
  const schedule = stores.archive.initialize(input.careerId,
    input.baseSchedule);
  stores.archive.initializeEvents(input.careerId,
    input.baseSchedule.seasonId, input.eventProfile);
  return schedule;
};

/** Never rewrite a fixture after its Match identity has been pinned. */
export const reviseDomesticSeasonSchedule = (
  stores: DomesticSeasonStores,
  input: Readonly<{ careerId: string; seasonId: string;
    expectedRevision: number; event: ScheduleRevisionEvent;
    acceptedAtDay: number }>,
): DurableDomesticSchedule => {
  if (stores.match.getOfficialFixture(input.event.gameId)
    || stores.match.getMatch(input.event.gameId)) {
    throw new Error('prepared domestic match cannot be rescheduled');
  }
  return stores.archive.appendRevision(input.careerId, input.seasonId,
    input.expectedRevision, input.event, input.acceptedAtDay);
};

/** Durable venue first, then Match setup; repeatable after either write. */
export const prepareDomesticMatch = (
  stores: DomesticSeasonStores,
  input: Readonly<{ careerId: string; seasonId: string;
    gameId: string; matchState: CanonicalMatchState }>,
): PreparedDomesticMatch => {
  const fixture = registerDomesticFixtureFromWorld(stores.world,
    stores.archive, stores.match, input);
  const match = stores.match.initializeMatch(input.gameId, input.matchState);
  return Object.freeze({ fixture, match });
};

/** Intake an exact, replayable final request only for the archived fixture. */
export const settleDomesticGame = (
  stores: DomesticSeasonStores & Readonly<{
    outbox: SqliteOfficialWorldSettlementOutbox;
  }>,
  request: DurableOfficialWorldSettlementRequest,
): OfficialWorldSettlementResult => {
  const { finalInput, worldInput } = request;
  const archive = stores.archive.read(worldInput.attendance.careerId,
    finalInput.game.seasonId);
  const fixture = stores.match.getOfficialFixture(finalInput.matchId);
  if (!archive || !fixture
    || !isDeepStrictEqual(fixture, finalInput.game.venueBinding)
    || !matchesDomesticFixtureRevision(fixture,
      worldInput.attendance.careerId,
      archive.baseSchedule, archive.revisions)
    || !isDeepStrictEqual(worldInput.schedule,
      captureOfficialStandingsSchedule(archive.baseSchedule,
        archive.revisions))) {
    throw new Error('domestic final lacks its durable schedule or fixture');
  }
  return stores.outbox.submit(request, {
    matchStore: stores.match, worldStore: stores.world });
};
import { isDeepStrictEqual } from 'node:util';
