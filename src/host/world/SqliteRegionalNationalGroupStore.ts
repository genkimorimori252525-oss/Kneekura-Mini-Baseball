import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { finalizeRegionalNationalGroups,
  planRegionalNationalGroups,
  type RegionalNationalEdition,
  type RegionalNationalGroupOutcome,
  type RegionalNationalGroupPlan } from
  '../../core/world/competition/RegionalNationalGroups';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type SqliteRegionalNationalGroupStore = Readonly<{
  initialize(careerId: string, edition: RegionalNationalEdition):
    RegionalNationalGroupPlan;
  readEdition(careerId: string, editionId: string):
    RegionalNationalEdition | null;
  readPlan(careerId: string, editionId: string):
    RegionalNationalGroupPlan | null;
  finalize(careerId: string, editionId: string):
    RegionalNationalGroupOutcome | null;
  readOutcome(careerId: string, editionId: string):
    RegionalNationalGroupOutcome | null;
  readResults(careerId: string, editionId: string):
    readonly OfficialGameResult[] | null;
  close(): void;
}>;
type GroupRow = { edition_json: string; plan_json: string;
  outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** The Edition draw and historical region are frozen before Match play. */
export const openSqliteRegionalNationalGroupStore = (
  databasePath: string,
  sources: Readonly<{
    regions: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteRegionalNationalGroupStore => {
  if (!id(databasePath)) {
    throw new Error('invalid regional national database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_groups (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    edition_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT edition_json, plan_json, outcome_json
    FROM world_regional_national_groups
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): GroupRow | null =>
    (get.get(careerId, editionId) as GroupRow | undefined) ?? null;
  const projectPlan = (careerId: string,
    edition: RegionalNationalEdition): RegionalNationalGroupPlan =>
    planRegionalNationalGroups(edition,
      sources.regions.authority(careerId));
  const readFinals = (plan: RegionalNationalGroupPlan):
    readonly OfficialGameResult[] | null => {
    const games = plan.groups.flatMap((group) => group.games);
    const results = games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (results.some((result) => result === null)) return null;
    return Object.freeze(results.filter((result) => result !== null));
  };
  const projectOutcome = (careerId: string,
    edition: RegionalNationalEdition,
    plan: RegionalNationalGroupPlan):
    RegionalNationalGroupOutcome | null => {
    const results = readFinals(plan);
    return results ? finalizeRegionalNationalGroups(plan, results,
      edition, sources.regions.authority(careerId)) : null;
  };
  const replay = (careerId: string, editionId: string,
    stored: GroupRow): Readonly<{
      edition: RegionalNationalEdition;
      plan: RegionalNationalGroupPlan;
      outcome: RegionalNationalGroupOutcome | null;
    }> => {
    try {
      const edition = JSON.parse(stored.edition_json) as
        RegionalNationalEdition;
      const savedPlan = JSON.parse(stored.plan_json) as
        RegionalNationalGroupPlan;
      if (edition.editionId !== editionId
        || canonicalJson(edition) !== stored.edition_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('regional national Edition serialization differs');
      }
      const plan = projectPlan(careerId, edition);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('regional national draw replay differs');
      }
      let outcome: RegionalNationalGroupOutcome | null = null;
      if (stored.outcome_json !== null) {
        const savedOutcome = JSON.parse(stored.outcome_json) as
          RegionalNationalGroupOutcome;
        outcome = projectOutcome(careerId, edition, plan);
        if (canonicalJson(savedOutcome) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('regional national group outcome replay differs');
        }
      }
      return Object.freeze({ edition, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt regional national groups for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid regional national group scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string, rawEdition: RegionalNationalEdition):
      RegionalNationalGroupPlan {
      assertScope(careerId, rawEdition?.editionId);
      const edition = cloneInert(rawEdition);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, edition.editionId);
        if (stored) {
          const prior = replay(careerId, edition.editionId, stored);
          if (canonicalJson(edition) !== stored.edition_json) {
            throw new Error('regional national Edition is already frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(careerId, edition);
        db.prepare(`INSERT INTO world_regional_national_groups
          (career_id, edition_id, edition_json, plan_json)
          VALUES (?, ?, ?, ?)`).run(careerId, edition.editionId,
            canonicalJson(edition), canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readEdition(careerId: string, editionId: string):
      RegionalNationalEdition | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).edition : null;
    },
    readPlan(careerId: string, editionId: string):
      RegionalNationalGroupPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    finalize(careerId: string, editionId: string):
      RegionalNationalGroupOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('regional national group plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(careerId, prior.edition,
          prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_regional_national_groups
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
      RegionalNationalGroupOutcome | null {
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
