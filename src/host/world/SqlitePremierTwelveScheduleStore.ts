import type { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planPremierTwelveSchedule, type PremierTwelveSchedule,
  type PremierTwelveSchedulePolicy } from '../../core/world/competition/PremierTwelveSchedule';
import type { SqlitePremierTwelveGroupStore } from './SqlitePremierTwelveGroupStore';

export type PremierTwelveScheduleRequest = Readonly<{
  careerId: string;
  editionId: string;
  policy: PremierTwelveSchedulePolicy;
}>;
export type SqlitePremierTwelveScheduleStore = Readonly<{
  initialize(request: PremierTwelveScheduleRequest): PremierTwelveSchedule;
  readSchedule(careerId: string, editionId: string): PremierTwelveSchedule | null;
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

/** The accepted Edition/plan owns every slot, including unqualified knockout slots. */
const createSqlitePremierTwelveScheduleStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{ groups: Pick<SqlitePremierTwelveGroupStore, 'readEdition' | 'readPlan'> }>,
): SqlitePremierTwelveScheduleStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid Premier12 schedule database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_premier_twelve_schedules (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, schedule_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  }
  const get = db.prepare(`SELECT request_json, schedule_json
    FROM world_premier_twelve_schedules WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: PremierTwelveScheduleRequest): PremierTwelveSchedule => {
    const edition = sources.groups.readEdition(request.careerId, request.editionId);
    const plan = sources.groups.readPlan(request.careerId, request.editionId);
    if (!edition || !plan || edition.editionId !== request.editionId) {
      throw new Error('Premier12 schedule requires accepted groups');
    }
    return planPremierTwelveSchedule(edition, plan, request.policy);
  };
  const replay = (careerId: string, editionId: string, stored: Row): PremierTwelveSchedule => {
    try {
      const request = JSON.parse(stored.request_json) as PremierTwelveScheduleRequest;
      const saved = JSON.parse(stored.schedule_json) as PremierTwelveSchedule;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.schedule_json) {
        throw new Error('Premier12 schedule serialization differs');
      }
      const schedule = project(request);
      if (canonicalJson(schedule) !== stored.schedule_json) {
        throw new Error('Premier12 schedule replay differs');
      }
      return schedule;
    } catch (cause) {
      throw new Error(`corrupt Premier12 schedule for ${careerId}`, { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid Premier12 schedule scope');
  };
  return Object.freeze({
    initialize(rawRequest: PremierTwelveScheduleRequest): PremierTwelveSchedule {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId, stored);
          if (canonicalJson(request) !== stored.request_json) {
            throw new Error('Premier12 schedule is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        const schedule = project(request);
        db.prepare(`INSERT INTO world_premier_twelve_schedules
          (career_id, edition_id, request_json, schedule_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, canonicalJson(request), canonicalJson(schedule));
        db.exec('COMMIT');
        return schedule;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSchedule(careerId: string, editionId: string): PremierTwelveSchedule | null {
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
export const openSqlitePremierTwelveScheduleStore = (databasePath: string, sources: Parameters<typeof createSqlitePremierTwelveScheduleStore>[1]): SqlitePremierTwelveScheduleStore =>
  createSqlitePremierTwelveScheduleStore(databasePath, sources);

/** Same owner replay on the consuming Native connection; no writer or close capability escapes. */
export const premierTwelveScheduleEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqlitePremierTwelveScheduleStore>[1]): Pick<SqlitePremierTwelveScheduleStore, 'readSchedule'> => {
  const owner = createSqlitePremierTwelveScheduleStore(db, sources);
  return Object.freeze({ readSchedule: owner.readSchedule });
};
