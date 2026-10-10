import type { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import type { WbcBerthAuthority,
  WbcRegionalCoefficient } from
  '../../core/world/competition/WbcBerths';
import { buildWbcRegionalCoefficients,
  type WbcRegionalCoefficientPolicy,
  type WbcRegionalCoefficientPolicyRegistry } from
  '../../core/world/competition/WbcRegionalCoefficients';
import type { SqliteOfficialWbcHistoryStore } from
  './SqliteOfficialWbcHistoryStore';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type WbcCoefficientRequest = Readonly<{
  careerId: string;
  olderEditionId: string;
  newerEditionId: string;
  policy: WbcRegionalCoefficientPolicy;
  registry: WbcRegionalCoefficientPolicyRegistry;
}>;
export type SqliteWbcRegionalCoefficientStore = Readonly<{
  initialize(request: WbcCoefficientRequest):
    readonly WbcRegionalCoefficient[];
  readSnapshot(careerId: string, newerEditionId: string):
    readonly WbcRegionalCoefficient[] | null;
  authority(careerId: string): Readonly<{
    regionalCoefficient: WbcBerthAuthority['regionalCoefficient'];
  }>;
  close(): void;
}>;
type Row = { newer_edition_id: string; request_json: string;
  coefficients_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Two official WBC editions set the next tournament's regional scores. */
const createSqliteWbcRegionalCoefficientStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    history: Pick<SqliteOfficialWbcHistoryStore, 'readEdition'>;
  }>,
): SqliteWbcRegionalCoefficientStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) {
    throw new Error('invalid WBC coefficient database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_regional_coefficients (
    career_id TEXT NOT NULL, newer_edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, coefficients_json TEXT NOT NULL,
    PRIMARY KEY (career_id, newer_edition_id)
  );`);
  }
  const get = db.prepare(`SELECT newer_edition_id, request_json,
    coefficients_json FROM world_wbc_regional_coefficients
    WHERE career_id=? ORDER BY newer_edition_id`);
  const rows = (careerId: string): Row[] =>
    get.all(careerId) as Row[];
  const readEdition = createCompetitionSourceReader(sources.history.readEdition, sources.history);
  const project = (request: WbcCoefficientRequest):
    readonly WbcRegionalCoefficient[] => {
    const older = readEdition(request.careerId,
      request.olderEditionId);
    const newer = readEdition(request.careerId,
      request.newerEditionId);
    if (!older || !newer) {
      throw new Error('WBC coefficients need two official world editions');
    }
    return buildWbcRegionalCoefficients(older, newer,
      request.policy, request.registry);
  };
  const replay = (careerId: string, beforeDay = Number.MAX_SAFE_INTEGER,
    onlyEditionId?: string): Readonly<{
    request: WbcCoefficientRequest;
    coefficients: readonly WbcRegionalCoefficient[];
  }>[] => {
    try {
      return rows(careerId).flatMap((row) => {
        const request = JSON.parse(row.request_json) as
          WbcCoefficientRequest;
        const saved = JSON.parse(row.coefficients_json) as
          WbcRegionalCoefficient[];
        if (request.careerId !== careerId
          || request.newerEditionId !== row.newer_edition_id
          || canonicalJson(request) !== row.request_json
          || canonicalJson(saved) !== row.coefficients_json
          || !Array.isArray(saved) || saved.length !== 4
          || saved.some((item, index) => item.region !== REGIONS[index]
            || !Number.isSafeInteger(item.completedAtDay) || item.completedAtDay < 0
            || item.completedAtDay !== saved[0].completedAtDay)) {
          throw new Error('WBC regional coefficient replay differs');
        }
        if ((onlyEditionId !== undefined && row.newer_edition_id !== onlyEditionId)
          || saved[0].completedAtDay > beforeDay) return [];
        const coefficients = project(request);
        if (canonicalJson(coefficients) !== row.coefficients_json) {
          throw new Error('WBC regional coefficient replay differs');
        }
        return [Object.freeze({ request, coefficients })];
      });
    } catch (cause) {
      throw new Error(`corrupt WBC coefficients for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const readAtCutoff = createCompetitionSourceReader((careerId: string, beforeDay: number) => replay(careerId, beforeDay));
  const assertCareer = (careerId: string): void => {
    if (closed || !id(careerId)) {
      throw new Error('invalid WBC coefficient career');
    }
  };
  return Object.freeze({
    initialize(rawRequest: WbcCoefficientRequest):
      readonly WbcRegionalCoefficient[] {
      assertCareer(rawRequest?.careerId);
      const request = cloneInert(rawRequest);
      if (!id(request.olderEditionId)
        || !id(request.newerEditionId)) {
        throw new Error('invalid WBC coefficient editions');
      }
      const coefficients = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = rows(request.careerId).find((item) =>
          item.newer_edition_id === request.newerEditionId);
        if (stored) {
          const prior = replay(request.careerId, Number.MAX_SAFE_INTEGER,
            request.newerEditionId).find((item) =>
            item.request.newerEditionId === request.newerEditionId)!;
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('WBC coefficient source is frozen differently');
          }
          db.exec('COMMIT');
          return prior.coefficients;
        }
        db.prepare(`INSERT INTO world_wbc_regional_coefficients
          (career_id, newer_edition_id, request_json, coefficients_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.newerEditionId, canonicalJson(request),
            canonicalJson(coefficients));
        db.exec('COMMIT');
        return coefficients;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSnapshot(careerId: string,
      newerEditionId: string): readonly WbcRegionalCoefficient[] | null {
      assertCareer(careerId);
      if (!id(newerEditionId)) {
        throw new Error('invalid WBC coefficient edition');
      }
      return replay(careerId, Number.MAX_SAFE_INTEGER, newerEditionId).find((item) =>
        item.request.newerEditionId === newerEditionId)
        ?.coefficients ?? null;
    },
    authority(careerId: string) {
      assertCareer(careerId);
      return Object.freeze({ regionalCoefficient: (
        region: ClubWorldRegion, beforeDay: number) => {
        if (!REGIONS.includes(region)
          || !Number.isSafeInteger(beforeDay) || beforeDay < 0) {
          throw new Error('invalid WBC coefficient cutoff');
        }
        const eligible = readAtCutoff(careerId, beforeDay).flatMap((item) =>
          item.coefficients.filter((coefficient) =>
            coefficient.region === region
            && coefficient.completedAtDay <= beforeDay))
          .sort((left, right) =>
            right.completedAtDay - left.completedAtDay);
        if (eligible.length > 1
          && eligible[0].completedAtDay === eligible[1].completedAtDay) {
          throw new Error('WBC coefficient order is ambiguous');
        }
        return eligible[0] ?? null;
      } });
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteWbcRegionalCoefficientStore = (databasePath: string, sources: Parameters<typeof createSqliteWbcRegionalCoefficientStore>[1]): SqliteWbcRegionalCoefficientStore =>
  createSqliteWbcRegionalCoefficientStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcRegionalCoefficientEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcRegionalCoefficientStore>[1]): Pick<SqliteWbcRegionalCoefficientStore, 'readSnapshot' | 'authority'> => {
  const owner = createSqliteWbcRegionalCoefficientStore(db, sources);
  return Object.freeze({ readSnapshot: owner.readSnapshot, authority: owner.authority });
};
