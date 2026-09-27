import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldBerthAuthority } from
  '../../core/world/competition/ClubWorldBerths';
import { buildClubWorldQualificationSources,
  type ClubWorldQualificationSourceInput,
  type ClubWorldQualificationSources } from
  '../../core/world/competition/ClubWorldQualificationSources';
import type { SqliteRegionalClubSeasonHistoryStore } from
  './SqliteRegionalClubSeasonHistoryStore';

type Request = Omit<ClubWorldQualificationSourceInput, 'authority'>;
type Row = { request_json: string; sources_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

export type SqliteClubWorldQualificationSourceStore = Readonly<{
  initialize(careerId: string, input: Request):
    ClubWorldQualificationSources;
  readSources(careerId: string,
    editionId: string): ClubWorldQualificationSources | null;
  close(): void;
}>;

/** Freeze four-season coefficients and rankings after replaying regional titles. */
export const openSqliteClubWorldQualificationSourceStore = (
  databasePath: string,
  sources: Readonly<{
    regional: Pick<SqliteRegionalClubSeasonHistoryStore, 'authority'>;
    editionHost: ClubWorldBerthAuthority['editionHost'];
  }>,
): SqliteClubWorldQualificationSourceStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Club World qualification database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_world_qualification_sources (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, sources_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, sources_json
    FROM world_club_world_qualification_sources
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const project = (careerId: string,
    request: Request): ClubWorldQualificationSources =>
    buildClubWorldQualificationSources({ ...request,
      authority: { editionHost: sources.editionHost,
        completedRegionalSeason:
          sources.regional.authority(careerId).completedRegionalSeason } });
  const replay = (careerId: string, editionId: string,
    stored: Row): ClubWorldQualificationSources => {
    try {
      const request = JSON.parse(stored.request_json) as Request;
      const saved = JSON.parse(stored.sources_json) as
        ClubWorldQualificationSources;
      const projected = project(careerId, request);
      if (request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(saved) !== stored.sources_json
        || canonicalJson(projected) !== stored.sources_json) {
        throw new Error('Club World qualification source replay differs');
      }
      return projected;
    } catch (cause) {
      throw new Error(`corrupt Club World qualification source for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Club World qualification scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string,
      rawInput: Request): ClubWorldQualificationSources {
      assertScope(careerId, rawInput?.editionId);
      const request = cloneInert(rawInput);
      const result = project(careerId, request);
      const requestJson = canonicalJson(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, request.editionId);
        if (stored) {
          const prior = replay(careerId, request.editionId, stored);
          if (stored.request_json !== requestJson) {
            throw new Error('Club World qualification request is already frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_club_world_qualification_sources
          (career_id, edition_id, request_json, sources_json)
          VALUES (?, ?, ?, ?)`).run(careerId, request.editionId,
            requestJson, canonicalJson(result));
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readSources(careerId: string,
      editionId: string): ClubWorldQualificationSources | null {
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
