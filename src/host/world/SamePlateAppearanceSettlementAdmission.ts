import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { readSamePaTerminalSettlementFromSqlite, readSamePaTerminalReleaseFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { readSamePaTerminalReleaseArchive } from './SamePlateAppearanceTerminalReleaseArchive';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { memoSamePaContinuationRead } from './SamePlateAppearanceContinuationFromSqlite';

type Db = Pick<DatabaseSync, 'prepare'>;
type Admission = { reference: SamePaReference<'pa_settlement_v1_plans'>; playerId: string; marker: string; claimPhase?: string };
const admissions = new WeakMap<DatabaseSync, Admission>();
// Only an assertion identity lives here. Completed proofs remain in the
// existing Native continuation phase and cannot be reused by another assertion.
const claimPhases = new WeakMap<DatabaseSync, string>();
const validateAdmissionTransaction = (db: DatabaseSync, admission: Admission) => {
  if (!db.isTransaction) throw new Error('same-PA settlement write transaction disappeared');
  // This must run before child read savepoints exist: RELEASE also removes
  // every nested savepoint. Counters alone cannot detect rollback/rebegin.
  db.exec('RELEASE ' + admission.marker); db.exec('SAVEPOINT ' + admission.marker);
};
/** The only temporary write exemption derives the exact activity from a real
 * frozen terminal plan on the same Native transaction. No Source can supply a
 * trusted snapshot, callback, released flag, or an enrollment exemption. */
export const withSamePaSettlementActivityWrite = <T>(db: DatabaseSync,
  reference: SamePaReference<'pa_settlement_v1_plans'>, playerId: string, body: () => T): T => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction || admissions.has(db)) throw new Error('same-PA settlement write scope differs');
  const marker = 'pa_settlement_activity_' + randomUUID().replaceAll('-', '');
  db.exec('SAVEPOINT ' + marker);
  const state = withBattedWorldPhysicalReadTraversal(db, () => readSamePaTerminalSettlementFromSqlite(db, reference));
  if (!state.participants.some(p => p.playerId === playerId)) throw new Error('same-PA settlement participant missing');
  admissions.set(db, { reference, playerId, marker });
  try { const value = body(); db.exec('RELEASE ' + marker); return value; }
  finally { admissions.delete(db); }
};
/** Only one reservation assertion owns this immutable phase. Its raw censuses,
 * roots and members still run, but may share completed settlement/release proofs.
 * The phase ends before every accepted callback, workload write and retry. */
export const withSamePaSettlementClaimReadPhase = <T>(db: Db,
  scope: Readonly<{ careerId: string; playerId: string }>, body: () => T): T => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native)) return body();
  const active = admissions.get(db), admission = active?.playerId === scope.playerId ? active : undefined;
  if (claimPhases.has(db)) throw new Error('same-PA settlement claim phase already active');
  // A matching write admission must be checked before any child savepoints.
  // Ordinary read-only callers without a transaction retain their raw guards.
  if (admission) validateAdmissionTransaction(db, admission);
  if (!db.isTransaction) return body();
  const phase = 'settlement-claim:' + randomUUID();
  claimPhases.set(db, phase);
  if (admission) admission.claimPhase = phase;
  try { return withBattedWorldPhysicalReadTraversal(db, () => withSamePaLifecycleReadPhase(db, body)); }
  finally { if (admission) delete admission.claimPhase; claimPhases.delete(db); }
};
/** False retains the ordinary fence. Historical records are always inspected
 * before this helper is called; a release never excuses corrupt raw lineage. */
export const samePaPlayerClaimCanProceed = (db: Db, enrollmentSourceId: string,
  scope: Readonly<{ careerId: string; playerId: string }>): boolean => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const admission = db instanceof Native ? admissions.get(db) : undefined;
  if (db instanceof Native && admission && admission.playerId === scope.playerId) {
    const read = () => readSamePaTerminalSettlementFromSqlite(db, admission.reference, 'historical');
    const settled = admission.claimPhase
      ? memoSamePaContinuationRead(db, admission.claimPhase + ':' + json([admission.reference, 'historical']), read)
      : (validateAdmissionTransaction(db, admission), withBattedWorldPhysicalReadTraversal(db, read));
    const participant = settled.participants.find(p => p.playerId === scope.playerId);
    if (settled.plan.enrollmentReference.sourceId === enrollmentSourceId && settled.plan.lineage.careerId === scope.careerId
      && participant && json(participant.activity) === json(scope)) return true;
  }
  if (!readSamePaTerminalReleaseArchive(db, enrollmentSourceId)) return false;
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('same-PA release claim requires owned Native transaction');
  const read = () => withBattedWorldPhysicalReadTraversal(db, () => readSamePaTerminalReleaseFromSqlite(db, enrollmentSourceId));
  const phase = claimPhases.get(db);
  const released = phase ? memoSamePaContinuationRead(db, phase + ':release:' + json(enrollmentSourceId), read) : read();
  return !!released && released.memberRows.some(p => p.career_id === scope.careerId && p.player_id === scope.playerId);
};
