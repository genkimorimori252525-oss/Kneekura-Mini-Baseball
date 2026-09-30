import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizePremierTwelveGroups, planPremierTwelveGroups,
  type PremierTwelveEdition, type PremierTwelveAuthority,
  type PremierTwelveGroupOutcome,
  type PremierTwelveGroupPlan } from
  '../../core/world/competition/PremierTwelve';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqliteWorldNationalRankingSnapshotStore } from
  './SqliteWorldNationalRankingSnapshotStore';
import type { SqliteNationalCompetitionSelectionStore } from
  './SqliteNationalCompetitionSelectionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type PremierTwelveGroupRequest = Readonly<{
  careerId: string;
  edition: PremierTwelveEdition;
}>;
export type PremierTwelveGroupEvidence = Readonly<{
  edition: PremierTwelveEdition;
  authority: PremierTwelveAuthority;
  plan: PremierTwelveGroupPlan;
  results: readonly OfficialGameResult[];
  outcome: PremierTwelveGroupOutcome;
}>;
export type SqlitePremierTwelveGroupStore = Readonly<{
  initialize(request: PremierTwelveGroupRequest): PremierTwelveGroupPlan;
  readPlan(careerId: string,
    editionId: string): PremierTwelveGroupPlan | null;
  finalize(careerId: string,
    editionId: string): PremierTwelveGroupOutcome | null;
  readOutcome(careerId: string,
    editionId: string): PremierTwelveGroupOutcome | null;
  readEvidence(careerId: string,
    editionId: string): PremierTwelveGroupEvidence | null;
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

/** Freeze two national pools and rank 30 official venue-bound games. */
export const openSqlitePremierTwelveGroupStore = (
  databasePath: string,
  sources: Readonly<{
    rankings: Pick<SqliteWorldNationalRankingSnapshotStore, 'authority'>;
    editionCutoff: PremierTwelveAuthority['editionCutoff'];
    selections?: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
    matches: PostseasonMatchSource;
  }>,
): SqlitePremierTwelveGroupStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Premier12 group database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_premier_twelve_groups (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_premier_twelve_groups WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const authority = (request: PremierTwelveGroupRequest):
    PremierTwelveAuthority => Object.freeze({
    editionCutoff: (editionId: string) => {
      const cutoff = sources.editionCutoff(editionId);
      if (sources.selections) {
        const selection = sources.selections.readSelection(request.careerId, editionId);
        if (!selection || canonicalJson(cutoff)
          !== canonicalJson(selection.qualificationCutoff)) {
          throw new Error('Premier12 cutoff differs from accepted World selection');
        }
      }
      return cutoff;
    },
    ...sources.rankings.authority(request.careerId),
  });
  const projectPlan = (request: PremierTwelveGroupRequest):
    PremierTwelveGroupPlan => {
    if (sources.selections) {
      const selection = sources.selections.readSelection(request.careerId,
        request.edition.editionId);
      if (!selection || selection.editionId !== request.edition.editionId
        || selection.kind !== 'PREMIER_12'
        || selection.qualificationCutoff.snapshotId
          !== request.edition.qualificationCutoffSnapshotId
        || canonicalJson(selection.calendarWindow)
          !== canonicalJson(request.edition.calendarWindow)) {
        throw new Error('Premier12 edition requires matching accepted World selection');
      }
    }
    return planPremierTwelveGroups(request.edition, authority(request));
  };
  const readFinals = (plan: PremierTwelveGroupPlan):
    readonly OfficialGameResult[] | null => {
    const results = plan.groups.flatMap((group) =>
      group.games.map((game) =>
        readDurableOfficialGameResult(sources.matches, game.gameId)));
    return results.some((result) => result === null) ? null
      : Object.freeze(results.filter((result) => result !== null));
  };
  const projectOutcome = (request: PremierTwelveGroupRequest,
    plan: PremierTwelveGroupPlan): PremierTwelveGroupOutcome | null => {
    const results = readFinals(plan);
    return results ? finalizePremierTwelveGroups(plan, results,
      request.edition, authority(request)) : null;
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{ request: PremierTwelveGroupRequest;
      plan: PremierTwelveGroupPlan;
      outcome: PremierTwelveGroupOutcome | null }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        PremierTwelveGroupRequest;
      const savedPlan = JSON.parse(stored.plan_json) as
        PremierTwelveGroupPlan;
      if (request.careerId !== careerId
        || request.edition.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('Premier12 group request serialization differs');
      }
      const plan = projectPlan(request);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Premier12 group plan replay differs');
      }
      let outcome: PremierTwelveGroupOutcome | null = null;
      if (stored.outcome_json !== null) {
        const saved = JSON.parse(stored.outcome_json) as
          PremierTwelveGroupOutcome;
        outcome = projectOutcome(request, plan);
        if (canonicalJson(saved) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Premier12 group outcome replay differs');
        }
      }
      return Object.freeze({ request, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt Premier12 groups for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Premier12 group scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: PremierTwelveGroupRequest):
      PremierTwelveGroupPlan {
      assertScope(rawRequest?.careerId, rawRequest?.edition?.editionId);
      const request = cloneInert(rawRequest);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId,
          request.edition.editionId);
        if (stored) {
          const prior = replay(request.careerId,
            request.edition.editionId, stored);
          if (canonicalJson(request) !== stored.request_json) {
            throw new Error('Premier12 group Edition is frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(request);
        db.prepare(`INSERT INTO world_premier_twelve_groups
          (career_id, edition_id, request_json, plan_json)
          VALUES (?, ?, ?, ?)`).run(request.careerId,
            request.edition.editionId, canonicalJson(request),
            canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string, editionId: string):
      PremierTwelveGroupPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    finalize(careerId: string, editionId: string):
      PremierTwelveGroupOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Premier12 group plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(prior.request, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_premier_twelve_groups
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
      PremierTwelveGroupOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    readEvidence(careerId: string, editionId: string):
      PremierTwelveGroupEvidence | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const { request, plan, outcome } = replay(careerId,
        editionId, stored);
      if (!outcome) return null;
      const results = readFinals(plan);
      if (!results) throw new Error('Premier12 group evidence lost Match finals');
      return Object.freeze({ edition: request.edition,
        authority: authority(request), plan, results, outcome });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
