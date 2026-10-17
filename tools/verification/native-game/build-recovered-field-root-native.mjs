import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const work = resolve(root, '..'), directory = resolve(process.argv[2] ?? '');
const inside = relative(work, directory);
if (!inside || inside.startsWith('..') || isAbsolute(inside) || existsSync(directory)) throw new Error('requires a NEW workspace work/ directory');
mkdirSync(directory);
const outfile = resolve(directory, 'readback.mjs');
const result = await build({ absWorkingDir: root, entryPoints: ['tools/verification/native-game/recovered-field-root-native.ts'],
  outfile, bundle: true, platform: 'node', format: 'esm', target: 'node22', external: ['node:*'], metafile: true, logLevel: 'silent' });
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex');
const manifest = { entrySha256: sha(outfile), inputs: Object.fromEntries(Object.keys(result.metafile.inputs).map(name => [name, sha(resolve(root, name))])) };
for (const name of Object.keys(manifest.inputs)) {
  const source = resolve(root, name), target = resolve(directory, 'frozen-source', name);
  if (sha(source) !== manifest.inputs[name]) throw new Error('source drift during freeze: ' + name);
  mkdirSync(dirname(target), { recursive: true }); copyFileSync(source, target);
}
writeFileSync(resolve(directory, 'build.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ outfile, inputCount: Object.keys(manifest.inputs).length, sha256: manifest.entrySha256 }) + '\n');
