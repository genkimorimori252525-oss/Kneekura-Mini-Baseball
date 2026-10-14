import type { DatabaseSync } from 'node:sqlite';
import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { WbcKnockoutEdition } from '../../core/world/competition/WbcFinalsKnockout';
import { planWbcFinalsSchedule, type WbcFinalsSchedule,
  type WbcFinalsSchedulePolicy } from '../../core/world/competition/WbcFinalsSchedule';
import type { SqliteWbcFinalsGroupStore } from './SqliteWbcFinalsGroupStore';

export type WbcFinalsScheduleRequest = Readonly<{
  careerId: string;
  editionId: string;
  knockoutEdition: WbcKnockoutEdition;
  policy: WbcFinalsSchedulePolicy;
}>;
export type SqliteWbcFinalsScheduleStore = Readonly<{
  initialize(request: WbcFinalsScheduleRequest): WbcFinalsSchedule;
  readSchedule(careerId: string, editionId: string): WbcFinalsSchedule | null;
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

/** All US group/knockout calendar slots and their accepted sources remain frozen. */
const createSqliteWbcFinalsScheduleStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{ groups: Pick<SqliteWbcFinalsGroupStore, 'readEdition' | 'readPlan'> }>,
): SqliteWbcFinalsScheduleStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid WBC schedule database path');
  const readEdition = createCompetitionSourceReader(sources.groups.readEdition, sources.groups);
  const readPlan = createCompetitionSourceReader(sources.groups.readPlan, sources.groups);
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_finals_schedules (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, schedule_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  }
  const get = db.prepare(`SELECT request_json, schedule_json
    FROM world_wbc_finals_schedules WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: WbcFinalsScheduleRequest): WbcFinalsSchedule => {
    const edition = readEdition(request.careerId, request.editionId);
    const plan = readPlan(request.careerId, request.editionId);
    if (!edition || !plan || edition.editionId !== request.editionId) {
      throw new Error('WBC schedule requires accepted groups');
    }
    return planWbcFinalsSchedule(edition, plan, request.knockoutEdition, request.policy);
  };
  const replay = (careerId: string, editionId: string, stored: Row): WbcFinalsSchedule => {
    try {
      const request = JSON.parse(stored.request_json) as WbcFinalsScheduleRequest;
      const saved = JSON.parse(stored.schedule_json) as WbcFinalsSchedule;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.schedule_json) {
        throw new Error('WBC schedule serialization differs');
      }
      const schedule = project(request);
      if (canonicalJson(schedule) !== stored.schedule_json) {
        throw new Error('WBC schedule replay differs');
      }
      return schedule;
    } catch (cause) {
      throw new Error(`corrupt WBC schedule for ${careerId}`, { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid WBC schedule scope');
  };
  return Object.freeze({
    initialize(rawRequest: WbcFinalsScheduleRequest): WbcFinalsSchedule {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId, stored);
          if (canonicalJson(request) !== stored.request_json) {
            throw new Error('WBC schedule is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        const schedule = project(request);
        db.prepare(`INSERT INTO world_wbc_finals_schedules
          (career_id, edition_id, request_json, schedule_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, canonicalJson(request), canonicalJson(schedule));
        db.exec('COMMIT');
        return schedule;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSchedule(careerId: string, editionId: string): WbcFinalsSchedule | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteWbcFinalsScheduleStore = (databasePath: string, sources: Parameters<typeof createSqliteWbcFinalsScheduleStore>[1]): SqliteWbcFinalsScheduleStore =>
  createSqliteWbcFinalsScheduleStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcFinalsScheduleEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcFinalsScheduleStore>[1]): Pick<SqliteWbcFinalsScheduleStore, 'readSchedule'> => {
  const owner = createSqliteWbcFinalsScheduleStore(db, sources);
  return Object.freeze({ readSchedule: owner.readSchedule });
};
