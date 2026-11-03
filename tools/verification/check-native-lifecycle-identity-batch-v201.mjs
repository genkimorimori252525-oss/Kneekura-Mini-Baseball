import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { DatabaseSync, constants } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord, firstDebugDifference } from './live-debug-record.mjs';

const root = realpathSync(process.cwd()), retained = resolve(root, process.argv[2] ?? ''), out = resolve(root, process.argv[3] ?? '');
const inside = path => { const rel = relative(root, path); return Boolean(rel) && !rel.startsWith('..') && !isAbsolute(rel); };
const parent = realpathSync(dirname(out));
assert(process.argv.length === 4 && inside(out) && (parent === root || inside(parent)), 'accepted V195 artifact directory and new workspace output required');
assert.equal(retained, resolve(root, 'docs/verification/realism-debug-20261027/native-spin-neutral-cut11-v195-01'));
const inputPaths = ['report.json', 'frontier.lossless.json', 'start-manifest.json'].map(name => resolve(retained, name));
const inputBytes = inputPaths.map(path => readFileSync(path));
const inputPins = Object.fromEntries(inputPaths.map((path, index) => [path,
  { exists: true, bytes: inputBytes[index].length, sha256: createHash('sha256').update(inputBytes[index]).digest('hex') }]));
const [accepted, frontier, priorManifest] = inputBytes.map(bytes => parseDebugRecord(bytes.toString('utf8')));
assert.equal(accepted.pass, true); assert.equal(accepted.boundary, 'NATIVE_CUT11_LIFECYCLE_COMPLETION_ONLY');
assert.equal(accepted.sourceAndBundleEndPinProven, true); assert.equal(accepted.existingRowsRowidAndCatalogUnchanged, true);
assert.deepEqual(frontier, accepted.frontier); assert.equal(frontier.currentCoverageProven, true);
assert.equal(frontier.viewReference.owner, 'pa_lifecycle_v1_execution_views'); assert.equal(frontier.viewReference.sourceId, 'physical-fixture:cut11:view');
assert.deepEqual(frontier.resolutionReference, priorManifest.input.resolutionReference);
const original = resolve(accepted.copyPath); assert.equal(original, resolve(retained, 'cut11-private.sqlite'));
const cohorts = [
  { name: 'known-total-10', kind: 'total', expectedCount: 10,
    sql: 'SELECT source_id FROM main.pa_lifecycle_v1_total_assessments WHERE prefix_source_id=? ORDER BY rowid', binding: frontier.prefixReference.sourceId },
  { name: 'known-current-calibration-32', kind: 'calibration', expectedCount: 32,
    sql: 'SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? ORDER BY rowid', binding: frontier.viewReference.sourceId },
];
mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, boundary: 'RAW_LIFECYCLE_IDENTITY_CANDIDATE_SQL_COMPARISON_ONLY', originalPath: original,
  changeReason: 'NEW_V201_SCALAR_VS_FRESH_BATCH_CANDIDATE_SQL_EXPERIMENT_AFTER_V200_PROFILE', nodeVersion: process.version,
  normalOwnerProof: false, productionOptimizationAdopted: false, normalCurrentGetterInvocations: 0,
  newWriterCalls: 0, newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0, newTakeAccepted: 0,
  fieldCalibrationAcceptanceExercised: false, fixtureRegenerated: false, sourceMutations: 0,
  oldFailedAndUnknownEvidencePreserved: true, originalSuffixSourceEndPin: 'UNKNOWN',
  privateArtifactNotForPublication: true, performancePass: false, measurements: [] };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let db, bundle, digest, before, stamps;
try {
  report.originalBefore = await databaseFiles(original); assert.deepEqual(dataPin(report.originalBefore), dataPin(accepted.copyAfter));
  report.harnessPins = {};
  for (const path of [...inputPaths, 'tools/verification/check-native-lifecycle-identity-batch-v201.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) {
    report.harnessPins[path] = await fileState(resolve(root, path)); assert.equal(report.harnessPins[path].exists, true);
    if (Object.hasOwn(inputPins, path)) assert.deepEqual(report.harnessPins[path], inputPins[path], 'input changed after lossless parse');
  }
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-lifecycle-identity-batch-v201.ts', outputPath: resolve(out, 'identity-batch-bundle.mjs') });
  save('start-manifest.json', { runtime: { nodeVersion: process.version, execution: 'SAME_PINNED_SOURCE_SCALAR_AND_FRESH_NATIVE_BATCH' },
    bundle, harnessPins: report.harnessPins, originalBefore: report.originalBefore,
    input: { retainedArtifactDirectory: retained, originalPath: original, viewReference: frontier.viewReference,
      prefixReference: frontier.prefixReference, expectedResolutionReference: frontier.resolutionReference, cohorts },
    timing: { trialsPerVariantPerCohort: 1, variantOrder: ['scalar', 'batch'], cohortOrder: cohorts.map(c => c.name),
      interval: 'CANDIDATE_SQL_AND_RESULT_GROUPING_ONLY_COMPILE_IMPORT_DBOPEN_DIGEST_STORAGE_GUARD_LOCATORS_AND_EQUALITY_OUTSIDE',
      cacheCondition: 'READONLY_DIGEST_BEFORE_TIMING_SCALAR_THEN_BATCH_SHARED_CONNECTION_NO_NORMAL_OWNER_WARMUP',
      interpretation: 'SINGLE_ORDERED_SQL_COMPARISON_NOT_BROAD_RUNTIME_SPEEDUP_OR_NORMAL_OWNER_PROOF' },
    constraints: ['OS_READONLY_QUERY_ONLY_1', 'NO_WRITER_OR_COPY', 'FRESH_PREPARE_NO_STATEMENT_CACHE', 'NATIVE_MATCHED_INPUT_POSITION',
      'MISSING_REQUIRES_UNCHANGED_NORMAL_SURVIVING_CLAIM_FALLBACK', 'NO_PHASE_WRAPPER_OR_FOUR_BOUNDARY_CHANGE', 'NO_NORMAL_CURRENT_GETTER_PHYSICS_PRACTICE_TAKE', 'PRIVATE_ARTIFACTS'] });
  const api = await import(pathToFileURL(bundle.bundlePath).href); digest = api.rawNativeSpinNeutralSqlDigestV193;
  db = new DatabaseSync(original, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v201');
  // Do not deny unexecuted owner DDL/INSERT prepares; OS readonly and query_only
  // prohibit actual writes. Preserve a caller-owned authorizer sentinel instead.
  db.setAuthorizer(code => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH ? constants.SQLITE_DENY : constants.SQLITE_OK);
  stamps = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get().query_only,
    totalChanges: db.prepare('SELECT total_changes() n').get().n, mainSchema: db.prepare('PRAGMA main.schema_version').get().schema_version,
    tempSchema: db.prepare('PRAGMA temp.schema_version').get().schema_version, mainUserVersion: db.prepare('PRAGMA main.user_version').get().user_version });
  report.callerBefore = stamps(); assert.equal(report.callerBefore.transaction, true); assert.equal(report.callerBefore.queryOnly, 1);
  assert.throws(() => db.prepare("ATTACH DATABASE ':memory:' AS denied_v201"), /not authorized/);
  before = digest(db); save('logical-before-with-rowid.json', before); assert.equal(api.assertLifecycleIdentityExperimentStorageV201(db), true);
  const inputs = cohorts.map(cohort => {
    const ids = db.prepare(cohort.sql).all(cohort.binding).map(row => row.source_id);
    assert.equal(ids.length, cohort.expectedCount); assert.equal(new Set(ids).size, ids.length);
    assert(ids.every(id => typeof id === 'string' && id.length > 0));
    return { ...cohort, ids, locatorAuthority: 'RAW_ONLY_NOT_OWNER_PROOF' };
  });
  save('measurement-inputs.lossless.json', inputs); report.measurementInputPin = await fileState(resolve(out, 'measurement-inputs.lossless.json'));
  for (const input of inputs) {
    const values = {};
    for (const [variant, collect] of [['scalar', api.collectScalarLifecycleIdentityCandidatesV201], ['batch', api.collectBatchLifecycleIdentityCandidatesV201]]) {
      const started = process.hrtime.bigint(), value = collect(db, input.kind, input.ids), elapsedNs = process.hrtime.bigint() - started;
      save(input.name + '-' + variant + '.lossless.json', value); values[variant] = value;
      assert.equal(value.normalOwnerProof, false); assert.equal(value.requests.length, input.expectedCount);
      assert(value.requests.every(request => request.candidates.length === 1 && !request.aliasReject && !request.missingFallbackRequired));
      report.measurements.push({ cohort: input.name, variant, trialCount: 1, inputCount: input.ids.length,
        elapsedNanoseconds: String(elapsedNs), elapsedMilliseconds: Number(elapsedNs) / 1e6, normalOwnerProof: false });
    }
    assert.equal(values.batch.mode, 'NATIVE_POSITION_BATCH');
    assert.equal(firstDebugDifference(values.scalar.requests, values.batch.requests), null, 'all candidate members/rowids/alias decisions differ: ' + input.name);
  }
  report.scalarBatchCandidateRecordsAndAliasBitsExact = true; report.samePinnedSourceAndTypedClaimContract = true; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (db) try {
    if (stamps && before) {
      report.callerAfter = stamps(); assert.deepEqual(report.callerAfter, report.callerBefore);
      const after = digest(db); save('logical-after-with-rowid.json', after); assert.deepEqual(after, before); report.allRowsRowidsCatalogAndHeadsUnchanged = true;
      assert.throws(() => db.prepare("ATTACH DATABASE ':memory:' AS denied_v201"), /not authorized/); report.authorizerPreserved = true;
      db.exec('ROLLBACK TO caller_v201; RELEASE caller_v201'); report.callerSavepointPreserved = true;
      assert.equal(db.isTransaction, true); db.exec('ROLLBACK');
    } else if (db.isTransaction) db.exec('ROLLBACK');
    db.setAuthorizer(null); db.close(); db = null;
  } catch (error) { report.cleanupError = String(error.stack ?? error); report.pass = false; process.exitCode = 1;
    try { if (db?.isTransaction) db.exec('ROLLBACK'); db?.setAuthorizer(null); db?.close(); } catch { /* Preserve the first cleanup failure. */ } }
  try {
    report.originalAfter = await databaseFiles(original); assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore)); report.allDataFilesUnchanged = true;
    report.shmObservation = { before: report.originalBefore['-shm'], after: report.originalAfter['-shm'], partOfImmutableDataPin: false };
    if (bundle) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 }); report.sourcePins = {};
      for (const [path, pin] of Object.entries(bundle.sourcePins)) { const end = await fileState(resolve(root, path));
        assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); report.sourcePins[path] = { ...pin, endSha256: end.sha256 }; }
      report.sourceAndBundleEndPinProven = true; report.bundle = { inputCount: bundle.inputCount, sha256: bundle.sha256 };
    }
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
    report.harnessAndInputEndPinsProven = true;
    if (report.measurementInputPin) assert.deepEqual(await fileState(resolve(out, 'measurement-inputs.lossless.json')), report.measurementInputPin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, boundary: report.boundary, normalOwnerProof: false, measurements: report.measurements,
  scalarBatchCandidateRecordsAndAliasBitsExact: report.scalarBatchCandidateRecordsAndAliasBitsExact,
  allDataFilesUnchanged: report.allDataFilesUnchanged, allRowsRowidsCatalogAndHeadsUnchanged: report.allRowsRowidsCatalogAndHeadsUnchanged,
  sourceAndBundleEndPinProven: report.sourceAndBundleEndPinProven, harnessAndInputEndPinsProven: report.harnessAndInputEndPinsProven,
  error: report.error ?? report.cleanupError ?? report.pinError ?? null }));
