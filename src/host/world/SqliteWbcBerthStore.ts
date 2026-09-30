import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { allocateWbcBerths, planWbcDirectBerths,
  type WbcBerthAllocation, type WbcBerthAuthority } from
  '../../core/world/competition/WbcBerths';
import type { SqliteNationalQualificationHistoryStore } from
  './SqliteNationalQualificationHistoryStore';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteWbcDirectBerthStore,
  WbcDirectBerthRequest } from './SqliteWbcDirectBerthStore';
import type { SqliteWbcRegionalCoefficientStore } from
  './SqliteWbcRegionalCoefficientStore';

export type SqliteWbcBerthStore = Readonly<{
  initialize(request: WbcDirectBerthRequest): WbcBerthAllocation;
  readAllocation(careerId: string,
    editionId: string): WbcBerthAllocation | null;
  close(): void;
}>;
type Row = { request_json: string; allocation_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Add four official qualifier winners to the previously frozen twenty slots. */
export const openSqliteWbcBerthStore = (
  databasePath: string,
  sources: Readonly<{
    direct: Pick<SqliteWbcDirectBerthStore, 'readDirect'>;
    editionCutoff: WbcBerthAuthority['editionCutoff'];
    coefficients: Pick<SqliteWbcRegionalCoefficientStore, 'authority'>;
    regional: Pick<SqliteNationalQualificationHistoryStore,
      'regionalAuthority'>;
    qualifiers: Pick<SqliteNationalQualificationHistoryStore,
      'qualifierAuthority'>;
    nations: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
  }>,
): SqliteWbcBerthStore => {
  if (!id(databasePath)) {
    throw new Error('invalid WBC berth database path');
  }
  const readDirect = createCompetitionSourceReader(sources.direct.readDirect, sources.direct);
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_berths (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, allocation_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, allocation_json
    FROM world_wbc_berths WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (request: WbcDirectBerthRequest):
    WbcBerthAllocation => {
    const direct = readDirect(request.careerId,
      request.input.editionId);
    if (!direct) throw new Error('WBC berths need frozen direct slots');
    const authority: WbcBerthAuthority = {
      editionCutoff: sources.editionCutoff,
      regionalCoefficient: sources.coefficients.authority(
        request.careerId).regionalCoefficient,
      regionalChampionship: sources.regional.regionalAuthority(
        request.careerId).regionalChampionship,
      qualifierPodWinner: sources.qualifiers.qualifierAuthority(
        request.careerId).qualifierPodWinner,
      nationCompetitionRegion: sources.nations.authority(
        request.careerId).nationCompetitionRegion,
    };
    if (canonicalJson(planWbcDirectBerths(request.input, authority))
      !== canonicalJson(direct)) {
      throw new Error('WBC allocation differs from frozen direct slots');
    }
    return allocateWbcBerths(request.input, authority);
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): WbcBerthAllocation => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcDirectBerthRequest;
      const saved = JSON.parse(stored.allocation_json) as
        WbcBerthAllocation;
      const allocation = project(request);
      if (request.careerId !== careerId
        || request.input.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.allocation_json
        || canonicalJson(allocation) !== stored.allocation_json) {
        throw new Error('WBC allocation replay differs');
      }
      return allocation;
    } catch (cause) {
      throw new Error(`corrupt WBC berth allocation for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid WBC berth allocation scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: WbcDirectBerthRequest): WbcBerthAllocation {
      assertScope(rawRequest?.careerId, rawRequest?.input?.editionId);
      const request = cloneInert(rawRequest);
      const allocation = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.input.editionId);
        if (stored) {
          const prior = replay(request.careerId,
            request.input.editionId, stored);
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('WBC berth source is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_wbc_berths
          (career_id, edition_id, request_json, allocation_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.input.editionId, canonicalJson(request),
            canonicalJson(allocation));
        db.exec('COMMIT');
        return allocation;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readAllocation(careerId: string,
      editionId: string): WbcBerthAllocation | null {
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
