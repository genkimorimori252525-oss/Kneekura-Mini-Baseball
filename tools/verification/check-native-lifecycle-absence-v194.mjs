import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { stringifyDebugRecord, firstDebugDifference } from './live-debug-record.mjs';

const root = process.cwd(), [manifestArg, databaseArg, outputArg] = process.argv.slice(2),
  out = resolve(outputArg ?? ''), rel = relative(root, out), changedSource = 'src/host/world/SamePlateAppearanceLifecycleFromSqlite.ts';
assert(manifestArg && databaseArg && outputArg && rel && !rel.startsWith('..') && !isAbsolute(rel), 'baseline manifest, existing database and new workspace output required');
const absenceTimingOnly = process.argv[5] === '--absence-timing-only';
assert(process.argv.length === (absenceTimingOnly ? 6 : 5), 'unexpected arguments');
const baseline = JSON.parse(await readFile(resolve(manifestArg), 'utf8')), databasePath = resolve(databaseArg);
assert.equal(baseline.boundary, 'COMPILED_BASELINE_NOT_YET_EXECUTED');
await mkdir(out, { recursive: false });
const save = (name, value) => writeFile(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' }),
  dataPins = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, boundary: 'READ_ONLY_NATIVE_LIFECYCLE_METADATA_AND_ACCEPTED_CALIBRATIONS',
  absenceTimingOnly, nodeVersion: process.version,
  physicalOperationCreated: false, oldNativeScenarioReplayed: false, privateArtifactNotForPublication: true, measurements: [] };
let candidate, digestBundle, db;
try {
  report.databaseBefore = await databaseFiles(databasePath); assert(report.databaseBefore.main.exists);
  report.harnessPins = {};
  for (const path of [resolve(manifestArg), 'tools/verification/check-native-lifecycle-absence-v194.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) report.harnessPins[path] = await fileState(resolve(root, path));
  assert.deepEqual(await fileState(baseline.bundlePath), { exists: true, bytes: baseline.bytes, sha256: baseline.sha256 });
  candidate = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-lifecycle-absence-case-v194.ts', outputPath: resolve(out, 'candidate.mjs') });
  digestBundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/NativeSpinNeutralV193-sql.ts', outputPath: resolve(out, 'digest.mjs') });
  assert.deepEqual(Object.keys(candidate.sourcePins).sort(), Object.keys(baseline.sourcePins).sort());
  report.changedSources = Object.keys(candidate.sourcePins).filter(path => candidate.sourcePins[path].sha256 !== baseline.sourcePins[path].sha256);
  assert.deepEqual(report.changedSources, [changedSource], 'only the intended lifecycle source may differ');
  for (const [path, pin] of Object.entries(baseline.sourcePins)) if (path !== changedSource)
    assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
  await save('start-manifest.json', { baseline, candidate, digestBundle, harnessPins: report.harnessPins, databaseBefore: report.databaseBefore,
    execution: 'ACTUAL_PINNED_NODE_BASELINE_AND_CANDIDATE_BUNDLES', physicalOperationCreated: false });
  const variants = { baseline: await import(pathToFileURL(baseline.bundlePath).href), candidate: await import(pathToFileURL(candidate.bundlePath).href) },
    digest = (await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  db = new DatabaseSync(databasePath, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN');
  const initialRows = digest(db); await save('initial-rows.json', initialRows);
  const existingIds = db.prepare("SELECT source_id FROM main.pa_lifecycle_v1_execution_calibrations WHERE view_source_id='physical-fixture:cut10:view' ORDER BY rowid").all().map(row => String(row.source_id));
  assert.equal(existingIds.length, 32, 'retained native cut10 calibration cohort required'); db.exec('ROLLBACK'); db.close(); db = null;
  const absentIds = Array.from({ length: 32 }, (_, i) => 'v194-readonly-absence:' + i), cases = [
    { name: 'absent-one', ids: absentIds.slice(0, 1), absent: true }, { name: 'absent-32', ids: absentIds, absent: true },
    ...(absenceTimingOnly ? [] : [{ name: 'accepted-calibration-32', ids: existingIds, absent: false }])];
  const results = {};
  for (const [variant, core] of Object.entries(variants)) {
    results[variant] = {};
    for (const input of cases) {
      db = new DatabaseSync(databasePath, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN');
      const state = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get().query_only,
        changes: db.prepare('SELECT total_changes() n').get().n, mainSchema: db.prepare('PRAGMA main.schema_version').get().schema_version,
        tempSchema: db.prepare('PRAGMA temp.schema_version').get().schema_version });
      const before = state(), reads = new Map();
      db.setAuthorizer((code, table, column, schema) => {
        if (code === constants.SQLITE_READ && schema === 'main' && /^(pa_|batting_)/.test(table ?? '') && ['source_json', 'snapshot_json'].includes(column)) {
          const key = table + '.' + column; reads.set(key, (reads.get(key) ?? 0) + 1);
        }
        return constants.SQLITE_OK;
      });
      const started = process.hrtime.bigint(), value = core.readSet(db, 'calibration', input.ids), elapsedNs = process.hrtime.bigint() - started;
      const observedReads = Object.fromEntries(reads);
      assert.deepEqual(state(), before); assert.equal(before.transaction, true); assert.equal(before.queryOnly, 1);
      assert.deepEqual(digest(db), initialRows);
      if (input.absent) assert.deepEqual(value, input.ids.map(() => null));
      else { assert.equal(value.length, 32); assert(value.every(record => record?.kind === 'same_pa_lifecycle_calibration'));
        assert.deepEqual(value.map(record => record.source.sourceId), input.ids); }
      results[variant][input.name] = value; await save(variant + '-' + input.name + '.json', value);
      report.measurements.push({ variant, name: input.name, inputCount: input.ids.length, elapsedNanoseconds: String(elapsedNs),
        elapsedMilliseconds: Number(elapsedNs) / 1e6, nativeReadPreparationCounts: observedReads, callerAndRowsUnchanged: true });
      db.exec('ROLLBACK'); db.close(); db = null;
      console.log(JSON.stringify({ variant, name: input.name, elapsedMilliseconds: Number(elapsedNs) / 1e6, rowsUnchanged: true }));
    }
  }
  for (const input of cases) assert.equal(firstDebugDifference(results.baseline[input.name], results.candidate[input.name]), null, 'exact old/new result: ' + input.name);
  const duration = (variant, name) => report.measurements.find(row => row.variant === variant && row.name === name).elapsedMilliseconds;
  report.absent32Ratio = duration('candidate', 'absent-32') / duration('baseline', 'absent-32');
  report.resultsExact = true; report.oldRowsRowidAndCatalogUnchanged = true; report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (db) try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { report.cleanupError = String(error); report.pass = false; process.exitCode = 1; }
  try {
    report.databaseAfter = await databaseFiles(databasePath); assert.deepEqual(dataPins(report.databaseAfter), dataPins(report.databaseBefore));
    report.databaseDataUnchanged = true; report.shmObservation = { before: report.databaseBefore['-shm'], after: report.databaseAfter['-shm'] };
    for (const bundle of [candidate, digestBundle].filter(Boolean)) {
      assert.deepEqual(await fileState(bundle.bundlePath), { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 });
      for (const [path, pin] of Object.entries(bundle.sourcePins)) assert.deepEqual(await fileState(resolve(root, path)), { exists: true, bytes: pin.bytes, sha256: pin.sha256 });
    }
    assert.deepEqual(await fileState(baseline.bundlePath), { exists: true, bytes: baseline.bytes, sha256: baseline.sha256 });
    for (const [path, pin] of Object.entries(report.harnessPins ?? {})) assert.deepEqual(await fileState(resolve(root, path)), pin);
    report.bundleAndCurrentSourceEndPinsExact = true;
  } catch (error) { report.pinError = String(error.stack ?? error); report.pass = false; process.exitCode = 1; }
  await save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, resultsExact: report.resultsExact, absent32Ratio: report.absent32Ratio,
  changedSources: report.changedSources, sourceInputCount: candidate?.inputCount, error: report.error ?? report.pinError ?? null }));
