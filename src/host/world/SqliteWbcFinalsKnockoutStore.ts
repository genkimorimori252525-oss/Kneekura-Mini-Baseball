import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { finalizeWbcKnockout, planWbcFinal,
  planWbcKnockout, planWbcQuarterfinals, planWbcSemifinals,
  type WbcKnockoutEdition, type WbcKnockoutGame,
  type WbcKnockoutOutcome, type WbcKnockoutPlan,
  type WbcKnockoutSource } from
  '../../core/world/competition/WbcFinalsKnockout';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqliteWbcFinalsGroupStore } from
  './SqliteWbcFinalsGroupStore';
import type { SqliteNationalCompetitionEditionStore } from './SqliteNationalCompetitionEditionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type WbcFinalsKnockoutRequest = Readonly<{
  careerId: string;
  edition: WbcKnockoutEdition;
}>;
export type WbcFinalsKnockoutEvidence = Readonly<{
  source: WbcKnockoutSource;
  plan: WbcKnockoutPlan;
  roundOf16Results: readonly OfficialGameResult[];
  quarterfinalResults: readonly OfficialGameResult[];
  semifinalResults: readonly OfficialGameResult[];
  finalResult: OfficialGameResult;
  outcome: WbcKnockoutOutcome;
}>;
export type SqliteWbcFinalsKnockoutStore = Readonly<{
  initialize(request: WbcFinalsKnockoutRequest): WbcKnockoutPlan;
  readEdition(careerId: string, editionId: string): WbcKnockoutEdition | null;
  readPlan(careerId: string, editionId: string):
    WbcKnockoutPlan | null;
  quarterfinalGames(careerId: string, editionId: string):
    readonly WbcKnockoutGame[] | null;
  semifinalGames(careerId: string, editionId: string):
    readonly WbcKnockoutGame[] | null;
  finalGame(careerId: string, editionId: string):
    WbcKnockoutGame | null;
  finalize(careerId: string, editionId: string):
    WbcKnockoutOutcome | null;
  readOutcome(careerId: string, editionId: string):
    WbcKnockoutOutcome | null;
  readEvidence(careerId: string, editionId: string):
    WbcFinalsKnockoutEvidence | null;
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

/** Advance four knockout stages only when prior Match finals exist. */
export const openSqliteWbcFinalsKnockoutStore = (
  databasePath: string,
  sources: Readonly<{
    groups: Pick<SqliteWbcFinalsGroupStore, 'readEvidence'>;
    editions?: Pick<SqliteNationalCompetitionEditionStore, 'readWbcKnockoutEdition'>;
    matches: PostseasonMatchSource;
  }>,
): SqliteWbcFinalsKnockoutStore => {
  if (!id(databasePath)) {
    throw new Error('invalid WBC knockout database path');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_finals_knockout (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_wbc_finals_knockout WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const source = (request: WbcFinalsKnockoutRequest):
    WbcKnockoutSource => {
    if (sources.editions) {
      const edition = sources.editions.readWbcKnockoutEdition(request.careerId, request.edition.editionId);
      if (!edition || canonicalJson(edition) !== canonicalJson(request.edition)) {
        throw new Error('WBC knockout differs from accepted national edition');
      }
    }
    const evidence = sources.groups.readEvidence(request.careerId,
      request.edition.editionId);
    if (!evidence) {
      throw new Error('WBC knockout requires finalized groups');
    }
    return Object.freeze({ groupEdition: evidence.edition,
      groupPlan: evidence.plan, groupResults: evidence.results,
      berths: evidence.berths, knockoutEdition: request.edition });
  };
  const projectPlan = (request: WbcFinalsKnockoutRequest):
    WbcKnockoutPlan => planWbcKnockout(source(request));
  const results = (games: readonly WbcKnockoutGame[]):
    readonly OfficialGameResult[] | null => {
    const finals = games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    return finals.some((result) => result === null) ? null
      : Object.freeze(finals.filter((result) => result !== null));
  };
  const stages = (request: WbcFinalsKnockoutRequest,
    plan: WbcKnockoutPlan): Readonly<{
      source: WbcKnockoutSource;
      roundOf16Results: readonly OfficialGameResult[] | null;
      quarterfinalGames: readonly WbcKnockoutGame[] | null;
      quarterfinalResults: readonly OfficialGameResult[] | null;
      semifinalGames: readonly WbcKnockoutGame[] | null;
      semifinalResults: readonly OfficialGameResult[] | null;
      finalGame: WbcKnockoutGame | null;
      finalResult: OfficialGameResult | null;
    }> => {
    const official = source(request);
    const roundOf16Results = results(plan.roundOf16Games);
    if (!roundOf16Results) return { source: official,
      roundOf16Results: null, quarterfinalGames: null,
      quarterfinalResults: null, semifinalGames: null,
      semifinalResults: null, finalGame: null, finalResult: null };
    const quarterfinalGames = planWbcQuarterfinals(plan,
      roundOf16Results, official);
    const quarterfinalResults = results(quarterfinalGames);
    if (!quarterfinalResults) return { source: official,
      roundOf16Results, quarterfinalGames,
      quarterfinalResults: null, semifinalGames: null,
      semifinalResults: null, finalGame: null, finalResult: null };
    const semifinalGames = planWbcSemifinals(plan,
      roundOf16Results, quarterfinalResults, official);
    const semifinalResults = results(semifinalGames);
    if (!semifinalResults) return { source: official,
      roundOf16Results, quarterfinalGames,
      quarterfinalResults, semifinalGames,
      semifinalResults: null, finalGame: null, finalResult: null };
    const finalGame = planWbcFinal(plan, roundOf16Results,
      quarterfinalResults, semifinalResults, official);
    const finalResult = readDurableOfficialGameResult(sources.matches,
      finalGame.gameId);
    return { source: official, roundOf16Results,
      quarterfinalGames, quarterfinalResults,
      semifinalGames, semifinalResults, finalGame, finalResult };
  };
  const projectOutcome = (request: WbcFinalsKnockoutRequest,
    plan: WbcKnockoutPlan): WbcKnockoutOutcome | null => {
    const stage = stages(request, plan);
    if (!stage.roundOf16Results || !stage.quarterfinalResults
      || !stage.semifinalResults || !stage.finalResult) return null;
    return finalizeWbcKnockout(plan, stage.roundOf16Results,
      stage.quarterfinalResults, stage.semifinalResults,
      stage.finalResult, stage.source);
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{ request: WbcFinalsKnockoutRequest;
      plan: WbcKnockoutPlan; outcome: WbcKnockoutOutcome | null }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcFinalsKnockoutRequest;
      const savedPlan = JSON.parse(stored.plan_json) as
        WbcKnockoutPlan;
      const plan = projectPlan(request);
      if (request.careerId !== careerId
        || request.edition.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('WBC knockout plan replay differs');
      }
      let outcome: WbcKnockoutOutcome | null = null;
      if (stored.outcome_json !== null) {
        const saved = JSON.parse(stored.outcome_json) as
          WbcKnockoutOutcome;
        outcome = projectOutcome(request, plan);
        if (canonicalJson(saved) !== stored.outcome_json
          || !outcome || canonicalJson(outcome) !== stored.outcome_json) {
          throw new Error('WBC knockout outcome replay differs');
        }
      }
      return Object.freeze({ request, plan, outcome });
    } catch (cause) {
      throw new Error(`corrupt WBC finals knockout for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string, editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid WBC knockout scope');
    }
  };
  const read = (careerId: string, editionId: string) => {
    assertScope(careerId, editionId);
    const stored = row(careerId, editionId);
    return stored ? replay(careerId, editionId, stored) : null;
  };
  return Object.freeze({
    initialize(rawRequest: WbcFinalsKnockoutRequest):
      WbcKnockoutPlan {
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
            throw new Error('WBC knockout Edition is frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        const plan = projectPlan(request);
        db.prepare(`INSERT INTO world_wbc_finals_knockout
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
    readEdition(careerId: string, editionId: string): WbcKnockoutEdition | null {
      return read(careerId, editionId)?.request.edition ?? null;
    },
    readPlan(careerId: string, editionId: string):
      WbcKnockoutPlan | null {
      return read(careerId, editionId)?.plan ?? null;
    },
    quarterfinalGames(careerId: string, editionId: string):
      readonly WbcKnockoutGame[] | null {
      const prior = read(careerId, editionId);
      return prior ? stages(prior.request,
        prior.plan).quarterfinalGames : null;
    },
    semifinalGames(careerId: string, editionId: string):
      readonly WbcKnockoutGame[] | null {
      const prior = read(careerId, editionId);
      return prior ? stages(prior.request,
        prior.plan).semifinalGames : null;
    },
    finalGame(careerId: string, editionId: string):
      WbcKnockoutGame | null {
      const prior = read(careerId, editionId);
      return prior ? stages(prior.request,
        prior.plan).finalGame : null;
    },
    finalize(careerId: string, editionId: string):
      WbcKnockoutOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) throw new Error('WBC knockout plan is missing');
        const prior = replay(careerId, editionId, stored);
        if (prior.outcome) {
          db.exec('COMMIT');
          return prior.outcome;
        }
        const outcome = projectOutcome(prior.request, prior.plan);
        if (outcome) {
          db.prepare(`UPDATE world_wbc_finals_knockout
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
      WbcKnockoutOutcome | null {
      return read(careerId, editionId)?.outcome ?? null;
    },
    readEvidence(careerId: string, editionId: string):
      WbcFinalsKnockoutEvidence | null {
      const prior = read(careerId, editionId);
      if (!prior?.outcome) return null;
      const stage = stages(prior.request, prior.plan);
      if (!stage.roundOf16Results || !stage.quarterfinalResults
        || !stage.semifinalResults || !stage.finalResult) {
        throw new Error('WBC knockout evidence lost Match finals');
      }
      return Object.freeze({ source: stage.source, plan: prior.plan,
        roundOf16Results: stage.roundOf16Results,
        quarterfinalResults: stage.quarterfinalResults,
        semifinalResults: stage.semifinalResults,
        finalResult: stage.finalResult, outcome: prior.outcome });
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
};
