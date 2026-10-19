import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import vm from 'node:vm';

const out = resolve(process.argv[2] ?? '../../outputs'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const basePath = 'docs/demos/releases/v68/game.html', base = await readFile(basePath),
  previous = JSON.parse(await readFile(basePath + '.build.json', 'utf8')),
  core = await readFile('dist/native-match-core-browser.js'), pinsBytes = await readFile('dist/native-match-core-browser.js.inputs.json'),
  pins = JSON.parse(pinsBytes), realm = {};
if (sha(base) !== '8b709ab3c69fc8bdc5f9980a8b66912e0b9b86f73c67970cc1bf9b37cfa6ccbc') throw Error('Frozen v68 game differs');
if (pins.entrySha256 !== sha(core) || pins.entrySha256 === previous.sourceCoreSha256) throw Error('Compile the new whole-arc Core first');
for (const [path, expected] of Object.entries(pins.inputs)) if (sha(await readFile(path)) !== expected) throw Error('Source changed after bundle: ' + path);
vm.runInNewContext(core.toString('utf8'), realm);
if (realm.KneekuraNativeMatchCore.DEFAULT_WHOLE_ARC_TRAJECTORY_V1?.method !== 'whole-arc-target') throw Error('Whole-arc Core API missing');
if (core.includes(Buffer.from('</script>'))) throw Error('Unsafe inline Core');
const once = (text, before, after) => {
  if (text.split(before).length !== 2) throw Error('v73 marker differs: ' + before.slice(0, 90));
  return text.replace(before, () => after);
};
let game = base.toString('utf8');
const originalCore = [...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('var KneekuraNativeMatchCore ='))?.slice(0, -1);
if (!originalCore || sha(originalCore) !== previous.sourceCoreSha256) throw Error('Exact v68 Core not found');
game = once(game, originalCore, core.toString('utf8'));
for (const [before, after] of [
  ['id="v68-presentation-controls"', 'id="v73-presentation-controls"'],
  ['presentationVersion:68', 'presentationVersion:73'], ['version:68,authority:', 'version:73,authority:'],
  ['弾道と実測フォーム接続版 68</title>', '全体スイング角度版 73</title>'],
  ['弾道と実測フォーム接続版 68', '全体スイング角度版 73'],
]) game = once(game, before, after);
for (const [name, expected] of Object.entries(previous.helpers)) {
  const bytes = await readFile('tools/browser-bridge/' + name);
  if (sha(bytes) !== expected || !game.includes(bytes.toString('utf8'))) throw Error('Inherited presentation helper differs: ' + name);
}
const driverPath = 'tools/browser-bridge/camera-workbench-v73.js', templatePath = 'tools/browser-bridge/camera-workbench-v73.html',
  driver = await readFile(driverPath, 'utf8'), template = await readFile(templatePath, 'utf8');
if (driver.includes('</script>')) throw Error('Unsafe camera driver');
const metadata = { ...previous, presentationVersion: 73, basePresentationPath: basePath, basePresentationSha256: sha(base),
  sourceCoreSha256: sha(core), sourceInputCount: Object.keys(pins.inputs).length, compatibleSessionCoreSha256: [],
  sessionMigration: 'WHOLE_ARC_CORE_V73_REJECT_OLDER_CORE_SESSIONS',
  workbenchDriverSha256: sha(driver), workbenchTemplateSha256: sha(template), builderSha256: sha(await readFile('tools/browser-bridge/build-v73.mjs')),
  sourceCoreChanged: true, ballDynamicsRulesAiChanged: false, batTrajectoryAuthoringChanged: true,
  optionalWholeArcTrajectoryConnected: true,
  impactTrajectory: { optional: true, defaultPlayerRosterChanged: false, method: 'whole-arc-target',
    legacyOmittedMethod: 'LOCAL_WINDOW_OFFSET_UNCHANGED', levels: [1, 2, 3, 4], angleDegreesByLevel: [-10, 0, 10, 20],
    angleMeaning: 'ABSOLUTE_CONTACT_ATTACK_DEGREES', sourceWindowFitRequired: false,
    model: 'CONSTANT_RIGID_ROTATION_ABOUT_ORIGINAL_CONTACT_SWEET_SPOT',
    collisionAndRenderingSameReference: true, speedMagnitudeAndTimePreserved: true, directLaunchOrSpinOverride: false } };
delete metadata.sha256; delete metadata.kind;
let lab = once(template, '__V73_METADATA__', JSON.stringify(metadata).replaceAll('<', '\\u003c'));
lab = once(lab, '__V73_EMBEDDED_GAME__', JSON.stringify(game).replaceAll('<', '\\u003c'));
lab = once(lab, '__V73_WORKBENCH_DRIVER__', driver);
await mkdir(out, { recursive: true });
for (const [name, html, kind] of [
  ['ばせぼーるlv73_TBD_vs_LAD_全体スイング角度版.html', game, 'NORMAL_MATCH'],
  ['カメラワーク調整室_v73.html', lab, 'CAMERA_WORKBENCH'],
]) {
  if (Buffer.byteLength(html) >= 100_000_000) throw Error('HTML exceeds single-file limit');
  const path = resolve(out, name);
  await writeFile(path, html); await writeFile(path + '.build.json', JSON.stringify({ ...metadata, kind, sha256: sha(html) }, null, 2) + '\n');
  if (kind === 'NORMAL_MATCH') await writeFile(path + '.bundle-inputs.json', pinsBytes);
  console.log(JSON.stringify({ kind, path, sha256: sha(html), bytes: Buffer.byteLength(html), sourceInputs: Object.keys(pins.inputs).length }));
}
