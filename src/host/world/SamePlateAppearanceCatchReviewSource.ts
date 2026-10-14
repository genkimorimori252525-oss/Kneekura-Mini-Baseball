import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLiveAdjudicationInput, type ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Accepted references only. Native derives the physical end and imported call. */
export type SamePaCatchReviewSeedSource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'same_pa_catch_review_seed_v1';
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>;
  physicalOperationReference: SamePaReference<'pa_physical_v1_field_roots' | 'pa_physical_v1_field_steps'>;
  policy: ActualLiveOfficialPolicy | null;
}>;
export const samePaCatchReviewSeedInput = (raw: unknown): SamePaCatchReviewSeedSource => {
  const s = cloneInert(raw) as SamePaCatchReviewSeedSource;
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'viewReference', 'catchWorkReference', 'physicalOperationReference', 'policy'])
    || !text(s.sourceId) || !text(s.sourceVersion) || s.capability !== 'same_pa_catch_review_seed_v1'
    || !ref(s.viewReference, 'pa_lifecycle_v1_execution_views') || !ref(s.catchWorkReference, 'pa_catch_v1_work')
    || !['pa_physical_v1_field_roots', 'pa_physical_v1_field_steps'].some(owner => ref(s.physicalOperationReference, owner))) {
    throw new Error('invalid reserved catch review seed Source');
  }
  actualLiveAdjudicationInput({ sourceId: s.sourceId, sourceVersion: s.sourceVersion,
    physicalEndSourceId: s.physicalOperationReference.sourceId, policy: s.policy }, s.sourceId);
  return freeze(s);
};
