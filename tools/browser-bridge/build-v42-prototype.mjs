import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { transformV31 } from '../../docs/demos/v31-presentation.mjs';
import { transformLiveV41 } from './v41-live-presentation.mjs';

const output = resolve(process.argv[2] ?? '../../outputs/ばせぼーるlv42_TBD_vs_LAD_一球速報UI試作版.html');
const baseline = resolve('docs/demos/assets/approved-v27-baseline.html');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

const bytes = await readFile(baseline);
const source = bytes.toString('utf8');
const native = await readFile('dist/native-match-core-browser.js', 'utf8');
const runtime = (await readFile('tools/browser-bridge/v40-live-runtime.js', 'utf8'))
  .replace('個人能力・守備カバー接続版 40', '一球速報UI試作版 42')
  .replace('version:40,authority:', 'version:42,authority:');
const chart = await readFile('tools/browser-bridge/v38-live-pitch-chart.js', 'utf8');
const fieldCamera = await readFile('tools/browser-bridge/live-field-camera.js', 'utf8');
const actorAnimation = await readFile('tools/browser-bridge/v40-live-actor-animation.js', 'utf8');
const playDescription = await readFile('tools/browser-bridge/live-play-description.js', 'utf8');
const broadcastUi = await readFile('tools/browser-bridge/v42-broadcast-ui.js', 'utf8');
const rosterBytes = await readFile('docs/demos/live-game-roster-v2.json');
const roster = JSON.parse(rosterBytes);
const catalogBytes = await readFile('docs/demos/live-game-roster-catalog-v2.json');
const catalog = JSON.parse(catalogBytes);
const measuredBytes = await readFile('docs/demos/measured-bat-motions.json');
const measured = JSON.parse(measuredBytes);

let html = transformV31(source).replace(
  /<script id="v24-exact-native-core">[\s\S]*?<\/script>/,
  () => '<script>' + native + '\n</script>'
);
html = transformLiveV41(html, runtime);
html = html.replace(
  '<script id="v33-offline-core-match">',
  () =>
    '<script id="v33-measured-bats" type="application/json">' +
    JSON.stringify(measured).replaceAll('<', '\\u003c') +
    '</script>\n<script id="v34-live-pitch-chart">\n' +
    chart +
    '\n</script>\n<script id="v36-field-camera">\n' +
    fieldCamera +
    '\n</script>\n<script id="v37-actor-animation">\n' +
    actorAnimation +
    '\n</script>\n<script id="v38-play-description">\n' +
    playDescription +
    '\n</script>\n<script id="v40-physical-roster" type="application/json">' +
    JSON.stringify(roster).replaceAll('<', '\\u003c') +
    '</script>\n<script id="v40-roster-catalog" type="application/json">' +
    JSON.stringify(catalog).replaceAll('<', '\\u003c') +
    '</script>\n<script id="v33-offline-core-match">'
);
html = html.replace(
  '</body></html>',
  () => '<script id="v42-broadcast-ui">\n' + broadcastUi + '\n</script>\n</body></html>'
);

await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, html);
console.log(JSON.stringify({ output, bytes: Buffer.byteLength(html), sha256: sha(Buffer.from(html)) }, null, 2));
