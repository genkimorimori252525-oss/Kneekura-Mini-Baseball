import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { settleRegularSeasonGame, type RegularSeasonGameInput } from
  '../../core/world/competition/OfficialSeasonEconomySettlement';
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
import type { SqliteMatchdayAttendanceStore } from
  './SqliteMatchdayAttendanceStore';
import type { DurableOfficialWorldSettlementRequest,
  SqliteOfficialWorldSettlementOutbox } from
  './SqliteOfficialWorldSettlementOutbox';
import type { OfficialWorldSettlementResult } from
  './OfficialWorldSettlementDriver';
import type { DurableWorldSeason, InitializeWorldSeason,
  SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import type { openSqliteActualLivePlayClosureStore } from
  './SqliteActualLivePlayClosureStore';

export type DomesticSeasonStores = Readonly<{
  world: SqliteWorldSettlementStore;
  archive: SqliteDomesticScheduleStore;
  match: SqliteOfficialStateStore;
}>;
export type PreparedDomesticMatch = Readonly<{
  fixture: DomesticFixtureVenue;
  match: PersistedMatch;
}>;
export type CompletedDomesticSeason = Readonly<{
  archive: DurableDomesticSchedule;
  world: DurableWorldSeason & Readonly<{
    standings: Extract<DurableWorldSeason['standings'],
      { kind: 'OFFICIAL' }>;
  }>;
}>;

/** Read a season only after World standings and every Match final agree. */
export const readCompletedDomesticSeason = (
  stores: Readonly<{
    world: Pick<SqliteWorldSettlementStore, 'readSeason'>;
    archive: Pick<SqliteDomesticScheduleStore, 'read'>;
    match: Pick<SqliteOfficialStateStore,
      'getMatch' | 'getOfficialFixture'>;
  }>,
  careerId: string,
  seasonId: string,
): CompletedDomesticSeason | null => {
  const archive = stores.archive.read(careerId, seasonId);
  const world = stores.world.readSeason(careerId, seasonId);
  if (!archive && !world) return null;
  if (!archive || !world
    || archive.careerId !== careerId
    || archive.seasonId !== seasonId
    || world.careerId !== careerId
    || world.seasonId !== seasonId
    || !isDeepStrictEqual(world.schedule,
      captureOfficialStandingsSchedule(archive.baseSchedule,
        archive.revisions))) {
    throw new Error('domestic season archive and World disagree');
  }
  if (world.standings.kind !== 'OFFICIAL') return null;
  if (world.results.length !== world.schedule.games.length) {
    throw new Error('completed domestic season result count differs');
  }
  for (const fixture of world.schedule.games) {
    const result = world.results.find(item =>
      item.gameId === fixture.gameId);
    const match = stores.match.getMatch(fixture.gameId);
    const venue = stores.match.getOfficialFixture(fixture.gameId);
    if (!result || result.seasonId !== seasonId
      || result.homeClubId !== fixture.homeClubId
      || result.awayClubId !== fixture.awayClubId
      || !match || !match.finalResult
      || !venue || !result.venueBinding
      || !isDeepStrictEqual(match.finalResult, result)
      || !isDeepStrictEqual(venue, result.venueBinding)) {
      throw new Error('completed domestic season lacks durable Match final');
    }
  }
  return Object.freeze({ archive,
    world: world as CompletedDomesticSeason['world'] });
};

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

type DomesticGameSettlementStores = DomesticSeasonStores & Readonly<{
  outbox: SqliteOfficialWorldSettlementOutbox;
  attendance: SqliteMatchdayAttendanceStore;
}>;
const assertDomesticGameSources = (
  stores: DomesticGameSettlementStores,
  request: DurableOfficialWorldSettlementRequest,
  historicalSchedule = false,
): void => {
  const { finalInput, worldInput } = request;
  const archive = stores.archive.read(worldInput.attendance.careerId,
    finalInput.game.seasonId);
  const fixture = stores.match.getOfficialFixture(finalInput.matchId);
  // A retained request may precede an unrelated accepted rainout. Authenticate
  // its exact schedule prefix without substituting today's schedule into it.
  const prefixLength = archive && historicalSchedule
    ? worldInput.schedule.revisionEventIds.length
      - archive.baseSchedule.revisionEventIds.length
    : archive?.revisions.length;
  if (!archive || !fixture
    || prefixLength === undefined || prefixLength === null
    || prefixLength < 0 || prefixLength > archive.revisions.length
    || !isDeepStrictEqual(fixture, finalInput.game.venueBinding)
    || !matchesDomesticFixtureRevision(fixture,
      worldInput.attendance.careerId,
      archive.baseSchedule, archive.revisions)
    || !isDeepStrictEqual(worldInput.schedule,
      captureOfficialStandingsSchedule(archive.baseSchedule,
        archive.revisions.slice(0, prefixLength)))) {
    throw new Error('domestic final lacks its durable schedule or fixture');
  }
  const acceptedAttendance = stores.attendance.read(
    worldInput.attendance.factId);
  if (!acceptedAttendance
    || !isDeepStrictEqual(acceptedAttendance, worldInput.attendance)) {
    throw new Error('domestic final lacks accepted gate count evidence');
  }
};

/** Intake an exact, replayable final request only for the archived fixture. */
export const settleDomesticGame = (
  stores: DomesticGameSettlementStores,
  request: DurableOfficialWorldSettlementRequest,
): OfficialWorldSettlementResult => {
  assertDomesticGameSources(stores, request);
  return stores.outbox.submit(request, {
    matchStore: stores.match, worldStore: stores.world });
};

/** Explicit accepted inputs only; this does not generate attendance, calibration
 * or wage commitments. Standings policy and Club state come from their owners. */
export type ActualLiveDomesticGameSettlementInput = Readonly<{
  closureSourceId: string;
  attendanceFactId: string;
  expectedSeasonRevision: number;
  expectedClubRevision: number;
}> & Pick<RegularSeasonGameInput,
  'wageSchedules' | 'revenuePolicy' | 'finalizedAtDay'>;

/** Assemble one genuinely completed actual-live game into the existing durable
 * Match/World workflow. Workload is authenticated here and is never reapplied. */
export const settleActualLiveDomesticGame = (
  stores: DomesticGameSettlementStores & Readonly<{
    closure: Pick<ReturnType<typeof openSqliteActualLivePlayClosureStore>,
      'readHistoricalReadiness'>;
  }>,
  raw: ActualLiveDomesticGameSettlementInput,
): OfficialWorldSettlementResult => {
  const input = cloneInert(raw);
  const fields = ['closureSourceId', 'attendanceFactId',
    'expectedSeasonRevision', 'expectedClubRevision', 'wageSchedules',
    'revenuePolicy', 'finalizedAtDay'];
  if (!input || Object.keys(input).length !== fields.length
    || fields.some(key => !Object.hasOwn(input, key))
    || [input.closureSourceId, input.attendanceFactId].some(value =>
      typeof value !== 'string' || !value || value !== value.trim())
    || [input.expectedSeasonRevision, input.expectedClubRevision,
      input.finalizedAtDay].some(value =>
      !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('invalid actual-live domestic settlement input');
  }
  const readiness = stores.closure.readHistoricalReadiness(
    input.closureSourceId);
  if (readiness.kind !== 'game_final'
    || readiness.settlement.kind !== 'complete') {
    throw new Error('actual-live final closure or original workload is pending');
  }
  const proposal = readiness.closure.proposal;
  const finalInput = proposal.application;
  const expected = proposal.expectedOfficial;
  if (!('game' in finalInput) || !('result' in expected)
    || !proposal.source.finalScoring) {
    throw new Error('actual-live closure lacks accepted final scoring');
  }
  const durableMatch = stores.match.getMatch(finalInput.matchId);
  if (!durableMatch
    || durableMatch.durableRevision !== expected.receipt.durableRevision
    || !isDeepStrictEqual(durableMatch.matchState,
      expected.receipt.appliedMatchState)
    || !isDeepStrictEqual(durableMatch.finalResult, expected.result)) {
    throw new Error('actual-live final differs from durable official Match');
  }
  const attendance = stores.attendance.read(input.attendanceFactId);
  const careerId = proposal.seasonFixture.careerId;
  if (!attendance || attendance.careerId !== careerId
    || attendance.gameId !== finalInput.matchId) {
    throw new Error('actual-live final lacks accepted gate count evidence');
  }
  const prior = stores.outbox.read(finalInput.applicationId);
  const supplied = { attendance, wageSchedules: input.wageSchedules,
    revenuePolicy: input.revenuePolicy, finalizedAtDay: input.finalizedAtDay };
  const revisions = { expectedSeasonRevision: input.expectedSeasonRevision,
    expectedClubRevision: input.expectedClubRevision };
  let request: DurableOfficialWorldSettlementRequest;
  if (prior) {
    request = { finalInput, ...revisions,
      worldInput: { ...prior.request.worldInput, ...supplied } };
    if (!isDeepStrictEqual(request, prior.request)) {
      throw new Error('actual-live World settlement input was frozen differently');
    }
    // The policy is immutable for this season. Outcome-neutral tampering must
    // fail even when rederiving this particular game produces the same rows.
    const season = stores.world.readSeason(careerId, finalInput.game.seasonId);
    if (!season || !isDeepStrictEqual(request.worldInput.standingsPolicy,
      season.standingsPolicy)) {
      throw new Error('actual-live World standings policy differs');
    }
    assertDomesticGameSources(stores, request, true);
  } else {
    const season = stores.world.readSeason(careerId, finalInput.game.seasonId);
    const homeClub = stores.world.readClub(careerId, finalInput.game.homeClubId);
    const homeClubHistory = stores.world.readClubHistory(careerId,
      finalInput.game.homeClubId);
    if (!season || !homeClub || !homeClubHistory) {
      throw new Error('actual-live final lacks durable World season or Club');
    }
    if (season.revision !== input.expectedSeasonRevision
      || homeClub.revision !== input.expectedClubRevision) {
      throw new Error('stale actual-live World season or Club revision');
    }
    request = { finalInput, ...revisions, worldInput: { ...supplied,
      schedule: season.schedule, priorResults: season.results,
      standingsPolicy: season.standingsPolicy, homeClub: homeClub.state,
      homeClubHistory } };
  }
  // Validate before freezing intake, and derive from the retained inputs on
  // retries. A completed outbox receipt cannot authenticate its own basis.
  const settlement = settleRegularSeasonGame({ ...request.worldInput,
    game: { ...finalInput.game, gameId: finalInput.matchId,
      priorMatch: finalInput.match, application: expected.receipt } });
  if (request.expectedSeasonRevision !== request.worldInput.priorResults.length
    || request.expectedClubRevision !== request.worldInput.homeClub.revision
    || !isDeepStrictEqual(settlement.gameResult, expected.result)) {
    throw new Error('actual-live World settlement revision or final differs');
  }
  const result = prior ? stores.outbox.resume(finalInput.applicationId, {
    matchStore: stores.match, worldStore: stores.world })
    : settleDomesticGame(stores, request);
  const durableWorld = stores.world.readApplication(finalInput.applicationId);
  if (!durableWorld || !isDeepStrictEqual(result.final, expected)
    || !isDeepStrictEqual(result.world, durableWorld)
    || !isDeepStrictEqual(durableWorld.settlement, settlement)
    || durableWorld.seasonRevision !== request.expectedSeasonRevision + 1
    || durableWorld.clubRevision !== settlement.economy.state.revision) {
    throw new Error('actual-live final lacks authentic durable World settlement');
  }
  return result;
};
import { isDeepStrictEqual } from 'node:util';
