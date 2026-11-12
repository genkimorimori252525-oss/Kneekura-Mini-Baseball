// Builds the ball-bank replay bundle (run from the source root): node tools/release/build-bank-replay.mjs <out.js>
import {build} from 'esbuild'; import {readFileSync, writeFileSync} from 'node:fs';
const out = process.argv[2];
const tsconfigRaw = JSON.parse(readFileSync('tsconfig.json', 'utf8'));
const r = await build({entryPoints: ['src/integration/browser/bank-index.ts'], bundle: true, write: false, platform: 'browser', format: 'iife',
  globalName: 'KbmBank', target: ['es2022'], legalComments: 'none', minify: false, sourcemap: false, tsconfigRaw, logLevel: 'warning'});
writeFileSync(out, r.outputFiles[0].text); console.log(out, r.outputFiles[0].text.length);
