import assert from 'node:assert/strict';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const output = resolve(process.argv[2] ?? '../../outputs/にーくら野球メーカー_v95_守備走塁の平均基準版.html');
const matchPath = resolve(process.argv[3] ?? '../../outputs/ばせぼーるlv95_TBD_vs_LAD_守備走塁の平均基準版.html');
for (const path of [output, output + '.build.json', output + '.bundle-inputs.json']) {
  try { await access(path); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  throw Error('Refusing to overwrite an existing release output: ' + path + '. Use a fresh output path.');
}
const matchBytes = await readFile(matchPath), matchMeta = JSON.parse(await readFile(matchPath + '.build.json', 'utf8'));
assert.equal(matchMeta.sha256, sha(matchBytes)); assert.equal(matchMeta.fieldVersion, 95);
assert.equal(matchMeta.rulesVersion, 94); assert.equal(matchMeta.measuredBatLibrary.trials, 673);
// Preserve every v94 feature flag, authored roster and catalog. The existing
// builder owns all UI, adapters and immutable source-pinning behavior.
const result = spawnSync(process.execPath, ['tools/browser-bridge/build-maker.mjs', output,
  '--executable-traits', '--measured-library', '--ball-comparison', '--batter-comparison', '--bat-orbit', '--player-swing-preview',
  '--whole-arc', '--equipment-preview', '--technical-traits', '--ball-display-fix', '--pitcher-workbench', '--pitch-library',
  '--pitch-views', '--course-seasons', '--pitch-menu', '--lossless-performance', '--maker-recovery', '--presentation-v84',
  '--maker-guides', '--maker-validation', '--course-map-v87', '--playback-v88', '--pitch-arrows-v89', '--maker-editor-v90',
  '--pitch-movement-v92', '--rules-v94', '--roster=docs/demos/live-game-roster-v62.json',
  '--catalog=docs/demos/live-game-roster-catalog-v77.json', '--match-renderer=' + matchPath], { stdio: 'inherit' });
if (result.error) throw result.error; if (result.status !== 0) throw Error('Maker v95 build failed');
const built = await readFile(output, 'utf8'), meta = JSON.parse(await readFile(output + '.build.json', 'utf8'));
assert.equal(meta.sha256, sha(built)); assert.equal(meta.referenceClips, 673); assert.equal(meta.gamePlayers, 20);
assert.equal(meta.matchRendererSourceSha256, matchMeta.sha256);
const oldTitle = '<title>にーくら野球メーカー v94</title>', newTitle = '<title>にーくら野球メーカー v95 守備走塁の平均基準</title>';
assert.equal(built.split(oldTitle).length, 2, 'unique outer maker title required');
const html = built.replace(oldTitle, newTitle);
const fieldSources = Object.fromEntries(await Promise.all(['tools/browser-bridge/build-field-v95.mjs',
  'tools/browser-bridge/build-maker-release-v95.mjs', 'tools/browser-bridge/live-batting-setup-view-v95.js'].map(async path => [path, sha(await readFile(path))])));
Object.assign(meta, { fieldVersion: 95, fieldInputFactoryVersion: 95,
  fieldReferenceStatus: 'UNIFORM_REFERENCE_WITH_PROVISIONAL_SI_NOT_MLB_CALIBRATED',
  fieldCoreSha256: matchMeta.sourceCoreSha256, fieldSources,
  output, bytes: Buffer.byteLength(html), sha256: sha(html), makerWrapperSha256: fieldSources['tools/browser-bridge/build-maker-release-v95.mjs'] });
// These are only the files this invocation just created; v94 outputs remain untouched.
await writeFile(output, html); await writeFile(output + '.build.json', JSON.stringify(meta, null, 2) + '\n');
console.log(JSON.stringify({ output, fieldVersion: 95, sha256: meta.sha256, fieldCoreSha256: meta.fieldCoreSha256 }));
