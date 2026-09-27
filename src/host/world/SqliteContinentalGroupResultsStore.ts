import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeContinentalGroupResults,
  type ContinentalGroupResultsSnapshot } from
  '../../core/world/competition/ContinentalGroupResults';
import type { StandingsTiebreakPolicy } from
  '../../core/world/competition/OfficialStandings';
import type { SqliteContinentalHomeStore } from
  './SqliteContinentalHomeStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type ContinentalGroupResultsRequest = Readonly<{
  careerId: string;
  editionId: string;
  tiebreakPolicy: StandingsTiebreakPolicy;
}>;
export type SqliteContinentalGroupResultsStore = Readonly<{
  finalize(input: ContinentalGroupResultsRequest):
    ContinentalGroupResultsSnapshot | null;
  readResults(careerId: string, editionId: string):
    ContinentalGroupResultsSnapshot | null;
  close(): void;
}>;
type ResultsRow = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Freeze standings only after every planned game has a durable Match final. */
export const openSqliteContinentalGroupResultsStore = (
  databasePath: string,
  sources: Readonly<{
    homes: Pick<SqliteContinentalHomeStore, 'readAssignment'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteContinentalGroupResultsStore => {
  if (!id(databasePath)) throw new Error('invalid group results database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_continental_group_results (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, snapshot_json
    FROM world_continental_group_results WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): ResultsRow | null =>
    (get.get(careerId, editionId) as ResultsRow | undefined) ?? null;
  const project = (request: ContinentalGroupResultsRequest):
    ContinentalGroupResultsSnapshot | null => {
    const home = sources.homes.readAssignment(request.careerId,
      request.editionId);
    if (!home) throw new Error('continental group home plan is missing');
    const games = home.groupGamePlan.groups.flatMap((group) => group.games);
    if (games.length !== 72) {
      throw new Error('continental group plan does not contain 72 games');
    }
    const results = games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (results.some((result) => result === null)) return null;
    return finalizeContinentalGroupResults(home.groupGamePlan,
      results.filter((result) => result !== null),
      request.tiebreakPolicy);
  };
  const replay = (careerId: string, editionId: string,
    stored: ResultsRow): ContinentalGroupResultsSnapshot => {
    try {
      const request = JSON.parse(stored.request_json) as
        ContinentalGroupResultsRequest;
      const snapshot = JSON.parse(stored.snapshot_json) as
        ContinentalGroupResultsSnapshot;
      if (request.careerId !== careerId
        || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(snapshot) !== stored.snapshot_json) {
        throw new Error('group results scope or serialization differs');
      }
      const current = project(request);
      if (!current || canonicalJson(current) !== stored.snapshot_json) {
        throw new Error('continental group result replay differs');
      }
      return current;
    } catch (cause) {
      throw new Error(`corrupt continental group results for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    finalize(rawInput: ContinentalGroupResultsRequest):
      ContinentalGroupResultsSnapshot | null {
      if (closed) throw new Error('continental group results store is closed');
      const input = cloneInert(rawInput);
      if (!id(input?.careerId) || !id(input.editionId)) {
        throw new Error('invalid continental group results scope');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = row(input.careerId, input.editionId);
        if (prior) {
          const value = replay(input.careerId, input.editionId, prior);
          if (canonicalJson(input) !== prior.request_json) {
            throw new Error('continental group results are already frozen differently');
          }
          db.exec('COMMIT');
          return value;
        }
        const value = project(input);
        if (value) {
          db.prepare(`INSERT INTO world_continental_group_results
            (career_id, edition_id, request_json, snapshot_json)
            VALUES (?, ?, ?, ?)`).run(input.careerId, input.editionId,
              canonicalJson(input), canonicalJson(value));
        }
        db.exec('COMMIT');
        return value;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readResults(careerId: string, editionId: string):
      ContinentalGroupResultsSnapshot | null {
      if (closed || !id(careerId) || !id(editionId)) {
        throw new Error('invalid continental group results read scope');
      }
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
