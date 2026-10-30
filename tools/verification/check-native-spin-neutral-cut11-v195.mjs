import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), failed = resolve(process.argv[2] ?? ''), recoveryPath = resolve(process.argv[3] ?? ''), out = resolve(process.argv[4] ?? ''), rel = relative(root, out);
assert(process.argv.length === 5 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'retained suffix, recovery report and new workspace output required');
const original = resolve(failed, 'suffix-private.sqlite'), destination = resolve(out, 'cut11-private.sqlite');
const recovery = parseDebugRecord(readFileSync(recoveryPath, 'utf8'));
assert(recovery.pass && recovery.originalDataUnchanged && resolve(recovery.originalPath) === original);
const inputFiles = ['checkpoint-58-before-native-commitment.lossless.json', 'checkpoint-66-advance-10-accepted.lossless.json', 'checkpoint-68-advance-11-start.lossless.json']
  .map(name => resolve(failed, 'records', name));
const [beforeCommitment, cut10, append] = inputFiles.map(path => parseDebugRecord(readFileSync(path, 'utf8')));
const input = { actorReference: beforeCommitment.actorReference, resolutionReference: append.eventReference, priorViewReference: cut10.viewReference,
  expectedPrefixSource: { ...cut10.prefix.source, sourceId: 'physical-fixture:cut11:prefix', eventReferences: append.eventReferences } };
assert.equal(input.resolutionReference.owner, 'pa_physical_v1_resolutions'); assert.equal(input.priorViewReference.sourceId, 'physical-fixture:cut10:view');
assert(existsSync(original)); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const appendTables = ['pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_views', 'pa_lifecycle_v1_execution_calibrations'];
const report = { pass: false, boundary: 'NATIVE_CUT11_LIFECYCLE_COMPLETION_ONLY', originalPath: original, copyPath: destination,
  execution: 'PINNED_NODE_ENTRY', changeReason: 'NEW_NORMAL_LIFECYCLE_COMPLETION_STEP', newPhysicalOperationsAccepted: 0,
  newPracticeAccepted: 0, suffixScenarioReexecuted: false, performancePass: false, originalSuffixSourceEndPin: 'UNKNOWN',
  privateArtifactNotForPublication: true, stages: [] };
const stage = (name, value) => { const s = { name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
  report.stages.push(s); save('stage-' + report.stages.length + '.json', s); if (value !== undefined) save('checkpoint-' + report.stages.length + '-' + name + '.lossless.json', value);
  console.log(JSON.stringify(s)); };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let source, target, bundle;
try {
  report.originalBefore = await databaseFiles(original); assert.deepEqual(dataPin(report.originalBefore), dataPin(recovery.originalAfter), 'retained suffix data changed since normal recovery');
  report.harnessPins = {};
  for (const path of [...inputFiles, recoveryPath, 'tools/verification/check-native-spin-neutral-cut11-v195.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) report.harnessPins[path] = await fileState(resolve(root, path));
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-spin-neutral-cut11-v195.ts', outputPath: resolve(out, 'cut11-bundle.mjs') });
  // Prefix11's snapshotHash was not saved by stage69. Keep its declaration and
  // known prior fullrefs here; only its normal reader may provide that fullref.
  save('start-manifest.json', { runtime: { execution: report.execution, nodeVersion: process.version, originalSuffixSourceEndPin: 'UNKNOWN' },
    bundle, harnessPins: report.harnessPins, originalBefore: report.originalBefore, input,
    pendingPrefixLocator: { owner: 'pa_lifecycle_v1_work_prefixes', sourceId: 'physical-fixture:cut11:prefix', fullReferenceRequiresNormalReader: true },
    retainedQualificationReferences: beforeCommitment.qualificationReferences, priorCalibrationReferences: cut10.calibrationSet.calibrationReferences });
  const api = await import(pathToFileURL(bundle.bundlePath).href), digest = api.rawNativeSpinNeutralSqlDigestV193;
  source = new DatabaseSync(original, { readOnly: true }); source.exec('PRAGMA query_only=1; BEGIN');
  const before = digest(source); save('original-logical-with-rowid.json', before);
  const through = Object.create(null);
  for (const table of appendTables) {
    const query = source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.' + table); query.setReadBigInts(true);
    const row = query.get(); assert(row.lo === null || row.lo > 0n); through[table] = row.hi ?? 0n;
  }
  report.priorRowidThrough = Object.fromEntries(Object.entries(through).map(([key, value]) => [key, String(value)]));
  assert(!existsSync(destination)); closeSync(openSync(destination, 'wx'));
  report.backupPages = await backup(source, destination, { source: 'main', target: 'main' });
  source.exec('ROLLBACK'); source.close(); source = null;
  report.originalAfterBackup = await databaseFiles(original); assert.deepEqual(dataPin(report.originalAfterBackup), dataPin(report.originalBefore));
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  assert.deepEqual(digest(target), before, 'consistent copy rows, rowids or catalog differ'); target.exec('ROLLBACK'); target.close(); target = null;
  report.copyBeforeCompletion = await databaseFiles(destination); stage('consistent-owned-copy-authenticated');
  const frontier = api.completeNativeSpinNeutralCut11V195(destination, input, stage); save('frontier.lossless.json', frontier); report.frontier = frontier;
  assert.equal(frontier.currentCoverageProven, true); assert.equal(frontier.calibrationCount, 32);
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  const after = digest(target); save('completed-logical-with-rowid.json', after);
  assert.deepEqual(digest(target, through), before, 'existing rows/rowids/catalog or a non-append table changed');
  report.appendedRows = Object.fromEntries(appendTables.map(table => [table, after.tables[table].rows - before.tables[table].rows]));
  assert.equal(report.appendedRows.pa_lifecycle_v1_work_prefixes, 0, 'stored prefix11 must exact-replay');
  assert([0, frontier.participantCount].includes(report.appendedRows.pa_lifecycle_v1_total_assessments));
  assert([0, 1].includes(report.appendedRows.pa_lifecycle_v1_execution_views));
  assert([0, 32].includes(report.appendedRows.pa_lifecycle_v1_execution_calibrations));
  target.exec('ROLLBACK'); target.close(); target = null;
  report.existingRowsRowidAndCatalogUnchanged = true; report.onlyFourLifecycleAppendTablesChanged = true; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  for (const db of [source, target]) if (db) try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
    catch (error) { report.cleanupError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    report.originalAfter = await databaseFiles(original); report.copyAfter = await databaseFiles(destination);
    assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore)); report.originalDataUnchanged = true;
    report.shmObservation = { before: report.originalBefore['-shm'], afterBackup: report.originalAfterBackup?.['-shm'], after: report.originalAfter['-shm'] };
    if (bundle) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 }); report.sourcePins = {};
      for (const [path, pin] of Object.entries(bundle.sourcePins)) { const end = await fileState(resolve(root, path));
        assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); report.sourcePins[path] = { ...pin, endSha256: end.sha256 }; }
      report.sourceAndBundleEndPinProven = true; report.bundle = { inputCount: bundle.inputCount, sha256: bundle.sha256 };
    }
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, currentCoverageProven: report.frontier?.currentCoverageProven, appendedRows: report.appendedRows,
  originalDataUnchanged: report.originalDataUnchanged, existingRowsRowidAndCatalogUnchanged: report.existingRowsRowidAndCatalogUnchanged,
  sourceAndBundleEndPinProven: report.sourceAndBundleEndPinProven, error: report.error ?? report.pinError ?? null }));
