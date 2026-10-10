import type { WbcOutcomeCompletionCommitment, WbcOutcomeCompletion } from './SqliteWbcFinalsKnockoutStore';
import { deliverCompletedGamePlayerOutcomes, type CompletedGameOutcomeStores, type CompletedGamePlayerOutcomeDelivery } from './CompletedGamePlayerOutcomeDelivery';
import { withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import type { DatabaseSync } from 'node:sqlite';
import { createCompetitionSourceReader } from './CompetitionSourceReadScope';
import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import { finalizeSelectedWbcGlobalQualifier,
  planSelectedWbcGlobalQualifier,
  planWbcGlobalQualifierFinals,
  type WbcGlobalQualifierEdition,
  type WbcGlobalQualifierOutcome,
  type WbcGlobalQualifierPlan,
  type WbcQualifierGame } from
  '../../core/world/competition/WbcGlobalQualifierPods';
import type { SqliteWbcQualifierSelectionStore } from
  './SqliteWbcQualifierSelectionStore';
import type { SqliteWbcQualifierEditionStore } from './SqliteWbcQualifierEditionStore';
import { readDurableOfficialGameResult,
  type PostseasonMatchSource } from './PostseasonResultsFromMatches';

export type WbcGlobalQualifierPodRequest = Readonly<{
  careerId: string;
  completion?: WbcOutcomeCompletionCommitment;
  edition: WbcGlobalQualifierEdition;
}>;
export type WbcGlobalQualifierPodEvidence = Readonly<{
  edition: WbcGlobalQualifierEdition;
  plan: WbcGlobalQualifierPlan;
  semifinalResults: readonly OfficialGameResult[];
  finalResults: readonly OfficialGameResult[];
  outcome: WbcGlobalQualifierOutcome;
}>;
export type SqliteWbcGlobalQualifierPodStore = Readonly<{
  initialize(request: WbcGlobalQualifierPodRequest):
    WbcGlobalQualifierPlan;
  readPlan(careerId: string,
    editionId: string): WbcGlobalQualifierPlan | null;
  readEdition(careerId: string,
    editionId: string): WbcGlobalQualifierEdition | null;
  finalGames(careerId: string,
    editionId: string): readonly WbcQualifierGame[] | null;
  finalize(careerId: string,
    editionId: string): WbcGlobalQualifierOutcome | null;
  readOutcome(careerId: string,
    editionId: string): WbcGlobalQualifierOutcome | null;
  readEvidence(careerId: string,
    editionId: string): WbcGlobalQualifierPodEvidence | null;
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

/** Advance the four pods only through twelve durable Match finals. */
const createSqliteWbcGlobalQualifierPodStore = (
  databasePath: string | DatabaseSync,
  sources: Readonly<{
    selection: Pick<SqliteWbcQualifierSelectionStore,
      'readSelection'>;
    matches: PostseasonMatchSource;
    editions?: Pick<SqliteWbcQualifierEditionStore, 'readEdition'>;
  }>,
  originalFixtureInputs = false,
): SqliteWbcGlobalQualifierPodStore => {
  if (typeof databasePath === 'string' && !id(databasePath)) {
    throw new Error('invalid WBC Global Qualifier database path');
  }
  const readSelected = createCompetitionSourceReader(sources.selection.readSelection, sources.selection);
  const readAcceptedEdition = sources.editions
    ? createCompetitionSourceReader(sources.editions.readEdition, sources.editions) : null;
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const borrowed = typeof databasePath !== 'string';
  const db = borrowed ? databasePath : new sqlite.DatabaseSync(databasePath);
  if (!(db instanceof sqlite.DatabaseSync)) throw new Error('National evidence requires a Native connection');
  if (!borrowed) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_wbc_qualifier_pods (
    career_id TEXT NOT NULL, edition_id TEXT NOT NULL,
    request_json TEXT NOT NULL, plan_json TEXT NOT NULL,
    outcome_json TEXT,
    PRIMARY KEY (career_id, edition_id)
  );`);
  const columns = db.prepare('PRAGMA table_info(world_wbc_qualifier_pods)').all() as { name: string }[];
  if (!columns.some(column => column.name === 'outcome_delivery_json')) {
    db.exec('ALTER TABLE world_wbc_qualifier_pods ADD COLUMN outcome_delivery_json TEXT');
  }
  }
  const get = db.prepare(`SELECT request_json, plan_json, outcome_json
    FROM world_wbc_qualifier_pods
    WHERE career_id=? AND edition_id=?`);
  const row = (careerId: string, editionId: string): Row | null =>
    (get.get(careerId, editionId) as Row | undefined) ?? null;
  const commitment = (request: WbcGlobalQualifierPodRequest): WbcOutcomeCompletionCommitment | undefined => {
    if (!Object.hasOwn(request, 'completion')) return undefined;
    const value = request.completion;
    if (!value || value.version !== 'wbc_player_outcomes_v1' || !id(value.wbcEditionId)

      || canonicalJson(value) !== canonicalJson({ version: value.version, wbcEditionId: value.wbcEditionId })) {
      throw new Error('invalid WBC outcome completion commitment');
    }
    return Object.freeze({ ...value });
  };
  const projectPlan = (request: WbcGlobalQualifierPodRequest):
    WbcGlobalQualifierPlan => {
    if (sources.editions) {
      const accepted = readAcceptedEdition!(request.careerId, request.edition.editionId);
      if (!accepted || canonicalJson(accepted) !== canonicalJson(request.edition)) {
        throw new Error('WBC qualifier pods require accepted qualifier Edition');
      }
    }
    const selection = readSelected(
      request.careerId, request.edition.editionId);
    if (!selection) {
      throw new Error('WBC qualifier needs selected entrants');
    }
    return planSelectedWbcGlobalQualifier(request.edition,
      selection);
  };
  const results = (games: readonly WbcQualifierGame[]):
    readonly OfficialGameResult[] | null => {
    const finals = games.map((game) =>
      readDurableOfficialGameResult(sources.matches, game.gameId));
    return finals.some((result) => result === null) ? null
      : Object.freeze(finals.filter((result) => result !== null));
  };
  const stages = (request: WbcGlobalQualifierPodRequest,
    plan: WbcGlobalQualifierPlan): Readonly<{
      semifinalResults: readonly OfficialGameResult[] | null;
      finalGames: readonly WbcQualifierGame[] | null;
      finalResults: readonly OfficialGameResult[] | null;
      outcome: WbcGlobalQualifierOutcome | null;
    }> => {
    const semifinalResults = results(plan.pods.flatMap((pod) =>
      pod.semifinals));
    if (!semifinalResults) {
      return { semifinalResults: null, finalGames: null,
        finalResults: null, outcome: null };
    }
    const finalGames = planWbcGlobalQualifierFinals(plan,
      semifinalResults, request.edition);
    if (originalFixtureInputs) return { semifinalResults, finalGames, finalResults: null, outcome: null };
    const finalResults = results(finalGames);
    if (!finalResults) return { semifinalResults, finalGames,
      finalResults: null, outcome: null };
    const selection = readSelected(
      request.careerId, request.edition.editionId);
    if (!selection) {
      throw new Error('WBC qualifier selection disappeared');
    }
    return { semifinalResults, finalGames, finalResults,
      outcome: finalizeSelectedWbcGlobalQualifier(plan,
        semifinalResults, finalResults, request.edition,
        selection) };
  };
  const replay = (careerId: string, editionId: string,
    stored: Row): Readonly<{
      request: WbcGlobalQualifierPodRequest;
      plan: WbcGlobalQualifierPlan;
      outcome: WbcGlobalQualifierOutcome | null;
    }> => {
    try {
      const request = JSON.parse(stored.request_json) as
        WbcGlobalQualifierPodRequest;
      commitment(request);
      const plan = projectPlan(request);
      if (request.careerId !== careerId
        || request.edition.editionId !== editionId
        || canonicalJson(request) !== stored.request_json
        || canonicalJson(plan) !== stored.plan_json) {
        throw new Error('WBC qualifier plan replay differs');
      }
      if (stored.outcome_json !== null && !originalFixtureInputs) {
        const stage = stages(request, plan);
        if (!stage.outcome
          || canonicalJson(stage.outcome)
            !== stored.outcome_json) {
          throw new Error('WBC qualifier outcome replay differs');
        }
        return { request, plan, outcome: stage.outcome };
      }
      return { request, plan, outcome: null };
    } catch (cause) {
      throw new Error(`corrupt WBC qualifier pods for ${careerId}`,
        { cause });
    }
  };
  let closed = false;
  const assertScope = (careerId: string,
    editionId: string): void => {
    if (closed || !id(careerId) || !id(editionId)) {
      throw new Error('invalid WBC qualifier pod scope');
    }
  };
  const owner: SqliteWbcGlobalQualifierPodStore = Object.freeze({
    initialize(rawRequest: WbcGlobalQualifierPodRequest):
      WbcGlobalQualifierPlan {
      assertScope(rawRequest?.careerId,
        rawRequest?.edition?.editionId);
      const request = cloneInert(rawRequest);
      commitment(request);
      const plan = projectPlan(request);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(request.careerId,
          request.edition.editionId);
        if (stored) {
          const prior = replay(request.careerId,
            request.edition.editionId, stored);
          if (stored.request_json !== canonicalJson(request)) {
            throw new Error('WBC qualifier edition is frozen differently');
          }
          db.exec('COMMIT');
          return prior.plan;
        }
        db.prepare(`INSERT INTO world_wbc_qualifier_pods
          (career_id, edition_id, request_json, plan_json, outcome_json)
          VALUES (?, ?, ?, ?, NULL)`).run(request.careerId,
            request.edition.editionId, canonicalJson(request),
            canonicalJson(plan));
        db.exec('COMMIT');
        return plan;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readPlan(careerId: string,
      editionId: string): WbcGlobalQualifierPlan | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).plan
        : null;
    },
    readEdition(careerId: string,
      editionId: string): WbcGlobalQualifierEdition | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const edition = cloneInert(replay(careerId, editionId, stored).request.edition);
      return Object.freeze({ ...edition,
        calendarWindow: Object.freeze({ ...edition.calendarWindow }),
        pods: Object.freeze(edition.pods.map((pod) => Object.freeze({ ...pod,
          entrants: Object.freeze(pod.entrants.map((entrant) => Object.freeze({ ...entrant }))) }))),
      });
    },
    finalGames(careerId: string,
      editionId: string): readonly WbcQualifierGame[] | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const current = replay(careerId, editionId, stored);
      return stages(current.request, current.plan).finalGames;
    },
    finalize(careerId: string,
      editionId: string): WbcGlobalQualifierOutcome | null {
      assertScope(careerId, editionId);
      db.exec('BEGIN IMMEDIATE');
      try {
        const stored = row(careerId, editionId);
        if (!stored) {
          db.exec('COMMIT');
          return null;
        }
        const current = replay(careerId, editionId, stored);
        if (current.outcome) {
          db.exec('COMMIT');
          return current.outcome;
        }
        const stage = stages(current.request, current.plan);
        if (stage.outcome) {
          db.prepare(`UPDATE world_wbc_qualifier_pods
            SET outcome_json=? WHERE career_id=? AND edition_id=?`)
            .run(canonicalJson(stage.outcome), careerId, editionId);
        }
        db.exec('COMMIT');
        return stage.outcome;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readOutcome(careerId: string,
      editionId: string): WbcGlobalQualifierOutcome | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      return stored ? replay(careerId, editionId, stored).outcome
        : null;
    },
    readEvidence(careerId: string,
      editionId: string): WbcGlobalQualifierPodEvidence | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const current = replay(careerId, editionId, stored);
      if (!current.outcome) return null;
      const stage = stages(current.request, current.plan);
      return Object.freeze({ edition: current.request.edition,
        plan: current.plan,
        semifinalResults: stage.semifinalResults!,
        finalResults: stage.finalResults!,
        outcome: current.outcome });
    },
    readCompletion(careerId: string, editionId: string): WbcOutcomeCompletion | null {
      assertScope(careerId, editionId);
      const stored = row(careerId, editionId);
      if (!stored) return null;
      const prior = withCompetitionSourceReadPhase(() => replay(careerId, editionId, stored));
      const required = commitment(prior.request);
      const delivery = db.prepare('SELECT outcome_delivery_json FROM world_wbc_qualifier_pods WHERE career_id=? AND edition_id=?')
        .get(careerId, editionId) as { outcome_delivery_json: string | null };
      if (!required && delivery.outcome_delivery_json !== null) throw new Error('legacy WBC completion has an unexpected receipt');
      if (delivery.outcome_delivery_json !== null) {
        const evidence = withCompetitionSourceReadPhase(() => owner.readEvidence(careerId, editionId));
        if (!evidence || canonicalJson([...evidence.semifinalResults, ...evidence.finalResults]) !== delivery.outcome_delivery_json) {
          throw new Error('WBC outcome completion original finals differ');
        }
      }
      return Object.freeze({ careerId, editionId, ...(required ? { commitment: required } : {}),
        status: !required ? 'LEGACY' : delivery.outcome_delivery_json === null ? 'PENDING' : 'COMPLETED' });
    },
    listPendingCompletions(): readonly WbcOutcomeCompletion[] {
      if (closed) throw new Error('WBC completion store is closed');
      const rows = db.prepare(`SELECT career_id, edition_id FROM world_wbc_qualifier_pods WHERE outcome_delivery_json IS NULL AND json_type(request_json, '$.completion') IS NOT NULL ORDER BY career_id, edition_id`)
        .all() as { career_id: string; edition_id: string }[];
      return Object.freeze(rows.map(value => owner.readCompletion(value.career_id, value.edition_id)!)
        .filter(value => value.status === 'PENDING'));
    },
    deliverOutcomes(careerId: string, editionId: string, stores: CompletedGameOutcomeStores): CompletedGamePlayerOutcomeDelivery {
      const before = owner.readCompletion(careerId, editionId);
      const stored = row(careerId, editionId);
      const evidence = withCompetitionSourceReadPhase(() => owner.readEvidence(careerId, editionId));
      if (!before || !stored || !evidence) throw new Error('WBC outcome delivery lacks completed original evidence');
      const finals = [...evidence.semifinalResults, ...evidence.finalResults];
      const receipt = canonicalJson(finals);
      const delivered = deliverCompletedGamePlayerOutcomes(stores, careerId, editionId, finals);
      // Legacy rows retain explicit delivery without retroactive enrollment.
      if (!before.commitment || delivered.kind === 'unavailable') return delivered;
      db.exec('BEGIN IMMEDIATE');
      try {
        const latest = row(careerId, editionId);
        const evidence = withCompetitionSourceReadPhase(() => owner.readEvidence(careerId, editionId));
        if (!latest || canonicalJson(latest) !== canonicalJson(stored) || !evidence
          || canonicalJson([...evidence.semifinalResults, ...evidence.finalResults]) !== receipt) {
          throw new Error('WBC outcome completion original changed during delivery');
        }
        const completion = owner.readCompletion(careerId, editionId)!;
        if (completion.status === 'PENDING') {
          const changed = db.prepare(`UPDATE world_wbc_qualifier_pods SET outcome_delivery_json=?
            WHERE career_id=? AND edition_id=? AND request_json=? AND plan_json=? AND outcome_json=? AND outcome_delivery_json IS NULL`)
            .run(receipt, careerId, editionId, stored.request_json, stored.plan_json, stored.outcome_json!);
          if (changed.changes !== 1) throw new Error('WBC outcome completion CAS lost');
        }
        // The UPDATE may execute triggers. Authenticate the saved bytes and
        // originals in a new proof phase while rollback is still possible.
        const persisted = row(careerId, editionId);
        const saved = db.prepare('SELECT outcome_delivery_json FROM world_wbc_qualifier_pods WHERE career_id=? AND edition_id=?')
          .get(careerId, editionId) as { outcome_delivery_json: string | null } | undefined;
        if (!persisted || canonicalJson(persisted) !== canonicalJson(stored) || saved?.outcome_delivery_json !== receipt) {
          throw new Error('WBC outcome completion persisted original differs');
        }
        withCompetitionSourceReadPhase(() => {
          const evidence = owner.readEvidence(careerId, editionId);
          if (!evidence || canonicalJson([...evidence.semifinalResults, ...evidence.finalResults]) !== receipt) {
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
export const openSqliteWbcGlobalQualifierPodStore = (databasePath: string, sources: Parameters<typeof createSqliteWbcGlobalQualifierPodStore>[1]): SqliteWbcGlobalQualifierPodStore =>
  createSqliteWbcGlobalQualifierPodStore(databasePath, sources);

/** Same owner replay on a consuming Native connection; only read capabilities escape. */
export const wbcGlobalQualifierPodEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcGlobalQualifierPodStore>[1]): Pick<SqliteWbcGlobalQualifierPodStore, 'readEdition' | 'readPlan' | 'finalGames' | 'readEvidence'> => {
  const owner = createSqliteWbcGlobalQualifierPodStore(db, sources);
  return Object.freeze({ readEdition: owner.readEdition, readPlan: owner.readPlan, finalGames: owner.finalGames, readEvidence: owner.readEvidence });
};

/** Original playable fixture inputs exclude current/later round outcomes. */
export const wbcGlobalQualifierPodFixtureEvidenceFromSqlite = (db: DatabaseSync, sources: Parameters<typeof createSqliteWbcGlobalQualifierPodStore>[1]): Pick<SqliteWbcGlobalQualifierPodStore, 'readEdition' | 'readPlan' | 'finalGames'> => {
  const owner = createSqliteWbcGlobalQualifierPodStore(db, sources, true);
  return Object.freeze({ readEdition: owner.readEdition, readPlan: owner.readPlan, finalGames: owner.finalGames });
};
