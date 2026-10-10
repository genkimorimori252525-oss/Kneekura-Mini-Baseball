import type { DatabaseSync } from 'node:sqlite';
import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { selectWbcGlobalQualifierEntrants,
  type WbcQualifierEligibility,
  type WbcQualifierSelection,
  type WbcQualifierSelectionPolicy,
  type WbcQualifierSelectionPolicyRegistry } from
  '../../core/world/competition/WbcGlobalQualifierSelection';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteWbcDirectBerthStore } from
  './SqliteWbcDirectBerthStore';
import type { SqliteWorldNationalRankingSnapshotStore } from
  './SqliteWorldNationalRankingSnapshotStore';
import type { SqliteNationalRosterEligibilityStore } from './SqliteNationalRosterEligibilityStore';

export type WbcQualifierSelectionRequest = Readonly<{
  careerId: string;
  wbcEditionId: string;
  qualifierEditionId: string;
  rankingAsOfDay: number;
  eligibility: WbcQualifierEligibility;
  policy: WbcQualifierSelectionPolicy;
  registry: WbcQualifierSelectionPolicyRegistry;
}>;
export type SqliteWbcQualifierSelectionStore = Readonly<{
  initialize(request: WbcQualifierSelectionRequest):
    WbcQualifierSelection;
  readSelection(careerId: string,
    qualifierEditionId: string): WbcQualifierSelection | null;
  readRequest(careerId: string, qualifierEditionId: string): WbcQualifierSelectionRequest | null;
  close(): void;
}>;
type Row = { request_json: string; selection_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value)
  && value >= 0;
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const freeze = <T>(value: T): T => {
  if (value !== null && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Freeze sixteen entrants from direct berths and cutoff ranking. */
const createSqliteWbcQualifierSelectionStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    direct: Pick<SqliteWbcDirectBerthStore, 'readDirect'>;
    ranking: Pick<SqliteWorldNationalRankingSnapshotStore,
      'readRanking'>;
    nations: Pick<SqliteNationCompetitionRegionStore,
      'authority'>;
    eligibility?: Pick<SqliteNationalRosterEligibilityStore, 'readEligibilityForEdition'>;
  }>,
): SqliteWbcQualifierSelectionStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) {
    throw new Error('invalid WBC qualifier selection database path');
  }
  const readDirect = createCompetitionSourceReader(sources.direct.readDirect, sources.direct);
  const readRanking = createCompetitionSourceReader(sources.ranking.readRanking, sources.ranking);
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_selections (
    career_id TEXT NOT NULL, qualifier_edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, selection_json TEXT NOT NULL,
    PRIMARY KEY (career_id, qualifier_edition_id)
  );`);
  }
  const get = db.prepare(`SELECT request_json, selection_json
    FROM world_wbc_qualifier_selections
    WHERE career_id=? AND qualifier_edition_id=?`);
  const row = (careerId: string,
    qualifierEditionId: string): Row | null =>
    (get.get(careerId, qualifierEditionId) as Row | undefined)
      ?? null;
  const project = (request: WbcQualifierSelectionRequest):
    WbcQualifierSelection => {
    if (sources.eligibility) {
      const accepted = sources.eligibility.readEligibilityForEdition(request.careerId, request.wbcEditionId, request.eligibility.snapshotId);
      if (!accepted || canonicalJson(accepted) !== canonicalJson(request.eligibility)) {
        throw new Error('WBC qualifier requires accepted national roster eligibility');
      }
    }
    const direct = readDirect(request.careerId,
      request.wbcEditionId);
    const ranking = readRanking(request.careerId,
      request.rankingAsOfDay);
    if (!direct || !ranking) {
      throw new Error('WBC qualifier needs direct berths and ranking');
    }
    return selectWbcGlobalQualifierEntrants(
      request.qualifierEditionId, direct, ranking,
      request.eligibility, request.policy, request.registry,
      sources.nations.authority(request.careerId)
        .nationCompetitionRegion);
  };
  const replay = (careerId: string,
    qualifierEditionId: string, stored: Row):
    WbcQualifierSelection => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcQualifierSelectionRequest;
      const saved = JSON.parse(stored.selection_json) as
        WbcQualifierSelection;
      const selection = project(request);
      if (request.careerId !== careerId
        || request.qualifierEditionId !== qualifierEditionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.selection_json
        || canonicalJson(selection) !== stored.selection_json) {
        throw new Error('WBC qualifier selection replay differs');
      }
      return selection;
    } catch (cause) {
      throw new Error(`corrupt WBC qualifier selection for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string,
    qualifierEditionId: string): void => {
    if (closed || !id(careerId) || !id(qualifierEditionId)) {
      throw new Error('invalid WBC qualifier selection scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: WbcQualifierSelectionRequest):
      WbcQualifierSelection {
      assertScope(rawRequest?.careerId,
        rawRequest?.qualifierEditionId);
      if (!id(rawRequest.wbcEditionId)
        || !day(rawRequest.rankingAsOfDay)) {
        throw new Error('invalid WBC qualifier selection request');
      }
      const request = cloneInert(rawRequest);
      const selection = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId,
          request.qualifierEditionId);
        if (stored) {
          const prior = replay(request.careerId,
            request.qualifierEditionId, stored);
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('WBC qualifier selection source is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_wbc_qualifier_selections
          (career_id, qualifier_edition_id, request_json, selection_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.qualifierEditionId, canonicalJson(request),
            canonicalJson(selection));
        db.exec('COMMIT');
        return selection;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSelection(careerId: string,
      qualifierEditionId: string): WbcQualifierSelection | null {
      assertScope(careerId, qualifierEditionId);
      const stored = row(careerId, qualifierEditionId);
      return stored ? replay(careerId, qualifierEditionId, stored)
        : null;
    },
    readRequest(careerId: string, qualifierEditionId: string): WbcQualifierSelectionRequest | null {
      assertScope(careerId, qualifierEditionId);
      const stored = row(careerId, qualifierEditionId);
      if (!stored) return null;
      replay(careerId, qualifierEditionId, stored);
      return freeze(JSON.parse(stored.request_json) as WbcQualifierSelectionRequest);
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteWbcQualifierSelectionStore = (databasePath: string, sources: Parameters<typeof createSqliteWbcQualifierSelectionStore>[1]): SqliteWbcQualifierSelectionStore =>
  createSqliteWbcQualifierSelectionStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcQualifierSelectionEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcQualifierSelectionStore>[1]): Pick<SqliteWbcQualifierSelectionStore, 'readSelection' | 'readRequest'> => {
  const owner = createSqliteWbcQualifierSelectionStore(db, sources);
  return Object.freeze({ readSelection: owner.readSelection, readRequest: owner.readRequest });
};
