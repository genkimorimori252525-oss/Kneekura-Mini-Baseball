import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { ClubWorldBerthAllocation } from
  '../../core/world/competition/ClubWorldBerths';
import { createClubWorldGroupHubPlan, finalizeClubWorldGroupHubs,
  type ClubWorldGroupHubPlan, type ClubWorldGroupHubResults,
  type ClubWorldGroupHubSource } from
  '../../core/world/competition/ClubWorldGroupHubs';
import type { CompetitionDrawPolicyRegistry,
  DrawParticipant } from '../../core/world/competition/CompetitionDraw';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { StandingsTiebreakPolicy } from
  '../../core/world/competition/OfficialStandings';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type ClubWorldGroupHubRequest = Readonly<{
  careerId: string;
  editionId: string;
  drawSeed: string;
  drawParticipants: readonly DrawParticipant[];
  drawRegistry: CompetitionDrawPolicyRegistry;
  rematchPairs: readonly (readonly [string, string])[];
  tiebreakPolicy: StandingsTiebreakPolicy;
}>;
export type SqliteClubWorldGroupHubStore = Readonly<{
  initialize(request: ClubWorldGroupHubRequest): ClubWorldGroupHubPlan;
  readPlan(careerId: string, editionId: string):
    ClubWorldGroupHubPlan | null;
  readSource(careerId: string, editionId: string):
    ClubWorldGroupHubSource | null;
  readTiebreakPolicy(careerId: string, editionId: string):
    StandingsTiebreakPolicy | null;
  finalize(careerId: string, editionId: string):
    ClubWorldGroupHubResults | null;
  readOutcome(careerId: string, editionId: string):
    ClubWorldGroupHubResults | null;
  readResults(careerId: string, editionId: string):
    readonly OfficialGameResult[] | null;
  close(): void;
}>;
type Row = { request_json: string; plan_json: string;
  outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Edition and qualification fix four hubs; Match supplies every final. */
export const openSqliteClubWorldGroupHubStore = (
  databasePath: string,
  sources: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    berths: Readonly<{ readAllocation(careerId: string,
      editionId: string): ClubWorldBerthAllocation | null }>;
    matches: PostseasonMatchSource;
  }>,
): SqliteClubWorldGroupHubStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Club World group database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_world_group_hubs (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_club_world_group_hubs WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const source = (request: ClubWorldGroupHubRequest):
    ClubWorldGroupHubSource => {
    const edition = sources.editions.readEdition(request.careerId,
      request.editionId);
    const berths = sources.berths.readAllocation(request.careerId,
      request.editionId);
    if (!edition || !berths) {
      throw new Error('Club World group requires Edition and qualification');
    }
    return Object.freeze({ edition, berths, drawSeed: request.drawSeed,
      drawParticipants: request.drawParticipants,
      drawRegistry: request.drawRegistry,
      rematchPairs: request.rematchPairs,
      hubPolicyVersion: edition.hostingPolicyVersion });
  };
  const projectPlan = (request: ClubWorldGroupHubRequest):
    ClubWorldGroupHubPlan =>
    createClubWorldGroupHubPlan(source(request));
  const readFinals = (plan: ClubWorldGroupHubPlan):
    readonly OfficialGameResult[] | null => {
    const results = plan.groups.flatMap((group) =>
      group.games.map((game) =>
        readDurableOfficialGameResult(sources.matches, game.gameId)));
    return results.some((result) => result === null) ? null
      : Object.freeze(results.filter((result) => result !== null));
  };
  const projectOutcome = (request: ClubWorldGroupHubRequest,
    plan: ClubWorldGroupHubPlan): ClubWorldGroupHubResults | null => {
    const results = readFinals(plan);
    return results ? finalizeClubWorldGroupHubs(plan, results,
      request.tiebreakPolicy, source(request)) : null;
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{ request: ClubWorldGroupHubRequest;
      plan: ClubWorldGroupHubPlan;
      outcome: ClubWorldGroupHubResults | null }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        ClubWorldGroupHubRequest;
      const savedPlan = JSON.parse(stored.plan_json) as
        ClubWorldGroupHubPlan;
      if (request.careerId !== careerId || request.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('Club World group serialization differs');
      }
      const plan = projectPlan(request);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Club World group plan replay differs');
      }
      let outcome: ClubWorldGroupHubResults | null = null;
      if (stored.outcome_json !== null) {
        const saved = JSON.parse(stored.outcome_json) as
          ClubWorldGroupHubResults;
        outcome = projectOutcome(request, plan);
        if (canonicalJson(saved) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Club World group outcome replay differs');
        }
      }
      return Object.freeze({ request, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt Club World group hubs for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Club World group scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: ClubWorldGroupHubRequest):
      ClubWorldGroupHubPlan {
      assertScope(rawRequest?.careerId, rawRequest?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId, request.editionId);
        if (stored) {
          const prior = replay(request.careerId, request.editionId,
            stored);
          if (canonicalJson(request) !== stored.request_json) {
            throw new Error('Club World group rules are already frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(request);
        db.prepare(`INSERT INTO world_club_world_group_hubs
          (career_id, edition_id, request_json, plan_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.editionId, canonicalJson(request), canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string, editionId: string):
      ClubWorldGroupHubPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    readSource(careerId: string, editionId: string):
      ClubWorldGroupHubSource | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? source(replay(careerId, editionId,
        stored).request) : null;
    },
    readTiebreakPolicy(careerId: string, editionId: string):
      StandingsTiebreakPolicy | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId,
        stored).request.tiebreakPolicy : null;
    },
    finalize(careerId: string, editionId: string):
      ClubWorldGroupHubResults | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Club World group plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(prior.request, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_club_world_group_hubs
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
      ClubWorldGroupHubResults | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    readResults(careerId: string, editionId: string):
      readonly OfficialGameResult[] | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const { plan, outcome } = replay(careerId, editionId, stored);
      return outcome ? readFinals(plan) : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
