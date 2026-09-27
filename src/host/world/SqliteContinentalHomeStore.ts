import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createContinentalGroupGamePlan,
  type ContinentalGroupGamePlan } from
  '../../core/world/competition/ContinentalGroupResults';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger,
  type ContinentalHomeAssignment,
  type HomeFairnessLedger,
  type HomeFairnessPolicy } from
  '../../core/world/competition/ContinentalHomeFairness';
import type { SqliteCompetitionDrawStore } from
  './SqliteCompetitionDrawStore';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';

export type ContinentalHomeRequest = Readonly<{
  careerId: string;
  editionId: string;
  editionOrdinal: number;
  policy: HomeFairnessPolicy;
}>;
export type DurableContinentalHome = Readonly<{
  assignment: ContinentalHomeAssignment;
  groupGamePlan: ContinentalGroupGamePlan;
}>;
export type SqliteContinentalHomeStore = Readonly<{
  initialize(input: ContinentalHomeRequest): DurableContinentalHome;
  readAssignment(careerId: string, editionId: string):
    DurableContinentalHome | null;
  readLedger(careerId: string, competitionId: string):
    HomeFairnessLedger;
  close(): void;
}>;
type HomeRow = { edition_id: string; edition_ordinal: number;
  request_json: string; snapshot_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Replay every prior edition so fairness credits cannot be rewritten. */
export const openSqliteContinentalHomeStore = (
  databasePath: string,
  sources: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    draws: Pick<SqliteCompetitionDrawStore, 'readDraw'>;
  }>,
): SqliteContinentalHomeStore => {
  if (!id(databasePath)) {
    throw new Error('invalid continental home database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_continental_home_assignments (
    career_id TEXT NOT NULL, competition_id TEXT NOT NULL,
    edition_id TEXT NOT NULL, edition_ordinal INTEGER NOT NULL,
    request_json TEXT NOT NULL, snapshot_json TEXT NOT NULL,
    PRIMARY KEY (career_id, edition_id),
    UNIQUE (career_id, competition_id, edition_ordinal)
  );`);
  const rows = db.prepare(`SELECT edition_id, edition_ordinal,
    request_json, snapshot_json
    FROM world_continental_home_assignments
    WHERE career_id=? AND competition_id=? ORDER BY edition_ordinal`);
  const get = db.prepare(`SELECT competition_id FROM
    world_continental_home_assignments
    WHERE career_id=? AND edition_id=?`);
  const project = (request: ContinentalHomeRequest,
    competitionId: string,
    ledger: HomeFairnessLedger): DurableContinentalHome => {
    const edition = sources.editions.readEdition(request.careerId,
      request.editionId);
    const durableDraw = sources.draws.readDraw(request.careerId,
      request.editionId);
    if (!edition || !durableDraw
      || edition.competitionId !== competitionId
      || edition.canonicalRole !== 'CONTINENTAL_CL'
      || edition.drawSnapshotId !== durableDraw.drawSnapshotId) {
      throw new Error('continental home assignment lacks frozen Edition draw');
    }
    const assignment = assignContinentalGroupHomeSeries({
      competitionId, editionId: request.editionId,
      editionOrdinal: request.editionOrdinal,
      expectedRevision: ledger.revision,
      draw: durableDraw.draw,
      ledger, policy: request.policy,
    });
    const groupGamePlan = createContinentalGroupGamePlan(assignment);
    return Object.freeze({ assignment, groupGamePlan });
  };
  const replay = (careerId: string, competitionId: string):
    Readonly<{ ledger: HomeFairnessLedger;
      assignments: readonly Readonly<{
        request: ContinentalHomeRequest;
        value: DurableContinentalHome;
      }>[] }> => {
    let ledger = createHomeFairnessLedger(competitionId);
    const assignments = (rows.all(careerId, competitionId) as HomeRow[])
      .map((row, index) => {
        try {
          const request = JSON.parse(row.request_json) as
            ContinentalHomeRequest;
          const snapshot = JSON.parse(row.snapshot_json) as
            DurableContinentalHome;
          if (request.careerId !== careerId
            || request.editionId !== row.edition_id
            || request.editionOrdinal !== index
            || row.edition_ordinal !== index
            || canonicalJson(request) !== row.request_json
            || canonicalJson(snapshot) !== row.snapshot_json) {
            throw new Error('home assignment scope or serialization differs');
          }
          const value = project(request, competitionId, ledger);
          if (canonicalJson(value) !== row.snapshot_json) {
            throw new Error('home assignment replay differs');
          }
          ledger = value.assignment.ledger;
          return Object.freeze({ request, value });
        } catch (cause) {
          throw new Error(`corrupt continental home history for ${careerId}`,
            { cause });
        }
      });
    return Object.freeze({ ledger, assignments });
  };
  let closed = false;
  return Object.freeze({
    initialize(rawRequest: ContinentalHomeRequest):
      DurableContinentalHome {
      if (closed) throw new Error('continental home store is closed');
      const request = cloneInert(rawRequest);
      if (!id(request?.careerId) || !id(request.editionId)) {
        throw new Error('invalid continental home scope');
      }
      const edition = sources.editions.readEdition(request.careerId,
        request.editionId);
      if (!edition) throw new Error('continental Edition is missing');
      const history = replay(request.careerId,
        edition.competitionId);
      const existing = history.assignments.find((item) =>
        item.request.editionId === request.editionId);
      if (existing) {
        if (canonicalJson(existing.request) !== canonicalJson(request)) {
          throw new Error('continental home assignment is already frozen differently');
        }
        return existing.value;
      }
      if (request.editionOrdinal !== history.ledger.revision) {
        throw new Error('continental home edition ordinal is out of order');
      }
      const value = project(request, edition.competitionId,
        history.ledger);
      db.prepare(`INSERT INTO world_continental_home_assignments
        (career_id, competition_id, edition_id, edition_ordinal,
          request_json, snapshot_json) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(request.careerId, edition.competitionId,
          request.editionId, request.editionOrdinal,
          canonicalJson(request), canonicalJson(value));
      return value;
    },
    readAssignment(careerId: string,
      editionId: string): DurableContinentalHome | null {
      if (closed || !id(careerId) || !id(editionId)) {
        throw new Error('invalid continental home read scope');
      }
      const found = get.get(careerId, editionId) as
        { competition_id: string } | undefined;
      if (!found) return null;
      return replay(careerId, found.competition_id)
        .assignments.find((item) =>
          item.request.editionId === editionId)?.value ?? null;
    },
    readLedger(careerId: string,
      competitionId: string): HomeFairnessLedger {
      if (closed || !id(careerId) || !id(competitionId)) {
        throw new Error('invalid continental home ledger scope');
      }
      return replay(careerId, competitionId).ledger;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
