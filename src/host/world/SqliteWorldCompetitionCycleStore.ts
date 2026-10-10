import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planWorldCompetitionCycle,
  type WorldCompetitionCycleInput,
  type WorldCompetitionCyclePlan } from
  '../../core/world/competition/WorldCompetitionCycleCalendar';

export type SqliteWorldCompetitionCycleStore = Readonly<{
  initialize(careerId: string,
    input: WorldCompetitionCycleInput): WorldCompetitionCyclePlan;
  readCycle(careerId: string,
    cycleOrdinal: number): WorldCompetitionCyclePlan | null;
  close(): void;
}>;
type CycleRow = { request_json: string; plan_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const ordinal = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Freeze an accepted four-year cycle before domestic schedules consume it. */
const createSqliteWorldCompetitionCycleStore = (
  databasePath: string | DatabaseSync,
): SqliteWorldCompetitionCycleStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid world calendar database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_competition_cycles (
    career_id TEXT NOT NULL, cycle_ordinal INTEGER NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    PRIMARY KEY (career_id, cycle_ordinal)
  );`);
  }
  const get = db.prepare(`SELECT request_json, plan_json
    FROM world_competition_cycles WHERE career_id=? AND cycle_ordinal=?`);
  const first = db.prepare(`SELECT request_json FROM world_competition_cycles
    WHERE career_id=? ORDER BY cycle_ordinal LIMIT 1`);
  const row = (careerId: string, cycleOrdinal: number): CycleRow | null =>
    (get.get(careerId, cycleOrdinal) as CycleRow | undefined) ?? null;
  const parse = (careerId: string, cycleOrdinal: number,
    stored: CycleRow): WorldCompetitionCyclePlan => {
    try {
      const input = JSON.parse(stored.request_json) as
        WorldCompetitionCycleInput;
      const plan = JSON.parse(stored.plan_json) as
        WorldCompetitionCyclePlan;
      const replayed = planWorldCompetitionCycle(input);
      if (input.cycleOrdinal !== cycleOrdinal
        || canonicalJson(input) !== stored.request_json
        || canonicalJson(plan) !== stored.plan_json
        || canonicalJson(replayed) !== stored.plan_json) {
        throw new Error('world cycle replay differs');
      }
      return replayed;
    } catch (cause) {
      throw new Error(`corrupt world competition cycle for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    initialize(careerId: string,
      rawInput: WorldCompetitionCycleInput): WorldCompetitionCyclePlan {
      if (closed || !id(careerId)) {
        throw new Error('invalid world calendar Career scope');
      }
      const input = cloneInert(rawInput);
      const plan = planWorldCompetitionCycle(input);
      const requestJson = canonicalJson(input);
      const planJson = canonicalJson(plan);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = row(careerId, input.cycleOrdinal);
        if (existing) {
          const prior = parse(careerId, input.cycleOrdinal,
            existing);
          if (existing.request_json !== requestJson) {
            throw new Error('world competition cycle is already frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        const firstRow = first.get(careerId) as
          Pick<CycleRow, 'request_json'> | undefined;
        if (firstRow) {
          const previous = JSON.parse(firstRow.request_json) as
            WorldCompetitionCycleInput;
          if (previous.careerStartYear !== input.careerStartYear) {
            throw new Error('Career world cycle origin changed');
          }
        }
        db.prepare(`INSERT INTO world_competition_cycles
          (career_id, cycle_ordinal, request_json, plan_json)
          VALUES (?, ?, ?, ?)`).run(careerId, input.cycleOrdinal,
          requestJson, planJson);
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readCycle(careerId: string,
      cycleOrdinal: number): WorldCompetitionCyclePlan | null {
      if (closed || !id(careerId) || !ordinal(cycleOrdinal)) {
        throw new Error('invalid world calendar read scope');
      }
      const stored = row(careerId, cycleOrdinal);
      return stored ? parse(careerId, cycleOrdinal, stored) : null;
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing string-path facade owns its connection and schema. */
export const openSqliteWorldCompetitionCycleStore = (databasePath: string): SqliteWorldCompetitionCycleStore =>
  createSqliteWorldCompetitionCycleStore(databasePath);

/** Read-only projection of the same owner on a consumer connection. No opener, schema writes or close capability. */
export const worldCompetitionCycleEvidenceFromSqlite = (db: DatabaseSync): Pick<SqliteWorldCompetitionCycleStore, 'readCycle'> => {
  const owner = createSqliteWorldCompetitionCycleStore(db);
  return Object.freeze({ readCycle: owner.readCycle });
};
