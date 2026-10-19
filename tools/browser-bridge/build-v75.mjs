import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import vm from 'node:vm';

const out = resolve(process.argv[2] ?? '../../outputs'), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const basePath = 'docs/demos/releases/v74/game.html', base = await readFile(basePath),
  previous = JSON.parse(await readFile(basePath + '.build.json', 'utf8')),
  core = await readFile('dist/native-match-core-browser.js'), pinsBytes = await readFile('dist/native-match-core-browser.js.inputs.json'),
  pins = JSON.parse(pinsBytes), realm = {};
if (sha(base) !== '734b7af9d50eb1acdf2be1da769502ce2fc529e14032c3b3c736f692008a108d') throw Error('Frozen v74 game differs');
if (pins.entrySha256 !== sha(core) || pins.entrySha256 === previous.sourceCoreSha256) throw Error('Compile the extended-equipment Core first');
for (const [path, expected] of Object.entries(pins.inputs)) if (sha(await readFile(path)) !== expected) throw Error('Source changed after bundle: ' + path);
vm.runInNewContext(core.toString('utf8'), realm);
if (realm.KneekuraNativeMatchCore.DEFAULT_WHOLE_ARC_TRAJECTORY_V1?.method !== 'whole-arc-target') throw Error('Whole-arc Core API missing');
if (core.includes(Buffer.from('</script>'))) throw Error('Unsafe inline Core');
const once = (text, before, after) => {
  if (text.split(before).length !== 2) throw Error('v75 marker differs: ' + before.slice(0, 90));
  return text.replace(before, () => after);
};
let game = base.toString('utf8');
const originalCore = [...game.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).find(s => s.includes('var KneekuraNativeMatchCore ='))?.slice(0, -1);
if (!originalCore || sha(originalCore) !== previous.sourceCoreSha256) throw Error('Exact v74 Core not found');
game = once(game, originalCore, core.toString('utf8'));
const catalogPath = 'docs/demos/live-game-roster-catalog-v62.json', catalogBytes = await readFile(catalogPath);
const catalogScript = game.match(/<script id="v40-roster-catalog" type="application\/json">([\s\S]*?)<\/script>/)?.[0];
if (!catalogScript) throw Error('Physical roster catalog not found');
game = once(game, catalogScript, '<script id="v40-roster-catalog" type="application/json">' + JSON.stringify(JSON.parse(catalogBytes)).replaceAll('<', '\\u003c') + '</script>');
for (const [before, after] of [
  ['id="v74-presentation-controls"', 'id="v75-presentation-controls"'],
  ['presentationVersion:74', 'presentationVersion:75'], ['version:74,authority:', 'version:75,authority:'],
  ['用具と能力上限拡張版 74</title>', '技術得能接続版 75</title>'],
  ['用具と能力上限拡張版 74', '技術得能接続版 75'],
]) game = once(game, before, after);
for (const [name, expected] of Object.entries(previous.helpers)) {
  const bytes = await readFile('tools/browser-bridge/' + name);
  if (sha(bytes) !== expected || !game.includes(bytes.toString('utf8'))) throw Error('Inherited presentation helper differs: ' + name);
}
const driverPath = 'tools/browser-bridge/camera-workbench-v73.js', templatePath = 'tools/browser-bridge/camera-workbench-v73.html',
  driver = await readFile(driverPath, 'utf8'), template = await readFile(templatePath, 'utf8');
if (driver.includes('</script>')) throw Error('Unsafe camera driver');
const metadata = { ...previous, presentationVersion: 75, basePresentationPath: basePath, basePresentationSha256: sha(base),
  sourceCoreSha256: sha(core), sourceInputCount: Object.keys(pins.inputs).length, compatibleSessionCoreSha256: [],
  sessionMigration: 'TECHNICAL_TRAITS_CORE_V75_REJECT_OLDER_CORE_SESSIONS',
  workbenchDriverSha256: sha(driver), workbenchTemplateSha256: sha(template), builderSha256: sha(await readFile('tools/browser-bridge/build-v75.mjs')),
  sourceCoreChanged: true, ballDynamicsRulesAiChanged: true, ballDynamicsChanged: false, rulesChanged: false, techniqueExecutionChanged: true, batTrajectoryAuthoringChanged: true,
  optionalWholeArcTrajectoryConnected: true, extendedEquipmentConnected: true, technicalTraitsConnected: true,
  technicalTraits: { families: ['baserunning','bunting','advanced_fielding','bat_to_run_transition','slow_ball_charge','low_zone_command'], effectScale: [0,2], defaultsChanged: false, source: 'LOCAL_AUTHORING_NOT_NATIVE_MASTERY' },
  equipmentCatalogPath: catalogPath, equipmentCatalogSha256: sha(catalogBytes),
  equipment: { batLengthM: [.2, 3], batMassKg: [.1, 5], researchOnlyRangesNotRealEquipmentRecommendations: true },
  publicAbilityAuthoring: { groupMaximum: null, matchDisplayMaximum: 100, plateVision: [1, 100] },
  impactTrajectory: { optional: true, defaultPlayerRosterChanged: false, method: 'whole-arc-target',
    legacyOmittedMethod: 'LOCAL_WINDOW_OFFSET_UNCHANGED', levels: [1, 2, 3, 4], angleDegreesByLevel: [-10, 0, 10, 20],
    angleMeaning: 'ABSOLUTE_CONTACT_ATTACK_DEGREES', sourceWindowFitRequired: false,
    model: 'CONSTANT_RIGID_ROTATION_ABOUT_ORIGINAL_CONTACT_SWEET_SPOT',
    collisionAndRenderingSameReference: true, speedMagnitudeAndTimePreserved: true, directLaunchOrSpinOverride: false } };
delete metadata.sha256; delete metadata.kind;
let lab = once(template.replace(/v73/g, 'v75'), '__V73_METADATA__', JSON.stringify(metadata).replaceAll('<', '\\u003c'));
lab = once(lab, '__V73_EMBEDDED_GAME__', JSON.stringify(game).replaceAll('<', '\\u003c'));
lab = once(lab, '__V73_WORKBENCH_DRIVER__', driver);
await mkdir(out, { recursive: true });
for (const [name, html, kind] of [
  ['ばせぼーるlv75_TBD_vs_LAD_技術得能接続版.html', game, 'NORMAL_MATCH'],
  ['カメラワーク調整室_v75.html', lab, 'CAMERA_WORKBENCH'],
]) {
  if (Buffer.byteLength(html) >= 100_000_000) throw Error('HTML exceeds single-file limit');
  const path = resolve(out, name);
  await writeFile(path, html); await writeFile(path + '.build.json', JSON.stringify({ ...metadata, kind, sha256: sha(html) }, null, 2) + '\n');
  if (kind === 'NORMAL_MATCH') await writeFile(path + '.bundle-inputs.json', pinsBytes);
  console.log(JSON.stringify({ kind, path, sha256: sha(html), bytes: Buffer.byteLength(html), sourceInputs: Object.keys(pins.inputs).length }));
}
