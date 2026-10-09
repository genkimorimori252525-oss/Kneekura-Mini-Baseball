import { practiceOrderExecutionEvidenceFromOwner, type OwnedPracticeOrderMethods } from './OwnedPitchPracticeOrder';
import { MANAGER_PRACTICE_OBSERVATION_KIND, managerPracticeExecutionObservation, type ManagerPracticeObservationSource } from './ManagerPracticeExecutionObservation';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createRequire } from 'node:module';
import { applyManagerExecutionObservation,
  createManagerBeliefHistory } from
  '../../core/world/manager/ManagerBeliefHistory';
import type { ManagerBeliefHistory,
  ManagerBeliefHistoryEvent, ManagerExecutionLearningPolicy,
  ManagerExecutionObservation } from
  '../../core/world/manager/ManagerBeliefHistory';
import { openSqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import type { DurableRosterExecution } from
  './SqliteManagerRosterDecisionStore';
import { readManagerBeliefBoundary } from './ManagerBeliefBoundary';
export { readManagerBeliefBoundary, assertManagerBeliefBoundary } from './ManagerBeliefBoundary';
export type { ManagerBeliefBoundary } from './ManagerBeliefBoundary';

export type DurableManagerBeliefObservation = Readonly<{
  executionId: string;
  careerId: string;
  managerId: string;
  revision: number;
  event: ManagerBeliefHistoryEvent;
  state: ManagerBeliefHistory;
}>;
export type ManagerBeliefObservationRequest = Readonly<{
  careerId: string; managerId: string; expectedRevision: number; executionId: string;
}>;
export type SqliteManagerBeliefHistoryStore = Readonly<{
  initializeFromOpportunity(input: Readonly<{ careerId: string;
    clubId: string; decisionId: string;
    policy: ManagerExecutionLearningPolicy }>): void;
  readHead(careerId: string, managerId: string):
    ManagerBeliefHistory | null;
  readAtRevision(careerId: string, managerId: string, revision: number):
    ManagerBeliefHistory | null;
  readObservation(executionId: string):
    DurableManagerBeliefObservation | null;
  apply(input: Readonly<{ careerId: string; managerId: string;
    expectedRevision: number; executionId: string }>)
    : DurableManagerBeliefObservation;
  applyPracticeOrder(input: ManagerBeliefObservationRequest): DurableManagerBeliefObservation;
  close(): void;
}>;
type HeadRow = { revision: number; state_json: string;
  seed_json: string };
type ObservationRow = { career_id: string; manager_id: string;
  revision: number; request_json: string; source_json: string;
  before_json: string; result_json: string };
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const canonicalJson = (value: unknown): string => {
  const visit = (item: unknown): unknown => {
    if (item === null || typeof item === 'string'
      || typeof item === 'boolean') return item;
    if (typeof item === 'number' && Number.isFinite(item)) return item;
    if (Array.isArray(item)) return item.map(visit);
    if (typeof item !== 'object') {
      throw new Error('manager belief history requires inert data');
    }
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0)
      .map(([key, child]) => [key, visit(child)]));
  };
  return JSON.stringify(visit(value));
};

/** Only a validated, durable execution can become a Manager observation. */
export const openSqliteManagerBeliefHistoryStore = (
  databasePath: string,
  practiceOwner?: Pick<OwnedPracticeOrderMethods, 'readOrder'>,
): SqliteManagerBeliefHistoryStore => {
  if (!id(databasePath)) throw new Error('invalid world database path');
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const practiceReader = practiceOwner === undefined ? undefined : practiceOrderExecutionEvidenceFromOwner(practiceOwner);
  const db = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  db.exec(`CREATE TABLE IF NOT EXISTS world_manager_person_heads (
    career_id TEXT NOT NULL, manager_id TEXT NOT NULL,
    revision INTEGER NOT NULL, state_json TEXT NOT NULL,
    seed_json TEXT NOT NULL,
    PRIMARY KEY (career_id, manager_id)
  );
  CREATE TABLE IF NOT EXISTS world_manager_belief_observations (
    execution_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL, manager_id TEXT NOT NULL,
    revision INTEGER NOT NULL, request_json TEXT NOT NULL,
    source_json TEXT NOT NULL, before_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    UNIQUE (career_id, manager_id, revision)
  );`);
  const getHead = db.prepare(`SELECT revision, state_json,
    seed_json FROM world_manager_person_heads
    WHERE career_id=? AND manager_id=?`);
  const getObservation = db.prepare(`SELECT career_id, manager_id,
    revision, request_json, source_json, before_json, result_json
    FROM world_manager_belief_observations WHERE execution_id=?`);
  const countObservations = db.prepare(`SELECT COUNT(*) AS count
    FROM world_manager_belief_observations
    WHERE career_id=? AND manager_id=?`);
  const getExecutionSource = db.prepare(`SELECT result_json
    FROM world_roster_executions WHERE execution_id=?`);
  const getOpportunitySource = db.prepare(`SELECT issued_json
    FROM world_roster_opportunities
    WHERE career_id=? AND club_id=? AND decision_id=?`);
  const getCareerOpportunities = db.prepare(`SELECT issued_json
    FROM world_roster_opportunities WHERE career_id=?`);
  const row = (careerId: string, managerId: string): HeadRow | null =>
    (getHead.get(careerId, managerId) as HeadRow | undefined)
      ?? null;
  const observationRow = (executionId: string): ObservationRow | null =>
    (getObservation.get(executionId) as ObservationRow | undefined)
      ?? null;
  const parsedHead = (careerId: string, managerId: string,
    item: HeadRow): ManagerBeliefHistory => {
    const state = JSON.parse(item.state_json) as ManagerBeliefHistory;
    const count = countObservations.get(careerId,
      managerId) as { count: number };
    if (state.careerId !== careerId
      || state.managerId !== managerId
      || state.revision !== item.revision
      || count.count !== item.revision
      || canonicalJson(state) !== item.state_json) {
      throw new Error('corrupt durable Manager Person history');
    }
    // Replay every original prefix: removing a tag must never turn a new
    // observation into an unchecked legacy head. Valid legacy bytes stay intact.
    return readManagerBeliefBoundary(db, careerId, managerId, item.revision, practiceReader)!.state;
  };
  const readSnapshot = <T>(work: () => T): T => {
    if (db.isTransaction) return work();
    db.exec('BEGIN');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const acceptedExecution = (executionId: string):
    DurableRosterExecution => {
    const source = openSqliteManagerRosterDecisionStore(databasePath);
    try {
      const execution = source.readExecution(executionId);
      if (!execution) throw new Error('accepted execution is absent');
      return execution;
    } finally { source.close(); }
  };
  const observationFrom = (execution: DurableRosterExecution):
    ManagerExecutionObservation => {
    const evidence = execution.result.projection
      .managerSelfChosenEvidence;
    if (!evidence
      || evidence.eventIds.length !== 1
      || evidence.eventIds[0]
        !== execution.result.rosterEvent.eventId
      || evidence.executionId !== execution.executionId) {
      throw new Error('execution lacks manager self-chosen evidence');
    }
    return Object.freeze({ executionId: execution.executionId,
      sourceEventId: execution.result.rosterEvent.eventId,
      careerId: execution.careerId, clubId: execution.clubId,
      managerId: evidence.managerId,
      appointmentId: evidence.appointmentId,
      decisionId: evidence.decisionId,
      actionId: evidence.actionId,
      observedAtDay: execution.result.rosterEvent.effectiveDay });
  };
  const decodedVerifiedObservation = (executionId: string, item: ObservationRow): DurableManagerBeliefObservation => {
    const verified = readManagerBeliefBoundary(db, item.career_id, item.manager_id, item.revision, practiceReader);
    const saved = JSON.parse(item.result_json) as DurableManagerBeliefObservation;
    if (!verified || saved.executionId !== executionId || saved.careerId !== item.career_id || saved.managerId !== item.manager_id
      || saved.revision !== item.revision || canonicalJson(saved.state) !== canonicalJson(verified.state)) {
      throw new Error('corrupt durable Manager observation prefix');
    }
    return saved;
  };
  const decodedObservation = (executionId: string,
    item: ObservationRow): DurableManagerBeliefObservation => {
    const sourceTag = JSON.parse(item.source_json) as { kind?: unknown };
    if (Object.hasOwn(sourceTag, 'kind')) {
      if (sourceTag.kind !== MANAGER_PRACTICE_OBSERVATION_KIND) throw new Error('invalid Manager observation source kind');
      return decodedVerifiedObservation(executionId, item);
    }
    const request = JSON.parse(item.request_json) as
      { careerId: string; managerId: string;
        expectedRevision: number; executionId: string };
    const before = JSON.parse(item.before_json) as ManagerBeliefHistory;
    const saved = JSON.parse(item.result_json) as
      DurableManagerBeliefObservation;
    const source = acceptedExecution(executionId);
    const observation = observationFrom(source);
    const replay = applyManagerExecutionObservation(before,
      request.expectedRevision, observation);
    const head = row(item.career_id, item.manager_id);
    if (!head || !revision(item.revision)
      || canonicalJson(request) !== item.request_json
      || canonicalJson(source) !== item.source_json
      || canonicalJson(before) !== item.before_json
      || canonicalJson(saved) !== item.result_json
      || canonicalJson(replay) !== canonicalJson(saved.state)
      || request.executionId !== executionId
      || request.careerId !== item.career_id
      || request.managerId !== item.manager_id
      || saved.executionId !== executionId
      || saved.revision !== item.revision
      || canonicalJson(saved.event)
        !== canonicalJson(replay.recent.at(-1))
      || head.revision < item.revision
      || (head.revision === item.revision
        && head.state_json !== canonicalJson(saved.state))) {
      throw new Error('corrupt durable Manager observation');
    }
    // A legacy roster observation can contain earlier practice observations.
    // Authenticate the entire returned historical prefix on this connection.
    return decodedVerifiedObservation(executionId, item);
  };
  return Object.freeze({
    initializeFromOpportunity(input): void {
      if (!input || !id(input.careerId)
        || !id(input.clubId) || !id(input.decisionId)) {
        throw new Error('invalid Manager Person source');
      }
      const source = openSqliteManagerRosterDecisionStore(databasePath);
      let issued;
      try {
        issued = source.readOpportunity(input.careerId,
          input.clubId, input.decisionId);
      } finally { source.close(); }
      if (!issued) throw new Error('issued Manager opportunity is absent');
      const managerId = issued.selectionAgent.managerId;
      const state = createManagerBeliefHistory(input.careerId,
        managerId, issued.selectionAgent.state, input.policy);
      const seedJson = canonicalJson({ careerId: input.careerId,
        clubId: input.clubId, decisionId: input.decisionId,
        opportunity: issued.opportunity, policy: state.policy,
        agent: state.agent });
      transaction(() => {
        const durableSource = getOpportunitySource.get(input.careerId,
          input.clubId, input.decisionId) as
          { issued_json: string } | undefined;
        if (!durableSource
          || canonicalJson(JSON.parse(durableSource.issued_json))
            !== canonicalJson(issued)) {
          throw new Error('Manager seed opportunity changed');
        }
        const prior = row(input.careerId, managerId);
        if (prior) {
          if (prior.seed_json !== seedJson) {
            throw new Error('Manager Person history initialized differently');
          }
          return;
        }
        for (const earlier of getCareerOpportunities.all(
          input.careerId) as { issued_json: string }[]) {
          try {
            const previous = JSON.parse(earlier.issued_json) as
              typeof issued;
            if (previous.selectionAgent.managerId !== managerId) {
              continue;
            }
            const previousState = createManagerBeliefHistory(
              input.careerId, managerId,
              previous.selectionAgent.state, input.policy);
            if (canonicalJson(previousState.agent)
              !== canonicalJson(state.agent)) {
              throw new Error('different snapshot');
            }
          } catch (cause) {
            throw new Error('Manager belief snapshots require explicit reconciliation',
              { cause });
          }
        }
        db.prepare(`INSERT INTO world_manager_person_heads
          (career_id, manager_id, revision, state_json, seed_json)
          VALUES (?, ?, 0, ?, ?)`).run(input.careerId,
            managerId, canonicalJson(state), seedJson);
      });
    },
    readHead(careerId, managerId): ManagerBeliefHistory | null {
      if (!id(careerId) || !id(managerId)) {
        throw new Error('invalid Manager Person scope');
      }
      return readSnapshot(() => { const item = row(careerId, managerId); return item ? parsedHead(careerId, managerId, item) : null; });
    },
    readObservation(executionId):
      DurableManagerBeliefObservation | null {
      if (!id(executionId)) throw new Error('invalid executionId');
      return readSnapshot(() => { const item = observationRow(executionId); return item ? decodedObservation(executionId, item) : null; });
    },
    readAtRevision(careerId, managerId, revision): ManagerBeliefHistory | null {
      return readSnapshot(() => readManagerBeliefBoundary(db, careerId, managerId, revision, practiceReader)?.state ?? null);
    },
    applyPracticeOrder(rawInput): DurableManagerBeliefObservation {
      const input = cloneInert(rawInput);
      if (!input || Object.keys(input).sort().join('|') !== 'careerId|executionId|expectedRevision|managerId'
        || !id(input.careerId) || !id(input.managerId) || !id(input.executionId) || !revision(input.expectedRevision)
        || input.expectedRevision === Number.MAX_SAFE_INTEGER) throw new Error('invalid Manager practice observation request');
      const requestJson = canonicalJson({ kind: MANAGER_PRACTICE_OBSERVATION_KIND, ...input });
      return transaction(() => {
        const prior = observationRow(input.executionId);
        if (prior) {
          if (prior.request_json !== requestJson) throw new Error('executionId used for different learning request');
          return decodedVerifiedObservation(input.executionId, prior);
        }
        if (!practiceReader) throw new Error('Manager practice observation requires its genuine practice order reader');
        const before = readManagerBeliefBoundary(db, input.careerId, input.managerId, input.expectedRevision, practiceReader)?.state;
        const item = row(input.careerId, input.managerId);
        if (!before || !item || item.revision !== input.expectedRevision || item.state_json !== canonicalJson(before)) {
          throw new Error('stale or absent Manager Person revision');
        }
        const owned = practiceReader(db, input.executionId, { careerId: input.careerId, managerId: input.managerId, revision: before.revision + 1 });
        if (!owned) throw new Error('actual Manager practice order execution is missing');
        const source: ManagerPracticeObservationSource = { kind: MANAGER_PRACTICE_OBSERVATION_KIND, order: owned.order };
        const observation = managerPracticeExecutionObservation(source);
        const after = applyManagerExecutionObservation(before, input.expectedRevision, observation);
        const saved: DurableManagerBeliefObservation = { executionId: input.executionId, careerId: input.careerId,
          managerId: input.managerId, revision: after.revision, event: after.recent.at(-1)!, state: after };
        const updated = db.prepare(`UPDATE world_manager_person_heads SET revision=?,state_json=?
          WHERE career_id=? AND manager_id=? AND revision=? AND state_json=?`).run(after.revision, canonicalJson(after),
          input.careerId, input.managerId, before.revision, item.state_json);
        if (updated.changes !== 1) throw new Error('stale Manager Person revision');
        db.prepare(`INSERT INTO world_manager_belief_observations
          (execution_id,career_id,manager_id,revision,request_json,source_json,before_json,result_json)
          VALUES (?,?,?,?,?,?,?,?)`).run(input.executionId, input.careerId, input.managerId, after.revision, requestJson,
          canonicalJson(source), canonicalJson(before), canonicalJson(saved));
        // Replaying on this writer after INSERT catches source and head mutation
        // by triggers while preserving the original legacy observation bytes.
        const replayed = decodedVerifiedObservation(input.executionId, observationRow(input.executionId)!);
        if (canonicalJson(replayed) !== canonicalJson(saved)) throw new Error('Manager practice observation written result differs');
        return replayed;
      });
    },
    apply(input): DurableManagerBeliefObservation {
      if (!input || !id(input.careerId)
        || !id(input.managerId)
        || !id(input.executionId)
        || !revision(input.expectedRevision)) {
        throw new Error('invalid Manager observation request');
      }
      const requestJson = canonicalJson(input);
      const source = acceptedExecution(input.executionId);
      const observation = observationFrom(source);
      if (observation.careerId !== input.careerId
        || observation.managerId !== input.managerId) {
        throw new Error('execution belongs to another manager');
      }
      return transaction(() => {
        const prior = observationRow(input.executionId);
        if (prior) {
          if (prior.request_json !== requestJson) {
            throw new Error('executionId used for different learning request');
          }
          return decodedObservation(input.executionId, prior);
        }
        const durableSource = getExecutionSource.get(
          input.executionId) as { result_json: string } | undefined;
        if (!durableSource || canonicalJson(source)
          !== durableSource.result_json) {
          throw new Error('accepted execution changed');
        }
        const item = row(input.careerId, input.managerId);
        if (!item) throw new Error('Manager Person history is absent');
        const before = parsedHead(input.careerId,
          input.managerId, item);
        if (before.revision !== input.expectedRevision) {
          throw new Error('stale Manager Person revision');
        }
        const after = applyManagerExecutionObservation(before,
          input.expectedRevision, observation);
        const event = after.recent.at(-1)!;
        const saved: DurableManagerBeliefObservation = Object.freeze({
          executionId: input.executionId, careerId: input.careerId,
          managerId: input.managerId, revision: after.revision,
          event, state: after });
        const updated = db.prepare(`UPDATE world_manager_person_heads
          SET revision=?, state_json=?
          WHERE career_id=? AND manager_id=? AND revision=?
            AND state_json=?`).run(after.revision,
            canonicalJson(after), input.careerId, input.managerId,
            before.revision, item.state_json);
        if (updated.changes !== 1) {
          throw new Error('stale Manager Person revision');
        }
        db.prepare(`INSERT INTO world_manager_belief_observations
          (execution_id, career_id, manager_id, revision,
            request_json, source_json, before_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(input.executionId,
            input.careerId, input.managerId, after.revision,
            requestJson, canonicalJson(source),
            canonicalJson(before), canonicalJson(saved));
        const verified = readManagerBeliefBoundary(db, input.careerId, input.managerId, after.revision, practiceReader);
        if (!verified || canonicalJson(verified.state) !== canonicalJson(after)) throw new Error('Manager history written replay differs');
        return saved;
      });
    },
    close(): void { db.close(); },
  });
};
