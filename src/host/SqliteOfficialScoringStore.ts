import { createRequire } from 'node:module';
import type { PersistOfficialFinalInput, PersistOfficialPlayInput } from './SqliteOfficialStateStore';
import type { OfficialFairBallScoringEvidence, OfficialCaughtFoulScoringEvidence, SupportedOfficialScoringRecord } from '../core/adjudication/OfficialScoring';
import type { SqliteEvidenceGuard } from './SqliteEvidenceGuard';
import { createSqliteOfficialScoringWriter } from './SqliteOfficialScoringWriter';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
type OfficialInput = PersistOfficialPlayInput | PersistOfficialFinalInput;
export type PersistOfficialScoringInput = Readonly<{
  scoringApplicationId: string;
  officialApplication: Extract<OfficialInput, { kind: 'live_ball' }>;
  /** Omit only for a deterministic caught-foul out. Fair balls require scorer evidence. */
  sourceEventId?: string;
}> | Readonly<{
  scoringApplicationId: string;
  officialApplication: Extract<OfficialInput, { kind: 'non_live' }>;
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
  /** Additive completed-game assessment; existing play scoring archives stay immutable. */
  readAcceptedPitchingRunJudgment?(sourceEventId: string):
    import('../core/world/competition/OfficialPitchingRunResponsibility').OfficialPitchingRunJudgment | null;
  readAcceptedOfficialScoringEvidence(sourceEventId: string):
    AcceptedOfficialScoringEvidence | null;
}>;
/** Physical rule sidecar from an independently authenticated closed catch owner.
 * Its original end and complete timeline are rechecked by the shared classifier. */
export type OfficialFairCatchScoringEvidence = Readonly<{ schemaVersion: 1; sourceKind: 'owned_fair_catch'; sourceEventId: string;
  physical: import('../core/adjudication/ActualFairCatchScoring').ActualFairCatchScoringInput }>;
export type OfficialGroundOutScoringEvidence = Readonly<{ schemaVersion: 1; sourceKind: 'owned_ground_out'; sourceEventId: string;
  ground: import('../core/adjudication/ActualGroundOutScoring').ActualGroundOutScoringInput }>;
export type AcceptedOfficialScoringEvidence = OfficialFairBallScoringEvidence | OfficialCaughtFoulScoringEvidence | OfficialFairCatchScoringEvidence | OfficialGroundOutScoringEvidence;
export type AcceptedScoredOfficialPlay = Readonly<{
  scoring: PersistedOfficialScoring;
  application: OfficialInput;
}>;
export type SqliteOfficialScoringStore = Readonly<{
  apply(input: PersistOfficialScoringInput): PersistedOfficialScoring;
  readApplication(scoringApplicationId: string): PersistedOfficialScoring | null;
  readAcceptedPlay(scoringApplicationId: string): AcceptedScoredOfficialPlay | null;
  close(): void;
}>;


const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
/** Persists scoring after a durable official closure, without changing MatchState. */
export const openSqliteOfficialScoringStore = (
  databasePath: string,
  authority?: AcceptedOfficialScoringEvidenceAuthority,
  evidenceGuard?: SqliteEvidenceGuard<OfficialInput>,
): SqliteOfficialScoringStore => {
  if (!id(databasePath)) throw new Error('invalid official scoring database path');
  if (evidenceGuard !== undefined && typeof evidenceGuard !== 'function') throw new Error('invalid official scoring evidence guard');
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
  const writer = createSqliteOfficialScoringWriter(db,authority,evidenceGuard);
  let closed = false;
  const check = () => { if (closed) throw new Error('official scoring store is closed'); };
  return Object.freeze({
    apply(input) {
      check(); db.exec('BEGIN IMMEDIATE');
      try { const result = writer.apply(input); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    readApplication(applicationId) { check(); return writer.readApplication(applicationId); },
    readAcceptedPlay(applicationId) { check(); return writer.readAcceptedPlay(applicationId); },
    close() { if (!closed) db.close(); closed = true; },
  });
};
