import assert from 'node:assert/strict';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {applyPlayerPortraitSlotsV114, portraitSlotChangesV114, replacePortraitSeamV114} from './player-portrait-slots-v114.mjs';
const replacePreview = process.argv[2] === '--replace-preview';
assert(process.argv.length === (replacePreview ? 3 : 2), 'Only --replace-preview is supported');
const sha = value => createHash('sha256').update(value).digest('hex'),
  source = resolve('../../outputs/ばせぼーるlv113_TBD_vs_LAD_守備追球と生成改善版.html'),
  output = resolve('../../outputs/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html'),
  reportPath = 'docs/verification/releases/v114/' + (replacePreview ? 'right-build.json' : 'build.json'),
  paths = ['tools/browser-bridge/player-portrait-slots-v114.css', 'tools/browser-bridge/player-portrait-slots-v114.mjs', 'tools/browser-bridge/build-portrait-preview-v114.mjs'],
  inputs = Object.fromEntries(await Promise.all(paths.map(async path => [path, await readFile(path)]))),
  bytes = await readFile(source), base = bytes.toString('utf8'), prior = JSON.parse(await readFile(source + '.build.json', 'utf8'));
assert.equal(sha(bytes), 'aab69cc021aa07958a65982a70b480609adbf241df291a5c857c7abe390f6205');
assert.equal(prior.sha256, sha(bytes));
const css = inputs[paths[0]].toString('utf8'), changes = portraitSlotChangesV114(css),
  title = base.match(/<title>[^<]*<\/title>/)[0], nextTitle = '<title>ばせぼーる lv114 顔写真枠試作版</title>';
let html = replacePortraitSeamV114(applyPlayerPortraitSlotsV114(base, css), title, nextTitle), restored = replacePortraitSeamV114(html, nextTitle, title);
for (const c of [...changes].reverse()) restored = replacePortraitSeamV114(restored, c.after, c.before);
assert.equal(sha(restored), sha(bytes), 'Exactly reversible presentation-only change');
const scripts = text => [...text.matchAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi)].map(m => sha(m[0]));
assert.deepEqual(scripts(html), scripts(base), 'All Core, roster, UI scripts and embedded renderer payloads unchanged');
const sourceInputs = Object.fromEntries(Object.entries(inputs).map(([path, b]) => [path, sha(b)])),
  metadata = {...prior, releaseVersion: 114, sha256: sha(html), bytes: Buffer.byteLength(html),
    sourceGamePath: output, sourceGameSha256: sha(html), portraitSlotsPreviewV114: true, portraitPlacementV114: 'right',
    portraitSourceGameV113: {path: source, sha256: sha(bytes)}, portraitSlotSourcesV114: sourceInputs,
    photoAssetsAdded: false, coreChanged: false, exactReverseV113: true};
await mkdir(dirname(reportPath), {recursive: true});
if (replacePreview) {
  const existing = await readFile(output), previous = JSON.parse(await readFile(output + '.build.json', 'utf8'));
  assert(previous.portraitSlotsPreviewV114 && previous.exactReverseV113);
  assert.equal(sha(existing), previous.sha256, 'Do not overwrite an independently edited preview');
  assert.equal(previous.portraitSourceGameV113.sha256, sha(bytes));
  assert.equal(sha(await readFile('docs/verification/releases/v114/left-preview/ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html')), 'deaa259c45be8bb89ff6c10de422d8c9429b780e8082d34e52bbabd20adbf6df', 'Original preview preserved');
}
await writeFile(output, html, {flag: replacePreview ? 'w' : 'wx'});
await writeFile(output + '.build.json', JSON.stringify(metadata, null, 2) + '\n', {flag: replacePreview ? 'w' : 'wx'});
assert.equal(sha(await readFile(source)), sha(bytes));
for (const [path, hash] of Object.entries(sourceInputs)) assert.equal(sha(await readFile(path)), hash);
const report = {pass: true, output, sha256: sha(html), sourceSha256: sha(bytes), sourceCoreSha256: prior.sourceCoreSha256,
  scriptCount: scripts(html).length, allScriptsIdentical: true, exactReverseV113: true, sourceInputs, photoAssetsAdded: false};
await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
