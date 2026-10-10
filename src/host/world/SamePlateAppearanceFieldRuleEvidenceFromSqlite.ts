import { deriveSamePaOccupiedRunnerTagUp } from './SamePlateAppearanceOccupiedRunnerTagUp';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readSamePaOccupiedRunnerHolds } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { deriveSamePaStationaryOccupiedRunners } from './SamePlateAppearanceStationaryOccupiedRunners';
import type { DatabaseSync } from 'node:sqlite';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalOperationReference } from './SamePlateAppearancePhysicalEpisode';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
import { deriveSamePaFairCatchRuleBasis } from './SamePlateAppearanceFairCatchRuleBasis';
import type { ActualFairCatchOccupiedRunnerEvidence } from '../../core/rules/FairCatchRunnerOutcome';
import { readSamePaRunnerAppealEvidenceFromSqlite } from './SamePlateAppearanceRunnerAppealEvidenceFromSqlite';
/** Native read-only bridge. Historical reads replay the selected immutable cut;
 * current reads additionally require its complete live work/actual-head census.
 * The caller supplies only an owned view reference, never physical/rule values. */
export const readSamePaFieldRuleEvidenceWithInputsFromSqlite = (db: DatabaseSync,
  raw: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current' | 'historical') => withSamePaLifecycleReadPhase(db, () => {
  const viewReference = cloneInert(raw);
  if (!samePaReferenceValid(viewReference, 'pa_lifecycle_v1_execution_views') || !['current', 'historical'].includes(mode)) throw new Error('invalid same-PA field-rule view request');
  const basis = (mode === 'current' ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, viewReference);
  const { view, actor } = basis, cut = view.cut;
  if (cut.stage !== 'field_active' || cut.timeline.status.kind !== 'batted_ball_pending' || cut.outcomeReference || cut.resetReference)
    return freeze({ kind: 'pending' as const, reason: 'owned_active_field_cut_required' as const });
  const participants = readSamePaOriginalParticipants(db, actor), occupiedRunnerIds = participants.filter(p => p.role === 'runner').map(p => p.binding.playerId);
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix' || json(reference('pa_lifecycle_v1_work_prefixes', prefix)) !== json(view.source.prefixReference)) throw new Error('same-PA field-rule complete lifecycle prefix missing');
  const fields: (SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep)[] = [];
  for (const ref of prefix.source.eventReferences) {
    if (ref.owner !== 'pa_physical_v1_field_roots' && ref.owner !== 'pa_physical_v1_field_steps') continue;
    const op = readSamePaPhysicalOperationFromSqlite(db, ref as SamePaPhysicalOperationReference);
    if (json(op.physicalPitchReference) !== json(cut.physicalPitchReference)) continue;
    if (json(op.lineage) !== json(view.lineage) || op.record.kind !== 'same_pa_physical_field_root_v1' && op.record.kind !== 'same_pa_physical_field_step_v1') throw new Error('same-PA field-rule original physical lineage differs');
    fields.push(op.record);
  }
  const last = fields.at(-1);
  if (!last || json(reference(last.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', last)) !== json(cut.physicalOperationReference)
    || last.evaluationTick !== cut.evaluationTick || new Set(participants.map(p => p.binding.playerId)).size !== view.participants.length) throw new Error('same-PA field-rule exact endpoint coverage differs');
  const evidence = deriveSamePaFieldRuleEvidence({ fields, batterRunnerId: actor.binding.playerId,
    defenderIds: actor.defenderBindings.map(d => d.playerId), outsAtStart: actor.match.outs,
    ...(occupiedRunnerIds.length ? { occupiedRunnerIds } : {}) });
  // The accepted view owns all three inputs in this one read phase. An eventual
  // official/end adapter must not replace the original Match or contact timeline
  // with a caller payload or the later Match head.
  const root = fields[0];
  if (root.kind !== 'same_pa_physical_field_root_v1') throw new Error('same-PA field-rule original root missing');
  const contact = readSamePaPhysicalOperationFromSqlite(db, root.source.resolutionReference);
  if (contact.record.kind !== 'same_pa_physical_resolution_v1'
    || json(contact.physicalPitchReference) !== json(cut.physicalPitchReference)
    || json(contact.lineage) !== json(view.lineage)) throw new Error('same-PA field-rule original contact resolution differs');
  const originalMatch = actor.match, originalTimeline = contact.record.timeline;
  const occupied = occupiedRunnerIds.length ? (() => {
    const posture = readBattingPerceptionFromSqlite(db, 'posture', root.source.postureReference);
    if (posture.kind !== 'batting_invocation_posture') throw new Error('occupied rule original posture missing');
    const holds = readSamePaOccupiedRunnerHolds(db, actor, root.lineage.enrollmentReference, posture.source.occupiedRunnerHoldReferences,
      root.response.world.flight.initialBall.tick, last.evaluationTick);
    return { stationary: deriveSamePaStationaryOccupiedRunners({ match: originalMatch, root, holds, evidence }),
      ...(evidence.occupiedRunnerBaseContacts ? { tagUp: deriveSamePaOccupiedRunnerTagUp({ match: originalMatch, root, holds, evidence, fields }) } : {}) };
  })() : undefined;
  const occupiedRunners = occupied?.stationary;
  const appeals = occupied?.tagUp ? readSamePaRunnerAppealEvidenceFromSqlite(db, fields, evidence.physical.field.evidence.horizon.elapsedSeconds) : undefined;
  const occupiedRunnerEvidence: ActualFairCatchOccupiedRunnerEvidence | undefined = occupied?.tagUp && evidence.occupiedRunnerBaseContacts
    ? { kind: 'same_pa_occupied_fair_catch_runner_evidence_v1', runners: occupied.tagUp.runners.map(r => ({ playerId: r.playerId,
      startingBase: r.startingBase, holdReference: r.holdReference,
      bases: evidence.occupiedRunnerBaseContacts!.find(h => h.playerId === r.playerId)!.bases })),
      ...(appeals?.kind === 'ready' && appeals.appeals.length ? { appeals: appeals.appeals } : {}) } : undefined;
  const fairCatch = appeals?.kind === 'pending' ? appeals
    : occupiedRunnerEvidence ? deriveSamePaFairCatchRuleBasis({ originalMatch, originalTimeline, evidence, occupiedRunnerEvidence })
      : occupiedRunners?.kind === 'pending' ? occupiedRunners
        : deriveSamePaFairCatchRuleBasis({ originalMatch, originalTimeline, evidence, ...(occupiedRunners ? { occupiedRunners } : {}) });
  const value = freeze({ kind: 'same_pa_field_rule_evidence_v1' as const, viewReference, lineage: view.lineage, coverageHash: view.coverageHash,
    physicalPitchReference: cut.physicalPitchReference, physicalOperationReference: cut.physicalOperationReference,
    fieldReferences: fields.map(f => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f)),
    evidenceHash: hash(evidence), evidence, originalMatch, originalTimeline,
    contactReference: root.source.resolutionReference, fairCatch, ...(occupiedRunners ? { occupiedRunners } : {}),
    ...(occupiedRunnerEvidence ? { occupiedRunnerEvidence } : {}),
    ...(occupied?.tagUp ? { occupiedRunnerTagUp: occupied.tagUp } : {}) });
  return Object.freeze({ kind: 'same_pa_field_rule_read_pair_v1' as const, value,
    fields: Object.freeze(fields), actor, view });
});
/** Public evidence shape stays unchanged. The paired reader is an immediate
 * same-snapshot dependency seam, never an accepted caller-supplied receipt. */
export const readSamePaFieldRuleEvidenceFromSqlite = (db: DatabaseSync,
  raw: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current' | 'historical') => {
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, raw, mode);
  return pair.kind === 'same_pa_field_rule_read_pair_v1' ? pair.value : pair;
};
