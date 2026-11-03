import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), failed = resolve(process.argv[2] ?? ''), gateReportPath = resolve(process.argv[3] ?? ''), out = resolve(process.argv[4] ?? ''), rel = relative(root, out);
assert(process.argv.length === 5 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'retained suffix directory, gate report and new output required');
const original = resolve(failed, 'suffix-private.sqlite'), gate = parseDebugRecord(readFileSync(gateReportPath, 'utf8')), baseline = resolve(gate.copyPath);
assert(gate.pass && gate.currentCoverageProven && existsSync(original) && existsSync(baseline)); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const commitmentPath = resolve(failed, 'records/checkpoint-58-before-native-commitment.lossless.json');
const resolutionPath = resolve(failed, 'records/checkpoint-68-advance-11-start.lossless.json');
const before = parseDebugRecord(readFileSync(commitmentPath, 'utf8')), after = parseDebugRecord(readFileSync(resolutionPath, 'utf8'));
const pins = { actorReference: before.actorReference, resolutionReference: after.eventReference, inputReference: before.inputReference,
  qualificationReferences: before.qualificationReferences, originalInput: before.input };
assert.equal(pins.resolutionReference.owner, 'pa_physical_v1_resolutions'); assert.equal(before.inventory.effectiveStateId, 'GOLD');
const report = { pass: false, boundary: 'READONLY_ACCEPTED_NATIVE_SPIN_NEUTRAL_CONTACT_RECOVERY_ONLY', originalPath: original,
  baselinePath: baseline, newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0, newLifecycleWrites: 0,
  originalSuffixReceipt: 'f7d6a03c90074cd48a7addc2f0988ef4', originalSuffixResult: 'TIMEOUT', originalExecutionSourceEndPin: 'UNKNOWN',
  lifecycleAfterResolutionCurrentProven: false, performancePass: false, privateArtifactNotForPublication: true, stages: [] };
const stage = (name, value) => { const s = { name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
  report.stages.push(s); save('stage-' + report.stages.length + '.json', s); if (value !== undefined) save('record-' + report.stages.length + '-' + name + '.lossless.json', value);
  console.log(JSON.stringify(s)); };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let db, bundle;
try {
  report.originalBefore = await databaseFiles(original); report.baselineBefore = await databaseFiles(baseline);
  assert.deepEqual(dataPin(report.baselineBefore), dataPin(gate.copyAfter), 'original cut4 baseline changed during the timed-out suffix');
  report.harnessPins = {};
  for (const path of [commitmentPath, resolutionPath, gateReportPath, resolve(failed, 'source-closure-not-executed.mjs'),
    'tools/verification/check-NativeSpinNeutralV193-recover.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs'])
    report.harnessPins[path] = await fileState(resolve(root, path));
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-recover.ts', outputPath: resolve(out, 'recovery-bundle.mjs') });
  // Save before importing the entry or opening SQLite: a timeout must not lose
  // the only copy of the beginning Source/bundle/runtime/harness pins again.
  save('start-manifest.json', { boundary: report.boundary, runtime: { execution: 'NODE_READONLY_NORMAL_NATIVE_OWNER_REAUTHENTICATION', nodeVersion: process.version,
    closureExecution: 'RECOVERY_BUNDLE_ONLY', originalVitestSourceEndPin: 'UNKNOWN' }, bundle, harnessPins: report.harnessPins,
    originalBefore: report.originalBefore, baselineBefore: report.baselineBefore, pins });
  const api = await import(pathToFileURL(bundle.bundlePath).href);
  db = new DatabaseSync(original, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN');
  const logicalBefore = api.rawNativeSpinNeutralSqlDigestV193(db); save('logical-before-with-rowid.json', logicalBefore);
  const stamps = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get().query_only,
    totalChanges: db.prepare('SELECT total_changes() n').get().n, schemaVersion: db.prepare('PRAGMA main.schema_version').get().schema_version });
  report.callerBefore = stamps(); stage('readonly-normal-native-authentication-start');
  const result = api.recoverNativeSpinNeutralV193AcceptedContact(db, pins, stage);
  save('actual-recovered-native-records.lossless.json', result.records); report.summary = result.summary;
  assert(result.summary.consumerAdoptionProven && result.summary.actualContactCount === 1 && result.summary.ordinaryExecutionEqual);
  assert.deepEqual(stamps(), report.callerBefore); assert.deepEqual(api.rawNativeSpinNeutralSqlDigestV193(db), logicalBefore);
  report.callerAfter = stamps(); report.allRowsRowidAndCatalogUnchanged = true;
  db.exec('ROLLBACK'); db.close(); db = null; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (db) try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
    catch (error) { report.cleanupError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    report.originalAfter = await databaseFiles(original); report.baselineAfter = await databaseFiles(baseline);
    assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore)); assert.deepEqual(dataPin(report.baselineAfter), dataPin(report.baselineBefore));
    report.originalDataUnchanged = true; report.baselineDataUnchanged = true;
    report.shmObservation = { originalBefore: report.originalBefore['-shm'], originalAfter: report.originalAfter['-shm'],
      baselineBefore: report.baselineBefore['-shm'], baselineAfter: report.baselineAfter['-shm'] };
    if (bundle) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
      report.sourcePins = {};
      for (const [path, pin] of Object.entries(bundle.sourcePins)) { const end = await fileState(resolve(root, path));
        assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); report.sourcePins[path] = { ...pin, endSha256: end.sha256 }; }
      report.recoverySourceAndBundleEndPinProven = true; report.bundle = { inputCount: bundle.inputCount, sha256: bundle.sha256 };
    }
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, summary: report.summary, originalDataUnchanged: report.originalDataUnchanged,
  allRowsRowidAndCatalogUnchanged: report.allRowsRowidAndCatalogUnchanged, recoverySourceAndBundleEndPinProven: report.recoverySourceAndBundleEndPinProven,
  originalExecutionSourceEndPin: report.originalExecutionSourceEndPin, error: report.error ?? report.pinError ?? null }));
