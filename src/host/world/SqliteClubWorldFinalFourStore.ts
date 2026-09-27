import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeClubWorldFinalFour, planClubWorldFinalFour,
  type ClubWorldFinalFourOutcome, type ClubWorldFinalFourPlan,
  type ClubWorldFinalFourSource } from
  '../../core/world/competition/ClubWorldFinalFour';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqliteClubWorldQuarterfinalStore } from
  './SqliteClubWorldQuarterfinalStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type ClubWorldFinalFourEvidence = Readonly<{
  source: ClubWorldFinalFourSource;
  plan: ClubWorldFinalFourPlan;
  semifinalResults: readonly OfficialGameResult[];
  finalResult: OfficialGameResult;
}>;
export type SqliteClubWorldFinalFourStore = Readonly<{
  initialize(careerId: string, editionId: string):
    ClubWorldFinalFourPlan;
  readPlan(careerId: string, editionId: string):
    ClubWorldFinalFourPlan | null;
  finalize(careerId: string, editionId: string):
    ClubWorldFinalFourOutcome | null;
  readOutcome(careerId: string, editionId: string):
    ClubWorldFinalFourOutcome | null;
  readEvidence(careerId: string, editionId: string):
    ClubWorldFinalFourEvidence | null;
  close(): void;
}>;
type Row = { plan_json: string; outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** The Edition hosts a neutral semifinal and final after four Match wins. */
export const openSqliteClubWorldFinalFourStore = (
  databasePath: string,
  sources: Readonly<{
    quarterfinals: Pick<SqliteClubWorldQuarterfinalStore, 'readEvidence'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteClubWorldFinalFourStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Club World final four database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_world_final_fours (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    plan_json TEXT NOT NULL, outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT plan_json, outcome_json
    FROM world_club_world_final_fours WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const source = (careerId: string,
    editionId: string): ClubWorldFinalFourSource => {
    const evidence = sources.quarterfinals.readEvidence(careerId,
      editionId);
    if (!evidence) {
      throw new Error('Club World final four requires official quarterfinals');
    }
    return Object.freeze({ quarterfinalSource: evidence.source,
      quarterfinalPlan: evidence.plan,
      quarterfinalResults: evidence.results });
  };
  const projectPlan = (careerId: string,
    editionId: string): ClubWorldFinalFourPlan =>
    planClubWorldFinalFour(source(careerId, editionId));
  const projectOutcome = (careerId: string, editionId: string,
    plan: ClubWorldFinalFourPlan): ClubWorldFinalFourOutcome | null => {
    const semifinals = plan.semifinalGames.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (semifinals.some((result) => result === null)) return null;
    const final = readDurableOfficialGameResult(sources.matches,
      plan.finalGameId);
    if (!final) return null;
    return finalizeClubWorldFinalFour(plan,
      semifinals.filter((result) => result !== null), final,
      source(careerId, editionId));
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{ plan: ClubWorldFinalFourPlan;
      outcome: ClubWorldFinalFourOutcome | null }> => {
    try {
      const savedPlan = JSON.parse(stored.plan_json) as
        ClubWorldFinalFourPlan;
      const plan = projectPlan(careerId, editionId);
      if (canonicalJson(savedPlan) !== stored.plan_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Club World final four plan replay differs');
      }
      let outcome: ClubWorldFinalFourOutcome | null = null;
      if (stored.outcome_json !== null) {
        const saved = JSON.parse(stored.outcome_json) as
          ClubWorldFinalFourOutcome;
        outcome = projectOutcome(careerId, editionId, plan);
        if (canonicalJson(saved) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Club World final four outcome replay differs');
        }
      }
      return Object.freeze({ plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt Club World final four for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Club World final four scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string, editionId: string):
      ClubWorldFinalFourPlan {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (stored) {
          const prior = replay(careerId, editionId, stored);
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(careerId, editionId);
        db.prepare(`INSERT INTO world_club_world_final_fours
          (career_id, edition_id, plan_json) VALUES (?, ?, ?)`)
          .run(careerId, editionId, canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string, editionId: string):
      ClubWorldFinalFourPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    finalize(careerId: string, editionId: string):
      ClubWorldFinalFourOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Club World final four plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(careerId, editionId, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_club_world_final_fours
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
      ClubWorldFinalFourOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    readEvidence(careerId: string, editionId: string):
      ClubWorldFinalFourEvidence | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const { plan, outcome } = replay(careerId, editionId, stored);
      if (!outcome) return null;
      const semifinalResults = plan.semifinalGames.map((game) =>
        readDurableOfficialGameResult(sources.matches, game.gameId));
      const finalResult = readDurableOfficialGameResult(sources.matches,
        plan.finalGameId);
      if (semifinalResults.some((result) => result === null)
        || !finalResult) {
        throw new Error('Club World final four evidence lost Match finals');
      }
      return Object.freeze({ source: source(careerId, editionId), plan,
        semifinalResults: semifinalResults.filter((result) =>
          result !== null), finalResult });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
