import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { drawCompetitionGroups,
  type CompetitionDraw,
  type DrawParticipant } from
  '../../core/world/competition/CompetitionDraw';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';

export type CompetitionDrawSourceRequest = Readonly<{
  careerId: string;
  editionId: string;
  drawSeed: string;
  participants: readonly DrawParticipant[];
  rematchPairs: readonly (readonly [string, string])[];
}>;
export type DurableCompetitionDraw = Readonly<{
  drawSnapshotId: string;
  draw: CompetitionDraw;
}>;
export type SqliteCompetitionDrawStore = Readonly<{
  initialize(input: CompetitionDrawSourceRequest):
    DurableCompetitionDraw;
  readDraw(careerId: string, editionId: string):
    DurableCompetitionDraw | null;
  close(): void;
}>;
type DrawRow = { request_json: string; snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);
const sameSet = (left: readonly string[],
  right: readonly string[]): boolean =>
  left.length === right.length
  && new Set(left).size === left.length
  && new Set(right).size === right.length
  && left.every((id) => right.includes(id));

/** Draw only the actual Edition entrants under its frozen policy. */
export const openSqliteCompetitionDrawStore = (
  databasePath: string,
  editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>,
): SqliteCompetitionDrawStore => {
  if (!id(databasePath)) throw new Error('invalid draw database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_competition_draws (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, snapshot_json
    FROM world_competition_draws WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): DrawRow | null =>
    (get.get(careerId, editionId) as DrawRow | undefined) ?? null;
  const project = (input: CompetitionDrawSourceRequest):
    DurableCompetitionDraw => {
    const edition = editions.readEdition(input.careerId,
      input.editionId);
    if (!edition || !id(input.drawSeed)
      || !sameSet(edition.participantIds,
        input.participants.map((item) => item.teamId))) {
      throw new Error('draw entrants differ from accepted Edition');
    }
    const groupCount = edition.canonicalRole === 'CONTINENTAL_CL'
      ? 4 : edition.canonicalRole === 'AFBCL' ? 2 : null;
    if (groupCount === null
      || edition.participantIds.length !== groupCount * 4) {
      throw new Error('Edition has no supported continental group draw');
    }
    const draw = drawCompetitionGroups({
      editionId: input.editionId,
      profile: { drawPolicyVersion: edition.drawPolicyVersion,
        drawPolicy: edition.drawPolicy },
      drawSeed: input.drawSeed, groupCount,
      participants: input.participants,
      rematchPairs: input.rematchPairs,
    }, { policies: [edition.drawPolicy] });
    return Object.freeze({ drawSnapshotId: edition.drawSnapshotId,
      draw });
  };
  const parse = (careerId: string, editionId: string,
    stored: DrawRow): DurableCompetitionDraw => {
    try {
      const input = JSON.parse(stored.request_json) as
        CompetitionDrawSourceRequest;
      const snapshot = JSON.parse(stored.snapshot_json) as
        DurableCompetitionDraw;
      if (input.careerId !== careerId
        || input.editionId !== editionId
        || canonicalJson(input) !== stored.request_json
        || canonicalJson(snapshot) !== stored.snapshot_json) {
        throw new Error('draw scope or serialization differs');
      }
      const replayed = project(input);
      if (canonicalJson(replayed) !== stored.snapshot_json) {
        throw new Error('competition draw replay differs');
      }
      return replayed;
    } catch (cause) {
      throw new Error(`corrupt competition draw for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  return Object.freeze({
    initialize(rawInput: CompetitionDrawSourceRequest):
      DurableCompetitionDraw {
      if (closed) throw new Error('competition draw store is closed');
      const input = cloneInert(rawInput);
      if (!id(input?.careerId) || !id(input.editionId)) {
        throw new Error('invalid competition draw scope');
      }
      const snapshot = project(input);
      const requestJson = canonicalJson(input);
      const snapshotJson = canonicalJson(snapshot);
      db.exec('BEGIN IMMEDIATE');
      try {
        const existing = row(input.careerId, input.editionId);
        if (existing) {
          const prior = parse(input.careerId, input.editionId,
            existing);
          if (existing.request_json !== requestJson) {
            throw new Error('competition draw is already frozen differently');
          }
          db.exec('COMMIT');
          return prior;
        }
        db.prepare(`INSERT INTO world_competition_draws
          (career_id, edition_id, request_json, snapshot_json)
          VALUES (?, ?, ?, ?)`).run(input.careerId, input.editionId,
          requestJson, snapshotJson);
        db.exec('COMMIT');
        return snapshot;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readDraw(careerId: string,
      editionId: string): DurableCompetitionDraw | null {
      if (closed || !id(careerId) || !id(editionId)) {
        throw new Error('invalid competition draw read scope');
      }
      const stored = row(careerId, editionId);
      return stored ? parse(careerId, editionId, stored) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
