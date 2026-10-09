import type { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { planWbcDirectBerths, type WbcBerthAuthority,
  type WbcBerthInput, type WbcDirectBerths } from
  '../../core/world/competition/WbcBerths';
import type { SqliteNationalQualificationHistoryStore } from
  './SqliteNationalQualificationHistoryStore';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteWbcRegionalCoefficientStore } from
  './SqliteWbcRegionalCoefficientStore';

export type WbcDirectBerthRequest = Readonly<{
  careerId: string;
  input: WbcBerthInput;
}>;
export type SqliteWbcDirectBerthStore = Readonly<{
  initialize(request: WbcDirectBerthRequest): WbcDirectBerths;
  readDirect(careerId: string, editionId: string):
    WbcDirectBerths | null;
  close(): void;
}>;
type Row = { request_json: string; direct_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Freeze twenty direct WBC berths before selecting qualifier entrants. */
const createSqliteWbcDirectBerthStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    editionCutoff: WbcBerthAuthority['editionCutoff'];
    editionCutoffForCareer?: (careerId: string, editionId: string) =>
      ReturnType<WbcBerthAuthority['editionCutoff']>;
    coefficients: Pick<SqliteWbcRegionalCoefficientStore, 'authority'>;
    regional: Pick<SqliteNationalQualificationHistoryStore,
      'regionalAuthority'>;
    nations: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
  }>,
): SqliteWbcDirectBerthStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) {
    throw new Error('invalid WBC direct berth database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_direct_berths (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, direct_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  }
  const get = db.prepare(`SELECT request_json, direct_json
    FROM world_wbc_direct_berths WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: WbcDirectBerthRequest):
    WbcDirectBerths => {
    const authority: Omit<WbcBerthAuthority,
      'qualifierPodWinner'> = {
      editionCutoff: sources.editionCutoffForCareer
        ? (editionId) => sources.editionCutoffForCareer!(request.careerId, editionId)
        : sources.editionCutoff,
      regionalCoefficient: sources.coefficients.authority(
        request.careerId).regionalCoefficient,
      regionalChampionship: sources.regional.regionalAuthority(
        request.careerId).regionalChampionship,
      nationCompetitionRegion: sources.nations.authority(
        request.careerId).nationCompetitionRegion,
    };
    return planWbcDirectBerths(request.input, authority);
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): WbcDirectBerths => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcDirectBerthRequest;
      const saved = JSON.parse(stored.direct_json) as
        WbcDirectBerths;
      const direct = project(request);
      if (request.careerId !== careerId
        || request.input.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.direct_json
        || canonicalJson(direct) !== stored.direct_json) {
        throw new Error('WBC direct berth replay differs');
      }
      return direct;
    } catch (cause) {
      throw new Error(`corrupt WBC direct berths for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid WBC direct berth scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: WbcDirectBerthRequest):
      WbcDirectBerths {
      assertScope(rawRequest?.careerId, rawRequest?.input?.editionId);
      const request = cloneInert(rawRequest);
      const direct = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId,
          request.input.editionId);
        if (stored) {
          const prior = replay(request.careerId,
            request.input.editionId, stored);
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('WBC direct berth source is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_wbc_direct_berths
          (career_id, edition_id, request_json, direct_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.input.editionId, canonicalJson(request),
            canonicalJson(direct));
        db.exec('COMMIT');
        return direct;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readDirect(careerId: string,
      editionId: string): WbcDirectBerths | null {
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
export const openSqliteWbcDirectBerthStore = (databasePath: string, sources: Parameters<typeof createSqliteWbcDirectBerthStore>[1]): SqliteWbcDirectBerthStore =>
  createSqliteWbcDirectBerthStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcDirectBerthEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcDirectBerthStore>[1]): Pick<SqliteWbcDirectBerthStore, 'readDirect'> => {
  const owner = createSqliteWbcDirectBerthStore(db, sources);
  return Object.freeze({ readDirect: owner.readDirect });
};
