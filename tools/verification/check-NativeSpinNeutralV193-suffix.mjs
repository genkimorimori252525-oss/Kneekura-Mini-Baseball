import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), input = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? ''), rel = relative(root, out);
assert(process.argv.length === 4 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'gate report and new workspace output required');
const gate = parseDebugRecord(readFileSync(input, 'utf8'));
assert(gate.pass && gate.currentCoverageProven && gate.frontier?.viewReference?.sourceId === 'physical-fixture:cut4:view', 'genuine completed cut4 gate required');
const baseline = resolve(gate.copyPath), destination = resolve(out, 'suffix-private.sqlite'), records = resolve(out, 'records');
assert(existsSync(baseline)); mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, boundary: 'NATIVE_RETAINED_GOLD_NO_TARGET_SUFFIX_ONLY', inputReport: input, baselinePath: baseline, copyPath: destination,
  execution: 'VITEST_REAL_SOURCE', closureBundleExecuted: false, practiceRegenerated: false, performancePass: false,
  secondNativeControlBranchProven: false, officialTerminalProven: false, wholeRngConsumptionProven: false,
  productionMasteryCalibrationProven: false, naturalGoldRarityProven: false, privateArtifactNotForPublication: true };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
const appendTables = ['pa_lifecycle_v1_work_prefixes', 'pa_lifecycle_v1_total_assessments', 'pa_lifecycle_v1_execution_views', 'pa_lifecycle_v1_execution_calibrations',
  'pa_physical_v1_cuts', 'pa_physical_v1_commitments', 'pa_physical_v1_resolutions', 'batting_observation_v1_deliveries', 'batting_prediction_v1_predictions',
  'batting_score_v1_assessments', 'batting_execution_v1_inputs', 'batting_emotion_execution_v1_executions', 'world_decision_revision_events'];
const mutableTables = ['pa_physical_v1_heads', 'batting_observation_v1_invocation_heads', 'batting_execution_v1_heads', 'batting_emotion_execution_v1_heads', 'world_control_heads'];
const allowed = new Set([...appendTables, ...mutableTables]);
let source, target, digestBundle, closureBundle;
try {
  report.baselineBefore = await databaseFiles(baseline); assert.deepEqual(dataPin(report.baselineBefore), dataPin(gate.copyAfter), 'retained cut4 baseline changed');
  report.harnessPins = {};
  for (const path of [input, resolve(relative(root, input), '../frontier.lossless.json'), 'tools/verification/check-NativeSpinNeutralV193-suffix.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) report.harnessPins[path] = await fileState(resolve(root, path));
  digestBundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-sql.ts', outputPath: resolve(out, 'digest-bundle.mjs') });
  // This closure is a static Source pin only. Vitest executes the unchanged
  // real test/module files; the unused closure is never imported as a runtime.
  closureBundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-suffix.test.ts', outputPath: resolve(out, 'source-closure-not-executed.mjs') });
  const digest = (await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source = new DatabaseSync(baseline, { readOnly: true }); source.exec('PRAGMA query_only=1; BEGIN');
  const before = digest(source); save('baseline-logical-with-rowid.json', before);
  const through = Object.create(null);
  for (const table of appendTables.filter(table => Object.hasOwn(before.tables, table))) {
    const query = source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.' + table); query.setReadBigInts(true);
    const row = query.get(); assert(row.lo === null || row.lo > 0n); through[table] = row.hi ?? 0n;
  }
  report.priorAppendRowidThrough = Object.fromEntries(Object.entries(through).map(([key, value]) => [key, String(value)]));
  assert(!existsSync(destination)); closeSync(openSync(destination, 'wx'));
  report.backupPages = await backup(source, destination, { source: 'main', target: 'main' });
  source.exec('ROLLBACK'); source.close(); source = null;
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN'); assert.deepEqual(digest(target), before);
  target.exec('ROLLBACK'); target.close(); target = null;
  report.copyBefore = await databaseFiles(destination);
  report.executionStartedAt = new Date().toISOString();
  const output = createWriteStream(resolve(out, 'vitest.log'), { flags: 'wx' });
  const child = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tools/verification/NativeSpinNeutralV193-suffix.test.ts',
    '--testNamePattern', 'NSN193-S01', '--maxWorkers=1', '--minWorkers=1'], { cwd: root, windowsHide: true,
    env: { ...process.env, BASEBALL_NATIVE_SPIN_NEUTRAL_V193_SUFFIX_DATABASE: destination, BASEBALL_NATIVE_SPIN_NEUTRAL_V193_SUFFIX_OUTPUT: records } });
  child.stdout.pipe(output, { end: false }); child.stderr.pipe(output, { end: false });
  report.nativeTestProcessId = child.pid;
  console.log(JSON.stringify({ stage: 'bounded-native-suffix-started', processId: child.pid, recordsPath: records }));
  const exit = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', (code, signal) => done({ code, signal })); });
  await new Promise(done => output.end(done)); report.nativeTestExit = exit; report.executionEndedAt = new Date().toISOString();
  assert.equal(exit.code, 0, 'Native suffix failed; retained output is in vitest.log/records');
  report.nativeSummary = JSON.parse(readFileSync(resolve(records, 'summary.json'), 'utf8'));
  assert(report.nativeSummary.pass && report.nativeSummary.consumerAdoptionProven && report.nativeSummary.actualContactCount === 1 && report.nativeSummary.ordinaryExecutionEqual);
  target = new DatabaseSync(destination, { readOnly: true }); target.exec('PRAGMA query_only=1; BEGIN');
  const after = digest(target), prior = digest(target, through); save('suffix-logical-with-rowid.json', after);
  for (const old of before.catalog) assert.deepEqual(after.catalog.find(row => row.type === old.type && row.name === old.name), old, 'existing schema entry changed: ' + old.name);
  report.catalogAdded = after.catalog.filter(row => !before.catalog.some(old => row.type === old.type && row.name === old.name));
  for (const added of report.catalogAdded) assert(allowed.has(added.tbl_name), 'unexpected new schema entry: ' + added.name);
  for (const [table, old] of Object.entries(before.tables)) if (!mutableTables.includes(table)) assert.deepEqual(prior.tables[table], old, 'existing immutable owner rows changed: ' + table);
  report.changedTables = Object.keys(after.tables).filter(table => JSON.stringify(after.tables[table]) !== JSON.stringify(before.tables[table]));
  for (const table of report.changedTables) assert(allowed.has(table), 'unexpected changed table: ' + table);
  report.allowedAppendTables = appendTables; report.allowedMutableTables = mutableTables; report.existingImmutableRowsAndSchemaUnchanged = true;
  target.exec('ROLLBACK'); target.close(); target = null;
  report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  for (const db of [source, target]) if (db) try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); }
    catch (error) { report.cleanupError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    report.baselineAfter = await databaseFiles(baseline); report.copyAfter = await databaseFiles(destination);
    assert.deepEqual(dataPin(report.baselineAfter), dataPin(report.baselineBefore)); report.baselineDataUnchanged = true;
    report.shmObservation = { before: report.baselineBefore['-shm'], after: report.baselineAfter['-shm'] };
    report.bundles = [];
    for (const bundle of [digestBundle, closureBundle].filter(Boolean)) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
      const pins = {};
      for (const [path, pin] of Object.entries(bundle.sourcePins)) { const end = await fileState(resolve(root, path));
        assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }); pins[path] = { ...pin, endSha256: end.sha256 }; }
      report.bundles.push({ executed: bundle === digestBundle, inputCount: bundle.inputCount, sha256: bundle.sha256, sourcePins: pins });
    }
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, baselineDataUnchanged: report.baselineDataUnchanged, nativeSummary: report.nativeSummary,
  execution: report.execution, closureBundleExecuted: false, error: report.error ?? report.pinError ?? null }));
