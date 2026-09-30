import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planWbcQualifierSchedule, type WbcQualifierSchedule,
  type WbcQualifierSchedulePolicy } from '../../core/world/competition/WbcQualifierSchedule';
import type { SqliteWbcGlobalQualifierPodStore } from './SqliteWbcGlobalQualifierPodStore';

export type WbcQualifierScheduleRequest = Readonly<{
  careerId: string;
  editionId: string;
  policy: WbcQualifierSchedulePolicy;
}>;
export type SqliteWbcQualifierScheduleStore = Readonly<{
  initialize(request: WbcQualifierScheduleRequest): WbcQualifierSchedule;
  readSchedule(careerId: string, editionId: string): WbcQualifierSchedule | null;
  close(): void;
}>;
type Row = { request_json: string; schedule_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Replay binds all twelve slots to the complete accepted Edition and pod plan. */
export const openSqliteWbcQualifierScheduleStore = (
  databasePath: string,
  sources: Readonly<{ pods: Pick<SqliteWbcGlobalQualifierPodStore, 'readEdition' | 'readPlan'> }>,
): SqliteWbcQualifierScheduleStore => {
  if (!id(databasePath)) throw new Error('invalid WBC qualifier schedule database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_schedules (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, schedule_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, schedule_json
    FROM world_wbc_qualifier_schedules WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: WbcQualifierScheduleRequest): WbcQualifierSchedule => {
    const edition = sources.pods.readEdition(request.careerId, request.editionId);
    const plan = sources.pods.readPlan(request.careerId, request.editionId);
    if (!edition || !plan || edition.editionId !== request.editionId) {
      throw new Error('WBC qualifier schedule requires accepted pods');
    }
    return planWbcQualifierSchedule(edition, plan, request.policy);
  };
  const replay = (careerId: string, editionId: string, stored: Row): WbcQualifierSchedule => {
    try {
      const request = JSON.parse(stored.request_json) as WbcQualifierScheduleRequest;
      const saved = JSON.parse(stored.schedule_json) as WbcQualifierSchedule;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.schedule_json) {
        throw new Error('WBC qualifier schedule serialization differs');
      }
      const schedule = project(request);
      if (canonicalJson(schedule) !== stored.schedule_json) {
        throw new Error('WBC qualifier schedule replay differs');
      }
      return schedule;
    } catch (cause) {
      throw new Error(`corrupt WBC qualifier schedule for ${careerId}`, { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid WBC qualifier schedule scope');
  };
  return Object.freeze({
    initialize(rawRequest: WbcQualifierScheduleRequest): WbcQualifierSchedule {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId, stored);
          if (canonicalJson(request) !== stored.request_json) {
            throw new Error('WBC qualifier schedule is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        const schedule = project(request);
        db.prepare(`INSERT INTO world_wbc_qualifier_schedules
          (career_id, edition_id, request_json, schedule_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, canonicalJson(request), canonicalJson(schedule));
        db.exec('COMMIT');
        return schedule;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSchedule(careerId: string, editionId: string): WbcQualifierSchedule | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
