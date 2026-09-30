import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { WbcBerthAllocation } from
  '../../core/world/competition/WbcBerths';
import { finalizeWbcFinalsGroups, planWbcFinalsGroups,
  type WbcFinalsGroupEdition, type WbcFinalsGroupOutcome,
  type WbcFinalsGroupPlan } from
  '../../core/world/competition/WbcFinalsGroups';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';
import type { SqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteNationalCompetitionDrawStore } from './SqliteNationalCompetitionDrawStore';
import type { SqliteNationalCompetitionEditionStore } from './SqliteNationalCompetitionEditionStore';

export type WbcFinalsGroupRequest = Readonly<{
  careerId: string;
  edition: WbcFinalsGroupEdition;
}>;
export type WbcFinalsGroupEvidence = Readonly<{
  edition: WbcFinalsGroupEdition;
  berths: WbcBerthAllocation;
  plan: WbcFinalsGroupPlan;
  results: readonly OfficialGameResult[];
  outcome: WbcFinalsGroupOutcome;
}>;
export type SqliteWbcFinalsGroupStore = Readonly<{
  initialize(request: WbcFinalsGroupRequest): WbcFinalsGroupPlan;
  readEdition(careerId: string, editionId: string): WbcFinalsGroupEdition | null;
  readPlan(careerId: string,
    editionId: string): WbcFinalsGroupPlan | null;
  finalize(careerId: string,
    editionId: string): WbcFinalsGroupOutcome | null;
  readOutcome(careerId: string,
    editionId: string): WbcFinalsGroupOutcome | null;
  readEvidence(careerId: string,
    editionId: string): WbcFinalsGroupEvidence | null;
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

/** Freeze six national pools and rank 36 official venue-bound games. */
export const openSqliteWbcFinalsGroupStore = (
  databasePath: string,
  sources: Readonly<{
    berths: Readonly<{ readAllocation(careerId: string,
      editionId: string): WbcBerthAllocation | null }>;
    matches: PostseasonMatchSource;
    selections?: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
    draws?: Pick<SqliteNationalCompetitionDrawStore, 'readDraw'>;
    editions?: Pick<SqliteNationalCompetitionEditionStore, 'readWbcEdition'>;
  }>,
): SqliteWbcFinalsGroupStore => {
  if (!id(databasePath)) {
    throw new Error('invalid WBC finals group database path');
  }
  const readAllocation = createCompetitionSourceReader(sources.berths.readAllocation, sources.berths);
  const readSelection = sources.selections ? createCompetitionSourceReader(sources.selections.readSelection, sources.selections) : undefined;
  const readDraw = sources.draws ? createCompetitionSourceReader(sources.draws.readDraw, sources.draws) : undefined;
  const readWbcEdition = sources.editions ? createCompetitionSourceReader(sources.editions.readWbcEdition, sources.editions) : undefined;
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_finals_groups (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_wbc_finals_groups WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const berths = (request: WbcFinalsGroupRequest):
    WbcBerthAllocation => {
    const allocation = readAllocation(request.careerId,
      request.edition.editionId);
    if (!allocation) throw new Error('WBC finals require official berths');
    if (sources.selections) {
      const selection = readSelection!(request.careerId, request.edition.editionId);
      if (!selection || selection.kind !== 'WBC' || selection.editionId !== request.edition.editionId
        || selection.qualificationCutoff.snapshotId !== allocation.cutoffSnapshotId
        || canonicalJson(selection.calendarWindow) !== canonicalJson(request.edition.calendarWindow)) {
        throw new Error('WBC finals differ from accepted World selection');
      }
    }
    return allocation;
  };
  const projectPlan = (request: WbcFinalsGroupRequest):
    WbcFinalsGroupPlan => {
    if (sources.draws) {
      const draw = readDraw!(request.careerId, request.edition.editionId);
      if (!draw || draw.draw.editionId !== request.edition.editionId
        || draw.drawSnapshotId !== request.edition.drawSnapshotId
        || draw.draw.drawPolicyVersion !== request.edition.drawPolicyVersion
        || canonicalJson(draw.draw.groups.map((group) => group.map((participant) => participant.teamId)))
          !== canonicalJson(request.edition.groups.map((group) => group.nationIds))) {
        throw new Error('WBC finals differ from accepted draw');
      }
    }
    if (sources.editions) {
      const edition = readWbcEdition!(request.careerId, request.edition.editionId);
      if (!edition || canonicalJson(edition) !== canonicalJson(request.edition)) {
        throw new Error('WBC finals differ from accepted national edition');
      }
    }
    return planWbcFinalsGroups(request.edition, berths(request));
  };
  const readFinals = (plan: WbcFinalsGroupPlan):
    readonly OfficialGameResult[] | null => {
    const results = plan.groups.flatMap((group) =>
      group.games.map((game) =>
        readDurableOfficialGameResult(sources.matches, game.gameId)));
    return results.some((result) => result === null) ? null
      : Object.freeze(results.filter((result) => result !== null));
  };
  const projectOutcome = (request: WbcFinalsGroupRequest,
    plan: WbcFinalsGroupPlan): WbcFinalsGroupOutcome | null => {
    const results = readFinals(plan);
    return results ? finalizeWbcFinalsGroups(plan, results,
      request.edition, berths(request)) : null;
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{ request: WbcFinalsGroupRequest;
      plan: WbcFinalsGroupPlan;
      outcome: WbcFinalsGroupOutcome | null }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcFinalsGroupRequest;
      const savedPlan = JSON.parse(stored.plan_json) as
        WbcFinalsGroupPlan;
      if (request.careerId !== careerId
        || request.edition.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('WBC group request serialization differs');
      }
      const plan = projectPlan(request);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('WBC group plan replay differs');
      }
      let outcome: WbcFinalsGroupOutcome | null = null;
      if (stored.outcome_json !== null) {
        const saved = JSON.parse(stored.outcome_json) as
          WbcFinalsGroupOutcome;
        outcome = projectOutcome(request, plan);
        if (canonicalJson(saved) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('WBC group outcome replay differs');
        }
      }
      return Object.freeze({ request, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt WBC finals groups for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid WBC finals group scope');
    }
  };
  return Object.freeze({
    initialize(rawRequest: WbcFinalsGroupRequest):
      WbcFinalsGroupPlan {
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
            throw new Error('WBC group Edition is frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(request);
        db.prepare(`INSERT INTO world_wbc_finals_groups
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
    readEdition(careerId: string, editionId: string): WbcFinalsGroupEdition | null {
      return withCompetitionSourceReadScope(() => {
        assertScope(careerId, editionId);
        const stored = row(careerId, editionId);
        return stored ? replay(careerId, editionId, stored).request.edition : null;
      });
    },
    readPlan(careerId: string, editionId: string):
      WbcFinalsGroupPlan | null {
      return withCompetitionSourceReadScope(() => {
        assertScope(careerId, editionId);
        const stored = row(careerId, editionId);
        return stored ? replay(careerId, editionId, stored).plan : null;
      });
    },
    finalize(careerId: string, editionId: string):
      WbcFinalsGroupOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('WBC finals group plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(prior.request, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_wbc_finals_groups
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
      WbcFinalsGroupOutcome | null {
      return withCompetitionSourceReadScope(() => {
        assertScope(careerId, editionId);
        const stored = row(careerId, editionId);
        return stored ? replay(careerId, editionId, stored).outcome : null;
      });
    },
    readEvidence(careerId: string, editionId: string):
      WbcFinalsGroupEvidence | null {
      return withCompetitionSourceReadScope(() => {
        assertScope(careerId, editionId);
        const stored = row(careerId, editionId);
        if (!stored) return null;
        const { request, plan, outcome } = replay(careerId,
          editionId, stored);
        if (!outcome) return null;
        const results = readFinals(plan);
        if (!results) throw new Error('WBC group evidence lost Match finals');
        return Object.freeze({ edition: request.edition,
          berths: berths(request), plan, results, outcome });
      });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
