import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';
import {applyScoringAudioV100,shareAudioBankV100,patchPracticeAudioV100,patchComparisonAudioV100,transformEmbedded} from './scoring-audio-presentation-v100.mjs';
const out=resolve(process.argv[2]??'../../outputs/v100-candidate-1'),sha=b=>createHash('sha256').update(b).digest('hex'),
 source=resolve('../../outputs/ばせぼーるlv99_TBD_vs_LAD_守備連携と送球判断版.html'),base=await readFile(source,'utf8'),prior=JSON.parse(await readFile(source+'.build.json'));
assert.equal(sha(base),'f839ee5e1f3ae3b43712c1123c660f967552d79ad8e223c30bab3bb4837ad6f8');assert.equal(sha(base),prior.sha256);
function once(s,a,b){assert.equal(s.split(a).length,2,'V99 unique seam '+a.slice(0,80));return s.replace(a,()=>b);}
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0);}
run(['tools/browser-bridge/build-native.mjs']);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinBytes);assert.equal(sha(core),pins.entrySha256);
function replaceCore(s){let n=0;const html=s.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,c)=>{if(!b.includes('var KneekuraNativeMatchCore ='))return all;n++;return a+core+'\n'+c;});assert.equal(n,1);return html;}
let game=await applyScoringAudioV100(replaceCore(base));
game=once(game,'<title>にーくらMINIbaseball v99 守備連携と送球判断</title>','<title>にーくらMINIbaseball v100 記録判定と状況音声</title>');
game=once(game,'守備連携と送球判断版 99','記録判定と状況音声版 100');
const names={game:'ばせぼーるlv100_TBD_vs_LAD_記録判定と状況音声版.html',maker:'にーくら野球メーカー_v100_記録判定と効果音版.html',lab:'カメラワーク調整室_v100_音声連携版.html'},gamePath=resolve(out,names.game),
 sourcePaths=['tools/browser-bridge/build-scoring-audio-release-v100.mjs','tools/browser-bridge/scoring-audio-presentation-v100.mjs','tools/browser-bridge/live-audio-v100.js','tools/browser-bridge/build-audio-pack-v100.py','tools/browser-bridge/live-play-description.js'],
 v100Sources=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(p))])));
const previousPins={};for(const [group,map]of Object.entries(prior))if(group.endsWith('Sources')&&map&&typeof map==='object'){
 previousPins[group]={...map};for(const p of Object.keys(map))if(pins.inputs[p])previousPins[group][p]=pins.inputs[p];}
const meta={...prior,...previousPins,releaseVersion:100,scoringVersion:100,audioVersion:100,fieldPracticeVersion:99,fieldDecisionVersion:99,fieldPresentationVersion:99,v100Sources,
 audioPackManifestSha256:sha(await readFile('work/v100-investigation/audio-pack.manifest.json')),
 audioInventorySha256:sha(await readFile('docs/verification/releases/v100-investigation/audio-inventory.json')),
 basePresentationPath:source,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,
 sourceInputCount:Object.keys(pins.inputs).length,frozenSourceManifestSha256:sha(pinBytes),sourceGamePath:gamePath,sourceGameSha256:sha(game),preservedV98SourceCoreSha256:prior.sourceCoreSha256};
await mkdir(out,{recursive:true});
async function emit(name,html,kind,extras={}){const p=resolve(out,name);await writeFile(p,html,{flag:'wx'});await writeFile(p+'.build.json',JSON.stringify({...meta,...extras,kind,sha256:sha(html),bytes:Buffer.byteLength(html)},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:p,sha256:sha(html)}));}
await emit(names.game,game,'NORMAL_MATCH');await writeFile(gamePath+'.bundle-inputs.json',pinBytes,{flag:'wx'});
await writeFile(gamePath+'.audio-manifest.json',await readFile('work/v100-investigation/audio-pack.manifest.json'),{flag:'wx'});
const templatePath='tools/browser-bridge/camera-workbench-v81.html',driverPath='tools/browser-bridge/camera-workbench-v84.js';
let lab=(await readFile(templatePath,'utf8')).replaceAll('v81','v100');
lab=once(lab,'<header>','<script>globalThis.KneekuraAudioPackV100='+await readFile('work/v100-investigation/audio-pack.json','utf8')+';</script><script>'+await readFile('tools/browser-bridge/live-audio-v100.js','utf8')+'</script><header>');
lab=once(lab,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(shareAudioBankV100(game)).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',(await readFile(driverPath,'utf8')).replace(' function renderPair(ms){',' const labAudioV100=window.KneekuraAudioV100.create();\n window.KneekuraAudioV100.installControls(document.querySelector(\'header\'));\n function renderPair(ms){').replace('  cadence.sceneDraws++;','  const audioState=inspectSource();labAudioV100.observe({record:audioState.lastResult,tick:audioState.currentFrame.tick,playing:playing&&currentMs>=audioState.presentation.timing.preparationMs,speed});\n  cadence.sceneDraws++;').replace('function pause(){const wasPlaying=playing;','function pause(){labAudioV100.stop();const wasPlaying=playing;').replace('desired=playOrigin+(now-playStarted)*speed;','desired=playOrigin+Math.max(0,now-playStarted)*speed;'));
// The frozen workbench template omits optional closing body/html tags.
lab+='\n<script>\n'+await readFile('tools/browser-bridge/field-gaze-controls-v99.js','utf8')+'\n</script>\n';
await emit(names.lab,lab,'CAMERA_WORKBENCH',{cameraWorkbenchSources:{[templatePath]:sha(await readFile(templatePath)),[driverPath]:sha(await readFile(driverPath))}});
const makerPath=resolve(out,names.maker);
run(['tools/browser-bridge/build-maker.mjs',makerPath,'--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation','--course-map-v87','--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94','--roster=docs/demos/live-game-roster-v98.json','--catalog=docs/demos/live-game-roster-catalog-v77.json','--match-renderer='+gamePath]);
let maker=await readFile(makerPath,'utf8');const makerPrior=JSON.parse(await readFile(makerPath+'.build.json'));
const uiPaths={pitcher:'docs/demos/baseball-maker-pitcher-v92.js',menu:'docs/demos/baseball-maker-pitch-menu-v82.js',arrows:'docs/demos/baseball-maker-pitch-arrows-v89.js',movement:'docs/demos/baseball-maker-pitch-movement-v92.js'},
 ui=Object.fromEntries(await Promise.all(Object.entries(uiPaths).map(async([k,p])=>[k,await readFile(p,'utf8')]))),patched=applyPitchHandUiV97(ui);
for(const k of Object.keys(uiPaths))maker=once(maker,ui[k],patched[k]);
maker=once(maker,'<title>にーくら野球メーカー v94</title>','<title>にーくら野球メーカー v100 記録判定と効果音</title>');
const labSources=['tools/browser-bridge/maker-field-practice-v98.html','tools/browser-bridge/maker-field-practice-v98.css','tools/browser-bridge/field-practice-renderer-v98.js','tools/browser-bridge/field-workbench-v98.js'],[markup,css,renderer,rawDriver]=await Promise.all(labSources.map(p=>readFile(p,'utf8')));
let fieldDriver=once(rawDriver,"['run','arm','field','catching','throwingAccuracy']","['run','arm','field','transfer','catching','throwingAccuracy']");
fieldDriver=once(fieldDriver,' function syncEditors(){',(await readFile('tools/browser-bridge/field-relationships-v99.js','utf8'))+'\n function syncEditors(){');
fieldDriver=once(fieldDriver,'syncPublic();syncAdvanced();syncTraits();','syncPublic();syncAdvanced();syncTraits();syncRelationshipsV99();');
let fieldRenderer=once(renderer,'liveFieldCameraTarget:observed?.target??null,','liveFieldCameraTarget:observed?.target??null,\n     liveFieldGazeV99:root.KneekuraLiveFieldGazeV99?.observe({record,frame,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:selectedPlayerId??observed?.observerPlayerId,fixedObserverPlayerId:selectedPlayerId,eyeHeightMeters:player(selectedPlayerId??observed?.observerPlayerId??r.pitcherPlayerId).height*.92}),');
const soundPractice=patchPracticeAudioV100(fieldRenderer,fieldDriver);fieldRenderer=soundPractice.renderer;fieldDriver=soundPractice.driver;
maker=transformEmbedded(maker,'KneekuraMakerMatchHtmlV70',patchComparisonAudioV100);
maker=transformEmbedded(maker,'KneekuraMakerPitcherMatchHtmlV77',patchComparisonAudioV100);
const makerBank=Object.fromEntries(Object.entries(JSON.parse(await readFile('work/v100-investigation/audio-pack.json','utf8'))).filter(([key])=>!['start','end','homerun','hit1','hit2','clap','hbp'].includes(key)));
maker=once(maker,'</head>','<script>globalThis.KneekuraAudioPolicyV100={crowd:false};globalThis.KneekuraAudioPackV100='+JSON.stringify(makerBank)+';</script><script>'+await readFile('tools/browser-bridge/live-audio-v100.js','utf8')+'</script></head>');
maker=once(maker,'</body>','<script>KneekuraAudioV100.installControls(document.querySelector(\'header\')??document.body);</script></body>');
const fieldPracticeSources=Object.fromEntries(await Promise.all(labSources.map(async p=>[p,sha(await readFile(p))])));
maker=once(maker,'</head>','<style id="field-practice-style-v98">'+css+'</style>\n</head>');
maker=once(maker,'</body>',markup+'\n<script>\nglobalThis.KneekuraFieldPracticeMetadataV98=Object.freeze('+JSON.stringify({...meta,fieldPracticeSources}).replaceAll('<','\\u003c')+');\n'+fieldRenderer+'\n'+fieldDriver+'\n</script>\n</body>');
await writeFile(makerPath,maker);await writeFile(makerPath+'.build.json',JSON.stringify({...makerPrior,...meta,fieldPracticeSources,sha256:sha(maker),bytes:Buffer.byteLength(maker)},null,2)+'\n');
console.log(JSON.stringify({output:makerPath,sha256:sha(maker)}));
