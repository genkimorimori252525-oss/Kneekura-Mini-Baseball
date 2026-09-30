import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { finalizeRegionalNationalKnockout,
  planRegionalNationalFinal,
  planRegionalNationalKnockout,
  planRegionalNationalSemifinals,
  type RegionalNationalKnockoutEdition,
  type RegionalNationalKnockoutGame,
  type RegionalNationalKnockoutOutcome,
  type RegionalNationalKnockoutPlan,
  type RegionalNationalKnockoutSource } from
  '../../core/world/competition/RegionalNationalKnockout';
import type { SqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import type { SqliteRegionalNationalGroupStore } from
  './SqliteRegionalNationalGroupStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type SqliteRegionalNationalKnockoutStore = Readonly<{
  initialize(careerId: string,
    edition: RegionalNationalKnockoutEdition):
    RegionalNationalKnockoutPlan;
  readPlan(careerId: string, editionId: string):
    RegionalNationalKnockoutPlan | null;
  readEdition(careerId: string, editionId: string): RegionalNationalKnockoutEdition | null;
  readSemifinalGames(careerId: string, editionId: string):
    readonly RegionalNationalKnockoutGame[] | null;
  readFinalGame(careerId: string, editionId: string):
    RegionalNationalKnockoutGame | null;
  finalize(careerId: string, editionId: string):
    RegionalNationalKnockoutOutcome | null;
  readOutcome(careerId: string, editionId: string):
    RegionalNationalKnockoutOutcome | null;
  readEvidence(careerId: string, editionId: string):
    Readonly<{ source: RegionalNationalKnockoutSource;
      quarterfinalResults: readonly OfficialGameResult[];
      semifinalResults: readonly OfficialGameResult[];
      finalResult: OfficialGameResult }> | null;
  close(): void;
}>;
type KnockoutRow = { edition_json: string; plan_json: string;
  outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Advance each national knockout round only through durable Match finals. */
export const openSqliteRegionalNationalKnockoutStore = (
  databasePath: string,
  sources: Readonly<{
    groups: Pick<SqliteRegionalNationalGroupStore,
      'readEdition' | 'readPlan' | 'readResults' | 'readOutcome'>;
    regions: Pick<SqliteNationCompetitionRegionStore, 'authority'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteRegionalNationalKnockoutStore => {
  if (!id(databasePath)) {
    throw new Error('invalid regional national knockout database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_regional_national_knockouts (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    edition_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT edition_json, plan_json, outcome_json
    FROM world_regional_national_knockouts
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): KnockoutRow | null =>
    (get.get(careerId, editionId) as KnockoutRow | undefined) ?? null;
  const readSource = (careerId: string,
    knockoutEdition: RegionalNationalKnockoutEdition):
    RegionalNationalKnockoutSource => {
    const editionId = knockoutEdition.editionId;
    const groupEdition = sources.groups.readEdition(careerId, editionId);
    const groupPlan = sources.groups.readPlan(careerId, editionId);
    const groupResults = sources.groups.readResults(careerId, editionId);
    const groupOutcome = sources.groups.readOutcome(careerId, editionId);
    if (!groupEdition || !groupPlan || !groupResults
      || !groupOutcome) {
      throw new Error('national knockout requires frozen group outcome');
    }
    return Object.freeze({ groupEdition, groupPlan, groupResults,
      authority: sources.regions.authority(careerId),
      knockoutEdition });
  };
  const readComplete = (games: readonly RegionalNationalKnockoutGame[]):
    readonly OfficialGameResult[] | null => {
    const results = games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    return results.some((result) => result === null) ? null
      : Object.freeze(results.filter((result) => result !== null));
  };
  const projectPlan = (careerId: string,
    edition: RegionalNationalKnockoutEdition):
    RegionalNationalKnockoutPlan =>
    planRegionalNationalKnockout(readSource(careerId, edition));
  const projectStages = (careerId: string,
    edition: RegionalNationalKnockoutEdition,
    plan: RegionalNationalKnockoutPlan): Readonly<{
      semifinals: readonly RegionalNationalKnockoutGame[] | null;
      final: RegionalNationalKnockoutGame | null;
      outcome: RegionalNationalKnockoutOutcome | null;
    }> => {
    const source = readSource(careerId, edition);
    const hasQuarters = plan.openingGames[0]?.stage === 'QUARTERFINAL';
    const openingResults = hasQuarters
      ? readComplete(plan.openingGames) : Object.freeze([]);
    if (!openingResults) {
      return Object.freeze({ semifinals: null, final: null,
        outcome: null });
    }
    const semifinals = hasQuarters
      ? planRegionalNationalSemifinals(plan, openingResults, source)
      : plan.openingGames;
    const semifinalResults = readComplete(semifinals);
    if (!semifinalResults) {
      return Object.freeze({ semifinals, final: null,
        outcome: null });
    }
    const final = planRegionalNationalFinal(plan, openingResults,
      semifinalResults, source);
    const finalResult = readDurableOfficialGameResult(sources.matches,
      final.gameId);
    const outcome = finalResult
      ? finalizeRegionalNationalKnockout(plan,
        openingResults, semifinalResults, finalResult, source)
      : null;
    return Object.freeze({ semifinals, final, outcome });
  };
  const replay = (careerId: string, editionId: string,
    stored: KnockoutRow): Readonly<{
      edition: RegionalNationalKnockoutEdition;
      plan: RegionalNationalKnockoutPlan;
      outcome: RegionalNationalKnockoutOutcome | null;
    }> => {
    try {
      const edition = JSON.parse(stored.edition_json) as
        RegionalNationalKnockoutEdition;
      const savedPlan = JSON.parse(stored.plan_json) as
        RegionalNationalKnockoutPlan;
      if (edition.editionId !== editionId
        || canonicalJson(edition) !== stored.edition_json
        || canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('regional knockout serialization differs');
      }
      const plan = projectPlan(careerId, edition);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('regional knockout plan replay differs');
      }
      let outcome: RegionalNationalKnockoutOutcome | null = null;
      if (stored.outcome_json !== null) {
        const savedOutcome = JSON.parse(stored.outcome_json) as
          RegionalNationalKnockoutOutcome;
        outcome = projectStages(careerId, edition, plan).outcome;
        if (canonicalJson(savedOutcome) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('regional knockout outcome replay differs');
        }
      }
      return Object.freeze({ edition, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt regional national knockout for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid regional national knockout scope');
    }
  };
  const stages = (careerId: string, editionId: string) => {
    assertScope(careerId, editionId);
    const stored = row(careerId, editionId);
    if (!stored) return null;
    const prior = replay(careerId, editionId, stored);
    return projectStages(careerId, prior.edition, prior.plan);
  };
  return Object.freeze({
    initialize(careerId: string,
      rawEdition: RegionalNationalKnockoutEdition):
      RegionalNationalKnockoutPlan {
      assertScope(careerId, rawEdition?.editionId);
      const edition = cloneInert(rawEdition);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, edition.editionId);
        if (stored) {
          const prior = replay(careerId, edition.editionId, stored);
          if (canonicalJson(edition) !== stored.edition_json) {
            throw new Error('regional knockout Edition is already frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(careerId, edition);
        db.prepare(`INSERT INTO world_regional_national_knockouts
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
    readPlan(careerId: string, editionId: string):
      RegionalNationalKnockoutPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    readEdition(careerId: string, editionId: string): RegionalNationalKnockoutEdition | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? cloneInert(replay(careerId, editionId, stored).edition) : null;
    },
    readSemifinalGames(careerId: string, editionId: string):
      readonly RegionalNationalKnockoutGame[] | null {
      return stages(careerId, editionId)?.semifinals ?? null;
    },
    readFinalGame(careerId: string, editionId: string):
      RegionalNationalKnockoutGame | null {
      return stages(careerId, editionId)?.final ?? null;
    },
    finalize(careerId: string, editionId: string):
      RegionalNationalKnockoutOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('regional knockout plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectStages(careerId, prior.edition,
          prior.plan).outcome;
        if (outcome) {
          db.prepare(`UPDATE world_regional_national_knockouts
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
      RegionalNationalKnockoutOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    readEvidence(careerId: string, editionId: string) {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const prior = replay(careerId, editionId, stored);
      if (!prior.outcome) return null;
      const source = readSource(careerId, prior.edition);
      const quarterfinalResults = prior.plan.openingGames[0]?.stage
        === 'QUARTERFINAL'
        ? readComplete(prior.plan.openingGames) : Object.freeze([]);
      const semifinalResults = readComplete(prior.outcome.semifinalGames);
      const finalResult = readDurableOfficialGameResult(sources.matches,
        prior.outcome.finalGame.gameId);
      if (!quarterfinalResults || !semifinalResults || !finalResult) {
        throw new Error('regional knockout evidence lost Match final');
      }
      return Object.freeze({ source, quarterfinalResults,
        semifinalResults, finalResult });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
