import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { constants as fsConstants, copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { compilePinnedNativeEntry, createPinnedNativeCopy, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = realpathSync(process.cwd()), leg = process.argv[2], accepted = resolve(process.argv[3] ?? ''), out = resolve(process.argv[4] ?? '');
const within = path => { const rel = relative(root, path); return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel); };
assert((leg === 'OLD' && process.argv.length === 5 || leg === 'NEW' && process.argv.length === 7)
  && within(out) && within(realpathSync(dirname(out))) && !existsSync(out), 'OLD|NEW, accepted V217 directory, new workspace output, and NEW-only OLD directory/receipt required');
assert.equal(accepted, resolve('docs/verification/realism-debug-20261027/native-initial-defender-views-recovery-v217-01'));
const script = 'tools/verification/check-native-lifecycle-claim-metadata-compare-v221.mjs';
const entry = 'tools/verification/native-lifecycle-claim-metadata-compare-v221.test.ts';
const claimGuard = 'src/host/world/SamePlateAppearanceLifecycleClaimGuard.ts';
const baselineDirectory = resolve('work/native-lifecycle-claim-metadata-v221-baseline');
const pinBytes = bytes => ({ exists: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
const pins = {}, read = path => { const bytes = readFileSync(path); pins[path] = pinBytes(bytes); return parseDebugRecord(bytes.toString('utf8')); };
const verifyReceipt = (path, command) => {
  const receipt = read(path); assert.equal(receipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN');
  assert.equal(receipt.result, 'PASS'); assert.equal(receipt.exit_code, 0); assert.deepEqual(receipt.command, command);
  const log = resolve(receipt.output_path), bytes = readFileSync(log); pins[log] = pinBytes(bytes); assert.equal(pins[log].sha256, receipt.output_sha256); return receipt;
};
const acceptedReport = read(resolve(accepted, 'report.json')), parent = read(resolve(accepted, 'start-manifest.json'));
const frontier = read(resolve(accepted, 'records/frontier.lossless.json'));
const receiptPath = resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_ae2a0eb959a945a5a9e69f43e9fdca40.json');
const acceptedCommand = ['node', 'tools/verification/check-native-initial-defender-views-recovery-v217.mjs', 'work/native-initial-defender-inventory-proof-v216-01', relative(root, accepted).replaceAll('\\', '/')];
verifyReceipt(receiptPath, acceptedCommand);
for (const key of ['pass', 'oldRowsRowidsSchemaAndAllOtherHeadsUnchanged', 'combinedV214V217RowsProven', 'finalLifecycleCurrentProven',
  'initialDefenderObservationsAccepted', 'retainedDataUnchanged', 'parentAndNewSourceHarnessInputBundleEndPinsProven']) assert.equal(acceptedReport[key], true);
assert.equal(acceptedReport.performancePass, false); assert.deepEqual(acceptedReport.frontier, frontier); assert.deepEqual(frontier.finalCurrent, frontier.finalHistorical);
assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(frontier.initialDefenderObservationCount, 9);
assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 16); assert.equal(frontier.finalCurrent.view.cut.stage, 'field_active');
assert.deepEqual(frontier.currentPhysicalOperation.reference, frontier.finalCurrent.view.cut.physicalOperationReference);
const v220 = read(resolve('docs/verification/realism-debug-20261027/native-lifecycle-current-profile-v220-01/start-manifest.json'));
const baseline = read(resolve(baselineDirectory, 'manifest.json'));
const baselinePath = resolve(baseline.baselinePath), baselineBytes = readFileSync(baselinePath);
pins[baselinePath] = pinBytes(baselineBytes); assert.equal(baseline.sourcePath, claimGuard); assert.deepEqual(pins[baselinePath], baseline.sourcePin);
assert.equal(baseline.productionEdited, false); assert.equal(baseline.parents.length, 2);
for (const source of baseline.parents) { assert.deepEqual(await fileState(resolve(source.path)), source.pin); for (const pin of source.sourcePins) assert.deepEqual({ exists: true, bytes: pin.bytes, sha256: pin.sha256 }, baseline.sourcePin); }
const facts = { viewReference: frontier.finalViewReference, expectedCurrent: frontier.finalCurrent, expectedPhysicalReference: frontier.currentPhysicalOperation.reference };
const comparisonFactsPin = pinBytes(Buffer.from(stringifyDebugRecord(facts) + '\n'));
const inspectorFlags = [...process.execArgv, process.env.NODE_OPTIONS ?? ''].join(' ');
assert(!/(?:^|\s)--inspect(?:-brk|-wait)?(?:=|\s|$)/.test(inspectorFlags), 'Inspector is forbidden in both comparison legs');
const runtime = { nodeVersion: process.version, execArgv: process.execArgv, platform: process.platform, arch: process.arch,
  affectingEnvironment: Object.fromEntries(['NODE_OPTIONS', 'NODE_V8_COVERAGE', 'UV_THREADPOOL_SIZE', 'TZ'].map(name => [name, process.env[name] ?? null])),
  execution: 'VITEST_ORIGINAL_SOURCE_ENTRY', fixtureClosureExecuted: false };
const measurement = { normalGetterInvocations: 1, inspectorUsed: false, sqlInstrumentationAdded: false, ownerReadWarmupInvocations: 0,
  interval: 'HRTIME_IMMEDIATELY_BEFORE_SINGLE_NORMAL_GETTER_TO_FINALLY_AFTER_RETURN; IMPORT_DBOPEN_AND_LOGICAL_DIGEST_EXCLUDED',
  cacheCondition: 'FIRST_NORMAL_GETTER_AFTER_READONLY_LOGICAL_DIGEST_NO_OWNER_READ_WARMUP' };
let oldReport, oldManifest, exceptionProof;
const assertClaimGuard = async expectedParentPin => {
  assert.deepEqual({ exists: true, bytes: expectedParentPin.bytes, sha256: expectedParentPin.sha256 }, baseline.sourcePin, 'parent ClaimGuard does not match the preserved original bytes');
  assert.deepEqual(await fileState(resolve(claimGuard)), leg === 'OLD' ? baseline.sourcePin : exceptionProof.currentPin);
};
if (leg === 'NEW') {
  const oldDirectory = resolve(process.argv[5]), oldReceiptPath = resolve(process.argv[6]); assert(within(oldDirectory) && oldDirectory !== out);
  oldReport = read(resolve(oldDirectory, 'report.json')); oldManifest = read(resolve(oldDirectory, 'start-manifest.json'));
  const oldCommand = ['node', script, 'OLD', relative(root, accepted).replaceAll('\\', '/'), relative(root, oldDirectory).replaceAll('\\', '/')];
  verifyReceipt(oldReceiptPath, oldCommand);
  assert.equal(oldReport.leg, 'OLD'); assert.equal(oldManifest.leg, 'OLD'); assert.equal(oldReport.normalGetterInvocations, 1);
  for (const key of ['pass', 'childClosed', 'savedV217FullCurrentLosslessEqual', 'allRowsRowidsCatalogAndHeadsUnchanged', 'originalDatabaseDataUnchanged',
    'ownedCopyDataUnchanged', 'sourceAndClosureEndPinsProven', 'parentAndHarnessEndPinsProven']) assert.equal(oldReport[key], true);
  assert.equal(oldReport.inspectorUsed, false); assert.equal(oldReport.performancePass, false); assert.equal(oldReport.nativeTestExit.code, 0);
  assert.deepEqual(await fileState(resolve(oldDirectory, 'start-manifest.json')), oldReport.startManifestPin);
  assert.deepEqual(await fileState(resolve(oldDirectory, 'vitest.log')), oldReport.vitestLogPin);
  assert.deepEqual(await fileState(resolve(oldDirectory, 'native-process.json')), oldReport.nativeProcessPin);
  for (const [path, pin] of Object.entries(oldReport.outputPins)) assert.deepEqual(await fileState(path), pin);
  assert.deepEqual(oldManifest.runtime, runtime); assert.deepEqual(oldManifest.measurement, measurement); assert.deepEqual(oldManifest.comparisonFactsPin, comparisonFactsPin);
  assert.deepEqual(read(resolve(oldDirectory, 'comparison-facts.lossless.json')), facts);
  assert.deepEqual(read(resolve(oldDirectory, 'records/current.lossless.json')), facts.expectedCurrent);
  exceptionProof = read(resolve(baselineDirectory, 'source-equivalence-proof.json'));
  assert.equal(exceptionProof.pass, true); assert.equal(exceptionProof.sourcePath, claimGuard); assert.equal(resolve(exceptionProof.baselinePath), baselinePath);
  assert.deepEqual(exceptionProof.baselinePin, baseline.sourcePin); assert.deepEqual(exceptionProof.oldReceiptPin, pins[oldReceiptPath]);
  assert.deepEqual(exceptionProof.oldReportPin, pins[resolve(oldDirectory, 'report.json')]); assert.deepEqual(exceptionProof.oldStartManifestPin, oldReport.startManifestPin);
  const original = baselineBytes.toString('utf8'), currentBytes = readFileSync(resolve(claimGuard));
  assert.deepEqual(Buffer.from(original), baselineBytes); assert.deepEqual(pinBytes(currentBytes), exceptionProof.currentPin);
  const regions = { metadata: original.slice(original.indexOf('  const metadata ='), original.indexOf('  const references =')),
    directIds: original.slice(original.indexOf('  const directIds ='), original.indexOf('  const cache =')) };
  assert.deepEqual(exceptionProof.transformations.map(t => t.region), ['metadata', 'directIds']);
  let reversed = currentBytes.toString('utf8');
  for (const transform of [...exceptionProof.transformations].reverse()) {
    assert.equal(transform.originalBlock, regions[transform.region]); assert(transform.originalBlock.length > 0 && typeof transform.replacementBlock === 'string' && transform.replacementBlock.length > 0);
    const at = reversed.indexOf(transform.replacementBlock); assert(at >= 0 && at === reversed.lastIndexOf(transform.replacementBlock), 'replacement block must occur exactly once');
    reversed = reversed.slice(0, at) + transform.originalBlock + reversed.slice(at + transform.replacementBlock.length);
  }
  assert.deepEqual(Buffer.from(reversed), baselineBytes, 'ClaimGuard changed outside the two approved literal regions');
  const regression = exceptionProof.metadataRegression, regressionReceipt = read(resolve(regression.receiptPath));
  assert.equal(regressionReceipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN'); assert.equal(regressionReceipt.result, 'PASS'); assert.equal(regressionReceipt.exit_code, 0);
  assert(regressionReceipt.command.includes('src/host/world/SamePaLifecycleClaimMetadataBatchV221.test.ts'));
  verifyReceipt(resolve(regression.receiptPath), regressionReceipt.command);
  assert.deepEqual(await fileState(resolve('src/host/world/SamePaLifecycleClaimMetadataBatchV221.test.ts')), regression.testPin);
}
const assertParentPins = async () => {
  for (const bundle of [parent.bundle, parent.digestBundle, v220.closure]) {
    assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
    for (const [path, pin] of Object.entries(bundle.sourcePins)) {
      if (path === claimGuard) await assertClaimGuard(pin);
      else assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
    }
  }
  for (const harness of [parent.harnessPins, v220.harnessPins]) for (const [path, pin] of Object.entries(harness)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
};
await assertParentPins(); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const tree = path => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? tree(resolve(path, item.name)) : [resolve(path, item.name)]).sort();
const original = resolve(acceptedReport.ownedPath); assert.equal(original, resolve(accepted, 'initial-defender-recovery-private.sqlite'));
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, leg, boundary: 'NATIVE_CURRENT22_CLAIM_METADATA_UNSAMPLED_COMPARISON_ONLY', execution: runtime.execution,
  originalPath: original, originalDatabaseOpened: false, nativeAdmissions: 0, ddlDmlExecuted: 0, normalGetterInvocations: null, plannedGetterInvocations: 1,
  inspectorUsed: false, sqlInstrumentationAdded: false, performancePass: false, childClosed: false, comparisonFactsPin,
  acceptedV217Receipt: receiptPath, changeReason: 'OLD_NEW_SAME_CURRENT22_INPUT_ONE_TYPED_METADATA_SQL_CHANGE; V220_SAMPLING_TIME_IS_NOT_THE_OLD_BASELINE',
  measurementLimit: 'SINGLE_PAIR_NOT_STATISTICAL_OR_WHOLE_MATCH_PERFORMANCE_ACCEPTANCE', oldFailedAndUnknownEvidencePreserved: true,
  privateArtifactNotForPublication: true, fixtureClosureExecuted: false, sourceOptimizationApplied: leg === 'NEW' };
let copy, closure;
try {
  report.originalBefore = await databaseFiles(original); assert.deepEqual(dataPin(report.originalBefore), dataPin(acceptedReport.ownedAfter));
  copy = await createPinnedNativeCopy({ originalPath: original, outputPath: resolve(out, 'current22-comparison-readonly.sqlite'), expectedMainSha256: acceptedReport.ownedAfter.main.sha256 });
  report.mainOnlyCopyEvidence = copy;
  const sourcePairBefore = await databaseFiles(original); assert.deepEqual(sourcePairBefore, copy.originalDatabaseAfterCopy);
  assert.deepEqual([...readFileSync(copy.copyPath).subarray(18, 20)], [2, 2]);
  assert.deepEqual(sourcePairBefore['-wal'], { exists: true, bytes: 0, sha256: createHash('sha256').update(Buffer.alloc(0)).digest('hex') });
  assert.equal(sourcePairBefore['-shm'].exists, true); assert(sourcePairBefore['-shm'].bytes > 0); assert.equal(sourcePairBefore['-journal'].exists, false);
  for (const suffix of ['-wal', '-shm']) {
    copyFileSync(original + suffix, copy.copyPath + suffix, fsConstants.COPYFILE_EXCL);
    assert.deepEqual(await fileState(copy.copyPath + suffix), sourcePairBefore[suffix]);
  }
  const sourcePairAfter = await databaseFiles(original), pairedCopyDatabaseBefore = await databaseFiles(copy.copyPath);
  assert.deepEqual(sourcePairAfter, sourcePairBefore); assert.deepEqual(pairedCopyDatabaseBefore, sourcePairBefore);
  report.pairedCopySupplement = { sourcePairBefore, sourcePairAfter, pairedCopyDatabaseBefore, sidecars: ['-wal', '-shm'], exclusiveFilesystemCopy: true, originalDatabaseOpened: false };
  copy = { ...copy, copyDatabaseBefore: pairedCopyDatabaseBefore }; report.copy = copy;
  if (oldManifest) assert.deepEqual(copy.copyDatabaseBefore, oldManifest.copy.copyDatabaseBefore, 'both legs must start from the same original four-file pair');
  closure = await compilePinnedNativeEntry({ root, entryPath: entry, outputPath: resolve(out, 'source-closure-not-executed.mjs') });
  if (oldManifest) {
    assert.deepEqual(Object.keys(closure.sourcePins).sort(), Object.keys(oldManifest.closure.sourcePins).sort());
    for (const [path, pin] of Object.entries(oldManifest.closure.sourcePins)) {
      if (path === claimGuard) { assert.deepEqual({ exists: true, bytes: pin.bytes, sha256: pin.sha256 }, baseline.sourcePin); await assertClaimGuard(pin); }
      else assert.deepEqual(closure.sourcePins[path], pin, 'comparison Source changed outside ClaimGuard');
    }
    for (const path of [script, 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) assert.deepEqual(await fileState(resolve(path)), oldManifest.harnessPins[resolve(path)]);
  }
  save('comparison-facts.lossless.json', facts); assert.deepEqual(await fileState(resolve(out, 'comparison-facts.lossless.json')), comparisonFactsPin);
  const input = { leg, ...facts }; save('execution-input.lossless.json', input);
  for (const name of ['comparison-facts.lossless.json', 'execution-input.lossless.json']) pins[resolve(out, name)] = await fileState(resolve(out, name));
  for (const path of [script, 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) pins[resolve(root, path)] = await fileState(resolve(root, path));
  save('start-manifest.json', { leg, runtime, measurement, closure, harnessPins: pins, comparisonFactsPin, input,
    acceptedV217Receipt: receiptPath, originalBefore: report.originalBefore, mainOnlyCopyEvidence: report.mainOnlyCopyEvidence,
    pairedCopySupplement: report.pairedCopySupplement, copy, baseline, approvedOneFileException: exceptionProof ?? null,
    oldLeg: oldManifest ? { reportPin: pins[resolve(process.argv[5], 'report.json')], startManifestPin: oldReport.startManifestPin, receiptPin: pins[resolve(process.argv[6])] } : null,
    constraints: ['ORIGINAL_DB_NOT_OPENED', 'OWNED_COPY_OS_READONLY_QUERY_ONLY', 'NORMAL_OWNER_READER_AND_ALL_GUARDS', 'ALL_ROWS_ROWIDS_SCHEMA_HEADS_AND_DATA_PINS', 'NO_ADMISSION_DDL_DML', 'NO_INSPECTOR_OR_SQL_INSTRUMENTATION', 'NO_PERFORMANCE_ACCEPTANCE'] });
  report.startManifestPin = await fileState(resolve(out, 'start-manifest.json')); await assertParentPins();
  const records = resolve(out, 'records'), log = createWriteStream(resolve(out, 'vitest.log'), { flags: 'wx' });
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', entry, '--testNamePattern', 'NCM221-S01', '--maxWorkers=1', '--minWorkers=1'],
    { cwd: root, windowsHide: true, env: { ...process.env, BASEBALL_NATIVE_LIFECYCLE_CLAIM_METADATA_COMPARE_V221_DATABASE: copy.copyPath,
      BASEBALL_NATIVE_LIFECYCLE_CLAIM_METADATA_COMPARE_V221_INPUT: resolve(out, 'execution-input.lossless.json'), BASEBALL_NATIVE_LIFECYCLE_CLAIM_METADATA_COMPARE_V221_OUTPUT: records } });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); report.nativeTestProcessId = child.pid;
  save('native-process.json', { processId: child.pid, at: new Date().toISOString(), records, leg });
  report.nativeProcessPin = await fileState(resolve(out, 'native-process.json'));
  let exit; try { exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); }); report.childClosed = true; }
  finally { await new Promise(done => log.end(done)); }
  report.vitestLogPin = await fileState(resolve(out, 'vitest.log'));
  report.nativeTestExit = exit;
  if (existsSync(resolve(records, 'report.json'))) { report.nativeReport = read(resolve(records, 'report.json')); report.normalGetterInvocations = report.nativeReport.normalGetterInvocations; }
  assert.equal(exit.code, 0, 'single current22 comparison failed; preserve partial records');
  const native = report.nativeReport; assert(native); assert.equal(native.leg, leg);
  for (const key of ['pass', 'savedV217FullCurrentLosslessEqual', 'normalCurrentReadAccepted', 'allRowsRowidsCatalogAndHeadsUnchanged', 'authorizerPreserved', 'callerSavepointPreserved']) assert.equal(native[key], true);
  for (const key of ['performancePass', 'inspectorUsed', 'sqlInstrumentationAdded']) assert.equal(native[key], false);
  assert.equal(native.normalGetterInvocations, 1); assert.equal(native.ownerReadWarmupInvocations, 0); assert.equal(native.newWriterCalls, 0); assert.equal(native.ddlDmlExecuted, 0);
  assert(Number.isFinite(native.getterElapsedMs) && native.getterElapsedMs > 0);
  assert.deepEqual(read(resolve(records, 'current.lossless.json')), frontier.finalCurrent);
  const before = read(resolve(records, 'logical-before-with-rowid.json')); assert.deepEqual(before, read(resolve(records, 'logical-after-with-rowid.json')));
  if (oldReport) {
    assert.deepEqual(before, read(resolve(process.argv[5], 'records/logical-before-with-rowid.json')));
    report.singlePairComparison = { oldGetterElapsedMs: oldReport.getterElapsedMs, newGetterElapsedMs: native.getterElapsedMs,
      newMinusOldMs: native.getterElapsedMs - oldReport.getterElapsedMs, ratioNewOverOld: native.getterElapsedMs / oldReport.getterElapsedMs,
      fullCurrentLosslessEqual: true, sameLogicalInput: true, performancePass: false, limit: report.measurementLimit };
  }
  report.normalGetterInvocations = 1; report.savedV217FullCurrentLosslessEqual = true; report.allRowsRowidsCatalogAndHeadsUnchanged = true;
  report.getterElapsedMs = native.getterElapsedMs; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  try {
    report.outputPins = {}; if (existsSync(resolve(out, 'records'))) for (const path of tree(resolve(out, 'records'))) report.outputPins[path] = await fileState(path);
    report.originalAfter = await databaseFiles(original); assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore)); report.originalDatabaseDataUnchanged = true;
    report.originalShmObservation = { before: report.originalBefore?.['-shm'], after: report.originalAfter['-shm'], partOfImmutableDataPin: false };
    if (copy) { report.copyAfter = await databaseFiles(copy.copyPath); assert.deepEqual(dataPin(report.copyAfter), dataPin(copy.copyDatabaseBefore)); report.ownedCopyDataUnchanged = true;
      report.ownedCopyShmObservation = { before: copy.copyDatabaseBefore['-shm'], after: report.copyAfter['-shm'], partOfImmutableDataPin: false }; }
    if (closure) {
      assert.deepEqual(await fileState(closure.bundlePath), { exists: true, bytes: closure.bytes, sha256: closure.sha256 }); report.sourcePins = {};
      for (const [path, pin] of Object.entries(closure.sourcePins)) { const end = await fileState(resolve(root, path)); assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); report.sourcePins[path] = { ...pin, endSha256: end.sha256 }; }
      report.sourceAndClosureEndPinsProven = true;
    }
    await assertParentPins(); report.parentAndHarnessEndPinsProven = true;
    if (report.startManifestPin) assert.deepEqual(await fileState(resolve(out, 'start-manifest.json')), report.startManifestPin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, leg, boundary: report.boundary, normalGetterInvocations: report.normalGetterInvocations,
  getterElapsedMs: report.getterElapsedMs, singlePairComparison: report.singlePairComparison ?? null, inspectorUsed: false,
  originalDatabaseOpened: false, savedV217FullCurrentLosslessEqual: report.savedV217FullCurrentLosslessEqual, performancePass: false,
  sourceAndClosureEndPinsProven: report.sourceAndClosureEndPinsProven, parentAndHarnessEndPinsProven: report.parentAndHarnessEndPinsProven, error: report.error ?? report.pinError ?? null }));
