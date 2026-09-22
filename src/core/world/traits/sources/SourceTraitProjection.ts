import type { TraitResult } from '../TraitTypes';
import { attempt, order, same } from '../TraitValidation';
import { getSourceTraitFamilies, SOURCE_TRAIT_REGISTRY_VERSION } from './SourceTraitFamilies';
import { readSourceTraitRequest, sourceKey } from './SourceTraitValidation';
import type { SourceTraitEntry, SourceTraitProjection, SourceTraitReason, SourceTraitRequest } from './SourceTraitTypes';
/** Internal: only accepts the detached validated request produced by readSourceTraitRequest. */
export function deriveSourceTraitProjection(r: SourceTraitRequest): SourceTraitProjection {
  const current = new Map(r.currentSources.map(s => [sourceKey(s), s]));
  const entries = getSourceTraitFamilies().map((f): SourceTraitEntry => {
    const a = r.assessments.find(x => x.familyId === f.familyId) ?? null;
    const base = { familyId: f.familyId, lifecycleClass: f.lifecycleClass, route: f.route,
      stateId: null, reasons: [], assessment: a };
    if (!a) return { ...base, status: 'UNASSESSED' };
    if (f.lifecycleClass === 'RELATIONSHIP_CONTEXTUAL' && (r.targetTeamId === null || a.targetTeamId !== r.targetTeamId))
      return { ...base, status: 'OUT_OF_CONTEXT' };
    const p = r.policy.families.find(x => x.familyId === f.familyId)!;
    const reasons: SourceTraitReason[] = [];
    if (a.modelId !== p.modelId || a.modelVersion !== p.modelVersion) reasons.push('MODEL_CHANGED');
    for (const b of a.bindings) {
      const s = current.get(sourceKey(b.source));
      if (!s) reasons.push('MISSING_SOURCE'); else if (!same(s, b.source)) reasons.push('STALE_SOURCE');
    }
    // Statistical distributions, retrospective history and contextual specialization require recognition evidence.
    // Actual-source changes may project a physical/negative state directly, with a nonempty cause episode.
    const recognitionRequired = a.changeKind !== 'DEVELOPMENT' || f.evidenceMode === 'RECOGNITION_REQUIRED';
    const span = a.episodes.length ? a.episodes[a.episodes.length - 1]!.time.day - a.episodes[0]!.time.day : 0;
    if (!a.episodes.length || (recognitionRequired && (a.episodes.length < p.minimumRecognitionEpisodes || span < p.minimumRecognitionDays)))
      reasons.push('INSUFFICIENT_EVIDENCE');
    if (reasons.length) return { ...base, status: 'UNAVAILABLE', reasons: [...new Set(reasons)].sort(order) };
    return { ...base, status: a.stateId === null ? 'ABSENT' : 'PRESENT', stateId: a.stateId };
  }).sort((a, b) => order(a.familyId, b.familyId));
  return { boundary: 'SOURCE_TRAIT_PROJECTION_ONLY', registryVersion: SOURCE_TRAIT_REGISTRY_VERSION,
    projectionId: r.projectionId, scope: r.scope, time: r.time, worldRevision: r.worldRevision,
    targetTeamId: r.targetTeamId, policyRef: { policyId: r.policy.policyId, version: r.policy.version }, entries };
}
/** Validates owner-produced classifications. It does not create physical/skill evidence or apply effects. */
export const projectSourceTraits = (input: unknown): TraitResult<SourceTraitProjection> =>
  attempt(() => deriveSourceTraitProjection(readSourceTraitRequest(input)));
