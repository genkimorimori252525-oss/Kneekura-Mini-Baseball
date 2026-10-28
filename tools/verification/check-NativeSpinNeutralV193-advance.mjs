import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), input = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? ''), rel = relative(root, out);
assert(process.argv.length === 4 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'backup report and new workspace output required');
const retained = parseDebugRecord(readFileSync(input, 'utf8'));
assert(retained.backupConsistent === true && retained.ownerAuthenticationComplete === false, 'expected retained backup/authentication failure');
const original = resolve(retained.originalPath), saved = resolve(retained.copyPath), destination = resolve(out, 'advance-private.sqlite');
assert(existsSync(original) && existsSync(saved), 'both retained databases must exist');
mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, boundary: 'NATIVE_POST_OBSERVATION_ADVANCE_GATE_ONLY', originalPath: original, retainedCopyPath: saved,
  copyPath: destination, inputReport: input, practiceRegenerated: false, physicalOperationCreated: false, currentCoverageProven: false,
  consumerAdoptionProven: false, performancePass: false, privateArtifactNotForPublication: true, stages: [] };
const stage = (name, value) => {
  const entry = { name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
  report.stages.push(entry); save('stage-' + report.stages.length + '.json', entry);
  if (value !== undefined) save('record-' + report.stages.length + '-' + name + '.lossless.json', value);
  console.log(JSON.stringify(entry));
};
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let source, savedDb, target, bundle;
try {
  report.originalBefore = await databaseFiles(original); report.retainedBefore = await databaseFiles(saved);
  assert.deepEqual(dataPin(report.originalBefore), dataPin(retained.originalBefore), 'original02 data differs from the retained backup receipt');
  assert.deepEqual(dataPin(report.retainedBefore), dataPin(retained.copyBeforeAuthentication), 'retained copy differs from its authentication receipt');
  report.harnessPins = {};
  for (const path of [input, 'tools/verification/check-NativeSpinNeutralV193-advance.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs'])
    report.harnessPins[path] = await fileState(resolve(root, path));
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-advance.ts', outputPath: resolve(out, 'advance-bundle.mjs') });
  const api = await import(pathToFileURL(bundle.bundlePath).href), digest = api.rawNativeSpinNeutralSqlDigestV193;
  source = new DatabaseSync(original, { readOnly: true }); source.exec('PRAGMA query_only=1; BEGIN');
  const originalDigest = digest(source); save('original02-logical-with-rowid.json', originalDigest);
  source.exec('ROLLBACK'); source.close(); source = null;
  savedDb = new DatabaseSync(saved, { readOnly: true }); savedDb.exec('PRAGMA query_only=1; BEGIN');
  const retainedDigest = digest(savedDb); save('retained-copy-logical-with-rowid.json', retainedDigest);
  assert.deepEqual(retainedDigest, originalDigest, 'stored columns, rowid or catalog differ between original02 and retained copy');
  report.originalAndRetainedRowidExact = true; stage('original02-and-retained-copy-rowid-exact');
  assert(!existsSync(destination)); closeSync(openSync(destination, 'wx'));
  report.backupPages = await backup(savedDb, destination, { source: 'main', target: 'main' });
  savedDb.exec('ROLLBACK'); savedDb.close(); savedDb = null;
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  assert.deepEqual(digest(target), retainedDigest, 'new owned copy differs from retained copy');
  // Only these four immutable lifecycle tables may append. The normal store
  // has INSERTs only; no World/workload/physical head is changed by this gate.
  const appendTables = ['pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_views', 'pa_lifecycle_v1_execution_calibrations'];
  const through = Object.create(null);
  for (const table of appendTables) {
    const query = target.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.' + table); query.setReadBigInts(true);
    const row = query.get(); assert(row.lo === null || row.lo > 0n, 'positive owner rowid required for append comparison'); through[table] = row.hi ?? 0n;
  }
  report.appendOnlyTables = appendTables; report.priorRowidThrough = Object.fromEntries(Object.entries(through).map(([key, value]) => [key, String(value)]));
  target.exec('ROLLBACK'); target.close(); target = null;
  report.copyBeforeAdvance = await databaseFiles(destination); stage('new-owned-copy-authentication-start');
  const frontier = api.advanceNativeSpinNeutralV193PostObservation(destination, stage);
  assert.equal(frontier.currentCoverageProven, true); save('frontier.lossless.json', frontier); report.frontier = frontier;
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  const after = digest(target); save('after-advance-logical-with-rowid.json', after);
  assert.deepEqual(digest(target, through), retainedDigest, 'prior rows, non-lifecycle tables or catalog changed');
  report.appendedRows = Object.fromEntries(appendTables.map(table => [table, after.tables[table].rows - retainedDigest.tables[table].rows]));
  assert(report.appendedRows.pa_lifecycle_v1_work_prefixes >= 0 && report.appendedRows.pa_lifecycle_v1_execution_views === 1);
  target.exec('ROLLBACK'); target.close(); target = null;
  report.currentCoverageProven = true; report.existingRowsAndCatalogUnchanged = true; report.pass = true; stage('current-coverage-gate-passed');
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  for (const db of [source, savedDb, target]) if (db) try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
    catch (error) { report.cleanupError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    report.originalAfter = await databaseFiles(original); report.retainedAfter = await databaseFiles(saved); report.copyAfter = await databaseFiles(destination);
    assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore));
    assert.deepEqual(dataPin(report.retainedAfter), dataPin(report.retainedBefore));
    report.originalDataUnchanged = true; report.retainedCopyDataUnchanged = true;
    report.shmObservation = { originalBefore: report.originalBefore['-shm'], originalAfter: report.originalAfter['-shm'],
      retainedBefore: report.retainedBefore['-shm'], retainedAfter: report.retainedAfter['-shm'] };
    if (bundle) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
      report.bundle = { inputCount: bundle.inputCount, sha256: bundle.sha256 }; report.sourcePins = {};
      for (const [path, pin] of Object.entries(bundle.sourcePins)) {
        const end = await fileState(resolve(root, path)); assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
        report.sourcePins[path] = { ...pin, endSha256: end.sha256 };
      }
    }
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, currentCoverageProven: report.currentCoverageProven, originalAndRetainedRowidExact: report.originalAndRetainedRowidExact,
  originalDataUnchanged: report.originalDataUnchanged, retainedCopyDataUnchanged: report.retainedCopyDataUnchanged, error: report.error ?? report.pinError ?? null }));
