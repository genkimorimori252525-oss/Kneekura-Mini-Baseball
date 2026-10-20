import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';

const [argument] = process.argv.slice(2); assert.ok(argument);
const directory = resolve(argument), manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
assert.equal(sha(readFileSync(manifest.closedPath)), manifest.closedDatabaseHash);
const sourceBytes = readFileSync(manifest.sourceMapPath); assert.equal(sha(sourceBytes), manifest.sourceMapHash);
const sources = new Map<string, unknown>(JSON.parse(sourceBytes.toString('utf8')));
const db = new DatabaseSync(manifest.closedPath, { readOnly: true }), started = Date.now();
try {
  const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut17:view');
  const fieldRow = db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_steps WHERE source_id=?').get('team-retained:field:defender-decision-1');
  assert.ok(viewRow && fieldRow);
  const viewRef = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
  const fieldRef = reference('pa_physical_v1_field_steps', JSON.parse(String(fieldRow.snapshot_json)));
  assert.equal(hash(sources.get(viewRef.sourceId)), viewRef.sourceHash);
  assert.equal(hash(sources.get(fieldRef.sourceId)), fieldRef.sourceHash);
  const field = withSqliteReadTransaction(db, () => readSamePaPhysicalOperationFromSqlite(db, fieldRef));
  assert.equal(field.record.kind, 'same_pa_physical_field_step_v1');
  assert.equal(hash(field.record), fieldRef.snapshotHash);
  const current = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewRef));
  assert.deepEqual(current.view.cut.physicalOperationReference, fieldRef);
  assert.equal(current.view.cut.evaluationTick, field.evaluationTick);
  const calibrationIds = db.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
    .all(viewRef.sourceId).map(row => String(row.source_id));
  assert.equal(calibrationIds.length, 32);
  const calibrations = withSqliteReadTransaction(db, () => readSamePaLifecycleSetFromSqlite(db, 'calibration', calibrationIds));
  assert.equal(calibrations.length, 32);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pa_physical_v1_field_steps WHERE source_id=?')
    .get('team-retained:field:defender-observation-2')!.n, 0);
  assert.equal(sources.has('team-retained:field:defender-observation-2'), false);
  assert.equal(sha(readFileSync(manifest.closedPath)), manifest.closedDatabaseHash);
  const receipt = { status: 'PASS_CLOSED_CUT17_ORIGINAL_OWNER_AUTHENTICATION_OBSERVATION2_NOT_ADMITTED',
    databaseHash: manifest.closedDatabaseHash, authorityMapHash: manifest.sourceMapHash, viewReference: viewRef,
    fieldReference: fieldRef, evaluationTick: field.evaluationTick, authenticatedCalibrationCount: calibrations.length,
    observation2SourcePublished: false, observation2RowPresent: false, observation2OwnerReceiptPresent: false,
    exactNextStage: 'defender-observation-2', elapsedMilliseconds: Date.now() - started,
    failedAttemptPreserved: manifest.failedStage, closedDatabaseBytesUnchanged: true, teamExecutionCredit: 0, officialResult: null };
  writeFileSync(join(directory, 'owner-authentication-receipt.json'), JSON.stringify(receipt, null, 2)); console.log(JSON.stringify(receipt));
} finally { db.close(); }
