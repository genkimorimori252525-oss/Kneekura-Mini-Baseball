import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { finalizeSelectedWbcGlobalQualifier,
  planSelectedWbcGlobalQualifier,
  planWbcGlobalQualifierFinals,
  type WbcGlobalQualifierEdition,
  type WbcGlobalQualifierOutcome,
  type WbcGlobalQualifierPlan,
  type WbcQualifierGame } from
  '../../core/world/competition/WbcGlobalQualifierPods';
import type { SqliteWbcQualifierSelectionStore } from
  './SqliteWbcQualifierSelectionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type WbcGlobalQualifierPodRequest = Readonly<{
  careerId: string;
  edition: WbcGlobalQualifierEdition;
}>;
export type WbcGlobalQualifierPodEvidence = Readonly<{
  edition: WbcGlobalQualifierEdition;
  plan: WbcGlobalQualifierPlan;
  semifinalResults: readonly OfficialGameResult[];
  finalResults: readonly OfficialGameResult[];
  outcome: WbcGlobalQualifierOutcome;
}>;
export type SqliteWbcGlobalQualifierPodStore = Readonly<{
  initialize(request: WbcGlobalQualifierPodRequest):
    WbcGlobalQualifierPlan;
  readPlan(careerId: string,
    editionId: string): WbcGlobalQualifierPlan | null;
  finalGames(careerId: string,
    editionId: string): readonly WbcQualifierGame[] | null;
  finalize(careerId: string,
    editionId: string): WbcGlobalQualifierOutcome | null;
  readOutcome(careerId: string,
    editionId: string): WbcGlobalQualifierOutcome | null;
  readEvidence(careerId: string,
    editionId: string): WbcGlobalQualifierPodEvidence | null;
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

/** Advance the four pods only through twelve durable Match finals. */
export const openSqliteWbcGlobalQualifierPodStore = (
  databasePath: string,
  sources: Readonly<{
    selection: Pick<SqliteWbcQualifierSelectionStore,
      'readSelection'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteWbcGlobalQualifierPodStore => {
  if (!id(databasePath)) {
    throw new Error('invalid WBC Global Qualifier database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_pods (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_wbc_qualifier_pods
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const projectPlan = (request: WbcGlobalQualifierPodRequest):
    WbcGlobalQualifierPlan => {
    const selection = sources.selection.readSelection(
      request.careerId, request.edition.editionId);
    if (!selection) {
      throw new Error('WBC qualifier needs selected entrants');
    }
    return planSelectedWbcGlobalQualifier(request.edition,
      selection);
  };
  const results = (games: readonly WbcQualifierGame[]):
    readonly OfficialGameResult[] | null => {
    const finals = games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    return finals.some((result) => result === null) ? null
      : Object.freeze(finals.filter((result) => result !== null));
  };
  const stages = (request: WbcGlobalQualifierPodRequest,
    plan: WbcGlobalQualifierPlan): Readonly<{
      semifinalResults: readonly OfficialGameResult[] | null;
      finalGames: readonly WbcQualifierGame[] | null;
      finalResults: readonly OfficialGameResult[] | null;
      outcome: WbcGlobalQualifierOutcome | null;
    }> => {
    const semifinalResults = results(plan.pods.flatMap((pod) =>
      pod.semifinals));
    if (!semifinalResults) {
      return { semifinalResults: null, finalGames: null,
        finalResults: null, outcome: null };
    }
    const finalGames = planWbcGlobalQualifierFinals(plan,
      semifinalResults, request.edition);
    const finalResults = results(finalGames);
    if (!finalResults) return { semifinalResults, finalGames,
      finalResults: null, outcome: null };
    const selection = sources.selection.readSelection(
      request.careerId, request.edition.editionId);
    if (!selection) {
      throw new Error('WBC qualifier selection disappeared');
    }
    return { semifinalResults, finalGames, finalResults,
      outcome: finalizeSelectedWbcGlobalQualifier(plan,
        semifinalResults, finalResults, request.edition,
        selection) };
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{
      request: WbcGlobalQualifierPodRequest;
      plan: WbcGlobalQualifierPlan;
      outcome: WbcGlobalQualifierOutcome | null;
    }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcGlobalQualifierPodRequest;
      const plan = projectPlan(request);
      if (request.careerId !== careerId
        || request.edition.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('WBC qualifier plan replay differs');
      }
      if (stored.outcome_json !== null) {
        const stage = stages(request, plan);
        if (!stage.outcome
          || canonicalJson(stage.outcome)
            !== stored.outcome_json) {
          throw new Error('WBC qualifier outcome replay differs');
        }
        return { request, plan, outcome: stage.outcome };
      }
      return { request, plan, outcome: null };
    } catch (cause) {
      throw new Error(`corrupt WBC qualifier pods for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string,
    editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid WBC qualifier pod scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: WbcGlobalQualifierPodRequest):
      WbcGlobalQualifierPlan {
      assertScope(rawRequest?.careerId,
        rawRequest?.edition?.editionId);
      const request = cloneInert(rawRequest);
      const plan = projectPlan(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId,
          request.edition.editionId);
        if (stored) {
          const prior = replay(request.careerId,
            request.edition.editionId, stored);
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('WBC qualifier edition is frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        db.prepare(`INSERT INTO world_wbc_qualifier_pods
          (career_id, edition_id, request_json, plan_json, outcome_json)
          VALUES (?, ?, ?, ?, NULL)`).run(request.careerId,
            request.edition.editionId, canonicalJson(request),
            canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string,
      editionId: string): WbcGlobalQualifierPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan
        : null;
    },
    finalGames(careerId: string,
      editionId: string): readonly WbcQualifierGame[] | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const current = replay(careerId, editionId, stored);
      return stages(current.request, current.plan).finalGames;
    },
    finalize(careerId: string,
      editionId: string): WbcGlobalQualifierOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) {
          db.exec('COMMIT');
          return null;
        }
        const current = replay(careerId, editionId, stored);
        if (current.outcome) {
          db.exec('COMMIT');
          return current.outcome;
        }
        const stage = stages(current.request, current.plan);
        if (stage.outcome) {
          db.prepare(`UPDATE world_wbc_qualifier_pods
            SET outcome_json=? WHERE career_id=? AND edition_id=?`)
            .run(canonicalJson(stage.outcome), careerId, editionId);
        }
        db.exec('COMMIT');
        return stage.outcome;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readOutcome(careerId: string,
      editionId: string): WbcGlobalQualifierOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome
        : null;
    },
    readEvidence(careerId: string,
      editionId: string): WbcGlobalQualifierPodEvidence | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const current = replay(careerId, editionId, stored);
      if (!current.outcome) return null;
      const stage = stages(current.request, current.plan);
      return Object.freeze({ edition: current.request.edition,
        plan: current.plan,
        semifinalResults: stage.semifinalResults!,
        finalResults: stage.finalResults!,
        outcome: current.outcome });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
