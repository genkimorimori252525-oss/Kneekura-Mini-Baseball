import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname,join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {Script} from 'node:vm';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';
import {shareAudioBankV100,patchPracticeAudioV100,patchComparisonAudioV100,transformEmbedded} from './scoring-audio-presentation-v100.mjs';

assert.equal(process.argv.length,3,'Usage: node tools/browser-bridge/build-throw-effort-release-v103.mjs <new-candidate-directory>');
const out=resolve(process.argv[2]),sourceRoot=resolve('../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(dirname(out),sourceRoot,'The new candidate directory must be a direct child of outputs');
const names={game:'ばせぼーるlv103_TBD_vs_LAD_力込め送球版.html',maker:'にーくら野球メーカー_v103_力込め送球版.html',lab:'カメラワーク調整室_v103_力込め送球版.html'},
 gamePath=resolve(out,names.game),makerPath=resolve(out,names.maker),
 source=resolve(sourceRoot,'ばせぼーるlv102_TBD_vs_LAD_送球視線版.html'),
 sourceSha256='2aea57191be8be1660fc06cfb2e02daebabeb9055a22925fa3aaec6eacc2e9c9',
 oldCoreSha256='ef81b4e074b35bbde102359efd3e84f66bdb8b20be38fdf3d653a129e5311585',
 cameraSha256='11bc1872a99db3574d370a2d3b60500eea67d9c7f3313ecc19b22156308b8981',
 gazeSha256='ce6df1ffdf622edf60f2435533a62bdeaefb6a71c6a5c1576445f4757ecba81d',
 controlsSuffixSha256='cd018494d3682ec6ab64fd709f1e68b3c529ed2410c10815418a9fb8fe3e80e8',
 actionPath='src/core/sim/fielding/LiveThrowActionV103.ts',
 rosterPath='docs/demos/live-game-roster-v98.json',catalogPath='docs/demos/live-game-roster-catalog-v103.json',
 templatePath='tools/browser-bridge/camera-workbench-v81.html',driverPath='tools/browser-bridge/camera-workbench-v84.js';
const cache=new Map(),sourceSnapshot={};
async function input(path){
 if(!cache.has(path)){const bytes=await readFile(path);cache.set(path,bytes);sourceSnapshot[path]=sha(bytes);}
 return cache.get(path);
}
const textInput=async path=>(await input(path)).toString('utf8');
function once(text,before,after,label=before.slice(0,80)){
 const at=text.indexOf(before);assert(at>=0,'V103 missing seam: '+label);
 assert.equal(text.indexOf(before,at+before.length),-1,'V103 unique seam: '+label);
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
 builderPaths=['tools/browser-bridge/build-throw-effort-release-v103.mjs','tools/browser-bridge/build-native.mjs','tools/browser-bridge/build-maker.mjs','tools/browser-bridge/pitch-hand-ui-v97.mjs','tools/browser-bridge/scoring-audio-presentation-v100.mjs',templatePath,driverPath,...practicePaths,
  'tools/browser-bridge/field-relationships-v99.js','tools/browser-bridge/live-field-gaze-v99.js','tools/browser-bridge/field-gaze-controls-v99.js','tools/browser-bridge/live-field-camera.js',rosterPath,catalogPath],
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
assert(sourceSnapshot[actionPath],'The shared v103 throw-action module is required');

const baseBytes=await input(source),base=baseBytes.toString('utf8'),prior=JSON.parse(await textInput(source+'.build.json')),
 frozenPinsBytes=await input(source+'.bundle-inputs.json'),frozenPins=JSON.parse(frozenPinsBytes),audioManifestBytes=await input(source+'.audio-manifest.json');
assert.equal(sha(baseBytes),sourceSha256,'Frozen v102 normal game');assert.equal(prior.sha256,sourceSha256,'Frozen v102 metadata');
assert.equal(prior.sourceCoreSha256,oldCoreSha256);assert.equal(frozenPins.entrySha256,oldCoreSha256);
assert.equal(sha(frozenPinsBytes),prior.frozenSourceManifestSha256);assert.equal(sha(audioManifestBytes),prior.audioPackManifestSha256);
for(const [name,expected]of [
 ['にーくら野球メーカー_v102_送球視線版.html','10995eeffa583aa526ff8ca15c4a53eca00c55bbaa74d3305df5676bd0e14e2c'],
 ['カメラワーク調整室_v102_送球視線版.html','05e35cbf987627e64cf14e2d53fb09f4f021e40210ef015ac928725f070988c4']
]){
 const path=resolve(sourceRoot,name),bytes=await input(path),metadata=JSON.parse(await textInput(path+'.build.json'));
 // Sibling documents are protected inputs, not reconstruction templates.
 assert.equal(sha(bytes),expected,'Frozen sibling '+name);assert.equal(metadata.sha256,expected,name+' metadata');
 assert.equal(metadata.releaseVersion,102,name+' version');
 assert.equal(metadata.sourceCoreSha256,oldCoreSha256,name+' core');
}
const sourceScripts=scripts(base),oldCoreScripts=sourceScripts.filter(coreScript);assert.equal(oldCoreScripts.length,1);
assert.equal(sha(oldCoreScripts[0].body.slice(0,-1)),oldCoreSha256,'Frozen embedded core');
assert.equal(sha(findScript(base,'<script id="v36-field-camera">').body.slice(0,-1)),cameraSha256);
assert.equal(sourceSnapshot['tools/browser-bridge/live-field-camera.js'],cameraSha256,'Camera helper source');
assert.equal(sourceSnapshot['tools/browser-bridge/live-field-gaze-v99.js'],gazeSha256,'v102 front-throw gaze source');
const frozenGaze=findScript(base,'<script id="field-gaze-v99">').body,
 gazeSource=await textInput('tools/browser-bridge/live-field-gaze-v99.js'),controls=await textInput('tools/browser-bridge/field-gaze-controls-v99.js');
assert.equal(frozenGaze,gazeSource+'\n'+controls+'\n','Frozen gaze and control bytes');assert.equal(sha(controls+'\n'),controlsSuffixSha256);
const audioRuntime=findScript(base,'<script id="audio-runtime-v100">').body,audioBank=findScript(base,'<script id="audio-bank-v100">').body,
 bankPrefix='globalThis.KneekuraAudioPackV100=';
assert(audioBank.startsWith(bankPrefix)&&audioBank.endsWith(';'),'Frozen audio-bank assignment');
const pack=JSON.parse(audioBank.slice(bankPrefix.length,-1));assert.equal(sha(audioRuntime),prior.v101Sources['tools/browser-bridge/live-audio-v100.js']);

// Never reuse a candidate directory, and never let build-maker write a final
// release file. Its ordinary writes are confined to this newly created stage.
await mkdir(out);const makerStage=resolve(out,'_fresh-maker-v103');await mkdir(makerStage);
run(['tools/browser-bridge/build-native.mjs']);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinBytes);
assert.equal(sha(core),pins.entrySha256);assert(pins.inputs[actionPath],'v103 action missing from native bundle');
assert(Object.keys(pins.inputs).length>Object.keys(frozenPins.inputs).length,'New shared action must appear in the real input manifest');
for(const [path,hash]of Object.entries(pins.inputs))assert.equal(hash,sourceSnapshot[path],'Native source snapshot '+path);
let game=base.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(all,a,b,c)=>coreScript({body:b})?a+core+'\n'+c:all);
game=once(game,'<title>にーくらMINIbaseball v102 送球視線</title>','<title>にーくらMINIbaseball v103 力込め送球</title>');
game=once(game,'TBD対LAD 送球視線版 102','TBD対LAD 力込め送球版 103');
const nextScripts=scripts(game),preservedPresentationScripts=[],authorizedPresentationChangesV103=[];assert.equal(nextScripts.length,sourceScripts.length);
for(let i=0;i<sourceScripts.length;i++){
 assert.equal(nextScripts[i].tag,sourceScripts[i].tag);assert.equal(nextScripts[i].close,sourceScripts[i].close);
 if(coreScript(sourceScripts[i]))assert.equal(nextScripts[i].body,core+'\n');
 else if(nextScripts[i].body!==sourceScripts[i].body){
  const before='TBD対LAD 送球視線版 102',after='TBD対LAD 力込め送球版 103';
  assert.equal(nextScripts[i].body,once(sourceScripts[i].body,before,after,'authorized edition label'),'Only the display edition label may change in a presentation script');
  authorizedPresentationChangesV103.push({index:i,tag:sourceScripts[i].tag,kind:'DISPLAY_EDITION_LABEL',before,after,
   beforeSha256:sha(sourceScripts[i].body),afterSha256:sha(nextScripts[i].body)});
 }else preservedPresentationScripts.push({index:i,tag:sourceScripts[i].tag,sha256:sha(sourceScripts[i].body),bytes:Buffer.byteLength(sourceScripts[i].body)});
}
assert.equal(authorizedPresentationChangesV103.length,1,'Exactly one presentation script receives the edition label');
let reverse=once(game,core+'\n',oldCoreScripts[0].body,'reverse core');
reverse=once(reverse,'<title>にーくらMINIbaseball v103 力込め送球</title>','<title>にーくらMINIbaseball v102 送球視線</title>');
reverse=once(reverse,'TBD対LAD 力込め送球版 103','TBD対LAD 送球視線版 102');assert.equal(reverse,base,'Exact reverse reconstruction');
const historicalSourceMapsV102=Object.fromEntries(Object.entries(prior).filter(([key])=>key.endsWith('Sources')||key==='helpers')),
 inherited=Object.fromEntries(Object.entries(prior).filter(([key])=>!key.endsWith('Sources')&&key!=='helpers')),
 v103Sources=Object.fromEntries(builderPaths.map(path=>[path,sourceSnapshot[path]])),
 meta={...inherited,releaseVersion:103,fieldDecisionVersion:103,fieldPracticeVersion:103,fieldPresentationVersion:103,cameraPresentationVersion:102,
  throwEffortVersion:103,scoringVersion:100,audioVersion:100,cameraOnlyV102:false,sourceCoreChanged:true,worldBehaviorChanged:true,
  throwCommandTimingAndOutputChanged:true,ballPhysicsKernelChanged:false,adjudicationRulesChanged:false,
  historicalSourceMapsV102,v103Sources,effectiveSources:v103Sources,builderSha256:sourceSnapshot['tools/browser-bridge/build-throw-effort-release-v103.mjs'],
  basePresentationPath:source,basePresentationSha256:sourceSha256,sourceGamePath:gamePath,sourceGameSha256:sha(game),
  sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,sourceInputCount:Object.keys(pins.inputs).length,
  frozenSourceManifestSha256:sha(pinBytes),sourceInputCaptureMode:'PRE_BUILD_SNAPSHOT_VERIFIED_AGAINST_NATIVE_AND_MAKER_INPUTS_AND_POST_BUILD_FILES',
  preservedV102SourceCoreSha256:oldCoreSha256,preservedV102PresentationScripts:preservedPresentationScripts,authorizedPresentationChangesV103,
  preservedCameraHelperSha256:cameraSha256,preservedGazeSha256:gazeSha256,preservedGazeControlsSuffixSha256:controlsSuffixSha256,
  audioRuntimeSha256:sha(audioRuntime),audioPackManifestSha256:sha(audioManifestBytes),
  throwEffortModel:{authority:'AUTHORED_PROVISIONAL_NOT_MLB_MEASURED',sharedActionPath:actionPath}};
async function emit(name,html,kind,extras={}){
 const path=resolve(out,name),metadata={...meta,...extras,kind,releaseArtifactRole:kind,sha256:sha(html),bytes:Buffer.byteLength(html)};
 await writeFile(path,html,{flag:'wx'});await writeFile(path+'.build.json',JSON.stringify(metadata,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({output:path,sha256:metadata.sha256,bytes:metadata.bytes}));return metadata;
}
const gameSyntax=checkSyntax(game,'game');await emit(names.game,game,'NORMAL_MATCH');
await writeFile(gamePath+'.bundle-inputs.json',pinBytes,{flag:'wx'});await writeFile(gamePath+'.audio-manifest.json',audioManifestBytes,{flag:'wx'});

let lab=once(await textInput(templatePath),'<title>にーくら カメラワーク調整室 v81</title>','<title>にーくら カメラワーク調整室 v103 力込め送球</title>');
lab=once(lab,'<h1>カメラワーク調整室 <small>v81</small></h1>','<h1>カメラワーク調整室 <small>v103</small></h1>');
lab=once(lab,'<header>','<script>'+audioBank+'</script><script>'+audioRuntime+'</script><header>');
lab=once(lab,'__V73_METADATA__',encode(meta));lab=once(lab,'__V73_EMBEDDED_GAME__',encode(shareAudioBankV100(game)));
let labDriver=once(await textInput(driverPath),' function renderPair(ms){'," const labAudioV100=window.KneekuraAudioV100.create();\n window.KneekuraAudioV100.installControls(document.querySelector('header'));\n function renderPair(ms){");
labDriver=once(labDriver,'  cadence.sceneDraws++;',"  const audioState=inspectSource();labAudioV100.observe({record:audioState.lastResult,tick:audioState.currentFrame.tick,playing:playing&&currentMs>=audioState.presentation.timing.preparationMs,speed});\n  cadence.sceneDraws++;");
labDriver=once(labDriver,'function pause(){const wasPlaying=playing;','function pause(){labAudioV100.stop();const wasPlaying=playing;');
labDriver=once(labDriver,'desired=playOrigin+(now-playStarted)*speed;','desired=playOrigin+Math.max(0,now-playStarted)*speed;');
lab=once(lab,'__V73_WORKBENCH_DRIVER__',labDriver);
// This frozen template intentionally omits optional closing body/html tags.
lab+='\n<script>\n'+controls+'\n</script>\n';
const labSyntax=checkSyntax(lab,'camera lab');await emit(names.lab,lab,'CAMERA_WORKBENCH',{
 cameraWorkbenchSources:{[templatePath]:sourceSnapshot[templatePath],[driverPath]:sourceSnapshot[driverPath]},cameraWorkbenchEffectiveDriverSha256:sha(labDriver)});

const stagedMakerPath=resolve(makerStage,names.maker),makerArgs=['tools/browser-bridge/build-maker.mjs',stagedMakerPath,
 '--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix',
 '--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation',
 '--course-map-v87','--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94','--roster='+rosterPath,'--catalog='+catalogPath,'--match-renderer='+gamePath];
run(makerArgs);
let maker=await readFile(stagedMakerPath,'utf8');const makerPrior=JSON.parse(await readFile(stagedMakerPath+'.build.json','utf8')),
 makerPinBytes=await readFile(stagedMakerPath+'.bundle-inputs.json'),makerPins=JSON.parse(makerPinBytes);
assert.equal(makerPrior.sha256,sha(maker));assert.equal(makerPrior.coreSha256,makerPins.entrySha256);assert.equal(makerPrior.bundleInputManifestSha256,sha(makerPinBytes));
assert(makerPins.inputs[actionPath],'v103 action missing from maker bundle');
for(const [path,hash]of Object.entries(makerPins.inputs))assert.equal(hash,sourceSnapshot[path],'Maker source snapshot '+path);
const ui=Object.fromEntries(await Promise.all(Object.entries(uiPaths).map(async([key,path])=>[key,await textInput(path)]))),patched=applyPitchHandUiV97(ui);
for(const key of Object.keys(uiPaths))maker=once(maker,ui[key],patched[key],key+' handed UI');
maker=once(maker,'<title>にーくら野球メーカー v94</title>','<title>にーくら野球メーカー v103 力込め送球</title>');
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
 makerEffectiveSources={...v103Sources,...Object.fromEntries(makerSourcePaths.map(path=>[path,sourceSnapshot[path]]))};
maker=once(maker,'</head>','<style id="field-practice-style-v98">'+css+'</style>\n</head>');
maker=once(maker,'</body>',markup+'\n<script>\nglobalThis.KneekuraFieldPracticeMetadataV98=Object.freeze('+encode({...meta,fieldPracticeSources})+');\n'+fieldRenderer+'\n'+fieldDriver+'\n</script>\n</body>');
const embeddedProof=[];
for(const key of ['KneekuraMakerMatchHtmlV70','KneekuraMakerPitcherMatchHtmlV77']){
 const html=embedded(maker,key),found=scripts(html).filter(coreScript);assert.equal(found.length,1,key+' core');assert.equal(found[0].body,core+'\n',key+' new core');
 assert.equal(findScript(html,'<script id="field-gaze-v99">').body,frozenGaze,key+' frozen v102 gaze');
 assert.equal(findScript(html,'<script id="v36-field-camera">').body,findScript(base,'<script id="v36-field-camera">').body,key+' frozen camera');
 embeddedProof.push({key,sha256:sha(html),...checkSyntax(html,key)});
}
const makerSyntax=checkSyntax(maker,'maker'),makerMaps=Object.fromEntries(Object.entries(makerPrior).filter(([key])=>key.endsWith('Sources')));
await emit(names.maker,maker,'MAKER',{
 ...makerPrior,...makerMaps,effectiveSources:makerEffectiveSources,v103Sources,output:makerPath,
 sourceGamePath:gamePath,sourceGameSha256:sha(game),sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,sourceInputCount:Object.keys(pins.inputs).length,
 fieldPracticeSources,fieldPracticeVersion:103,releaseVersion:103,
 embeddedMatchRendererSha256:embeddedProof[0].sha256,embeddedPitcherRendererSha256:embeddedProof[1].sha256,
 fieldPracticeEffectiveRendererSha256:sha(fieldRenderer),fieldPracticeEffectiveDriverSha256:sha(fieldDriver),
 pitchHandEffectiveUiSha256:Object.fromEntries(Object.keys(uiPaths).map(key=>[uiPaths[key],sha(patched[key])]))});
await writeFile(makerPath+'.bundle-inputs.json',makerPinBytes,{flag:'wx'});

// Verify every captured source again, including all three frozen v102 HTMLs.
// A failed verification leaves this candidate visibly incomplete and cannot
// overwrite either a prior candidate or the published standalone artifacts.
for(const [path,hash]of Object.entries(sourceSnapshot))assert.equal(sha(await readFile(path)),hash,'Source changed during build: '+path);
const snapshot={schemaVersion:1,releaseVersion:103,captureMode:meta.sourceInputCaptureMode,inputs:sourceSnapshot,
 nativeBundle:{entrySha256:sha(core),inputCount:Object.keys(pins.inputs).length,inputManifestSha256:sha(pinBytes)},
 makerBundle:{entrySha256:makerPins.entrySha256,inputCount:Object.keys(makerPins.inputs).length,inputManifestSha256:sha(makerPinBytes)},
 allCapturedInputsUnchanged:true};
await writeFile(resolve(out,'build-sources-v103.json'),JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});
const report={releaseVersion:103,outputDirectory:out,source,sourceSha256,sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,
 exactReverseV102NormalMatch:true,preservedPresentationScripts,authorizedPresentationChangesV103,gameSyntax,labSyntax,makerSyntax,embeddedProof,makerArgs,
 fieldPracticeSources,sourceSnapshotSha256:sha(JSON.stringify(snapshot,null,2)+'\n'),allCapturedInputsUnchanged:true,
 artifacts:[names.game,names.maker,names.lab].map(name=>({path:resolve(out,name)}))};
await writeFile(resolve(out,'build-report-v103.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({report:resolve(out,'build-report-v103.json'),sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length}));
