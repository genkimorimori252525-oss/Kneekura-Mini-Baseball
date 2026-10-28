import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { TraitResult, TraitScope } from '../../core/world/traits/TraitTypes';
import { integer, obj, readScope, text } from '../../core/world/traits/TraitValidation';
import { classifyMeasuredTrait } from '../../core/world/traits/classifiers/MeasuredTraitClassifier';
import type { MeasuredTraitClassification, MeasurementModel } from '../../core/world/traits/classifiers/MeasuredTraitTypes';
import { projectSourceTraits } from '../../core/world/traits/sources/SourceTraitProjection';
import type { SourceTraitPolicy, SourceTraitProjection, SourceTraitReason, TraitSourceSnapshot } from '../../core/world/traits/sources/SourceTraitTypes';
import { readNativeBattingContactInventoryV188FromSqlite } from './NativeBattingContactInventoryV188';
import { readNativeBattingContactObservationSnapshotV189FromSqlite } from './SqliteNativeBattingContactObservationStoreV188';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

export type NativeBattingContactTraitProjectionRequestV189 = Readonly<{
  scope: TraitScope; classificationId: string; projectionId: string;
  /** Projection metadata supplied by the caller, never inferred from observation revision. */
  worldRevision: number; model: MeasurementModel | null; policy: SourceTraitPolicy | null;
}>;
type UnavailableReason = SourceTraitReason | 'INSUFFICIENT_FAILURE_EPISODES' | 'NO_REGISTERED_CONTACTS'
  | 'INVENTORY_NOT_CAPTURED' | 'INVENTORY_CHANGED_SINCE_CAPTURE' | 'UNRESOLVED_CONTACT_IDENTITY'
  | 'NO_MEASUREMENT_MODEL' | 'NO_PROJECTION_POLICY';
export type NativeBattingContactTraitProjectionV189 = Readonly<{
  boundary: 'NATIVE_BATTING_CONTACT_TRAIT_PROJECTION_ONLY'; status: 'READY' | 'UNAVAILABLE'; reasons: readonly UnavailableReason[];
  scope: TraitScope; source: TraitSourceSnapshot | null; currentInventoryHash: string | null;
  classification: MeasuredTraitClassification | null; projection: SourceTraitProjection | null;
  timeSemantics: 'AS_OF_LATEST_REGISTERED_CONTACT'; populationCoverage: 'SUPPORTED_NATIVE_INVENTORY_ONLY';
  modelAuthority: 'EXPLICIT_CALLER_MODEL'; worldRevisionAuthority: 'CALLER_PROJECTION_METADATA';
}>;
function value<T>(result: TraitResult<T>): T {
  if (!result.ok) throw new Error(`Native contact trait projection: ${result.reason.code} at ${result.reason.path}`);
  return result.value;
}

/** Read-only descriptor composition. It supplies neither calibration nor physical/skill effects.
 * Freshness is relative to the supported Native inventory at this snapshot, and time is an as-of
 * observation time. Neither field asserts a current career clock or all possible contact producers. */
export function readNativeBattingContactTraitProjectionV189FromSqlite(
  db: DatabaseSync, raw: NativeBattingContactTraitProjectionRequestV189,
): NativeBattingContactTraitProjectionV189 {
  const input = obj(cloneInert(raw), ['scope', 'classificationId', 'projectionId', 'worldRevision', 'model', 'policy'], 'request');
  const scope = readScope(input.scope, 'request.scope'), classificationId = text(input.classificationId, 'request.classificationId'),
    projectionId = text(input.projectionId, 'request.projectionId'), worldRevision = integer(input.worldRevision, 'request.worldRevision');
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => {
    const snapshot = readNativeBattingContactObservationSnapshotV189FromSqlite(db, scope);
    let currentInventoryHash: string | null = null;
    const result = (reasons: readonly UnavailableReason[], classification: MeasuredTraitClassification | null = null,
      projection: SourceTraitProjection | null = null): NativeBattingContactTraitProjectionV189 => freeze({
      boundary: 'NATIVE_BATTING_CONTACT_TRAIT_PROJECTION_ONLY' as const, status: reasons.length ? 'UNAVAILABLE' as const : 'READY' as const,
      reasons: [...reasons], scope: cloneInert(scope), source: snapshot ? cloneInert(snapshot.source) : null,
      currentInventoryHash, classification, projection,
      timeSemantics: 'AS_OF_LATEST_REGISTERED_CONTACT' as const, populationCoverage: 'SUPPORTED_NATIVE_INVENTORY_ONLY' as const,
      modelAuthority: 'EXPLICIT_CALLER_MODEL' as const, worldRevisionAuthority: 'CALLER_PROJECTION_METADATA' as const,
    });
    if (!snapshot) return result(['NO_REGISTERED_CONTACTS']);
    if (snapshot.populationCoverage !== 'SUPPORTED_NATIVE_INVENTORY_AT_CAPTURE' || !snapshot.captureCoverage)
      return result(['INVENTORY_NOT_CAPTURED']);
    const inventory = readNativeBattingContactInventoryV188FromSqlite(db, scope);
    currentInventoryHash = inventory.inventoryHash;
    if (snapshot.captureCoverage.inventoryHash !== currentInventoryHash) return result(['INVENTORY_CHANGED_SINCE_CAPTURE']);
    // Full references identify producer records, not cross-owner aliases of actual contacts.
    // Until that identity is established, more than one record in one PA cannot count as independent contacts.
    const episodes = new Set<string>();
    for (const receipt of snapshot.receipts) {
      if (episodes.has(receipt.episodeId)) return result(['UNRESOLVED_CONTACT_IDENTITY']);
      episodes.add(receipt.episodeId);
    }
    if (input.model === null) return result(['NO_MEASUREMENT_MODEL']);
    if (input.policy === null) return result(['NO_PROJECTION_POLICY']);
    const model = input.model as MeasurementModel;
    if (model?.rule?.familyId !== 'line_drive') throw new Error('Native contact trait projection requires a line_drive model');
    const classification = value(classifyMeasuredTrait({ classificationId, scope, time: snapshot.time,
      source: snapshot.source, model, observations: snapshot.observations }));
    const projection = value(projectSourceTraits({ projectionId, scope, time: snapshot.time, worldRevision, targetTeamId: null,
      policy: input.policy, currentSources: [snapshot.source], assessments: classification.assessment ? [classification.assessment] : [] }));
    if (classification.status !== 'READY') return result(classification.reasons, classification, projection);
    const entry = projection.entries.find(x => x.familyId === 'line_drive')!;
    return result(entry.reasons, classification, projection);
  }));
}
