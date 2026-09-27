import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeContinentalGroupResults } from
  '../../core/world/competition/ContinentalGroupResults';
import { finalizeContinentalQuarterfinals,
  planContinentalQuarterfinals,
  type ContinentalQuarterfinalOutcome,
  type ContinentalQuarterfinalPlan,
  type ContinentalQuarterfinalSource } from
  '../../core/world/competition/ContinentalQuarterfinals';
import type { SqliteContinentalGroupResultsStore } from
  './SqliteContinentalGroupResultsStore';
import type { SqliteContinentalHomeStore } from
  './SqliteContinentalHomeStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type ContinentalQuarterfinalRequest = Readonly<{
  careerId: string;
  editionId: string;
  policyVersion: string;
  drawSeed: string;
}>;
export type SqliteContinentalQuarterfinalStore = Readonly<{
  initialize(input: ContinentalQuarterfinalRequest):
    ContinentalQuarterfinalPlan;
  readPlan(careerId: string, editionId: string):
    ContinentalQuarterfinalPlan | null;
  finalize(careerId: string, editionId: string):
    ContinentalQuarterfinalOutcome | null;
  readOutcome(careerId: string, editionId: string):
    ContinentalQuarterfinalOutcome | null;
  close(): void;
}>;
type QuarterfinalRow = { request_json: string; plan_json: string;
  outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Draws only from frozen group qualification; Match owns all game finals. */
export const openSqliteContinentalQuarterfinalStore = (
  databasePath: string,
  sources: Readonly<{
    homes: Pick<SqliteContinentalHomeStore, 'readAssignment'>;
    groups: Pick<SqliteContinentalGroupResultsStore, 'readResults'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteContinentalQuarterfinalStore => {
  if (!id(databasePath)) {
    throw new Error('invalid continental quarterfinal database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_continental_quarterfinals (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_continental_quarterfinals WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): QuarterfinalRow | null =>
    (get.get(careerId, editionId) as QuarterfinalRow | undefined) ?? null;
  const readSource = (careerId: string, editionId: string):
    ContinentalQuarterfinalSource => {
    const home = sources.homes.readAssignment(careerId, editionId);
    const frozen = sources.groups.readResults(careerId, editionId);
    if (!home || !frozen) {
      throw new Error('quarterfinals require frozen group results');
    }
    const results = home.groupGamePlan.groups.flatMap((group) =>
      group.games.map((game) =>
        readDurableOfficialGameResult(sources.matches, game.gameId)));
    if (results.length !== 72 || results.some((result) => result === null)) {
      throw new Error('quarterfinals require all 72 durable group finals');
    }
    const groupOfficialResults = results.filter((result) =>
      result !== null);
    const replayed = finalizeContinentalGroupResults(home.groupGamePlan,
      groupOfficialResults, frozen.tiebreakPolicy);
    if (canonicalJson(replayed) !== canonicalJson(frozen)) {
      throw new Error('quarterfinal group source differs from frozen results');
    }
    return Object.freeze({ groupPlan: home.groupGamePlan,
      groupOfficialResults,
      groupTiebreakPolicy: frozen.tiebreakPolicy });
  };
  const projectPlan = (request: ContinentalQuarterfinalRequest):
    ContinentalQuarterfinalPlan => planContinentalQuarterfinals({
      ...readSource(request.careerId, request.editionId),
      policyVersion: request.policyVersion, drawSeed: request.drawSeed,
    });
  const projectOutcome = (request: ContinentalQuarterfinalRequest,
    plan: ContinentalQuarterfinalPlan):
    ContinentalQuarterfinalOutcome | null => {
    const results = plan.games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (results.some((result) => result === null)) return null;
    return finalizeContinentalQuarterfinals(plan,
      results.filter((result) => result !== null),
      readSource(request.careerId, request.editionId));
  };
  const replay = (careerId: string, editionId: string,
    stored: QuarterfinalRow): Readonly<{
      request: ContinentalQuarterfinalRequest;
      plan: ContinentalQuarterfinalPlan;
      outcome: ContinentalQuarterfinalOutcome | null;
    }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        ContinentalQuarterfinalRequest;
      const savedPlan = JSON.parse(stored.plan_json) as
        ContinentalQuarterfinalPlan;
      if (request.careerId !== careerId
        || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('quarterfinal scope or serialization differs');
      }
      const plan = projectPlan(request);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('quarterfinal plan replay differs');
      }
      let outcome: ContinentalQuarterfinalOutcome | null = null;
      if (stored.outcome_json !== null) {
        const savedOutcome = JSON.parse(stored.outcome_json) as
          ContinentalQuarterfinalOutcome;
        outcome = projectOutcome(request, plan);
        if (canonicalJson(savedOutcome) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('quarterfinal outcome replay differs');
        }
      }
      return Object.freeze({ request, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt continental quarterfinals for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid continental quarterfinal scope');
    }
  };
  return Object.freeze({
    initialize(rawInput: ContinentalQuarterfinalRequest):
      ContinentalQuarterfinalPlan {
      if (closed) throw new Error('continental quarterfinal store is closed');
      const input = cloneInert(rawInput);
      assertScope(input?.careerId, input?.editionId);
      if (!id(input.policyVersion) || !id(input.drawSeed)) {
        throw new Error('invalid continental quarterfinal policy or seed');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(input.careerId, input.editionId);
        if (stored) {
          const prior = replay(input.careerId, input.editionId, stored);
          if (canonicalJson(input) !== stored.request_json) {
            throw new Error('continental quarterfinal plan is already frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(input);
        db.prepare(`INSERT INTO world_continental_quarterfinals
          (career_id, edition_id, request_json, plan_json)
          VALUES (?, ?, ?, ?)`).run(input.careerId, input.editionId,
            canonicalJson(input), canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string, editionId: string):
      ContinentalQuarterfinalPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    finalize(careerId: string, editionId: string):
      ContinentalQuarterfinalOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('continental quarterfinal plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(prior.request, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_continental_quarterfinals
            SET outcome_json=? WHERE career_id=? AND edition_id=?`)
            .run(canonicalJson(outcome), careerId, editionId);
        }
        db.exec('COMMIT');
        return outcome;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readOutcome(careerId: string, editionId: string):
      ContinentalQuarterfinalOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
