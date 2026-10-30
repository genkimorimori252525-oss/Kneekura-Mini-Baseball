import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { DatabaseSync, constants } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = realpathSync(process.cwd()), retained = resolve(root, process.argv[2] ?? ''), out = resolve(root, process.argv[3] ?? '');
const within = path => { const rel = relative(root, path); return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel); };
assert(process.argv.length === 4 && within(out) && within(realpathSync(dirname(out))), 'accepted V195 artifact directory and new workspace-only output required');
assert.equal(retained, resolve(root, 'docs/verification/realism-debug-20261027/native-spin-neutral-cut11-v195-01'), 'only the accepted V195 resolved cut11 is admitted');
const inputPaths = ['report.json', 'frontier.lossless.json', 'start-manifest.json'].map(name => resolve(retained, name));
const inputBytes = inputPaths.map(path => readFileSync(path));
const inputPins = Object.fromEntries(inputPaths.map((path, index) => [path,
  { exists: true, bytes: inputBytes[index].length, sha256: createHash('sha256').update(inputBytes[index]).digest('hex') }]));
const [accepted, frontier, priorManifest] = inputBytes.map(bytes => parseDebugRecord(bytes.toString('utf8')));
assert.equal(accepted.pass, true); assert.equal(accepted.boundary, 'NATIVE_CUT11_LIFECYCLE_COMPLETION_ONLY');
assert.equal(accepted.sourceAndBundleEndPinProven, true); assert.equal(accepted.existingRowsRowidAndCatalogUnchanged, true);
assert.deepEqual(accepted.frontier, frontier); assert.equal(frontier.currentCoverageProven, true);
assert.equal(frontier.viewReference.owner, 'pa_lifecycle_v1_execution_views'); assert.equal(frontier.viewReference.sourceId, 'physical-fixture:cut11:view');
assert.deepEqual(frontier.resolutionReference, priorManifest.input.resolutionReference);
const original = resolve(accepted.copyPath);
assert.equal(original, resolve(retained, 'cut11-private.sqlite'), 'only the preserved completed V195 database may be opened');
mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, boundary: 'NATIVE_SINGLE_CURRENT_LIFECYCLE_READ_CPU_PROFILE_ONLY', execution: 'PINNED_NODE_ENTRY',
  changeReason: 'NEW_PERFORMANCE_ATTRIBUTION_ON_PRESERVED_V195_RESOLVED_CUT11_NOT_CORRECTNESS_REQUALIFICATION',
  originalPath: original, viewReference: frontier.viewReference, normalGetterInvocations: 0,
  newWriterCalls: 0, newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0, newTakeAccepted: 0,
  fieldCalibrationAcceptanceExercised: false, fixtureRegenerated: false, suffixScenarioReexecuted: false,
  performancePass: false, originalSuffixSourceEndPin: 'UNKNOWN', oldFailedAndUnknownEvidencePreserved: true,
  privateArtifactNotForPublication: true, cacheCondition: 'FIRST_NORMAL_GETTER_AFTER_READONLY_LOGICAL_DIGEST_NO_OWNER_READ_WARMUP' };
const summarizeProfile = profile => {
  assert(Array.isArray(profile.nodes) && Array.isArray(profile.samples) && Array.isArray(profile.timeDeltas));
  assert(profile.samples.length > 0 && profile.samples.length === profile.timeDeltas.length, 'CPU profile samples and weights missing');
  const nodes = new Map(profile.nodes.map(node => [node.id, node])), weights = new Map();
  for (let index = 0; index < profile.samples.length; index++) {
    const id = profile.samples[index], delta = profile.timeDeltas[index];
    assert(nodes.has(id) && Number.isFinite(delta) && delta >= 0, 'CPU profile sample has no node or valid time weight');
    const previous = weights.get(id) ?? { sampleCount: 0, microseconds: 0 };
    weights.set(id, { sampleCount: previous.sampleCount + 1, microseconds: previous.microseconds + delta });
  }
  const sampledMicroseconds = [...weights.values()].reduce((sum, value) => sum + value.microseconds, 0);
  return { sampleCount: profile.samples.length, sampledTimeMs: sampledMicroseconds / 1000,
    profilerIntervalMs: (profile.endTime - profile.startTime) / 1000,
    attributionLimit: 'V8_SAMPLE_FRAME_WEIGHTS_ARE_NOT_EXCLUSIVE_JS_CPU; SYNCHRONOUS_NATIVE_CPP_WORK_CAN_BE_CHARGED_TO_ITS_CALLING_FRAME',
    topSelfSampledFrames: [...weights.entries()].sort((a, b) => b[1].microseconds - a[1].microseconds).slice(0, 30).map(([id, weight]) => {
      const node = nodes.get(id), frame = node.callFrame;
      return { functionName: frame.functionName, url: frame.url, scriptId: frame.scriptId,
        line: frame.lineNumber < 0 ? null : frame.lineNumber + 1, column: frame.columnNumber < 0 ? null : frame.columnNumber + 1,
        sampleCount: weight.sampleCount, sampledSelfTimeMs: weight.microseconds / 1000,
        sampledWeightFraction: sampledMicroseconds === 0 ? null : weight.microseconds / sampledMicroseconds };
    }) };
};
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let db, bundle, digest, before, stamps, session, profilerStarted = false;
try {
  report.originalBefore = await databaseFiles(original);
  assert.deepEqual(dataPin(report.originalBefore), dataPin(accepted.copyAfter), 'V195 preserved database differs from its accepted end pin');
  report.harnessPins = {};
  for (const path of [...inputPaths, 'tools/verification/check-native-lifecycle-read-profile-v200.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) {
    report.harnessPins[path] = await fileState(resolve(root, path)); assert.equal(report.harnessPins[path].exists, true);
    if (Object.hasOwn(inputPins, path)) assert.deepEqual(report.harnessPins[path], inputPins[path], 'input changed after its lossless parse');
  }
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-lifecycle-read-profile-v200.ts', outputPath: resolve(out, 'lifecycle-read-bundle.mjs') });
  save('start-manifest.json', { runtime: { execution: report.execution, nodeVersion: process.version }, bundle,
    harnessPins: report.harnessPins, originalBefore: report.originalBefore,
    input: { retainedArtifactDirectory: retained, originalPath: original, viewReference: frontier.viewReference,
      expectedResolutionReference: frontier.resolutionReference, acceptedV195DataEndPin: dataPin(accepted.copyAfter) },
    changeReason: report.changeReason, profile: { normalGetterInvocations: 1, samplingIntervalMicroseconds: 1000,
      interval: 'ENABLE_AND_START_AFTER_IMPORT_DBOPEN_AND_READONLY_DIGEST; STOP_IMMEDIATELY_AFTER_SINGLE_GETTER',
      attributionLimit: 'V8_SAMPLED_FRAME_NOT_EXCLUSIVE_JS_OR_NATIVE_CPP_CPU' },
    constraints: ['OS_READONLY', 'QUERY_ONLY_1', 'BORROWED_CALLER_TRANSACTION_AND_SAVEPOINT', 'NO_WRITER_OR_COPY',
      'NO_NEW_BODY_PHYSICS_PRACTICE_TAKE_CALIBRATION_OR_SOURCE_MUTATION', 'OLD_FAIL_UNKNOWN_PRESERVED', 'PRIVATE_ARTIFACTS'] });
  const api = await import(pathToFileURL(bundle.bundlePath).href); digest = api.rawNativeSpinNeutralSqlDigestV193;
  db = new DatabaseSync(original, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v200');
  // Actual writes are blocked by OS readonly + query_only. Normal owners may
  // legitimately prepare DDL/INSERT statements without executing them.
  db.setAuthorizer(code => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH ? constants.SQLITE_DENY : constants.SQLITE_OK);
  stamps = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get().query_only,
    totalChanges: db.prepare('SELECT total_changes() n').get().n, mainSchema: db.prepare('PRAGMA main.schema_version').get().schema_version,
    tempSchema: db.prepare('PRAGMA temp.schema_version').get().schema_version, mainUserVersion: db.prepare('PRAGMA main.user_version').get().user_version });
  report.callerBefore = stamps(); assert.equal(report.callerBefore.transaction, true); assert.equal(report.callerBefore.queryOnly, 1);
  assert.throws(() => db.prepare("ATTACH DATABASE ':memory:' AS denied_v200"), /not authorized/);
  before = digest(db); save('logical-before-with-rowid.json', before);
  session = new Session(); session.connect();
  const post = (method, params = {}) => new Promise((resolvePost, reject) => session.post(method, params, (error, value) => error ? reject(error) : resolvePost(value)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 1000 });
  await post('Profiler.start'); profilerStarted = true;
  let current;
  const started = process.hrtime.bigint();
  try { report.normalGetterInvocations++; current = api.readNativeLifecycleOnceV200(db, frontier.viewReference); }
  finally {
    report.getterElapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const { profile } = await post('Profiler.stop'); profilerStarted = false;
    writeFileSync(resolve(out, 'single-current-read.cpuprofile'), JSON.stringify(profile) + '\n', { flag: 'wx' });
    report.cpuProfile = summarizeProfile(profile); save('profile-summary.json', report.cpuProfile);
  }
  assert.equal(report.normalGetterInvocations, 1); save('current.lossless.json', current);
  assert.equal(current.view.source.sourceId, frontier.viewReference.sourceId); assert.equal(current.view.cut.stage, 'resolved');
  assert.deepEqual(current.view.cut.operationReference, frontier.resolutionReference);
  report.result = { normalCurrentReadAccepted: true, stage: current.view.cut.stage, participantCount: current.view.participants.length };
  report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (session) {
    try { session.disconnect(); session = null; }
    catch (error) { report.profilerCleanupError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
    if (profilerStarted) { report.profilerStoppedNormally = false; report.pass = false; process.exitCode = 1; }
  }
  if (db) try {
    if (stamps && before) {
      report.callerAfter = stamps(); assert.deepEqual(report.callerAfter, report.callerBefore);
      const after = digest(db); save('logical-after-with-rowid.json', after); assert.deepEqual(after, before);
      report.allRowsRowidsCatalogAndHeadsUnchanged = true;
      assert.throws(() => db.prepare("ATTACH DATABASE ':memory:' AS denied_v200"), /not authorized/); report.authorizerPreserved = true;
      db.exec('ROLLBACK TO caller_v200; RELEASE caller_v200'); report.callerSavepointPreserved = true;
      assert.equal(db.isTransaction, true); db.exec('ROLLBACK');
    } else if (db.isTransaction) db.exec('ROLLBACK');
    db.setAuthorizer(null); db.close(); db = null;
  } catch (error) { report.cleanupError = String(error.stack ?? error); report.pass = false; process.exitCode = 1;
    try { if (db?.isTransaction) db.exec('ROLLBACK'); db?.setAuthorizer(null); db?.close(); } catch { /* Preserve the first cleanup failure. */ } }
  try {
    report.originalAfter = await databaseFiles(original);
    assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore)); report.allDataFilesUnchanged = true;
    report.shmObservation = { before: report.originalBefore['-shm'], after: report.originalAfter['-shm'], partOfImmutableDataPin: false };
    if (bundle) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 }); report.sourcePins = {};
      for (const [path, pin] of Object.entries(bundle.sourcePins)) { const end = await fileState(resolve(root, path));
        assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); report.sourcePins[path] = { ...pin, endSha256: end.sha256 }; }
      report.sourceAndBundleEndPinProven = true; report.bundle = { inputCount: bundle.inputCount, sha256: bundle.sha256 };
    }
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
    report.harnessAndInputEndPinsProven = true;
    for (const name of ['current.lossless.json', 'single-current-read.cpuprofile', 'profile-summary.json']) {
      const pin = await fileState(resolve(out, name)); if (report.pass) assert.equal(pin.exists, true);
      (report.outputPins ??= {})[name] = pin;
    }
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, boundary: report.boundary, normalGetterInvocations: report.normalGetterInvocations,
  getterElapsedMs: report.getterElapsedMs, profileSamples: report.cpuProfile?.sampleCount,
  allDataFilesUnchanged: report.allDataFilesUnchanged, allRowsRowidsCatalogAndHeadsUnchanged: report.allRowsRowidsCatalogAndHeadsUnchanged,
  sourceAndBundleEndPinProven: report.sourceAndBundleEndPinProven, harnessAndInputEndPinsProven: report.harnessAndInputEndPinsProven,
  error: report.error ?? report.cleanupError ?? report.pinError ?? report.profilerCleanupError ?? null }));
