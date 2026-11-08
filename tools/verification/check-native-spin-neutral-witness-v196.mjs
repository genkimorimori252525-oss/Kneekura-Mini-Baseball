import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, constants } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root = process.cwd(), currentPath = resolve(process.argv[2] ?? ''), declarationPath = resolve(process.argv[3] ?? ''), out = resolve(process.argv[4] ?? ''), rel = relative(root, out);
assert(process.argv.length === 5 && rel && !rel.startsWith('..') && !isAbsolute(rel), 'completed cut11 report, retained commitment checkpoint and new output required');
const completed = parseDebugRecord(readFileSync(currentPath, 'utf8')), beforeCommitment = parseDebugRecord(readFileSync(declarationPath, 'utf8'));
assert(completed.pass && completed.frontier?.currentCoverageProven);
const original = resolve(completed.copyPath), input = { viewReference: completed.frontier.viewReference, actorReference: completed.frontier.actorReference,
  resolutionReference: completed.frontier.resolutionReference, launchReference: beforeCommitment.sourceDeclaration.launchReference,
  postureReference: beforeCommitment.input.source.postureReference };
mkdirSync(out, { recursive: false });
const save = (name, value) => writeFileSync(resolve(out, name), stringifyDebugRecord(value) + '\n', { flag: 'wx' });
const dataPin = files => Object.fromEntries(['main', '-wal', '-journal'].map(key => [key, files[key]]));
const report = { pass: false, boundary: 'NATIVE_READONLY_SCOPED_WITNESS_INVENTORY_ONLY', originalPath: original,
  execution: 'PINNED_NODE_ENTRY', privateArtifactNotForPublication: true, newSourcesAuthored: 0, newWriterCalls: 0,
  newPhysicalOperationsAccepted: 0, newPracticeAccepted: 0, inventoryGlobalDataEnumerationPerformed: false,
  rowidProof: 'VISITED_ROWIDS_AND_WHOLE_DATABASE_DATAFILE_PINS', performancePass: false, stages: [] };
const stage = (name, value) => { const entry = { name, at: new Date().toISOString(), memory: process.memoryUsage(), heapLimitBytes: getHeapStatistics().heap_size_limit };
  report.stages.push(entry); save('stage-' + report.stages.length + '.json', entry); if (value !== undefined) save('checkpoint-' + report.stages.length + '-' + name + '.lossless.json', value);
  console.log(JSON.stringify(entry)); };
if (process.report) { process.report.directory = out; process.report.reportOnFatalError = true; process.report.excludeEnv = true; }
let db, bundle;
try {
  report.originalBefore = await databaseFiles(original); assert.deepEqual(dataPin(report.originalBefore), dataPin(completed.copyAfter), 'completed cut11 data changed');
  report.harnessPins = {};
  for (const path of [currentPath, declarationPath, 'tools/verification/check-native-spin-neutral-witness-v196.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs', 'tools/verification/live-debug-record.mjs']) report.harnessPins[path] = await fileState(resolve(root, path));
  bundle = await compilePinnedNativeEntry({ root, entryPath: 'tools/verification/native-spin-neutral-witness-v196.ts', outputPath: resolve(out, 'witness-bundle.mjs') });
  save('start-manifest.json', { runtime: { execution: report.execution, nodeVersion: process.version, originalSuffixSourceEndPin: 'UNKNOWN' },
    bundle, harnessPins: report.harnessPins, originalBefore: report.originalBefore, input,
    discoveryBoundary: 'CURRENT_PREFIX_AND_BOUNDED_SCOPED_CANDIDATES_ONLY_NO_GLOBAL_REGISTRY' });
  const api = await import(pathToFileURL(bundle.bundlePath).href);
  db = new DatabaseSync(original, { readOnly: true }); db.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v196');
  db.setAuthorizer((code, table) => code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH
    || code === constants.SQLITE_DELETE && table === 'pa_physical_v1_resolutions' ? constants.SQLITE_DENY : constants.SQLITE_OK);
  const stamps = () => ({ transaction: db.isTransaction, queryOnly: db.prepare('PRAGMA query_only').get().query_only,
    totalChanges: db.prepare('SELECT total_changes() n').get().n, mainSchema: db.prepare('PRAGMA main.schema_version').get().schema_version,
    tempSchema: db.prepare('PRAGMA temp.schema_version').get().schema_version });
  const catalog = () => db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all();
  report.callerBefore = stamps(); const catalogBefore = catalog(); save('catalog-before.json', catalogBefore);
  const inventory = api.readNativeSpinNeutralWitnessInventoryV196(db, input, stage);
  save('inventory.lossless.json', inventory); report.scope = inventory.scope;
  const rowids = inventory.visitedRowLocators.map(ref => {
    assert(/^[a-z0-9_]+$/.test(ref.owner)); const query = db.prepare(`SELECT rowid native_rowid FROM main.${ref.owner} WHERE source_id=?`); query.setReadBigInts(true);
    const row = query.get(ref.sourceId); assert(row); return { owner: ref.owner, sourceId: ref.sourceId, rowid: String(row.native_rowid) };
  });
  assert.deepEqual(rowids, inventory.visitedRowLocators); report.visitedRowidsUnchanged = true; report.visitedRowCount = rowids.length;
  assert.deepEqual(stamps(), report.callerBefore); assert.deepEqual(catalog(), catalogBefore); report.catalogUnchanged = true; report.callerAfter = stamps();
  assert.throws(() => db.prepare('DELETE FROM main.pa_physical_v1_resolutions WHERE 0'), /not authorized/); report.authorizerPreserved = true;
  db.exec('ROLLBACK TO caller_v196; RELEASE caller_v196; ROLLBACK'); db.setAuthorizer(null); db.close(); db = null;
  report.availability = {
    fieldGeometry: inventory.field.fieldGeometry.status, fieldModel: inventory.field.fieldModel.status, responseModel: inventory.field.responseModel.status,
    freshCalibration: inventory.field.freshCalibration.status, fieldRoots: inventory.field.fieldRoots.status,
    participantBodies: inventory.field.participantBodies.status, bodyCount: inventory.field.participantBodies.count,
    fieldRuleEvidence: inventory.field.fieldRuleEvidence.kind, plateAssignment: inventory.official.plateAssignment.status,
    officialPerson: inventory.official.officialPerson.status, livePolicy: inventory.official.livePolicy.status,
    liveBallStatus: inventory.official.liveHistory.status, liveBallStatusReason: inventory.official.liveHistory.statusReason,
    samePaVenueCoverage: inventory.venue.samePaLegalCoverage.kind ?? inventory.venue.samePaLegalCoverage.status,
    standaloneVenuePolicy: inventory.venue.standaloneVenuePolicies.status,
  };
  report.pass = true;
} catch (error) { report.error = String(error.stack ?? error); process.exitCode = 1; }
finally {
  if (db) try { if (db.isTransaction) db.exec('ROLLBACK'); db.setAuthorizer(null); db.close(); }
    catch (error) { report.cleanupError = String(error); report.pass = false; process.exitCode = 1; }
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
console.log(JSON.stringify({ pass: report.pass, availability: report.availability, allDataFilesUnchanged: report.allDataFilesUnchanged,
  visitedRowidsUnchanged: report.visitedRowidsUnchanged, catalogUnchanged: report.catalogUnchanged,
  sourceAndBundleEndPinProven: report.sourceAndBundleEndPinProven, error: report.error ?? report.pinError ?? null }));
