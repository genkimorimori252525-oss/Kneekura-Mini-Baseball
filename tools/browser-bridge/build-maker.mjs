import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
import vm from 'node:vm';
import {presentationControlsSourceV84} from './presentation-cadence-v84.mjs';

const args = process.argv.slice(2), makerGuidesV85 = args.includes('--maker-guides'), presentationV84 = args.includes('--presentation-v84'), makerRecovery = args.includes('--maker-recovery'), losslessPerformance = args.includes('--lossless-performance'), pitchMenu = args.includes('--pitch-menu'), courseSeasons = args.includes('--course-seasons'), pitchViews = args.includes('--pitch-views'), pitchLibrary = args.includes('--pitch-library'), pitcherWorkbench = args.includes('--pitcher-workbench'), ballDisplayFix = args.includes('--ball-display-fix'), technicalTraits = args.includes('--technical-traits'), equipmentPreview = args.includes('--equipment-preview'), wholeArc = args.includes('--whole-arc'), playerSwingPreview = args.includes('--player-swing-preview'), batOrbit = args.includes('--bat-orbit'), batterComparison = args.includes('--batter-comparison'), ballComparison = args.includes('--ball-comparison'), measuredLibrary = args.includes('--measured-library'), executableTraits = args.includes('--executable-traits'), traitProfiles = executableTraits || args.includes('--traits'), publicAbilities = traitProfiles || args.includes('--public-abilities');
if (ballComparison && !measuredLibrary) throw Error('--ball-comparison requires --measured-library');
if (batterComparison && !ballComparison) throw Error('--batter-comparison requires --ball-comparison');
if (batOrbit && !measuredLibrary) throw Error('--bat-orbit requires --measured-library');
if (playerSwingPreview && !measuredLibrary) throw Error('--player-swing-preview requires --measured-library');
if (wholeArc && (!playerSwingPreview || !batterComparison)) throw Error('--whole-arc requires --player-swing-preview and --batter-comparison');
if (equipmentPreview && (!wholeArc || !publicAbilities)) throw Error('--equipment-preview requires --whole-arc and public abilities');
if (technicalTraits && !equipmentPreview) throw Error('--technical-traits requires --equipment-preview');
if (ballDisplayFix && !technicalTraits) throw Error('--ball-display-fix requires --technical-traits');
if (pitcherWorkbench && !ballDisplayFix) throw Error('--pitcher-workbench requires --ball-display-fix');
if (pitchLibrary && !pitcherWorkbench) throw Error('--pitch-library requires --pitcher-workbench');
if (pitchViews && !pitchLibrary) throw Error('--pitch-views requires --pitch-library');
if (courseSeasons && !pitchLibrary) throw Error('--course-seasons requires --pitch-library');
if (pitchMenu && (!courseSeasons || !pitchViews)) throw Error('--pitch-menu requires --course-seasons and --pitch-views');
if (losslessPerformance && !pitchMenu) throw Error('--lossless-performance requires --pitch-menu');
if (makerGuidesV85 && !presentationV84) throw Error('--maker-guides requires --presentation-v84');
if (presentationV84 && !makerRecovery) throw Error('--presentation-v84 requires --maker-recovery');
if (makerRecovery && !losslessPerformance) throw Error('--maker-recovery requires --lossless-performance');
const inputOverride = name => {
  const options=args.filter(arg=>arg.startsWith('--'+name+'='));
  if(options.length>1||options.some(arg=>!arg.slice(name.length+3)))throw Error('Exactly one nonempty --'+name+'=PATH is required when overriding input');
  return options[0]?.slice(name.length+3);
};
const output = resolve(args.find(arg => !['--public-abilities','--traits','--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides'].includes(arg)
  && !arg.startsWith('--roster=') && !arg.startsWith('--catalog=') && !arg.startsWith('--match-renderer=')) ?? (publicAbilities ? 'outputs/にーくら野球メーカー_公開能力編集版.html' : 'outputs/にーくら野球メーカー_実測スイング版.html'));
const rosterPath = inputOverride('roster') ?? 'docs/demos/live-game-roster-' + (traitProfiles ? 'v3' : publicAbilities ? 'v2' : 'v1') + '.json';
const rosterCatalogPath = inputOverride('catalog') ?? 'docs/demos/live-game-roster-catalog-' + (executableTraits ? 'v4' : traitProfiles ? 'v3' : publicAbilities ? 'v2' : 'v1') + '.json';
const bundlePath = resolve('dist/batting-workbench-core.js');
await mkdir(dirname(bundlePath), { recursive: true });
const bundledBuild = await build({ entryPoints: ['src/integration/browser/workbench-index.ts'], outfile: bundlePath, bundle: true,
  platform: 'browser', format: 'iife', globalName: 'KneekuraBaseballWorkbench', target: ['es2022'],
  legalComments: 'none', minify: false, sourcemap: false, metafile: true });
const uiPath = makerRecovery ? 'docs/demos/baseball-maker-ui-v82.mjs' : 'docs/demos/baseball-maker-ui.mjs';
let [template, core, ui, referenceJson, batSprites, batManifestJson, rosterJson, rosterCatalogJson] = await Promise.all([
  readFile('docs/demos/baseball-maker.html', 'utf8'), readFile(bundlePath, 'utf8'), readFile(uiPath, 'utf8'),
  readFile(measuredLibrary ? 'docs/demos/measured-bat-library-v1.json' : 'docs/demos/measured-bat-motions.json', 'utf8'),
  readFile('docs/demos/bat-length-sprites.mjs', 'utf8'), readFile('docs/demos/assets/bat-lengths/manifest.json', 'utf8'),
  readFile(rosterPath, 'utf8'), readFile(rosterCatalogPath, 'utf8'),
]);
const sha = source => createHash('sha256').update(source).digest('hex');
const templateSourceSha256 = sha(template);
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
if (makerRecovery && ['suggestLiveInternalValueV82', 'suggestWorkbenchInternalValueV82', 'getLiveInternalValueLimitsV82', 'getWorkbenchInternalValueLimitsV82'].some(key => !core.includes(key)))
  throw Error('Maker internal-value recovery API unavailable');
const traitAvailabilityJson = executableTraits ? await readFile('docs/demos/live-trait-availability-' + (pitcherWorkbench ? 'v77' : technicalTraits ? 'v75' : 'v54') + '.json', 'utf8') : null;
const traitAvailability = traitAvailabilityJson ? JSON.parse(traitAvailabilityJson) : null;
if (traitAvailability) {
  if (traitAvailability.version !== (pitcherWorkbench ? 'live_trait_availability_v77' : technicalTraits ? 'live_trait_availability_v75' : 'live_trait_availability_v54') || traitAvailability.authority !== 'CANONICAL_INVENTORY_READ_ONLY_NOT_EXECUTION_INPUT'
    || !Array.isArray(traitAvailability.entries) || !Array.isArray(traitAvailability.supportedFamilyIds)
    || traitAvailability.entries.length !== 119 || new Set(traitAvailability.entries.map(e => e.familyId)).size !== traitAvailability.entries.length)
    throw Error('Canonical trait availability catalog required');
  const realm = {}; vm.runInNewContext(core, realm);
  const actual = (pitcherWorkbench ? realm.KneekuraBaseballWorkbench.getLiveTraitCatalogV77() : realm.KneekuraBaseballWorkbench.getLiveTraitCatalogV1({includeTechnical:technicalTraits})).map(d => d.familyId).sort();
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
const libraryDecoder = measuredLibrary ? await readFile('tools/browser-bridge/measured-bat-library-v1.js', 'utf8') : '';
const swingUi = measuredLibrary ? await readFile('docs/demos/baseball-maker-swing-v68.js', 'utf8') : '';
const helpUi = measuredLibrary ? await readFile('docs/demos/baseball-maker-help-v68.js', 'utf8') : '';
const lightCss = measuredLibrary ? await readFile('docs/demos/baseball-maker-light-v68.css', 'utf8') : '';
const recoveryCssPath = 'docs/demos/baseball-maker-recovery-v82.css';
const recoveryCss = makerRecovery ? await readFile(recoveryCssPath, 'utf8') : '';
if (/<\/style/i.test(recoveryCss)) throw Error('Unexpected closing-style token in maker recovery CSS');
const comparisonUi = ballComparison ? await readFile('docs/demos/baseball-maker-ball-comparison-v69.js', 'utf8') : '';
const comparisonCss = ballComparison ? await readFile('docs/demos/baseball-maker-ball-comparison-v69.css', 'utf8') : '';
const batterUi = batterComparison ? await readFile('docs/demos/baseball-maker-batter-comparison-'+(presentationV84?'v84':losslessPerformance?'v81':'v70')+'.js', 'utf8') : '';
const batterCss = batterComparison ? await readFile('docs/demos/baseball-maker-batter-comparison-v70.css', 'utf8') : '';
const matchAdapter = batterComparison ? await readFile('tools/browser-bridge/maker-match-renderer-'+(presentationV84?'v84':losslessPerformance?'v81':'v70')+'.js', 'utf8') : '';
const pitcherUiPath = 'docs/demos/baseball-maker-pitcher-' + (makerGuidesV85 ? 'v85' : presentationV84 ? 'v84' : makerRecovery ? 'v82' : pitchLibrary ? 'v78' : 'v77') + '.js';
const pitcherUi = pitcherWorkbench ? await readFile(pitcherUiPath, 'utf8') : '',
  pitcherCss = pitcherWorkbench ? await readFile('docs/demos/baseball-maker-pitcher-' + (pitchLibrary ? 'v78' : 'v77') + '.css', 'utf8') : '',
  pitcherAdapter = pitcherWorkbench ? await readFile('tools/browser-bridge/maker-pitcher-renderer-'+(presentationV84?'v84':losslessPerformance?'v81':'v77')+'.js', 'utf8') : '';
let makerMatchHtml = '', makerPitcherHtml = '', matchRendererSourceSha256 = null;
const matchRendererPath = inputOverride('match-renderer') ?? 'docs/demos/releases/v68/game.html';
if (batterComparison) {
  const frozenGame = await readFile(matchRendererPath);
  matchRendererSourceSha256 = sha(frozenGame);
  if (wholeArc) {
    const gameMeta = JSON.parse(await readFile(matchRendererPath + '.build.json', 'utf8'));
    if (gameMeta.sha256 !== matchRendererSourceSha256 || gameMeta.presentationVersion !== (presentationV84 ? 84 : losslessPerformance ? 81 : courseSeasons ? 79 : pitchLibrary ? 78 : pitcherWorkbench ? 77 : ballDisplayFix ? 76 : technicalTraits ? 75 : equipmentPreview ? 74 : 73) || !gameMeta.optionalWholeArcTrajectoryConnected
        || (equipmentPreview && !gameMeta.extendedEquipmentConnected) || (technicalTraits && !gameMeta.technicalTraitsConnected))
      throw Error('Comparison needs the matching verified ordinary-match renderer');
  } else if (matchRendererSourceSha256 !== '8b709ab3c69fc8bdc5f9980a8b66912e0b9b86f73c67970cc1bf9b37cfa6ccbc')
    throw Error('Frozen ordinary-match renderer differs');
  const once = (text, before, after) => {
    if (text.split(before).length !== 2) throw Error('Batter comparison renderer marker differs: ' + before.slice(0, 90));
    return text.replace(before, () => after);
  };
  // Reuse the maker's identical 673-trial library, cloning it into the iframe's
  // realm. The drawing and camera code remain the exact ordinary-match source.
  const gameText = frozenGame.toString('utf8'), dataScript = gameText.match(/<script id="v68-measured-bat-library" type="application\/json">[\s\S]*?<\/script>/)?.[0];
  if (!dataScript) throw Error('Ordinary measured library is missing');
  makerMatchHtml = once(gameText, dataScript, '<script id="v68-measured-bat-library" type="application/json">{"sharedWithMaker":true}</script>');
  makerMatchHtml = once(makerMatchHtml, "measured=window.KneekuraMeasuredBatLibrary.decode($('v68-measured-bat-library').textContent)",
    losslessPerformance ? 'measured=(()=>{const owned=structuredClone(parent.KneekuraReferenceBatMotions);const freeze=v=>{if(v&&typeof v===\'object\'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}};freeze(owned);return owned;})()' : 'measured=structuredClone(parent.KneekuraReferenceBatMotions)');
  if (pitcherWorkbench) makerPitcherHtml = once(makerMatchHtml, '</body>', '<script id="v77-maker-pitcher-renderer">\n' + pitcherAdapter + '\n</script></body>');
  makerMatchHtml = once(makerMatchHtml, '</body>', '<script id="v70-maker-match-renderer">\n' + matchAdapter + '\n</script></body>');
}
const decoderRealm = {};
if (measuredLibrary) vm.runInNewContext(libraryDecoder, decoderRealm);
const referenceData = measuredLibrary ? decoderRealm.KneekuraMeasuredBatLibrary.decode(referenceJson) : JSON.parse(referenceJson);
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
const pitcherViewsPath = 'docs/demos/baseball-maker-pitcher-views-' + (makerGuidesV85 ? 'v85' : 'v78') + '.js';
const pitcherViewsUi = pitchViews ? await readFile(pitcherViewsPath, 'utf8') : '';
const guidesUiPath = 'docs/demos/baseball-maker-guides-v85.js', guidesCssPath = 'docs/demos/baseball-maker-guides-v85.css';
const guidesUi = makerGuidesV85 ? await readFile(guidesUiPath, 'utf8') : '', guidesCss = makerGuidesV85 ? await readFile(guidesCssPath, 'utf8') : '';
if (/<\/script/i.test(guidesUi) || /<\/style/i.test(guidesCss)) throw Error('Unexpected closing token in maker guides');
const pitchMenuUiPath = 'docs/demos/baseball-maker-pitch-menu-' + (makerRecovery ? 'v82' : 'v80') + '.js',
  pitchMenuCssPath = 'docs/demos/baseball-maker-pitch-menu-' + (makerRecovery ? 'v82' : 'v80') + '.css';
const pitchMenuUi = pitchMenu ? await readFile(pitchMenuUiPath, 'utf8') : '',
  pitchMenuCss = pitchMenu ? await readFile(pitchMenuCssPath, 'utf8') : '';
const courseUi = courseSeasons ? await readFile('docs/demos/baseball-maker-course-v79.js', 'utf8') : '',
  courseCss = courseSeasons ? await readFile('docs/demos/baseball-maker-course-v79.css', 'utf8') : '',
  courseCharts = courseSeasons ? await readFile('tools/browser-bridge/course-charts-v79.js', 'utf8') : '',
  seasonClient = courseSeasons ? await readFile('tools/browser-bridge/live-season-client-v79.js', 'utf8') : '';
if ([pitchMenuUi, courseUi, courseCharts, seasonClient, pitcherViewsUi, core, ui, batSprites, libraryDecoder, swingUi, helpUi, comparisonUi, batterUi, matchAdapter, pitcherUi, pitcherAdapter].some(source => /<\/script/i.test(source))) throw Error('Unexpected closing-script token in bundled source');
if (/require\(["']node:|require\(["']fs["']/.test(core)) throw Error('Workbench bundle imports a Node-only module');
for (const marker of ['<!-- WORKBENCH_CORE -->', '<!-- WORKBENCH_REFERENCE -->', '<!-- WORKBENCH_BAT_SPRITES -->', '<!-- WORKBENCH_LIVE_ROSTER -->', '<!-- WORKBENCH_UI -->']) {
  if (!template.includes(marker) || template.indexOf(marker) !== template.lastIndexOf(marker)) throw Error('Workbench template marker differs');
}
if (measuredLibrary) {
  template = template.replace('</head>', () => '<style>\n' + lightCss + '\n' + comparisonCss + '\n' + batterCss + '\n' + pitcherCss + '\n' + courseCss + (pitchMenu ? '\n' + pitchMenuCss : '') + (makerRecovery ? '\n' + recoveryCss : '') + '\n</style></head>');
  template = template.replace('にーくら野球メーカー</title>', 'にーくら野球メーカー v' + (makerGuidesV85 ? 85 : presentationV84 ? 84 : makerRecovery ? 82 : losslessPerformance ? 81 : pitchMenu ? 80 : courseSeasons ? 79 : pitchViews ? '78.1' : pitchLibrary ? 78 : pitcherWorkbench ? 77 : ballDisplayFix ? 76 : technicalTraits ? 75 : equipmentPreview ? 74 : wholeArc ? 73 : playerSwingPreview ? 72 : batOrbit ? 71 : batterComparison ? 70 : ballComparison ? 69 : 68) + '</title>');
}
const presentationBridgePath = 'tools/browser-bridge/maker-presentation-bridge-v84.js';
const presentationBridge = presentationV84 ? await readFile(presentationBridgePath, 'utf8') : '';
if (presentationV84) template = template.replace('</head>', () => '<script>' + presentationControlsSourceV84 + '\n' + presentationBridge + '</script></head>');
if (makerGuidesV85) template = template.replace('</head>', () => '<style>\n' + guidesCss + '\n</style></head>');
const referenceInline = measuredLibrary ? libraryDecoder + '\n;globalThis.KneekuraReferenceBatMotions=KneekuraMeasuredBatLibrary.decode('
  + JSON.stringify(referenceJson).replace(/</g, '\\u003c') + ');' : 'globalThis.KneekuraReferenceBatMotions=' + JSON.stringify(referenceData).replace(/</g, '\\u003c') + ';';
const html = template.replace('<!-- WORKBENCH_CORE -->', () => '<script>\n' + core + '\n</script>')
  .replace('<!-- WORKBENCH_REFERENCE -->', () => '<script>' + referenceInline + '</script>')
  .replace('<!-- WORKBENCH_BAT_SPRITES -->', () => '<script>globalThis.KneekuraBatLengthSpriteData=' + JSON.stringify(batSpriteData).replace(/</g, '\\u003c') + ';\n' + batSprites + '\n</script>')
  .replace('<!-- WORKBENCH_LIVE_ROSTER -->', () => '<script>globalThis.KneekuraLiveGameRosterData=' + JSON.stringify(liveRoster).replace(/</g, '\\u003c')
    + ';globalThis.KneekuraLiveGameRosterCatalog=' + JSON.stringify(liveRosterCatalog).replace(/</g, '\\u003c')
    + (publicReference ? ';globalThis.KneekuraLivePublicAbilityReference=' + JSON.stringify(publicReference).replace(/</g, '\\u003c') : '')
    + (traitAvailability ? ';globalThis.KneekuraLiveTraitAvailabilityCatalog=' + JSON.stringify(traitAvailability).replace(/</g, '\\u003c') : '') + ';</script>')
  .replace('<!-- WORKBENCH_UI -->', () => '<script>\n' + (wholeArc ? 'globalThis.KneekuraWholeArcTrajectoryEnabled=true;\n' : '')
    + (technicalTraits ? 'globalThis.KneekuraTechnicalTraitsV75=true;\n' : '')
    + (pitcherWorkbench ? 'globalThis.KneekuraIndependentTraitsV77=true;\n' : '')
    + (pitchLibrary ? 'globalThis.KneekuraPitcherWorkbenchV78=true;\n' : '')
    + (equipmentPreview ? 'globalThis.KneekuraPlayerEquipmentPreviewEnabled=true;\nglobalThis.KneekuraBallComparisonLayoutV74=true;\n' : '')
    + (playerSwingPreview ? 'globalThis.KneekuraPlayerSwingPreviewEnabled=true;\n' : '')
    + ui + '\n' + swingUi + '\n' + comparisonUi + '\n'
    + (batterComparison ? 'globalThis.KneekuraMakerMatchHtmlV70=' + JSON.stringify(makerMatchHtml).replace(/</g, '\\u003c') + ';\n' : '')
    + batterUi + '\n' + helpUi
    + (pitcherWorkbench ? '\nglobalThis.KneekuraMakerPitcherMatchHtmlV77=' + JSON.stringify(makerPitcherHtml).replace(/</g, '\\u003c') + ';\n' + pitcherUi : '')
    + (pitchViews ? '\n' + pitcherViewsUi : '')
    + (courseSeasons ? '\n' + seasonClient + '\n' + courseCharts + '\n' + courseUi : '')
    + (pitchMenu ? '\n' + pitchMenuUi : '')
    + (measuredLibrary ? '\nKneekuraMakerHelp.install();' : '')
    + (makerGuidesV85 ? '\n' + guidesUi + '\nKneekuraMakerGuidesV85.install();' : '') + '\n</script>');
if (Buffer.byteLength(html) >= 100_000_000) throw Error('Maker HTML exceeds GitHub single-file limit');
const makerRecoverySources = makerRecovery ? { [uiPath]: sha(ui), [pitcherUiPath]: sha(pitcherUi), [pitchMenuUiPath]: sha(pitchMenuUi),
  [pitchMenuCssPath]: sha(pitchMenuCss), [recoveryCssPath]: sha(recoveryCss),
  'src/integration/browser/MakerValueRecoveryV82.ts': bundleInputs['src/integration/browser/MakerValueRecoveryV82.ts'] } : null;
if (makerRecoverySources && Object.values(makerRecoverySources).some(value => typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)))
  throw Error('Maker recovery source pin unavailable');
await mkdir(dirname(output), { recursive: true }); await writeFile(output, html);
const report = { ...(makerGuidesV85 ? {makerGuidesVersion:85,unspunComparisonDefault:false,makerGuideSources:{[guidesUiPath]:sha(guidesUi),[guidesCssPath]:sha(guidesCss),[pitcherUiPath]:sha(pitcherUi),[pitcherViewsPath]:sha(pitcherViewsUi)}} : {}), ...(presentationV84 ? { presentationVersion:84, presentationControlsVersion:84, frequencyScale:2, qualityScale:1.2, pitchFrequencyMultiplier:2.5, battedFrequencyMultiplier:2, presentationBridgeSha256:sha(presentationBridge) } : {}), ...(makerRecovery ? { makerRecoveryVersion: 82, makerRecoverySources } : {}), ...(losslessPerformance ? {losslessPerformanceVersion:81,fullMeasuredCatalogPreserved:true,fullSceneCadence:true} : {}), ...(pitchMenu ? { pitchMenu: true, pitchMenuUiSha256: sha(pitchMenuUi), pitchMenuCssSha256: sha(pitchMenuCss) } : {}), ...(courseSeasons ? { courseSeasons: true, courseUiSha256: sha(courseUi), courseCssSha256: sha(courseCss), courseChartsSha256: sha(courseCharts), seasonClientSha256: sha(seasonClient) } : {}), ...(pitchViews ? { pitchViews: true, pitchViewsUiSha256: sha(pitcherViewsUi) } : {}), output, bytes: Buffer.byteLength(html), sha256: sha(html), coreSha256: sha(core), uiSha256: sha(ui),
  bundleInputCount: Object.keys(bundleInputs).length, bundleInputManifestSha256: sha(bundleInputManifest),
  templateSha256: templateSourceSha256, renderedTemplateSha256: sha(template), referenceSha256: sha(referenceJson), referenceClips: referenceData.clips.length,
  liveRosterSha256: sha(rosterJson), liveRosterCatalogSha256: sha(rosterCatalogJson), gamePlayers: liveRoster.entries.length,
  publicAbilities, traitProfiles, executableTraits, measuredLibrary, libraryDecoderSha256: measuredLibrary ? sha(libraryDecoder) : null,
  ballComparison, comparisonUiSha256: ballComparison ? sha(comparisonUi) : null, comparisonCssSha256: ballComparison ? sha(comparisonCss) : null,
  batterComparison, batterUiSha256: batterComparison ? sha(batterUi) : null, batterCssSha256: batterComparison ? sha(batterCss) : null,
  batOrbit, playerSwingPreview, wholeArc, equipmentPreview, technicalTraits, ballDisplayFix, pitcherWorkbench, pitchLibrary, independentTraits: pitcherWorkbench, comparisonLayoutVersion: equipmentPreview ? 74 : null,
  matchRendererAdapterSha256: batterComparison ? sha(matchAdapter) : null, matchRendererSourceSha256, matchRendererSourcePath: batterComparison ? matchRendererPath : null,
  embeddedMatchRendererSha256: batterComparison ? sha(makerMatchHtml) : null,
  pitcherUiSha256: pitcherWorkbench ? sha(pitcherUi) : null, pitcherCssSha256: pitcherWorkbench ? sha(pitcherCss) : null,
  pitcherAdapterSha256: pitcherWorkbench ? sha(pitcherAdapter) : null, embeddedPitcherRendererSha256: pitcherWorkbench ? sha(makerPitcherHtml) : null,
  swingUiSha256: measuredLibrary ? sha(swingUi) : null, helpUiSha256: measuredLibrary ? sha(helpUi) : null,
  lightCssSha256: measuredLibrary ? sha(lightCss) : null, traitCatalogFamilies: traitAvailability?.entries.length ?? 0,
  traitAvailabilitySha256: traitAvailabilityJson ? sha(traitAvailabilityJson) : null, liveRosterPath: rosterPath, liveRosterCatalogPath: rosterCatalogPath, publicReferenceSha256: publicReferenceJson ? sha(publicReferenceJson) : null,
  batSpriteModuleSha256: sha(batSprites), batSpriteManifestSha256: sha(batManifestJson),
  batSprites: batVariants.map(({ pngDataUri, ...variant }) => variant), batSpriteAuthority: batManifest.authority,
  selfContained: true, authority: 'Shared Core samples; separate OpenBiomechanics measured-axis research replay' };
await writeFile(output + '.build.json', JSON.stringify(report, null, 2) + '\n');
await writeFile(output + '.bundle-inputs.json', bundleInputManifest);
console.log(JSON.stringify(report, null, 2));
