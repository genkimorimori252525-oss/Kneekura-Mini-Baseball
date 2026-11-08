import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, constants, copyFileSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), failed = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? ''), rel = relative(root, out);
assert(process.argv.length === 4 && rel && !rel.startsWith('..') && !isAbsolute(rel));
assert.equal(failed, resolve('docs/verification/realism-debug-20261027/native-initial-defender-views-v214-01'));
assert(!existsSync(out), 'new inventory output must not exist');
const bytePin = bytes => ({ exists: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
const pins = {}, readBytes = path => { const bytes = readFileSync(path); pins[path] = bytePin(bytes); return bytes; };
const read = path => parseDebugRecord(readBytes(path).toString('utf8'));
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const treeFiles = path => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? treeFiles(resolve(path, item.name)) : [resolve(path, item.name)]).sort();
const failedFiles = treeFiles(failed), artifactPins = {};
for (const path of failedFiles) artifactPins[path] = bytePin(readBytes(path));
const parent = read(resolve(failed, 'start-manifest.json')), retainedInput = read(resolve(failed, 'execution-input.lossless.json'));
const model = read(resolve(failed, 'nominal-initial-view-model.lossless.json'));
assert.deepEqual(model, retainedInput.modelDeclaration); assert.deepEqual(parent.input, retainedInput);
assert.deepEqual(parent.modelArtifact.pin, pins[parent.modelArtifact.path]); assert.equal(parent.parentSourceChanges, 0);
const failedReceiptPath = resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_b3f2f4007f484cfcba38bf8b6233d5a4.json');
const failedReceipt = read(failedReceiptPath); assert.equal(failedReceipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN');
assert.equal(failedReceipt.result, 'FAIL'); assert.equal(failedReceipt.exit_code, 124); assert.equal(failedReceipt.command.length, 4);
assert.deepEqual(failedReceipt.command.slice(0, 3), ['node', 'tools/verification/check-native-initial-defender-views-v214.mjs', 'docs/verification/realism-debug-20261027/native-field-clock-v212-01']);
assert.equal(resolve(root, failedReceipt.command[3]), failed); assert.equal(bytePin(readBytes(resolve(failedReceipt.output_path))).sha256, failedReceipt.output_sha256);
const stages = readBytes(resolve(failed, 'records/stages.jsonl')).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
stages.forEach((stage, index) => assert.equal(stage.index, index + 1));
const checkpoint = stage => read(resolve(failed, 'records/checkpoint-' + stage.index + '-' + stage.name + '.lossless.json'));
const authStage = stages.filter(stage => stage.name === 'retained-current-cut13-and-initial-history-authenticated'); assert.equal(authStage.length, 1);
const auth = checkpoint(authStage[0]); assert.deepEqual(auth.input, retainedInput);
const declarationStage = stages.filter(stage => stage.name === 'nominal-initial-defender-views-declared'); assert.equal(declarationStage.length, 1);
const declarationCheckpoint = checkpoint(declarationStage[0]); assert.deepEqual(declarationCheckpoint.modelDeclaration, model);
const savedCheckpoints = [];
for (const stage of stages.filter(s => /^normal-(?:cut\d+-current-scoped-calibration-physical-world-checkpoint|defender-observation-\d+-accepted-before-lifecycle)$/.test(s.name))) {
  const path = resolve(failed, 'records/checkpoint-' + stage.index + '-' + stage.name + '.lossless.json');
  // A stage is emitted before its checkpoint file. Only fully parseable files
  // are hints; the normal database readers decide what committed.
  if (existsSync(path)) savedCheckpoints.push({ name: stage.name, value: checkpoint(stage) });
}
const { input: _savedInput, ...original } = auth;
const input = { retainedInput, original, declarationCheckpoint, savedCheckpoints };
const failedDatabase = resolve(failed, 'initial-defender-views-private.sqlite');
const retainedDatabases = new Map(Object.entries(parent.retainedDataBefore).map(([path, pin]) => [resolve(path), pin]));
assert.equal(retainedDatabases.size, 11); assert(!retainedDatabases.has(failedDatabase));
const beforeLogical = read(resolve(failed, 'before-logical-with-rowid.json'));
const priorHeads = read(resolve(failed, 'physical-heads-before.lossless.json'));
const priorWorldHeads = read(resolve(failed, 'world-heads-before.lossless.json'));
const rawRows = (db, table) => { const q = db.prepare('SELECT rowid AS native_rowid,* FROM main."' + table.replaceAll('"', '""') + '" ORDER BY rowid'); q.setReadBigInts(true); return q.all(); };
const reviveRows = rows => rows.map(row => Object.assign(Object.create(null), Object.fromEntries(Object.entries(row).map(([key, value]) =>
  [key, value && value.kind === 'SQLITE_INTEGER' ? BigInt(value.decimal) : value]))));
const persistRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? { kind: 'SQLITE_INTEGER', decimal: String(value) } : value])));
const pinParent = async () => {
  for (const bundle of [parent.bundle, parent.digestBundle]) {
    assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
    for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 }, 'parent Source changed: ' + path);
  }
  for (const [path, pin] of Object.entries(parent.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin, 'parent harness changed: ' + path);
  for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin, 'captured input changed: ' + path);
  assert.deepEqual(treeFiles(failed), failedFiles, 'failed artifact set changed');
};
await pinParent(); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const stagedDatabase = resolve(out, 'failed-data-staging.sqlite'), ownedDatabase = resolve(out, 'inventory-private.sqlite');
const report = { pass: false, boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_READ_ONLY_INVENTORY', failedReceipt: failedReceiptPath, failedCommand: failedReceipt.command,
  failedDatabase, ownedDatabase, originalFailedRunCompleted: false, originalFailedRunEndPinsClaimed: false, remainingOnlyRecoveryExecuted: false,
  acceptOperationCalls: 0, lifecycleAcceptCalls: 0, fixtureClosureExecuted: false, performancePass: false, wholeRngConsumptionProven: false };
let staging, owned, closure, digestBundle, beforeOwned;
try {
  report.retainedDataBefore = {};
  for (const [path, pin] of retainedDatabases) { const actual = await databaseFiles(path); assert.deepEqual(dataPin(actual), dataPin(pin)); report.retainedDataBefore[path] = actual; }
  report.failedDataBefore = await databaseFiles(failedDatabase); assert.equal(report.failedDataBefore.main.exists, true);
  report.failedArtifactPins = artifactPins;
  closure = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-initial-defender-views-inventory-v216.test.ts', outputPath: resolve(out, 'source-closure-not-executed.mjs') });
  digestBundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-sql.ts', outputPath: resolve(out, 'digest-bundle.mjs') });
  assert.equal(digestBundle.inputCount, 1);
  save('execution-input.lossless.json', input); pins[resolve(out, 'execution-input.lossless.json')] = await fileState(resolve(out, 'execution-input.lossless.json'));
  for (const path of ['tools/verification/check-native-initial-defender-views-inventory-v216.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) pins[resolve(path)] = await fileState(resolve(path));
  save('start-manifest.json', { runtime: { nodeVersion: process.version, execution: 'REAL_VITEST_READ_ONLY_NORMAL_READERS', fixtureClosureExecuted: false },
    failedReceipt, failedArtifactPins: artifactPins, retainedDataBefore: report.retainedDataBefore, failedDataBefore: report.failedDataBefore,
    parentManifest: pins[resolve(failed, 'start-manifest.json')], closure, digestBundle, harnessPins: pins,
    failedDatabase, stagedDatabase, ownedDatabase, noOriginalDatabaseOpen: true, stopBoundary: report.boundary,
    constraints: ['READ_ONLY_INVENTORY_ONLY', 'NO_PHYSICAL_OR_LIFECYCLE_ACCEPT_API', 'NO_SOURCE_OR_OLD_DATABASE_MUTATION', 'OLD_FAIL_AND_END_UNKNOWN_PRESERVED'] });
  report.startManifestPin = await fileState(resolve(out, 'start-manifest.json')); await pinParent();
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    const pin = report.failedDataBefore[suffix || 'main'];
    if (pin.exists) { copyFileSync(failedDatabase + suffix, stagedDatabase + suffix, constants.COPYFILE_EXCL); assert.deepEqual(await fileState(stagedDatabase + suffix), pin); }
  }
  assert.deepEqual(await databaseFiles(failedDatabase), report.failedDataBefore); await pinParent();
  const digest = (await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  staging = new DatabaseSync(stagedDatabase, { readOnly: true }); staging.exec('PRAGMA query_only=1; BEGIN');
  const stagedLogical = digest(staging); save('failed-logical-with-rowid.json', stagedLogical);
  closeSync(openSync(ownedDatabase, 'wx')); report.backupPages = await backup(staging, ownedDatabase, { source: 'main', target: 'main' });
  staging.exec('ROLLBACK'); staging.close(); staging = null;
  owned = new DatabaseSync(ownedDatabase, { readOnly: true }); owned.exec('PRAGMA query_only=1; BEGIN'); assert.deepEqual(digest(owned), stagedLogical);
  owned.exec('ROLLBACK'); owned.close(); owned = null; beforeOwned = await databaseFiles(ownedDatabase); report.ownedDataBefore = beforeOwned;
  const records = resolve(out, 'records'), log = createWriteStream(resolve(out, 'vitest.log'), { flags: 'wx' });
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tools/verification/native-initial-defender-views-inventory-v216.test.ts', '--testNamePattern', 'NII216-S01', '--maxWorkers=1', '--minWorkers=1'],
    { cwd: root, windowsHide: true, env: { ...process.env, BASEBALL_NATIVE_INITIAL_DEFENDER_INVENTORY_V216_DATABASE: ownedDatabase,
      BASEBALL_NATIVE_INITIAL_DEFENDER_INVENTORY_V216_INPUT: resolve(out, 'execution-input.lossless.json'), BASEBALL_NATIVE_INITIAL_DEFENDER_INVENTORY_V216_OUTPUT: records } });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); report.nativeReadProcessId = child.pid;
  save('native-process.json', { processId: child.pid, records, at: new Date().toISOString(), readOnly: true, noAccept: true });
  const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); });
  await new Promise(done => log.end(done)); report.nativeReadExit = exit; assert.equal(exit.code, 0, 'normal readonly inventory failed');
  const inventory = read(resolve(records, 'inventory.lossless.json')); save('inventory.lossless.json', inventory); report.state = inventory.state;
  report.locatorGuards = read(resolve(records, 'locator-guards.json')); assert.equal(report.locatorGuards.pass, true);
  assert.equal(report.locatorGuards.guards.length, 2); assert(report.locatorGuards.guards.every(guard => guard.rejectedByNormalCalibrationReader && !guard.originalAndInventoryDatabaseMutated));
  assert.equal(inventory.normalCommittedPhaseAuthenticated, true); assert.equal(inventory.readOnly, true); assert.equal(inventory.acceptOperationCalls, 0); assert.equal(inventory.lifecycleAcceptCalls, 0);
  report.currentViewCoversPhysicalHead = inventory.currentViewCoversPhysicalHead; report.missingLifecycleStages = inventory.missingLifecycleStages;
  report.acceptedPlayerIds = inventory.iterations.filter(i => i.cell.observation).map(i => i.playerId);
  report.completedPlayerIds = inventory.iterations.filter(i => i.cell.calibration).map(i => i.playerId);
  report.latestAcceptedViewReference = inventory.latestAcceptedViewReference; report.latestPhysicalReference = inventory.latestPhysicalReference;
  owned = new DatabaseSync(ownedDatabase, { readOnly: true }); owned.exec('PRAGMA query_only=1; BEGIN');
  const after = digest(owned); assert.deepEqual(after, stagedLogical, 'readonly inventory changed logical data');
  const additions = {
    pa_physical_v1_field_steps: inventory.iterations.filter(i => i.cell.observation).map(i => i.observationReference.sourceId),
    pa_lifecycle_v1_work_prefixes: inventory.iterations.filter(i => i.cell.prefix).map(i => i.prefix.source.sourceId),
    pa_lifecycle_v1_total_assessments: inventory.iterations.flatMap(i => i.totals.filter(Boolean).map(t => t.source.sourceId)),
    pa_lifecycle_v1_execution_views: inventory.iterations.filter(i => i.cell.view).map(i => i.view.source.sourceId),
    pa_lifecycle_v1_execution_calibrations: inventory.iterations.filter(i => i.cell.calibration).map(i => i.scopedCalibration.source.sourceId),
  };
  assert.equal(after.catalogSha256, beforeLogical.catalogSha256); assert.deepEqual(after.catalog, beforeLogical.catalog);
  assert.deepEqual(Object.keys(after.tables), Object.keys(beforeLogical.tables));
  const through = Object.create(null);
  for (const [table, ids] of Object.entries(additions)) {
    assert.equal(new Set(ids).size, ids.length); const q = owned.prepare('SELECT rowid AS native_rowid,source_id FROM main.' + table + ' ORDER BY rowid'); q.setReadBigInts(true);
    const rows = q.all(), added = rows.filter(r => ids.includes(r.source_id)); assert.equal(added.length, ids.length);
    through[table] = added.length ? added[0].native_rowid - 1n : rows.at(-1)?.native_rowid ?? 0n;
    assert.deepEqual(rows.filter(r => r.native_rowid > through[table]).map(r => r.source_id).sort(), [...ids].sort());
    assert.equal(after.tables[table].rows - beforeLogical.tables[table].rows, ids.length);
  }
  const oldSubset = digest(owned, through);
  for (const table of Object.keys(beforeLogical.tables)) {
    if (table === 'pa_physical_v1_heads') continue;
    assert.deepEqual(oldSubset.tables[table], beforeLogical.tables[table], 'old immutable rows/rowids changed: ' + table);
  }
  const physical = rawRows(owned, 'pa_physical_v1_heads'), expected = reviveRows(priorHeads);
  const targets = expected.filter(row => row.enrollment_source_id === parent.enrollmentSourceId); assert.equal(targets.length, 1);
  targets[0].operation_ordinal = 7n + BigInt(inventory.state.acceptedObservationCount);
  targets[0].last_owner = inventory.latestPhysicalReference.owner; targets[0].last_source_id = inventory.latestPhysicalReference.sourceId; targets[0].last_snapshot_hash = inventory.latestPhysicalReference.snapshotHash;
  assert.deepEqual(physical, expected); assert.deepEqual(rawRows(owned, 'world_control_heads'), reviveRows(priorWorldHeads));
  save('physical-heads-authenticated.lossless.json', persistRows(physical)); report.appendedRowsSinceV212 = Object.fromEntries(Object.entries(additions).map(([table, ids]) => [table, ids.length]));
  report.appendedRowsSinceV212Total = Object.values(report.appendedRowsSinceV212).reduce((n, count) => n + count, 0);
  report.onlyExpectedPhysicalHeadCasProven = true; report.originalV212RowsRowidsSchemaAndOtherHeadsUnchanged = true;
  report.worldUnchanged = true; report.normalCommittedPhaseAuthenticated = true; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  try { for (const db of [owned, staging]) if (db) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } } catch (error) { report.closeError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    await pinParent(); report.failedDataAfter = await databaseFiles(failedDatabase); assert.deepEqual(report.failedDataAfter, report.failedDataBefore);
    report.retainedDataAfter = {};
    for (const [path, pin] of retainedDatabases) { const actual = await databaseFiles(path); assert.deepEqual(dataPin(actual), dataPin(pin)); report.retainedDataAfter[path] = actual; }
    if (beforeOwned) { report.ownedDataAfter = await databaseFiles(ownedDatabase); assert.deepEqual(dataPin(report.ownedDataAfter), dataPin(beforeOwned)); }
    for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
    for (const bundle of [closure, digestBundle].filter(Boolean)) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
      for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
    }
    assert.deepEqual(await fileState(resolve(out, 'start-manifest.json')), report.startManifestPin);
    report.failedArtifactsAndDataUnchanged = true; report.retainedAncestorDataUnchanged = true; report.sourceHarnessInputAndBundleEndPinsProven = true;
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, state: report.state, missingLifecycleStages: report.missingLifecycleStages,
  appendedRowsSinceV212: report.appendedRowsSinceV212, failedArtifactsAndDataUnchanged: report.failedArtifactsAndDataUnchanged,
  retainedAncestorDataUnchanged: report.retainedAncestorDataUnchanged, originalFailedRunCompleted: false, remainingOnlyRecoveryExecuted: false,
  error: report.error ?? report.closeError ?? report.pinError ?? null }));
