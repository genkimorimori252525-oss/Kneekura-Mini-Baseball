import type { DatabaseSync } from 'node:sqlite';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizePremierTwelve, planPremierTwelveFinalFour,
  planPremierTwelveMedalGames, type PremierTwelveFinalFourPlan,
  type PremierTwelveFinalFourSource, type PremierTwelveMedalGames,
  type PremierTwelveOutcome } from
  '../../core/world/competition/PremierTwelve';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqlitePremierTwelveGroupStore } from
  './SqlitePremierTwelveGroupStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type PremierTwelveFinalFourEvidence = Readonly<{
  source: PremierTwelveFinalFourSource;
  plan: PremierTwelveFinalFourPlan;
  semifinalResults: readonly OfficialGameResult[];
  bronzeResult: OfficialGameResult;
  finalResult: OfficialGameResult;
  outcome: PremierTwelveOutcome;
}>;
export type SqlitePremierTwelveFinalFourStore = Readonly<{
  initialize(careerId: string, editionId: string): PremierTwelveFinalFourPlan;
  readPlan(careerId: string, editionId: string): PremierTwelveFinalFourPlan | null;
  medalGames(careerId: string, editionId: string): PremierTwelveMedalGames | null;
  finalize(careerId: string, editionId: string): PremierTwelveOutcome | null;
  readOutcome(careerId: string, editionId: string): PremierTwelveOutcome | null;
  readEvidence(careerId: string, editionId: string): PremierTwelveFinalFourEvidence | null;
  close(): void;
}>;
type Row = { plan_json: string; outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** The frozen group edition owns semifinal pairing and both medal games. */
const createSqlitePremierTwelveFinalFourStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    groups: Pick<SqlitePremierTwelveGroupStore, 'readEvidence'>;
    matches: PostseasonMatchSource;
  }>,
  originalFixtureInputs = false,
): SqlitePremierTwelveFinalFourStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) throw new Error('invalid Premier12 final four database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_premier_twelve_final_four (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    plan_json TEXT NOT NULL, outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  }
  const get = db.prepare(`SELECT plan_json, outcome_json
    FROM world_premier_twelve_final_four WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const source = (careerId: string, editionId: string): PremierTwelveFinalFourSource => {
    const evidence = sources.groups.readEvidence(careerId, editionId);
    if (!evidence) throw new Error('Premier12 final four requires finalized groups');
    if (evidence.edition.editionId !== editionId) {
      throw new Error('Premier12 group evidence belongs to a different edition');
    }
    return Object.freeze({ edition: evidence.edition,
      authority: evidence.authority, groupPlan: evidence.plan,
      groupResults: evidence.results });
  };
  const stages = (official: PremierTwelveFinalFourSource,
    plan: PremierTwelveFinalFourPlan) => {
    const finals = plan.semifinalGames.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    const semifinalResults = finals.some((result) => result === null)
      ? null : Object.freeze(finals.filter((result) => result !== null));
    const medalGames = semifinalResults
      ? planPremierTwelveMedalGames(plan, semifinalResults, official) : null;
    const bronzeResult = !originalFixtureInputs && medalGames ? readDurableOfficialGameResult(
      sources.matches, medalGames.bronzeGame.gameId) : null;
    const finalResult = !originalFixtureInputs && medalGames ? readDurableOfficialGameResult(
      sources.matches, medalGames.finalGame.gameId) : null;
    return { semifinalResults, medalGames, bronzeResult, finalResult };
  };
  const projectOutcome = (official: PremierTwelveFinalFourSource,
    plan: PremierTwelveFinalFourPlan): PremierTwelveOutcome | null => {
    const stage = stages(official, plan);
    return stage.semifinalResults && stage.bronzeResult && stage.finalResult
      ? finalizePremierTwelve(plan, stage.semifinalResults,
        stage.bronzeResult, stage.finalResult, official) : null;
  };
  const replay = (careerId: string, editionId: string, stored: Row) => {
    try {
      const official = source(careerId, editionId);
      const plan = planPremierTwelveFinalFour(official);
      const saved = JSON.parse(stored.plan_json) as PremierTwelveFinalFourPlan;
      if (canonicalJson(saved) !== stored.plan_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Premier12 final four plan replay differs');
      }
      let outcome: PremierTwelveOutcome | null = null;
      if (stored.outcome_json !== null && !originalFixtureInputs) {
        const savedOutcome = JSON.parse(stored.outcome_json) as PremierTwelveOutcome;
        outcome = projectOutcome(official, plan);
        if (!outcome || canonicalJson(savedOutcome) !== stored.outcome_json
          || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Premier12 final four outcome replay differs');
        }
      }
      return { source: official, plan, outcome };
    } catch (cause) {
      throw new Error(`corrupt Premier12 final four for ${careerId}`, { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Premier12 final four scope');
    }
  };
  const read = (careerId: string, editionId: string) => {
    assertScope(careerId, editionId);
    const stored = row(careerId, editionId);
    return stored ? replay(careerId, editionId, stored) : null;
  };
  return Object.freeze({
    initialize(careerId: string, editionId: string): PremierTwelveFinalFourPlan {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        const plan = stored ? replay(careerId, editionId, stored).plan
          : planPremierTwelveFinalFour(source(careerId, editionId));
        if (!stored) db.prepare(`INSERT INTO world_premier_twelve_final_four
          (career_id, edition_id, plan_json) VALUES (?, ?, ?)`).run(
          careerId, editionId, canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string, editionId: string): PremierTwelveFinalFourPlan | null {
      return read(careerId, editionId)?.plan ?? null;
    },
    medalGames(careerId: string, editionId: string): PremierTwelveMedalGames | null {
      const prior = read(careerId, editionId);
      return prior ? stages(prior.source, prior.plan).medalGames : null;
    },
    finalize(careerId: string, editionId: string): PremierTwelveOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Premier12 final four plan is missing');
        const prior = replay(careerId, editionId, stored);
        const outcome = prior.outcome ?? projectOutcome(prior.source, prior.plan);
        if (outcome && !prior.outcome) db.prepare(`UPDATE world_premier_twelve_final_four
          SET outcome_json=? WHERE career_id=? AND edition_id=?`).run(
          canonicalJson(outcome), careerId, editionId);
        db.exec('COMMIT');
        return outcome;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readOutcome(careerId: string, editionId: string): PremierTwelveOutcome | null {
      return read(careerId, editionId)?.outcome ?? null;
    },
    readEvidence(careerId: string, editionId: string): PremierTwelveFinalFourEvidence | null {
      const prior = read(careerId, editionId);
      if (!prior?.outcome) return null;
      const stage = stages(prior.source, prior.plan);
      if (!stage.semifinalResults || !stage.bronzeResult || !stage.finalResult) {
        throw new Error('Premier12 final four evidence lost Match finals');
      }
      return Object.freeze({ source: prior.source, plan: prior.plan,
        semifinalResults: stage.semifinalResults, bronzeResult: stage.bronzeResult,
        finalResult: stage.finalResult, outcome: prior.outcome });
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
};

/** Existing path facade retains connection/schema ownership. */
export const openSqlitePremierTwelveFinalFourStore = (databasePath: string, sources: Parameters<typeof createSqlitePremierTwelveFinalFourStore>[1]): SqlitePremierTwelveFinalFourStore =>
  createSqlitePremierTwelveFinalFourStore(databasePath, sources);

/** Same owner replay on the consuming Native connection; no writer or close capability escapes. */
export const premierTwelveFinalFourEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqlitePremierTwelveFinalFourStore>[1]): Pick<SqlitePremierTwelveFinalFourStore, 'readPlan' | 'medalGames' | 'readOutcome' | 'readEvidence'> => {
  const owner = createSqlitePremierTwelveFinalFourStore(db, sources);
  return Object.freeze({ readPlan: owner.readPlan, medalGames: owner.medalGames, readOutcome: owner.readOutcome, readEvidence: owner.readEvidence });
};

/** Fixture inputs stop before the target round's results and later tournament outcomes. */
export const premierTwelveFinalFourFixtureEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqlitePremierTwelveFinalFourStore>[1]): Pick<SqlitePremierTwelveFinalFourStore, 'readPlan' | 'medalGames'> => {
  const owner = createSqlitePremierTwelveFinalFourStore(db, sources, true);
  return Object.freeze({ readPlan: owner.readPlan, medalGames: owner.medalGames });
};
