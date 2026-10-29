import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), retained = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? ''), rel = relative(root, out);
assert(process.argv.length === 4 && rel && !rel.startsWith('..') && !isAbsolute(rel));
assert.equal(retained, resolve('work/native-initial-defender-inventory-v216-01')); assert(!existsSync(out));
const bytePin = bytes => ({ exists: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
const pins = {}, readBytes = path => { const bytes = readFileSync(path); pins[path] = bytePin(bytes); return bytes; };
const read = path => parseDebugRecord(readBytes(path).toString('utf8'));
const tree = path => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? tree(resolve(path, item.name)) : [resolve(path, item.name)]).sort();
const retainedPaths = tree(retained); for (const path of retainedPaths) readBytes(path);
const oldReport = read(resolve(retained, 'report.json')), manifest = read(resolve(retained, 'start-manifest.json'));
const inventoryPath = resolve(retained, 'records/inventory.lossless.json'), inventory = read(inventoryPath);
assert.deepEqual(read(resolve(retained, 'inventory.lossless.json')), inventory);
assert.equal(oldReport.pass, false); assert.equal(oldReport.nativeReadExit.code, 0); assert.equal(oldReport.nativeReadExit.signal, null);
assert.equal(oldReport.originalFailedRunCompleted, false); assert.equal(oldReport.originalFailedRunEndPinsClaimed, false);
for (const key of ['failedArtifactsAndDataUnchanged', 'retainedAncestorDataUnchanged', 'sourceHarnessInputAndBundleEndPinsProven']) assert.equal(oldReport[key], true);
assert.equal(oldReport.error.includes('Object: null prototype'), true); assert.equal(oldReport.error.includes('inventory-v216.mjs:126'), true);
assert.deepEqual(oldReport.startManifestPin, pins[resolve(retained, 'start-manifest.json')]);
assert.deepEqual(oldReport.state, inventory.state); assert.equal(inventory.normalCommittedPhaseAuthenticated, true);
assert.equal(inventory.readOnly, true); assert.equal(inventory.acceptOperationCalls, 0); assert.equal(inventory.lifecycleAcceptCalls, 0);
assert.equal(inventory.originalFailedRunCompleted, false); assert.equal(inventory.originalFailedRunEndPinsClaimed, false);
const guards = read(resolve(retained, 'records/locator-guards.json')); assert.deepEqual(guards, oldReport.locatorGuards);
assert.equal(guards.pass, true); assert.equal(guards.guards.length, 2);
assert(guards.guards.every(g => g.rejectedByNormalCalibrationReader && g.originalAndInventoryDatabaseMutated === false));
const receiptPath = resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_08585b27a5b14888a40f785ca27f9eaf.json');
const receipt = read(receiptPath); assert.equal(receipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN'); assert.equal(receipt.result, 'FAIL'); assert.equal(receipt.exit_code, 1);
assert.equal(receipt.command.length, 4); assert.deepEqual(receipt.command.slice(0, 3), ['node', 'tools/verification/check-native-initial-defender-views-inventory-v216.mjs', 'docs/verification/realism-debug-20261027/native-initial-defender-views-v214-01']);
assert.equal(resolve(root, receipt.command[3]), retained); assert.equal(bytePin(readBytes(resolve(receipt.output_path))).sha256, receipt.output_sha256);
assert.equal(manifest.runtime.fixtureClosureExecuted, false); assert.equal(manifest.noOriginalDatabaseOpen, true); assert.equal(manifest.digestBundle.inputCount, 1);
assert.deepEqual(Object.keys(manifest.digestBundle.sourcePins), ['tools/verification/NativeSpinNeutralV193-sql.ts']);
const failedDir = resolve('docs/verification/realism-debug-20261027/native-initial-defender-views-v214-01');
const originalBefore = read(resolve(failedDir, 'before-logical-with-rowid.json'));
const originalHeads = read(resolve(failedDir, 'physical-heads-before.lossless.json')), originalWorld = read(resolve(failedDir, 'world-heads-before.lossless.json'));
const failedManifest = read(resolve(failedDir, 'start-manifest.json'));
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const rawRows = (db, table) => { const q = db.prepare('SELECT rowid AS native_rowid,* FROM main."' + table.replaceAll('"', '""') + '" ORDER BY rowid'); q.setReadBigInts(true); return q.all(); };
const reviveRows = rows => rows.map(row => Object.assign(Object.create(null), Object.fromEntries(Object.entries(row).map(([key, value]) =>
  [key, value && value.kind === 'SQLITE_INTEGER' ? BigInt(value.decimal) : value]))));
const persistRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? { kind: 'SQLITE_INTEGER', decimal: String(value) } : value])));
// node:sqlite records have null prototypes; JSON records have Object.prototype.
// Normalize that boundary alone. Preserve every key, SQL scalar type, order and value.
const catalogRecords = rows => rows.map(row => {
  assert.deepEqual(Object.keys(row), ['type', 'name', 'tbl_name', 'sql']);
  assert.equal(typeof row.type, 'string'); assert.equal(typeof row.name, 'string'); assert.equal(typeof row.tbl_name, 'string');
  assert(row.sql === null || typeof row.sql === 'string');
  return Object.fromEntries(Object.entries(row));
});
const assertPins = async () => {
  assert.deepEqual(tree(retained), retainedPaths);
  for (const bundle of [manifest.closure, manifest.digestBundle, failedManifest.bundle, failedManifest.digestBundle]) {
    assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
    for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
  }
  for (const [path, pin] of Object.entries(failedManifest.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(manifest.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(oldReport.failedArtifactPins)) assert.deepEqual(await fileState(path), pin);
  for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, before] of Object.entries(oldReport.retainedDataBefore)) {
    assert.deepEqual(dataPin(before), dataPin(oldReport.retainedDataAfter[path])); assert.deepEqual(dataPin(await databaseFiles(path)), dataPin(before));
  }
  assert.deepEqual(await databaseFiles(oldReport.failedDatabase), oldReport.failedDataBefore);
  assert.deepEqual(oldReport.failedDataBefore, oldReport.failedDataAfter);
};
for (const path of ['tools/verification/check-native-initial-defender-views-inventory-proof-v216.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) readBytes(resolve(path));
await assertPins(); mkdirSync(out, { recursive: false });
const resultPins = {};
const save = (name, value) => { const path = resolve(out, name), bytes = Buffer.from(stringifyDebugRecord(value) + '\n');
  writeFileSync(path, bytes, { flag: 'wx' }); if (name !== 'report.json') resultPins[path] = bytePin(bytes); };
const owned = resolve(out, 'proof-readonly.sqlite'), source = resolve(oldReport.ownedDatabase);
assert.equal(source, resolve(retained, 'inventory-private.sqlite')); assert.equal(Object.keys(oldReport.retainedDataBefore).length, 11);
const sourceFiles = await databaseFiles(source); assert.deepEqual(dataPin(sourceFiles), dataPin(oldReport.ownedDataAfter));
save('start-manifest.json', { retained, receipt, receiptPath, pins, sourceFiles, source, owned, noOriginalOrRetainedDatabaseOpen: true,
  normalInventoryReexecuted: false, nativeTestReexecuted: false, fixtureClosureExecuted: false, acceptOperationCalls: 0, lifecycleAcceptCalls: 0 });
const startPin = await fileState(resolve(out, 'start-manifest.json'));
const report = { pass: false, boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_READ_ONLY_INVENTORY_PROOF', source, owned, originalInventoryReceipt: receiptPath,
  originalInventoryOverallPass: false, originalFailedRunCompleted: false, originalFailedRunEndPinsClaimed: false,
  normalInventoryReexecuted: false, nativeTestReexecuted: false, fixtureClosureExecuted: false, acceptOperationCalls: 0, lifecycleAcceptCalls: 0,
  remainingOnlyRecoveryExecuted: false, performancePass: false, wholeRngConsumptionProven: false };
let db, ownedBefore;
try {
  await assertPins();
  for (const suffix of ['', '-wal', '-shm', '-journal']) if (sourceFiles[suffix || 'main'].exists) {
    copyFileSync(source + suffix, owned + suffix, constants.COPYFILE_EXCL); assert.deepEqual(await fileState(owned + suffix), sourceFiles[suffix || 'main']);
  }
  assert.deepEqual(await databaseFiles(source), sourceFiles); ownedBefore = await databaseFiles(owned);
  const digest = (await import(pathToFileURL(manifest.digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  db = new DatabaseSync(owned, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN');
  const changes = db.prepare('SELECT total_changes() n').get().n, actual = digest(db);
  const captured = read(resolve(retained, 'failed-logical-with-rowid.json'));
  assert.equal(actual.catalogSha256, captured.catalogSha256); assert.deepEqual(catalogRecords(actual.catalog), catalogRecords(captured.catalog)); assert.deepEqual(actual.tables, Object.assign(Object.create(null), captured.tables));
  assert.equal(actual.catalogSha256, originalBefore.catalogSha256); assert.deepEqual(catalogRecords(actual.catalog), catalogRecords(originalBefore.catalog));
  assert.deepEqual(Object.keys(actual.tables), Object.keys(originalBefore.tables));
  const additions = {
    pa_physical_v1_field_steps: inventory.iterations.filter(i => i.cell.observation).map(i => i.observationReference.sourceId),
    pa_lifecycle_v1_work_prefixes: inventory.iterations.filter(i => i.cell.prefix).map(i => i.prefix.source.sourceId),
    pa_lifecycle_v1_total_assessments: inventory.iterations.flatMap(i => i.totals.filter(Boolean).map(t => t.source.sourceId)),
    pa_lifecycle_v1_execution_views: inventory.iterations.filter(i => i.cell.view).map(i => i.view.source.sourceId),
    pa_lifecycle_v1_execution_calibrations: inventory.iterations.filter(i => i.cell.calibration).map(i => i.scopedCalibration.source.sourceId),
  };
  const through = Object.create(null);
  for (const [table, ids] of Object.entries(additions)) {
    assert.equal(new Set(ids).size, ids.length); const q = db.prepare('SELECT rowid AS native_rowid,source_id FROM main.' + table + ' ORDER BY rowid'); q.setReadBigInts(true);
    const rows = q.all(), added = rows.filter(r => ids.includes(r.source_id)); assert.equal(added.length, ids.length);
    through[table] = added.length ? added[0].native_rowid - 1n : rows.at(-1)?.native_rowid ?? 0n;
    assert.deepEqual(rows.filter(r => r.native_rowid > through[table]).map(r => r.source_id).sort(), [...ids].sort());
    assert.equal(actual.tables[table].rows - originalBefore.tables[table].rows, ids.length);
  }
  const subset = digest(db, through);
  for (const table of Object.keys(originalBefore.tables)) if (table !== 'pa_physical_v1_heads') assert.deepEqual(subset.tables[table], originalBefore.tables[table], 'old immutable rowid/data differs: ' + table);
  const expectedHeads = reviveRows(originalHeads), target = expectedHeads.filter(row => row.enrollment_source_id === failedManifest.enrollmentSourceId); assert.equal(target.length, 1);
  target[0].operation_ordinal = 7n + BigInt(inventory.state.acceptedObservationCount); target[0].last_owner = inventory.latestPhysicalReference.owner;
  target[0].last_source_id = inventory.latestPhysicalReference.sourceId; target[0].last_snapshot_hash = inventory.latestPhysicalReference.snapshotHash;
  const heads = rawRows(db, 'pa_physical_v1_heads'); assert.deepEqual(heads, expectedHeads); assert.deepEqual(rawRows(db, 'world_control_heads'), reviveRows(originalWorld));
  assert.equal(db.prepare('SELECT total_changes() n').get().n, changes); assert.equal(db.prepare('PRAGMA query_only').get().query_only, 1);
  save('physical-heads.lossless.json', persistRows(heads)); copyFileSync(inventoryPath, resolve(out, 'inventory.lossless.json'), constants.COPYFILE_EXCL);
  resultPins[resolve(out, 'inventory.lossless.json')] = pins[inventoryPath];
  report.state = inventory.state; report.latestAcceptedViewReference = inventory.latestAcceptedViewReference; report.latestPhysicalReference = inventory.latestPhysicalReference;
  report.currentViewCoversPhysicalHead = inventory.currentViewCoversPhysicalHead; report.missingLifecycleStages = inventory.missingLifecycleStages;
  report.appendedRowsSinceV212 = Object.fromEntries(Object.entries(additions).map(([table, ids]) => [table, ids.length]));
  report.appendedRowsSinceV212Total = Object.values(report.appendedRowsSinceV212).reduce((n, count) => n + count, 0); assert.equal(report.appendedRowsSinceV212Total, 126 - inventory.state.remainingAppendRows);
  report.physicalHeadCasCount = inventory.state.acceptedObservationCount; report.onlyExpectedPhysicalHeadCasProven = true;
  report.originalV212RowsRowidsSchemaAndOtherHeadsUnchanged = true; report.worldUnchanged = true; report.normalCommittedPhaseAuthenticated = true;
  report.savedNormalInventoryAndLocatorGuardsReused = true; report.locatorGuards = guards; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  try { if (db) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } } catch (error) { report.closeError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    await assertPins(); assert.deepEqual(await databaseFiles(source), sourceFiles);
    if (ownedBefore) assert.deepEqual(dataPin(await databaseFiles(owned)), dataPin(ownedBefore));
    assert.deepEqual(await fileState(resolve(out, 'start-manifest.json')), startPin);
    for (const [path, pin] of Object.entries(resultPins)) assert.deepEqual(await fileState(path), pin);
    report.resultPins = resultPins;
    report.retainedInventoryArtifactsUnchanged = true; report.failedV214ArtifactsAndDataUnchanged = true; report.retainedAncestorDataUnchanged = true;
    report.sourceHarnessInputBundleAndResultEndPinsProven = true;
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, state: report.state, appendedRowsSinceV212: report.appendedRowsSinceV212,
  physicalHeadCasCount: report.physicalHeadCasCount, normalInventoryReexecuted: false, nativeTestReexecuted: false,
  error: report.error ?? report.closeError ?? report.pinError ?? null }));
