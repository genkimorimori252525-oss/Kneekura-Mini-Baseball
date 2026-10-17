import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { transformV29, V29_CAPTURE_OBSERVER_INSERTION } from '../../docs/demos/v29-presentation.mjs';

const baseline = process.argv[2] ?? 'C:/Users/genki/Downloads/ばせぼーるlv27_TBD_vs_LAD_描画視認性先行版.html';
const output = resolve(process.argv[3] ?? 'dist/ばせぼーるlv29_TBD_vs_LAD_捕球と視点修正版.html');
const reference = process.argv[4] ?? 'C:/Users/genki/Downloads/ChatGPT 画像 2026年10月15日 00_41_28.png';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const baselineBytes = await readFile(baseline);
if (sha(baselineBytes) !== 'c613574b377afd19060d89100c1bd7c1fa693efd42361c77ed7ab21943670f1f') {
  throw new Error('Approved v27 source SHA mismatch');
}
const referenceBytes = await readFile(reference);
if (sha(referenceBytes) !== '45fb3e4d1f57d28fd216697a626992d2300d276a9a3390db843c3f918db08d31') {
  throw new Error('Approved wooden-bat reference SHA mismatch');
}
const source = baselineBytes.toString('utf8');
let html = transformV29(source);
const native = await readFile('dist/native-match-core-browser.js', 'utf8');
if (native.includes('</script>')) throw new Error('Native closing script token');
const oldNative = /<script id="v24-exact-native-core">[\s\S]*?<\/script>/;
if (!oldNative.test(html)) throw new Error('Native baseline bundle not found');
html = html.replace(oldNative, () => '<script>' + native + '\n</script>');
const pngs = input => input.match(/^const APPROVED_PLAYER_MASKS=.*$/m)?.[0];
const font = input => input.match(/@font-face[^}]+}/)?.[0];
const engine = input => {
  const start = input.indexOf('/* Kneekura Browser Match Slice v23');
  const end = input.indexOf('</script>', start);
  if (start < 0 || end < 0) throw new Error('Legacy engine boundary missing');
  return input.slice(start, end);
};
if (engine(html).replace(V29_CAPTURE_OBSERVER_INSERTION, '') !== engine(source)) {
  throw new Error('Legacy engine has a change beyond read-only capture metadata');
}
if (!pngs(source) || pngs(source) !== pngs(html)) throw new Error('Approved PNG mask bytes changed');
if (!font(source) || font(source) !== font(html)) throw new Error('Approved font bytes changed');
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, html, 'utf8');
const report = {
  output, sha256: sha(Buffer.from(html)), baselineSha256: sha(baselineBytes),
  batReferenceSha256: sha(referenceBytes),
  batReferenceHandoffShaMismatch: 'Handoff records 986ff3c4…; current user-provided file is 45fb3e4d…',
  nativeBundleSha256: sha(Buffer.from(native)),
  approvedPngMasksSha256: sha(Buffer.from(pngs(source))), approvedFontSha256: sha(Buffer.from(font(source))),
  legacyEngineBeforeSha256: sha(Buffer.from(engine(source))), legacyEngineAfterSha256: sha(Buffer.from(engine(html))),
  engineChange: 'Read-only presentationEvidence exposes existing fieldSimulation capture; game calculations unchanged',
  boundary: 'Legacy v23 game remains separate; Native aerodynamic observer uses source spinFrames; Native mixed-play nine innings incomplete',
};
await writeFile(output + '.build.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
