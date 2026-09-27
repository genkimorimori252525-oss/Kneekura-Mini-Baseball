import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeContinentalFinalFour,
  planContinentalFinalFour,
  type ContinentalFinalFourOutcome,
  type ContinentalFinalFourPlan,
  type ContinentalFinalFourSource } from
  '../../core/world/competition/ContinentalFinalFour';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import type { SqliteContinentalQuarterfinalStore } from
  './SqliteContinentalQuarterfinalStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type SqliteContinentalFinalFourStore = Readonly<{
  initialize(careerId: string, editionId: string):
    ContinentalFinalFourPlan;
  readPlan(careerId: string, editionId: string):
    ContinentalFinalFourPlan | null;
  finalize(careerId: string, editionId: string):
    ContinentalFinalFourOutcome | null;
  readOutcome(careerId: string, editionId: string):
    ContinentalFinalFourOutcome | null;
  close(): void;
}>;
type FinalFourRow = { plan_json: string; outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Edition owns the neutral host and pairing; Match owns all five finals. */
export const openSqliteContinentalFinalFourStore = (
  databasePath: string,
  sources: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    quarterfinals: Pick<SqliteContinentalQuarterfinalStore,
      'readPlan' | 'readSource' | 'readOutcome'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteContinentalFinalFourStore => {
  if (!id(databasePath)) {
    throw new Error('invalid continental final four database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_continental_final_fours (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    plan_json TEXT NOT NULL, outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT plan_json, outcome_json
    FROM world_continental_final_fours WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): FinalFourRow | null =>
    (get.get(careerId, editionId) as FinalFourRow | undefined) ?? null;
  const readSource = (careerId: string, editionId: string):
    ContinentalFinalFourSource => {
    const edition = sources.editions.readEdition(careerId, editionId);
    const quarterfinalPlan = sources.quarterfinals.readPlan(careerId,
      editionId);
    const quarterfinalSource = sources.quarterfinals.readSource(careerId,
      editionId);
    const quarterfinalOutcome = sources.quarterfinals.readOutcome(careerId,
      editionId);
    if (!edition || !quarterfinalPlan || !quarterfinalSource
      || !quarterfinalOutcome || !edition.finalFourPairingPolicy) {
      throw new Error('final four requires frozen Edition and quarterfinal outcome');
    }
    const results = quarterfinalPlan.games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (results.length !== 4 || results.some((result) => result === null)) {
      throw new Error('final four requires four durable quarterfinal finals');
    }
    return Object.freeze({ edition, quarterfinalPlan,
      quarterfinalResults: results.filter((result) => result !== null),
      quarterfinalSource,
      pairingPolicy: edition.finalFourPairingPolicy });
  };
  const projectPlan = (careerId: string, editionId: string):
    ContinentalFinalFourPlan =>
    planContinentalFinalFour(readSource(careerId, editionId));
  const projectOutcome = (careerId: string, editionId: string,
    plan: ContinentalFinalFourPlan):
    ContinentalFinalFourOutcome | null => {
    const semifinals = plan.semifinalGames.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (semifinals.some((result) => result === null)) return null;
    const final = readDurableOfficialGameResult(sources.matches,
      plan.finalGameId);
    if (!final) return null;
    return finalizeContinentalFinalFour(plan,
      semifinals.filter((result) => result !== null), final,
      readSource(careerId, editionId));
  };
  const replay = (careerId: string, editionId: string,
    stored: FinalFourRow): Readonly<{
      plan: ContinentalFinalFourPlan;
      outcome: ContinentalFinalFourOutcome | null;
    }> => {
    try {
      const savedPlan = JSON.parse(stored.plan_json) as
        ContinentalFinalFourPlan;
      if (canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('final four plan serialization differs');
      }
      const plan = projectPlan(careerId, editionId);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('final four plan replay differs');
      }
      let outcome: ContinentalFinalFourOutcome | null = null;
      if (stored.outcome_json !== null) {
        const savedOutcome = JSON.parse(stored.outcome_json) as
          ContinentalFinalFourOutcome;
        outcome = projectOutcome(careerId, editionId, plan);
        if (canonicalJson(savedOutcome) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('final four outcome replay differs');
        }
      }
      return Object.freeze({ plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt continental final four for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid continental final four scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string, editionId: string):
      ContinentalFinalFourPlan {
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
        db.prepare(`INSERT INTO world_continental_final_fours
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
      ContinentalFinalFourPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    finalize(careerId: string, editionId: string):
      ContinentalFinalFourOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('continental final four plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(careerId, editionId, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_continental_final_fours
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
      ContinentalFinalFourOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
