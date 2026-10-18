import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import vm from 'node:vm';

const args = process.argv.slice(2), executableTraits = args.includes('--executable-traits'), traitProfiles = executableTraits || args.includes('--traits'), publicAbilities = traitProfiles || args.includes('--public-abilities');
const inputOverride = name => {
  const options=args.filter(arg=>arg.startsWith('--'+name+'='));
  if(options.length>1||options.some(arg=>!arg.slice(name.length+3)))throw Error('Exactly one nonempty --'+name+'=PATH is required when overriding input');
  return options[0]?.slice(name.length+3);
};
const output = resolve(args.find(arg => !['--public-abilities','--traits','--executable-traits'].includes(arg)
  && !arg.startsWith('--roster=') && !arg.startsWith('--catalog=')) ?? (publicAbilities ? 'outputs/にーくら野球メーカー_公開能力編集版.html' : 'outputs/にーくら野球メーカー_実測スイング版.html'));
const rosterPath = inputOverride('roster') ?? 'docs/demos/live-game-roster-' + (traitProfiles ? 'v3' : publicAbilities ? 'v2' : 'v1') + '.json';
const rosterCatalogPath = inputOverride('catalog') ?? 'docs/demos/live-game-roster-catalog-' + (executableTraits ? 'v4' : traitProfiles ? 'v3' : publicAbilities ? 'v2' : 'v1') + '.json';
const bundlePath = resolve('dist/batting-workbench-core.js');
await mkdir(dirname(bundlePath), { recursive: true });
const bundledBuild = await build({ entryPoints: ['src/integration/browser/workbench-index.ts'], outfile: bundlePath, bundle: true,
  platform: 'browser', format: 'iife', globalName: 'KneekuraBaseballWorkbench', target: ['es2022'],
  legalComments: 'none', minify: false, sourcemap: false, metafile: true });
const [template, core, ui, referenceJson, batSprites, batManifestJson, rosterJson, rosterCatalogJson] = await Promise.all([
  readFile('docs/demos/baseball-maker.html', 'utf8'), readFile(bundlePath, 'utf8'), readFile('docs/demos/baseball-maker-ui.mjs', 'utf8'),
  readFile('docs/demos/measured-bat-motions.json', 'utf8'),
  readFile('docs/demos/bat-length-sprites.mjs', 'utf8'), readFile('docs/demos/assets/bat-lengths/manifest.json', 'utf8'),
  readFile(rosterPath, 'utf8'), readFile(rosterCatalogPath, 'utf8'),
]);
const sha = source => createHash('sha256').update(source).digest('hex');
const bundleInputs = Object.fromEntries(await Promise.all(Object.keys(bundledBuild.metafile.inputs).sort().map(async path => [path, sha(await readFile(path))])));
const bundleInputManifest = JSON.stringify({ schemaVersion: 1, entrySha256: sha(core), inputs: bundleInputs,
  captureMode: 'post_build_file_sha_under_frozen_source_contract' }, null, 2) + '\n';
const publicReferenceJson = publicAbilities ? await readFile('docs/demos/live-public-ability-reference-v1.json', 'utf8') : null;
const publicReference = publicReferenceJson ? JSON.parse(publicReferenceJson) : null;
if (publicAbilities && ['projectLivePublicAbilitiesV1', 'editLivePublicAbilityV1', 'previewLivePublicLeagueV1', 'materializeLivePlateVisionV1', 'resolveLivePlateVisionV1'].some(key => !core.includes(key)))
  throw Error('Public ability authoring API unavailable');
const liveRoster = JSON.parse(rosterJson), liveRosterCatalog = JSON.parse(rosterCatalogJson);
if (liveRoster.version !== 'live_physical_roster_v1' || !Array.isArray(liveRoster.entries) || !Array.isArray(liveRosterCatalog.players)
  || !Array.isArray(liveRosterCatalog.fields) || liveRoster.entries.length !== liveRosterCatalog.players.length
  || new Set(liveRoster.entries.map(e => e.playerId)).size !== liveRoster.entries.length
  || liveRosterCatalog.players.some(p => !liveRoster.entries.some(e => e.playerId === p.playerId && e.physical && !e.workbenchPlayer)))
  throw Error('Complete physical game roster/catalog required');
if (!core.includes('applyLivePhysicalRosterV1')) throw Error('Game ability validation API unavailable');
const traitAvailabilityJson = executableTraits ? await readFile('docs/demos/live-trait-availability-v54.json', 'utf8') : null;
const traitAvailability = traitAvailabilityJson ? JSON.parse(traitAvailabilityJson) : null;
if (traitAvailability) {
  if (traitAvailability.version !== 'live_trait_availability_v54' || traitAvailability.authority !== 'CANONICAL_INVENTORY_READ_ONLY_NOT_EXECUTION_INPUT'
    || !Array.isArray(traitAvailability.entries) || !Array.isArray(traitAvailability.supportedFamilyIds)
    || traitAvailability.entries.length !== 119 || new Set(traitAvailability.entries.map(e => e.familyId)).size !== traitAvailability.entries.length)
    throw Error('Canonical trait availability catalog required');
  const realm = {}; vm.runInNewContext(core, realm);
  const actual = realm.KneekuraBaseballWorkbench.getLiveTraitCatalogV1().map(d => d.familyId).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...traitAvailability.supportedFamilyIds].sort())) throw Error('Trait execution/availability catalog disagree');
  for (const entry of traitAvailability.entries) {
    if (!/^[a-z][a-z0-9_]*$/.test(entry.familyId) || !entry.label || !Array.isArray(entry.aliases)
      || !['EXECUTABLE', 'UNSUPPORTED', 'OUT_OF_SCOPE', 'REVIEW_REQUIRED'].includes(entry.status)
      || (entry.status === 'EXECUTABLE') !== actual.includes(entry.familyId)
      || entry.status !== 'EXECUTABLE' && !entry.userReason) throw Error('Invalid trait availability: ' + entry.familyId);
  }
}
const batManifest = JSON.parse(batManifestJson);
if (batManifest.authority !== 'GENERATED_RENDER_SPRITES_NOT_MEASURED_BAT_GEOMETRY' || batManifest.variants?.length !== 3) throw Error('Bat sprite manifest is invalid');
const batVariants = await Promise.all(batManifest.variants.map(async (variant, index) => {
  const expectedLength = [.78, .84, .9][index], expectedFile = ['bat-78cm.png', 'bat-84cm.png', 'bat-90cm.png'][index];
  if (variant.nominalLengthM !== expectedLength || variant.file !== expectedFile || variant.mode !== 'RGBA') throw Error('Bat sprite variant differs');
  const bytes = await readFile('docs/demos/assets/bat-lengths/' + variant.file);
  if (sha(bytes) !== variant.sha256 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
    || bytes.readUInt32BE(16) !== 2172 || bytes.readUInt32BE(20) !== 724) throw Error('Bat sprite original bytes differ');
  return { file: variant.file, nominalLengthM: variant.nominalLengthM, sha256: variant.sha256, pngDataUri: 'data:image/png;base64,' + bytes.toString('base64') };
}));
const batSpriteData = { authority: batManifest.authority, manifestSha256: sha(batManifestJson), variants: batVariants };
const referenceData = JSON.parse(referenceJson);
if (referenceData.schemaVersion !== 2 || referenceData.authority !== 'OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH'
  || !Array.isArray(referenceData.clips) || !referenceData.clips.length) throw Error('Reference bat motion source is invalid');
const finiteVector = value => value && ['x', 'y', 'z'].every(key => Number.isFinite(value[key]));
for (const clip of referenceData.clips) {
  if (!clip.id?.startsWith('obp-') || !clip.source?.sha256 || !clip.frames?.length || !clip.measurements?.length
    || !Number.isFinite(clip.timeRange?.start) || !Number.isFinite(clip.timeRange?.end)
    || clip.timeRange.start >= clip.timeRange.end || clip.frames.some((frame, index) => !Number.isSafeInteger(frame.tick)
      || (index > 0 && frame.tick <= clip.frames[index - 1].tick)
      || !frame.orientation || !['w', 'x', 'y', 'z'].every(key => Number.isFinite(frame.orientation[key]))
      || !['grip', 'tip', 'sweetSpot', 'sweetSpotVelocity'].every(key => finiteVector(frame[key])))) throw Error('Reference bat clip is invalid: ' + clip.id);
}
if ([core, ui, batSprites].some(source => /<\/script/i.test(source))) throw Error('Unexpected closing-script token in bundled source');
if (/require\(["']node:|require\(["']fs["']/.test(core)) throw Error('Workbench bundle imports a Node-only module');
for (const marker of ['<!-- WORKBENCH_CORE -->', '<!-- WORKBENCH_REFERENCE -->', '<!-- WORKBENCH_BAT_SPRITES -->', '<!-- WORKBENCH_LIVE_ROSTER -->', '<!-- WORKBENCH_UI -->']) {
  if (!template.includes(marker) || template.indexOf(marker) !== template.lastIndexOf(marker)) throw Error('Workbench template marker differs');
}
const html = template.replace('<!-- WORKBENCH_CORE -->', () => '<script>\n' + core + '\n</script>')
  .replace('<!-- WORKBENCH_REFERENCE -->', () => '<script>globalThis.KneekuraReferenceBatMotions=' + JSON.stringify(referenceData).replace(/</g, '\\u003c') + ';</script>')
  .replace('<!-- WORKBENCH_BAT_SPRITES -->', () => '<script>globalThis.KneekuraBatLengthSpriteData=' + JSON.stringify(batSpriteData).replace(/</g, '\\u003c') + ';\n' + batSprites + '\n</script>')
  .replace('<!-- WORKBENCH_LIVE_ROSTER -->', () => '<script>globalThis.KneekuraLiveGameRosterData=' + JSON.stringify(liveRoster).replace(/</g, '\\u003c')
    + ';globalThis.KneekuraLiveGameRosterCatalog=' + JSON.stringify(liveRosterCatalog).replace(/</g, '\\u003c')
    + (publicReference ? ';globalThis.KneekuraLivePublicAbilityReference=' + JSON.stringify(publicReference).replace(/</g, '\\u003c') : '')
    + (traitAvailability ? ';globalThis.KneekuraLiveTraitAvailabilityCatalog=' + JSON.stringify(traitAvailability).replace(/</g, '\\u003c') : '') + ';</script>')
  .replace('<!-- WORKBENCH_UI -->', () => '<script>\n' + ui + '\n</script>');
await mkdir(dirname(output), { recursive: true }); await writeFile(output, html);
const report = { output, bytes: Buffer.byteLength(html), sha256: sha(html), coreSha256: sha(core), uiSha256: sha(ui),
  bundleInputCount: Object.keys(bundleInputs).length, bundleInputManifestSha256: sha(bundleInputManifest),
  templateSha256: sha(template), referenceSha256: sha(referenceJson), referenceClips: referenceData.clips.length,
  liveRosterSha256: sha(rosterJson), liveRosterCatalogSha256: sha(rosterCatalogJson), gamePlayers: liveRoster.entries.length,
  publicAbilities, traitProfiles, executableTraits, traitCatalogFamilies: traitAvailability?.entries.length ?? 0,
  traitAvailabilitySha256: traitAvailabilityJson ? sha(traitAvailabilityJson) : null, liveRosterPath: rosterPath, liveRosterCatalogPath: rosterCatalogPath, publicReferenceSha256: publicReferenceJson ? sha(publicReferenceJson) : null,
  batSpriteModuleSha256: sha(batSprites), batSpriteManifestSha256: sha(batManifestJson),
  batSprites: batVariants.map(({ pngDataUri, ...variant }) => variant), batSpriteAuthority: batManifest.authority,
  selfContained: true, authority: 'Shared Core samples; separate OpenBiomechanics measured-axis research replay' };
await writeFile(output + '.build.json', JSON.stringify(report, null, 2) + '\n');
await writeFile(output + '.bundle-inputs.json', bundleInputManifest);
console.log(JSON.stringify(report, null, 2));
