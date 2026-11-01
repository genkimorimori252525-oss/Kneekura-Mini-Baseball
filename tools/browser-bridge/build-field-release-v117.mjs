import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Script} from 'node:vm';
import {applyBackgroundMatchV116} from './background-match-v116.mjs';
import {athleticPresentationChangesV115} from './athletic-body-presentation-v115.mjs';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';
import {shareAudioBankV100,patchPracticeAudioV100,patchComparisonAudioV100,transformEmbedded} from './scoring-audio-presentation-v100.mjs';

assert.equal(process.argv.length,3,'Usage: node tools/browser-bridge/build-field-release-v117.mjs <new-candidate-directory>');
const out=resolve(process.argv[2]),sourceRoot=resolve('../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(dirname(out),sourceRoot,'The new candidate directory must be a direct child of outputs');
const names={game:'ばせぼーるlv117_TBD_vs_LAD_際どい打球の捕球試行版.html',maker:'にーくら野球メーカー_v117_際どい打球の捕球試行版.html',lab:'カメラワーク調整室_v117_際どい打球の捕球試行版.html'},
 gamePath=resolve(out,names.game),makerPath=resolve(out,names.maker),
 source=resolve(sourceRoot,'ばせぼーるlv114_TBD_vs_LAD_顔写真枠試作版.html'),
 manifestSource=resolve(sourceRoot,'ばせぼーるlv113_TBD_vs_LAD_守備追球と生成改善版.html'),
 sourceSha256='c6f32e13eb34a3545a178b1d40db92d58ac794732d224af5ad97b37133d77a71',
 v113GameSha256='aab69cc021aa07958a65982a70b480609adbf241df291a5c857c7abe390f6205',
 oldCoreSha256='3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37',
 legacyCoreSha256V111='7d71db66c9dad924ad3628bdd644b965fba1c79f901c89e3cb4f0009eef6d0ab',
 cameraSha256='11bc1872a99db3574d370a2d3b60500eea67d9c7f3313ecc19b22156308b8981',
 controlsSuffixSha256='cd018494d3682ec6ab64fd709f1e68b3c529ed2410c10815418a9fb8fe3e80e8',
 actionPath='src/core/sim/fielding/LiveFielderBodyGeometryV105.ts',
 rosterPath='docs/demos/live-game-roster-v98.json',catalogPath='docs/demos/live-game-roster-catalog-v105.json',
 templatePath='tools/browser-bridge/camera-workbench-v81.html',driverPath='tools/browser-bridge/camera-workbench-v84.js';
const cache=new Map(),sourceSnapshot={};
async function input(path){
 if(!cache.has(path)){const bytes=await readFile(path);cache.set(path,bytes);sourceSnapshot[path]=sha(bytes);}
 return cache.get(path);
}
const textInput=async path=>(await input(path)).toString('utf8');
function once(text,before,after,label=before.slice(0,80)){
 const at=text.indexOf(before);assert(at>=0,'V115 missing seam: '+label);
 assert.equal(text.indexOf(before,at+before.length),-1,'V115 unique seam: '+label);
 return text.slice(0,at)+after+text.slice(at+before.length);
}
const encode=value=>JSON.stringify(value).replaceAll('<','\\u003c');
const scripts=html=>[...html.matchAll(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi)].map(m=>({tag:m[1],body:m[2],close:m[3]}));
const coreScript=s=>s.body.includes('var KneekuraNativeMatchCore =');
function findScript(html,tag){const matches=scripts(html).filter(s=>s.tag===tag);assert.equal(matches.length,1,tag);return matches[0];}
function checkSyntax(html,label){
 const found=scripts(html);for(let i=0;i<found.length;i++)if(!/\btype\s*=\s*["']application\/json["']/i.test(found[i].tag))
  new Script(found[i].body,{filename:label+' script '+i});
 return {scriptCount:found.length,parsedJavaScript:true};
}
function embedded(html,key){
 const lead='globalThis.'+key+'=',at=html.indexOf(lead);assert(at>=0,key);assert.equal(html.indexOf(lead,at+lead.length),-1,key+' unique');
 const start=at+lead.length;assert.equal(html[start],'"',key+' JSON string');let end=start+1;
 for(;end<html.length;end++){if(html[end]==='\\')end++;else if(html[end]==='"')break;}
 assert(end<html.length,key+' closed JSON string');return JSON.parse(html.slice(start,end+1));
}
function run(args){const result=spawnSync(process.execPath,args,{stdio:'inherit'});if(result.error)throw result.error;assert.equal(result.status,0,args[0]);}
async function sourceFiles(dir){
 const entries=await readdir(dir,{withFileTypes:true}),files=[];
 for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,entry.name).replaceAll('\\','/');
  if(entry.isDirectory())files.push(...await sourceFiles(path));else if(entry.isFile()&&/\.(?:ts|js|mjs)$/.test(entry.name))files.push(path);
 }
 return files;
}

// Capture source bytes before either compiler starts. Later checks reject a
// mixed build if another process edits an input while this release is running.
const uiPaths={pitcher:'docs/demos/baseball-maker-pitcher-v92.js',menu:'docs/demos/baseball-maker-pitch-menu-v82.js',arrows:'docs/demos/baseball-maker-pitch-arrows-v89.js',movement:'docs/demos/baseball-maker-pitch-movement-v92.js'},
 practicePaths=['tools/browser-bridge/maker-field-practice-v98.html','tools/browser-bridge/maker-field-practice-v98.css','tools/browser-bridge/field-practice-renderer-v98.js','tools/browser-bridge/field-workbench-v98.js'],
 builderPaths=['tools/browser-bridge/build-field-release-v117.mjs','src/core/sim/fielding/__fixtures__/first-ground-v117.json','tools/browser-bridge/background-match-v116.js','tools/browser-bridge/background-match-v116.mjs','tools/browser-bridge/build-native.mjs','tools/browser-bridge/build-maker.mjs','tools/browser-bridge/maker-layout-v112.mjs','docs/demos/baseball-maker-layout-v112.js','docs/demos/baseball-maker-layout-v112.css','tools/browser-bridge/pitch-hand-ui-v97.mjs','tools/browser-bridge/scoring-audio-presentation-v100.mjs',templatePath,driverPath,...practicePaths,
  'tools/browser-bridge/field-relationships-v99.js','tools/browser-bridge/live-field-gaze-v99.js','tools/browser-bridge/fielder-body-presentation-v105.js','tools/browser-bridge/athletic-body-presentation-v115.js','tools/browser-bridge/athletic-body-presentation-v115.mjs','tools/browser-bridge/field-gaze-controls-v99.js','tools/browser-bridge/live-field-camera.js',rosterPath,catalogPath],
 makerSourcePaths=['docs/demos/baseball-maker.html','docs/demos/baseball-maker-ui-v94.mjs','docs/demos/measured-bat-library-v1.json','docs/demos/bat-length-sprites.mjs','docs/demos/assets/bat-lengths/manifest.json',
  'docs/demos/assets/bat-lengths/bat-78cm.png','docs/demos/assets/bat-lengths/bat-84cm.png','docs/demos/assets/bat-lengths/bat-90cm.png','docs/demos/live-public-ability-reference-v1.json','docs/demos/live-trait-availability-v77.json',
  'tools/browser-bridge/measured-bat-library-v1.js','docs/demos/baseball-maker-swing-v86.js','docs/demos/baseball-maker-help-v68.js','docs/demos/baseball-maker-light-v68.css','docs/demos/baseball-maker-recovery-v82.css',
  'docs/demos/baseball-maker-ball-comparison-v69.js','docs/demos/baseball-maker-ball-comparison-v69.css','docs/demos/baseball-maker-batter-comparison-v84.js','docs/demos/baseball-maker-batter-comparison-v70.css',
  'tools/browser-bridge/maker-match-renderer-v94.js','docs/demos/baseball-maker-pitcher-v78.css','tools/browser-bridge/maker-pitcher-renderer-v94.js','docs/demos/baseball-maker-pitcher-views-v94.js',
  'docs/demos/baseball-maker-batting-setup-v94.js','docs/demos/baseball-maker-batting-setup-v94.css','tools/browser-bridge/live-pitcher-body-head-view-v77.js','docs/demos/baseball-maker-pitch-movement-v92.css',
  'docs/demos/baseball-maker-editor-v90.js','docs/demos/baseball-maker-editor-v90.css','docs/demos/baseball-maker-guides-v85.js','docs/demos/baseball-maker-guides-v85.css','docs/demos/baseball-maker-validation-v86.js',
  'docs/demos/baseball-maker-validation-v86.css','docs/demos/baseball-maker-pitch-menu-v82.css','docs/demos/baseball-maker-course-v87.js','docs/demos/baseball-maker-course-v87.css','tools/browser-bridge/course-charts-v87.js',
  'tools/browser-bridge/live-season-client-v79.js','tools/browser-bridge/maker-presentation-bridge-v84.js','tools/browser-bridge/presentation-cadence-v84.mjs','docs/demos/mlb-2025-course-reference-v87.json',...Object.values(uiPaths)];
const sourceCodePaths=await sourceFiles('src');
for(const path of [...new Set([...builderPaths,...makerSourcePaths,...sourceCodePaths])].sort())await input(path);
assert(sourceSnapshot[actionPath],'The shared V105 body model is required');

const baseBytes=await input(source),base=baseBytes.toString('utf8'),prior=JSON.parse(await textInput(source+'.build.json')),
 frozenPinsBytes=await input(manifestSource+'.bundle-inputs.json'),frozenPins=JSON.parse(frozenPinsBytes),audioManifestBytes=await input(manifestSource+'.audio-manifest.json'),
 v113Metadata=JSON.parse(await textInput(manifestSource+'.build.json'));
assert.equal(sha(baseBytes),sourceSha256,'Frozen V114 right portrait game');assert.equal(prior.sha256,sourceSha256,'Frozen V114 metadata');
assert.equal(prior.portraitPlacementV114,'right');assert.equal(prior.portraitSlotsPreviewV114,true);
assert.equal(prior.portraitSourceGameV113.sha256,v113GameSha256);
assert.equal(sha(await input(manifestSource)),v113GameSha256,'Frozen V113 source game');
assert.equal(v113Metadata.sha256,v113GameSha256);assert.equal(v113Metadata.sourceCoreSha256,oldCoreSha256);
assert.equal(prior.sourceCoreSha256,oldCoreSha256);assert.equal(frozenPins.entrySha256,oldCoreSha256);
assert.equal(sha(frozenPinsBytes),prior.frozenSourceManifestSha256);assert.equal(sha(frozenPinsBytes),v113Metadata.frozenSourceManifestSha256);
assert.equal(sha(audioManifestBytes),prior.audioPackManifestSha256);assert.equal(sha(audioManifestBytes),v113Metadata.audioPackManifestSha256);
for(const [name,expected,version,expectedCore]of [
 ['ばせぼーるlv111_TBD_vs_LAD_制球とカウント配球版.html','eeded1571556cea2292e93168fdf10b2bf4860e0336d629862c5610ac49aaa90',111,legacyCoreSha256V111],
 ['にーくら野球メーカー_v112_画面整理版.html','0531c7bef3afa2b8ec32e620ac1a3bfd0224738b928eeec6813c98256ccb0edf',112,legacyCoreSha256V111],
 ['カメラワーク調整室_v111_制球とカウント配球版.html','290a38daa6f3893ffc1787c3ab0338db6000709a2bec8368c7972d379f10ac4f',111,legacyCoreSha256V111],
 ['にーくら野球メーカー_v113_守備追球と生成改善版.html','ffb1d1588eb551764bc406f21c8367b83d5f49063e70e1a4bdecd2bc0896a006',113,oldCoreSha256],
 ['カメラワーク調整室_v113_守備追球と生成改善版.html','cdea12bb3048274da6f9b5280219ca68ed003ae46cdddac4354030c0a38caba4',113,oldCoreSha256]
]){
 const path=resolve(sourceRoot,name),bytes=await input(path),metadata=JSON.parse(await textInput(path+'.build.json'));
 // Sibling documents are protected inputs, not reconstruction templates.
 assert.equal(sha(bytes),expected,'Frozen sibling '+name);assert.equal(metadata.sha256,expected,name+' metadata');
 assert.equal(metadata.releaseVersion,version,name+' version');
 assert.equal(metadata.sourceCoreSha256,expectedCore,name+' core');
}
// V117 changes the willingness to attempt a nearby ball. Preserve the complete
// published V116 documents and its background runtime independently of the
// older V114 presentation reconstruction and V113 physical-kernel baseline.
const preservedV116CoreSha256='d161ca30db598bd8eb3ee335b6b09446f7c69a7a0637ea4a16d35d16000244fe',
 preservedV116Artifacts={
  'ばせぼーるlv116_TBD_vs_LAD_動作検証と先読み生成版.html':'427605f40a1013f80c2fe98dafe7456d8b0be40ae39cf5e0e6afa1dab1ea3ce7',
  'にーくら野球メーカー_v116_動作検証と先読み生成版.html':'32e941137ab48cc820a5a9b1d8189768725a0b5b3c81292e884eb634625b9928',
  'カメラワーク調整室_v116_動作検証と先読み生成版.html':'a652d57649b634ed00e17d975ed927f0e0cbf253f0dfb692aeb2e63bcda3c2b3'},
 preservedBackgroundV116={
  'tools/browser-bridge/background-match-v116.js':'f0b6b80570ebc3ba04ec36cd70b00c945f7b44c4d38abc0f2e0ea4e379007ed3',
  'tools/browser-bridge/background-match-v116.mjs':'4bb3c816f36d8762b3ec981f6015cd2618fc9738329901ee54c1204f292f454a'};
for(const [name,expected]of Object.entries(preservedV116Artifacts)){
 const path=resolve(sourceRoot,name);assert.equal(sha(await readFile(path)),expected,'Frozen V116 '+name);
 // Do not retain another full copy of each large HTML in the builder cache.
 sourceSnapshot[path]=expected;
}
const v116PinBytes=await input(resolve(sourceRoot,'ばせぼーるlv116_TBD_vs_LAD_動作検証と先読み生成版.html.bundle-inputs.json')),
 v116Pins=JSON.parse(v116PinBytes);
assert.equal(sha(v116PinBytes),'70e52ac98c2cb48ccc57ba05e2eba3371b6869902923c14b2faba7cbf952a8fd','Frozen V116 native manifest');
assert.equal(v116Pins.entrySha256,preservedV116CoreSha256);
for(const [path,expected]of Object.entries(preservedBackgroundV116))assert.equal(sourceSnapshot[path],expected,'Unchanged V116 background helper '+path);
const sourceScripts=scripts(base),oldCoreScripts=sourceScripts.filter(coreScript);assert.equal(oldCoreScripts.length,1);
assert.equal(sha(oldCoreScripts[0].body.slice(0,-1)),oldCoreSha256,'Frozen embedded core');
assert.equal(sha(findScript(base,'<script id="v36-field-camera">').body.slice(0,-1)),cameraSha256);
assert.equal(sourceSnapshot['tools/browser-bridge/live-field-camera.js'],cameraSha256,'Camera helper source');
// V115 adds authored physical field/runner actions and fixes uncertified runner
// forecasts. Keep the existing pitch policy, Source physics and adjudication;
// presentation reads Source poses using the original PNG/palette/lattice.
// The V114 right portrait is protected by exact reversible changes below.
const frozenGaze=findScript(base,'<script id="field-gaze-v99">').body,
 gazeSource=await textInput('tools/browser-bridge/live-field-gaze-v99.js'),controls=await textInput('tools/browser-bridge/field-gaze-controls-v99.js'),
 bodyPresentation=await textInput('tools/browser-bridge/fielder-body-presentation-v105.js'),
 athleticPresentation=await textInput('tools/browser-bridge/athletic-body-presentation-v115.js'),
 frozenExpectedGaze=gazeSource+'\n'+bodyPresentation+'\n'+controls+'\n',effectiveGaze=frozenExpectedGaze+athleticPresentation+'\n';
assert.equal(frozenGaze,frozenExpectedGaze,'Frozen V114 complete gaze and body presentation');
assert.equal(sha(controls+'\n'),controlsSuffixSha256);
const effectiveCatalog=JSON.parse(await textInput(catalogPath)),frozenCatalog=findScript(base,'<script id="v40-roster-catalog" type="application/json">').body;
const portraitStyle=base.match(/<style id="player-portrait-slots-v114">[\s\S]*?<\/style>/g)??[],
 portraitSlots=[...base.matchAll(/<span id="(?:pitcher|batter)-portrait"[\s\S]*?<\/span>/g)].map(m=>m[0]);
assert.equal(portraitStyle.length,1,'One frozen right portrait stylesheet');assert.equal(portraitSlots.length,2,'Two frozen portrait slots');
const requirePortraits=html=>{for(const block of [...portraitStyle,...portraitSlots]){
 assert.equal(html.split(block).length,2,'Exact unique V114 portrait block preserved');
}};
const audioRuntime=findScript(base,'<script id="audio-runtime-v100">').body,audioBank=findScript(base,'<script id="audio-bank-v100">').body,
 bankPrefix='globalThis.KneekuraAudioPackV100=';
assert(audioBank.startsWith(bankPrefix)&&audioBank.endsWith(';'),'Frozen audio-bank assignment');
const pack=JSON.parse(audioBank.slice(bankPrefix.length,-1));assert.equal(sha(audioRuntime),prior.audioRuntimeSha256);

// Never reuse a candidate directory, and never let build-maker write a final
// release file. Its ordinary writes are confined to this newly created stage.
await mkdir(out);const makerStage=resolve(out,'_fresh-maker-v117');await mkdir(makerStage);
run(['tools/browser-bridge/build-native.mjs']);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinBytes);
assert.equal(sha(core),pins.entrySha256);assert(pins.inputs[actionPath],'v103 action missing from native bundle');
for(const path of ['src/core/sim/fielding/LiveReceiverArrivalV106.ts','src/core/sim/fielding/LiveDoublePlayDecisionV106.ts'])assert(pins.inputs[path],'V106 common tactical helper missing: '+path);
assert.equal(Object.keys(frozenPins.inputs).length,157,'Frozen V113 native input count');
const newNativePaths=['src/core/sim/LiveAthleticControlsV115.ts','src/core/sim/fielding/LiveFielderAthleticV115.ts','src/core/sim/running/LiveRunnerSlideV115.ts'];
assert.equal(Object.keys(pins.inputs).length,160,'V115 adds three physical action modules');
assert.deepEqual(Object.keys(pins.inputs).filter(path=>!Object.hasOwn(frozenPins.inputs,path)).sort(),[...newNativePaths].sort(),'Only the three declared new native modules');
assert(Object.keys(frozenPins.inputs).every(path=>Object.hasOwn(pins.inputs,path)),'No frozen native module removed');
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(hash,sourceSnapshot[path],'Native source snapshot '+path);
const allowedNativeChanges=new Set([...newNativePaths,'src/core/sim/fielding/LiveThrowPhysicalMemoV113.ts','src/core/sim/fielding/LiveThrowPlanV1.ts','src/core/sim/fielding/LiveRelayPlanV1.ts','src/core/sim/fielding/LiveDefenseControlEstimateV95.ts','src/core/sim/fielding/LiveFieldPlayV1.ts',
 'src/core/sim/running/LiveRunnerMotionV1.ts','src/integration/browser/LiveBaseballMatchV1.ts','src/integration/browser/LiveFieldFrameConversionV98.ts',
 'src/integration/browser/LiveFieldInputV95.ts','src/integration/browser/LivePhysicalRosterV1.ts','src/integration/browser/LiveTraitProfilesV1.ts','src/integration/browser/FieldPracticeWorkbenchV98.ts','src/integration/browser/index.ts']),
 nativeChanges=Object.keys({...frozenPins.inputs,...pins.inputs}).filter(path=>frozenPins.inputs[path]!==pins.inputs[path]);
for(const path of nativeChanges)assert(allowedNativeChanges.has(path),'Unexpected native change from frozen V113: '+path);
assert.equal(Object.keys(v116Pins.inputs).length,160,'Frozen V116 native input count');
assert.deepEqual(Object.keys(pins.inputs).sort(),Object.keys(v116Pins.inputs).sort(),'V117 adds/removes no native modules');
const allowedV117NativeChanges=new Set(['src/core/sim/fielding/LiveFieldPlayV1.ts','src/integration/browser/LiveTraitProfilesV1.ts',
 'src/integration/browser/LiveFieldInputV95.ts','src/integration/browser/LiveBaseballMatchV1.ts','src/integration/browser/FieldPracticeWorkbenchV98.ts']),
 nativeChangesFromV116=Object.keys(pins.inputs).filter(path=>pins.inputs[path]!==v116Pins.inputs[path]);
for(const path of nativeChangesFromV116)assert(allowedV117NativeChanges.has(path),'Unexpected native change from frozen V116: '+path);
let game=base;const presentationChanges=[];
function patch(from,to,label){game=once(game,from,to,label);presentationChanges.push({from,to,label});}
patch(oldCoreScripts[0].body,core+'\n','fresh native Core');
patch('<title>ばせぼーる lv114 顔写真枠試作版</title>','<title>にーくらMINIbaseball v117 際どい打球の捕球試行</title>','game title');
patch('TBD対LAD 守備追球と生成改善版 113','TBD対LAD 際どい打球の捕球試行版 117','game edition label');
const athleticKeys=['fieldJumpHeightMetersV115','fieldDivePushMpsV115','fieldDiveRecoverySecondsV115','fieldJumpRecoverySecondsV115',
 'runSlideReachMetersV115','runHeadSlideExtraMetersV115','runSlideRecoverySecondsV115','runHeadSlideRecoverySecondsV115','runHeadSlidePreferenceV115','runSlideFrictionScaleV115'];
assert.equal(effectiveCatalog.fields.filter(f=>athleticKeys.includes(f.path)).length,10,'Exactly ten authored athletic controls');
assert.equal(encode({...effectiveCatalog,fields:effectiveCatalog.fields.filter(f=>!athleticKeys.includes(f.path))})+'\n',frozenCatalog,'All pre-V115 catalog fields and players unchanged');
patch(frozenCatalog,encode(effectiveCatalog)+'\n','ten optional athletic catalog controls');
patch(frozenGaze,effectiveGaze,'append read-only Source athletic PNG runtime');
for(const change of athleticPresentationChangesV115())patch(change.before,change.after,change.label);
const nextScripts=scripts(game),preservedPresentationScripts=[],authorizedPresentationChangesV115=[];assert.equal(nextScripts.length,sourceScripts.length);
for(let i=0;i<sourceScripts.length;i++){
 const before=sourceScripts[i],after=nextScripts[i];assert.equal(after.tag,before.tag);assert.equal(after.close,before.close);
 if(after.body===before.body){preservedPresentationScripts.push({index:i,tag:before.tag,sha256:sha(before.body),bytes:Buffer.byteLength(before.body)});continue;}
 let expected=before.body;const labels=[];for(const change of presentationChanges)if(expected.includes(change.from)){expected=once(expected,change.from,change.to,change.label);labels.push(change.label);}
 assert(labels.length>0,'Every changed script has an enumerated Source/pose seam');assert.equal(after.body,expected,'Only authorized Source/pose changes in '+before.tag);
 authorizedPresentationChangesV115.push({index:i,tag:before.tag,labels,beforeSha256:sha(before.body),afterSha256:sha(after.body)});
}
let reverse=game;for(const change of [...presentationChanges].reverse())reverse=once(reverse,change.to,change.from,'reverse '+change.label);
assert.equal(reverse,base,'Exact reverse reconstruction to V114 right portrait baseline');
requirePortraits(game);
const synchronousWorkbenchGameV116=game;
game=applyBackgroundMatchV116(game,await textInput('tools/browser-bridge/background-match-v116.js'));
requirePortraits(game);
const historicalSourceMapsV114=Object.fromEntries(Object.entries(prior).filter(([key])=>key.endsWith('Sources')||key==='helpers')),
 inherited=Object.fromEntries(Object.entries(prior).filter(([key])=>!key.endsWith('Sources')&&key!=='helpers')),
 v115Sources=Object.fromEntries(builderPaths.map(path=>[path,sourceSnapshot[path]])),
 meta={...inherited,releaseVersion:117,backgroundGenerationVersion:116,backgroundLookAhead:12,backgroundWarmup:4,athleticRecoveryPredictionVersion:116,compactVerificationMemoVersion:116,fieldVersion:115,fieldInputFactoryVersion:115,fieldDecisionVersion:117,fieldPracticeVersion:115,fieldPresentationVersion:115,cameraPresentationVersion:105,
  throwEffortVersion:103,scoringVersion:100,audioVersion:100,cameraOnlyV102:false,cameraOnlyV104:false,cameraOnlyV115:false,firstBaseAttemptVersion:108,earlyPreparationVersion:110,gloveTossVersion:110,bodyTurnMultiplierV110:2,receiverTimedThrowVersion:109,receiverArrivalVersion:106,doublePlayDecisionVersion:107,groundReceptionVersion:107,bodyModelVersion:105,crouchVersion:105,
  pitchTargetPlanVersion:111,pitchCommandPolicyChanged:false,sourceCoreChanged:true,worldBehaviorChanged:true,worldPhysicsRulesAiChanged:true,nativeDefenderMotionChanged:true,embeddedMetadataFrozenFromV103:false,
  throwCommandTimingAndOutputChanged:true,throwRecoveryBoundaryV115:true,ballPhysicsKernelChanged:false,adjudicationRulesChanged:false,
  exactPhysicsMemoVersion:113,sourceFreeBallAdvanceReuseVersion:113,nearPursuitAttemptVersion:117,seamValidationOptimizationVersion:113,runnerUnobservedSeamPredictionVersion:113,throwComparisonReleaseSeparationVersion:113,physicsNumericalIntegrationChanged:false,
  makerLayoutVersion:112,publicAbilityPolicyChanged:false,athleticActionVersion:115,athleticPresentationVersion:115,runnerHandUncertaintyVersion:115,
  athleticPresentationSourceSha256:sha(athleticPresentation),portraitSlotsPreservedV114:true,portraitPlacementV114:'right',
  preservedPortraitStyleSha256:sha(portraitStyle[0]),preservedPortraitSlotSha256:portraitSlots.map(sha),
  historicalSourceMapsV114,sourceReleaseMetadataV114:prior,v115Sources,effectiveSources:v115Sources,builderSha256:sourceSnapshot['tools/browser-bridge/build-field-release-v117.mjs'],
  basePresentationPath:source,basePresentationSha256:sourceSha256,sourceGamePath:gamePath,sourceGameSha256:sha(game),
  catalogSha256:sourceSnapshot[catalogPath],catalogPath,effectiveEmbeddedCatalogSha256:sha(encode(effectiveCatalog)+'\n'),
  sourceCoreSha256:sha(core),compatibleSessionCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,sourceInputCount:Object.keys(pins.inputs).length,
  frozenSourceManifestSha256:sha(pinBytes),sourceInputCaptureMode:'PRE_BUILD_SNAPSHOT_VERIFIED_AGAINST_NATIVE_AND_MAKER_INPUTS_AND_POST_BUILD_FILES',
  preservedV113SourceCoreSha256:oldCoreSha256,preservedV111SourceCoreSha256:legacyCoreSha256V111,
  preservedV116CoreSha256,preservedV116Artifacts,preservedBackgroundV116,nativeChangesFromV116,
  nativeChanges,preservedV114PresentationScripts:preservedPresentationScripts,authorizedPresentationChangesV115,
  preservedCameraHelperSha256:cameraSha256,preservedV114GazeSha256:sha(frozenGaze),effectiveGazeSourceSha256:sha(gazeSource),bodyPresentationSourceSha256:sha(bodyPresentation),preservedGazeControlsSuffixSha256:controlsSuffixSha256,
  audioRuntimeSha256:sha(audioRuntime),audioPackManifestSha256:sha(audioManifestBytes),
  bodyModel:{authority:'AUTHORABLE_PROVISIONAL_ANTHROPOMETRIC_RATIOS_NOT_PLAYER_MEASUREMENTS',sharedGeometryPath:actionPath,
   sourceEye:true,shoulderRelativeReach:true,crouchPresentation:'PNG_UPPER_TRANSLATION_FOOT_ANCHORED_LOWER_FOLD_PROXY_NOT_JOINT_IK'},
  throwEffortModel:{authority:'AUTHORED_PROVISIONAL_NOT_MLB_MEASURED',sharedActionPath:'src/core/sim/fielding/LiveThrowActionV103.ts'},
  gloveTossModel:{authority:'AUTHORED_PROVISIONAL_NOT_MLB_MEASURED',sharedActionPath:'src/core/sim/fielding/LiveGloveTossV110.ts',
    eligibility:'ABSOLUTE_INTERNAL_TIMING_OR_ADVANCED_FIELDING_NOT_PUBLIC_LEAGUE_GRADE',capacity:'MIN_GLOVE_MOTOR_AND_ARM',ordinaryHandTransferPreserved:true}};
async function emit(name,html,kind,extras={}){
 const path=resolve(out,name),metadata={...meta,...extras,kind,releaseArtifactRole:kind,sha256:sha(html),bytes:Buffer.byteLength(html)};
 await writeFile(path,html,{flag:'wx'});await writeFile(path+'.build.json',JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output:path,sha256:metadata.sha256,bytes:metadata.bytes}));return metadata;
}
const gameSyntax=checkSyntax(game,'game');await emit(names.game,game,'NORMAL_MATCH');
await writeFile(gamePath+'.bundle-inputs.json',pinBytes,{flag:'wx'});await writeFile(gamePath+'.audio-manifest.json',audioManifestBytes,{flag:'wx'});

let lab=once(await textInput(templatePath),'<title>にーくら カメラワーク調整室 v81</title>','<title>にーくら カメラワーク調整室 v117 際どい打球の捕球試行</title>');
lab=once(lab,'<h1>カメラワーク調整室 <small>v81</small></h1>','<h1>カメラワーク調整室 <small>v117</small></h1>');
lab=once(lab,'<header>','<script>'+audioBank+'</script><script>'+audioRuntime+'</script><header>');
lab=once(lab,'__V73_METADATA__',encode(meta));lab=once(lab,'__V73_EMBEDDED_GAME__',encode(shareAudioBankV100(synchronousWorkbenchGameV116)));
let labDriver=once(await textInput(driverPath),' function renderPair(ms){'," const labAudioV100=window.KneekuraAudioV100.create();\n window.KneekuraAudioV100.installControls(document.querySelector('header'));\n function renderPair(ms){");
labDriver=once(labDriver,'  cadence.sceneDraws++;',"  const audioState=inspectSource();labAudioV100.observe({record:audioState.lastResult,tick:audioState.currentFrame.tick,playing:playing&&currentMs>=audioState.presentation.timing.preparationMs,speed});\n  cadence.sceneDraws++;");
labDriver=once(labDriver,'function pause(){const wasPlaying=playing;','function pause(){labAudioV100.stop();const wasPlaying=playing;');
labDriver=once(labDriver,'desired=playOrigin+(now-playStarted)*speed;','desired=playOrigin+Math.max(0,now-playStarted)*speed;');
lab=once(lab,'__V73_WORKBENCH_DRIVER__',labDriver);
// This frozen template intentionally omits optional closing body/html tags.
lab+='\n<script>\n'+controls+'\n</script>\n';
const labSyntax=checkSyntax(lab,'camera lab');await emit(names.lab,lab,'CAMERA_WORKBENCH',{
 synchronousCalibrationRuntimeV116:true,embeddedSourceGameSha256:sha(synchronousWorkbenchGameV116),cameraWorkbenchSources:{[templatePath]:sourceSnapshot[templatePath],[driverPath]:sourceSnapshot[driverPath]},cameraWorkbenchEffectiveDriverSha256:sha(labDriver)});

const stagedMakerPath=resolve(makerStage,names.maker),makerArgs=['tools/browser-bridge/build-maker.mjs',stagedMakerPath,
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix',
 '--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation',
 '--course-map-v87','--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94','--roster='+rosterPath,'--catalog='+catalogPath,'--match-renderer='+gamePath];
run(makerArgs);
let maker=await readFile(stagedMakerPath,'utf8');const makerPrior=JSON.parse(await readFile(stagedMakerPath+'.build.json','utf8')),
 makerPinBytes=await readFile(stagedMakerPath+'.bundle-inputs.json'),makerPins=JSON.parse(makerPinBytes);
assert.equal(makerPrior.matchRendererSourceSha256,sha(game),'Fresh maker reads the exact V115 ordinary renderer');
assert.equal(resolve(makerPrior.matchRendererSourcePath),gamePath,'Explicit match-renderer override');
assert.equal(makerPrior.liveRosterCatalogSha256,sourceSnapshot[catalogPath],'Fresh catalog injection');
assert.equal(makerPrior.uiSha256,sourceSnapshot['docs/demos/baseball-maker-ui-v94.mjs'],'Fresh maker UI source');
assert.equal(makerPrior.sha256,sha(maker));assert.equal(makerPrior.coreSha256,makerPins.entrySha256);assert.equal(makerPrior.bundleInputManifestSha256,sha(makerPinBytes));
assert(makerPins.inputs[actionPath],'V105 common body geometry missing from maker bundle');
assert.equal(makerPrior.makerLayoutVersion,112,'Fresh maker retains V112 layout');
for(const path of ['docs/demos/baseball-maker-layout-v112.js','docs/demos/baseball-maker-layout-v112.css'])
 assert.equal(makerPrior.makerLayoutSources[path],sourceSnapshot[path],'Fresh V112 layout source '+path);
for(const [path,hash]of Object.entries(makerPins.inputs))assert.equal(hash,sourceSnapshot[path],'Maker source snapshot '+path);
const ui=Object.fromEntries(await Promise.all(Object.entries(uiPaths).map(async([key,path])=>[key,await textInput(path)]))),patched=applyPitchHandUiV97(ui);
for(const key of Object.keys(uiPaths))maker=once(maker,ui[key],patched[key],key+' handed UI');
maker=once(maker,'<title>にーくら野球メーカー v94</title>','<title>にーくら野球メーカー v117 際どい打球の捕球試行</title>');
const [markup,css,renderer,rawDriver]=await Promise.all(practicePaths.map(textInput));
let fieldDriver=once(rawDriver,"['run','arm','field','catching','throwingAccuracy']","['run','arm','field','transfer','catching','throwingAccuracy']");
fieldDriver=once(fieldDriver,' function syncEditors(){',(await textInput('tools/browser-bridge/field-relationships-v99.js'))+'\n function syncEditors(){');
fieldDriver=once(fieldDriver,'syncPublic();syncAdvanced();syncTraits();','syncPublic();syncAdvanced();syncTraits();syncRelationshipsV99();');
let fieldRenderer=once(renderer,'liveFieldCameraTarget:observed?.target??null,','liveFieldCameraTarget:observed?.target??null,\n     liveFieldGazeV99:root.KneekuraLiveFieldGazeV99?.observe({record,frame,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:selectedPlayerId??observed?.observerPlayerId,fixedObserverPlayerId:selectedPlayerId,eyeHeightMeters:player(selectedPlayerId??observed?.observerPlayerId??r.pitcherPlayerId).height*.92}),');
const soundPractice=patchPracticeAudioV100(fieldRenderer,fieldDriver);fieldRenderer=soundPractice.renderer;fieldDriver=soundPractice.driver;
maker=transformEmbedded(maker,'KneekuraMakerMatchHtmlV70',patchComparisonAudioV100);
maker=transformEmbedded(maker,'KneekuraMakerPitcherMatchHtmlV77',patchComparisonAudioV100);
const makerBank=Object.fromEntries(Object.entries(pack).filter(([key])=>!['start','end','homerun','hit1','hit2','clap','hbp'].includes(key)));
maker=once(maker,'</head>','<script>globalThis.KneekuraAudioPolicyV100={crowd:false};globalThis.KneekuraAudioPackV100='+JSON.stringify(makerBank)+';</script><script>'+audioRuntime+'</script></head>');
maker=once(maker,'</body>',"<script>KneekuraAudioV100.installControls(document.querySelector('header')??document.body);</script></body>");
const fieldPracticeSources=Object.fromEntries(practicePaths.map(path=>[path,sourceSnapshot[path]])),
 makerEffectiveSources={...v115Sources,...Object.fromEntries(makerSourcePaths.map(path=>[path,sourceSnapshot[path]]))};
maker=once(maker,'</head>','<style id="field-practice-style-v98">'+css+'</style>\n</head>');
maker=once(maker,'</body>',markup+'\n<script>\nglobalThis.KneekuraFieldPracticeMetadataV98=Object.freeze('+encode({...meta,fieldPracticeSources})+');\n'+fieldRenderer+'\n'+fieldDriver+'\n</script>\n</body>');
const embeddedProof=[];
for(const key of ['KneekuraMakerMatchHtmlV70','KneekuraMakerPitcherMatchHtmlV77']){
 const html=embedded(maker,key),found=scripts(html).filter(coreScript);
 assert(html.includes('athleticV115:actor.athleticV115'),'Embedded Source action transfer');
 assert(html.includes('pixelMapV115?.unmap(x,y)'),'Embedded Source PNG raster');
 requirePortraits(html);assert.equal(found.length,1,key+' core');assert.equal(found[0].body,core+'\n',key+' new core');
 assert.equal(findScript(html,'<script id="field-gaze-v99">').body,effectiveGaze,key+' Source eye, PNG crouch and V115 athletic runtime');
 assert.equal(findScript(html,'<script id="v36-field-camera">').body,findScript(base,'<script id="v36-field-camera">').body,key+' frozen camera');
 embeddedProof.push({key,sha256:sha(html),...checkSyntax(html,key)});
}
assert(maker.includes('KneekuraAudioPolicyV100={crowd:false}'),'Maker crowd audio stays disabled');
assert(Object.keys(makerBank).every(key=>!['start','end','homerun','hit1','hit2','clap','hbp'].includes(key)),'No crowd pack in maker');
const makerSyntax=checkSyntax(maker,'maker'),makerMaps=Object.fromEntries(Object.entries(makerPrior).filter(([key])=>key.endsWith('Sources')));
await emit(names.maker,maker,'MAKER',{
 ...makerPrior,...makerMaps,effectiveSources:makerEffectiveSources,v115Sources,output:makerPath,
 sourceGamePath:gamePath,sourceGameSha256:sha(game),sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,sourceInputCount:Object.keys(pins.inputs).length,
 fieldPracticeSources,fieldPracticeVersion:115,fieldPresentationVersion:115,athleticActionVersion:115,athleticPresentationVersion:115,portraitSlotsPreservedV114:true,releaseVersion:117,
 embeddedMatchRendererSha256:embeddedProof[0].sha256,embeddedPitcherRendererSha256:embeddedProof[1].sha256,
 fieldPracticeEffectiveRendererSha256:sha(fieldRenderer),fieldPracticeEffectiveDriverSha256:sha(fieldDriver),
 pitchHandEffectiveUiSha256:Object.fromEntries(Object.keys(uiPaths).map(key=>[uiPaths[key],sha(patched[key])]))});
await writeFile(makerPath+'.bundle-inputs.json',makerPinBytes,{flag:'wx'});

// Verify every captured source again, including frozen V111/V112/V113/V114 artifacts.
// A failed verification leaves this candidate visibly incomplete and cannot
// overwrite either a prior candidate or the published standalone artifacts.
for(const [path,hash]of Object.entries(sourceSnapshot))assert.equal(sha(await readFile(path)),hash,'Source changed during build: '+path);
const snapshot={schemaVersion:1,releaseVersion:117,captureMode:meta.sourceInputCaptureMode,inputs:sourceSnapshot,
 nativeBundle:{entrySha256:sha(core),inputCount:Object.keys(pins.inputs).length,inputManifestSha256:sha(pinBytes)},
 makerBundle:{entrySha256:makerPins.entrySha256,inputCount:Object.keys(makerPins.inputs).length,inputManifestSha256:sha(makerPinBytes)},
 allCapturedInputsUnchanged:true};
await writeFile(resolve(out,'build-sources-v117.json'),JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
const report={releaseVersion:117,nearPursuitAttemptVersion:117,outputDirectory:out,source,sourceSha256,sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,
 athleticReverseV114RightPortrait:true,backgroundRuntimePatchVerifiedV116:true,nativeChanges,
 preservedV116CoreSha256,preservedV116Artifacts,preservedBackgroundV116,nativeChangesFromV116,
 preservedPresentationScripts,authorizedPresentationChangesV115,gameSyntax,labSyntax,makerSyntax,embeddedProof,makerArgs,
 fieldPracticeSources,sourceSnapshotSha256:sha(JSON.stringify(snapshot,null,2)+'\n'),allCapturedInputsUnchanged:true,
 artifacts:[names.game,names.maker,names.lab].map(name=>({path:resolve(out,name)}))};
await writeFile(resolve(out,'build-report-v117.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:resolve(out,'build-report-v117.json'),sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length}));
