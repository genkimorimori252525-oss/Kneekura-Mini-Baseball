import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { build, version as esbuildVersion } from 'esbuild';

// Filesystem/bundle evidence only. These helpers neither open SQLite nor confer Native authority.
const sha = value => createHash('sha256').update(value).digest('hex');

export const fileState = async path => {
  try {
    const bytes = await readFile(path);
    return { exists: true, bytes: bytes.length, sha256: sha(bytes) };
  } catch (error) {
    if (error.code === 'ENOENT') return { exists: false };
    throw error;
  }
};

export const databaseFiles = async path => Object.fromEntries(await Promise.all(
  ['', '-wal', '-shm', '-journal'].map(async suffix => [suffix || 'main', await fileState(path + suffix)]),
));

export const createPinnedNativeCopy = async ({ originalPath, outputPath, expectedMainSha256 }) => {
  originalPath = resolve(originalPath);
  const copyPath = resolve(outputPath), originalDatabaseBefore = await databaseFiles(originalPath);
  const originalWal = originalDatabaseBefore['-wal'];
  assert(!originalWal.exists || originalWal.bytes === 0 && originalWal.sha256 === sha(Buffer.alloc(0)),
    'nonempty original WAL exists; copying an inconsistent main file is forbidden');
  assert.equal(originalDatabaseBefore['-journal'].exists, false,
    'original journal exists; copying an uncertain main file is forbidden');
  assert.equal(originalDatabaseBefore.main.exists, true, 'original main file is absent');
  assert.equal(originalDatabaseBefore.main.sha256, expectedMainSha256, 'original main SHA differs from the expected pin');
  await copyFile(originalPath, copyPath, fsConstants.COPYFILE_EXCL);
  const originalDatabaseAfterCopy = await databaseFiles(originalPath);
  assert.deepEqual(originalDatabaseAfterCopy, originalDatabaseBefore, 'original database files changed during copy');
  const copyDatabaseBefore = await databaseFiles(copyPath);
  assert.deepEqual(copyDatabaseBefore.main, originalDatabaseBefore.main, 'private copy main differs from original');
  return { originalPath, copyPath, originalDatabaseBefore, originalDatabaseAfterCopy, copyDatabaseBefore,
    copyAdmission: originalWal.exists ? 'EMPTY_WAL_NO_FRAMES' : 'WAL_ABSENT' };
};

export const compilePinnedNativeEntry = async ({ root, entryPath, outputPath }) => {
  root = resolve(root);
  entryPath = resolve(root, entryPath);
  const bundlePath = resolve(root, outputPath), loaded = new Map(), sourcePins = {};
  const bundled = await build({ absWorkingDir: root, entryPoints: [entryPath], bundle: true, write: false,
    metafile: true, format: 'esm', platform: 'node', target: 'node26', packages: 'external', logLevel: 'silent',
    plugins: [{ name: 'pin-every-loaded-source-v183', setup(builder) {
      builder.onLoad({ filter: /.*/, namespace: 'file' }, async ({ path }) => {
        const bytes = await readFile(path);
        loaded.set(resolve(path), { bytes: bytes.length, sha256: sha(bytes) });
        return { contents: bytes, loader: 'default', resolveDir: dirname(path) };
      });
    } }] });
  assert.equal(bundled.outputFiles.length, 1);
  for (const input of Object.keys(bundled.metafile.inputs)) {
    const inputPath = resolve(root, input), pin = loaded.get(inputPath);
    assert(pin, 'every metafile Source must have a load-time hash');
    assert.deepEqual(await fileState(inputPath), { exists: true, ...pin }, 'Source changed during bundle construction: ' + input);
    sourcePins[relative(root, inputPath).replaceAll('\\', '/')] = { ...pin, endSha256: null };
  }
  const bytes = bundled.outputFiles[0].contents;
  await writeFile(bundlePath, bytes, { flag: 'wx' });
  return { root, entryPath, bundlePath, bytes: bytes.length, sha256: sha(bytes), nodeVersion: process.version,
    esbuildVersion, inputCount: Object.keys(sourcePins).length, sourcePins, metafile: bundled.metafile };
};

// The caller must close its private-copy database before invoking the final pin checks.
export const assertNativeProbePins = async ({ copy, bundle }) => {
  const originalDatabaseAfter = await databaseFiles(copy.originalPath);
  const copyDatabaseAfter = await databaseFiles(copy.copyPath);
  const bundleFileAfter = await fileState(bundle.bundlePath), sourcePins = {};
  assert.deepEqual(originalDatabaseAfter, copy.originalDatabaseBefore, 'original database files changed');
  assert.deepEqual(copyDatabaseAfter, copy.copyDatabaseBefore, 'private copy database files changed after close');
  assert.deepEqual(bundleFileAfter, { exists: true, bytes: bundle.bytes, sha256: bundle.sha256 }, 'bundle file changed');
  for (const [path, pin] of Object.entries(bundle.sourcePins)) {
    const end = await fileState(resolve(bundle.root, path));
    assert.deepEqual(end, { exists: true, bytes: pin.bytes, sha256: pin.sha256 }, 'Source changed during Native probe: ' + path);
    sourcePins[path] = { ...pin, endSha256: end.sha256 };
  }
  return { originalDatabaseAfter, copyDatabaseAfter, bundleFileAfter, sourcePins,
    originalDatabaseUnchanged: true, copyDatabaseUnchanged: true, bundleUnchanged: true };
};
