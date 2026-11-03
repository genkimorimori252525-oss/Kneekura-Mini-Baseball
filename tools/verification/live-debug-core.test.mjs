import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { buildPinnedLiveCore, verifyPinnedLiveCore } from './live-debug-core.mjs';

const area = resolve('docs/verification/realism-debug-20261027');
const sha = value => createHash('sha256').update(value).digest('hex');
async function fixture(run) {
  await mkdir(area, { recursive: true });
  const root = await mkdtemp(resolve(area, 'build-test-'));
  const entry = resolve(root, 'src/integration/browser/index.ts');
  await mkdir(dirname(entry), { recursive: true });
  await writeFile(entry, 'export { value } from "./value";\n');
  await writeFile(resolve(dirname(entry), 'value.ts'), 'export const value: number = -0;\n');
  try { await run({ root, entry, out: resolve(root, 'candidate') }); }
  finally {
    assert(root.startsWith(area + sep) && relative(area, root).startsWith('build-test-'));
    await rm(root, { recursive: true });
  }
}

test('pins the exact inputs and executable bytes without replacing the shared dist', async () => {
  await fixture(async ({ root, out }) => {
    const previous = resolve(root, 'dist/native-match-core-browser.js');
    await mkdir(dirname(previous)); await writeFile(previous, 'previous-release');
    const manifest = await buildPinnedLiveCore({ root, out });
    assert.equal(manifest.authority, 'BUILD_PIN_ONLY_NO_NATIVE_ADMISSION');
    assert.equal(manifest.captureMode, 'EXACT_LOADED_BYTES_AND_POST_BUILD_CHECK');
    assert.equal(Object.keys(manifest.inputs).length, 2);
    assert.equal(manifest.entry.sha256, sha(await readFile(resolve(out, manifest.entry.path))));
    assert.equal(await readFile(previous, 'utf8'), 'previous-release');
    const code = await readFile(resolve(out, manifest.entry.path), 'utf8');
    assert(Object.is(new Function(code + ';return KneekuraNativeMatchCore.value;')(), -0));
    const verified = await verifyPinnedLiveCore({ root, manifestPath: resolve(out, 'manifest.json') });
    assert.equal(verified.manifest.entry.sha256, manifest.entry.sha256);
  });
});

test('refuses an existing candidate directory and never replaces its files', async () => {
  await fixture(async ({ root, out }) => {
    await mkdir(out); await writeFile(resolve(out, 'keep.txt'), 'keep');
    await assert.rejects(buildPinnedLiveCore({ root, out }), /EEXIST/);
    assert.equal(await readFile(resolve(out, 'keep.txt'), 'utf8'), 'keep');
  });
});

test('builds the maker workbench entry into its own pinned bundle', async () => {
  await fixture(async ({ root, out, entry }) => {
    await writeFile(resolve(dirname(entry), 'workbench-index.ts'), 'export const marker = "maker";\n');
    const manifest = await buildPinnedLiveCore({ root, out, target: 'workbench' });
    assert.equal(manifest.target, 'workbench'); assert.equal(manifest.entry.path, 'batting-workbench-core.js');
    const { code } = await verifyPinnedLiveCore({ root, manifestPath: resolve(out, 'manifest.json') });
    assert.equal(new Function(code + ';return KneekuraBaseballWorkbench.marker;')(), 'maker');
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify({ ...manifest, target: 'native' }));
    await assert.rejects(verifyPinnedLiveCore({ root, manifestPath: resolve(out, 'manifest.json') }), /bundle entry/);
  });
});

test('refuses candidate destinations outside the project and shared dist', async () => {
  await fixture(async ({ root }) => {
    await assert.rejects(buildPinnedLiveCore({ root, out: resolve(root, '..', 'outside') }), /new verification directory inside/);
    await assert.rejects(buildPinnedLiveCore({ root, out: resolve(root, 'dist') }), /shared dist/);
    await assert.rejects(buildPinnedLiveCore({ root, out: resolve(root, 'dist/replacement') }), /shared dist/);
  });
});

test('rejects a changed source or tampered bundle before its execution', async () => {
  await fixture(async ({ root, out, entry }) => {
    const manifest = await buildPinnedLiveCore({ root, out });
    const manifestPath = resolve(out, 'manifest.json'), original = await readFile(entry);
    await writeFile(entry, 'export const value = 2;');
    await assert.rejects(verifyPinnedLiveCore({ root, manifestPath }), /source input differs/);
    await writeFile(entry, original);
    await writeFile(resolve(out, manifest.entry.path), 'changed');
    await assert.rejects(verifyPinnedLiveCore({ root, manifestPath }), /bundle bytes differ/);
  });
});

test('rejects traversal in the manifest rather than reading a different input', async () => {
  await fixture(async ({ root, out }) => {
    const manifest = await buildPinnedLiveCore({ root, out });
    manifest.inputs['../another-project.ts'] = { sha256: '0'.repeat(64), bytes: 1 };
    await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(verifyPinnedLiveCore({ root, manifestPath: resolve(out, 'manifest.json') }), /input path outside/);
  });
});
