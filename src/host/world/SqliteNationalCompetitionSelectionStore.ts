import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PremierTwelveAuthority } from
  '../../core/world/competition/PremierTwelve';
import type { SqliteWorldCompetitionCycleStore } from
  './SqliteWorldCompetitionCycleStore';

export type NationalCompetitionSelectionRequest = Readonly<{
  careerId: string;
  editionId: string;
  cycleOrdinal: number;
  kind: 'WBC' | 'PREMIER_12';
  careerDayOne: string;
  cutoffDay: number;
}>;
export type NationalCompetitionSelection = Readonly<{
  editionId: string;
  cycleOrdinal: number;
  kind: NationalCompetitionSelectionRequest['kind'];
  calendarYear: number;
  careerDayOne: string;
  calendarPolicyVersion: string;
  calendarWindow: Readonly<{ startsOnDay: number; endsOnDay: number }>;
  qualificationCutoff: Readonly<{ snapshotId: string; day: number }>;
}>;
export type SqliteNationalCompetitionSelectionStore = Readonly<{
  initialize(request: NationalCompetitionSelectionRequest): NationalCompetitionSelection;
  readSelection(careerId: string, editionId: string): NationalCompetitionSelection | null;
  authority(careerId: string): Pick<PremierTwelveAuthority, 'editionCutoff'>;
  close(): void;
}>;
type Row = { cycle_ordinal: number; kind: string;
  request_json: string; selection_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

// Gregorian day arithmetic also supports years 0001..0099 without Date.UTC remapping.
const isoDay = (value: unknown): number | null => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const date = Number(value.slice(8, 10));
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const months = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || year > 9999 || month < 1 || month > 12
    || date < 1 || date > months[month - 1]) return null;
  const previous = year - 1;
  return previous * 365 + Math.floor(previous / 4)
    - Math.floor(previous / 100) + Math.floor(previous / 400)
    + months.slice(0, month - 1).reduce((total, days) => total + days, 0) + date - 1;
};

/** A saved World reservation supplies the edition window and selection authority. */
export const openSqliteNationalCompetitionSelectionStore = (
  databasePath: string,
  sources: Readonly<{ cycle: Pick<SqliteWorldCompetitionCycleStore, 'readCycle'> }>,
): SqliteNationalCompetitionSelectionStore => {
  if (!id(databasePath)) throw new Error('invalid national selection database path');
  const sqlite: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_selections (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    cycle_ordinal INTEGER NOT NULL, kind TEXT NOT NULL,
    request_json TEXT NOT NULL, selection_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id), UNIQUE (career_id, cycle_ordinal, kind)
  );`);
  const get = db.prepare(`SELECT cycle_ordinal, kind, request_json, selection_json
    FROM world_national_selections WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: NationalCompetitionSelectionRequest): NationalCompetitionSelection => {
    if (!id(request?.careerId) || !id(request.editionId)
      || !day(request.cycleOrdinal) || !day(request.cutoffDay)
      || !['WBC', 'PREMIER_12'].includes(request.kind)) {
      throw new Error('invalid national selection request');
    }
    const origin = isoDay(request.careerDayOne);
    if (origin === null) throw new Error('invalid national career calendar origin');
    const cycle = sources.cycle.readCycle(request.careerId, request.cycleOrdinal);
    if (!cycle) throw new Error('national selection requires accepted World cycle');
    if (Number(request.careerDayOne.slice(0, 4)) !== cycle.careerStartYear) {
      throw new Error('national career calendar origin disagrees with World cycle');
    }
    const reservations = cycle.reservations.filter((event) => event.kind === request.kind);
    if (reservations.length !== 1) throw new Error('national World reservation is missing');
    const event = reservations[0];
    const start = isoDay(event.window.startsOn);
    const end = isoDay(event.window.endsOn);
    if (start === null || end === null || end < start || start < origin) {
      throw new Error('invalid accepted national calendar window');
    }
    const calendarWindow = Object.freeze({ startsOnDay: start - origin + 1,
      endsOnDay: end - origin + 1 });
    if (request.cutoffDay >= calendarWindow.startsOnDay) {
      throw new Error('national qualification cutoff must be before the tournament');
    }
    const qualificationCutoff = Object.freeze({ snapshotId: JSON.stringify([
      'world-national-selection', request.careerId, request.editionId,
      cycle.careerStartYear, cycle.cycleOrdinal, cycle.calendarPolicyVersion,
      event.kind, event.calendarYear, event.window.startsOn, event.window.endsOn,
      request.careerDayOne, request.cutoffDay,
    ]), day: request.cutoffDay });
    return Object.freeze({ editionId: request.editionId, cycleOrdinal: request.cycleOrdinal,
      kind: request.kind, calendarYear: event.calendarYear,
      careerDayOne: request.careerDayOne, calendarPolicyVersion: cycle.calendarPolicyVersion,
      calendarWindow, qualificationCutoff });
  };
  const replay = (careerId: string, editionId: string, stored: Row) => {
    try {
      const request = JSON.parse(stored.request_json) as NationalCompetitionSelectionRequest;
      const saved = JSON.parse(stored.selection_json) as NationalCompetitionSelection;
      const selection = project(request);
      if (request.careerId !== careerId || request.editionId !== editionId
        || request.cycleOrdinal !== stored.cycle_ordinal || request.kind !== stored.kind
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.selection_json
        || canonicalJson(selection) !== stored.selection_json) {
        throw new Error('national selection replay differs');
      }
      return selection;
    } catch (cause) {
      throw new Error(`corrupt national selection for ${careerId}`, { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId?: string): void => {
    if (closed || !id(careerId) || (editionId !== undefined && !id(editionId))) {
      throw new Error('invalid national selection scope');
    }
  };
  const readSelection = (careerId: string, editionId: string): NationalCompetitionSelection | null => {
    assertScope(careerId, editionId);
    const stored = row(careerId, editionId);
    return stored ? replay(careerId, editionId, stored) : null;
  };
  return Object.freeze({
    initialize(rawRequest: NationalCompetitionSelectionRequest): NationalCompetitionSelection {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      const selection = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = row(request.careerId, request.editionId);
        if (existing) {
          const prior = replay(request.careerId, request.editionId, existing);
          if (canonicalJson(request) !== existing.request_json) {
            throw new Error('national selection is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        const first = db.prepare(`SELECT edition_id FROM world_national_selections
          WHERE career_id=? ORDER BY cycle_ordinal, edition_id LIMIT 1`).get(request.careerId) as
          { edition_id: string } | undefined;
        if (first && readSelection(request.careerId, first.edition_id)?.careerDayOne
          !== request.careerDayOne) throw new Error('national career calendar origin changed');
        const assigned = db.prepare(`SELECT edition_id FROM world_national_selections
          WHERE career_id=? AND cycle_ordinal=? AND kind=?`).get(request.careerId,
          request.cycleOrdinal, request.kind);
        if (assigned) throw new Error('national World reservation is already assigned');
        db.prepare(`INSERT INTO world_national_selections
          (career_id, edition_id, cycle_ordinal, kind, request_json, selection_json)
          VALUES (?, ?, ?, ?, ?, ?)`).run(request.careerId, request.editionId,
          request.cycleOrdinal, request.kind, canonicalJson(request), canonicalJson(selection));
        db.exec('COMMIT');
        return selection;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSelection,
    authority(careerId: string) {
      assertScope(careerId);
      return Object.freeze({ editionCutoff: (editionId: string) =>
        readSelection(careerId, editionId)?.qualificationCutoff ?? null });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
