import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordUnresolvedCorrectRuleSnapshot,
  recordOwnedLiveCallImport, type CorrectRuleEvidenceSnapshot, type OwnedLiveCallImportInput } from '../../core/adjudication/PlayAdjudicationLedger';
import type { RuleProfile } from '../../core/rules/RuleProfile';
import type { PlayEndFact } from '../../core/rules/PhysicalRuleFacts';
import type { ActualObservationMoment } from './ActualFieldObservation';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type ActualLiveAdjudicationProjectionInput = Readonly<{
  sourceId: string; playId: number; ruleProfile: RuleProfile; playEnd: PlayEndFact; recordedAt: ActualObservationMoment;
  snapshots: readonly CorrectRuleEvidenceSnapshot[]; call: OwnedLiveCallImportInput | null;
  /** Derived by the Native reader from original empty bases, grounded ball and first-base participation. */
  appealApplicability?: 'no_supported_tag_up_appeal';
}>;
/** Projection only. Native owns all facts and the accepted profile, never a caller-provided ruling. */
export const projectActualLiveAdjudication = (raw: ActualLiveAdjudicationProjectionInput) => {
  const input = cloneInert(raw), at = input.recordedAt;
  if (!input.sourceId || !input.snapshots.length || at.tick !== input.playEnd.tick
    || input.call && (input.call.tick !== at.tick || input.call.provenance.importedAtElapsedSeconds !== at.elapsedSeconds
      || input.call.provenance.clock.originTick !== at.originTick)) throw new Error('actual adjudication recording boundary differs');
  let ledger = createPlayAdjudicationLedger({ playId: input.playId, ruleProfileId: input.ruleProfile.id, playEnd: input.playEnd });
  for (const snapshot of input.snapshots) {
    const common = { eventId: `${input.sourceId}:rule:${snapshot.snapshotId}`, tick: at.tick, snapshotId: snapshot.snapshotId,
      evidenceRevision: snapshot.evidenceRevision };
    ledger = 'ruling' in snapshot ? recordCorrectRuleSnapshot(ledger, ledger.revision, { ...common, ruling: snapshot.ruling })
      : recordUnresolvedCorrectRuleSnapshot(ledger, ledger.revision, { ...common, reason: snapshot.reason });
  }
  if (input.call) ledger = recordOwnedLiveCallImport(ledger, ledger.revision, input.call);
  const pendingReasons: string[] = [];
  if (!input.call) pendingReasons.push('on_field_call_unavailable');
  else {
    const latest = input.snapshots.at(-1)!;
    if (input.call.call.basisSnapshotId !== latest.snapshotId || input.call.call.basisEvidenceRevision !== latest.evidenceRevision) pendingReasons.push('on_field_call_stale');
  }
  if (input.appealApplicability !== 'no_supported_tag_up_appeal') pendingReasons.push('official_window_applicability_unowned');
  for (const kind of ['appeal', 'review', 'challenge'] as const) {
    const policy = input.ruleProfile.officialWindows?.[kind];
    if (!policy) pendingReasons.push(`official_window_policy_unconfigured:${kind}`);
    else if (policy.available && kind !== 'appeal') pendingReasons.push(`official_window_owner_unavailable:${kind}`);
  }
  return freeze({ kind: pendingReasons.length ? 'official_pending' as const : 'official_ready' as const, ledger, pendingReasons });
};
