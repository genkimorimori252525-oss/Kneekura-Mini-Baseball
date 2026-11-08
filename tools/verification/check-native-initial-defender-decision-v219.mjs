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
assert.equal(accepted, resolve('docs/verification/realism-debug-20261027/native-initial-defender-views-recovery-v217-01')); assert(!existsSync(out));
const bytePin = bytes => ({ exists: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
const pins = {}, readBytes = path => { const bytes = readFileSync(path); pins[path] = bytePin(bytes); return bytes; };
const read = path => parseDebugRecord(readBytes(path).toString('utf8'));
const tree = path => readdirSync(path, { withFileTypes: true }).flatMap(item => item.isDirectory() ? tree(resolve(path, item.name)) : [resolve(path, item.name)]).sort();
const parentPaths = tree(accepted); for (const path of parentPaths) readBytes(path);
const parent = read(resolve(accepted, 'start-manifest.json')), previous = read(resolve(accepted, 'report.json'));
const frontier217 = read(resolve(accepted, 'records/frontier.lossless.json')); assert.deepEqual(read(resolve(accepted, 'frontier.lossless.json')), frontier217);
for (const key of ['pass', 'onlyExpectedThreePhysicalHeadCasProven', 'oldRowsRowidsSchemaAndAllOtherHeadsUnchanged', 'worldUnchanged',
  'combinedV214V217RowsProven', 'retainedDataUnchanged', 'parentAndNewSourceHarnessInputBundleEndPinsProven', 'finalLifecycleCurrentProven', 'initialDefenderObservationsAccepted']) assert.equal(previous[key], true);
for (const key of ['originalFailedRunCompleted', 'originalFailedRunEndPinsClaimed', 'fullContinuationComplete', 'performancePass', 'wholeRngConsumptionProven']) assert.equal(previous[key], false);
assert.equal(previous.appendedRowsTotal, 43); assert.equal(previous.combinedRows, 126); assert.equal(previous.combinedPhysicalHeadCasCount, 9);
assert.equal(frontier217.finalViewReference.sourceId, 'physical-fixture:cut22:view'); assert.equal(frontier217.currentPhysicalOperation.record.operationOrdinal, 16);
assert.equal(frontier217.initialDefenderObservationCount, 9); assert.equal(frontier217.observations.length, 9); assert.equal(frontier217.calibrations.length, 1);
assert.equal(Object.keys(frontier217.resumePins).length, 25); assert.equal(frontier217.eventReferences.length, 22); assert.equal(frontier217.worldAfter.head.worldRevision, 2);
const receiptPath = resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_ae2a0eb959a945a5a9e69f43e9fdca40.json');
const receipt = read(receiptPath); assert.equal(receipt.task_id, 'MB-20261027-REALISM-DEBUG-PLAN'); assert.equal(receipt.result, 'PASS'); assert.equal(receipt.exit_code, 0);
assert.deepEqual(receipt.command, ['node', 'tools/verification/check-native-initial-defender-views-recovery-v217.mjs',
  'work/native-initial-defender-inventory-proof-v216-01', 'docs/verification/realism-debug-20261027/native-initial-defender-views-recovery-v217-01']);
assert.equal(receipt.output_sha256, '3c1addeb6f13f76d58a4235ceb5bf64741ac1a286586c2fc6cc1b5f578fcde15');
assert.equal(bytePin(readBytes(resolve(receipt.output_path))).sha256, receipt.output_sha256);
const parentInput = read(resolve(accepted, 'execution-input.lossless.json'));
const modelDeclaration = { sourceId: 'native-initial-defender-decision-v219:nominal-pursuit-hold-model',
  sourceVersion: 'same_pa_nominal_initial_pursuit_hold_decision_v219', evidenceAuthority: 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_PREPLAY_PLAN',
  empiricallyCalibrated: false, scope: 'FIRST_RETAINED_DEFENDER_DECISION_ONLY', actorSelection: 'INITIAL_VIEW_ORDER_FIRST_ACTOR',
  priorities: { ballPursuitPriority: 1, baseCoverPriorities: [], relayPriority: 0, backupPriority: 0, deepCoveragePriority: 0, holdPriority: 0 } };
const retained = Object.fromEntries(['originalInputs', 'retainedInputReferences', 'resumePins', 'finalViewReference', 'eventReferences', 'modelDeclaration', 'views', 'observations'].map(key => [key, frontier217[key]]));
const input = { inventoryInput: parentInput.inventoryInput, retained, decisionModelDeclaration: modelDeclaration };
const originalDatabase = resolve(previous.ownedPath); assert.equal(originalDatabase, resolve(accepted, 'initial-defender-recovery-private.sqlite'));
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const retainedDatabases = new Map(Object.entries(previous.retainedDataAfter).map(([path, pin]) => [resolve(path), pin])); assert.equal(retainedDatabases.size, 14);
assert(!retainedDatabases.has(originalDatabase)); retainedDatabases.set(originalDatabase, previous.ownedAfter); assert.equal(retainedDatabases.size, 15);
const assertParentPins = async () => {
  assert.deepEqual(tree(accepted), parentPaths);
  for (const [path, pin] of Object.entries(parent.harnessPins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
  for (const bundle of [parent.bundle, parent.digestBundle]) {
    assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
    for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
  }
  for (const [path, pin] of Object.entries(pins)) assert.deepEqual(await fileState(resolve(root, path)), pin);
};
const appendCounts = { pa_physical_v1_field_steps: 1, pa_lifecycle_v1_work_prefixes: 1, pa_lifecycle_v1_total_assessments: 10,
  pa_lifecycle_v1_execution_views: 1, pa_lifecycle_v1_execution_calibrations: 1 }, appendTables = Object.keys(appendCounts), mutable = 'pa_physical_v1_heads';
const rawRows = (db, table) => { const q = db.prepare('SELECT rowid AS native_rowid,* FROM main."' + table.replaceAll('"', '""') + '" ORDER BY rowid'); q.setReadBigInts(true); return q.all(); };
const persistRows = rows => rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'bigint' ? { kind: 'SQLITE_INTEGER', decimal: String(value) } : value])));
const catalogRecords = rows => rows.map(row => { assert.deepEqual(Object.keys(row), ['type', 'name', 'tbl_name', 'sql']);
  for (const key of ['type', 'name', 'tbl_name']) assert.equal(typeof row[key], 'string'); assert(row.sql === null || typeof row.sql === 'string'); return Object.fromEntries(Object.entries(row)); });
await assertParentPins(); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const stagingPath = resolve(out, 'retained-data-staging.sqlite'), ownedPath = resolve(out, 'initial-defender-decision-private.sqlite');
const report = { pass: false, boundary: 'NATIVE_INITIAL_DEFENDER_DECISION_CHECKPOINT_ONLY', originalDatabase, ownedPath,
  acceptedV217Receipt: receiptPath, acceptedV217Command: receipt.command, execution: 'VITEST_ORIGINAL_SOURCE_ENTRY', fixtureClosureExecuted: false,
  originalFailedRunCompleted: false, originalFailedRunEndPinsClaimed: false, retainedStageReacceptCount: 0, performancePass: false,
  fullContinuationComplete: false, wholeRngConsumptionProven: false, privateArtifactNotForPublication: true };
let staging, owned, bundle, digestBundle;
try {
  report.retainedDataBefore = {};
  for (const [path, pin] of retainedDatabases) { const current = await databaseFiles(path); assert.deepEqual(dataPin(current), dataPin(pin)); report.retainedDataBefore[path] = current; }
  report.originalBefore = report.retainedDataBefore[originalDatabase];
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-initial-defender-decision-v219.test.ts', outputPath: resolve(out, 'source-closure-not-executed.mjs') });
  digestBundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-sql.ts', outputPath: resolve(out, 'digest-bundle.mjs') });
  assert.deepEqual(Object.keys(digestBundle.sourcePins), ['tools/verification/NativeSpinNeutralV193-sql.ts']);
  const modelPath = resolve(out, 'nominal-initial-defender-decision-model.lossless.json'); save('nominal-initial-defender-decision-model.lossless.json', modelDeclaration);
  const modelBytes = readBytes(modelPath); input.decisionModelDeclaration = parseDebugRecord(modelBytes.toString('utf8')); report.modelArtifact = { path: modelPath, pin: bytePin(modelBytes), declaration: modelDeclaration };
  save('execution-input.lossless.json', input); pins[resolve(out, 'execution-input.lossless.json')] = await fileState(resolve(out, 'execution-input.lossless.json'));
  for (const path of ['tools/verification/check-native-initial-defender-decision-v219.mjs', 'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) pins[resolve(path)] = await fileState(resolve(path));
  save('start-manifest.json', { runtime: { nodeVersion: process.version, execution: report.execution, fixtureClosureExecuted: false }, bundle, digestBundle,
    harnessPins: pins, acceptedV217Receipt: receipt, originalDatabase, stagingPath, ownedPath, originalBefore: report.originalBefore,
    retainedDataBefore: report.retainedDataBefore, modelArtifact: report.modelArtifact, appendCounts, expectedPhysicalHeadCasCount: 1,
    constraints: ['FIRST_RETAINED_VIEW_ACTOR_ONLY', 'NORMAL_PERCEPTION_ONLY_HOLD_IS_VALID', 'NO_RETAINED_DATABASE_OPEN', 'NO_REACCEPT_OF_PARENT_WORK',
      'ONE_DECISION_CALIBRATION_ONE_DECISION_ONE_LIFECYCLE_ADMISSION_NO_CUT23_CALIBRATION', 'NO_FULL_AI_MOVEMENT_ASSIGNMENT_OFFICIAL_PERFORMANCE_OR_WHOLE_RNG_CLAIM'] });
  report.startManifestPin = await fileState(resolve(out, 'start-manifest.json')); await assertParentPins();
  for (const suffix of ['', '-wal', '-shm', '-journal']) if (report.originalBefore[suffix || 'main'].exists) {
    copyFileSync(originalDatabase + suffix, stagingPath + suffix, constants.COPYFILE_EXCL); assert.deepEqual(await fileState(stagingPath + suffix), report.originalBefore[suffix || 'main']);
  }
  assert.deepEqual(await databaseFiles(originalDatabase), report.originalBefore);
  const digest = (await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  staging = new DatabaseSync(stagingPath, { readOnly: true }); staging.exec('PRAGMA query_only=1; BEGIN'); const before = digest(staging); save('before-logical-with-rowid.json', before);
  const through = Object.create(null); for (const table of appendTables) { const q = staging.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.' + table); q.setReadBigInts(true); const row = q.get(); assert(row.lo === null || row.lo > 0n); through[table] = row.hi ?? 0n; }
  report.priorAppendRowidThrough = Object.fromEntries(Object.entries(through).map(([table, value]) => [table, String(value)]));
  const physicalBefore = rawRows(staging, mutable), worldBefore = rawRows(staging, 'world_control_heads'); assert.equal(physicalBefore.length, 1);
  assert.equal(physicalBefore[0].operation_ordinal, 16n); assert.equal(physicalBefore[0].last_source_id, frontier217.currentPhysicalOperation.reference.sourceId);
  assert.equal(physicalBefore[0].last_snapshot_hash, frontier217.currentPhysicalOperation.reference.snapshotHash);
  save('physical-heads-before.lossless.json', persistRows(physicalBefore)); save('world-heads-before.lossless.json', persistRows(worldBefore));
  closeSync(openSync(ownedPath, 'wx')); report.backupPages = await backup(staging, ownedPath, { source: 'main', target: 'main' }); staging.exec('ROLLBACK'); staging.close(); staging = null;
  owned = new DatabaseSync(ownedPath, { readOnly: true }); owned.exec('PRAGMA query_only=1; BEGIN'); assert.deepEqual(digest(owned), before); owned.exec('ROLLBACK'); owned.close(); owned = null; report.ownedBefore = await databaseFiles(ownedPath);
  const records = resolve(out, 'records'), log = createWriteStream(resolve(out, 'vitest.log'), { flags: 'wx' });
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tools/verification/native-initial-defender-decision-v219.test.ts', '--testNamePattern', 'NID219-S01', '--maxWorkers=1', '--minWorkers=1'],
    { cwd: root, windowsHide: true, env: { ...process.env, BASEBALL_NATIVE_INITIAL_DEFENDER_DECISION_V219_DATABASE: ownedPath,
      BASEBALL_NATIVE_INITIAL_DEFENDER_DECISION_V219_INPUT: resolve(out, 'execution-input.lossless.json'), BASEBALL_NATIVE_INITIAL_DEFENDER_DECISION_V219_OUTPUT: records } });
  child.stdout.pipe(log, { end: false }); child.stderr.pipe(log, { end: false }); report.nativeTestProcessId = child.pid; save('native-process.json', { processId: child.pid, at: new Date().toISOString(), records });
  const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('close', (code, signal) => done({ code, signal })); }); await new Promise(done => log.end(done));
  report.nativeTestExit = exit; assert.equal(exit.code, 0, 'one normal Native decision failed; preserve records');
  const frontier = read(resolve(records, 'frontier.lossless.json')); save('frontier.lossless.json', frontier); report.frontier = frontier;
  assert.equal(read(resolve(records, 'summary.json')).pass, true); assert.equal(frontier.boundary, report.boundary);
  assert.equal(frontier.finalViewReference.sourceId, 'physical-fixture:cut23:view'); assert.equal(frontier.currentPhysicalOperation.record.operationOrdinal, 17);
  assert.equal(frontier.eventReferences.length, 23); assert.equal(Object.keys(frontier.resumePins).length, 27); assert.deepEqual(frontier.finalCurrent, frontier.finalHistorical);
  assert.deepEqual(frontier.currentPhysicalOperation.record, frontier.decision); assert.deepEqual(frontier.currentPhysicalOperation.reference, frontier.decisionReference);
  assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference, frontier.decisionReference); assert.deepEqual(frontier.decisionModelDeclaration, modelDeclaration);
  assert.deepEqual(frontier.retained, retained); assert.deepEqual(frontier.resumePins.defenderDecisionReference, frontier.decisionReference);
  assert.deepEqual(frontier.resumePins.defenderDecisionCalibrationReference, frontier.decisionCalibrationReference);
  assert.equal(frontier.playerId, frontier217.views[0].playerId); assert.deepEqual(frontier.observationReference, frontier217.observations[0].observationReference);
  assert.deepEqual(frontier.precedingPhysicalReference, frontier217.currentPhysicalOperation.reference); assert.deepEqual(frontier.decisionSource.previousOperationReference, frontier.precedingPhysicalReference);
  assert.deepEqual(frontier.decisionSource.action.observationReference, frontier.observationReference); assert.deepEqual(frontier.decisionSource.action.priorities, modelDeclaration.priorities);
  assert.deepEqual(frontier.actionResult, frontier.decision.actionResult); assert.equal(frontier.decision.actionResult.kind, 'defender_decision_v1'); assert(['hold', 'ball_handler'].includes(frontier.decision.actionResult.calculation.selected.intent.kind));
  assert.deepEqual(frontier.decision.field, frontier217.currentPhysicalOperation.record.field); assert.equal(frontier.decision.evaluationTick, frontier217.currentPhysicalOperation.record.evaluationTick);
  assert.equal(frontier.decisionCalibration.source.route, 'defender_decision'); assert.equal(frontier.decisionCalibration.source.member.playerId, frontier.playerId);
  assert.deepEqual(frontier.decisionCalibration.source.viewReference, frontier217.finalViewReference); assert.equal(frontier.calibrations.length, 0); assert.equal(frontier.calibrationReferences.length, 0);
  for (const [key, value] of Object.entries(frontier217.resumePins)) assert.deepEqual(frontier.resumePins[key], value);
  assert.deepEqual(frontier.eventReferences, [...frontier217.eventReferences, frontier.decisionReference]);
  assert.deepEqual(frontier.worldBefore, frontier217.worldAfter); assert.deepEqual(frontier.worldAfter, frontier217.worldAfter);
  for (const [key, expected] of Object.entries({ newDecisionCalibrationAcceptanceCount: 1, newDecisionAcceptanceCount: 1, newPrefixAcceptanceCount: 1,
    newTotalAcceptanceRowCount: 10, newViewAcceptanceCount: 1, normalLifecycleAdvances: 1, retainedStageReacceptCount: 0 })) assert.equal(frontier[key], expected);
  assert.equal(frontier.finalLifecycleCurrentProven, true); assert.equal(frontier.initialDefenderDecisionAccepted, true);
  for (const key of ['otherRoutesFullReady', 'allRoutesReady', 'empiricallyCalibrated', 'nativePostInitialDefenderDecisionConsumerProven', 'resumeReady',
    'defensiveAiAccepted', 'movementAccepted', 'assignmentProven', 'legalOutcomeProven', 'officialTerminalProven', 'fullContinuationComplete', 'performancePass', 'wholeRngConsumptionProven']) assert.equal(frontier[key], false);
  const stages = readBytes(resolve(records, 'stages.jsonl')).toString('utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(stages.map(s => s.name), ['retained-current-cut22-nine-observations-authenticated', 'normal-cut22-decision-calibration-accepted',
    'normal-initial-defender-decision-accepted-before-lifecycle', 'normal-initial-defender-decision-cut23-authenticated']);
  const checkpoints = stages.map(s => read(resolve(records, 'checkpoint-' + s.index + '-' + s.name + '.lossless.json')));
  assert.deepEqual(checkpoints[1].decisionCalibration, frontier.decisionCalibration); assert.deepEqual(checkpoints[2].decision, frontier.decision); assert.deepEqual(checkpoints[3], frontier);
  owned = new DatabaseSync(ownedPath, { readOnly: true }); owned.exec('PRAGMA query_only=1; BEGIN'); const after = digest(owned), oldSubset = digest(owned, through);
  assert.equal(after.catalogSha256, before.catalogSha256); assert.deepEqual(catalogRecords(after.catalog), catalogRecords(before.catalog)); assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables));
  report.appendedRows = {}; for (const table of Object.keys(before.tables)) {
    if (Object.hasOwn(appendCounts, table)) { assert.deepEqual(oldSubset.tables[table], before.tables[table]); assert.equal(after.tables[table].rows - before.tables[table].rows, appendCounts[table]); report.appendedRows[table] = appendCounts[table]; }
    else if (table !== mutable) assert.deepEqual(after.tables[table], before.tables[table]);
  }
  const physicalAfter = rawRows(owned, mutable), expectedPhysical = physicalBefore.map(row => Object.assign(Object.create(null), row));
  expectedPhysical[0].operation_ordinal = 17n; expectedPhysical[0].last_owner = frontier.decisionReference.owner;
  expectedPhysical[0].last_source_id = frontier.decisionReference.sourceId; expectedPhysical[0].last_snapshot_hash = frontier.decisionReference.snapshotHash;
  assert.deepEqual(physicalAfter, expectedPhysical); assert.deepEqual(rawRows(owned, 'world_control_heads'), worldBefore);
  save('after-logical-with-rowid.json', after); save('physical-heads-after.lossless.json', persistRows(physicalAfter));
  report.appendedRowsTotal = Object.values(report.appendedRows).reduce((n, count) => n + count, 0); assert.equal(report.appendedRowsTotal, 14);
  report.onlyExpectedPhysicalHeadCasProven = true; report.oldRowsRowidsSchemaAndAllOtherHeadsUnchanged = true; report.worldUnchanged = true;
  report.finalLifecycleCurrentProven = true; report.initialDefenderDecisionAccepted = true; report.pass = true;
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
    assert.deepEqual(await fileState(resolve(out, 'start-manifest.json')), report.startManifestPin); report.ownedAfter = await databaseFiles(ownedPath);
    report.retainedDataUnchanged = true; report.parentAndNewSourceHarnessInputBundleEndPinsProven = true;
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, appendedRows: report.appendedRows, initialDefenderDecisionAccepted: report.initialDefenderDecisionAccepted,
  retainedDataUnchanged: report.retainedDataUnchanged, fullContinuationComplete: false, performancePass: false, error: report.error ?? report.closeError ?? report.pinError ?? null }));
