import { createHash } from 'node:crypto';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { cloneInert } from '../core/adjudication/OfficialWindowPolicy';
import { deriveClosedNonLiveMatchState } from
  '../core/adjudication/NonLiveOfficialApplication';
import { deriveClosedLiveBallMatchState,
  getOfficialPlayClosure } from
  '../core/adjudication/PlayAdjudicationLedger';
import { classifyClosedPlayForOfficialScoring,
  type OfficialFairBallScoringEvidence } from
  '../core/adjudication/OfficialScoring';
import type { PersistOfficialFinalInput,
  PersistOfficialPlayInput } from './SqliteOfficialStateStore';
import type { SqliteEvidenceGuard } from './SqliteEvidenceGuard';

import type { PersistOfficialScoringInput, PersistedOfficialScoring, AcceptedOfficialScoringEvidenceAuthority, AcceptedScoredOfficialPlay } from './SqliteOfficialScoringStore';
import { deriveOfficialPendingNonLiveResult, type PersistOfficialPendingNonLiveInput } from './OfficialPendingPostPlay';
import { foulTerminalScoringEvidenceFromSqlite, terminalScoringProof, terminalScoringRows } from './world/ActualFoulTerminalScoringEvidenceFromSqlite';
type OfficialInput = PersistOfficialPlayInput | PersistOfficialFinalInput;
const isTerminalPending = (input: unknown): input is PersistOfficialPendingNonLiveInput => !!input && typeof input === 'object' && 'mode' in input && input.mode === 'non_live_pending_post_play_v1';
const rejectTerminalPending = (input: unknown): void => { if (isTerminalPending(input)) throw new Error('terminal pending scoring requires its dedicated owner'); };

type OfficialApplicationRow = { match_id: string; closure_id: string;
  request_hash: string; result_json: string };
type ScoringRow = { scoring_application_id: string; match_id: string;
  official_application_id: string; closure_id: string;
  source_event_id: string; request_json: string; result_json: string };
type InternalInput = PersistOfficialScoringInput | Readonly<{ scoringApplicationId: string; officialApplication: PersistOfficialPendingNonLiveInput }>;
type StoredRequest = Readonly<{ input: InternalInput;
  evidence: OfficialFairBallScoringEvidence | null }>;

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
const officialHash = (input: InternalInput['officialApplication']): string =>
  hash(isTerminalPending(input) ? input : 'game' in input ? { kind: 'game_final', request: input } : input);
const scoringSourceId = (input: InternalInput): string =>
  input.officialApplication.kind === 'non_live'
    ? `official-non-live:${input.officialApplication.applicationId}`
    : 'sourceEventId' in input ? input.sourceEventId ?? ''
      : `official-foul-out:${input.officialApplication.applicationId}`;


/** Canonical scoring row writer on its caller-owned connection/transaction. */
export const createSqliteOfficialScoringWriter = (db: DatabaseSyncType,
  authority?: AcceptedOfficialScoringEvidenceAuthority, evidenceGuard?: SqliteEvidenceGuard<OfficialInput>) => {
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
    input: InternalInput['officialApplication'],
  ): string => {
    if (!isTerminalPending(input)) evidenceGuard?.(db, input, 'retry');
    if (!id(input.matchId) || !id(input.applicationId)) {
      throw new Error('official scoring requires an application');
    }
    const closure = getOfficialPlayClosure(input.adjudication);
    const row = officialRow(input.applicationId);
    if (!closure || !row || row.match_id !== input.matchId
      || row.closure_id !== closure.closureId
      || row.request_hash !== officialHash(input)) {
      throw new Error('scoring evidence does not match durable official application');
    }
    if (isTerminalPending(input)) {
      const expected = deriveOfficialPendingNonLiveResult(input,input.expectedDurableRevision + 1);
      if (serialized(expected) !== row.result_json) throw new Error('corrupt complete terminal pending official receipt');
      return closure.closureId;
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
        !== serialized(input.kind === 'live_ball'
          ? deriveClosedLiveBallMatchState(input.match,
            input.physicalTimeline, input.adjudication)
          : deriveClosedNonLiveMatchState({ match: input.match,
            timeline: input.timeline, adjudication: input.adjudication,
            context: input.context }))) {
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
  const score = (input: InternalInput,
    evidence: OfficialFairBallScoringEvidence | null,
    closureId: string): PersistedOfficialScoring => {
    const official = input.officialApplication;
    const result = official.kind === 'non_live'
      ? classifyClosedPlayForOfficialScoring({ kind: 'non_live',
        match: official.match, timeline: official.timeline,
        adjudication: official.adjudication, context: official.context })
      : classifyClosedPlayForOfficialScoring({ kind: 'live_ball',
        match: official.match, timeline: official.physicalTimeline,
        adjudication: official.adjudication,
        ...(evidence ? { scoringEvidence: evidence } : {}) });
    if (result.kind !== 'supported') {
      throw new Error('official scoring evidence remains unsupported');
    }
    return Object.freeze({
      scoringApplicationId: input.scoringApplicationId,
      matchId: official.matchId,
      officialApplicationId: official.applicationId,
      closureId,
      sourceEventId: scoringSourceId(input),
      record: result.record,
    });
  };
  const decode = (row: ScoringRow): { input: PersistOfficialScoringInput;
    result: PersistedOfficialScoring } => {
    try {
      const stored = JSON.parse(row.request_json) as StoredRequest;
      const result = JSON.parse(row.result_json) as PersistedOfficialScoring;
      const input = stored.input;
      rejectTerminalPending(input.officialApplication);
      // Acceptance is checked at first apply. The accepted snapshot is
      // durable so read/retry never depends on the source process.
      const evidence = cloneInert(stored.evidence);
      const closureId = requireOfficialApplication(input.officialApplication);
      const replayed = score(input, evidence, closureId);
      if (serialized(stored) !== row.request_json
        || serialized(result) !== row.result_json
        || ('sourceEventId' in input
          ? evidence?.sourceEventId !== row.source_event_id
          : evidence !== null)
        || (input.officialApplication.kind === 'non_live'
          && Object.hasOwn(input, 'sourceEventId'))
        || input.scoringApplicationId !== row.scoring_application_id
        || scoringSourceId(input) !== row.source_event_id
        || input.officialApplication.matchId !== row.match_id
        || input.officialApplication.applicationId
          !== row.official_application_id
        || closureId !== row.closure_id
        || serialized(replayed) !== row.result_json) {
        throw new Error('durable official scoring row mismatch');
      }
      return { input: input as PersistOfficialScoringInput, result };
    } catch (cause) {
      if (cause instanceof Error && cause.message === 'terminal pending scoring requires its dedicated owner') throw cause;
      throw new Error('corrupt durable official scoring application', { cause });
    }
  };
  const insert = (input: InternalInput, evidence: OfficialFairBallScoringEvidence | null, result: PersistedOfficialScoring) =>
    db.prepare(`INSERT INTO official_scoring_applications
      (scoring_application_id, match_id, official_application_id, closure_id, source_event_id, request_json, result_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(input.scoringApplicationId,result.matchId,result.officialApplicationId,
        result.closureId,result.sourceEventId,serialized({ input,evidence }),serialized(result));
  return Object.freeze({
    apply(rawInput: PersistOfficialScoringInput): PersistedOfficialScoring {
      const input = cloneInert(rawInput);
      rejectTerminalPending(input?.officialApplication);
      if (!input || !id(input.scoringApplicationId)
        || (input.officialApplication?.kind === 'non_live'
          ? Object.hasOwn(input, 'sourceEventId')
          : 'sourceEventId' in input && !id(input.sourceEventId))) {
        throw new Error('invalid official scoring application');
      }

        const prior = scoringRow(input.scoringApplicationId);
        if (prior) {
          const decoded = decode(prior);
          if (serialized(decoded.input) !== serialized(input)) {
            throw new Error('scoringApplicationId was used for different input');
          }
          return decoded.result;
        }
        const closureId = requireOfficialApplication(input.officialApplication);
        const evidence = 'sourceEventId' in input
          ? acceptedEvidence(scoringSourceId(input)) : null;
        const result = score(input, evidence, closureId);
        insert(input,evidence,result);
        evidenceGuard?.(db, input.officialApplication, 'written');
        return result;
    },
    readApplication(applicationId: string): PersistedOfficialScoring | null {
      if (!id(applicationId)) throw new Error('invalid scoringApplicationId');
      const row = scoringRow(applicationId);
      return row ? decode(row).result : null;
    },
    readAcceptedPlay(applicationId: string): AcceptedScoredOfficialPlay | null {
      if (!id(applicationId)) throw new Error('invalid scoringApplicationId');
      const row = scoringRow(applicationId);
      if (!row) return null;
      const decoded = decode(row);
      return Object.freeze({ scoring: cloneInert(decoded.result),
        application: cloneInert(decoded.input.officialApplication) });
    },
    readTerminal(sourceId: string): PersistedOfficialScoring | null {
      return terminalScoringProof(db,() => foulTerminalScoringEvidenceFromSqlite(db).prepare(sourceId)?.result ?? null);
    },
    applyTerminal(sourceId: string): { value: PersistedOfficialScoring; changes: 0 | 1 } {
      const owner = foulTerminalScoringEvidenceFromSqlite(db);
      const before = terminalScoringProof(db,() => {
        const source = owner.prepare(sourceId);
        if (!source) throw new Error('terminal scoring original Source is missing');
        return { source,pin:terminalScoringRows(db) };
      });
      if (before.source.result) return { value:before.source.result,changes:0 };
      const input = before.source.input;
      const closureId = requireOfficialApplication(input.officialApplication);
      const result = score(input,null,closureId);
      if (serialized(result) !== serialized(before.source.expected)) throw new Error('terminal scoring shared classifier differs');
      const changed = insert(input,null,result);
      if (changed.changes !== 1) throw new Error('terminal scoring INSERT row count differs');
      const after = terminalScoringProof(db,() => {
        const saved = owner.prepare(sourceId);
        if (!saved?.result || serialized(saved.result) !== serialized(result)) throw new Error('terminal scoring inserted receipt differs');
        const expected = before.pin.map(t => t.table === 'official_scoring_applications'
          ? { ...t,rows:[...t.rows,{ __terminal_scoring_rowid:changed.lastInsertRowid,...before.source.row }] } : t);
        if (serialized(terminalScoringRows(db)) !== serialized(expected)) throw new Error('terminal scoring immutable dependency or row identity changed');
        return saved.result;
      });
      return { value:after,changes:1 };
    },
  });
};
