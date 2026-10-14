import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
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
import type { SqliteNationalCompetitionSelectionStore } from './SqliteNationalCompetitionSelectionStore';
import type { SqliteRegionalNationalDrawStore } from './SqliteRegionalNationalDrawStore';
import type { SqliteRegionalNationalEditionStore } from './SqliteRegionalNationalEditionStore';
import { createCompetitionSourceReader, withCompetitionSourceReadScope, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
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

type RegionalPlanSources = Readonly<{
  regions: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
  selections?: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
  draws?: Pick<SqliteRegionalNationalDrawStore, 'readDraw'>;
  editions?: Pick<SqliteRegionalNationalEditionStore, 'readEdition'>;
}>;
const projectRegionalNationalPlan = (sources: RegionalPlanSources, careerId: string,
    edition: RegionalNationalEdition): RegionalNationalGroupPlan => withCompetitionSourceReadScope(() => {
    if (sources.editions) {
      const accepted = createCompetitionSourceReader(sources.editions.readEdition, sources.editions)(careerId, edition.editionId);
      if (!accepted || canonicalJson(accepted) !== canonicalJson(edition)) throw new Error('regional groups differ from accepted regional Edition');
    }
    if (sources.draws) {
      const accepted = createCompetitionSourceReader(sources.draws.readDraw, sources.draws)(careerId, edition.editionId);
      if (!accepted || accepted.draw.editionId !== edition.editionId
        || accepted.source.selection.region !== edition.region
        || accepted.drawSnapshotId !== edition.drawSnapshotId
        || accepted.source.eligibility.snapshotId !== edition.qualificationSnapshotId
        || canonicalJson(accepted.source.selection.calendarWindow) !== canonicalJson(edition.calendarWindow)
        || canonicalJson(accepted.draw.groups.map((group) => group.map((row) => row.teamId)))
          !== canonicalJson(edition.groups.map((group) => group.nationIds))) {
        throw new Error('regional national Edition differs from accepted regional draw');
      }
    }
    if (sources.selections) {
      const selection = sources.selections.readSelection(careerId, edition.editionId);
      if (!selection || selection.kind !== 'REGIONAL_NATIONAL'
        || selection.region !== edition.region || selection.editionId !== edition.editionId
        || selection.calendarWindow.startsOnDay !== edition.calendarWindow.startsOnDay
        || selection.calendarWindow.endsOnDay !== edition.calendarWindow.endsOnDay) {
        throw new Error('regional national Edition differs from accepted World selection');
      }
    }
    return planRegionalNationalGroups(edition,
      sources.regions.authority(careerId));
  });

/** Original group inputs exclude future outcome replay and preserve the existing plan derivation. */
export const regionalNationalGroupInputEvidenceFromSqlite = (db: Pick<DatabaseSync, 'prepare'>, sources: RegionalPlanSources) => {
  const read = (careerId: string, editionId: string) => {
    if (!id(careerId) || !id(editionId)) throw new Error('invalid regional original plan scope');
    const row = db.prepare('SELECT edition_json,plan_json FROM world_regional_national_groups WHERE career_id=? AND edition_id=?').get(careerId, editionId);
    if (!row) return null;
    const edition = JSON.parse(String(row.edition_json)) as RegionalNationalEdition;
    const plan = projectRegionalNationalPlan(sources, careerId, edition);
    if (edition.editionId !== editionId || canonicalJson(edition) !== row.edition_json || canonicalJson(plan) !== row.plan_json) {
      throw new Error('regional original group plan differs');
    }
    return { edition, plan };
  };
  return Object.freeze({ readEdition: (careerId: string, editionId: string) => read(careerId, editionId)?.edition ?? null,
    readPlan: (careerId: string, editionId: string) => read(careerId, editionId)?.plan ?? null });
};

/** The Edition draw and historical region are frozen before Match play. */
const createSqliteRegionalNationalGroupStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    regions: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
    matches: PostseasonMatchSource;
    selections?: Pick<SqliteNationalCompetitionSelectionStore, 'readSelection'>;
    draws?: Pick<SqliteRegionalNationalDrawStore, 'readDraw'>;
    editions?: Pick<SqliteRegionalNationalEditionStore, 'readEdition'>;
  }>,
): SqliteRegionalNationalGroupStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) {
    throw new Error('invalid regional national database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_groups (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    edition_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  }
  const get = db.prepare(`SELECT edition_json, plan_json, outcome_json
    FROM world_regional_national_groups
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): GroupRow | null =>
    (get.get(careerId, editionId) as GroupRow | undefined) ?? null;
  const projectPlan = (careerId: string, edition: RegionalNationalEdition) => projectRegionalNationalPlan(sources, careerId, edition);
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
    }> => withCompetitionSourceReadScope(() => {
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
  });
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid regional national group scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string, rawEdition: RegionalNationalEdition):
      RegionalNationalGroupPlan {
      return withCompetitionSourceReadPhase(() => {
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
      });
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
      return withCompetitionSourceReadPhase(() => {
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
      });
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
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteRegionalNationalGroupStore = (databasePath: string, sources: Parameters<typeof createSqliteRegionalNationalGroupStore>[1]): SqliteRegionalNationalGroupStore =>
  createSqliteRegionalNationalGroupStore(databasePath, sources);

/** Same owner replay on the consuming Native connection; no writer or close capability escapes. */
export const regionalNationalGroupEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteRegionalNationalGroupStore>[1]): Pick<SqliteRegionalNationalGroupStore, 'readEdition' | 'readPlan' | 'readResults' | 'readOutcome'> => {
  const owner = createSqliteRegionalNationalGroupStore(db, sources);
  return Object.freeze({ readEdition: owner.readEdition, readPlan: owner.readPlan, readResults: owner.readResults, readOutcome: owner.readOutcome });
};
