import assert from 'node:assert/strict';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), original = resolve(process.argv[2] ?? ''), retained = resolve(process.argv[3] ?? ''), out = resolve(process.argv[4] ?? ''), rel = relative(root, out);
assert(process.argv.length === 5 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'retained original database, V197 proof directory and new workspace output required');
const proofPath = resolve(retained, 'report.json'), frontierPath = resolve(retained, 'frontier.lossless.json'), manifestPath = resolve(retained, 'start-manifest.json');
const basisPath = resolve(retained, 'checkpoint-3-pitch3-action-posture-intent-current-model-authenticated.lossless.json');
const proof = parseDebugRecord(readFileSync(proofPath, 'utf8')), retainedFrontier = parseDebugRecord(readFileSync(frontierPath, 'utf8'));
assert(proof.pass && proof.allDataFilesUnchanged && proof.sourceAndBundleEndPinProven && resolve(proof.originalPath) === original);
assert.equal(proof.boundary, 'NATIVE_READONLY_PROSPECTIVE_PRELAUNCH_BOUNDARY_ONLY');
assert.deepEqual(retainedFrontier, proof.frontier);
assert(retainedFrontier.currentLifecycleProven && retainedFrontier.nextPitchBasisProven && retainedFrontier.twoIndependentNativeQualificationRefsProven);
const input = Object.fromEntries(['actorReference', 'actionReference', 'postureReference', 'intentReference', 'viewReference', 'modelReference', 'qualificationReferences', 'preparedRight']
  .map(key => { assert(Object.hasOwn(retainedFrontier, key), 'V197 proof missing ' + key); return [key, retainedFrontier[key]]; }));
const basis = parseDebugRecord(readFileSync(basisPath, 'utf8'));
for (const key of ['actionReference', 'postureReference', 'intentReference', 'modelReference']) assert.deepEqual(basis[key], input[key]);
const originalBatter = basis.posture.model.bodyMaterialization;
input.matchDayBatterPreparation = { request: { ...originalBatter.source, sourceId: 'native-spin-neutral-field-v198:batter-body-at-game-day', atDay: basis.action.actor.binding.gameDay },
  body: originalBatter.body, pose: originalBatter.pose, reachCalibration: originalBatter.reachCalibration };
// Declare the complete prospective profile before importing the Native entry.
// Values are copied from the existing frozen LYU fixture, never from an outcome.
// The imported entry must independently reproduce this exact declaration.
const declaration = {
  boundary: 'FIXTURE_ONLY_PROSPECTIVE_FIELD_SOURCE_DECLARATION', fieldLabel: 'native-spin-neutral-field-v198',
  calibrationParameters: { ticksPerSecond: 1_000_000, gravityY: -9.81, ballRadius: 0.0366, groundRestitution: 0.35, groundFriction: 0.78,
    groundRollingDecelerationMps2: 4, integrationStepTicks: 2_000, restingVerticalSpeed: 0.5 },
  futureFieldRootSourceVersion: 'same_pa_field_root_aero_ground_escape_v3', futureFieldStepSourceVersion: 'same_pa_field_step_aero_ground_escape_v3',
  futureBallPhysics: { kind: 'aero_ground_v1',
    air: { ticksPerSecond: 1_000_000, integrationStepTicks: 2_000, gravityY: -9.81,
      aerodynamics: { ballMassKg: 0.145, ballRadiusM: 0.0366, airDensityKgM3: 1.225, windVelocityMps: { x: 0, y: 0, z: 0 }, dragCoefficient: 0.35,
        coefficientProfile: { profileId: 'lyu-2022-seam-averaged', version: 'lyu-2022-figure-digitization-v1', referenceReynoldsNumber: 144_000,
          spinKnots: [[0, 0.35, 0], [0.05, 0.34, 0.10], [0.10, 0.32, 0.115], [0.15, 0.32, 0.17], [0.20, 0.33, 0.195], [0.25, 0.34, 0.230],
            [0.30, 0.36, 0.270], [0.35, 0.38, 0.305], [0.40, 0.39, 0.340], [0.45, 0.41, 0.385], [0.50, 0.42, 0.400]]
            .map(([spinFactor, dragCoefficientAtReferenceRe, liftCoefficient]) => ({ spinFactor, dragCoefficientAtReferenceRe, liftCoefficient })),
          reynoldsKnots: [[75_000, 0.46], [100_000, 0.44], [125_000, 0.42], [150_000, 0.36], [175_000, 0.32], [200_000, 0.34], [250_000, 0.35]]
            .map(([reynoldsNumber, value]) => ({ reynoldsNumber, dragCorrectionFactorAtLowSpin: value / 0.34 })),
          reynoldsCorrectionFullThroughSpinFactor: 0.05, reynoldsCorrectionZeroAtSpinFactor: 0.15 },
        airKinematicViscosityM2PerSecond: 1.5e-5, spinDecay: { referenceSpeedMps: 44.704, timeConstantSecondsAtReferenceSpeed: 20 } } },
    ground: { ticksPerSecond: 1_000_000, gravityMps2: 9.81, radiusM: 0.0366, inertiaRatio: 0.378, restingVerticalSpeedMps: 0.15,
      material: { restitution: 0.4, slidingFriction: 0.25, rollingDecelerationMps2: 1, normalSpinDecayPerSecond: 0.5 } } },
  calibrationAuthority: 'EXISTING_LEGACY_EIGHT_PARAMETER_CALIBRATION_UNCHANGED',
  futureGroundAuthority: 'EXPLICIT_AERO_GROUND_PROFILE_WHEN_ITS_RESERVED_ROOT_VERSION_IS_ADOPTED',
  prospectiveFixtureValues: { geometryRef: 'synthetic-field-contact-v1', availableAtDay: 1, bagHalfSize: { x: 0.01, z: 0.2 }, bagSurfaceHeightMeters: 0.1,
    batterGripOffset: { x: 0.5, y: 0.9, z: 0 }, bodyMaterial: { restitution: 0.5, tangentialDamping: 0.25, spinDamping: 0.2 }, gloveCenterRetentionCapacityJ: 1_000_000 },
  profileValidation: 'NORMAL_SOURCE_CONTRACT_ZERO_DURATION_FLOOR_VALIDATION_ONLY',
  futureFieldRootAccepted: false, flightOrCatchOutcomeProven: false, officialOutcomeProven: false, productionCalibrationProven: false, outcomeBasedProfileAdjustment: false,
};
assert(existsSync(original)); mkdirSync(out, { recursive: false });
const destination = resolve(out, 'field-preparation-private.sqlite');
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const appendTables = ['world_player_body_materializations', 'world_batted_body_materializations', 'pa_physical_v1_field_calibrations'];
const report = { pass: false, boundary: 'NATIVE_FIXTURE_FIELD_SOURCE_PREPARATION_ONLY', originalPath: original, copyPath: destination,
  execution: 'PINNED_NODE_ENTRY', changeReason: 'NORMAL_MATCH_DAY_BODY_RECEIPT_FROM_UNCHANGED_INPUTS_BEFORE_FRESH_CALIBRATION',
  originalExecutionSourceEndPin: 'UNKNOWN', newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0,
  launchAccepted: false, fieldRootAccepted: false, productionCalibrationProven: false, performancePass: false, privateArtifactNotForPublication: true, stages: [] };
const stage = (name, value) => { const s = { name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
  report.stages.push(s); save('stage-' + report.stages.length + '.json', s);
  if (value !== undefined) save('checkpoint-' + report.stages.length + '-' + name + '.lossless.json', value);
  console.log(JSON.stringify(s)); };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let source, target, bundle;
try {
  report.originalBefore = await databaseFiles(original);
  assert.deepEqual(dataPin(report.originalBefore), dataPin(proof.originalAfter), 'original data changed since V197 normal authentication');
  report.harnessPins = {};
  for (const path of [proofPath, frontierPath, manifestPath, basisPath, 'tools/verification/check-native-field-preparation-v198.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) report.harnessPins[path] = await fileState(resolve(root, path));
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-field-preparation-v198.ts', outputPath: resolve(out, 'field-preparation-bundle.mjs') });
  save('start-manifest.json', { runtime: { execution: report.execution, nodeVersion: process.version, originalExecutionSourceEndPin: 'UNKNOWN' },
    bundle, harnessPins: report.harnessPins, originalBefore: report.originalBefore, input, declaration,
    constraints: ['NEW_OWNED_SQLITE_BACKUP_ONLY', 'NORMAL_NEW_BODY_RECEIPT_AT_MATCH_DAY_WITH_IDENTICAL_ACTOR_THEN_MODEL_AND_FRESH_CALIBRATION', 'NO_LAUNCH_FLIGHT_FIELD_PRACTICE_OR_TAKE_REEXECUTION',
      'ALL_EXISTING_ROWS_ROWIDS_CATALOG_HEADS_UNCHANGED', 'FIXTURE_VALUES_ARE_NOT_PRODUCTION_CALIBRATION', 'PROFILE_FIXED_BEFORE_IMPORT_OR_DB_OPEN'] });
  const api = await import(pathToFileURL(bundle.bundlePath).href), digest = api.rawNativeSpinNeutralSqlDigestV193;
  assert.deepEqual(api.createNativeFieldPreparationV198Declaration(), declaration, 'prospective declaration must match the normal pinned Source exactly');
  source = new DatabaseSync(original, { readOnly: true }); source.exec('PRAGMA query_only=1; BEGIN');
  const before = digest(source); save('original-logical-with-rowid.json', before);
  const through = Object.create(null);
  for (const table of appendTables) {
    assert(Object.hasOwn(before.tables, table), 'append namespace must already exist: ' + table);
    const query = source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.' + table); query.setReadBigInts(true);
    const row = query.get(); assert(row.lo === null || row.lo > 0n); through[table] = row.hi ?? 0n;
  }
  report.priorRowidThrough = Object.fromEntries(Object.entries(through).map(([key, value]) => [key, String(value)]));
  assert(!existsSync(destination)); closeSync(openSync(destination, 'wx'));
  report.backupPages = await backup(source, destination, { source: 'main', target: 'main' });
  source.exec('ROLLBACK'); source.close(); source = null;
  report.originalAfterBackup = await databaseFiles(original); assert.deepEqual(dataPin(report.originalAfterBackup), dataPin(report.originalBefore));
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  assert.deepEqual(digest(target), before, 'consistent backup must retain every original row, rowid and catalog entry');
  target.exec('ROLLBACK'); target.close(); target = null;
  report.copyBeforePreparation = await databaseFiles(destination); stage('consistent-owned-copy-authenticated');
  const frontier = api.prepareNativeFieldV198(destination, input, declaration, stage); save('frontier.lossless.json', frontier); report.frontier = frontier;
  assert(frontier.currentLifecycleProven && frontier.nextPitchBasisProven && frontier.unlaunched && frontier.fixtureOnly);
  assert.equal(frontier.acceptedBatterBodyMaterializations, 1); assert.equal(frontier.originalActorValuesExact, true);
  const acceptedBatter = frontier.matchDayBatterPreparation.receipt;
  assert.deepEqual(acceptedBatter.source, input.matchDayBatterPreparation.request);
  for (const key of ['body', 'pose', 'reachCalibration']) assert.deepEqual(acceptedBatter[key], input.matchDayBatterPreparation[key]);
  assert.deepEqual(acceptedBatter.actor, originalBatter.actor, 'match-day receipt must preserve every original actor value');
  assert.deepEqual(frontier.originalInputs.posture.model.bodyMaterialization, originalBatter, 'original posture body receipt must remain exact');
  assert.deepEqual(frontier.acceptedPreparation.model.actors[0], originalBatter.actor, 'assembly must retain the original actor values and order');
  assert.equal(frontier.bodyCount, 10); assert.equal(frontier.acceptedModelAssemblies, 1); assert.equal(frontier.acceptedFieldCalibrations, 1);
  assert.equal(frontier.newPhysicalOperationsAccepted, 0); assert.equal(frontier.newPracticeAccepted, 0);
  assert.equal(frontier.launchAccepted, false); assert.equal(frontier.fieldRootAccepted, false); assert.equal(frontier.productionCalibrationProven, false);
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  const after = digest(target); save('prepared-logical-with-rowid.json', after);
  assert.deepEqual(digest(target, through), before, 'all original rows/rowids/catalog and all non-append tables must remain exact');
  report.appendedRows = Object.fromEntries(appendTables.map(table => [table, after.tables[table].rows - before.tables[table].rows]));
  for (const table of appendTables) assert.equal(report.appendedRows[table], 1, 'exactly one normal preparation row required in ' + table);
  target.exec('ROLLBACK'); target.close(); target = null;
  report.existingRowsRowidAndCatalogUnchanged = true; report.onlyThreePreparationAppendTablesChanged = true; report.pass = true;
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
console.log(JSON.stringify({ pass: report.pass, currentLifecycleProven: report.frontier?.currentLifecycleProven,
  nextPitchBasisProven: report.frontier?.nextPitchBasisProven, unlaunched: report.frontier?.unlaunched, appendedRows: report.appendedRows,
  originalDataUnchanged: report.originalDataUnchanged, existingRowsRowidAndCatalogUnchanged: report.existingRowsRowidAndCatalogUnchanged,
  sourceAndBundleEndPinProven: report.sourceAndBundleEndPinProven, error: report.error ?? report.cleanupError ?? report.pinError ?? null }));
