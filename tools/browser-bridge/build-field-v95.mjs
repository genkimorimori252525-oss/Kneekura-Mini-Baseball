import assert from 'node:assert/strict';
import { access, readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const out = resolve(process.argv[2] ?? '../../outputs');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const basePath = resolve('../../outputs/ばせぼーるlv94_TBD_vs_LAD_立体ゾーンと打席位置版.html');
const pinnedBaseSha256 = '2411b6ce1380dc06347cd13b9a5536a3379ca56da62d997750d71bdcff089ff6';
const gamePath = resolve(out, 'ばせぼーるlv95_TBD_vs_LAD_守備走塁の平均基準版.html');
const labPath = resolve(out, 'カメラワーク調整室_v95_守備走塁の平均基準.html');
const once = (text, before, after) => {
  assert.equal(text.split(before).length, 2, 'unique release marker required: ' + before.slice(0, 100));
  return text.replace(before, () => after);
};
async function absent(path) {
  try { await access(path); } catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw Error('Refusing to overwrite an existing release output: ' + path + '. Use a fresh output directory.');
}
for (const path of [gamePath, gamePath + '.build.json', gamePath + '.bundle-inputs.json', labPath, labPath + '.build.json']) await absent(path);
const base = await readFile(basePath, 'utf8'), prior = JSON.parse(await readFile(basePath + '.build.json', 'utf8'));
assert.equal(sha(base), pinnedBaseSha256, 'frozen v94 presentation differs');
assert.equal(prior.sha256, pinnedBaseSha256, 'frozen v94 metadata differs');
assert.equal(prior.rulesVersion, 94); assert.equal(prior.battingSetupVersion, 94);
assert.equal(prior.measuredBatLibrary.trials, 673); assert.equal(prior.displayGridPixels, 4);
const build = spawnSync(process.execPath, ['tools/browser-bridge/build-native.mjs'], { stdio: 'inherit' });
if (build.error) throw build.error; assert.equal(build.status, 0, 'native v95 build failed');
const core = await readFile('dist/native-match-core-browser.js', 'utf8'),
  pinsBytes = await readFile('dist/native-match-core-browser.js.inputs.json'), pins = JSON.parse(pinsBytes);
assert.equal(sha(core), pins.entrySha256, 'native bundle input manifest differs');
for (const path of ['src/integration/browser/LiveFieldInputV95.ts', 'src/core/sim/fielding/LiveDefenseControlEstimateV95.ts'])
  assert.equal(typeof pins.inputs[path], 'string', 'v95 field source missing from compiled Core: ' + path);
const replaceCore = (html, replacement) => {
  let count = 0;
  const result = html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g, (all, start, body, end) => {
    if (!body.includes('var KneekuraNativeMatchCore =')) return all;
    count++; return start + replacement + end;
  });
  assert.equal(count, 1, 'exactly one ordinary-match Core script required'); return result;
};
let game = replaceCore(base, core + '\n');
const setupPath = 'tools/browser-bridge/live-batting-setup-view-v95.js',
  oldSetup = await readFile('tools/browser-bridge/live-batting-setup-view-v94.js', 'utf8'), setup = await readFile(setupPath, 'utf8');
game = once(game, oldSetup, setup);
const oldTitle = '<title>にーくらMINIbaseball v94 立体ゾーンと打席位置</title>',
  newTitle = '<title>にーくらMINIbaseball v95 守備走塁の平均基準</title>',
  oldEdition = '立体ゾーンと打席位置版 94', newEdition = '守備走塁の平均基準版 95';
game = once(once(game, oldTitle, newTitle), oldEdition, newEdition);
// This equality protects all frozen PNG payloads, 673 clips, 4px drawing,
// camera/zone helpers and UI outside the explicit side-resolution repair,
// release labels and Core.
const preservedBase = once(once(replaceCore(base, '__CORE__'), oldTitle, '__TITLE__'), oldEdition, '__EDITION__'),
  preservedGame = once(once(once(replaceCore(game, '__CORE__'), newTitle, '__TITLE__'), newEdition, '__EDITION__'), setup, oldSetup);
assert.equal(preservedGame, preservedBase, 'presentation changed outside Core and release labels');
const sourceFiles = ['tools/browser-bridge/build-field-v95.mjs', 'tools/browser-bridge/build-maker-release-v95.mjs', setupPath],
  fieldSources = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, sha(await readFile(path))])));
const driverPath = 'tools/browser-bridge/camera-workbench-v84.js', templatePath = 'tools/browser-bridge/camera-workbench-v81.html',
  driver = await readFile(driverPath, 'utf8'), template = await readFile(templatePath, 'utf8');
const meta = { ...prior, fieldVersion: 95, fieldInputFactoryVersion: 95,
  fieldReferenceStatus: 'UNIFORM_REFERENCE_WITH_PROVISIONAL_SI_NOT_MLB_CALIBRATED',
  basePresentationPath: basePath, basePresentationSha256: pinnedBaseSha256,
  baseBuilderSha256: prior.builderSha256, builderSha256: fieldSources[sourceFiles[0]], fieldSources,
  sourceCoreChanged: true, worldPhysicsRulesAiChanged: true, sourceCoreSha256: sha(core),
  sourceInputCount: Object.keys(pins.inputs).length, sourceCoreInputCount: Object.keys(pins.inputs).length,
  frozenSourceManifestSha256: sha(pinsBytes), sourceGamePath: gamePath, sourceGameSha256: sha(game),
  preservedPresentationPayloadSha256: sha(preservedGame), presentationUnchangedOutsideCoreAndReleaseLabels: false,
  presentationUnchangedOutsideCoreReleaseLabelsAndSideResolution: true,
  presentationRepair: 'SWITCH_HITTER_USES_ALREADY_RESOLVED_HAND_FOR_STANCE_GEOMETRY',
  workbenchDriverSha256: sha(driver), workbenchTemplateSha256: sha(template) };
let lab = template.replaceAll('調整室 v81', '調整室 v95');
lab = once(lab, '__V73_METADATA__', JSON.stringify(meta).replaceAll('<', '\\u003c'));
lab = once(lab, '__V73_EMBEDDED_GAME__', JSON.stringify(game).replaceAll('<', '\\u003c'));
lab = once(lab, '__V73_WORKBENCH_DRIVER__', driver);
await mkdir(out, { recursive: true });
for (const [path, html, kind] of [[gamePath, game, 'NORMAL_MATCH'], [labPath, lab, 'CAMERA_WORKBENCH']]) {
  await writeFile(path, html, { flag: 'wx' });
  await writeFile(path + '.build.json', JSON.stringify({ ...meta, kind, sha256: sha(html) }, null, 2) + '\n', { flag: 'wx' });
  if (kind === 'NORMAL_MATCH') await writeFile(path + '.bundle-inputs.json', pinsBytes, { flag: 'wx' });
  console.log(JSON.stringify({ output: path, fieldVersion: 95, sha256: sha(html), sourceCoreSha256: sha(core) }));
}
