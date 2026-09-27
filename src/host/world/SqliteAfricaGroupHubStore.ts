import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createAfricaGroupHubPlan, finalizeAfricaGroupHubs,
  type AfricaGroupHubPlan, type AfricaGroupHubResults,
  type AfricaGroupHubSource } from
  '../../core/world/competition/AfricaGroupHubs';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { StandingsTiebreakPolicy } from
  '../../core/world/competition/OfficialStandings';
import type { SqliteCompetitionDrawStore } from
  './SqliteCompetitionDrawStore';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type AfricaGroupHubRequest = Readonly<{
  careerId: string;
  editionId: string;
  tiebreakPolicy: StandingsTiebreakPolicy;
}>;
export type SqliteAfricaGroupHubStore = Readonly<{
  initialize(input: AfricaGroupHubRequest): AfricaGroupHubPlan;
  readPlan(careerId: string, editionId: string):
    AfricaGroupHubPlan | null;
  readTiebreakPolicy(careerId: string, editionId: string):
    StandingsTiebreakPolicy | null;
  finalize(careerId: string, editionId: string):
    AfricaGroupHubResults | null;
  readOutcome(careerId: string, editionId: string):
    AfricaGroupHubResults | null;
  readResults(careerId: string, editionId: string):
    readonly OfficialGameResult[] | null;
  close(): void;
}>;
type HubRow = { request_json: string; plan_json: string;
  outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Africa's eight-club group stage uses its two Edition-selected hubs. */
export const openSqliteAfricaGroupHubStore = (
  databasePath: string,
  sources: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    draws: Pick<SqliteCompetitionDrawStore, 'readDraw'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteAfricaGroupHubStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Africa group database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_africa_group_hubs (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_africa_group_hubs WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): HubRow | null =>
    (get.get(careerId, editionId) as HubRow | undefined) ?? null;
  const readSource = (careerId: string, editionId: string):
    AfricaGroupHubSource => {
    const edition = sources.editions.readEdition(careerId, editionId);
    const durableDraw = sources.draws.readDraw(careerId, editionId);
    if (!edition || !durableDraw
      || edition.drawSnapshotId !== durableDraw.drawSnapshotId) {
      throw new Error('Africa group requires frozen Edition draw');
    }
    return Object.freeze({ edition, draw: durableDraw.draw,
      hubPolicyVersion: edition.hostingPolicyVersion });
  };
  const projectPlan = (request: AfricaGroupHubRequest):
    AfricaGroupHubPlan => createAfricaGroupHubPlan(
      readSource(request.careerId, request.editionId));
  const readFinals = (plan: AfricaGroupHubPlan):
    readonly OfficialGameResult[] | null => {
    const results = plan.groups.flatMap((group) =>
      group.games.map((game) =>
        readDurableOfficialGameResult(sources.matches, game.gameId)));
    return results.some((result) => result === null) ? null
      : Object.freeze(results.filter((result) => result !== null));
  };
  const projectOutcome = (request: AfricaGroupHubRequest,
    plan: AfricaGroupHubPlan): AfricaGroupHubResults | null => {
    const results = readFinals(plan);
    return results ? finalizeAfricaGroupHubs(plan, results,
      request.tiebreakPolicy,
      readSource(request.careerId, request.editionId)) : null;
  };
  const replay = (careerId: string, editionId: string,
    stored: HubRow): Readonly<{ request: AfricaGroupHubRequest;
      plan: AfricaGroupHubPlan;
      outcome: AfricaGroupHubResults | null }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        AfricaGroupHubRequest;
      const savedPlan = JSON.parse(stored.plan_json) as
        AfricaGroupHubPlan;
      if (request.careerId !== careerId
        || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('Africa group serialization differs');
      }
      const plan = projectPlan(request);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Africa group plan replay differs');
      }
      let outcome: AfricaGroupHubResults | null = null;
      if (stored.outcome_json !== null) {
        const savedOutcome = JSON.parse(stored.outcome_json) as
          AfricaGroupHubResults;
        outcome = projectOutcome(request, plan);
        if (canonicalJson(savedOutcome) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Africa group outcome replay differs');
        }
      }
      return Object.freeze({ request, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt Africa group hubs for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Africa group scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: AfricaGroupHubRequest): AfricaGroupHubPlan {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId,
            stored);
          if (canonicalJson(request) !== stored.request_json) {
            throw new Error('Africa group policy is already frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(request);
        db.prepare(`INSERT INTO world_africa_group_hubs
          (career_id, edition_id, request_json, plan_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.editionId, canonicalJson(request),
            canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string, editionId: string):
      AfricaGroupHubPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    readTiebreakPolicy(careerId: string, editionId: string):
      StandingsTiebreakPolicy | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored)
        .request.tiebreakPolicy : null;
    },
    finalize(careerId: string, editionId: string):
      AfricaGroupHubResults | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Africa group plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(prior.request, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_africa_group_hubs SET outcome_json=?
            WHERE career_id=? AND edition_id=?`)
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
      AfricaGroupHubResults | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    readResults(careerId: string, editionId: string):
      readonly OfficialGameResult[] | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const prior = replay(careerId, editionId, stored);
      return prior.outcome ? readFinals(prior.plan) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
