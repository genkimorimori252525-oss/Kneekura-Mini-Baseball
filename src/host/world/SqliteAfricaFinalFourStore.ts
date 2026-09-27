import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeAfricaFinalFour, planAfricaFinalFour,
  type AfricaFinalFourOutcome, type AfricaFinalFourPlan,
  type AfricaFinalFourSource } from
  '../../core/world/competition/AfricaFinalFour';
import type { SqliteAfricaGroupHubStore } from
  './SqliteAfricaGroupHubStore';
import type { SqliteCompetitionDrawStore } from
  './SqliteCompetitionDrawStore';
import type { SqliteCompetitionEditionStore } from
  './SqliteCompetitionEditionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';

export type AfricaFinalFourEvidence = Readonly<{
  source: AfricaFinalFourSource;
  plan: AfricaFinalFourPlan;
  semifinalResults: readonly OfficialGameResult[];
  finalResult: OfficialGameResult;
}>;

export type SqliteAfricaFinalFourStore = Readonly<{
  initialize(careerId: string, editionId: string):
    AfricaFinalFourPlan;
  readPlan(careerId: string, editionId: string):
    AfricaFinalFourPlan | null;
  finalize(careerId: string, editionId: string):
    AfricaFinalFourOutcome | null;
  readOutcome(careerId: string, editionId: string):
    AfricaFinalFourOutcome | null;
  readEvidence(careerId: string, editionId: string):
    AfricaFinalFourEvidence | null;
  close(): void;
}>;
type FinalRow = { plan_json: string; outcome_json: string | null };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const canonicalJson = (value: unknown): string => JSON.stringify(
  cloneInert(value), (_key, item: unknown) =>
    item !== null && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0)) : item);

/** Africa's four qualifiers play at its Edition-pinned final venue. */
export const openSqliteAfricaFinalFourStore = (
  databasePath: string,
  sources: Readonly<{
    editions: Pick<SqliteCompetitionEditionStore, 'readEdition'>;
    draws: Pick<SqliteCompetitionDrawStore, 'readDraw'>;
    groups: Pick<SqliteAfricaGroupHubStore,
      'readPlan' | 'readTiebreakPolicy' | 'readOutcome'
      | 'readResults'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteAfricaFinalFourStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Africa final four database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_africa_final_fours (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    plan_json TEXT NOT NULL, outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT plan_json, outcome_json
    FROM world_africa_final_fours WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): FinalRow | null =>
    (get.get(careerId, editionId) as FinalRow | undefined) ?? null;
  const readSource = (careerId: string, editionId: string):
    AfricaFinalFourSource => {
    const edition = sources.editions.readEdition(careerId, editionId);
    const durableDraw = sources.draws.readDraw(careerId, editionId);
    const groupPlan = sources.groups.readPlan(careerId, editionId);
    const groupTiebreakPolicy = sources.groups.readTiebreakPolicy(
      careerId, editionId);
    const groupOutcome = sources.groups.readOutcome(careerId,
      editionId);
    const groupOfficialResults = sources.groups.readResults(careerId,
      editionId);
    if (!edition || !durableDraw || !groupPlan
      || !groupTiebreakPolicy || !groupOutcome
      || !groupOfficialResults
      || edition.drawSnapshotId !== durableDraw.drawSnapshotId
      || !edition.finalFourPairingPolicy) {
      throw new Error('Africa final four requires frozen group result and Edition');
    }
    return Object.freeze({ groupSource: {
      edition, draw: durableDraw.draw,
      hubPolicyVersion: edition.hostingPolicyVersion },
    groupPlan, groupOfficialResults, groupTiebreakPolicy,
    pairingPolicy: edition.finalFourPairingPolicy });
  };
  const projectPlan = (careerId: string,
    editionId: string): AfricaFinalFourPlan =>
    planAfricaFinalFour(readSource(careerId, editionId));
  const projectOutcome = (careerId: string, editionId: string,
    plan: AfricaFinalFourPlan): AfricaFinalFourOutcome | null => {
    const semifinalResults = plan.semifinalGames.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (semifinalResults.some((result) => result === null)) {
      return null;
    }
    const finalResult = readDurableOfficialGameResult(sources.matches,
      plan.finalGameId);
    if (!finalResult) return null;
    return finalizeAfricaFinalFour(plan,
      semifinalResults.filter((result) => result !== null),
      finalResult, readSource(careerId, editionId));
  };
  const replay = (careerId: string, editionId: string,
    stored: FinalRow): Readonly<{ plan: AfricaFinalFourPlan;
      outcome: AfricaFinalFourOutcome | null }> => {
    try {
      const savedPlan = JSON.parse(stored.plan_json) as
        AfricaFinalFourPlan;
      if (canonicalJson(savedPlan) !== stored.plan_json) {
        throw new Error('Africa final four plan serialization differs');
      }
      const plan = projectPlan(careerId, editionId);
      if (canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Africa final four plan replay differs');
      }
      let outcome: AfricaFinalFourOutcome | null = null;
      if (stored.outcome_json !== null) {
        const savedOutcome = JSON.parse(stored.outcome_json) as
          AfricaFinalFourOutcome;
        outcome = projectOutcome(careerId, editionId, plan);
        if (canonicalJson(savedOutcome) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Africa final four outcome replay differs');
        }
      }
      return Object.freeze({ plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt Africa final four for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Africa final four scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string, editionId: string):
      AfricaFinalFourPlan {
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
        db.prepare(`INSERT INTO world_africa_final_fours
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
      AfricaFinalFourPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    finalize(careerId: string, editionId: string):
      AfricaFinalFourOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Africa final four plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(careerId, editionId, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_africa_final_fours
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
      AfricaFinalFourOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome : null;
    },
    readEvidence(careerId: string, editionId: string):
      AfricaFinalFourEvidence | null {
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
        throw new Error('Africa final four evidence lost Match final');
      }
      return Object.freeze({ source: readSource(careerId, editionId), plan,
        semifinalResults: semifinalResults.filter((result) =>
          result !== null), finalResult });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
