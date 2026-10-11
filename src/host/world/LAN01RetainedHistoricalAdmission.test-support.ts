import assert from 'node:assert/strict';
import type { DatabaseSync } from 'node:sqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readHistoricalSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollmentFromSqlite';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';

/** Authenticate the exact earlier admission after its accepted physical work.
 * The historical view reader also proves its original empty prefix and every
 * zero TOTAL. This grants no current admission; the caller separately proves
 * current workload state and the exact cut0 AFTER basis before any future work. */
export const readLAN01RetainedHistoricalAdmission = (db: DatabaseSync, viewReference: SamePaReference<'reserved_pa_execution_views'>) =>
  withSqliteReadTransaction(db, () => {
    assert.equal(viewReference.owner, 'reserved_pa_execution_views', 'LAN01 historical view reference owner differs');
    assert.equal(viewReference.sourceId, 'lan01:occupied:view', 'LAN01 historical view reference identity differs');
    const enrollment = readHistoricalSamePlateAppearanceEnrollment(db, 'lan01:occupied:enrollment');
    assert(enrollment, 'LAN01 original occupied enrollment missing');
    const { view } = readHistoricalSamePaExecutionView(db, viewReference);
    assert.deepEqual(reference('reserved_pa_execution_views', view), viewReference, 'LAN01 historical view reference differs');
    assert.deepEqual(view.source.enrollmentReference, reference('same_pa_enrollments', enrollment), 'LAN01 historical enrollment reference differs');
    return { enrollment, view };
  });
