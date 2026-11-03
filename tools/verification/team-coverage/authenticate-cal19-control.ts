import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { actorHash as hash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readCurrentSamePaLifecycleViewFromSqlite, readSamePaLifecycleSetFromSqlite } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';

// A completed diagnostic writer is insufficient: reauthenticate its new rows
// with the unchanged original readers, on a closed read-only copy.
const directory = resolve(process.argv[2]), parent = resolve(process.argv[3]);
const path = join(directory, 'closed-prefix.sqlite'), parentPath = join(parent, 'closed-prefix.sqlite');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const fileHash = (file: string) => sha(readFileSync(file));
const before = fileHash(path), parentBefore = fileHash(parentPath);
const sources = new Map<string, unknown>(JSON.parse(readFileSync(join(directory, 'original-files', 'accepted-sources.json'), 'utf8')));
assert.equal(fileHash(join(directory, 'original-files', 'accepted-sources.json')), fileHash(join(parent, 'original-files', 'accepted-sources.json')));
const attempt = { status: 'ORIGINAL_CAL19_READONLY_AUTHENTICATION_RUNNING', pid: process.pid, runtime: process.version,
  directory, parent, databaseHash: before, parentDatabaseHash: parentBefore, started: Date.now() };
writeFileSync(join(directory, 'original-owner-cal19-authentication-attempt.json'), JSON.stringify(attempt, null, 2), { flag: 'wx' });
console.log(JSON.stringify(attempt));
const db = new DatabaseSync(path, { readOnly: true }), old = new DatabaseSync(parentPath, { readOnly: true });
const started = Date.now();
try {
  const names = (connection: DatabaseSync) => connection.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name").all();
  const schema = names(db); assert.deepEqual(schema, names(old));
  const delta = [];
  for (const { name } of schema) {
    const quoted = '"' + String(name).replaceAll('"', '""') + '"';
    const rows = db.prepare('SELECT * FROM ' + quoted + ' ORDER BY rowid').all();
    const prior = old.prepare('SELECT * FROM ' + quoted + ' ORDER BY rowid').all();
    if (name !== 'pa_lifecycle_v1_execution_calibrations') assert.deepEqual(rows, prior, 'unexpected changed table ' + name);
    else { assert.equal(rows.length, prior.length + 32); assert.deepEqual(rows.slice(0, prior.length), prior); }
    delta.push({ table: name, previousCount: prior.length, count: rows.length, previousHash: hash(prior), hash: hash(rows) });
  }
  const viewRow = db.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_views WHERE source_id=?').get('team-retained:cut19:view');
  assert.ok(viewRow);
  const viewRef = reference('pa_lifecycle_v1_execution_views', JSON.parse(String(viewRow.snapshot_json)));
  assert.equal(viewRef.sourceHash, 'fb9d7cfe28c094900a7dea886b8b9aff46250a621beaccc6785d7405bd7a4a3d');
  assert.equal(viewRef.snapshotHash, 'b6020bd7b21086a0c24487b7fb180ac1c478cbe5a10aeab29a683fa0f8943060');
  const rows = db.prepare('SELECT source_id,source_hash,source_json,snapshot_hash,snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid').all(viewRef.sourceId);
  assert.equal(rows.length, 32);
  for (const row of rows) {
    const source = sources.get(String(row.source_id)); assert.ok(source);
    assert.equal(hash(source), row.source_hash); assert.deepEqual(JSON.parse(String(row.source_json)), source);
    const record = JSON.parse(String(row.snapshot_json)); assert.equal(hash(record), row.snapshot_hash);
    const prior = old.prepare('SELECT snapshot_json FROM pa_lifecycle_v1_execution_calibrations WHERE source_id=?')
      .get(String(row.source_id).replace('team-retained:cut19:', 'team-retained:cut18:'));
    assert.ok(prior); const previous = JSON.parse(String(prior.snapshot_json));
    assert.equal(record.nominalInputHash, previous.nominalInputHash);
    assert.equal(record.effectiveResponseHash, previous.effectiveResponseHash);
    assert.deepEqual(record.source.response, previous.source.response);
    assert.deepEqual(record.source.nominalReference, previous.source.nominalReference);
  }
  const ids = rows.map(row => String(row.source_id));
  const first = withSqliteReadTransaction(db, () => ({ current: readCurrentSamePaLifecycleViewFromSqlite(db, viewRef),
    calibrations: readSamePaLifecycleSetFromSqlite(db, 'calibration', ids) }));
  for (const record of first.calibrations) { assert.ok(record); assert.equal(record.kind, 'same_pa_lifecycle_calibration'); }
  const calibrationReferences = first.calibrations.map(value => { assert.ok(value); return reference('pa_lifecycle_v1_execution_calibrations', value); });
  const writerReceipt = JSON.parse(readFileSync(join(directory, 'original-files', 'cut19-calibration-receipt.json'), 'utf8'));
  assert.equal(hash({ kind: 'same_pa_lifecycle_calibration_set', calibrations: first.calibrations, calibrationReferences }), writerReceipt.acceptedSetHash);
  const reopened = new DatabaseSync(path, { readOnly: true });
  try {
    const second = withSqliteReadTransaction(reopened, () => ({ current: readCurrentSamePaLifecycleViewFromSqlite(reopened, viewRef),
      calibrations: readSamePaLifecycleSetFromSqlite(reopened, 'calibration', ids) }));
    assert.deepEqual(second, first);
  } finally { reopened.close(); }
  assert.equal(fileHash(path), before); assert.equal(fileHash(parentPath), parentBefore);
  const receipt = { status: 'PASS_DIAGNOSTIC_CAL19_UNCHANGED_ORIGINAL_OWNER_READ_REOPEN_AND_EXACT_ROW_DELTA',
    databaseHash: before, parentDatabaseHash: parentBefore, viewReference: viewRef,
    calibrationReferences, originalWriterAcceptedSetHash: writerReceipt.acceptedSetHash,
    acceptedSetHash: hash(first.calibrations), currentHash: hash(first.current), delta,
    originalOwnerModuleChanged: false, tableCount: schema.length, admittedCalibrationCount: 32,
    unchangedPriorRows: true, unchangedNominalAndEffectiveResponse: true, independentlyReopened: true,
    elapsedMilliseconds: Date.now() - started, rootCause: 'UNKNOWN', teamExecutionCredit: 0, officialResult: null };
  writeFileSync(join(directory, 'original-owner-cal19-authentication.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, delta: { tableCount: delta.length }, calibrationReferences: { count: first.calibrations.length } }));
} finally { old.close(); db.close(); }
