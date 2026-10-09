import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { advancePlayerWorkloadRecovery } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertArchivedPlayerWorkloadActivity } from './SqlitePlayerWorkloadRecoveryStore';
import { authenticateSamePaRow, samePaEnrollmentRow } from './SamePlateAppearanceReservationGuard';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readSamePaTerminalEndpointFromSqlite } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { readSamePaTerminalTransitionFromSqlite } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { readSamePaReleasedMembers, readSamePaTerminalReleaseArchive, type SamePaTerminalRelease } from './SamePlateAppearanceTerminalReleaseArchive';
import { readSamePaSettlementPlanRow, samePaSettlementMetadataIdentity as claim } from './SamePlateAppearanceTerminalSettlementStorage';
import { samePaTerminalSettlementInput, type AcceptedSamePaTerminalSettlement, type SamePaTerminalSettlementPlan, type SamePaTerminalSettlement } from './SamePlateAppearanceTerminalSettlement';
import { readSamePaReleasedClaimCensus } from './SamePlateAppearanceReleasedClaimCensus';

const same = (a: unknown, b: unknown, detail: string) => { if (json(a) !== json(b)) throw new Error('same-PA settlement ' + detail); };
const nativeRead = (db: DatabaseSync) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1) throw new Error('same-PA settlement requires an owned Native read proof');
};
export const samePaSettlementReference = (plan: SamePaTerminalSettlementPlan): SamePaReference<'pa_settlement_v1_plans'> => ({
  owner: 'pa_settlement_v1_plans', sourceId: plan.source.sourceId, sourceHash: hash(plan.source), snapshotHash: hash(plan),
});
export const deriveSamePaTerminalSettlementPlan = (db: DatabaseSync, raw: AcceptedSamePaTerminalSettlement,
  mode: 'current' | 'historical', endpointMode: 'current' | 'historical' = mode): SamePaTerminalSettlementPlan => {
  nativeRead(db);
  const source = samePaTerminalSettlementInput(raw);
  const endpoint = readSamePaTerminalEndpointFromSqlite(db, source.terminalReference, endpointMode);
  same(source.terminalReference, { owner: 'pa_terminal_v1_endpoints', sourceId: endpoint.source.sourceId, sourceHash: hash(endpoint.source), snapshotHash: hash(endpoint) }, 'terminal reference differs');
  const row = samePaEnrollmentRow(db, endpoint.enrollmentReference.sourceId);
  if (!row) throw new Error('same-PA settlement enrollment missing');
  const enrollment = authenticateSamePaRow(db, row);
  same(endpoint.enrollmentReference, { owner: 'same_pa_enrollments', sourceId: enrollment.source.sourceId, sourceHash: hash(enrollment.source), snapshotHash: hash(enrollment) }, 'enrollment reference differs');
  same(endpoint.lineage.enrollmentReference, endpoint.enrollmentReference, 'endpoint lineage differs');
  if (endpoint.lineage.careerId !== enrollment.careerId || endpoint.lineage.gameId !== enrollment.gameId || endpoint.lineage.playId !== enrollment.playId
    || endpoint.participants.length !== 10 || new Set(endpoint.participants.map(p => p.playerId)).size !== 10
    || new Set(endpoint.participants.map(p => p.activity.sourceEventId)).size !== 10
    || new Set(endpoint.participants.map(p => p.totalReference.sourceId)).size !== 10) throw new Error('same-PA settlement final ten-player membership differs');
  for (const participant of endpoint.participants) {
    const original = enrollment.participants.find(p => p.binding.playerId === participant.playerId);
    if (!original || participant.activity.kind !== 'MATCH' || participant.activity.careerId !== enrollment.careerId
      || participant.activity.playerId !== participant.playerId || participant.activity.atDay !== original.binding.gameDay
      || endpoint.gameDay !== original.binding.gameDay || participant.activity.sourceEventId !== 'actual-total-play-workload:' + hash([enrollment.careerId, enrollment.gameId, enrollment.playId, participant.playerId])) throw new Error('same-PA settlement activity scope differs');
    same(participant.reservedState, original.state, 'reserved BEFORE differs');
    same(participant.projectedState, advancePlayerWorkloadRecovery(original.state, original.state.revision, participant.activity), 'projected AFTER differs');
    same(participant.projectedStateHash, hash(participant.projectedState), 'projected AFTER hash differs');
    if (mode === 'current') same(readActualRoleWorkloadState(db, enrollment.careerId, participant.playerId, undefined, original.binding.personLinkSourceId), original.state, 'current BEFORE differs from reservation');
  }
  return freeze({ kind: 'terminal_settlement_plan', source, lineage: endpoint.lineage, enrollmentReference: endpoint.enrollmentReference,
    finalViewReference: endpoint.finalViewReference, coverageHash: endpoint.coverageHash, participants: endpoint.participants });
};
/** Historical final basis + actual normal activities. This reader deliberately
 * does not inspect the later transition/release, so a transition may require it. */
export const readSamePaTerminalSettlementFromSqlite = (db: DatabaseSync, reference: SamePaReference<'pa_settlement_v1_plans'>,
  endpointMode: 'current' | 'historical' = 'historical'): SamePaTerminalSettlement => {
  nativeRead(db);
  if (!samePaReferenceValid(reference, 'pa_settlement_v1_plans')) throw new Error('invalid same-PA settlement reference');
  const plan = readSamePaSettlementPlanRow(db, reference.sourceId);
  if (!plan) throw new Error('same-PA settlement plan missing');
  same(samePaSettlementReference(plan), reference, 'reference differs');
  same(deriveSamePaTerminalSettlementPlan(db, plan.source, 'historical', endpointMode), plan, 'final coverage or TOTAL basis changed');
  const enrollmentRow = samePaEnrollmentRow(db, plan.enrollmentReference.sourceId)!;
  const enrollment = authenticateSamePaRow(db, enrollmentRow);
  const participants = plan.participants.map(participant => {
    const rows = db.prepare(`SELECT * FROM main.world_player_workload_activities WHERE source_id=$id
      OR ${claim('source_json', ['sourceEventId'], '$id')}`).all({ id: participant.activity.sourceEventId });
    const original = enrollment.participants.find(p => p.binding.playerId === participant.playerId)!;
    if (!rows.length) {
      same(readActualRoleWorkloadState(db, plan.lineage.careerId, participant.playerId, undefined, original.binding.personLinkSourceId), participant.reservedState, 'unapplied reserved BEFORE changed');
      return { ...participant, applied: false };
    }
    if (rows.length !== 1) throw new Error('same-PA settlement activity alias differs');
    same(rows[0], { source_id: participant.activity.sourceEventId, career_id: plan.lineage.careerId, player_id: participant.playerId,
      before_revision: participant.reservedState.revision, after_revision: participant.projectedState.revision,
      source_json: json(participant.activity), before_json: json(participant.reservedState), after_json: json(participant.projectedState) }, 'durable effect differs from projected AFTER');
    assertArchivedPlayerWorkloadActivity(db, { activity: participant.activity, before: participant.reservedState, after: participant.projectedState });
    return { ...participant, applied: true };
  });
  return freeze({ kind: participants.every(p => p.applied) ? 'settled' : 'applying', reference, plan, participants });
};
export const readSamePaTerminalReleaseFromSqlite = (db: DatabaseSync, enrollmentSourceId: string): SamePaTerminalRelease | null => {
  nativeRead(db);
  const release = readSamePaTerminalReleaseArchive(db, enrollmentSourceId);
  if (!release) return null;
  same(readSamePaReleasedClaimCensus(db, enrollmentSourceId), release.claimCensus, 'released preparation/work claim census changed');
  const settled = readSamePaTerminalSettlementFromSqlite(db, release.settlementReference);
  if (settled.kind !== 'settled') throw new Error('same-PA release requires ten exact durable effects');
  const transition = readSamePaTerminalTransitionFromSqlite(db, release.terminalReference, 'historical');
  if (transition.kind !== 'completed') throw new Error('same-PA release transition is incomplete');
  same(transition.reference, release.transitionReference, 'release transition reference differs');
  same(transition.terminalReference, release.terminalReference, 'release terminal differs');
  same(transition.settlementReference, release.settlementReference, 'release settlement differs');
  if (transition.gameId !== settled.plan.lineage.gameId || transition.playId !== settled.plan.lineage.playId) throw new Error('same-PA release transition scope differs');
  const row = samePaEnrollmentRow(db, enrollmentSourceId);
  if (!row) throw new Error('same-PA release original enrollment missing');
  const enrollment = authenticateSamePaRow(db, row);
  readSamePaReleasedMembers(db, enrollment);
  if (db.prepare(`SELECT 1 FROM main.same_pa_participant_reservations WHERE enrollment_source_id=$id
    OR ${claim('member_json', ['enrollmentSourceId'], '$id')}`).get({ id: enrollmentSourceId })) throw new Error('same-PA release retains an active member lease');
  return freeze(release);
};
