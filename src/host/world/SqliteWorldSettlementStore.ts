import { createRequire } from 'node:module';
import { assessCurrentSeasonFinancialRegulation } from
  '../../core/world/club/FinancialRegulationAssessment';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { readState } from '../../core/world/club/ClubSchemas';
import type { ClubWorldState } from '../../core/world/club/ClubTypes';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { buildOfficialStandings,
  type OfficialStandingsSchedule,
  type StandingsTiebreakPolicy } from
  '../../core/world/competition/OfficialStandings';
import type { RegularSeasonGameSettlement } from
  '../../core/world/competition/OfficialSeasonEconomySettlement';
import { projectProvisionalOfficialStandings } from
  '../../core/world/competition/ProvisionalOfficialStandings';
import { appendAcceptedClubEvents, ensureClubEventJournalSchema,
  initializeClubCheckpoint, readAcceptedClubHistory } from
  './SqliteClubEventJournal';

export type InitializeWorldSeason = Readonly<{
  careerId: string;
  schedule: OfficialStandingsSchedule;
  standingsPolicy: StandingsTiebreakPolicy;
  clubs: readonly ClubWorldState[];
}>;
export type DurableWorldSeason = Readonly<{
  careerId: string;
  seasonId: string;
  revision: number;
  schedule: OfficialStandingsSchedule;
  standingsPolicy: StandingsTiebreakPolicy;
  results: readonly OfficialGameResult[];
  standings: RegularSeasonGameSettlement['standings'];
}>;
export type DurableWorldClub = Readonly<{
  careerId: string;
  clubId: string;
  revision: number;
  state: ClubWorldState;
}>;
export type DurableWorldApplication = Readonly<{
  applicationId: string;
  seasonRevision: number;
  clubRevision: number;
  settlement: RegularSeasonGameSettlement;
}>;
export type SqliteWorldSettlementStore = Readonly<{
  initialize(input: InitializeWorldSeason): void;
  readSeason(careerId: string, seasonId: string): DurableWorldSeason | null;
  readClub(careerId: string, clubId: string): DurableWorldClub | null;
  readApplication(applicationId: string): DurableWorldApplication | null;
  persist(settlement: RegularSeasonGameSettlement,
    expectedSeasonRevision: number,
    expectedClubRevision: number): DurableWorldApplication;
  close(): void;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Stable plain JSON; rejects values that JSON.stringify would silently drop. */
const canonicalJson = (value: unknown): string => {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error('world settlement evidence exceeds size limit');
    }
    if (item === null || typeof item === 'string'
      || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item === 0 ? 0 : item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) {
      throw new Error('world settlement evidence must be inert data');
    }
    ancestors.add(item);
    let normalized: unknown;
    if (Array.isArray(item)) {
      if (Reflect.ownKeys(item).length !== item.length + 1) {
        throw new Error('world settlement evidence requires dense arrays');
      }
      const array: unknown[] = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item,
          String(index));
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('world settlement evidence requires dense arrays');
        }
        array.push(visit(descriptor.value, depth + 1));
      }
      normalized = array;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('world settlement evidence must be plain data');
      }
      const entries: [string, unknown][] = [];
      for (const key of Reflect.ownKeys(item)) {
        if (typeof key !== 'string') {
          throw new Error('world settlement evidence has a symbol key');
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('world settlement evidence has an accessor');
        }
        entries.push([key, visit(descriptor.value, depth + 1)]);
      }
      normalized = Object.fromEntries(entries.sort((a, b) =>
        a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    }
    ancestors.delete(item);
    return normalized;
  };
  return JSON.stringify(visit(value, 0));
};

type SeasonRow = { league_id: string; revision: number;
  schedule_json: string; policy_json: string;
  results_json: string; standings_json: string };
type ClubRow = { revision: number; state_json: string };
type ApplicationRow = { career_id: string; season_id: string;
  club_id: string; game_id: string; season_revision: number;
  club_revision: number; request_json: string; settlement_json: string };

/** Host-only SQLite adapter; the Match store remains a separate authority. */
export const openSqliteWorldSettlementStore = (
  databasePath: string,
): SqliteWorldSettlementStore => {
  if (!id(databasePath)) throw new Error('invalid world database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_season_heads (
    career_id TEXT NOT NULL, season_id TEXT NOT NULL, league_id TEXT NOT NULL,
    revision INTEGER NOT NULL, schedule_json TEXT NOT NULL,
    policy_json TEXT NOT NULL, results_json TEXT NOT NULL,
    standings_json TEXT NOT NULL,
    PRIMARY KEY (career_id, season_id)
  );
  CREATE TABLE IF NOT EXISTS world_club_heads (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    revision INTEGER NOT NULL, state_json TEXT NOT NULL,
    PRIMARY KEY (career_id, club_id)
  );
  CREATE TABLE IF NOT EXISTS world_settlement_applications (
    application_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL, season_id TEXT NOT NULL,
    club_id TEXT NOT NULL, game_id TEXT NOT NULL,
    season_revision INTEGER NOT NULL, club_revision INTEGER NOT NULL,
    request_json TEXT NOT NULL, settlement_json TEXT NOT NULL,
    UNIQUE (career_id, season_id, game_id)
  );`);
  ensureClubEventJournalSchema(db);
  const seasonStatement = db.prepare(`SELECT league_id, revision,
    schedule_json, policy_json, results_json, standings_json
    FROM world_season_heads WHERE career_id=? AND season_id=?`);
  const clubStatement = db.prepare(`SELECT revision, state_json
    FROM world_club_heads WHERE career_id=? AND club_id=?`);
  const applicationStatement = db.prepare(`SELECT career_id, season_id,
    club_id, game_id, season_revision, club_revision, request_json,
    settlement_json
    FROM world_settlement_applications WHERE application_id=?`);
  const seasonRow = (careerId: string, seasonId: string): SeasonRow | null =>
    (seasonStatement.get(careerId, seasonId) as SeasonRow | undefined) ?? null;
  const clubRow = (careerId: string, clubId: string): ClubRow | null =>
    (clubStatement.get(careerId, clubId) as ClubRow | undefined) ?? null;
  const applicationRow = (applicationId: string): ApplicationRow | null =>
    (applicationStatement.get(applicationId) as ApplicationRow | undefined)
      ?? null;
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const computeStandings = (schedule: OfficialStandingsSchedule,
    results: readonly OfficialGameResult[],
    policy: StandingsTiebreakPolicy):
    RegularSeasonGameSettlement['standings'] =>
    results.length < schedule.games.length
      ? projectProvisionalOfficialStandings(schedule, results, policy)
      : { kind: 'OFFICIAL', snapshot: buildOfficialStandings(schedule,
        results, policy) };
  const isSameResult = (left: OfficialGameResult | undefined,
    right: OfficialGameResult): boolean =>
    left !== undefined && canonicalJson(left) === canonicalJson(right);
  const durableApplication = (applicationId: string,
    row: ApplicationRow): DurableWorldApplication => {
    try {
      const request = JSON.parse(row.request_json) as {
        settlement: RegularSeasonGameSettlement;
        expectedSeasonRevision: number;
        expectedClubRevision: number;
      };
      const settlement = JSON.parse(row.settlement_json) as
        RegularSeasonGameSettlement;
      const season = seasonRow(row.career_id, row.season_id);
      const club = clubRow(row.career_id, row.club_id);
      const results = JSON.parse(season?.results_json ?? 'null') as
        OfficialGameResult[] | null;
      if (!season || !club || !Array.isArray(results)
        || !revision(row.season_revision)
        || !revision(row.club_revision)
        || row.season_revision < 1
        || row.season_revision > season.revision
        || row.club_revision > club.revision
        || season.revision !== results.length
        || request.expectedSeasonRevision + 1 !== row.season_revision
        || request.expectedClubRevision >= row.club_revision
        || canonicalJson(request) !== row.request_json
        || canonicalJson(settlement) !== row.settlement_json
        || canonicalJson(request.settlement) !== row.settlement_json
        || settlement.gameResult.applicationId !== applicationId
        || settlement.gameResult.gameId !== row.game_id
        || settlement.gameResult.seasonId !== row.season_id
        || settlement.gameResult.homeClubId !== row.club_id
        || settlement.economy.state.careerId !== row.career_id
        || settlement.economy.state.identity.clubId !== row.club_id
        || settlement.economy.state.revision !== row.club_revision
        || !isSameResult(settlement.results[row.season_revision - 1],
          settlement.gameResult)
        || !isSameResult(results[row.season_revision - 1],
          settlement.gameResult)
        || (club.revision === row.club_revision
          && canonicalJson(JSON.parse(club.state_json))
            !== canonicalJson(settlement.economy.state))) {
        throw new Error('application row mismatch');
      }
      const schedule = JSON.parse(season.schedule_json) as
        OfficialStandingsSchedule;
      const policy = JSON.parse(season.policy_json) as
        StandingsTiebreakPolicy;
      if (schedule.seasonId !== row.season_id
        || schedule.leagueId !== season.league_id
        || canonicalJson(computeStandings(schedule, results, policy))
          !== season.standings_json) {
        throw new Error('season head mismatch');
      }
      return { applicationId, seasonRevision: row.season_revision,
        clubRevision: row.club_revision, settlement };
    } catch (cause) {
      throw new Error('corrupt durable world application', { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    initialize(input: InitializeWorldSeason): void {
      if (!input || !id(input.careerId)
        || !Array.isArray(input.clubs) || input.clubs.length === 0) {
        throw new Error('invalid world season initialization');
      }
      const scheduleJson = canonicalJson(input.schedule);
      const policyJson = canonicalJson(input.standingsPolicy);
      const initialStandings = projectProvisionalOfficialStandings(
        input.schedule, [], input.standingsPolicy);
      const initialClubStates = input.clubs.map(readState);
      if (new Set(initialClubStates.map((club) =>
        club.identity.clubId)).size !== initialClubStates.length
        || initialClubStates.some((club) =>
          club.careerId !== input.careerId
          || !input.schedule.memberClubIds.includes(club.identity.clubId)
          || !club.season.plan.competitionEditionIds.includes(
            input.schedule.seasonId))) {
        throw new Error('world season club scope mismatch');
      }
      transaction(() => {
        const prior = seasonRow(input.careerId, input.schedule.seasonId);
        if (prior) {
          if (prior.revision !== 0 || prior.schedule_json !== scheduleJson
            || prior.policy_json !== policyJson) {
            throw new Error('world season already initialized differently');
          }
        } else {
          db.prepare(`INSERT INTO world_season_heads
            (career_id, season_id, league_id, revision, schedule_json,
             policy_json, results_json, standings_json)
            VALUES (?, ?, ?, 0, ?, ?, '[]', ?)`).run(
            input.careerId, input.schedule.seasonId,
            input.schedule.leagueId, scheduleJson, policyJson,
            canonicalJson(initialStandings));
        }
        for (const club of initialClubStates) {
          const current = clubRow(input.careerId, club.identity.clubId);
          const stateJson = canonicalJson(club);
          if (current) {
            if (current.revision !== club.revision
              || current.state_json !== stateJson) {
              throw new Error('world club already initialized differently');
            }
          } else {
            db.prepare(`INSERT INTO world_club_heads
              (career_id, club_id, revision, state_json)
              VALUES (?, ?, ?, ?)`).run(input.careerId,
              club.identity.clubId, club.revision, stateJson);
          }
          initializeClubCheckpoint(db, club);
        }
      });
    },
    readSeason(careerId: string, seasonId: string): DurableWorldSeason | null {
      if (!id(careerId) || !id(seasonId)) {
        throw new Error('invalid world season read scope');
      }
      const row = seasonRow(careerId, seasonId);
      if (!row) return null;
      const schedule = JSON.parse(row.schedule_json) as
        OfficialStandingsSchedule;
      const standingsPolicy = JSON.parse(row.policy_json) as
        StandingsTiebreakPolicy;
      const results = JSON.parse(row.results_json) as OfficialGameResult[];
      const standings = computeStandings(schedule, results,
        standingsPolicy);
      if (canonicalJson(standings) !== row.standings_json) {
        throw new Error('corrupt durable world standings');
      }
      return { careerId, seasonId, revision: row.revision, schedule,
        standingsPolicy, results, standings };
    },
    readClub(careerId: string, clubId: string): DurableWorldClub | null {
      if (!id(careerId) || !id(clubId)) {
        throw new Error('invalid world club read scope');
      }
      const row = clubRow(careerId, clubId);
      if (!row) return null;
      const state = readState(JSON.parse(row.state_json));
      if (state.careerId !== careerId || state.identity.clubId !== clubId
        || state.revision !== row.revision) {
        throw new Error('corrupt durable world club head');
      }
      return { careerId, clubId, revision: row.revision, state };
    },
    readApplication(applicationId: string): DurableWorldApplication | null {
      if (!id(applicationId)) {
        throw new Error('invalid world applicationId');
      }
      const row = applicationRow(applicationId);
      return row ? durableApplication(applicationId, row) : null;
    },
    persist(settlement: RegularSeasonGameSettlement,
      expectedSeasonRevision: number,
      expectedClubRevision: number): DurableWorldApplication {
      const result = settlement?.gameResult;
      if (!result || !id(result.applicationId)
        || !id(result.seasonId) || !id(result.homeClubId)
        || !id(result.gameId)
        || !revision(expectedSeasonRevision)
        || !revision(expectedClubRevision)) {
        throw new Error('invalid world settlement application');
      }
      const careerId = settlement.economy?.state?.careerId;
      if (!id(careerId)) {
        throw new Error('invalid world settlement career');
      }
      const settlementJson = canonicalJson(settlement);
      const requestJson = canonicalJson({ settlement,
        expectedSeasonRevision, expectedClubRevision });
      return transaction(() => {
        const priorApplication = applicationRow(result.applicationId);
        if (priorApplication) {
          const durable = durableApplication(result.applicationId,
            priorApplication);
          if (priorApplication.request_json !== requestJson) {
            throw new Error('applicationId was used for different world evidence');
          }
          return durable;
        }
        const currentSeason = seasonRow(careerId, result.seasonId);
        const currentClub = clubRow(careerId, result.homeClubId);
        if (!currentSeason || !currentClub) {
          throw new Error('world season or club is not initialized');
        }
        if (currentSeason.revision !== expectedSeasonRevision) {
          throw new Error('stale world season revision');
        }
        if (currentClub.revision !== expectedClubRevision) {
          throw new Error('stale world club revision');
        }
        const schedule = JSON.parse(currentSeason.schedule_json) as
          OfficialStandingsSchedule;
        const standingsPolicy = JSON.parse(currentSeason.policy_json) as
          StandingsTiebreakPolicy;
        const priorResults = JSON.parse(currentSeason.results_json) as
          OfficialGameResult[];
        if (!Array.isArray(settlement.results)
          || settlement.results.length !== priorResults.length + 1
          || canonicalJson(settlement.results.slice(0, -1))
            !== currentSeason.results_json
          || canonicalJson(settlement.results[settlement.results.length - 1])
            !== canonicalJson(result)) {
          throw new Error('world official result history mismatch');
        }
        const standings = computeStandings(schedule, settlement.results,
          standingsPolicy);
        if (canonicalJson(standings) !== canonicalJson(settlement.standings)) {
          throw new Error('world standings projection mismatch');
        }
        const event = settlement.economy.events[0];
        const application = settlement.economy.applications[0];
        const basis = application?.basis;
        const revenue = event?.command.operations[0];
        if (settlement.economy.events.length !== 1
          || settlement.economy.applications.length !== 1
          || application?.kind !== 'MATCHDAY'
          || canonicalJson(application.event) !== canonicalJson(event)
          || !basis || !('gameId' in basis)
          || basis.gameId !== result.gameId
          || !('applicationId' in basis)
          || basis.applicationId !== result.applicationId
          || !('seasonId' in basis)
          || basis.seasonId !== result.seasonId
          || event?.command.operations.length !== 1
          || !event.command.causeEventIds.includes(result.applicationId)
          || revenue?.kind !== 'RECORD_REVENUE'
          || revenue.category !== 'matchday'
          || !('amount' in basis)
          || revenue.amount !== basis.amount) {
          throw new Error('world matchday application mismatch');
        }
        const beforeClub = readState(JSON.parse(currentClub.state_json));
        const history = readAcceptedClubHistory(db, careerId,
          result.homeClubId);
        const venueRevision = basis && 'venueRevision' in basis
          ? basis.venueRevision : null;
        const observedAtDay = basis && 'observedAtDay' in basis
          ? basis.observedAtDay : null;
        const atVenue = history && Number.isSafeInteger(venueRevision)
          ? replayClubEvents(history.checkpoint,
            history.acceptedEvents.filter((entry) =>
              entry.afterRevision <= venueRevision!)) : null;
        const nextVenueEvent = history?.acceptedEvents.find((entry) =>
          entry.afterRevision > (venueRevision ?? -1));
        if (!history || !atVenue?.ok || !Number.isSafeInteger(observedAtDay)
          || atVenue.value.revision !== venueRevision
          || atVenue.value.effectiveDay > observedAtDay!
          || nextVenueEvent && nextVenueEvent.command.effectiveDay
            < observedAtDay!
          || !('stadiumId' in basis!)
          || basis.stadiumId !== atVenue.value.institutional.stadium.stadiumId
          || !('venueCapacity' in basis)
          || basis.venueCapacity !== atVenue.value.institutional.stadium.capacity) {
          throw new Error('world matchday venue lacks accepted Club history');
        }
        const replay = replayClubEvents(beforeClub,
          settlement.economy.events);
        if (!replay.ok || canonicalJson(replay.value)
          !== canonicalJson(settlement.economy.state)) {
          throw new Error('world club event history mismatch');
        }
        const assessment = assessCurrentSeasonFinancialRegulation(
          replay.value,
          settlement.economy.financialRegulationAssessment.wageAllocations);
        if (canonicalJson(assessment) !== canonicalJson(
          settlement.economy.financialRegulationAssessment)) {
          throw new Error('world financial regulation assessment mismatch');
        }
        const nextSeasonRevision = expectedSeasonRevision + 1;
        if (!revision(nextSeasonRevision)) {
          throw new Error('world season revision overflow');
        }
        appendAcceptedClubEvents(db, beforeClub,
          settlement.economy.events, replay.value);
        const seasonUpdate = db.prepare(`UPDATE world_season_heads
          SET revision=?, results_json=?, standings_json=?
          WHERE career_id=? AND season_id=? AND revision=?`).run(
          nextSeasonRevision, canonicalJson(settlement.results),
          canonicalJson(standings), careerId, result.seasonId,
          expectedSeasonRevision);
        const clubUpdate = db.prepare(`UPDATE world_club_heads
          SET revision=?, state_json=?
          WHERE career_id=? AND club_id=? AND revision=?`).run(
          replay.value.revision, canonicalJson(replay.value),
          careerId, result.homeClubId, expectedClubRevision);
        if (seasonUpdate.changes !== 1 || clubUpdate.changes !== 1) {
          throw new Error('world settlement compare-and-swap failed');
        }
        db.prepare(`INSERT INTO world_settlement_applications
          (application_id, career_id, season_id, club_id, game_id,
           season_revision, club_revision, request_json, settlement_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          result.applicationId, careerId, result.seasonId,
          result.homeClubId, result.gameId, nextSeasonRevision,
          replay.value.revision, requestJson, settlementJson);
        return { applicationId: result.applicationId,
          seasonRevision: nextSeasonRevision,
          clubRevision: replay.value.revision,
          settlement: JSON.parse(settlementJson) as
            RegularSeasonGameSettlement };
      });
    },
    close(): void {
      if (!closed) { db.close(); closed = true; }
    },
  });
};
