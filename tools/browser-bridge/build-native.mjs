import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const outfile = 'dist/native-match-core-browser.js';
await mkdir('dist', { recursive: true });
const bundledBuild = await build({
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
  metafile: true,
});
const bundled = await readFile(outfile);
const header = '// Native physical and aerodynamic rigid pitch bridge compiled directly from src/core and src/presentation; no browser result simulator.\n';
await writeFile(outfile, header + bundled.toString('utf8'));
const bytes = await readFile(outfile);
if (bytes.includes(Buffer.from('require("node:')) || bytes.includes(Buffer.from('require("fs"'))) {
  throw new Error('Native browser bundle unexpectedly requires Node.js');
}
const sha=buffer=>createHash('sha256').update(buffer).digest('hex');
const inputs=Object.fromEntries(await Promise.all(Object.keys(bundledBuild.metafile.inputs).sort().map(async path=>[path,sha(await readFile(path))])));
const inputManifest=JSON.stringify({schemaVersion:1,entrySha256:sha(bytes),inputs,
 captureMode:'post_build_file_sha_under_frozen_source_contract'},null,2)+'\n';
await writeFile(outfile+'.inputs.json',inputManifest);
console.log(JSON.stringify({
  outfile, bytes: bytes.length,
  sha256: sha(bytes),inputCount:Object.keys(inputs).length,inputManifestSha256:sha(Buffer.from(inputManifest)),
  exports: [
    'createNativeSinglePaSession',
    'issueNativeCommandPitch',
    'observeNativePitch',
    'createNativeAerodynamicSession',
    'observeNativeAerodynamicPitch',
    'createReferenceAerodynamicPhysicalSource',
    'observeNativeFreeBallContinuation',
    'createSourceBallMaterialHistoryV1',
    'createSourceBallMaterialHistoryFromContinuationV3',
    'createExecutedFieldWorldObserverV1',
    'createLiveBaseballMatchV1',
  ],
}));
