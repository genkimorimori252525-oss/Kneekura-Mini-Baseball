import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants } from 'node:sqlite';
import { build, version as esbuildVersion } from 'esbuild';

const root = process.cwd(), [locatorArg, outputArg] = process.argv.slice(2);
assert(locatorArg && outputArg, 'existing private locator report and new private output directory required');
const locatorPath = resolve(locatorArg), output = resolve(outputArg), outputRelative = relative(root, output);
assert(outputRelative && !outputRelative.startsWith('..') && !isAbsolute(outputRelative), 'output must remain inside this workspace');
const sha = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFile(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const lossless = value => {
  if (typeof value === 'number' && Object.is(value, -0)) return { $number: '-0' };
  if (typeof value === 'number' && !Number.isFinite(value)) return { $number: String(value) };
  if (Array.isArray(value)) return value.map(lossless);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, lossless(item)]));
  return value;
};
const differences = (expected, actual, path = '$', found = []) => {
  if (Object.is(expected, actual)) return found;
  if (expected && actual && typeof expected === 'object' && typeof actual === 'object') {
    for (const key of new Set([...Object.keys(expected), ...Object.keys(actual)])) differences(expected[key], actual[key], path + '.' + key, found);
  } else found.push({ path, expected: lossless(expected), actual: lossless(actual),
    negativeZeroOnly: typeof expected === 'number' && typeof actual === 'number' && expected === 0 && actual === 0 });
  return found;
};
const deeplyFrozen = value => !value || typeof value !== 'object'
  || Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
const deeplyDetached = (first, second) => {
  if (!first || typeof first !== 'object') return;
  assert.notEqual(first, second, 'a reread must not expose a previous object reference');
  for (const key of Object.keys(first)) deeplyDetached(first[key], second[key]);
};
const fileState = async path => {
  try { const metadata = await stat(path); return { exists: true, bytes: metadata.size, sha256: sha(await readFile(path)) }; }
  catch (error) { if (error.code === 'ENOENT') return { exists: false }; throw error; }
};
const databaseFiles = async path => Object.fromEntries(await Promise.all(['', '-wal', '-shm', '-journal']
  .map(async suffix => [suffix || 'main', await fileState(path + suffix)])));
const queryState = db => ({ transaction: db.isTransaction,
  queryOnly: db.prepare('PRAGMA query_only').get().query_only,
  totalChanges: db.prepare('SELECT total_changes() n').get().n,
  mainSchema: db.prepare('PRAGMA main.schema_version').get().schema_version,
  tempSchema: db.prepare('PRAGMA temp.schema_version').get().schema_version });

await mkdir(output, { recursive: false });
const report = { pass: false, privateArtifactNotForPublication: true,
  authority: 'CURRENT_NATIVE_OWNER_ON_PRIVATE_COPY_OF_EXPLICIT_SYNTHETIC_FIXTURE',
  calendarResolved: false, traitTimeCreated: false, recognitionModelCreated: false,
  actualSuccessfulApiCalls: 0, forgedReferenceApiCalls: 0, sourcePins: {}, comparisons: {} };
let db, originalPath, copyPath, failure;
const scriptPath = resolve('tools/verification/check-native-measured-contact-v182.mjs');
const scriptStartHash = sha(await readFile(scriptPath));
try {
  const locatorBytes = await readFile(locatorPath), locator = JSON.parse(locatorBytes);
  assert.equal(locator.pass, true); assert.equal(locator.nativeOwnerReauthentication, false);
  assert.equal(locator.authority, 'SAVED_ROW_BYTES_ONLY_NOT_CURRENT_NATIVE_OWNER_AUTHENTICATION');
  originalPath = locator.databasePath;
  report.locatorReport = { path: relative(root, locatorPath), sha256: sha(locatorBytes) };
  report.originalDatabaseBefore = await databaseFiles(originalPath);
  const originalWal = report.originalDatabaseBefore['-wal'];
  assert(!originalWal.exists || originalWal.bytes === 0 && originalWal.sha256 === sha(Buffer.alloc(0)),
    'nonempty original WAL exists; copying an inconsistent main file is forbidden');
  report.copyAdmission = originalWal.exists ? 'EMPTY_WAL_NO_FRAMES' : 'WAL_ABSENT';
  assert.equal(report.originalDatabaseBefore['-journal'].exists, false, 'original journal exists; copying an uncertain main file is forbidden');
  assert.equal(report.originalDatabaseBefore.main.sha256, locator.databaseMainSha256);
  copyPath = resolve(output, 'private-native-copy.sqlite');
  await copyFile(originalPath, copyPath, fsConstants.COPYFILE_EXCL);
  report.originalDatabaseAfterCopy = await databaseFiles(originalPath);
  assert.deepEqual(report.originalDatabaseAfterCopy, report.originalDatabaseBefore);
  report.copyDatabaseBefore = await databaseFiles(copyPath);
  assert.deepEqual(report.copyDatabaseBefore.main, report.originalDatabaseBefore.main);

  const entry = resolve('src/host/world/NativeMeasuredBattingContactV182.ts');
  const loaded = new Map();
  const bundled = await build({ absWorkingDir: root, entryPoints: [entry], bundle: true, write: false,
    metafile: true, format: 'esm', platform: 'node', target: 'node26', packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'pin-every-loaded-source-v182', setup(builder) {
      builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async ({ path }) => {
        const bytes = await readFile(path), extension = extname(path);
        loaded.set(resolve(path), { bytes: bytes.length, sha256: sha(bytes) });
        return { contents: bytes.toString('utf8'), loader: extension === '.ts' ? 'ts' : extension === '.tsx' ? 'tsx' : 'js', resolveDir: dirname(path) };
      });
    } }] });
  assert.equal(bundled.outputFiles.length, 1);
  for (const input of Object.keys(bundled.metafile.inputs)) {
    const inputPath = resolve(root, input), pin = loaded.get(inputPath);
    assert(pin, 'every metafile Source must have a load-time hash');
    assert.equal(sha(await readFile(inputPath)), pin.sha256, 'Source changed during bundle construction');
    report.sourcePins[relative(root, inputPath).replaceAll('\\', '/')] = { ...pin, endSha256: null };
  }
  const bundleBytes = bundled.outputFiles[0].contents, bundlePath = resolve(output, 'native-contact-owner-bundle.mjs');
  await writeFile(bundlePath, bundleBytes, { flag: 'wx' });
  report.bundle = { sha256: sha(bundleBytes), bytes: bundleBytes.length, esbuildVersion, inputCount: Object.keys(report.sourcePins).length };
  await save('bundle-metafile.json', bundled.metafile);
  const { readNativeMeasuredBattingContactV182FromSqlite: read } = await import(pathToFileURL(bundlePath).href);
  assert.equal(typeof read, 'function');

  db = new DatabaseSync(copyPath);
  const records = {};
  for (const item of locator.inspected) {
    const ref = item.reference;
    assert(['pa_physical_v1_resolutions', 'pa_physical_v1_launches', 'pa_physical_v1_action_plans'].includes(ref.owner));
    const row = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM main.' + ref.owner + ' WHERE source_id=?').get(ref.sourceId);
    assert(row); assert.equal(row.source_hash, ref.sourceHash); assert.equal(row.snapshot_hash, ref.snapshotHash);
    assert.equal(sha(row.source_json), ref.sourceHash); assert.equal(sha(row.snapshot_json), ref.snapshotHash);
    records[ref.owner] = { reference: ref, sourceJson: row.source_json, snapshotJson: row.snapshot_json };
  }
  await save('raw-selected-records.json', records);
  const resolution = JSON.parse(records.pa_physical_v1_resolutions.snapshotJson), launch = JSON.parse(records.pa_physical_v1_launches.snapshotJson),
    action = JSON.parse(records.pa_physical_v1_action_plans.snapshotJson);
  const contactEvents = resolution.timeline.events.slice(launch.timeline.events.length).filter(event => event.kind === 'BatBallContact');
  assert.equal(contactEvents.length, 1);
  const ref = structuredClone(locator.oneOriginalContact.resolutionReference), refBefore = structuredClone(ref);
  let deniedDeletes = 0;
  db.setAuthorizer(code => {
    if (code === constants.SQLITE_DELETE) { deniedDeletes++; return constants.SQLITE_DENY; }
    return code === constants.SQLITE_INSERT || code === constants.SQLITE_UPDATE
      || code === constants.SQLITE_ATTACH || code === constants.SQLITE_DETACH ? constants.SQLITE_DENY : constants.SQLITE_OK;
  });
  db.exec('BEGIN'); db.exec('SAVEPOINT caller_owned_v182');
  const before = queryState(db), first = read(db, ref); report.actualSuccessfulApiCalls++;
  assert(first); assert.deepEqual(queryState(db), before);
  assert(deeplyFrozen(first)); assert.notEqual(first.resolutionReference, ref);
  const deniedAfterFirst = deniedDeletes;
  assert.throws(() => db.prepare('DELETE FROM main.pa_physical_v1_resolutions WHERE 0'), /authorized/i);
  assert(deniedDeletes > deniedAfterFirst, 'caller authorizer must remain installed');
  ref.snapshotHash = '0'.repeat(64);
  assert.deepEqual(first.resolutionReference, refBefore);
  const expected = { resolutionReference: refBefore, physicalPitchReference: records.pa_physical_v1_launches.reference,
    source: resolution.source, lineage: resolution.lineage, binding: action.actor.binding,
    contact: resolution.contact, contactEvent: contactEvents[0], resolutionEvaluationTick: resolution.evaluationTick,
    scope: { careerId: resolution.lineage.careerId, gameId: resolution.lineage.gameId, playId: resolution.lineage.playId,
      physicalPitchSourceId: resolution.physicalPitchSourceId, pitchOrdinal: resolution.pitchOrdinal } };
  const actual = { resolutionReference: first.resolutionReference, physicalPitchReference: first.physicalPitchReference,
    source: first.source, lineage: first.lineage, binding: first.actor.binding, contact: first.contact,
    contactEvent: first.contactEvent, resolutionEvaluationTick: first.resolutionEvaluationTick, scope: first.scope };
  report.comparisons.rawNativeToActualDifferences = differences(expected, actual);
  assert(report.comparisons.rawNativeToActualDifferences.every(item => item.negativeZeroOnly), 'Native vectors, binding or Source/event identity differ');
  assert.equal(Reflect.set(first.contact.exitVelocity, 'x', 12345), false);
  assert.equal(Reflect.set(first.actor.binding, 'gameDay', 12345), false);
  db.exec('PRAGMA query_only=1');
  const secondBefore = queryState(db), second = read(db, refBefore); report.actualSuccessfulApiCalls++;
  assert(second); assert.deepEqual(queryState(db), secondBefore);
  assert(deeplyFrozen(second)); deeplyDetached(first, second);
  assert.deepEqual(lossless(second), lossless(first), 'two actual API reads must be losslessly identical, including negative zero');
  const deniedAfterSecond = deniedDeletes;
  assert.throws(() => db.prepare('DELETE FROM main.pa_physical_v1_resolutions WHERE 0'), /authorized/i);
  assert(deniedDeletes > deniedAfterSecond);
  const badBefore = queryState(db);
  report.forgedReferenceApiCalls++;
  assert.throws(() => read(db, ref), /same-PA physical original input, cut or row differs/);
  assert.deepEqual(queryState(db), badBefore);
  db.exec('RELEASE caller_owned_v182');
  assert.equal(db.isTransaction, true); db.exec('ROLLBACK');
  assert.equal(db.isTransaction, false); assert.equal(queryState(db).totalChanges, before.totalChanges);
  db.setAuthorizer(null); db.close(); db = null;
  await save('actual-first.lossless.json', lossless(first));
  await save('actual-second.lossless.json', lossless(second));
  await save('raw-native-comparison.lossless.json', { expected: lossless(expected), actual: lossless(actual), differences: report.comparisons.rawNativeToActualDifferences });
  report.comparisons.losslessReplayEqual = true; report.comparisons.deeplyFrozen = true;
  report.comparisons.deeplyDetachedBetweenReads = true; report.comparisons.inputReferenceDetached = true;
  report.comparisons.callerTransactionQueryOnlyAuthorizerPreserved = true;
  report.comparisons.forgedReferenceRejected = true; report.comparisons.totalChangesUnchanged = true;
  report.nativeOwnerReauthentication = true;
  report.pass = true;
} catch (error) {
  failure = error;
  report.error = { name: error.name, message: error.message, stack: error.stack };
} finally {
  if (db) { try { if (db.isTransaction) db.exec('ROLLBACK'); db.close(); } catch (error) { report.cleanupError = error.message; report.pass = false; } }
  try {
    for (const [path, pin] of Object.entries(report.sourcePins)) {
      pin.endSha256 = sha(await readFile(resolve(root, path)));
      assert.equal(pin.endSha256, pin.sha256, 'Source changed during Native probe: ' + path);
    }
    report.harness = { sha256: scriptStartHash, endSha256: sha(await readFile(scriptPath)) };
    assert.equal(report.harness.endSha256, scriptStartHash);
    if (originalPath) {
      report.originalDatabaseAfter = await databaseFiles(originalPath);
      assert.deepEqual(report.originalDatabaseAfter, report.originalDatabaseBefore, 'original database files changed');
      report.originalDatabaseUnchanged = true;
    }
    if (copyPath) {
      report.copyDatabaseAfter = await databaseFiles(copyPath);
      assert.deepEqual(report.copyDatabaseAfter, report.copyDatabaseBefore, 'private copy database files changed after close');
      report.copyDatabaseUnchanged = true;
    }
  } catch (error) { report.finalPinError = error.message; report.pass = false; failure ??= error; }
  await save('report.json', report);
}
console.log(JSON.stringify({ pass: report.pass, actualSuccessfulApiCalls: report.actualSuccessfulApiCalls,
  forgedReferenceApiCalls: report.forgedReferenceApiCalls, nativeOwnerReauthentication: report.nativeOwnerReauthentication ?? false,
  sourceInputsPinned: Object.keys(report.sourcePins).length,
  rawNativeNumericDifferences: report.comparisons.rawNativeToActualDifferences?.length ?? null,
  originalDatabaseUnchanged: report.originalDatabaseUnchanged ?? false, copyDatabaseUnchanged: report.copyDatabaseUnchanged ?? false,
  error: failure?.message ?? report.cleanupError ?? null }));
if (!report.pass) process.exitCode = 1;
