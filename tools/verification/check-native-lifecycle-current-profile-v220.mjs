import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants as fsConstants, copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { compilePinnedNativeEntry, createPinnedNativeCopy, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = realpathSync(process.cwd()), accepted = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? '');
const within = path => { const rel = relative(root, path); return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel); };
assert(process.argv.length === 4 && within(out) && within(realpathSync(dirname(out))) && !existsSync(out), 'accepted V217 directory and new workspace output required');
assert.equal(accepted, resolve('docs/verification/realism-debug-20261027/native-initial-defender-views-recovery-v217-01'));
const pinBytes = bytes => ({ exists: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
const pins = {}, read = path => { const bytes = readFileSync(path); pins[path] = pinBytes(bytes); return parseDebugRecord(bytes.toString('utf8')); };
const acceptedReport = read(resolve(accepted, 'report.json')), parent = read(resolve(accepted, 'start-manifest.json'));
const frontierPath = resolve(accepted, 'records/frontier.lossless.json'), frontier = read(frontierPath);
const receiptPath = resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_ae2a0eb959a945a5a9e69f43e9fdca40.json');
const receipt = read(receiptPath);
assert.equal(receipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN'); assert.equal(receipt.result, 'PASS'); assert.equal(receipt.exit_code, 0);
assert.deepEqual(receipt.command, ['node', 'tools/verification/check-native-initial-defender-views-recovery-v217.mjs', 'work/native-initial-defender-inventory-proof-v216-01', relative(root, accepted).replaceAll('\\', '/')]);
const receiptLog = resolve(receipt.output_path), logBytes = readFileSync(receiptLog); pins[receiptLog] = pinBytes(logBytes); assert.equal(pins[receiptLog].sha256, receipt.output_sha256);
for (const key of ['pass', 'oldRowsRowidsSchemaAndAllOtherHeadsUnchanged', 'combinedV214V217RowsProven', 'finalLifecycleCurrentProven',
  'initialDefenderObservationsAccepted', 'retainedDataUnchanged', 'parentAndNewSourceHarnessInputBundleEndPinsProven']) assert.equal(acceptedReport[key], true);
for (const key of ['performancePass', 'originalFailedRunCompleted', 'originalFailedRunEndPinsClaimed']) assert.equal(acceptedReport[key], false);
assert.deepEqual(acceptedReport.frontier, frontier); assert.deepEqual(frontier.finalCurrent, frontier.finalHistorical);
assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(frontier.initialDefenderObservationCount, 9);
assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 16); assert.equal(frontier.finalCurrent.view.cut.stage, 'field_active');
assert.deepEqual(frontier.currentPhysicalOperation.reference, frontier.finalCurrent.view.cut.physicalOperationReference);
const original = resolve(acceptedReport.ownedPath); assert.equal(original, resolve(accepted, 'initial-defender-recovery-private.sqlite'));
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const assertParentPins = async () => {
  for (const bundle of [parent.bundle, parent.digestBundle]) {
    assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
    for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
  }
  for (const [path, pin] of Object.entries(parent.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
};
await assertParentPins(); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const tree = path => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? tree(resolve(path, item.name)) : [resolve(path, item.name)]).sort();
const report = { pass: false, boundary: 'NATIVE_CURRENT22_SINGLE_GETTER_CPU_PROFILE_ONLY', execution: 'VITEST_ORIGINAL_SOURCE_ENTRY',
  originalPath: original, originalDatabaseOpened: false, nativeAdmissions: 0, ddlDmlExecuted: 0, normalGetterInvocations: null, plannedGetterInvocations: 1, performancePass: false,
  acceptedV217Receipt: receiptPath, acceptedV217Command: receipt.command,
  changeReason: 'NEW_CURRENT22_FIELD_AND_NINE_OBSERVATIONS_GRAPH_NOT_REMEASUREMENT_OF_RESOLVED_CUT11',
  samplingLimit: 'SAMPLING_OVERHEAD_INCLUDED_NOT_UNINSTRUMENTED_OR_WHOLE_MATCH_PERFORMANCE', oldFailedAndUnknownEvidencePreserved: true,
  privateArtifactNotForPublication: true, fixtureClosureExecuted: false, sourceOptimizationApplied: false };
let copy, closure;
try {
  report.originalBefore = await databaseFiles(original); assert.deepEqual(dataPin(report.originalBefore), dataPin(acceptedReport.ownedAfter));
  copy = await createPinnedNativeCopy({ originalPath: original, outputPath: resolve(out, 'current22-profile-readonly.sqlite'), expectedMainSha256: acceptedReport.ownedAfter.main.sha256 });
  // Keep the main-only helper evidence. This WAL-format parent requires its
  // verified empty WAL and SHM pair before the owned readonly connection opens.
  report.mainOnlyCopyEvidence = copy;
  const sourcePairBefore = await databaseFiles(original);
  assert.deepEqual(sourcePairBefore, copy.originalDatabaseAfterCopy);
  assert.deepEqual([...readFileSync(copy.copyPath).subarray(18, 20)], [2, 2], 'accepted current22 main must retain its WAL-format header');
  assert.deepEqual(sourcePairBefore['-wal'], { exists: true, bytes: 0, sha256: createHash('sha256').update(Buffer.alloc(0)).digest('hex') }, 'only the verified empty parent WAL may be paired');
  assert.equal(sourcePairBefore['-shm'].exists, true); assert(sourcePairBefore['-shm'].bytes > 0);
  assert.equal(sourcePairBefore['-journal'].exists, false);
  for (const suffix of ['-wal', '-shm']) {
    copyFileSync(original + suffix, copy.copyPath + suffix, fsConstants.COPYFILE_EXCL);
    assert.deepEqual(await fileState(copy.copyPath + suffix), sourcePairBefore[suffix], 'paired sidecar copy differs');
  }
  const sourcePairAfter = await databaseFiles(original), pairedCopyDatabaseBefore = await databaseFiles(copy.copyPath);
  assert.deepEqual(sourcePairAfter, sourcePairBefore, 'original pair changed during exclusive filesystem copy');
  assert.deepEqual(pairedCopyDatabaseBefore, sourcePairBefore, 'owned main and paired sidecars differ from the verified parent');
  report.pairedCopySupplement = { sourcePairBefore, sourcePairAfter, pairedCopyDatabaseBefore, sidecars: ['-wal', '-shm'], exclusiveFilesystemCopy: true, originalDatabaseOpened: false };
  copy = { ...copy, copyDatabaseBefore: pairedCopyDatabaseBefore };
  report.copy = copy;
  closure = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-lifecycle-current-profile-v220.test.ts', outputPath: resolve(out, 'source-closure-not-executed.mjs') });
  const v219 = ['tools/verification/native-initial-defender-decision-v219.ts', 'tools/verification/native-initial-defender-decision-v219.test.ts', 'tools/verification/check-native-initial-defender-decision-v219.mjs'];
  assert(v219.every(path => !Object.hasOwn(closure.sourcePins, path)), 'V219 source entered the V220 closure');
  const input = { viewReference: frontier.finalViewReference, expectedCurrent: frontier.finalCurrent, expectedPhysicalReference: frontier.currentPhysicalOperation.reference };
  save('execution-input.lossless.json', input); pins[resolve(out, 'execution-input.lossless.json')] = await fileState(resolve(out, 'execution-input.lossless.json'));
  for (const path of ['tools/verification/check-native-lifecycle-current-profile-v220.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) pins[resolve(root, path)] = await fileState(resolve(root, path));
  save('start-manifest.json', { runtime: { nodeVersion: process.version, execution: report.execution, fixtureClosureExecuted: false }, closure, harnessPins: pins,
    acceptedV217Receipt: receiptPath, originalBefore: report.originalBefore, mainOnlyCopyEvidence: report.mainOnlyCopyEvidence,
    pairedCopySupplement: report.pairedCopySupplement, copy, input, changeReason: report.changeReason,
    measurement: { normalGetterInvocations: 1, samplingIntervalMicroseconds: 1000, sqlInstrumentationAdded: false,
      interval: 'PROFILER_START_AFTER_IMPORT_DBOPEN_AND_LOGICAL_DIGEST; STOP_IMMEDIATELY_AFTER_SINGLE_GETTER', loaderSourceCapture: 'ACTUAL_V8_WORKSPACE_SCRIPTS_AFTER_PROFILER_STOP', debuggerEnabledDuringGetter: false },
    constraints: ['ORIGINAL_DB_NOT_OPENED', 'OWNED_COPY_OS_READONLY_QUERY_ONLY', 'NORMAL_OWNER_READER_UNCHANGED', 'ALL_ROWS_ROWIDS_SCHEMA_HEADS_AND_DATA_PINS', 'NO_ADMISSION_DDL_DML', 'NO_PERFORMANCE_ACCEPTANCE'] });
  report.startManifestPin = await fileState(resolve(out, 'start-manifest.json')); await assertParentPins();
  const records = resolve(out, 'records'), log = createWriteStream(resolve(out, 'vitest.log'), { flags: 'wx' });
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tools/verification/native-lifecycle-current-profile-v220.test.ts', '--testNamePattern', 'NCP220-S01', '--maxWorkers=1', '--minWorkers=1'],
    { cwd: root, windowsHide: true, env: { ...process.env, BASEBALL_NATIVE_LIFECYCLE_CURRENT_PROFILE_V220_DATABASE: copy.copyPath,
      BASEBALL_NATIVE_LIFECYCLE_CURRENT_PROFILE_V220_INPUT: resolve(out, 'execution-input.lossless.json'), BASEBALL_NATIVE_LIFECYCLE_CURRENT_PROFILE_V220_OUTPUT: records } });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); report.nativeTestProcessId = child.pid;
  save('native-process.json', { processId: child.pid, at: new Date().toISOString(), records });
  let exit; try { exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); }); }
  finally { await new Promise(done => log.end(done)); }
  report.nativeTestExit = exit;
  if (existsSync(resolve(records, 'report.json'))) { report.nativeReport = read(resolve(records, 'report.json')); report.normalGetterInvocations = report.nativeReport.normalGetterInvocations; }
  assert.equal(exit.code, 0, 'single current22 measurement failed; retain partial profile and records');
  const native = report.nativeReport; assert(native);
  for (const key of ['pass', 'savedV217FullCurrentLosslessEqual', 'normalCurrentReadAccepted', 'actualLoaderSourceCaptured', 'allRowsRowidsCatalogAndHeadsUnchanged', 'authorizerPreserved', 'callerSavepointPreserved']) assert.equal(native[key], true);
  assert.equal(native.normalGetterInvocations, 1); assert.equal(native.performancePass, false); assert.equal(native.newWriterCalls, 0); assert.equal(native.ddlDmlExecuted, 0);
  assert.deepEqual(read(resolve(records, 'current.lossless.json')), frontier.finalCurrent);
  assert.deepEqual(read(resolve(records, 'logical-before-with-rowid.json')), read(resolve(records, 'logical-after-with-rowid.json')));
  const rawProfile = read(resolve(records, 'single-current22-read.cpuprofile')), summary = read(resolve(records, 'profile-summary.json'));
  assert.equal(rawProfile.samples.length, summary.sampleCount); assert(rawProfile.samples.length > 0 && rawProfile.timeDeltas.length === rawProfile.samples.length);
  const loader = read(resolve(records, 'loader-source-manifest.json')); assert.equal(loader.captureAfterProfilerStop, true); assert.equal(loader.debuggerEnabledDuringGetter, false);
  assert.deepEqual(loader.captured.map(s => s.scriptId), loader.sampledWorkspaceScriptIds); assert(loader.captured.length > 0);
  for (const script of loader.captured) assert.deepEqual(await fileState(resolve(records, script.name)), { exists: true, bytes: script.bytes, sha256: script.sha256 });
  report.normalGetterInvocations = 1; report.savedV217FullCurrentLosslessEqual = true; report.allRowsRowidsCatalogAndHeadsUnchanged = true;
  report.getterElapsedMs = native.getterElapsedMs; report.profileSampleCount = summary.sampleCount; report.loaderSourceCount = loader.captured.length;
  report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  try {
    report.outputPins = {}; if (existsSync(resolve(out, 'records'))) for (const path of tree(resolve(out, 'records'))) report.outputPins[path] = await fileState(path);
    report.originalAfter = await databaseFiles(original); assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore));
    report.originalDatabaseDataUnchanged = true; report.originalShmObservation = { before: report.originalBefore?.['-shm'], after: report.originalAfter['-shm'], partOfImmutableDataPin: false };
    if (copy) { report.copyAfter = await databaseFiles(copy.copyPath); assert.deepEqual(dataPin(report.copyAfter), dataPin(copy.copyDatabaseBefore)); report.ownedCopyDataUnchanged = true;
      report.ownedCopyShmObservation = { before: copy.copyDatabaseBefore['-shm'], after: report.copyAfter['-shm'], partOfImmutableDataPin: false }; }
    if (closure) {
      assert.deepEqual(await fileState(closure.bundlePath), { exists: true, bytes: closure.bytes, sha256: closure.sha256 });
      report.sourcePins = {};
      for (const [path, pin] of Object.entries(closure.sourcePins)) { const end = await fileState(resolve(root, path)); assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); report.sourcePins[path] = { ...pin, endSha256: end.sha256 }; }
      report.sourceAndClosureEndPinsProven = true;
    }
    await assertParentPins(); report.parentAndHarnessEndPinsProven = true;
    if (report.startManifestPin) assert.deepEqual(await fileState(resolve(out, 'start-manifest.json')), report.startManifestPin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, boundary: report.boundary, normalGetterInvocations: report.normalGetterInvocations,
  getterElapsedMs: report.getterElapsedMs, profileSampleCount: report.profileSampleCount, loaderSourceCount: report.loaderSourceCount,
  originalDatabaseOpened: false, savedV217FullCurrentLosslessEqual: report.savedV217FullCurrentLosslessEqual, performancePass: false,
  sourceAndClosureEndPinsProven: report.sourceAndClosureEndPinsProven, parentAndHarnessEndPinsProven: report.parentAndHarnessEndPinsProven, error: report.error ?? report.pinError ?? null }));
