import { domesticPostseasonPreparation, type DomesticPostseasonPreparation, type DomesticPostseasonPreparationSources } from './SqliteDomesticPostseasonPreparation';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DomesticCompetitionSeasonSnapshot } from
  '../../core/world/competition/DomesticCompetitionSeason';
import { projectConferenceDomesticCompetitionFromWorld,
  type ConferenceDomesticCompetitionRequest } from
  './ConferenceDomesticCompetitionFromWorld';
import { projectDirectDomesticCompetitionFromWorld,
  type DirectDomesticCompetitionRequest } from
  './DirectDomesticCompetitionFromWorld';
import { readCompletedDomesticSeason } from './DomesticSeasonRuntime';
import { projectNorthAmericaDomesticCompetitionFromWorld,
  type NorthAmericaDomesticCompetitionRequest } from
  './NorthAmericaDomesticCompetitionFromWorld';
import { projectWinterDomesticCompetitionFromWorld,
  type WinterDomesticCompetitionRequest } from
  './WinterDomesticCompetitionFromWorld';

type CompletionStores = Parameters<typeof readCompletedDomesticSeason>[0];
export type DomesticCompetitionSourceRequest =
  | Readonly<{ kind: 'DIRECT'; input: DirectDomesticCompetitionRequest }>
  | Readonly<{ kind: 'CONFERENCE';
      input: ConferenceDomesticCompetitionRequest }>
  | Readonly<{ kind: 'NORTH_AMERICA';
      input: NorthAmericaDomesticCompetitionRequest }>
  | Readonly<{ kind: 'WINTER'; input: WinterDomesticCompetitionRequest }>;
export type SqliteDomesticCompetitionSeasonStore = DomesticPostseasonPreparation & Readonly<{
  finalize(request: DomesticCompetitionSourceRequest):
    DomesticCompetitionSeasonSnapshot;
  readSnapshot(careerId: string, seasonId: string):
    DomesticCompetitionSeasonSnapshot | null;
  close(): void;
}>;
type SeasonRow = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const project = (stores: CompletionStores,
  request: DomesticCompetitionSourceRequest):
  DomesticCompetitionSeasonSnapshot => {
  const result = request.kind === 'DIRECT'
    ? projectDirectDomesticCompetitionFromWorld(stores, request.input)
    : request.kind === 'CONFERENCE'
      ? projectConferenceDomesticCompetitionFromWorld(stores, request.input)
      : request.kind === 'NORTH_AMERICA'
        ? projectNorthAmericaDomesticCompetitionFromWorld(stores,
          request.input)
        : request.kind === 'WINTER'
          ? projectWinterDomesticCompetitionFromWorld(stores,
            request.input) : null;
  if (!result?.snapshot) {
    throw new Error('domestic competition is not officially complete');
  }
  return result.snapshot;
};

/** Store only a title/berth snapshot reproducible from World and Match. */
export const openSqliteDomesticCompetitionSeasonStore = (
  databasePath: string,
  sources: DomesticPostseasonPreparationSources,
): SqliteDomesticCompetitionSeasonStore => {
  if (!id(databasePath)) {
    throw new Error('invalid domestic competition database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_domestic_competition_seasons (
    career_id TEXT NOT NULL, season_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, season_id)
  );`);
  const get = db.prepare(`SELECT request_json, snapshot_json
    FROM world_domestic_competition_seasons
    WHERE career_id=? AND season_id=?`);
  const row = (careerId: string, seasonId: string): SeasonRow | null =>
    (get.get(careerId, seasonId) as SeasonRow | undefined) ?? null;
  const parse = (careerId: string, seasonId: string,
    stored: SeasonRow): DomesticCompetitionSeasonSnapshot => {
    try {
      const request = JSON.parse(stored.request_json) as
        DomesticCompetitionSourceRequest;
      const snapshot = JSON.parse(stored.snapshot_json) as
        DomesticCompetitionSeasonSnapshot;
      if (request.input?.careerId !== careerId
        || request.input?.seasonId !== seasonId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(snapshot) !== stored.snapshot_json) {
        throw new Error('domestic title scope or serialization differs');
      }
      preparation.assertFinalRequest(request);
      const replayed = project(sources, request);
      if (replayed.seasonId !== seasonId
        || canonicalJson(replayed) !== stored.snapshot_json) {
        throw new Error('domestic title replay differs');
      }
      return replayed;
    } catch (cause) {
      throw new Error(`corrupt domestic competition season for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const preparation = domesticPostseasonPreparation(db, sources, () => {
    if (closed) throw new Error('domestic competition store is closed');
  });
  return Object.freeze({
    ...preparation,
    finalize(rawRequest: DomesticCompetitionSourceRequest):
      DomesticCompetitionSeasonSnapshot {
      if (closed) throw new Error('domestic competition store is closed');
      const request = cloneInert(rawRequest);
      if (!id(request?.input?.careerId)
        || !id(request.input.seasonId)) {
        throw new Error('invalid domestic competition scope');
      }
      preparation.assertFinalRequest(request);
      const snapshot = project(sources, request);
      const requestJson = canonicalJson(request);
      const snapshotJson = canonicalJson(snapshot);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = row(request.input.careerId,
          request.input.seasonId);
        if (existing) {
          const prior = parse(request.input.careerId,
            request.input.seasonId, existing);
          if (existing.request_json !== requestJson) {
            throw new Error('domestic competition season is already frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_domestic_competition_seasons
          (career_id, season_id, request_json, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(request.input.careerId,
          request.input.seasonId, requestJson, snapshotJson);
        const saved = row(request.input.careerId, request.input.seasonId);
        if (!saved || saved.request_json !== requestJson || saved.snapshot_json !== snapshotJson) {
          throw new Error('domestic title changed during acceptance');
        }
        parse(request.input.careerId, request.input.seasonId, saved);
        db.exec('COMMIT');
        return snapshot;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSnapshot(careerId: string,
      seasonId: string): DomesticCompetitionSeasonSnapshot | null {
      if (closed || !id(careerId) || !id(seasonId)) {
        throw new Error('invalid domestic competition read scope');
      }
      const stored = row(careerId, seasonId);
      return stored ? parse(careerId, seasonId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
