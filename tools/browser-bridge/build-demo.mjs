import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const input = 'docs/demos/native-tbd-lad-pitch.html';
const source = 'dist/native-match-core-browser.js';
const outfile = 'dist/native-tbd-lad-offline.html';

const [html, native] = await Promise.all([
  readFile(input, 'utf8'),
  readFile(source, 'utf8'),
]);
const placeholder = '<script src="../../dist/native-match-core-browser.js"></script>';
if (!html.includes(placeholder) || html.indexOf(placeholder) !== html.lastIndexOf(placeholder)) {
  throw new Error('Expected exactly one source-backed Native bundle reference.');
}
if (native.includes('</script>')) throw new Error('Unexpected closing script token in native bundle');
const bundledHtml = html.replace(placeholder, '<script>' + native + '\n</script>');
await mkdir('dist', { recursive: true });
await writeFile(outfile, bundledHtml, 'utf8');
const bytes = await readFile(outfile);
console.log(JSON.stringify({
  outfile,
  bytes: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  actualNativeBrowserModule: source,
  externalAssets: 0,
}));
