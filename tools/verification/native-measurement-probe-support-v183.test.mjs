import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, rmdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { after, test } from 'node:test';
import {
  assertNativeProbePins, compilePinnedNativeEntry, createPinnedNativeCopy, databaseFiles, fileState,
} from './native-measurement-probe-support-v183.mjs';

// Byte fixtures exercise filesystem pins only; no SQLite database or Native API is opened.
const root = process.cwd();
const fixtureBase = await mkdtemp(resolve(root, '.native-probe-support-v183-'));
const sha = value => createHash('sha256').update(value).digest('hex');
after(() => rmdir(fixtureBase));
const fixture = async t => {
  const directory = await mkdtemp(resolve(fixtureBase, 'case-'));
  t.after(async () => {
    const target = resolve(directory), insideBase = relative(resolve(fixtureBase), target);
    assert(insideBase && !insideBase.startsWith('..') && !isAbsolute(insideBase), 'cleanup must stay inside the created fixture base');
    await rm(target, { recursive: true });
  });
  const originalPath = resolve(directory, 'original.sqlite'), outputPath = resolve(directory, 'copy.sqlite');
  const main = Buffer.from('synthetic database file bytes');
  await writeFile(originalPath, main);
  return { directory, originalPath, outputPath, expectedMainSha256: sha(main) };
};
const bundleFixture = async directory => {
  const source = resolve(directory, 'source');
  await mkdir(source);
  const entryPath = resolve(source, 'entry.ts'), dependency = resolve(source, 'value.ts');
  await writeFile(entryPath, "import { value } from './value.ts'; export const result: number = value;\n");
  await writeFile(dependency, 'export const value: number = 7;\n');
  const bundle = await compilePinnedNativeEntry({ root: directory, entryPath, outputPath: resolve(directory, 'bundle.mjs') });
  return { bundle, dependency };
};

test('file states distinguish absent and empty files by byte length and SHA', async t => {
  const paths = await fixture(t), missing = resolve(paths.directory, 'missing');
  assert.deepEqual(await fileState(missing), { exists: false });
  await writeFile(missing, '');
  assert.deepEqual(await fileState(missing), { exists: true, bytes: 0, sha256: sha('') });
  assert.deepEqual(Object.keys(await databaseFiles(paths.originalPath)), ['main', '-wal', '-shm', '-journal']);
});

for (const wal of ['absent', 'empty']) test(`copy admits ${wal} WAL and preserves every original sidecar`, async t => {
  const paths = await fixture(t);
  if (wal === 'empty') await writeFile(paths.originalPath + '-wal', '');
  await writeFile(paths.originalPath + '-shm', 'synthetic shared memory');
  const before = await databaseFiles(paths.originalPath), copy = await createPinnedNativeCopy(paths);
  assert.deepEqual(copy.originalDatabaseBefore, before);
  assert.deepEqual(copy.originalDatabaseAfterCopy, before);
  assert.deepEqual(await databaseFiles(paths.originalPath), before);
  assert.deepEqual(copy.copyDatabaseBefore.main, before.main);
  assert.equal(copy.copyAdmission, wal === 'empty' ? 'EMPTY_WAL_NO_FRAMES' : 'WAL_ABSENT');
  assert.equal(copy.copyDatabaseBefore['-wal'].exists, false);
  await assert.rejects(createPinnedNativeCopy(paths), /EEXIST/);
  assert.deepEqual(await readFile(paths.outputPath), await readFile(paths.originalPath));
});

for (const [suffix, bytes] of [['-wal', 'frame'], ['-journal', 'rollback'], ['-journal', '']]) {
  test(`copy rejects ${suffix} with ${bytes.length} bytes before creating output`, async t => {
    const paths = await fixture(t);
    await writeFile(paths.originalPath + suffix, bytes);
    await assert.rejects(createPinnedNativeCopy(paths), suffix === '-wal' ? /nonempty original WAL/ : /original journal/);
    assert.deepEqual(await fileState(paths.outputPath), { exists: false });
  });
}

test('copy rejects a stale expected main SHA before creating output', async t => {
  const paths = await fixture(t);
  await assert.rejects(createPinnedNativeCopy({ ...paths, expectedMainSha256: '0'.repeat(64) }), /original main SHA/);
  assert.deepEqual(await fileState(paths.outputPath), { exists: false });
});

test('bundle records all metafile Source load pins and detects a transitive Source change', async t => {
  const paths = await fixture(t), copy = await createPinnedNativeCopy(paths);
  const { bundle, dependency } = await bundleFixture(paths.directory);
  assert.equal(bundle.nodeVersion, process.version);
  assert.equal(typeof bundle.esbuildVersion, 'string');
  assert.equal(bundle.inputCount, 2);
  assert.equal(Object.keys(bundle.sourcePins).length, Object.keys(bundle.metafile.inputs).length);
  assert.equal(bundle.sha256, sha(await readFile(bundle.bundlePath)));
  const ended = await assertNativeProbePins({ copy, bundle });
  assert.equal(ended.originalDatabaseUnchanged, true);
  assert.equal(ended.copyDatabaseUnchanged, true);
  assert.equal(ended.bundleUnchanged, true);
  for (const pin of Object.values(ended.sourcePins)) assert.equal(pin.endSha256, pin.sha256);
  await writeFile(dependency, 'export const value: number = 8;\n');
  await assert.rejects(assertNativeProbePins({ copy, bundle }), /Source changed during Native probe/);
});

for (const mutation of ['original main', 'original sidecar', 'copy main', 'bundle']) {
  test(`end pins detect changed ${mutation}`, async t => {
    const paths = await fixture(t), copy = await createPinnedNativeCopy(paths);
    const { bundle } = await bundleFixture(paths.directory);
    const target = mutation === 'original main' ? paths.originalPath
      : mutation === 'original sidecar' ? paths.originalPath + '-shm'
        : mutation === 'copy main' ? paths.outputPath : bundle.bundlePath;
    await writeFile(target, 'changed bytes');
    await assert.rejects(assertNativeProbePins({ copy, bundle }), /changed/);
  });
}
