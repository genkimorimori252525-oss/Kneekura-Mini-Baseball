import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PremierTwelveAuthority,
  PremierTwelveRanking } from
  '../../core/world/competition/PremierTwelve';
import { buildWorldNationalRanking,
  type WorldNationalRankingPolicy,
  type WorldNationalRankingPolicyRegistry } from
  '../../core/world/competition/WorldNationalRankingHistory';
import type { SqliteWorldNationalRankingHistoryStore } from
  './SqliteWorldNationalRankingHistoryStore';

export type WorldNationalRankingRequest = Readonly<{
  careerId: string;
  asOfDay: number;
  nationIds: readonly string[];
  policy: WorldNationalRankingPolicy;
  registry: WorldNationalRankingPolicyRegistry;
}>;
export type SqliteWorldNationalRankingSnapshotStore = Readonly<{
  initialize(request: WorldNationalRankingRequest):
    PremierTwelveRanking;
  readRanking(careerId: string,
    asOfDay: number): PremierTwelveRanking | null;
  authority(careerId: string): Pick<PremierTwelveAuthority,
    'worldNationalRanking'>;
  close(): void;
}>;
type Row = { request_json: string; ranking_json: string };
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

/** Freeze the official ranking used at an edition's selection cutoff. */
export const openSqliteWorldNationalRankingSnapshotStore = (
  databasePath: string,
  sources: Readonly<{ history: Pick<
    SqliteWorldNationalRankingHistoryStore, 'readHistory'> }>,
): SqliteWorldNationalRankingSnapshotStore => {
  if (!id(databasePath)) {
    throw new Error('invalid world national ranking database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_national_ranking_snapshots (
    career_id TEXT NOT NULL, as_of_day INTEGER NOT NULL,
    request_json TEXT NOT NULL, ranking_json TEXT NOT NULL,
    PRIMARY KEY (career_id, as_of_day)
  );`);
  const get = db.prepare(`SELECT request_json, ranking_json
    FROM world_national_ranking_snapshots
    WHERE career_id=? AND as_of_day=?`);
  const row = (careerId: string, asOfDay: number): Row | null =>
    (get.get(careerId, asOfDay) as Row | undefined) ?? null;
  const project = (request: WorldNationalRankingRequest):
    PremierTwelveRanking => buildWorldNationalRanking(
      sources.history.readHistory(request.careerId),
      request.asOfDay, request.nationIds, request.policy,
      request.registry);
  const replay = (careerId: string, asOfDay: number,
    stored: Row): PremierTwelveRanking => {
    try {
      const request = JSON.parse(stored.request_json) as
        WorldNationalRankingRequest;
      const saved = JSON.parse(stored.ranking_json) as
        PremierTwelveRanking;
      const ranking = project(request);
      if (request.careerId !== careerId
        || request.asOfDay !== asOfDay
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.ranking_json
        || canonicalJson(ranking) !== stored.ranking_json) {
        throw new Error('world national ranking replay differs');
      }
      return ranking;
    } catch (cause) {
      throw new Error(`corrupt world national ranking snapshot for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string,
    asOfDay: number): void => {
    if (closed || !id(careerId) || !day(asOfDay)) {
      throw new Error('invalid world national ranking scope');
    }
  };
  const readRanking = (careerId: string,
    asOfDay: number): PremierTwelveRanking | null => {
    assertScope(careerId, asOfDay);
    const stored = row(careerId, asOfDay);
    return stored ? replay(careerId, asOfDay, stored) : null;
  };
  return Object.freeze({
    initialize(rawRequest: WorldNationalRankingRequest):
      PremierTwelveRanking {
      assertScope(rawRequest?.careerId, rawRequest?.asOfDay);
      const request = cloneInert(rawRequest);
      const ranking = project(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.asOfDay);
        if (stored) {
          const prior = replay(request.careerId,
            request.asOfDay, stored);
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('world national ranking source is frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_national_ranking_snapshots
          (career_id, as_of_day, request_json, ranking_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.asOfDay, canonicalJson(request),
            canonicalJson(ranking));
        db.exec('COMMIT');
        return ranking;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readRanking,
    authority(careerId: string): Pick<PremierTwelveAuthority,
      'worldNationalRanking'> {
      if (closed || !id(careerId)) {
        throw new Error('invalid world national ranking career');
      }
      return Object.freeze({ worldNationalRanking: (beforeDay: number) =>
        readRanking(careerId, beforeDay) });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
