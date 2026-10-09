import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withBattedWorldPhysicalReadTraversal } from './SqliteBattedWorldFieldExecutionStore';
import { readSamePaTerminalSettlementFromSqlite, readSamePaTerminalReleaseFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { readSamePaTerminalReleaseArchive } from './SamePlateAppearanceTerminalReleaseArchive';

type Db = Pick<DatabaseSync, 'prepare'>;
type Admission = { reference: SamePaReference<'pa_settlement_v1_plans'>; playerId: string; marker: string };
const admissions = new WeakMap<DatabaseSync, Admission>();
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
/** False retains the ordinary fence. Historical records are always inspected
 * before this helper is called; a release never excuses corrupt raw lineage. */
export const samePaPlayerClaimCanProceed = (db: Db, enrollmentSourceId: string,
  scope: Readonly<{ careerId: string; playerId: string }>): boolean => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const admission = db instanceof Native ? admissions.get(db) : undefined;
  if (db instanceof Native && admission && admission.playerId === scope.playerId) {
    if (!db.isTransaction) throw new Error('same-PA settlement write transaction disappeared');
    // Releasing/recreating the marker detects transaction replacement even if
    // row counters and query_only were restored by an adversarial callback.
    db.exec('RELEASE ' + admission.marker); db.exec('SAVEPOINT ' + admission.marker);
    const settled = withBattedWorldPhysicalReadTraversal(db, () => readSamePaTerminalSettlementFromSqlite(db, admission.reference));
    const participant = settled.participants.find(p => p.playerId === scope.playerId);
    if (settled.plan.enrollmentReference.sourceId === enrollmentSourceId && settled.plan.lineage.careerId === scope.careerId
      && participant && json(participant.activity) === json(scope)) return true;
  }
  if (!readSamePaTerminalReleaseArchive(db, enrollmentSourceId)) return false;
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('same-PA release claim requires owned Native transaction');
  const released = withBattedWorldPhysicalReadTraversal(db, () => readSamePaTerminalReleaseFromSqlite(db, enrollmentSourceId));
  return !!released && released.memberRows.some(p => p.career_id === scope.careerId && p.player_id === scope.playerId);
};
