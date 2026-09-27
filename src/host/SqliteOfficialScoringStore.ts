import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { cloneInert } from '../core/adjudication/OfficialWindowPolicy';
import { deriveClosedLiveBallMatchState,
  getOfficialPlayClosure } from
  '../core/adjudication/PlayAdjudicationLedger';
import { classifyClosedPlayForOfficialScoring,
  type OfficialFairBallScoringEvidence,
  type SupportedOfficialScoringRecord } from
  '../core/adjudication/OfficialScoring';
import type { PersistOfficialFinalInput,
  PersistOfficialPlayInput } from './SqliteOfficialStateStore';

export type PersistOfficialScoringInput = Readonly<{
  scoringApplicationId: string;
  officialApplication: PersistOfficialPlayInput | PersistOfficialFinalInput;
  sourceEventId: string;
}>;
export type PersistedOfficialScoring = Readonly<{
  scoringApplicationId: string;
  matchId: string;
  officialApplicationId: string;
  closureId: string;
  sourceEventId: string;
  record: SupportedOfficialScoringRecord;
}>;
export type AcceptedOfficialScoringEvidenceAuthority = Readonly<{
  readAcceptedOfficialScoringEvidence(sourceEventId: string):
    OfficialFairBallScoringEvidence | null;
}>;
export type SqliteOfficialScoringStore = Readonly<{
  apply(input: PersistOfficialScoringInput): PersistedOfficialScoring;
  readApplication(scoringApplicationId: string): PersistedOfficialScoring | null;
  close(): void;
}>;

type OfficialApplicationRow = { match_id: string; closure_id: string;
  request_hash: string; result_json: string };
type ScoringRow = { scoring_application_id: string; match_id: string;
  official_application_id: string; closure_id: string;
  source_event_id: string; request_json: string; result_json: string };
type StoredRequest = Readonly<{ input: PersistOfficialScoringInput;
  evidence: OfficialFairBallScoringEvidence }>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
  && value === value.trim();
const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      result[key] = stable((value as Record<string, unknown>)[key]);
    }
    return result;
  }
  return value;
};
const serialized = (value: unknown): string => JSON.stringify(stable(value));
const hash = (value: unknown): string => createHash('sha256')
  .update(serialized(value)).digest('hex');
const officialHash = (input: PersistOfficialScoringInput['officialApplication']): string =>
  hash('game' in input ? { kind: 'game_final', request: input } : input);

/** Persists scoring after a durable official closure, without changing MatchState. */
export const openSqliteOfficialScoringStore = (
  databasePath: string,
  authority?: AcceptedOfficialScoringEvidenceAuthority,
): SqliteOfficialScoringStore => {
  if (!id(databasePath)) throw new Error('invalid official scoring database path');
  if (authority !== undefined
    && typeof authority.readAcceptedOfficialScoringEvidence !== 'function') {
    throw new Error('invalid accepted official scoring evidence authority');
  }
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const db: DatabaseSyncType = new sqlite.DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS official_scoring_applications (
    scoring_application_id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    official_application_id TEXT NOT NULL REFERENCES applications(application_id),
    closure_id TEXT NOT NULL,
    source_event_id TEXT NOT NULL UNIQUE,
    request_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    UNIQUE(match_id, closure_id)
  );`);
  const getOfficial = db.prepare(`SELECT match_id, closure_id,
    request_hash, result_json FROM applications WHERE application_id=?`);
  const getScoring = db.prepare(`SELECT scoring_application_id, match_id,
    official_application_id, closure_id, source_event_id,
    request_json, result_json FROM official_scoring_applications
    WHERE scoring_application_id=?`);
  const officialRow = (applicationId: string): OfficialApplicationRow | null =>
    (getOfficial.get(applicationId) as OfficialApplicationRow | undefined) ?? null;
  const scoringRow = (applicationId: string): ScoringRow | null =>
    (getScoring.get(applicationId) as ScoringRow | undefined) ?? null;
  const requireOfficialApplication = (
    input: PersistOfficialScoringInput['officialApplication'],
  ): string => {
    if (input.kind !== 'live_ball' || !id(input.matchId)
      || !id(input.applicationId)) {
      throw new Error('official scoring requires a live-ball application');
    }
    const closure = getOfficialPlayClosure(input.adjudication);
    const row = officialRow(input.applicationId);
    if (!closure || !row || row.match_id !== input.matchId
      || row.closure_id !== closure.closureId
      || row.request_hash !== officialHash(input)) {
      throw new Error('scoring evidence does not match durable official application');
    }
    const stored = JSON.parse(row.result_json) as {
      receipt?: { applicationId: string; closureId: string;
        previousPlayId: number; durableRevision: number;
        appliedMatchState: unknown };
    };
    if (stored.receipt?.applicationId !== input.applicationId
      || stored.receipt.closureId !== closure.closureId
      || stored.receipt.previousPlayId !== input.match.playId
      || stored.receipt.durableRevision
        !== input.expectedDurableRevision + 1
      || serialized(stored.receipt.appliedMatchState)
        !== serialized(deriveClosedLiveBallMatchState(input.match,
          input.physicalTimeline, input.adjudication))) {
      throw new Error('corrupt durable official application receipt');
    }
    return closure.closureId;
  };
  const acceptedEvidence = (sourceEventId: string): OfficialFairBallScoringEvidence => {
    const evidence = authority?.readAcceptedOfficialScoringEvidence(sourceEventId);
    if (!evidence || evidence.sourceEventId !== sourceEventId) {
      throw new Error('accepted scoring evidence is missing');
    }
    return cloneInert(evidence);
  };
  const score = (input: PersistOfficialScoringInput,
    evidence: OfficialFairBallScoringEvidence,
    closureId: string): PersistedOfficialScoring => {
    const official = input.officialApplication;
    if (official.kind !== 'live_ball') {
      throw new Error('official scoring requires a live-ball application');
    }
    const result = classifyClosedPlayForOfficialScoring({
      kind: 'live_ball', match: official.match,
      timeline: official.physicalTimeline,
      adjudication: official.adjudication,
      scoringEvidence: evidence,
    });
    if (result.kind !== 'supported') {
      throw new Error('official scoring evidence remains unsupported');
    }
    return Object.freeze({
      scoringApplicationId: input.scoringApplicationId,
      matchId: official.matchId,
      officialApplicationId: official.applicationId,
      closureId,
      sourceEventId: input.sourceEventId,
      record: result.record,
    });
  };
  const decode = (row: ScoringRow): { input: PersistOfficialScoringInput;
    result: PersistedOfficialScoring } => {
    try {
      const stored = JSON.parse(row.request_json) as StoredRequest;
      const result = JSON.parse(row.result_json) as PersistedOfficialScoring;
      const input = stored.input;
      // Acceptance is checked at first apply. The accepted snapshot is
      // durable so read/retry never depends on the source process.
      const evidence = cloneInert(stored.evidence);
      const closureId = requireOfficialApplication(input.officialApplication);
      const replayed = score(input, evidence, closureId);
      if (serialized(stored) !== row.request_json
        || serialized(result) !== row.result_json
        || evidence.sourceEventId !== row.source_event_id
        || input.scoringApplicationId !== row.scoring_application_id
        || input.sourceEventId !== row.source_event_id
        || input.officialApplication.matchId !== row.match_id
        || input.officialApplication.applicationId
          !== row.official_application_id
        || closureId !== row.closure_id
        || serialized(replayed) !== row.result_json) {
        throw new Error('durable official scoring row mismatch');
      }
      return { input, result };
    } catch (cause) {
      throw new Error('corrupt durable official scoring application', { cause });
    }
  };
  let closed = false;
  const api: SqliteOfficialScoringStore = Object.freeze({
    apply(rawInput): PersistedOfficialScoring {
      if (closed) throw new Error('official scoring store is closed');
      const input = cloneInert(rawInput);
      if (!input || !id(input.scoringApplicationId)
        || !id(input.sourceEventId)) {
        throw new Error('invalid official scoring application');
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        const prior = scoringRow(input.scoringApplicationId);
        if (prior) {
          const decoded = decode(prior);
          if (serialized(decoded.input) !== serialized(input)) {
            throw new Error('scoringApplicationId was used for different input');
          }
          db.exec('COMMIT');
          return decoded.result;
        }
        const closureId = requireOfficialApplication(input.officialApplication);
        const evidence = acceptedEvidence(input.sourceEventId);
        const result = score(input, evidence, closureId);
        const requestJson = serialized({ input, evidence });
        const resultJson = serialized(result);
        db.prepare(`INSERT INTO official_scoring_applications
          (scoring_application_id, match_id, official_application_id,
           closure_id, source_event_id, request_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
          input.scoringApplicationId, result.matchId,
          result.officialApplicationId, closureId,
          input.sourceEventId, requestJson, resultJson);
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    readApplication(applicationId): PersistedOfficialScoring | null {
      if (closed) throw new Error('official scoring store is closed');
      if (!id(applicationId)) throw new Error('invalid scoringApplicationId');
      const row = scoringRow(applicationId);
      return row ? decode(row).result : null;
    },
    close(): void {
      if (!closed) db.close();
      closed = true;
    },
  });
  return api;
};
