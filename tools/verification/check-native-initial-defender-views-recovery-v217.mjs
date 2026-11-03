import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, constants, copyFileSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), accepted = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? ''), rel = relative(root, out);
assert(process.argv.length === 4 && rel && !rel.startsWith('..') && !isAbsolute(rel));
assert.equal(accepted, resolve('work/native-initial-defender-inventory-proof-v216-01')); assert(!existsSync(out));
const bytePin = bytes => ({ exists: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
const pins = {}, readBytes = path => { const bytes = readFileSync(path); pins[path] = bytePin(bytes); return bytes; };
const read = path => parseDebugRecord(readBytes(path).toString('utf8'));
const tree = path => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? tree(resolve(path, item.name)) : [resolve(path, item.name)]).sort();
const proofPaths = tree(accepted); for (const path of proofPaths) readBytes(path);
const proof = read(resolve(accepted, 'report.json')), parent = read(resolve(accepted, 'start-manifest.json'));
const inventory = read(resolve(accepted, 'inventory.lossless.json'));
for (const key of ['pass', 'onlyExpectedPhysicalHeadCasProven', 'originalV212RowsRowidsSchemaAndOtherHeadsUnchanged', 'worldUnchanged', 'normalCommittedPhaseAuthenticated',
  'savedNormalInventoryAndLocatorGuardsReused', 'retainedInventoryArtifactsUnchanged', 'failedV214ArtifactsAndDataUnchanged', 'retainedAncestorDataUnchanged', 'sourceHarnessInputBundleAndResultEndPinsProven']) assert.equal(proof[key], true);
for (const key of ['originalInventoryOverallPass', 'originalFailedRunCompleted', 'originalFailedRunEndPinsClaimed', 'normalInventoryReexecuted', 'nativeTestReexecuted', 'fixtureClosureExecuted', 'remainingOnlyRecoveryExecuted', 'performancePass', 'wholeRngConsumptionProven']) assert.equal(proof[key], false);
assert.deepEqual(proof.state, inventory.state); assert.equal(proof.appendedRowsSinceV212Total, 83); assert.equal(proof.physicalHeadCasCount, 6);
assert.deepEqual(inventory.state, { phase: 'SCOPED_CALIBRATION_PENDING', nextIndex: 5, completedCount: 5, acceptedObservationCount: 6,
  acceptedPrefixCount: 6, acceptedTotalRows: 60, acceptedViewCount: 6, acceptedScopedCalibrationCount: 5, remainingAppendRows: 43 });
const receiptPath = resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_c9dd5da8663646c081aaefad7c8590fa.json');
const receipt = read(receiptPath); assert.equal(receipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN'); assert.equal(receipt.result, 'PASS'); assert.equal(receipt.exit_code, 0);
assert.equal(receipt.command.length, 4); assert.deepEqual(receipt.command.slice(0, 3), ['node', 'tools/verification/check-native-initial-defender-views-inventory-proof-v216.mjs', 'work/native-initial-defender-inventory-v216-01']);
assert.equal(resolve(root, receipt.command[3]), accepted); assert.equal(bytePin(readBytes(resolve(receipt.output_path))).sha256, receipt.output_sha256);
const retained = resolve(parent.retained), previous = read(resolve(retained, 'report.json')), previousManifest = read(resolve(retained, 'start-manifest.json'));
const inventoryInput = read(resolve(retained, 'execution-input.lossless.json')), input = { inventoryInput, retainedInventory: inventory };
assert.equal(inventory.original.originalAction.nominalPitch.delivery.matchSeed, 19); assert.equal(inventory.original.originalAction.nominalPitch.delivery.outingId, 'outing-1');
assert.equal(inventory.original.action.lineage.playId, 7); assert.equal(inventory.original.launch.pitchOrdinal, 3);
const failed = resolve('docs/verification/realism-debug-20261027/native-initial-defender-views-v214-01'), failedManifest = read(resolve(failed, 'start-manifest.json'));
const originalV212Logical = read(resolve(failed, 'before-logical-with-rowid.json'));
const originalDatabase = resolve(proof.owned); assert.equal(originalDatabase, resolve(accepted, 'proof-readonly.sqlite'));
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const retainedDatabases = new Map(Object.entries(previous.retainedDataAfter).map(([path, pin]) => [resolve(path), pin]));
assert.equal(retainedDatabases.size, 11);
for (const [path, files] of [[previous.failedDatabase, previous.failedDataAfter], [previous.ownedDatabase, previous.ownedDataAfter], [originalDatabase, parent.sourceFiles]]) {
  assert(!retainedDatabases.has(resolve(path))); retainedDatabases.set(resolve(path), files);
}
assert.equal(retainedDatabases.size, 14);
const assertParentPins = async () => {
  assert.deepEqual(tree(accepted), proofPaths);
  for (const [path, pin] of Object.entries(proof.resultPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(parent.pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(previousManifest.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(failedManifest.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const bundle of [previousManifest.closure, previousManifest.digestBundle, failedManifest.bundle, failedManifest.digestBundle]) {
    assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
    for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
  }
  for (const [path, pin] of Object.entries(previous.failedArtifactPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
};
const appendCounts = { pa_physical_v1_field_steps: 3, pa_lifecycle_v1_work_prefixes: 3, pa_lifecycle_v1_total_assessments: 30,
  pa_lifecycle_v1_execution_views: 3, pa_lifecycle_v1_execution_calibrations: 4 };
const appendTables = Object.keys(appendCounts), mutable = 'pa_physical_v1_heads';
const rawRows = (db, table) => { const q = db.prepare('SELECT rowid AS native_rowid,* FROM main."' + table.replaceAll('"', '""') + '" ORDER BY rowid'); q.setReadBigInts(true); return q.all(); };
const persistRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? { kind: 'SQLITE_INTEGER', decimal: String(value) } : value])));
const catalogRecords = rows => rows.map(row => { assert.deepEqual(Object.keys(row), ['type', 'name', 'tbl_name', 'sql']);
  for (const key of ['type', 'name', 'tbl_name']) assert.equal(typeof row[key], 'string'); assert(row.sql === null || typeof row.sql === 'string'); return Object.fromEntries(Object.entries(row)); });
await assertParentPins(); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const stagingPath = resolve(out, 'retained-data-staging.sqlite'), ownedPath = resolve(out, 'initial-defender-recovery-private.sqlite');
const report = { pass: false, boundary: 'NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_CHECKPOINT_ONLY', originalDatabase, ownedPath,
  acceptedInventoryProofReceipt: receiptPath, acceptedInventoryProofCommand: receipt.command, originalFailedV214Completed: false,
  originalFailedRunCompleted: false, originalFailedRunEndPinsClaimed: false, originalInventoryOverallPass: false,
  execution: 'VITEST_ORIGINAL_SOURCE_ENTRY', fixtureClosureExecuted: false, retainedStageReacceptCount: 0, performancePass: false, fullContinuationComplete: false, wholeRngConsumptionProven: false, privateArtifactNotForPublication: true };
let staging, owned, bundle, digestBundle;
try {
  report.retainedDataBefore = {};
  for (const [path, pin] of retainedDatabases) { const current = await databaseFiles(path); assert.deepEqual(dataPin(current), dataPin(pin)); report.retainedDataBefore[path] = current; }
  report.originalBefore = report.retainedDataBefore[originalDatabase];
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-initial-defender-views-recovery-v217.test.ts', outputPath: resolve(out, 'source-closure-not-executed.mjs') });
  digestBundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-sql.ts', outputPath: resolve(out, 'digest-bundle.mjs') }); assert.equal(digestBundle.inputCount, 1);
  assert.deepEqual(Object.keys(digestBundle.sourcePins), ['tools/verification/NativeSpinNeutralV193-sql.ts']);
  save('execution-input.lossless.json', input); pins[resolve(out, 'execution-input.lossless.json')] = await fileState(resolve(out, 'execution-input.lossless.json'));
  for (const path of ['tools/verification/check-native-initial-defender-views-recovery-v217.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) pins[resolve(path)] = await fileState(resolve(path));
  save('start-manifest.json', { runtime: { nodeVersion: process.version, execution: report.execution, fixtureClosureExecuted: false }, bundle, digestBundle,
    harnessPins: pins, acceptedInventoryProofReceipt: receipt, originalDatabase, stagingPath, ownedPath, originalBefore: report.originalBefore,
    retainedDataBefore: report.retainedDataBefore, appendCounts, expectedPhysicalHeadCasCount: 3,
    stopBoundary: report.boundary, constraints: ['ONLY_CUT19_CALIBRATION_AND_THREE_REMAINING_ACTORS', 'NO_REACCEPT_OF_SIX_OBSERVATIONS_OR_ADMITTED_PREFIX_TOTAL_VIEW_CALIBRATION',
      'NO_RETAINED_DATABASE_OPEN', 'OLD_FAILS_AND_END_UNKNOWN_RETAINED', 'NO_FULL_ROUTE_AI_OFFICIAL_PERFORMANCE_OR_WHOLE_RNG_CLAIM'] });
  report.startManifestPin = await fileState(resolve(out, 'start-manifest.json')); await assertParentPins();
  for (const suffix of ['', '-wal', '-shm', '-journal']) if (report.originalBefore[suffix || 'main'].exists) {
    copyFileSync(originalDatabase + suffix, stagingPath + suffix, constants.COPYFILE_EXCL); assert.deepEqual(await fileState(stagingPath + suffix), report.originalBefore[suffix || 'main']);
  }
  assert.deepEqual(await databaseFiles(originalDatabase), report.originalBefore);
  const digest = (await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  staging = new DatabaseSync(stagingPath, { readOnly: true }); staging.exec('PRAGMA query_only=1; BEGIN');
  const before = digest(staging); save('before-logical-with-rowid.json', before);
  const through = Object.create(null);
  for (const table of appendTables) { const q = staging.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.' + table); q.setReadBigInts(true); const row = q.get(); assert(row.lo === null || row.lo > 0n); through[table] = row.hi ?? 0n; }
  report.priorAppendRowidThrough = Object.fromEntries(Object.entries(through).map(([table, value]) => [table, String(value)]));
  const physicalBefore = rawRows(staging, mutable), worldBefore = rawRows(staging, 'world_control_heads');
  const targetBefore = physicalBefore.filter(row => row.enrollment_source_id === failedManifest.enrollmentSourceId); assert.equal(targetBefore.length, 1); assert.equal(targetBefore[0].operation_ordinal, 13n);
  assert.equal(targetBefore[0].last_source_id, inventory.latestPhysicalReference.sourceId); assert.equal(targetBefore[0].last_snapshot_hash, inventory.latestPhysicalReference.snapshotHash);
  save('physical-heads-before.lossless.json', persistRows(physicalBefore)); save('world-heads-before.lossless.json', persistRows(worldBefore));
  closeSync(openSync(ownedPath, 'wx')); report.backupPages = await backup(staging, ownedPath, { source: 'main', target: 'main' }); staging.exec('ROLLBACK'); staging.close(); staging = null;
  owned = new DatabaseSync(ownedPath, { readOnly: true }); owned.exec('PRAGMA query_only=1; BEGIN'); assert.deepEqual(digest(owned), before); owned.exec('ROLLBACK'); owned.close(); owned = null;
  report.ownedBefore = await databaseFiles(ownedPath);
  const records = resolve(out, 'records'), log = createWriteStream(resolve(out, 'vitest.log'), { flags: 'wx' });
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tools/verification/native-initial-defender-views-recovery-v217.test.ts', '--testNamePattern', 'NIR217-S01', '--maxWorkers=1', '--minWorkers=1'],
    { cwd: root, windowsHide: true, env: { ...process.env, BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_V217_DATABASE: ownedPath,
      BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_V217_INPUT: resolve(out, 'execution-input.lossless.json'), BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_RECOVERY_V217_OUTPUT: records } });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); report.nativeTestProcessId = child.pid;
  save('native-process.json', { processId: child.pid, at: new Date().toISOString(), records });
  const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); }); await new Promise(done => log.end(done));
  report.nativeTestExit = exit; assert.equal(exit.code, 0, 'remaining-only Native recovery failed; preserve records');
  const frontier = read(resolve(records, 'frontier.lossless.json')); save('frontier.lossless.json', frontier); report.frontier = frontier;
  const summary = read(resolve(records, 'summary.json')); assert.equal(summary.pass, true); report.nativeSummary = summary;
  assert.equal(frontier.boundary, report.boundary); assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut22:view');
  assert.equal(frontier.initialDefenderObservationCount, 9); assert.equal(frontier.scopedDefenderCalibrationCount, 9); assert.equal(frontier.observations.length, 9);
  assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 16); assert.equal(frontier.eventReferences.length, 22); assert.equal(Object.keys(frontier.resumePins).length, 25);
  assert.deepEqual(frontier.finalCurrent, frontier.finalHistorical); assert.deepEqual(frontier.currentPhysicalOperation.reference, frontier.finalCurrent.view.cut.physicalOperationReference);
  assert.deepEqual(frontier.worldBefore, inventory.world); assert.deepEqual(frontier.worldAfter, inventory.world); assert.equal(frontier.worldAfter.head.worldRevision, 2);
  assert.deepEqual(frontier.originalInputs, inventory.original); assert.deepEqual(frontier.normalOriginal, inventory.original); assert.deepEqual(frontier.modelDeclaration, inventory.modelDeclaration); assert.deepEqual(frontier.views, inventory.views);
  for (const [key, value] of Object.entries({ newObservationAcceptanceCount: 3, newPrefixAcceptanceCount: 3, newTotalAcceptanceRowCount: 30, newViewAcceptanceCount: 3,
    newScopedCalibrationAcceptanceCount: 4, retainedStageReacceptCount: 0, normalLifecycleAdvances: 3, recoveredCalibrationOnlyCount: 1,
    reusedObservationCount: 6, reusedPrefixCount: 6, reusedTotalRows: 60, reusedViewCount: 6, reusedScopedCalibrationCount: 5 })) assert.equal(frontier[key], value);
  assert.equal(frontier.finalLifecycleCurrentProven, true); assert.equal(frontier.firstObservationHistoryProven, true); assert.equal(frontier.initialDefenderObservationsAccepted, true);
  for (const key of ['otherRoutesFullReady', 'allRoutesReady', 'rawGazeRestored', 'continuingGazeProven', 'empiricallyCalibrated', 'nativePostInitialDefenderObservationConsumerProven',
    'resumeReady', 'defensiveAiAccepted', 'legalOutcomeProven', 'officialTerminalProven', 'fullContinuationComplete', 'wholeRngConsumptionProven', 'performancePass', 'originalFailedRunCompleted', 'originalFailedRunEndPinsClaimed']) assert.equal(frontier[key], false);
  assert.equal(frontier.nativeResumeAdapterRequired, true); assert.equal(frontier.calibrations.length, 1); assert.equal(frontier.calibrationReferences.length, 1);
  const stages = readFileSync(resolve(records, 'stages.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line));
  const stage = name => { const values = stages.filter(s => s.name === name); assert.equal(values.length, 1); return values[0]; };
  const checkpoint = item => read(resolve(records, 'checkpoint-' + item.index + '-' + item.name + '.lossless.json'));
  const authStage = stage('retained-current-cut19-cal0-and-six-observations-authenticated'); assert.deepEqual(checkpoint(authStage), inventory);
  let precedingCheckpoint = checkpoint(stage('normal-cut19-recovered-scoped-calibration-physical-world-checkpoint'));
  assert.equal(precedingCheckpoint.normalLifecycleAdvances, 0); assert.equal(precedingCheckpoint.newObservationAcceptanceCount, 0); assert.equal(precedingCheckpoint.newScopedCalibrationAcceptanceCount, 1);
  assert.deepEqual(precedingCheckpoint.finalCurrent, inventory.latestNormalCurrent); assert.equal(precedingCheckpoint.calibrations.length, 1);
  assert.equal(precedingCheckpoint.scopedCalibration.source.member.playerId, inventory.views[6].playerId);
  assert.deepEqual(precedingCheckpoint.prefix, inventory.iterations[5].prefix); assert.deepEqual(precedingCheckpoint.totals, inventory.iterations[5].totals);
  let priorPhysical = inventory.latestPhysicalReference, priorView = inventory.latestAcceptedViewReference, lastStage = stage('normal-cut19-recovered-scoped-calibration-physical-world-checkpoint');
  assert(authStage.index < lastStage.index);
  for (let index = 0; index < 9; index++) {
    const item = frontier.observations[index], initial = inventory.views[index], observation = item.observation;
    assert.equal(item.playerId, initial.playerId); assert.equal(observation.operationOrdinal, 8 + index); assert.equal(observation.actionResult.kind, 'defender_observation_v1');
    assert.deepEqual(item.actionResult, observation.actionResult); assert.deepEqual(item.receipt, observation.actionResult.receipt); assert.deepEqual(item.observationSource, observation.source);
    assert.deepEqual(observation.field, inventory.original.fieldStep.field); assert.deepEqual(observation.timeline, inventory.original.fieldStep.timeline); assert.equal(observation.evaluationTick, inventory.original.fieldStep.evaluationTick);
    assert.deepEqual(item.observationSource.action.view, initial.view); assert.equal(item.observationSource.action.previousObservationReference, null); assert.equal(item.actionResult.samplingRequest.previousObservationSourceId, null);
    assert.deepEqual(frontier.resumePins['defenderObservationReference' + (index + 1)], item.observationReference);
    if (index < 6) { const old = inventory.iterations[index]; assert.deepEqual(item.observation, old.observation); assert.deepEqual(item.observationSource, old.observationSource);
      assert.deepEqual(item.observationReference, old.observationReference); assert.deepEqual(item.inputCalibrationReference, old.inputCalibrationReference);
      assert.deepEqual(item.precedingLifecycleViewReference, old.precedingLifecycleViewReference); continue; }
    const acceptedStage = stage('normal-defender-observation-' + (index + 1) + '-accepted-before-lifecycle'), currentStage = stage('normal-cut' + (14 + index) + '-current-scoped-calibration-physical-world-checkpoint');
    assert(lastStage.index < acceptedStage.index && acceptedStage.index < currentStage.index);
    assert.deepEqual(item.observationSource.previousOperationReference, priorPhysical); assert.deepEqual(item.observationSource.previousFieldReference, priorPhysical);
    assert.deepEqual(item.precedingLifecycleViewReference, priorView); assert.deepEqual(item.inputCalibrationReference, precedingCheckpoint.scopedCalibrationReference);
    const current = checkpoint(currentStage); assert.equal(current.normalLifecycleAdvances, index - 5); assert.equal(current.calibrations.length, 1); assert.equal(current.totals.length, 10);
    assert.deepEqual(current.finalCurrent, current.finalHistorical); assert.deepEqual(current.currentPhysicalOperation.reference, item.observationReference); assert.deepEqual(current.currentPhysicalOperation.record, observation);
    assert.deepEqual(current.prefix.source.eventReferences, [...inventory.eventReferences, ...frontier.observations.slice(6, index + 1).map(o => o.observationReference)]);
    assert.deepEqual(current.world, inventory.world); assert.equal(current.scopedCalibration.source.member.playerId, inventory.views[(index + 1) % 9].playerId);
    assert.deepEqual(current.projectionProof.evidence.fieldReference, item.observationReference); assert.equal(current.projectionProof.evidence.targetTicksPerSecond, 1_000_000);
    assert.deepEqual(current.scopedCalibration.source.viewReference, current.finalViewReference); assert.deepEqual(current.observations, frontier.observations.slice(0, index + 1));
    precedingCheckpoint = current; priorPhysical = item.observationReference; priorView = current.finalViewReference; lastStage = currentStage;
  }
  assert(lastStage.index < stage('normal-initial-defender-views-recovered-cut22-authenticated').index);
  for (const key of ['finalViewReference', 'finalCurrent', 'finalHistorical', 'prefix', 'totals', 'calibrations', 'calibrationReferences', 'currentPhysicalOperation', 'resumePins', 'eventReferences']) assert.deepEqual(precedingCheckpoint[key], frontier[key]);
  owned = new DatabaseSync(ownedPath, { readOnly: true }); owned.exec('PRAGMA query_only=1; BEGIN'); const after = digest(owned), oldSubset = digest(owned, through);
  assert.equal(after.catalogSha256, before.catalogSha256); assert.deepEqual(catalogRecords(after.catalog), catalogRecords(before.catalog)); assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables));
  report.appendedRows = {};
  for (const table of Object.keys(before.tables)) {
    if (Object.hasOwn(appendCounts, table)) { assert.deepEqual(oldSubset.tables[table], before.tables[table]); assert.equal(after.tables[table].rows - before.tables[table].rows, appendCounts[table]); report.appendedRows[table] = appendCounts[table]; }
    else if (table !== mutable) assert.deepEqual(after.tables[table], before.tables[table]);
  }
  const physicalAfter = rawRows(owned, mutable), expectedPhysical = physicalBefore.map(row => Object.assign(Object.create(null), row));
  const target = expectedPhysical.find(row => row.enrollment_source_id === failedManifest.enrollmentSourceId); target.operation_ordinal = 16n;
  target.last_owner = frontier.currentPhysicalOperation.reference.owner; target.last_source_id = frontier.currentPhysicalOperation.reference.sourceId; target.last_snapshot_hash = frontier.currentPhysicalOperation.reference.snapshotHash;
  assert.deepEqual(physicalAfter, expectedPhysical); assert.deepEqual(rawRows(owned, 'world_control_heads'), worldBefore);
  for (const [table, count] of Object.entries({ pa_physical_v1_field_steps: 9, pa_lifecycle_v1_work_prefixes: 9, pa_lifecycle_v1_total_assessments: 90, pa_lifecycle_v1_execution_views: 9, pa_lifecycle_v1_execution_calibrations: 9 })) assert.equal(after.tables[table].rows - originalV212Logical.tables[table].rows, count);
  save('after-logical-with-rowid.json', after); save('physical-heads-after.lossless.json', persistRows(physicalAfter));
  report.appendedRowsTotal = Object.values(report.appendedRows).reduce((n, count) => n + count, 0); assert.equal(report.appendedRowsTotal, 43);
  report.onlyExpectedThreePhysicalHeadCasProven = true; report.oldRowsRowidsSchemaAndAllOtherHeadsUnchanged = true; report.worldUnchanged = true;
  report.combinedV214V217RowsProven = true; report.combinedRows = 126; report.combinedPhysicalHeadCasCount = 9;
  report.combinedProvenance = 'V216_PROOF_83_ROWS_6_CAS_PLUS_THIS_43_ROWS_3_CAS_WITH_ALL_PRIOR_ROWS_ROWIDS_UNCHANGED';
  report.finalLifecycleCurrentProven = true; report.initialDefenderObservationsAccepted = true; report.initialDefenderObservationCount = 9; report.newObservationAcceptanceCount = 3; report.newScopedCalibrationAcceptanceCount = 4; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  try { for (const db of [owned, staging]) if (db) { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } } catch (error) { report.closeError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    await assertParentPins(); report.retainedDataAfter = {};
    for (const [path, pin] of retainedDatabases) { const current = await databaseFiles(path); assert.deepEqual(dataPin(current), dataPin(pin)); report.retainedDataAfter[path] = current; }
    for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
    for (const closure of [bundle, digestBundle].filter(Boolean)) {
      assert.deepEqual(await fileState(closure.bundlePath), { exists: true, bytes: closure.bytes, sha256: closure.sha256 });
      for (const [path, pin] of Object.entries(closure.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
    }
    assert.deepEqual(await fileState(resolve(out, 'start-manifest.json')), report.startManifestPin);
    report.ownedAfter = await databaseFiles(ownedPath); report.retainedDataUnchanged = true; report.parentAndNewSourceHarnessInputBundleEndPinsProven = true;
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, appendedRows: report.appendedRows, newObservationAcceptanceCount: report.newObservationAcceptanceCount,
  finalLifecycleCurrentProven: report.finalLifecycleCurrentProven, onlyExpectedThreePhysicalHeadCasProven: report.onlyExpectedThreePhysicalHeadCasProven,
  retainedDataUnchanged: report.retainedDataUnchanged, originalFailedRunCompleted: false, fullContinuationComplete: false, performancePass: false,
  error: report.error ?? report.closeError ?? report.pinError ?? null }));
