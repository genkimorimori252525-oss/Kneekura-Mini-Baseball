import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
const output = resolve(process.argv[2]);
const entry = process.argv[3] ?? 'tools/verification/aero-ground-samepa/source-integer-checkpoint-entry.ts';
const sourceRoot = resolve(process.argv[4] ?? '.');
assert.ok(!existsSync(output), 'fixed evidence bundle must be new'); mkdirSync(dirname(output), { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const before = new Map();
const visit = directory => { for (const name of readdirSync(directory, { withFileTypes: true })) {
  const path = join(directory, name.name); if (name.isDirectory()) visit(path); else before.set(resolve(path), sha(readFileSync(path)));
} };
visit(join(sourceRoot, 'src')); visit(join(sourceRoot, 'tools/verification'));
const result = await build({ absWorkingDir: sourceRoot, entryPoints: [resolve(entry)], outfile: output, nodePaths: [resolve('node_modules')],
  bundle: true, platform: 'node', format: 'esm', packages: 'external', target: 'node26', metafile: true });
const inputs = Object.keys(result.metafile.inputs).map(path => ({ path, sha256: sha(readFileSync(resolve(sourceRoot,path))) }));
for (const input of inputs) assert.equal(input.sha256, before.get(resolve(sourceRoot,input.path)), 'source changed during fixed-bundle build: ' + input.path);
const manifest = { sourceRoot, bundlePath: output, bundleHash: sha(readFileSync(output)), inputs, sourceBytesStableDuringBuild: true };
writeFileSync(output + '.build.json', JSON.stringify(manifest, null, 2), { flag: 'wx' });
process.stdout.write(JSON.stringify({ status: 'PASS_FIXED_INTEGER_CHECKPOINT_BUNDLE', bundleHash: manifest.bundleHash, sourceCount: inputs.length, output }) + '\n');
