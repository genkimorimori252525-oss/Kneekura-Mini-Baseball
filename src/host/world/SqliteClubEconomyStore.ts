import { createRequire } from 'node:module';
import { applyClubEconomyBatch,
  type ClubEconomyBatchResult,
  type ClubEconomySource } from '../../core/world/club/ClubEconomyBatch';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import { readState } from '../../core/world/club/ClubSchemas';
import type { ClubWorldState } from '../../core/world/club/ClubTypes';
import { assessCurrentSeasonFinancialRegulation } from
  '../../core/world/club/FinancialRegulationAssessment';
import type { ClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import type { MatchdayClubHistory } from
  '../../core/world/club/OfficialMatchdayRevenue';
import { appendAcceptedClubEvents, ensureClubEventJournalSchema,
  readAcceptedClubHistory } from './SqliteClubEventJournal';

export type ClubEconomyStoreRequest = Readonly<{
  applicationId: string;
  expectedClubRevision: number;
  club: ClubWorldState;
  history: MatchdayClubHistory;
  wageSchedules: ClubWageScheduleLedger;
  sources: readonly ClubEconomySource[];
}>;
export type DurableClubEconomyApplication = Readonly<{
  applicationId: string;
  clubRevision: number;
  batch: ClubEconomyBatchResult;
}>;
export type SqliteClubEconomyStore = Readonly<{
  apply(request: ClubEconomyStoreRequest): DurableClubEconomyApplication;
  readApplication(applicationId: string):
    DurableClubEconomyApplication | null;
  close(): void;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

const canonicalJson = (value: unknown): string => {
  const ancestors = new Set<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): unknown => {
    nodes += 1;
    if (nodes > 100_000 || depth > 64) {
      throw new Error('club economy evidence exceeds size limit');
    }
    if (item === null || typeof item === 'string'
      || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) {
      return item === 0 ? 0 : item;
    }
    if (typeof item !== 'object' || ancestors.has(item)) {
      throw new Error('club economy evidence must be inert JSON');
    }
    ancestors.add(item);
    let normalized: unknown;
    if (Array.isArray(item)) {
      if (Reflect.ownKeys(item).length !== item.length + 1) {
        throw new Error('club economy evidence requires dense arrays');
      }
      const array: unknown[] = [];
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item,
          String(index));
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('club economy evidence requires dense arrays');
        }
        array.push(visit(descriptor.value, depth + 1));
      }
      normalized = array;
    } else {
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error('club economy evidence must be plain JSON');
      }
      const entries: [string, unknown][] = [];
      for (const key of Reflect.ownKeys(item)) {
        if (typeof key !== 'string') {
          throw new Error('club economy evidence rejects symbol keys');
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        if (!descriptor || !descriptor.enumerable
          || !('value' in descriptor)) {
          throw new Error('club economy evidence rejects accessors');
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

type ClubRow = { revision: number; state_json: string };
type ApplicationRow = { application_id: string; career_id: string;
  club_id: string; from_revision: number; to_revision: number;
  request_json: string; result_json: string };

/** Non-Matchday economy events share the world SQLite club head and CAS. */
export const openSqliteClubEconomyStore = (
  databasePath: string,
): SqliteClubEconomyStore => {
  if (!id(databasePath)) throw new Error('invalid club economy database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_economy_applications (
    application_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL,
    club_id TEXT NOT NULL,
    from_revision INTEGER NOT NULL,
    to_revision INTEGER NOT NULL,
    request_json TEXT NOT NULL,
    result_json TEXT NOT NULL
  );`);
  ensureClubEventJournalSchema(db);
  const getClub = db.prepare(`SELECT revision, state_json
    FROM world_club_heads WHERE career_id=? AND club_id=?`);
  const getApplication = db.prepare(`SELECT application_id, career_id,
    club_id, from_revision, to_revision, request_json, result_json
    FROM world_club_economy_applications WHERE application_id=?`);
  const clubRow = (careerId: string, clubId: string): ClubRow | null =>
    (getClub.get(careerId, clubId) as ClubRow | undefined) ?? null;
  const applicationRow = (applicationId: string): ApplicationRow | null =>
    (getApplication.get(applicationId) as ApplicationRow | undefined)
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
  const validSources = (sources: readonly ClubEconomySource[]): boolean =>
    Array.isArray(sources) && sources.length > 0
      && sources.every((source) => source?.kind === 'DOMESTIC_PRIZE'
        || source?.kind === 'STRUCTURAL_REVENUE'
        || source?.kind === 'PLAYER_WAGE');
  const decode = (row: ApplicationRow): DurableClubEconomyApplication => {
    try {
      const request = JSON.parse(row.request_json) as
        ClubEconomyStoreRequest;
      const stored = JSON.parse(row.result_json) as
        DurableClubEconomyApplication;
      const current = clubRow(row.career_id, row.club_id);
      if (!current || !validSources(request.sources)
        || !revision(row.from_revision)
        || !revision(row.to_revision)
        || row.to_revision <= row.from_revision
        || request.applicationId !== row.application_id
        || request.club.careerId !== row.career_id
        || request.club.identity.clubId !== row.club_id
        || request.expectedClubRevision !== row.from_revision
        || stored.applicationId !== row.application_id
        || stored.clubRevision !== row.to_revision
        || stored.batch.state.revision !== row.to_revision
        || current.revision < row.to_revision
        || canonicalJson(request) !== row.request_json
        || canonicalJson(stored) !== row.result_json) {
        throw new Error('application row mismatch');
      }
      const recomputed = applyClubEconomyBatch(request.club,
        request.history, request.wageSchedules, request.sources);
      if (canonicalJson(recomputed) !== canonicalJson(stored.batch)
        || (current.revision === row.to_revision
          && canonicalJson(JSON.parse(current.state_json))
            !== canonicalJson(stored.batch.state))) {
        throw new Error('application result mismatch');
      }
      return stored;
    } catch (cause) {
      throw new Error('corrupt durable club economy application', { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    apply(request: ClubEconomyStoreRequest): DurableClubEconomyApplication {
      if (!request || !id(request.applicationId)
        || !revision(request.expectedClubRevision)
        || !validSources(request.sources)) {
        throw new Error('invalid non-Matchday club economy request');
      }
      const requestJson = canonicalJson(request);
      return transaction(() => {
        const prior = applicationRow(request.applicationId);
        if (prior) {
          const durable = decode(prior);
          if (prior.request_json !== requestJson) {
            throw new Error('applicationId was used for different club economy evidence');
          }
          return durable;
        }
        const club = readState(request.club);
        const current = clubRow(club.careerId, club.identity.clubId);
        if (!current) throw new Error('world club head is not initialized');
        if (current.revision !== request.expectedClubRevision
          || club.revision !== request.expectedClubRevision) {
          throw new Error('stale world club revision');
        }
        if (canonicalJson(club) !== current.state_json) {
          throw new Error('club input does not match durable world head');
        }
        const acceptedHistory = readAcceptedClubHistory(db,
          club.careerId, club.identity.clubId);
        if (!acceptedHistory || canonicalJson(request.history)
          !== canonicalJson(acceptedHistory)) {
          throw new Error('club economy history does not match accepted journal');
        }
        const batch = applyClubEconomyBatch(club, request.history,
          request.wageSchedules, request.sources);
        if (batch.events.length !== request.sources.length
          || batch.applications.length !== request.sources.length
          || batch.applications.some((application, index) =>
            application.kind !== request.sources[index].kind
            || canonicalJson(application.event)
              !== canonicalJson(batch.events[index]))) {
          throw new Error('club economy event/application mismatch');
        }
        const replay = replayClubEvents(club, batch.events);
        if (!replay.ok || canonicalJson(replay.value)
          !== canonicalJson(batch.state)) {
          throw new Error('club economy event replay mismatch');
        }
        const assessment = assessCurrentSeasonFinancialRegulation(
          replay.value,
          batch.financialRegulationAssessment.wageAllocations);
        if (canonicalJson(assessment) !== canonicalJson(
          batch.financialRegulationAssessment)) {
          throw new Error('club economy financial assessment mismatch');
        }
        const nextRevision = replay.value.revision;
        if (!revision(nextRevision) || nextRevision <= current.revision) {
          throw new Error('club economy revision overflow');
        }
        appendAcceptedClubEvents(db, club, batch.events, replay.value);
        const updated = db.prepare(`UPDATE world_club_heads
          SET revision=?, state_json=?
          WHERE career_id=? AND club_id=? AND revision=?`).run(
          nextRevision, canonicalJson(replay.value), club.careerId,
          club.identity.clubId, request.expectedClubRevision);
        if (updated.changes !== 1) {
          throw new Error('world club compare-and-swap failed');
        }
        const durable = { applicationId: request.applicationId,
          clubRevision: nextRevision, batch };
        db.prepare(`INSERT INTO world_club_economy_applications
          (application_id, career_id, club_id, from_revision,
           to_revision, request_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(request.applicationId,
          club.careerId, club.identity.clubId,
          request.expectedClubRevision, nextRevision, requestJson,
          canonicalJson(durable));
        return decode(applicationRow(request.applicationId)!);
      });
    },
    readApplication(applicationId: string):
    DurableClubEconomyApplication | null {
      if (!id(applicationId)) {
        throw new Error('invalid club economy applicationId');
      }
      const row = applicationRow(applicationId);
      return row ? decode(row) : null;
    },
    close(): void {
      if (!closed) { db.close(); closed = true; }
    },
  });
};
