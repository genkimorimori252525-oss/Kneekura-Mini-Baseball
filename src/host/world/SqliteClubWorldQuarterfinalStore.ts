import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeClubWorldQuarterfinals,
  planClubWorldQuarterfinals,
  type ClubWorldQuarterfinalOutcome,
  type ClubWorldQuarterfinalPlan,
  type ClubWorldQuarterfinalSource } from
  '../../core/world/competition/ClubWorldQuarterfinals';
import type { SqliteClubWorldGroupHubStore } from
  './SqliteClubWorldGroupHubStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type SqliteClubWorldQuarterfinalStore = Readonly<{
  initialize(careerId: string, editionId: string):
    ClubWorldQuarterfinalPlan;
  readPlan(careerId: string, editionId: string):
    ClubWorldQuarterfinalPlan | null;
  readSource(careerId: string, editionId: string):
    ClubWorldQuarterfinalSource | null;
  finalize(careerId: string, editionId: string):
    ClubWorldQuarterfinalOutcome | null;
  readOutcome(careerId: string, editionId: string):
    ClubWorldQuarterfinalOutcome | null;
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

/** The Edition pins quarterfinal pairings and neutral venues. */
export const openSqliteClubWorldQuarterfinalStore = (
  databasePath: string,
  sources: Readonly<{
    groups: Pick<SqliteClubWorldGroupHubStore, 'readEvidence'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteClubWorldQuarterfinalStore => {
  if (!id(databasePath)) {
    throw new Error('invalid Club World quarterfinal database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_club_world_quarterfinals (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    plan_json TEXT NOT NULL, outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT plan_json, outcome_json
    FROM world_club_world_quarterfinals WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const source = (careerId: string,
    editionId: string): ClubWorldQuarterfinalSource => {
    const evidence = sources.groups.readEvidence(careerId, editionId);
    if (!evidence) {
      throw new Error('Club World quarterfinal requires finalized groups');
    }
    return Object.freeze({ groupSource: evidence.source,
      groupPlan: evidence.plan,
      groupOfficialResults: evidence.results,
      groupTiebreakPolicy: evidence.tiebreakPolicy });
  };
  const projectPlan = (careerId: string,
    editionId: string): ClubWorldQuarterfinalPlan =>
    planClubWorldQuarterfinals(source(careerId, editionId));
  const projectOutcome = (careerId: string, editionId: string,
    plan: ClubWorldQuarterfinalPlan):
    ClubWorldQuarterfinalOutcome | null => {
    const results = plan.games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    if (results.some((result) => result === null)) return null;
    return finalizeClubWorldQuarterfinals(plan,
      results.filter((result) => result !== null),
      source(careerId, editionId));
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{ plan: ClubWorldQuarterfinalPlan;
      outcome: ClubWorldQuarterfinalOutcome | null }> => {
    try {
      const savedPlan = JSON.parse(stored.plan_json) as
        ClubWorldQuarterfinalPlan;
      const plan = projectPlan(careerId, editionId);
      if (canonicalJson(savedPlan) !== stored.plan_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('Club World quarterfinal plan replay differs');
      }
      let outcome: ClubWorldQuarterfinalOutcome | null = null;
      if (stored.outcome_json !== null) {
        const saved = JSON.parse(stored.outcome_json) as
          ClubWorldQuarterfinalOutcome;
        outcome = projectOutcome(careerId, editionId, plan);
        if (canonicalJson(saved) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('Club World quarterfinal outcome replay differs');
        }
      }
      return Object.freeze({ plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt Club World quarterfinal for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid Club World quarterfinal scope');
    }
  };
  return Object.freeze({
    initialize(careerId: string, editionId: string):
      ClubWorldQuarterfinalPlan {
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
        db.prepare(`INSERT INTO world_club_world_quarterfinals
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
      ClubWorldQuarterfinalPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan : null;
    },
    readSource(careerId: string, editionId: string):
      ClubWorldQuarterfinalSource | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      replay(careerId, editionId, stored);
      return source(careerId, editionId);
    },
    finalize(careerId: string, editionId: string):
      ClubWorldQuarterfinalOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('Club World quarterfinal plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(careerId, editionId, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_club_world_quarterfinals
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
      ClubWorldQuarterfinalOutcome | null {
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
