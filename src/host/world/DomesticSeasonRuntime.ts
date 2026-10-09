import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { getRuleProfile } from '../../core/rules/RuleProfile';
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
import type { PersistOfficialFinalInput, PersistOfficialFinalResult, PersistedMatch,
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
import type { SqlitePhysicalPlayClosureStore } from './SqlitePhysicalPlayClosureStore';
import type { openSqliteSamePlateAppearanceTerminalTransitionStore } from './SqliteSamePlateAppearanceTerminalTransitionStore';
import type { openSqliteSamePlateAppearanceTerminalSettlementStore } from './SqliteSamePlateAppearanceTerminalSettlementStore';
import { officialStateHash } from '../OfficialStateEncoding';
import type { OfficialGameBoundaryInput } from '../../core/world/competition/OfficialGameCompletion';
import { assertDurableOfficialGameFinal } from './OfficialWorldSettlementDriver';
import { readCompletedFoulTerminalGame, type DurableFoulTerminalWorldSettlementRequest,
  type FoulTerminalWorldSettlementResult, type FoulTerminalWorldSettlementStores } from './FoulTerminalWorldSettlementDriver';

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

export type DomesticOpeningMatchInput = Readonly<{
  careerId: string; seasonId: string; gameId: string;
  ruleProfileId: CanonicalMatchState['ruleProfileId']; playId: number;
}>;

/** Start an archived fixture at the same unplayed state required by the initial
 * World owner. Rules and play identity are explicit; actors and physical setup
 * remain owned by their accepted pregame/World sources. */
export const prepareDomesticOpeningMatch = (
  stores: DomesticSeasonStores,
  raw: DomesticOpeningMatchInput,
): PreparedDomesticMatch => {
  const input = cloneInert(raw);
  const fields = ['careerId', 'seasonId', 'gameId', 'ruleProfileId', 'playId'];
  if (!input || Object.keys(input).length !== fields.length
    || fields.some(key => !Object.hasOwn(input, key))
    || [input.careerId, input.seasonId, input.gameId, input.ruleProfileId].some(value =>
      typeof value !== 'string' || !value || value !== value.trim())
    || !Number.isSafeInteger(input.playId) || input.playId < 0) {
    throw new Error('invalid domestic opening Match input');
  }
  // Validate the registered profile before the existing fixture-first write.
  const profile = getRuleProfile(input.ruleProfileId);
  return prepareDomesticMatch(stores, { careerId: input.careerId,
    seasonId: input.seasonId, gameId: input.gameId,
    matchState: { ruleProfileId: profile.id, playId: input.playId,
      inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
      bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 } } });
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
  assertDomesticGameSourceBasis(stores, { ...finalInput.game, gameId: finalInput.matchId }, worldInput, historicalSchedule);
};
const assertDomesticGameSourceBasis = (
  stores: DomesticGameSettlementStores,
  game: Pick<OfficialGameBoundaryInput, 'gameId' | 'seasonId' | 'venueBinding'>,
  worldInput: DurableOfficialWorldSettlementRequest['worldInput'],
  historicalSchedule: boolean,
): void => {
  const archive = stores.archive.read(worldInput.attendance.careerId,
    game.seasonId);
  const fixture = stores.match.getOfficialFixture(game.gameId);
  // A retained request may precede an unrelated accepted rainout. Authenticate
  // its exact schedule prefix without substituting today's schedule into it.
  const prefixLength = archive && historicalSchedule
    ? worldInput.schedule.revisionEventIds.length
      - archive.baseSchedule.revisionEventIds.length
    : archive?.revisions.length;
  if (!archive || !fixture
    || prefixLength === undefined || prefixLength === null
    || prefixLength < 0 || prefixLength > archive.revisions.length
    || !isDeepStrictEqual(fixture, game.venueBinding)
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
type DomesticGameSettlementInput = Readonly<{
  attendanceFactId: string;
  expectedSeasonRevision: number;
  expectedClubRevision: number;
}> & Pick<RegularSeasonGameInput,
  'wageSchedules' | 'revenuePolicy' | 'finalizedAtDay'>;

export type ActualLiveDomesticGameSettlementInput = DomesticGameSettlementInput & Readonly<{ closureSourceId: string }>;
export type PhysicalDomesticGameSettlementInput = DomesticGameSettlementInput & Readonly<{ closureSourceId: string }>;
export type SamePaDomesticGameSettlementInput = DomesticGameSettlementInput & Readonly<{ transitionSourceId: string }>;
export type FoulTerminalDomesticGameSettlementInput = DomesticGameSettlementInput & Readonly<{ terminalSourceId: string }>;

const readDomesticSettlementInput = <T extends DomesticGameSettlementInput>(raw: T,
  sourceField: 'closureSourceId' | 'transitionSourceId' | 'terminalSourceId'): T => {
  const input = cloneInert(raw);
  const fields = [sourceField, 'attendanceFactId',
    'expectedSeasonRevision', 'expectedClubRevision', 'wageSchedules',
    'revenuePolicy', 'finalizedAtDay'];
  if (!input || Object.keys(input).length !== fields.length
    || fields.some(key => !Object.hasOwn(input, key))
    || [input[sourceField as keyof T], input.attendanceFactId].some(value =>
      typeof value !== 'string' || !value || value !== value.trim())
    || [input.expectedSeasonRevision, input.expectedClubRevision,
      input.finalizedAtDay].some(value =>
      !Number.isSafeInteger(value) || value < 0)) {
    throw new Error('invalid completed domestic settlement input');
  }
  return input;
};

/** Assemble one genuinely completed actual-live game into the existing durable
 * Match/World workflow. Workload is authenticated here and is never reapplied. */
export const settleActualLiveDomesticGame = (
  stores: DomesticGameSettlementStores & Readonly<{
    closure: Pick<ReturnType<typeof openSqliteActualLivePlayClosureStore>,
      'readHistoricalReadiness'>;
  }>,
  raw: ActualLiveDomesticGameSettlementInput,
): OfficialWorldSettlementResult => {
  const input = readDomesticSettlementInput(raw, 'closureSourceId');
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
  return settleCompletedDomesticGame(stores, input, proposal.seasonFixture.careerId, finalInput, expected);
};

/** Completed physical non-live play owns its original final, score and workload.
 * Reading that historical owner never recharges effort or activates a new play. */
export const settlePhysicalDomesticGame = (
  stores: DomesticGameSettlementStores & Readonly<{ physicalClosure: Pick<SqlitePhysicalPlayClosureStore, 'read'> }>,
  raw: PhysicalDomesticGameSettlementInput,
): OfficialWorldSettlementResult => {
  const input = readDomesticSettlementInput(raw, 'closureSourceId');
  const completed = stores.physicalClosure.read(input.closureSourceId);
  if (!completed || completed.status !== 'COMPLETED' || !completed.result) {
    throw new Error('physical domestic final closure is incomplete');
  }
  const { application, expectedOfficial, worldFixture } = completed.proposal;
  if (completed.source.sourceId !== input.closureSourceId || !('game' in application) || !('result' in expectedOfficial)
    || completed.result.sourceId !== input.closureSourceId || completed.result.gameId !== application.matchId
    || completed.result.playId !== application.match.playId || !isDeepStrictEqual(completed.result.official, expectedOfficial)
    || worldFixture.seasonId !== application.game.seasonId || worldFixture.game.gameId !== application.matchId
    || worldFixture.game.homeClubId !== application.game.homeClubId || worldFixture.game.awayClubId !== application.game.awayClubId) {
    throw new Error('physical domestic closure lacks its original final');
  }
  return settleCompletedDomesticGame(stores, input, worldFixture.careerId, application, expectedOfficial);
};

/** The final transition already owns scoring and every participant effect.
 * Require the exact historical release before downstream World settlement. */
export const settleSamePaDomesticGame = (
  stores: DomesticGameSettlementStores & Readonly<{
    transition: Pick<ReturnType<typeof openSqliteSamePlateAppearanceTerminalTransitionStore>, 'read'>;
    settlement: Pick<ReturnType<typeof openSqliteSamePlateAppearanceTerminalSettlementStore>, 'readRelease'>;
  }>,
  raw: SamePaDomesticGameSettlementInput,
): OfficialWorldSettlementResult => {
  const input = readDomesticSettlementInput(raw, 'transitionSourceId');
  const completed = stores.transition.read(input.transitionSourceId);
  if (!completed || completed.source.sourceId !== input.transitionSourceId || completed.source.kind !== 'game_final'
    || completed.completion !== 'game_final' || !('game' in completed.officialApplication) || !('result' in completed.official)
    || completed.lineage.gameId !== completed.officialApplication.matchId || completed.lineage.playId !== completed.officialApplication.match.playId) {
    throw new Error('same-PA domestic final transition is missing or incomplete');
  }
  const released = stores.settlement.readRelease(completed.source.settlementReference.sourceId);
  if (!released || !isDeepStrictEqual(released.transitionReference, { owner: 'pa_terminal_v1_transitions', sourceId: completed.source.sourceId,
      sourceHash: officialStateHash(completed.source), snapshotHash: officialStateHash(completed) })
    || !isDeepStrictEqual(released.settlementReference, completed.source.settlementReference)
    || !isDeepStrictEqual(released.terminalReference, completed.source.terminalReference)
    || !isDeepStrictEqual(released.enrollmentReference, completed.lineage.enrollmentReference)) {
    throw new Error('same-PA domestic final lacks its exact original release');
  }
  return settleCompletedDomesticGame(stores, input, completed.lineage.careerId, completed.officialApplication, completed.official);
};

/** This terminal's original pending receipt and completed result retain their
 * own outbox arm. It never calls the legacy Match finalizer. */
export const settleFoulTerminalDomesticGame = (
  stores: DomesticGameSettlementStores & Pick<FoulTerminalWorldSettlementStores, 'foulTerminal'>,
  raw: FoulTerminalDomesticGameSettlementInput,
): FoulTerminalWorldSettlementResult => {
  const input = readDomesticSettlementInput(raw, 'terminalSourceId');
  const final = readCompletedFoulTerminalGame(stores.foulTerminal, input.terminalSourceId);
  assertDurableOfficialGameFinal(stores.match, final.game.gameId, final.official.receipt, final.official.finalResult);
  const outbox = stores.outbox.completedTerminal, prior = outbox.read(final.official.receipt.applicationId);
  const basis = prepareDomesticGameWorldBasis(stores, input, final.careerId, final.game, prior?.request);
  const request: DurableFoulTerminalWorldSettlementRequest = { kind: 'foul_terminal_world_settlement_v1', final, ...basis.request };
  if (prior && !isDeepStrictEqual(request, prior.request)) throw new Error('foul terminal World settlement input was frozen differently');
  const delivery = { matchStore: stores.match, worldStore: stores.world, foulTerminal: stores.foulTerminal };
  return prior ? outbox.resume(final.official.receipt.applicationId, delivery) : outbox.submit(request, delivery);
};

/** Original owners share the durable economic workflow; historical proofs are
 * read again before every admission, including an already completed retry. */
const settleCompletedDomesticGame = (
  stores: DomesticGameSettlementStores,
  input: DomesticGameSettlementInput,
  careerId: string,
  finalInput: PersistOfficialFinalInput,
  expected: PersistOfficialFinalResult,
): OfficialWorldSettlementResult => {
  assertDurableOfficialGameFinal(stores.match, finalInput.matchId, expected.receipt, expected.result);
  const prior = stores.outbox.read(finalInput.applicationId);
  const game = { ...finalInput.game, gameId: finalInput.matchId, priorMatch: finalInput.match, application: expected.receipt };
  const basis = prepareDomesticGameWorldBasis(stores, input, careerId, game, prior?.request);
  const request = { finalInput, ...basis.request };
  if (prior && !isDeepStrictEqual(request, prior.request)) throw new Error('completed domestic World settlement input was frozen differently');
  if (!isDeepStrictEqual(basis.settlement.gameResult, expected.result)) throw new Error('completed domestic World final differs');
  const result = prior ? stores.outbox.resume(finalInput.applicationId, { matchStore: stores.match, worldStore: stores.world })
    : stores.outbox.submit(request, { matchStore: stores.match, worldStore: stores.world });
  const durableWorld = stores.world.readApplication(finalInput.applicationId);
  if (!durableWorld || !isDeepStrictEqual(result.final, expected) || !isDeepStrictEqual(result.world, durableWorld)
    || !isDeepStrictEqual(durableWorld.settlement, basis.settlement) || durableWorld.seasonRevision !== request.expectedSeasonRevision + 1
    || durableWorld.clubRevision !== basis.settlement.economy.state.revision) throw new Error('completed domestic final lacks authentic durable World settlement');
  return result;
};

type DomesticWorldBasisRequest = Pick<DurableOfficialWorldSettlementRequest, 'worldInput' | 'expectedSeasonRevision' | 'expectedClubRevision'>;
/** Preserve frozen Club/season inputs for every receipt format. A later valid
 * workload, sponsor receipt or rainout never rewrites an earlier settlement. */
const prepareDomesticGameWorldBasis = (
  stores: DomesticGameSettlementStores, input: DomesticGameSettlementInput, careerId: string,
  game: OfficialGameBoundaryInput, prior?: DomesticWorldBasisRequest,
) => {
  const attendance = stores.attendance.read(input.attendanceFactId);
  if (!attendance || attendance.careerId !== careerId || attendance.gameId !== game.gameId) {
    throw new Error('completed domestic final lacks accepted gate count evidence');
  }
  const supplied = { attendance, wageSchedules: input.wageSchedules, revenuePolicy: input.revenuePolicy, finalizedAtDay: input.finalizedAtDay };
  const revisions = { expectedSeasonRevision: input.expectedSeasonRevision, expectedClubRevision: input.expectedClubRevision };
  let request: DomesticWorldBasisRequest;
  if (prior) {
    request = { ...revisions, worldInput: { ...prior.worldInput, ...supplied } };
    if (!isDeepStrictEqual(request, { worldInput: prior.worldInput, expectedSeasonRevision: prior.expectedSeasonRevision,
      expectedClubRevision: prior.expectedClubRevision })) throw new Error('completed domestic World settlement input was frozen differently');
    const season = stores.world.readSeason(careerId, game.seasonId);
    if (!season || !isDeepStrictEqual(request.worldInput.standingsPolicy, season.standingsPolicy)) throw new Error('completed domestic World standings policy differs');
  } else {
    const season = stores.world.readSeason(careerId, game.seasonId), homeClub = stores.world.readClub(careerId, game.homeClubId);
    const homeClubHistory = stores.world.readClubHistory(careerId, game.homeClubId);
    if (!season || !homeClub || !homeClubHistory) throw new Error('completed domestic final lacks durable World season or Club');
    if (season.revision !== input.expectedSeasonRevision || homeClub.revision !== input.expectedClubRevision) throw new Error('stale completed domestic World season or Club revision');
    request = { ...revisions, worldInput: { ...supplied, schedule: season.schedule, priorResults: season.results,
      standingsPolicy: season.standingsPolicy, homeClub: homeClub.state, homeClubHistory } };
  }
  assertDomesticGameSourceBasis(stores, game, request.worldInput, !!prior);
  const settlement = settleRegularSeasonGame({ ...request.worldInput, game });
  if (request.expectedSeasonRevision !== request.worldInput.priorResults.length
    || request.expectedClubRevision !== request.worldInput.homeClub.revision) throw new Error('completed domestic World settlement revision differs');
  return { request, settlement };
};
import { isDeepStrictEqual } from 'node:util';
