import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, constants } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), original = resolve(process.argv[2] ?? ''), out = resolve(process.argv[3] ?? ''), rel = relative(root, out);
assert(process.argv.length === 4 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'retained early database and new workspace output required');
assert(original.endsWith('official-pitch-workload-fd7d2fdb-5b7d-4c8e-b927-39fc5ae79522.sqlite') && existsSync(original), 'exact retained Native193-01 database required');
mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const earlyReceiptPath = resolve(root, 'docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_d99f10b03fac48329faf5cc12a77d34c.json');
const earlyStagesPath = resolve(dirname(original), '../stages.jsonl');
const locatorInputs = { actor: { owner: 'physical_plate_appearance_actors', sourceId: 'batter-1' },
  qualifications: ['native-spin-neutral-v193:back:mastery-backspin', 'native-spin-neutral-v193:top:mastery-topspin'].map(sourceId => ({ owner: 'world_spin_mastery_v123', sourceId })),
  action: { owner: 'pa_physical_v1_action_plans', sourceId: 'native-spin-neutral-v193:pitch3:action' },
  posture: { owner: 'batting_observation_v1_postures', sourceId: 'native-spin-neutral-v193:pitch3:posture' },
  intent: { owner: 'batting_execution_v1_intents', sourceId: 'native-spin-neutral-v193:pitch3:intent' },
  preparedRight: { owner: 'pa_physical_v1_rights', sourceId: 'native-spin-neutral-v193:pitch3:action:right', authority: 'UNAUTHENTICATED_LOCATOR_ONLY' },
  fullReferences: 'UNKNOWN_UNTIL_NORMAL_READERS_AUTHENTICATE' };
const report = { pass: false, boundary: 'NATIVE_READONLY_PROSPECTIVE_PRELAUNCH_BOUNDARY_ONLY', originalPath: original,
  execution: 'PINNED_NODE_ENTRY', originalFailedReceipt: 'd99f10b03fac48329faf5cc12a77d34c', originalFailedResult: 'TIMEOUT',
  originalExecutionSourceEndPin: 'UNKNOWN', newSourcesAuthored: 0, newWriterCalls: 0, newPhysicalOperationsAccepted: 0,
  newPracticeAccepted: 0, fieldCalibrationAcceptanceExercised: false, launchAcceptanceExercised: false,
  privateArtifactNotForPublication: true, performancePass: false, stages: [] };
const stage = (name, value) => { const s = { name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
  report.stages.push(s); save('stage-' + report.stages.length + '.json', s); if (value !== undefined) save('checkpoint-' + report.stages.length + '-' + name + '.lossless.json', value);
  console.log(JSON.stringify(s)); };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let db, bundle, catalogBefore, stamps;
try {
  report.originalBefore = await databaseFiles(original); report.harnessPins = {};
  for (const path of [earlyReceiptPath, earlyStagesPath, 'tools/verification/check-native-spin-neutral-prelaunch-v197.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) {
    report.harnessPins[path] = await fileState(resolve(root, path));
  }
  if (report.harnessPins[earlyReceiptPath].exists) {
    const receipt = JSON.parse(readFileSync(earlyReceiptPath, 'utf8')); assert.equal(receipt.result, 'FAIL'); report.originalReceiptElapsedMs = receipt.elapsed_ms;
  }
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-spin-neutral-prelaunch-v197.ts', outputPath: resolve(out, 'prelaunch-bundle.mjs') });
  save('start-manifest.json', { runtime: { execution: report.execution, nodeVersion: process.version, originalExecutionSourceEndPin: 'UNKNOWN' },
    bundle, harnessPins: report.harnessPins, originalBefore: report.originalBefore, locatorInputs,
    constraints: ['NO_WRITER_OPEN', 'NO_NEW_SOURCE_OR_PHYSICAL_ACCEPTANCE', 'RIGHT_NOT_AUTHENTICATED_WITH_RAW_ARCHIVE', 'GOLD_SELECTOR_NOT_REEXECUTED'] });
  const api = await import(pathToFileURL(bundle.bundlePath).href);
  db = new DatabaseSync(original, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v197');
  db.setAuthorizer((code, table) => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH
    || code === constants.SQLITE_DELETE && table === 'pa_physical_v1_rights' ? constants.SQLITE_DENY : constants.SQLITE_OK);
  stamps = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get().query_only,
    totalChanges: db.prepare('SELECT total_changes() n').get().n, mainSchema: db.prepare('PRAGMA main.schema_version').get().schema_version,
    tempSchema: db.prepare('PRAGMA temp.schema_version').get().schema_version });
  report.callerBefore = stamps(); catalogBefore = db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(); save('catalog-before.json', catalogBefore);
  const frontier = api.readNativeSpinNeutralPrelaunchV197(db, stage); save('frontier.lossless.json', frontier); report.frontier = frontier;
  for (const ref of frontier.visitedRowLocators) {
    assert(/^[a-z0-9_]+$/.test(ref.owner)); const q = db.prepare(`SELECT rowid native_rowid FROM main.${ref.owner} WHERE source_id=?`); q.setReadBigInts(true);
    assert.equal(String(q.get(ref.sourceId)?.native_rowid), ref.rowid);
  }
  report.visitedRowidsUnchanged = true; report.visitedRowCount = frontier.visitedRowLocators.length;
  assert(frontier.currentLifecycleProven && frontier.nextPitchBasisProven && frontier.twoIndependentNativeQualificationRefsProven);
  report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (db) try {
    if (stamps && catalogBefore) {
      report.callerAfter = stamps(); assert.deepEqual(report.callerAfter, report.callerBefore);
      assert.deepEqual(db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(), catalogBefore); report.catalogUnchanged = true;
      assert.throws(() => db.prepare('DELETE FROM main.pa_physical_v1_rights WHERE 0'), /not authorized/); report.authorizerPreserved = true;
      db.exec('ROLLBACK TO caller_v197; RELEASE caller_v197; ROLLBACK');
    } else if (db.isTransaction) db.exec('ROLLBACK');
    db.setAuthorizer(null); db.close(); db = null;
  } catch (error) { report.cleanupError = String(error.stack ?? error); report.pass = false; process.exitCode = 1;
    try { if (db?.isTransaction) db.exec('ROLLBACK'); db?.setAuthorizer(null); db?.close(); } catch { /* Original cleanup error is retained above. */ } }
  try {
    report.originalAfter = await databaseFiles(original); assert.deepEqual(dataPin(report.originalAfter), dataPin(report.originalBefore)); report.allDataFilesUnchanged = true;
    report.shmObservation = { before: report.originalBefore['-shm'], after: report.originalAfter['-shm'] };
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
  nextPitchBasisProven: report.frontier?.nextPitchBasisProven, preparedRight: report.frontier?.preparedRight.status,
  allDataFilesUnchanged: report.allDataFilesUnchanged, catalogUnchanged: report.catalogUnchanged,
  sourceAndBundleEndPinProven: report.sourceAndBundleEndPinProven, error: report.error ?? report.cleanupError ?? report.pinError ?? null }));
