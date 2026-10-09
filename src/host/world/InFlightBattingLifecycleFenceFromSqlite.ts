import type { DatabaseSync } from 'node:sqlite';
import type { SamePaLifecycleViewReference, SamePaLifecycleWorkReference } from './SamePlateAppearanceLifecycle';
import { readHistoricalSamePaLifecycleViewFromSqlite, readSamePaLifecycleRecordFromSqlite,
  assertSamePaLifecycleReservedStateFromSqlite, assertSamePaLifecycleWorkCoverage } from './SamePlateAppearanceLifecycleFromSqlite';

/** Fresh writes retain the Source's original view while independently fencing
 * actual reserved state and the exact work extent including their own append.
 * Historical retries intentionally do not use this current-state fence. */
export const assertInFlightBattingWriteCurrentFromSqlite = (db: DatabaseSync, viewReference: SamePaLifecycleViewReference,
  appended: SamePaLifecycleWorkReference | null) => {
  const basis = readHistoricalSamePaLifecycleViewFromSqlite(db, viewReference);
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('in-flight batting original prefix missing');
  assertSamePaLifecycleReservedStateFromSqlite(db, basis);
  assertSamePaLifecycleWorkCoverage(db, basis.view.lineage.enrollmentReference, prefix.source.anchorViewReference,
    appended === null ? prefix.source.eventReferences : [...prefix.source.eventReferences, appended]);
};
