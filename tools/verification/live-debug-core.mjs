import assert from 'node:assert/strict';
import { build, version as esbuildVersion } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const header = '// Native physical and aerodynamic rigid pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.\n';
const targets = {
  native: { entry: 'src/integration/browser/index.ts', file: 'native-match-core-browser.js', globalName: 'KneekuraNativeMatchCore' },
  workbench: { entry: 'src/integration/browser/workbench-index.ts', file: 'batting-workbench-core.js', globalName: 'KneekuraBaseballWorkbench' },
};
const inside = (root, path) => {
  const rel = relative(root, path);
  return rel !== '' && rel !== '..' && !rel.startsWith('..' + sep) && !isAbsolute(rel);
};
const posix = path => path.split(sep).join('/');

/** Same entry and build options as build-native.mjs; only the destination and
 * exact-byte evidence differ. A candidate is never written over a release. */
export async function buildPinnedLiveCore({ root = process.cwd(), out, target = 'native' }) {
  assert(Object.hasOwn(targets, target), 'unsupported pinned browser entry');
  const spec = targets[target];
  assert(typeof out === 'string' && out.length > 0, 'explicit new verification directory inside the project required');
  root = resolve(root); out = resolve(root, out);
  assert(inside(root, out), 'explicit new verification directory inside the project required');
  const shared = resolve(root, 'dist');
  assert(out !== shared && !inside(shared, out), 'never write a debug candidate into shared dist');
  await mkdir(dirname(out), { recursive: true });
  await mkdir(out); // EEXIST deliberately rejects a previously pinned candidate.
  const outfile = resolve(out, spec.file), loaded = new Map();
  const result = await build({
    absWorkingDir: root, entryPoints: [spec.entry], outfile,
    bundle: true, platform: 'browser', format: 'iife', globalName: spec.globalName,
    target: ['es2022'], legalComments: 'none', minify: false, sourcemap: false,
    metafile: true, write: false,
    plugins: [{ name: 'pin-exact-loaded-source-bytes', setup(builder) {
      builder.onLoad({ filter: /\.(ts|js|mjs|json)$/ }, async ({ path }) => {
        const bytes = await readFile(path), hash = sha(bytes), key = resolve(path);
        if (loaded.has(key)) assert.equal(loaded.get(key).sha256, hash, 'input changed during build');
        loaded.set(key, { sha256: hash, bytes: bytes.length });
        return { contents: bytes, loader: path.endsWith('.ts') ? 'ts' : path.endsWith('.json') ? 'json' : 'js' };
      });
    } }],
  });
  const inputs = {};
  for (const path of Object.keys(result.metafile.inputs).sort()) {
    const absolute = resolve(root, path), pin = loaded.get(absolute);
    assert(inside(root, absolute), 'source input outside project');
    assert(pin, 'every source input must have exact loaded-byte evidence');
    assert.equal(sha(await readFile(absolute)), pin.sha256, 'source changed before manifest close');
    inputs[posix(relative(root, absolute))] = pin;
  }
  assert.equal(result.outputFiles.length, 1, 'one executable bundle expected');
  const code = Buffer.concat([Buffer.from(header), result.outputFiles[0].contents]);
  assert(!code.includes(Buffer.from('require("node:')) && !code.includes(Buffer.from('require("fs"')), 'browser bundle unexpectedly requires Node.js');
  const manifest = {
    schemaVersion: 1, target, authority: 'BUILD_PIN_ONLY_NO_NATIVE_ADMISSION',
    captureMode: 'EXACT_LOADED_BYTES_AND_POST_BUILD_CHECK',
    builtAt: new Date().toISOString(), builderRuntime: process.version, esbuildVersion,
    entry: { path: spec.file, sha256: sha(code), bytes: code.length }, inputs,
  };
  await writeFile(outfile, code, { flag: 'wx' });
  await writeFile(resolve(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return manifest;
}

/** Verify bytes and source identity before the caller executes this candidate.
 * This does not assert Chrome/Node equivalence or Native authorization. */
export async function verifyPinnedLiveCore({ root = process.cwd(), manifestPath }) {
  root = resolve(root); manifestPath = resolve(root, manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert(manifest.schemaVersion === 1 && manifest.authority === 'BUILD_PIN_ONLY_NO_NATIVE_ADMISSION'
    && manifest.captureMode === 'EXACT_LOADED_BYTES_AND_POST_BUILD_CHECK', 'unsupported debug manifest');
  assert(Object.hasOwn(targets, manifest.target ?? 'native')
    && manifest.entry?.path === targets[manifest.target ?? 'native'].file, 'unsupported debug bundle entry');
  assert(manifest.inputs && typeof manifest.inputs === 'object' && !Array.isArray(manifest.inputs)
    && Object.keys(manifest.inputs).length > 0, 'source inputs required');
  for (const [path, pin] of Object.entries(manifest.inputs)) {
    const absolute = resolve(root, path);
    assert(!isAbsolute(path) && inside(root, absolute), 'input path outside project');
    const bytes = await readFile(absolute);
    assert(bytes.length === pin.bytes && sha(bytes) === pin.sha256, 'source input differs: ' + path);
  }
  const code = await readFile(resolve(dirname(manifestPath), manifest.entry.path));
  assert(code.length === manifest.entry.bytes && sha(code) === manifest.entry.sha256, 'bundle bytes differ');
  return { manifest, code: code.toString('utf8') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const manifest = await buildPinnedLiveCore({ out: process.argv[2], target: process.argv[3] ?? 'native' });
  console.log(JSON.stringify({ directory: process.argv[2], entry: manifest.entry,
    sourceCount: Object.keys(manifest.inputs).length, authority: manifest.authority }));
}
