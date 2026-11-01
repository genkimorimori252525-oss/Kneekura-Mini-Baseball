import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';
import {applyFieldPresentationV99} from './field-presentation-v99.mjs';
const out=resolve(process.argv[2]??'../../outputs/v99-candidate'),sha=b=>createHash('sha256').update(b).digest('hex'),
 source=resolve('../../outputs/ばせぼーるlv98_TBD_vs_LAD_生成待ち改善と守備初動版.html'),base=await readFile(source,'utf8'),prior=JSON.parse(await readFile(source+'.build.json'));
assert.equal(sha(base),'c2d1cec265b2f78e9122613c7d6854040e8d75bf6b997ecd0a312fc074028dd7');assert.equal(sha(base),prior.sha256);
function once(s,a,b){assert.equal(s.split(a).length,2,'V99 unique seam '+a.slice(0,80));return s.replace(a,()=>b);}
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0);}
run(['tools/browser-bridge/build-native.mjs']);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinBytes);assert.equal(sha(core),pins.entrySha256);
function replaceCore(s){let n=0;const html=s.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,c)=>{if(!b.includes('var KneekuraNativeMatchCore ='))return all;n++;return a+core+'\n'+c;});assert.equal(n,1);return html;}
let game=await applyFieldPresentationV99(replaceCore(base));
game=once(game,'<title>にーくらMINIbaseball v98 生成待ち改善と守備初動</title>','<title>にーくらMINIbaseball v99 守備連携と送球判断</title>');
game=once(game,'生成待ち改善と守備初動版 98','守備連携と送球判断版 99');
const names={game:'ばせぼーるlv99_TBD_vs_LAD_守備連携と送球判断版.html',maker:'にーくら野球メーカー_v99_信頼と送球動作版.html',lab:'カメラワーク調整室_v99_守備の視線版.html'},gamePath=resolve(out,names.game),
 sourcePaths=['tools/browser-bridge/build-field-release-v99.mjs','tools/browser-bridge/field-presentation-v99.mjs','tools/browser-bridge/live-field-gaze-v99.js','tools/browser-bridge/field-gaze-controls-v99.js','tools/browser-bridge/field-relationships-v99.js'],
 v99Sources=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(p))])));
const previousPins={};for(const [group,map]of Object.entries(prior))if(group.endsWith('Sources')&&map&&typeof map==='object'){
 previousPins[group]={...map};for(const p of Object.keys(map))if(pins.inputs[p])previousPins[group][p]=pins.inputs[p];}
const meta={...prior,...previousPins,releaseVersion:99,fieldPracticeVersion:99,fieldDecisionVersion:99,fieldPresentationVersion:99,v99Sources,
 basePresentationPath:source,basePresentationSha256:sha(base),sourceCoreSha256:sha(core),sourceCoreInputCount:Object.keys(pins.inputs).length,
 sourceInputCount:Object.keys(pins.inputs).length,frozenSourceManifestSha256:sha(pinBytes),sourceGamePath:gamePath,sourceGameSha256:sha(game),preservedV98SourceCoreSha256:prior.sourceCoreSha256};
await mkdir(out,{recursive:true});
async function emit(name,html,kind,extras={}){const p=resolve(out,name);await writeFile(p,html,{flag:'wx'});await writeFile(p+'.build.json',JSON.stringify({...meta,...extras,kind,sha256:sha(html),bytes:Buffer.byteLength(html)},null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({output:p,sha256:sha(html)}));}
await emit(names.game,game,'NORMAL_MATCH');await writeFile(gamePath+'.bundle-inputs.json',pinBytes,{flag:'wx'});
const templatePath='tools/browser-bridge/camera-workbench-v81.html',driverPath='tools/browser-bridge/camera-workbench-v84.js';
let lab=(await readFile(templatePath,'utf8')).replaceAll('調整室 v81','調整室 v99');
lab=once(lab,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',await readFile(driverPath,'utf8'));
// The frozen workbench template omits optional closing body/html tags.
lab+='\n<script>\n'+await readFile('tools/browser-bridge/field-gaze-controls-v99.js','utf8')+'\n</script>\n';
await emit(names.lab,lab,'CAMERA_WORKBENCH',{cameraWorkbenchSources:{[templatePath]:sha(await readFile(templatePath)),[driverPath]:sha(await readFile(driverPath))}});
const makerPath=resolve(out,names.maker);
run(['tools/browser-bridge/build-maker.mjs',makerPath,'--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview','--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu','--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation','--course-map-v87','--playback-v88','--pitch-arrows-v89','--maker-editor-v90','--pitch-movement-v92','--rules-v94','--roster=docs/demos/live-game-roster-v98.json','--catalog=docs/demos/live-game-roster-catalog-v77.json','--match-renderer='+gamePath]);
let maker=await readFile(makerPath,'utf8');const makerPrior=JSON.parse(await readFile(makerPath+'.build.json'));
const uiPaths={pitcher:'docs/demos/baseball-maker-pitcher-v92.js',menu:'docs/demos/baseball-maker-pitch-menu-v82.js',arrows:'docs/demos/baseball-maker-pitch-arrows-v89.js',movement:'docs/demos/baseball-maker-pitch-movement-v92.js'},
 ui=Object.fromEntries(await Promise.all(Object.entries(uiPaths).map(async([k,p])=>[k,await readFile(p,'utf8')]))),patched=applyPitchHandUiV97(ui);
for(const k of Object.keys(uiPaths))maker=once(maker,ui[k],patched[k]);
maker=once(maker,'<title>にーくら野球メーカー v94</title>','<title>にーくら野球メーカー v99 信頼と送球動作</title>');
const labSources=['tools/browser-bridge/maker-field-practice-v98.html','tools/browser-bridge/maker-field-practice-v98.css','tools/browser-bridge/field-practice-renderer-v98.js','tools/browser-bridge/field-workbench-v98.js'],[markup,css,renderer,rawDriver]=await Promise.all(labSources.map(p=>readFile(p,'utf8')));
let fieldDriver=once(rawDriver,"['run','arm','field','catching','throwingAccuracy']","['run','arm','field','transfer','catching','throwingAccuracy']");
fieldDriver=once(fieldDriver,' function syncEditors(){',(await readFile('tools/browser-bridge/field-relationships-v99.js','utf8'))+'\n function syncEditors(){');
fieldDriver=once(fieldDriver,'syncPublic();syncAdvanced();syncTraits();','syncPublic();syncAdvanced();syncTraits();syncRelationshipsV99();');
const fieldRenderer=once(renderer,'liveFieldCameraTarget:observed?.target??null,','liveFieldCameraTarget:observed?.target??null,\n     liveFieldGazeV99:root.KneekuraLiveFieldGazeV99?.observe({record,frame,bases:core.LIVE_MATCH_BASES_V1,defaultObserverPlayerId:selectedPlayerId??observed?.observerPlayerId,fixedObserverPlayerId:selectedPlayerId,eyeHeightMeters:player(selectedPlayerId??observed?.observerPlayerId??r.pitcherPlayerId).height*.92}),');
const fieldPracticeSources=Object.fromEntries(await Promise.all(labSources.map(async p=>[p,sha(await readFile(p))])));
maker=once(maker,'</head>','<style id="field-practice-style-v98">'+css+'</style>\n</head>');
maker=once(maker,'</body>',markup+'\n<script>\nglobalThis.KneekuraFieldPracticeMetadataV98=Object.freeze('+JSON.stringify({...meta,fieldPracticeSources}).replaceAll('<','\\u003c')+');\n'+fieldRenderer+'\n'+fieldDriver+'\n</script>\n</body>');
await writeFile(makerPath,maker);await writeFile(makerPath+'.build.json',JSON.stringify({...makerPrior,...meta,fieldPracticeSources,sha256:sha(maker),bytes:Buffer.byteLength(maker)},null,2)+'\n');
console.log(JSON.stringify({output:makerPath,sha256:sha(maker)}));
