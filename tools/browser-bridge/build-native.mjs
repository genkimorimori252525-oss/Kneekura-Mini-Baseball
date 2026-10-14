import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const outfile = 'dist/native-match-core-browser.js';
await mkdir('dist', { recursive: true });
await build({
  entryPoints: ['src/integration/browser/index.ts'],
  outfile,
  bundle: true,
  platform: 'browser',
  format: 'iife',
  globalName: 'KneekuraNativeMatchCore',
  target: ['es2022'],
  legalComments: 'none',
  minify: false,
  sourcemap: false,
});
const bundled = await readFile(outfile);
const header = '// Native physical and aerodynamic rigid pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.\n';
await writeFile(outfile, header + bundled.toString('utf8'));
const bytes = await readFile(outfile);
if (bytes.includes(Buffer.from('require("node:')) || bytes.includes(Buffer.from('require("fs"'))) {
  throw new Error('Native browser bundle unexpectedly requires Node.js');
}
console.log(JSON.stringify({
  outfile, bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  exports: [
    'createNativeSinglePaSession',
    'issueNativeCommandPitch',
    'observeNativePitch',
    'createNativeAerodynamicSession',
    'observeNativeAerodynamicPitch',
    'createReferenceAerodynamicPhysicalSource',
  ],
}));
