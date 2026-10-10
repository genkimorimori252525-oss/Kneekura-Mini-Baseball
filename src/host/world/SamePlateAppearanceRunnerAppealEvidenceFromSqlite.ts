import type { DatabaseSync } from 'node:sqlite';
import type { ActualFairCatchRunnerAppealEvidence } from '../../core/rules/FairCatchRunnerOutcome';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaLiveBallHistoryFromSqlite } from './SamePlateAppearanceLiveBallStateFromSqlite';
import { readSamePaVenueLegalCoverageFromPair } from './SamePlateAppearanceVenueLegalCoverage';
import { deriveSamePaLiveAppealRights } from './SamePlateAppearanceLiveAppealRights';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Every receipt refers to the earlier, immutable execution view. Rights are
 * evaluated at that original occurrence; the later end never repairs it. The
 * recursive historical read strictly precedes this receipt in the prefix. */
export const readSamePaRunnerAppealEvidenceFromSqlite = (db: DatabaseSync,
  fields: readonly (SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep)[], through: number):
  Readonly<{ kind: 'ready'; appeals: readonly ActualFairCatchRunnerAppealEvidence[] }> | Readonly<{ kind: 'pending'; reason: string }> => {
  const appeals: ActualFairCatchRunnerAppealEvidence[] = [];
  for (const receipt of fields) {
    if (receipt.kind !== 'same_pa_physical_field_step_v1' || receipt.actionResult?.kind !== 'appeal_contact_v1'
      || receipt.actionResult.execution.kind !== 'executed') continue;
    const execution = receipt.actionResult.execution, view = receipt.source.viewReference;
    const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, view, 'historical');
    if (pair.kind !== 'same_pa_field_rule_read_pair_v1') return freeze({ kind: 'pending', reason: 'original_live_appeal_legal_prefix_required' });
    const venue = readSamePaVenueLegalCoverageFromPair(pair);
    if (venue.kind === 'pending') return venue;
    const rights = deriveSamePaLiveAppealRights(pair, readSamePaLiveBallHistoryFromSqlite(db, view, 'historical'), venue, receipt);
    if (rights.kind === 'pending') return rights;
    appeals.push({ executionReference: reference('pa_physical_v1_field_steps', receipt), attempt: execution.attempt,
      complianceEvidence: execution.complianceEvidence,
      clock: { originTick: execution.moment.originTick, ticksPerSecond: pair.value.evidence.physical.field.evidence.ticksPerSecond },
      indicatedAtElapsedSeconds: execution.indicatedAt.elapsedSeconds, executedAtElapsedSeconds: execution.moment.elapsedSeconds,
      evaluatedThroughElapsedSeconds: through, evidence: rights.evidence });
  }
  return freeze({ kind: 'ready', appeals });
};
