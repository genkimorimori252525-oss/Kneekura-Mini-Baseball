import type { DatabaseSync } from 'node:sqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from '../../src/host/world/SqliteBattedVenueLegalPolicyStore';
import { readCurrentSamePaLifecycleViewFromSqlite, withSamePaLifecycleReadPhase } from '../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';

export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';

/** One normal current read on a borrowed connection. No owner, warm-up read,
 * cache or proof outlives the existing snapshot and lifecycle phase. */
export const readNativeLifecycleOnceV200 = (db: DatabaseSync, viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>) =>
  withBattedVenueLegalReadSnapshot(db, () => withSamePaLifecycleReadPhase(db,
    () => readCurrentSamePaLifecycleViewFromSqlite(db, viewReference)));
