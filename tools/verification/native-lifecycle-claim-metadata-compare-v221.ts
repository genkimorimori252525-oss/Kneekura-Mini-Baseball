import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { readCurrentSamePaLifecycleViewFromSqlite, withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

export type NativeLifecycleClaimMetadataCompareInputV221 = Readonly<{
  leg: 'OLD' | 'NEW';
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  expectedCurrent: NonNullable<ReturnType<typeof readCurrentSamePaLifecycleViewFromSqlite>>;
  expectedPhysicalReference: SamePaReference<'pa_physical_v1_field_steps'>;
}>;

/** One unchanged normal getter on a caller-owned readonly snapshot. Both legs
 * use the same input and read boundary; neither samples nor instruments SQL.
 * The separate NEW process requires the completed unsampled OLD receipt. */
export const compareNativeLifecycleClaimMetadataV221 = (db: DatabaseSync, viewReference: NativeLifecycleClaimMetadataCompareInputV221['viewReference']) => {
  assert.equal(viewReference.owner, 'pa_lifecycle_v1_execution_views'); assert.equal(viewReference.sourceId, 'physical-fixture:cut22:view');
  return withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference)));
};
