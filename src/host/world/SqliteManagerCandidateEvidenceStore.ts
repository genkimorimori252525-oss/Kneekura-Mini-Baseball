import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { appendManagerCandidateObservation,
  createManagerCandidateEvidenceLedger,
  type ManagerCandidateEvidenceLedger,
  type ManagerCandidateObservation } from
  '../../core/world/manager/ManagerCandidateEvidence';

export type AcceptedManagerCandidateObservationAuthority = Readonly<{
  readAcceptedManagerCandidateObservation(eventId: string):
    ManagerCandidateObservation | null;
}>;
export type SqliteManagerCandidateEvidenceStore = Readonly<{
  initialize(careerId: string, clubId: string):
    ManagerCandidateEvidenceLedger;
  read(careerId: string, clubId: string):
    ManagerCandidateEvidenceLedger | null;
  append(careerId: string, clubId: string, expectedRevision: number,
    observation: ManagerCandidateObservation):
    ManagerCandidateEvidenceLedger;
  close(): void;
}>;

type HeadRow = { revision: number; ledger_json: string };
type EventRow = { career_id: string; club_id: string;
  revision: number; event_json: string };
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

export const ensureManagerCandidateEvidenceSchema = (db: DatabaseSync):
void => {
  db.exec(`CREATE TABLE IF NOT EXISTS world_manager_candidate_evidence_heads (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    revision INTEGER NOT NULL, ledger_json TEXT NOT NULL,
    PRIMARY KEY(career_id, club_id)
  );
  CREATE TABLE IF NOT EXISTS world_manager_candidate_observation_ids (
    event_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    revision INTEGER NOT NULL, event_json TEXT NOT NULL
  );`);
};

/** Replays accepted observations, independent of the intake process. */
export const readManagerCandidateEvidenceLedger = (
  db: DatabaseSync, careerId: string, clubId: string,
): ManagerCandidateEvidenceLedger | null => {
  if (!id(careerId) || !id(clubId)) {
    throw new Error('invalid manager candidate evidence scope');
  }
  const row = db.prepare(`SELECT revision, ledger_json
    FROM world_manager_candidate_evidence_heads
    WHERE career_id=? AND club_id=?`).get(careerId, clubId) as
    HeadRow | undefined;
  if (!row) return null;
  const stored = JSON.parse(row.ledger_json) as
    ManagerCandidateEvidenceLedger;
  if (!revision(row.revision) || canonicalJson(stored) !== row.ledger_json
    || stored.careerId !== careerId || stored.clubId !== clubId
    || stored.revision !== row.revision) {
    throw new Error('corrupt durable manager candidate evidence');
  }
  let replay = createManagerCandidateEvidenceLedger(careerId, clubId);
  for (const observation of stored.observations) {
    const accepted = db.prepare(`SELECT career_id, club_id,
      revision, event_json FROM world_manager_candidate_observation_ids
      WHERE event_id=?`).get(observation.eventId) as
      EventRow | undefined;
    if (!accepted || accepted.career_id !== careerId
      || accepted.club_id !== clubId
      || accepted.revision !== replay.revision + 1
      || accepted.event_json !== canonicalJson(observation)) {
      throw new Error('corrupt accepted manager observation');
    }
    replay = appendManagerCandidateObservation(replay,
      replay.revision, observation);
  }
  if (canonicalJson(replay) !== row.ledger_json) {
    throw new Error('manager candidate evidence replay mismatch');
  }
  return replay;
};

/** Stores only host-accepted interview/reference/career observations. */
export const openSqliteManagerCandidateEvidenceStore = (
  databasePath: string,
  authority: AcceptedManagerCandidateObservationAuthority,
): SqliteManagerCandidateEvidenceStore => {
  if (!id(databasePath)
    || typeof authority?.readAcceptedManagerCandidateObservation
      !== 'function') {
    throw new Error('manager candidate evidence requires a source authority');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  ensureManagerCandidateEvidenceSchema(db);
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
  let closed = false;
  const api: SqliteManagerCandidateEvidenceStore = Object.freeze({
    initialize(careerId, clubId): ManagerCandidateEvidenceLedger {
      const initial = createManagerCandidateEvidenceLedger(
        careerId, clubId);
      return transaction(() => {
        const club = db.prepare(`SELECT 1 FROM world_club_heads
          WHERE career_id=? AND club_id=?`).get(careerId, clubId);
        if (!club) throw new Error('world Club head is not initialized');
        const prior = readManagerCandidateEvidenceLedger(db,
          careerId, clubId);
        if (prior) return prior;
        db.prepare(`INSERT INTO world_manager_candidate_evidence_heads
          (career_id, club_id, revision, ledger_json)
          VALUES (?, ?, 0, ?)`).run(careerId, clubId,
          canonicalJson(initial));
        return initial;
      });
    },
    read(careerId, clubId): ManagerCandidateEvidenceLedger | null {
      return readManagerCandidateEvidenceLedger(db, careerId, clubId);
    },
    append(careerId, clubId, expectedRevision, observation):
    ManagerCandidateEvidenceLedger {
      if (!id(careerId) || !id(clubId)
        || !revision(expectedRevision) || !id(observation?.eventId)) {
        throw new Error('invalid manager candidate observation intake');
      }
      const eventJson = canonicalJson(observation);
      return transaction(() => {
        const prior = db.prepare(`SELECT career_id, club_id,
          revision, event_json FROM world_manager_candidate_observation_ids
          WHERE event_id=?`).get(observation.eventId) as
          EventRow | undefined;
        if (prior) {
          const current = readManagerCandidateEvidenceLedger(db,
            careerId, clubId);
          if (!current || prior.career_id !== careerId
            || prior.club_id !== clubId
            || prior.revision !== expectedRevision + 1
            || prior.event_json !== eventJson) {
            throw new Error('manager observation eventId was reused');
          }
          return current;
        }
        const accepted = authority
          .readAcceptedManagerCandidateObservation(observation.eventId);
        if (!accepted || canonicalJson(accepted) !== eventJson) {
          throw new Error('accepted manager observation is missing');
        }
        const current = readManagerCandidateEvidenceLedger(db,
          careerId, clubId);
        if (!current || current.revision !== expectedRevision) {
          throw new Error('stale manager candidate evidence revision');
        }
        const next = appendManagerCandidateObservation(current,
          expectedRevision, observation);
        const updated = db.prepare(`UPDATE world_manager_candidate_evidence_heads
          SET revision=?, ledger_json=? WHERE career_id=? AND club_id=?
          AND revision=? AND ledger_json=?`).run(next.revision,
          canonicalJson(next), careerId, clubId, expectedRevision,
          canonicalJson(current));
        if (updated.changes !== 1) {
          throw new Error('manager candidate evidence CAS failed');
        }
        db.prepare(`INSERT INTO world_manager_candidate_observation_ids
          (event_id, career_id, club_id, revision, event_json)
          VALUES (?, ?, ?, ?, ?)`).run(observation.eventId,
          careerId, clubId, next.revision, eventJson);
        return next;
      });
    },
    close(): void { if (!closed) { db.close(); closed = true; } },
  });
  return api;
};
