import type { DatabaseSync } from 'node:sqlite';
import type { ReservedSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollment';
import { samePaFields, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaTerminalTransitionProof } from './SamePlateAppearanceTerminalEndpoint';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertSamePaSettlementStorage, readSamePaSettlementPlanRow, samePaSettlementMetadataIdentity as claim } from './SamePlateAppearanceTerminalSettlementStorage';
import type { SamePaReleasedClaimCensus } from './SamePlateAppearanceReleasedClaimCensus';

type Db = Pick<DatabaseSync, 'prepare'>;
export type SamePaReleasedMemberRow = Readonly<{
  enrollment_source_id: string; career_id: string; player_id: string; baseline_source_id: string;
  revision: number; state_hash: string; member_json: string;
}>;
export type SamePaTerminalRelease = Readonly<{
  kind: 'same_pa_terminal_release_v1'; settlementReference: SamePaReference<'pa_settlement_v1_plans'>;
  enrollmentReference: SamePaReference<'same_pa_enrollments'>;
  terminalReference: SamePaReference<'pa_terminal_v1_endpoints'>;
  transitionReference: SamePaTerminalTransitionProof['reference'];
  memberRows: readonly SamePaReleasedMemberRow[];
  claimCensus: SamePaReleasedClaimCensus;
}>;
export const samePaTerminalReleaseRow = (value: SamePaTerminalRelease) => ({
  settlement_source_id: value.settlementReference.sourceId, enrollment_source_id: value.enrollmentReference.sourceId,
  terminal_source_id: value.terminalReference.sourceId, snapshot_json: json(value), snapshot_hash: hash(value),
});
/** Structural archive lookup only. This does not authorize any current writer;
 * the release evidence reader separately proves the terminal transition and all
 * ten actual effects. Keeping this lookup below historical enrollment avoids a
 * completion -> settlement -> enrollment -> completion recursion. */
export const readSamePaTerminalReleaseArchive = (db: Db, enrollmentId: string): SamePaTerminalRelease | null => {
  if (!assertSamePaSettlementStorage(db)) return null;
  const rows = db.prepare(`SELECT * FROM main.pa_settlement_v1_releases WHERE enrollment_source_id=$id
    OR ${claim('snapshot_json', ['enrollmentReference', 'sourceId'], '$id')}`).all({ id: enrollmentId });
  if (!rows.length) return null;
  if (rows.length !== 1 || rows[0].enrollment_source_id !== enrollmentId) throw new Error('same-PA release enrollment alias differs');
  const value = JSON.parse(String(rows[0].snapshot_json)) as SamePaTerminalRelease;
  if (!samePaFields(value, ['kind', 'settlementReference', 'enrollmentReference', 'terminalReference', 'transitionReference', 'memberRows', 'claimCensus'])
    || !samePaReferenceValid(value.settlementReference, 'pa_settlement_v1_plans')
    || !samePaReferenceValid(value.enrollmentReference, 'same_pa_enrollments')
    || !samePaReferenceValid(value.terminalReference, 'pa_terminal_v1_endpoints')
    || !samePaReferenceValid(value.transitionReference, 'pa_terminal_v1_transitions') || !Array.isArray(value.memberRows)
    || !Array.isArray(value.claimCensus) || value.claimCensus.some(c => !samePaFields(c, ['table', 'rowHash'])
      || typeof c.table !== 'string' || !/^[a-z][a-z_0-9]*$/.test(c.table) || typeof c.rowHash !== 'string' || !/^[a-f0-9]{64}$/.test(c.rowHash))) throw new Error('invalid same-PA release archive');
  const plan = readSamePaSettlementPlanRow(db, value.settlementReference.sourceId);
  if (!plan || value.kind !== 'same_pa_terminal_release_v1'
    || json(value.settlementReference) !== json({ owner: 'pa_settlement_v1_plans', sourceId: plan.source.sourceId, sourceHash: hash(plan.source), snapshotHash: hash(plan) })
    || json(value.enrollmentReference) !== json(plan.enrollmentReference) || json(value.terminalReference) !== json(plan.source.terminalReference)
    || json(rows[0]) !== json(samePaTerminalReleaseRow(value))) throw new Error('same-PA release archive differs');
  const aliases = db.prepare(`SELECT enrollment_source_id FROM main.pa_settlement_v1_releases WHERE settlement_source_id=$settlement
    OR terminal_source_id=$terminal OR ${claim('snapshot_json', ['settlementReference', 'sourceId'], '$settlement')}
    OR ${claim('snapshot_json', ['terminalReference', 'sourceId'], '$terminal')}`).all({ settlement: plan.source.sourceId, terminal: plan.source.terminalReference.sourceId });
  if (aliases.length !== 1 || aliases[0].enrollment_source_id !== enrollmentId) throw new Error('same-PA release settlement ownership differs');
  return value;
};
export const samePaOriginalMemberRows = (value: ReservedSamePlateAppearanceEnrollment): readonly SamePaReleasedMemberRow[] => value.participants.map(p => ({
  enrollment_source_id: value.source.sourceId, career_id: value.careerId, player_id: p.binding.playerId,
  baseline_source_id: p.baselineSourceId, revision: p.state.revision, state_hash: hash(p.state), member_json: json({
    enrollmentSourceId: value.source.sourceId, careerId: value.careerId, playerId: p.binding.playerId,
    baselineSourceId: p.baselineSourceId, revision: p.state.revision, stateHash: hash(p.state),
    baselineSourceHash: p.baselineSourceHash, bindingHash: hash(p.binding), personHash: p.personHash,
  }),
}));
export const readSamePaReleasedMembers = (db: Db, enrollment: ReservedSamePlateAppearanceEnrollment): readonly SamePaReleasedMemberRow[] | null => {
  const release = readSamePaTerminalReleaseArchive(db, enrollment.source.sourceId);
  if (!release) return null;
  if (json(release.enrollmentReference) !== json({ owner: 'same_pa_enrollments', sourceId: enrollment.source.sourceId,
    sourceHash: hash(enrollment.source), snapshotHash: hash(enrollment) })
    || json(release.memberRows) !== json(samePaOriginalMemberRows(enrollment))) throw new Error('same-PA released original member archive differs');
  return release.memberRows;
};
