import { deliverCompletedGamePlayerOutcomes, type CompletedGameOutcomeStores, type CompletedGamePlayerOutcomeDelivery } from './CompletedGamePlayerOutcomeDelivery';
import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import type { DatabaseSync } from 'node:sqlite';
import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';
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

export type WbcOutcomeCompletionCommitment = Readonly<{ version: 'wbc_player_outcomes_v1'; wbcEditionId: string }>;
export type WbcOutcomeCompletion = Readonly<{ careerId: string; editionId: string;
  commitment?: WbcOutcomeCompletionCommitment; status: 'LEGACY' | 'PENDING' | 'COMPLETED' }>;

export type WbcFinalsKnockoutRequest = Readonly<{
  careerId: string;
  completion?: WbcOutcomeCompletionCommitment;
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
  readCompletion(careerId: string, editionId: string): WbcOutcomeCompletion | null;
  listPendingCompletions(): readonly WbcOutcomeCompletion[];
  deliverOutcomes(careerId: string, editionId: string, stores: CompletedGameOutcomeStores): CompletedGamePlayerOutcomeDelivery;
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
const createSqliteWbcFinalsKnockoutStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    groups: Pick<SqliteWbcFinalsGroupStore, 'readEvidence'>;
    editions?: Pick<SqliteNationalCompetitionEditionStore, 'readWbcKnockoutEdition'>;
    matches: PostseasonMatchSource;
  }>,
  originalFixtureInputs = false,
): SqliteWbcFinalsKnockoutStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) {
    throw new Error('invalid WBC knockout database path');
  }
  const readEvidence = createCompetitionSourceReader(sources.groups.readEvidence, sources.groups);
  const readWbcKnockoutEdition = sources.editions ? createCompetitionSourceReader(sources.editions.readWbcKnockoutEdition, sources.editions) : undefined;
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_finals_knockout (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const columns = db.prepare('PRAGMA table_info(world_wbc_finals_knockout)').all() as { name: string }[];
  if (!columns.some(column => column.name === 'outcome_delivery_json')) {
    db.exec('ALTER TABLE world_wbc_finals_knockout ADD COLUMN outcome_delivery_json TEXT');
  }
  }
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_wbc_finals_knockout WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const source = (request: WbcFinalsKnockoutRequest):
    WbcKnockoutSource => {
    if (sources.editions) {
      const edition = readWbcKnockoutEdition!(request.careerId, request.edition.editionId);
      if (!edition || canonicalJson(edition) !== canonicalJson(request.edition)) {
        throw new Error('WBC knockout differs from accepted national edition');
      }
    }
    const evidence = readEvidence(request.careerId,
      request.edition.editionId);
    if (!evidence) {
      throw new Error('WBC knockout requires finalized groups');
    }
    return Object.freeze({ groupEdition: evidence.edition,
      groupPlan: evidence.plan, groupResults: evidence.results,
      berths: evidence.berths, knockoutEdition: request.edition });
  };
  const commitment = (request: WbcFinalsKnockoutRequest): WbcOutcomeCompletionCommitment | undefined => {
    if (!Object.hasOwn(request, 'completion')) return undefined;
    const value = request.completion;
    if (!value || value.version !== 'wbc_player_outcomes_v1' || !id(value.wbcEditionId)
      || value.wbcEditionId !== request.edition.editionId
      || canonicalJson(value) !== canonicalJson({ version: value.version, wbcEditionId: value.wbcEditionId })) {
      throw new Error('invalid WBC outcome completion commitment');
    }
    return Object.freeze({ ...value });
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
    plan: WbcKnockoutPlan, stopAt?: 'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL'): Readonly<{
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
    if (stopAt === 'QUARTERFINAL') return { source: official, roundOf16Results, quarterfinalGames,
      quarterfinalResults: null, semifinalGames: null, semifinalResults: null, finalGame: null, finalResult: null };
    const quarterfinalResults = results(quarterfinalGames);
    if (!quarterfinalResults) return { source: official,
      roundOf16Results, quarterfinalGames,
      quarterfinalResults: null, semifinalGames: null,
      semifinalResults: null, finalGame: null, finalResult: null };
    const semifinalGames = planWbcSemifinals(plan,
      roundOf16Results, quarterfinalResults, official);
    if (stopAt === 'SEMIFINAL') return { source: official, roundOf16Results, quarterfinalGames,
      quarterfinalResults, semifinalGames, semifinalResults: null, finalGame: null, finalResult: null };
    const semifinalResults = results(semifinalGames);
    if (!semifinalResults) return { source: official,
      roundOf16Results, quarterfinalGames,
      quarterfinalResults, semifinalGames,
      semifinalResults: null, finalGame: null, finalResult: null };
    const finalGame = planWbcFinal(plan, roundOf16Results,
      quarterfinalResults, semifinalResults, official);
    if (stopAt === 'FINAL') return { source: official, roundOf16Results, quarterfinalGames,
      quarterfinalResults, semifinalGames, semifinalResults, finalGame, finalResult: null };
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
      commitment(request);
      const plan = projectPlan(request);
      if (request.careerId !== careerId
        || request.edition.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(savedPlan) !== stored.plan_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('WBC knockout plan replay differs');
      }
      let outcome: WbcKnockoutOutcome | null = null;
      if (stored.outcome_json !== null && !originalFixtureInputs) {
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
  const owner: SqliteWbcFinalsKnockoutStore = Object.freeze({
    initialize(rawRequest: WbcFinalsKnockoutRequest):
      WbcKnockoutPlan {
      assertScope(rawRequest?.careerId, rawRequest?.edition?.editionId);
      const request = cloneInert(rawRequest);
      commitment(request);
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
      return withCompetitionSourceReadScope(() => {
        return read(careerId, editionId)?.request.edition ?? null;
      });
    },
    readPlan(careerId: string, editionId: string):
      WbcKnockoutPlan | null {
      return withCompetitionSourceReadScope(() => {
        return read(careerId, editionId)?.plan ?? null;
      });
    },
    quarterfinalGames(careerId: string, editionId: string):
      readonly WbcKnockoutGame[] | null {
      return withCompetitionSourceReadScope(() => {
        const prior = read(careerId, editionId);
        return prior ? stages(prior.request,
          prior.plan, originalFixtureInputs ? 'QUARTERFINAL' : undefined).quarterfinalGames : null;
      });
    },
    semifinalGames(careerId: string, editionId: string):
      readonly WbcKnockoutGame[] | null {
      return withCompetitionSourceReadScope(() => {
        const prior = read(careerId, editionId);
        return prior ? stages(prior.request,
          prior.plan, originalFixtureInputs ? 'SEMIFINAL' : undefined).semifinalGames : null;
      });
    },
    finalGame(careerId: string, editionId: string):
      WbcKnockoutGame | null {
      return withCompetitionSourceReadScope(() => {
        const prior = read(careerId, editionId);
        return prior ? stages(prior.request,
          prior.plan, originalFixtureInputs ? 'FINAL' : undefined).finalGame : null;
      });
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
      return withCompetitionSourceReadScope(() => {
        return read(careerId, editionId)?.outcome ?? null;
      });
    },
    readEvidence(careerId: string, editionId: string):
      WbcFinalsKnockoutEvidence | null {
      return withCompetitionSourceReadScope(() => {
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
      });
    },
    readCompletion(careerId: string, editionId: string): WbcOutcomeCompletion | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const prior = withCompetitionSourceReadPhase(() => replay(careerId, editionId, stored));
      const required = commitment(prior.request);
      const delivery = db.prepare('SELECT outcome_delivery_json FROM world_wbc_finals_knockout WHERE career_id=? AND edition_id=?')
        .get(careerId, editionId) as { outcome_delivery_json: string | null };
      if (!required && delivery.outcome_delivery_json !== null) throw new Error('legacy WBC completion has an unexpected receipt');
      if (delivery.outcome_delivery_json !== null) {
        const evidence = withCompetitionSourceReadPhase(() => owner.readEvidence(careerId, editionId));
        if (!evidence || canonicalJson([...evidence.source.groupResults, ...evidence.roundOf16Results, ...evidence.quarterfinalResults, ...evidence.semifinalResults, evidence.finalResult]) !== delivery.outcome_delivery_json) {
          throw new Error('WBC outcome completion original finals differ');
        }
      }
      return Object.freeze({ careerId, editionId, ...(required ? { commitment: required } : {}),
        status: !required ? 'LEGACY' : delivery.outcome_delivery_json === null ? 'PENDING' : 'COMPLETED' });
    },
    listPendingCompletions(): readonly WbcOutcomeCompletion[] {
      if (closed) throw new Error('WBC completion store is closed');
      const rows = db.prepare(`SELECT career_id, edition_id FROM world_wbc_finals_knockout WHERE outcome_delivery_json IS NULL AND json_type(request_json, '$.completion') IS NOT NULL ORDER BY career_id, edition_id`)
        .all() as { career_id: string; edition_id: string }[];
      return Object.freeze(rows.map(value => owner.readCompletion(value.career_id, value.edition_id)!)
        .filter(value => value.status === 'PENDING'));
    },
    deliverOutcomes(careerId: string, editionId: string, stores: CompletedGameOutcomeStores): CompletedGamePlayerOutcomeDelivery {
      const before = owner.readCompletion(careerId, editionId);
      const stored = row(careerId, editionId);
      const evidence = withCompetitionSourceReadPhase(() => owner.readEvidence(careerId, editionId));
      if (!before || !stored || !evidence) throw new Error('WBC outcome delivery lacks completed original evidence');
      const finals = [...evidence.source.groupResults, ...evidence.roundOf16Results, ...evidence.quarterfinalResults, ...evidence.semifinalResults, evidence.finalResult];
      const receipt = canonicalJson(finals);
      const delivered = deliverCompletedGamePlayerOutcomes(stores, careerId, editionId, finals);
      // Legacy rows retain explicit delivery without retroactive enrollment.
      if (!before.commitment || delivered.kind === 'unavailable') return delivered;
      db.exec('BEGIN IMMEDIATE');
      try {
        const latest = row(careerId, editionId);
        const evidence = withCompetitionSourceReadPhase(() => owner.readEvidence(careerId, editionId));
        if (!latest || canonicalJson(latest) !== canonicalJson(stored) || !evidence
          || canonicalJson([...evidence.source.groupResults, ...evidence.roundOf16Results, ...evidence.quarterfinalResults, ...evidence.semifinalResults, evidence.finalResult]) !== receipt) {
          throw new Error('WBC outcome completion original changed during delivery');
        }
        const completion = owner.readCompletion(careerId, editionId)!;
        if (completion.status === 'PENDING') {
          const changed = db.prepare(`UPDATE world_wbc_finals_knockout SET outcome_delivery_json=?
            WHERE career_id=? AND edition_id=? AND request_json=? AND plan_json=? AND outcome_json=? AND outcome_delivery_json IS NULL`)
            .run(receipt, careerId, editionId, stored.request_json, stored.plan_json, stored.outcome_json!);
          if (changed.changes !== 1) throw new Error('WBC outcome completion CAS lost');
        }
        // The UPDATE may execute triggers. Authenticate the saved bytes and
        // originals in a new proof phase while rollback is still possible.
        const persisted = row(careerId, editionId);
        const saved = db.prepare('SELECT outcome_delivery_json FROM world_wbc_finals_knockout WHERE career_id=? AND edition_id=?')
          .get(careerId, editionId) as { outcome_delivery_json: string | null } | undefined;
        if (!persisted || canonicalJson(persisted) !== canonicalJson(stored) || saved?.outcome_delivery_json !== receipt) {
          throw new Error('WBC outcome completion persisted original differs');
        }
        withCompetitionSourceReadPhase(() => {
          const evidence = owner.readEvidence(careerId, editionId);
          if (!evidence || canonicalJson([...evidence.source.groupResults, ...evidence.roundOf16Results, ...evidence.quarterfinalResults, ...evidence.semifinalResults, evidence.finalResult]) !== receipt) {
            throw new Error('WBC outcome completion persisted original differs');
          }
        });
        db.exec('COMMIT');
        return delivered;
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close(): void {
      if (!closed && !borrowed) db.close();
      closed = true;
    },
  });
  return owner;
};

/** Existing path facade retains connection/schema ownership. */
export const openSqliteWbcFinalsKnockoutStore = (databasePath: string, sources: Parameters<typeof createSqliteWbcFinalsKnockoutStore>[1]): SqliteWbcFinalsKnockoutStore =>
  createSqliteWbcFinalsKnockoutStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcFinalsKnockoutEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcFinalsKnockoutStore>[1]): Pick<SqliteWbcFinalsKnockoutStore, 'readEdition' | 'readPlan' | 'quarterfinalGames' | 'semifinalGames' | 'finalGame' | 'readOutcome' | 'readEvidence'> => {
  const owner = createSqliteWbcFinalsKnockoutStore(db, sources);
  return Object.freeze({ readEdition: owner.readEdition, readPlan: owner.readPlan, quarterfinalGames: owner.quarterfinalGames, semifinalGames: owner.semifinalGames, finalGame: owner.finalGame, readOutcome: owner.readOutcome, readEvidence: owner.readEvidence });
};

/** Original playable fixture inputs exclude current/later round outcomes. */
export const wbcFinalsKnockoutFixtureEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcFinalsKnockoutStore>[1]): Pick<SqliteWbcFinalsKnockoutStore, 'readEdition' | 'readPlan' | 'quarterfinalGames' | 'semifinalGames' | 'finalGame'> => {
  const owner = createSqliteWbcFinalsKnockoutStore(db, sources, true);
  return Object.freeze({ readEdition: owner.readEdition, readPlan: owner.readPlan, quarterfinalGames: owner.quarterfinalGames, semifinalGames: owner.semifinalGames, finalGame: owner.finalGame });
};
