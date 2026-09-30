import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planRegionalNationalSchedule, type RegionalNationalSchedule,
  type RegionalNationalSchedulePolicy } from '../../core/world/competition/RegionalNationalSchedule';
import type { RegionalNationalKnockoutEdition } from '../../core/world/competition/RegionalNationalKnockout';
import type { SqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import type { NationalCompetitionSelection, SqliteNationalCompetitionSelectionStore } from
  './SqliteNationalCompetitionSelectionStore';

export type RegionalNationalScheduleRequest = Readonly<{
  careerId: string;
  editionId: string;
  knockoutEdition: RegionalNationalKnockoutEdition;
  policy: RegionalNationalSchedulePolicy;
}>;
export type DurableRegionalNationalSchedule = RegionalNationalSchedule & Readonly<{
  worldSelection: NationalCompetitionSelection;
}>;
export type SqliteRegionalNationalScheduleStore = Readonly<{
  initialize(request: RegionalNationalScheduleRequest): DurableRegionalNationalSchedule;
  readSchedule(careerId: string, editionId: string): DurableRegionalNationalSchedule | null;
  close(): void;
}>;
type Row = { request_json: string; schedule_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(cloneInert(value),
  (_key, item: unknown) => item !== null && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

/** World calendar, group Edition and future knockout Edition remain frozen through replay. */
export const openSqliteRegionalNationalScheduleStore = (
  databasePath: string,
  sources: Readonly<{
    groups: Pick<SqliteRegionalNationalGroupStore, 'readEdition' | 'readPlan'>;
    selections: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  }>,
): SqliteRegionalNationalScheduleStore => {
  if (!id(databasePath)) throw new Error('invalid regional national schedule database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_schedules (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, schedule_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, schedule_json
    FROM world_regional_national_schedules WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: RegionalNationalScheduleRequest): DurableRegionalNationalSchedule => {
    const edition = sources.groups.readEdition(request.careerId, request.editionId);
    const plan = sources.groups.readPlan(request.careerId, request.editionId);
    const selection = sources.selections.readSelection(request.careerId, request.editionId);
    if (!edition || !plan || !selection || edition.editionId !== request.editionId
      || selection.editionId !== request.editionId || selection.kind !== 'REGIONAL_NATIONAL'
      || selection.region !== edition.region
      || selection.calendarWindow.startsOnDay !== edition.calendarWindow.startsOnDay
      || selection.calendarWindow.endsOnDay !== edition.calendarWindow.endsOnDay
      || selection.qualificationCutoff.day >= edition.calendarWindow.startsOnDay) {
      throw new Error('regional national schedule requires accepted World selection and groups');
    }
    return Object.freeze({ ...planRegionalNationalSchedule(edition, plan, request.knockoutEdition, request.policy),
      worldSelection: selection });
  };
  const replay = (careerId: string, editionId: string, stored: Row): DurableRegionalNationalSchedule => {
    try {
      const request = JSON.parse(stored.request_json) as RegionalNationalScheduleRequest;
      const saved = JSON.parse(stored.schedule_json) as DurableRegionalNationalSchedule;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json || canonicalJson(saved) !== stored.schedule_json) {
        throw new Error('regional national schedule serialization differs');
      }
      const schedule = project(request);
      if (canonicalJson(schedule) !== stored.schedule_json) throw new Error('regional national schedule replay differs');
      return schedule;
    } catch (cause) { throw new Error(`corrupt regional national schedule for ${careerId}`, { cause }); }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) throw new Error('invalid regional national schedule scope');
  };
  return Object.freeze({
    initialize(rawRequest: RegionalNationalScheduleRequest): DurableRegionalNationalSchedule {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId, stored);
          if (canonicalJson(request) !== stored.request_json) throw new Error('regional national schedule is frozen differently');
          db.exec('COMMIT'); return prior;
        }
        const schedule = project(request);
        db.prepare(`INSERT INTO world_regional_national_schedules
          (career_id, edition_id, request_json, schedule_json) VALUES (?, ?, ?, ?)`)
          .run(request.careerId, request.editionId, canonicalJson(request), canonicalJson(schedule));
        db.exec('COMMIT'); return schedule;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readSchedule(careerId: string, editionId: string): DurableRegionalNationalSchedule | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId); return stored ? replay(careerId, editionId, stored) : null;
    },
    close(): void { if (!closed) db.close(); closed = true; },
  });
};
