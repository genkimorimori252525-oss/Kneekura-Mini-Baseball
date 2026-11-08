// Builds the browser Core bundles from src/. Output is written to the given directory.
import {build} from 'esbuild';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const out = process.argv[2];
if (!out) throw Error('usage: build-native.mjs <output-dir>');
await mkdir(out, {recursive: true});
const tsconfigRaw = JSON.parse(await readFile('tsconfig.json', 'utf8'));
const targets = [
  ['native', 'src/integration/browser/index.ts', 'KneekuraNativeMatchCore'],
  ['workbench', 'src/integration/browser/workbench-index.ts', 'KneekuraBaseballWorkbench'],
];
for (const [name, entry, globalName] of targets) {
  const result = await build({
    entryPoints: [entry], bundle: true, write: false, platform: 'browser', format: 'iife', globalName,
    target: ['es2022'], legalComments: 'none', minify: false, sourcemap: false, tsconfigRaw, logLevel: 'warning',
  });
  const text = Buffer.from(result.outputFiles[0].contents).toString('utf8');
  if (text.includes('</script')) throw Error(name + ' bundle contains a closing script tag');
  await writeFile(path.join(out, name + '.js'), text);
  console.log(name, text.length);
}
