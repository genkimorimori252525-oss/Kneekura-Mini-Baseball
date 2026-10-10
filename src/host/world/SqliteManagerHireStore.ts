import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { readState } from '../../core/world/club/ClubSchemas';
import { replayClubEvents } from '../../core/world/club/ClubEvents';
import type { ClubWorldState } from '../../core/world/club/ClubTypes';
import { getClubSeasonStaffWageAllocations,
  type ClubWageScheduleLedger } from
  '../../core/world/club/ClubWageScheduleLedger';
import type { MatchdayClubHistory } from
  '../../core/world/club/OfficialMatchdayRevenue';
import type { ManagerEmploymentOffer,
  ManagerOfferAcceptance } from
  '../../core/world/manager/AcceptedManagerHire';
import type { ManagerCandidateEvidenceLedger } from
  '../../core/world/manager/ManagerCandidateEvidence';
import { appendManagerCandidateObservation,
  createManagerCandidateEvidenceLedger } from
  '../../core/world/manager/ManagerCandidateEvidence';
import type { ManagerHiringBrief, ManagerMarketTerms } from
  '../../core/world/manager/ManagerMarketShortlist';
import { executeManagerHireTransaction,
  type ManagerHireTransaction,
  type ManagerHireTransactionIds, type ManagerHireWageReference } from
  '../../core/world/manager/ManagerHireTransaction';
import { appendAcceptedClubEvents, ensureClubEventJournalSchema,
  readAcceptedClubHistory } from './SqliteClubEventJournal';
import { ensureManagerCandidateEvidenceSchema,
  readManagerCandidateEvidenceLedger } from
  './SqliteManagerCandidateEvidenceStore';

export type ManagerHireStoreRequest = Readonly<{
  applicationId: string;
  careerId: string;
  clubId: string;
  expectedClubRevision: number;
  expectedWageRevision: number;
  evidence: ManagerCandidateEvidenceLedger;
  brief: ManagerHiringBrief;
  candidates: readonly ManagerMarketTerms[];
  offer: ManagerEmploymentOffer;
  acceptance: ManagerOfferAcceptance;
  ids: ManagerHireTransactionIds;
}>;
export type DurableManagerHire = ManagerHireTransaction & Readonly<{
  applicationId: string;
}>;
export type AcceptedManagerOfferAuthority = Readonly<{
  readAcceptedManagerOfferAcceptance(sourceEventId: string):
    ManagerOfferAcceptance | null;
}>;
export type SqliteManagerHireStore = Readonly<{
  initializeWageSchedules(ledger: ClubWageScheduleLedger): void;
  readWageSchedules(careerId: string,
    clubId: string): ClubWageScheduleLedger | null;
  readClubHistory(careerId: string,
    clubId: string): MatchdayClubHistory | null;
  apply(request: ManagerHireStoreRequest): DurableManagerHire;
  readApplication(applicationId: string): DurableManagerHire | null;
  captureStaffWageReference(applicationId: string): ManagerHireWageReference;
  close(): void;
}>;

type ClubRow = { revision: number; state_json: string };
type WageRow = { revision: number; ledger_json: string };
type ApplicationRow = { application_id: string; career_id: string;
  club_id: string; club_revision: number; wage_revision: number;
  request_json: string; before_club_json: string;
  before_wage_json: string; result_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string =>
  JSON.stringify(cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
        a < b ? -1 : a > b ? 1 : 0)) : item);

const compute = (request: ManagerHireStoreRequest,
  before: ClubWorldState,
  schedules: ClubWageScheduleLedger): ManagerHireTransaction =>
  executeManagerHireTransaction(before, schedules,
    request.evidence, request.brief, request.candidates,
    request.offer, request.acceptance, request.ids);
const decodeManagerHireApplication = (db: DatabaseSync, row: ApplicationRow): DurableManagerHire => {
  try {
    const request = JSON.parse(row.request_json) as
      ManagerHireStoreRequest;
    const before = readState(JSON.parse(row.before_club_json));
    const priorSchedules = JSON.parse(row.before_wage_json) as
      ClubWageScheduleLedger;
    const stored = JSON.parse(row.result_json) as DurableManagerHire;
    const recomputed = compute(request, before, priorSchedules);
    const head = db.prepare('SELECT revision,state_json FROM main.world_club_heads WHERE career_id=? AND club_id=?')
      .get(row.career_id, row.club_id) as ClubRow | undefined;
    const wage = db.prepare('SELECT revision,ledger_json FROM main.world_wage_schedule_heads WHERE career_id=? AND club_id=?')
      .get(row.career_id, row.club_id) as WageRow | undefined;
    const history = readAcceptedClubHistory(db, row.career_id,
      row.club_id);
    const original = history && replayClubEvents(history.checkpoint,
      history.acceptedEvents.filter(event => event.afterRevision <= request.expectedClubRevision));
    if (!head || !wage || !history
      || !original?.ok || original.value.revision !== request.expectedClubRevision
      || canonicalJson(original.value) !== row.before_club_json
      || request.applicationId !== row.application_id
      || request.careerId !== row.career_id
      || request.clubId !== row.club_id
      || before.revision !== request.expectedClubRevision
      || priorSchedules.revision !== request.expectedWageRevision
      || stored.applicationId !== row.application_id
      || stored.club.revision !== row.club_revision
      || stored.schedules.revision !== row.wage_revision
      || head.revision < row.club_revision
      || wage.revision < row.wage_revision
      || canonicalJson(request) !== row.request_json
      || canonicalJson(before) !== row.before_club_json
      || canonicalJson(priorSchedules) !== row.before_wage_json
      || canonicalJson(stored) !== row.result_json
      || canonicalJson(recomputed)
        !== canonicalJson({ club: stored.club,
          clubEvent: stored.clubEvent, schedules: stored.schedules,
          hire: stored.hire })
      || !history.acceptedEvents.some((event) =>
        canonicalJson(event) === canonicalJson(stored.clubEvent))
      || (head.revision === row.club_revision
        && head.state_json !== canonicalJson(stored.club))
      || (wage.revision === row.wage_revision
        && wage.ledger_json !== canonicalJson(stored.schedules))) {
      throw new Error('manager hire application mismatch');
    }
    return stored;
  } catch (cause) {
    throw new Error('corrupt durable manager hire application', { cause });
  }
};
/** Reuses the hiring owner's original replay on the wage writer's real connection. */
export const readManagerHireWageEvidenceFromSqlite = (db: DatabaseSync, applicationId: string):
Readonly<{ reference: ManagerHireWageReference; application: DurableManagerHire }> | null => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof DatabaseSync)) throw new Error('Manager hire evidence requires an actual Native SQLite connection');
  if (!id(applicationId)) throw new Error('invalid Manager hire wage reference');
  if (db.prepare('PRAGMA database_list').all().some(row => row.name !== 'main' && row.name !== 'temp')
    || db.prepare("SELECT name FROM temp.sqlite_master WHERE type IN ('table','view') LIMIT 1").get()) {
    throw new Error('Manager hire evidence requires main-only storage');
  }
  const reading = () => {
    const row = db.prepare('SELECT * FROM main.world_manager_hire_applications WHERE application_id=?')
      .get(applicationId) as ApplicationRow | undefined;
    if (!row) return null;
    const application = decodeManagerHireApplication(db, row), request = JSON.parse(row.request_json) as ManagerHireStoreRequest;
    const observed = readManagerCandidateEvidenceLedger(db, row.career_id, row.club_id);
    let original = createManagerCandidateEvidenceLedger(row.career_id, row.club_id);
    if (!observed || observed.revision < request.evidence.revision) throw new Error('original Manager hiring observations are missing');
    for (const observation of observed.observations.slice(0, request.evidence.revision)) {
      original = appendManagerCandidateObservation(original, original.revision, observation);
    }
    if (canonicalJson(original) !== canonicalJson(request.evidence)) throw new Error('original Manager hiring observations differ');
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    return Object.freeze({ application, reference: Object.freeze({ applicationId,
      requestHash: hash(row.request_json),
      snapshotHash: hash(JSON.stringify([row.before_club_json, row.before_wage_json, row.result_json])),
    }) });
  };
  if (db.isTransaction) return reading();
  db.exec('BEGIN');
  try { const result = reading(); db.exec('COMMIT'); return result; }
  catch (error) { if (db.isTransaction) db.exec('ROLLBACK'); throw error; }
};

/** Adopts a bilateral Manager hire, wage liability and Club event together. */
export const openSqliteManagerHireStore = (
  databasePath: string,
  acceptanceAuthority: AcceptedManagerOfferAuthority,
): SqliteManagerHireStore => {
  if (!id(databasePath)
    || typeof acceptanceAuthority?.readAcceptedManagerOfferAcceptance
      !== 'function') {
    throw new Error('manager hire requires a database and acceptance authority');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  ensureClubEventJournalSchema(db);
  ensureManagerCandidateEvidenceSchema(db);
  db.exec(`CREATE TABLE IF NOT EXISTS world_wage_schedule_heads (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    revision INTEGER NOT NULL, ledger_json TEXT NOT NULL,
    PRIMARY KEY (career_id, club_id)
  );
  CREATE TABLE IF NOT EXISTS world_manager_hire_applications (
    application_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    club_revision INTEGER NOT NULL, wage_revision INTEGER NOT NULL,
    request_json TEXT NOT NULL, before_club_json TEXT NOT NULL,
    before_wage_json TEXT NOT NULL, result_json TEXT NOT NULL
  );`);
  const getClub = db.prepare(`SELECT revision, state_json
    FROM world_club_heads WHERE career_id=? AND club_id=?`);
  const getWage = db.prepare(`SELECT revision, ledger_json
    FROM world_wage_schedule_heads WHERE career_id=? AND club_id=?`);
  const getApplication = db.prepare(`SELECT application_id, career_id,
    club_id, club_revision, wage_revision, request_json,
    before_club_json, before_wage_json, result_json
    FROM world_manager_hire_applications WHERE application_id=?`);
  const clubs = db.prepare(`SELECT club_id, state_json
    FROM world_club_heads WHERE career_id=?`);
  const clubRow = (careerId: string, clubId: string): ClubRow | null =>
    (getClub.get(careerId, clubId) as ClubRow | undefined) ?? null;
  const wageRow = (careerId: string, clubId: string): WageRow | null =>
    (getWage.get(careerId, clubId) as WageRow | undefined) ?? null;
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
  const decode = (row: ApplicationRow) => decodeManagerHireApplication(db, row);
  let closed = false;
  const api: SqliteManagerHireStore = Object.freeze({
    initializeWageSchedules(ledger): void {
      if (!ledger || !id(ledger.careerId) || !id(ledger.clubId)) {
        throw new Error('invalid manager wage initialization');
      }
      const json = canonicalJson(ledger);
      transaction(() => {
        const head = clubRow(ledger.careerId, ledger.clubId);
        if (!head) throw new Error('world Club head is not initialized');
        const club = readState(JSON.parse(head.state_json));
        getClubSeasonStaffWageAllocations(ledger, club);
        const current = wageRow(ledger.careerId, ledger.clubId);
        if (current) {
          if (current.revision !== ledger.revision
            || current.ledger_json !== json) {
            throw new Error('manager wage head already initialized differently');
          }
          return;
        }
        db.prepare(`INSERT INTO world_wage_schedule_heads
          (career_id, club_id, revision, ledger_json)
          VALUES (?, ?, ?, ?)`).run(ledger.careerId,
          ledger.clubId, ledger.revision, json);
      });
    },
    readWageSchedules(careerId, clubId): ClubWageScheduleLedger | null {
      if (!id(careerId) || !id(clubId)) {
        throw new Error('invalid manager wage read scope');
      }
      const row = wageRow(careerId, clubId);
      if (!row) return null;
      const ledger = JSON.parse(row.ledger_json) as ClubWageScheduleLedger;
      if (ledger.careerId !== careerId || ledger.clubId !== clubId
        || ledger.revision !== row.revision
        || canonicalJson(ledger) !== row.ledger_json) {
        throw new Error('corrupt durable manager wage head');
      }
      return ledger;
    },
    readClubHistory(careerId, clubId): MatchdayClubHistory | null {
      return readAcceptedClubHistory(db, careerId, clubId);
    },
    apply(request): DurableManagerHire {
      if (!request || !id(request.applicationId)
        || !id(request.careerId) || !id(request.clubId)
        || !revision(request.expectedClubRevision)
        || !revision(request.expectedWageRevision)) {
        throw new Error('invalid manager hire application');
      }
      const requestJson = canonicalJson(request);
      return transaction(() => {
        const prior = applicationRow(request.applicationId);
        if (prior) {
          const durable = decode(prior);
          if (prior.request_json !== requestJson) {
            throw new Error('applicationId was used for different manager hire evidence');
          }
          return durable;
        }
        const clubRecord = clubRow(request.careerId, request.clubId);
        const wageRecord = wageRow(request.careerId, request.clubId);
        if (!clubRecord || !wageRecord
          || clubRecord.revision !== request.expectedClubRevision
          || wageRecord.revision !== request.expectedWageRevision) {
          throw new Error('stale world Club or staff wage revision');
        }
        const observed = readManagerCandidateEvidenceLedger(db,
          request.careerId, request.clubId);
        if (!observed) {
          throw new Error('durable manager candidate evidence is missing');
        }
        let atBrief = createManagerCandidateEvidenceLedger(
          request.careerId, request.clubId);
        for (const item of observed.observations) {
          if (item.observedAtDay > request.brief.effectiveDay) break;
          atBrief = appendManagerCandidateObservation(atBrief,
            atBrief.revision, item);
        }
        if (canonicalJson(atBrief) !== canonicalJson(request.evidence)) {
          throw new Error('durable manager candidate evidence differs');
        }
        const accepted = acceptanceAuthority
          .readAcceptedManagerOfferAcceptance(
            request.acceptance.sourceEventId);
        if (!accepted || canonicalJson(accepted)
          !== canonicalJson(request.acceptance)) {
          throw new Error('accepted manager offer is missing');
        }
        const before = readState(JSON.parse(clubRecord.state_json));
        const beforeSchedules = this.readWageSchedules(request.careerId,
          request.clubId)!;
        const alreadyEmployed = (clubs.all(request.careerId) as
          { club_id: string; state_json: string }[]).some((item) =>
          item.club_id !== request.clubId
          && readState(JSON.parse(item.state_json)).live.references
            .staffRoleLinks.some((link) => link.roleKind === 'MANAGER'
              && link.personId === request.offer.managerId));
        if (alreadyEmployed) {
          throw new Error('manager is already employed by another Club');
        }
        const computed = compute(request, before, beforeSchedules);
        appendAcceptedClubEvents(db, before,
          [computed.clubEvent], computed.club);
        const clubUpdate = db.prepare(`UPDATE world_club_heads
          SET revision=?, state_json=? WHERE career_id=? AND club_id=?
          AND revision=? AND state_json=?`).run(computed.club.revision,
          canonicalJson(computed.club), request.careerId,
          request.clubId, request.expectedClubRevision,
          clubRecord.state_json);
        const wageUpdate = db.prepare(`UPDATE world_wage_schedule_heads
          SET revision=?, ledger_json=? WHERE career_id=? AND club_id=?
          AND revision=? AND ledger_json=?`).run(computed.schedules.revision,
          canonicalJson(computed.schedules), request.careerId,
          request.clubId, request.expectedWageRevision,
          wageRecord.ledger_json);
        if (clubUpdate.changes !== 1 || wageUpdate.changes !== 1) {
          throw new Error('manager hire compare-and-swap failed');
        }
        const durable = { applicationId: request.applicationId,
          ...computed };
        db.prepare(`INSERT INTO world_manager_hire_applications
          (application_id, career_id, club_id, club_revision,
           wage_revision, request_json, before_club_json,
           before_wage_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          request.applicationId, request.careerId, request.clubId,
          computed.club.revision, computed.schedules.revision,
          requestJson, canonicalJson(before),
          canonicalJson(beforeSchedules), canonicalJson(durable));
        return decode(applicationRow(request.applicationId)!);
      });
    },
    captureStaffWageReference(applicationId): ManagerHireWageReference {
      const evidence = readManagerHireWageEvidenceFromSqlite(db, applicationId);
      if (!evidence) throw new Error('accepted Manager hire is missing');
      return evidence.reference;
    },
    readApplication(applicationId): DurableManagerHire | null {
      if (!id(applicationId)) {
        throw new Error('invalid manager hire applicationId');
      }
      const row = applicationRow(applicationId);
      return row ? decode(row) : null;
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
  return api;
};
