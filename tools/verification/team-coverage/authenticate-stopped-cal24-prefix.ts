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

const directory = resolve(process.argv[2]);
const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
const fileHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
assert.equal(fileHash(manifest.closedPath), manifest.closedDatabaseHash);
assert.equal(fileHash(manifest.sourceMapPath), manifest.sourceMapHash);
assert.equal(manifest.stopControl.kind, 'STOP_CONTROL');
const sources = new Map<string, unknown>(JSON.parse(readFileSync(manifest.sourceMapPath, 'utf8')));
const attempt = { status: 'STOPPED_LEGACY_CAL24_READONLY_AUTHENTICATION_RUNNING', pid: process.pid,
  databaseHash: manifest.closedDatabaseHash, authorityMapHash: manifest.sourceMapHash, started: Date.now() };
writeFileSync(join(directory, 'owner-authentication-attempt.json'), JSON.stringify(attempt, null, 2), { flag: 'wx' });
console.log(JSON.stringify(attempt));
const db = new DatabaseSync(manifest.closedPath, { readOnly: true }), started = Date.now();
try {
  const viewRef = manifest.census.viewReference;
  assert.equal(viewRef.sourceId, 'team-retained:cut24:view');
  const references = [...manifest.census.observationReferences, ...manifest.census.decisionReferences];
  assert.equal(manifest.census.observationReferences.length, 6); assert.equal(manifest.census.decisionReferences.length, 5);
  for (const ref of references) {
    const row = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM pa_physical_v1_field_steps WHERE source_id=?').get(ref.sourceId);
    assert.ok(row); const source = sources.get(ref.sourceId); assert.ok(source);
    assert.equal(hash(source), ref.sourceHash); assert.equal(row.source_hash, ref.sourceHash);
    assert.deepEqual(JSON.parse(String(row.source_json)), source);
    assert.equal(hash(JSON.parse(String(row.snapshot_json))), ref.snapshotHash); assert.equal(row.snapshot_hash, ref.snapshotHash);
  }
  const fieldRef = manifest.census.observationReferences.at(-1);
  assert.equal(fieldRef.sourceId, 'team-retained:field:defender-observation-5');
  const field = withSqliteReadTransaction(db, () => readSamePaPhysicalOperationFromSqlite(db, fieldRef));
  assert.equal(hash(field.record), fieldRef.snapshotHash);
  assert.equal(field.record.kind, 'same_pa_physical_field_step_v1');
  const current = withSqliteReadTransaction(db, () => readCurrentSamePaLifecycleViewFromSqlite(db, viewRef));
  assert.deepEqual(current.view.cut.physicalOperationReference, fieldRef);
  assert.equal(current.view.cut.evaluationTick, field.evaluationTick);
  const ids = db.prepare('SELECT source_id FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid')
    .all(viewRef.sourceId).map(row => String(row.source_id)); assert.equal(ids.length, 32);
  const calibrations = withSqliteReadTransaction(db, () => readSamePaLifecycleSetFromSqlite(db, 'calibration', ids));
  for (const value of calibrations) {
    assert.ok(value?.kind === 'same_pa_lifecycle_calibration'); assert.equal(hash(value.source), hash(sources.get(value.source.sourceId)));
  }
  const calibrationReferences = calibrations.map(value => { assert.ok(value); return reference('pa_lifecycle_v1_execution_calibrations', value); });
  const ownerReceipt = JSON.parse(readFileSync(join(directory, 'original-files', 'cut24-calibration-receipt.json'), 'utf8'));
  assert.equal(hash({ kind: 'same_pa_lifecycle_calibration_set', calibrations, calibrationReferences }), ownerReceipt.acceptedSetHash);
  assert.equal(db.prepare('SELECT count(*) AS n FROM pa_physical_v1_field_steps WHERE source_id=?').get('team-retained:field:defender-decision-5')!.n, 0);
  assert.equal(sources.has('team-retained:field:defender-decision-5'), false);
  assert.equal(fileHash(manifest.closedPath), manifest.closedDatabaseHash);
  assert.equal(fileHash(manifest.sourceMapPath), manifest.sourceMapHash);
  const result = { status: 'PASS_STOPPED_LEGACY_CAL24_ORIGINAL_OWNER_CAUSAL_PREFIX_READONLY_REOPEN',
    databaseHash: manifest.closedDatabaseHash, authorityMapHash: manifest.sourceMapHash,
    fieldReference: fieldRef, viewReference: viewRef, evaluationTick: field.evaluationTick,
    savedObservationReferences: manifest.census.observationReferences, savedDecisionReferences: manifest.census.decisionReferences,
    authenticatedCalibrationCount: calibrations.length, acceptedCalibrationSetHash: ownerReceipt.acceptedSetHash,
    latestPhysicalOwnerReplayedCausalPrefix: true, all11SeparatelyColdRead: false, immutableBytesUnchanged: true,
    nextStageNotStarted: 'defender-decision-5', stopControlKind: 'STOP_CONTROL', continuationAuthorized: false,
    legacyNonEquivalentClockPreserved: true, empiricalMotionValidated: false,
    elapsedMilliseconds: Date.now() - started, teamExecutionCredit: 0, mixedNineInningsCredit: 0, officialResult: null };
  writeFileSync(join(directory, 'owner-authentication-receipt.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ ...result, savedObservationReferences: { count: 6 }, savedDecisionReferences: { count: 5 } }));
} finally { db.close(); }
