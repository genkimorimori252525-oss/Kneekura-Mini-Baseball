import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readHistoricalSamePaLifecycleViewFromSqlite,
  readSamePaLifecycleRecordFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalOperationReference } from './SamePlateAppearancePhysicalEpisode';
import { deriveSamePaFieldRuleEvidence } from './SamePlateAppearanceFieldRuleEvidence';
/** Native read-only bridge. Historical reads replay the selected immutable cut;
 * current reads additionally require its complete live work/actual-head census.
 * The caller supplies only an owned view reference, never physical/rule values. */
export const readSamePaFieldRuleEvidenceFromSqlite = (db: DatabaseSync,
  raw: SamePaReference<'pa_lifecycle_v1_execution_views'>, mode: 'current' | 'historical') => withSamePaLifecycleReadPhase(db, () => {
  const viewReference = cloneInert(raw);
  if (!samePaReferenceValid(viewReference, 'pa_lifecycle_v1_execution_views') || !['current', 'historical'].includes(mode)) throw new Error('invalid same-PA field-rule view request');
  const basis = (mode === 'current' ? readCurrentSamePaLifecycleViewFromSqlite : readHistoricalSamePaLifecycleViewFromSqlite)(db, viewReference);
  const { view, actor } = basis, cut = view.cut;
  if (cut.stage !== 'field_active' || cut.timeline.status.kind !== 'batted_ball_pending' || cut.outcomeReference || cut.resetReference)
    return freeze({ kind: 'pending' as const, reason: 'owned_active_field_cut_required' as const });
  if (Object.values(actor.match.bases).some(runner => runner !== null)) return freeze({ kind: 'pending' as const, reason: 'field_rule_nonempty_base_participation_unowned' as const });
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
    || last.evaluationTick !== cut.evaluationTick || new Set([actor.binding.playerId, ...actor.defenderBindings.map(d => d.playerId)]).size !== 10) throw new Error('same-PA field-rule exact endpoint coverage differs');
  const evidence = deriveSamePaFieldRuleEvidence({ fields, batterRunnerId: actor.binding.playerId,
    defenderIds: actor.defenderBindings.map(d => d.playerId), outsAtStart: actor.match.outs });
  return freeze({ kind: 'same_pa_field_rule_evidence_v1' as const, viewReference, lineage: view.lineage, coverageHash: view.coverageHash,
    physicalPitchReference: cut.physicalPitchReference, physicalOperationReference: cut.physicalOperationReference,
    fieldReferences: fields.map(f => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f)),
    evidenceHash: hash(evidence), evidence });
});
