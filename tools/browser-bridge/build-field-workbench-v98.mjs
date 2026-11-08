import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';

const args=process.argv.slice(2),perfOnly=args.includes('--perf-only'),out=resolve(args.find(a=>!a.startsWith('--'))??(perfOnly?'../../outputs/v98-perf':'../../outputs')),
 sha=b=>createHash('sha256').update(b).digest('hex'),basePath=resolve('../../outputs/ばせぼーるlv97_TBD_vs_LAD_投球手と球種方向の連動版.html'),
 base=await readFile(basePath,'utf8'),prior=JSON.parse(await readFile(basePath+'.build.json')),
 names={game:'ばせぼーるlv98_TBD_vs_LAD_生成待ち改善と守備初動版.html',maker:'にーくら野球メーカー_v98_守備練習統合版.html',
 lab:'カメラワーク調整室_v98_性能改善と守備初動.html'};
assert.equal(sha(base),'252b7a9808b1d234e1d26777a8b781905f56a05f236864d8388d494843b9caa6');assert.equal(sha(base),prior.sha256);
function once(text,a,b){assert.equal(text.split(a).length,2,'unique V98 marker: '+a.slice(0,90));return text.replace(a,()=>b);}
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0,'V98 sub-build failed');}
for(const name of Object.values(perfOnly?{game:names.game}:names))for(const suffix of ['', '.build.json', '.bundle-inputs.json']){
 try{await access(resolve(out,name+suffix));throw Error('Refusing to overwrite '+name+suffix);}catch(e){if(e.code!=='ENOENT')throw e;}
}
run(['tools/browser-bridge/build-native.mjs']);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinBytes);
assert.equal(sha(core),pins.entrySha256);
for(const p of ['src/core/sim/ball/ImmutablePhysicsParametersV98.ts','src/integration/browser/FieldPracticeWorkbenchV98.ts'])assert(pins.inputs[p],p);
// A replaced NativeCore contains the current TS inputs, even when an older
// feature-specific provenance map was inherited from the frozen presentation.
// Refresh only inputs proved by this bundle; retain each previous pin as history.
const priorForCurrentCore={...prior},refreshedCoreSourcePinsV98=[];
for(const [group,map]of Object.entries(prior))if(group.endsWith('Sources')&&map&&typeof map==='object'){
 const next={...map};for(const [path,oldHash]of Object.entries(map))if(pins.inputs[path]&&pins.inputs[path]!==oldHash){
  next[path]=pins.inputs[path];refreshedCoreSourcePinsV98.push({group,path,previousSha256:oldHash,currentSha256:pins.inputs[path]});
 }priorForCurrentCore[group]=next;
}
const replaceCore=(html,replacement)=>{let n=0;const result=html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,body,end)=>{
 if(!body.includes('var KneekuraNativeMatchCore ='))return all;n++;return start+replacement+end;
});assert.equal(n,1);return result;};
const rosterPattern=/(<script\b(?=[^>]*\bid="v40-physical-roster")[^>]*>)([\s\S]*?)(<\/script>)/g;
function replaceRoster(html,roster){let n=0;const result=html.replace(rosterPattern,(all,start,body,end)=>{
 n++;assert.deepEqual(JSON.parse(body),JSON.parse(oldRoster));return start+JSON.stringify(roster).replaceAll('<','\\u003c')+end;
});assert.equal(n,1,'normal initial roster tag');return result;}
const oldRoster=await readFile('docs/demos/live-game-roster-v62.json','utf8'),rosterPath=perfOnly?'docs/demos/live-game-roster-v62.json':'docs/demos/live-game-roster-v98.json',
 roster=JSON.parse(await readFile(rosterPath,'utf8')),oldTitle='<title>にーくらMINIbaseball v97 投球手と球種方向</title>',
 newTitle='<title>にーくらMINIbaseball v98 生成待ち改善と守備初動</title>',oldLabel='投球手と球種方向の連動版 97',newLabel='生成待ち改善と守備初動版 98';
let game=once(once(replaceCore(base,core+'\n'),oldTitle,newTitle),oldLabel,newLabel);
if(!perfOnly)game=replaceRoster(game,roster);
const scrub=html=>replaceCore(html,'__CORE__').replace(rosterPattern,'__INITIAL_ROSTER__');
assert.equal(once(once(scrub(game),newTitle,'__TITLE__'),newLabel,'__EDITION__'),once(once(scrub(base),oldTitle,'__TITLE__'),oldLabel,'__EDITION__'),'unrequested V97 presentation change');
const sourcePaths=['tools/browser-bridge/build-field-workbench-v98.mjs',rosterPath,'tools/browser-bridge/pitch-hand-ui-v97.mjs'],v98Sources=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(p))]))),
 gamePath=resolve(out,names.game),meta={...priorForCurrentCore,refreshedCoreSourcePinsV98,releaseVersion:98,performanceVersion:98,fieldPracticeVersion:98,defenseReactionVersion:98,
 fieldReactionInitialLadScale:perfOnly?1:.8,performanceOnlyOldRoster:perfOnly,v98Sources,basePresentationPath:basePath,basePresentationSha256:sha(base),
 builderSha256:v98Sources[sourcePaths[0]],sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,
 frozenSourceManifestSha256:sha(pinBytes),sourceGamePath:gamePath,sourceGameSha256:sha(game),initialRosterSource:rosterPath,initialRosterSha256:sha(await readFile(rosterPath)),
 presentationUnchangedOutsideCoreReleaseLabelsAndInitialRoster:true};
await mkdir(out,{recursive:true});
async function emit(name,html,kind,extras={},bundle){const path=resolve(out,name);await writeFile(path,html,{flag:'wx'});
 await writeFile(path+'.build.json',JSON.stringify({...meta,kind,...extras,sha256:sha(html),bytes:Buffer.byteLength(html)},null,2)+'\n',{flag:'wx'});
 if(bundle)await writeFile(path+'.bundle-inputs.json',bundle,{flag:'wx'});console.log(JSON.stringify({output:path,sha256:sha(html),sourceCoreSha256:sha(core)}));}
await emit(names.game,game,'NORMAL_MATCH',{},pinBytes);
if(perfOnly)process.exit(0);

const driverPath='tools/browser-bridge/camera-workbench-v84.js',templatePath='tools/browser-bridge/camera-workbench-v81.html',
 driver=await readFile(driverPath,'utf8'),template=await readFile(templatePath,'utf8'),
 cameraWorkbenchSources={[driverPath]:sha(driver),[templatePath]:sha(template)};
let lab=template.replaceAll('調整室 v81','調整室 v98');
lab=once(lab,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await emit(names.lab,lab,'CAMERA_WORKBENCH',{cameraWorkbenchSources});

const makerPath=resolve(out,names.maker);
run(['tools/browser-bridge/build-maker.mjs',makerPath,'--executable-traits','--measured-library','--ball-comparison','--batter-comparison','--bat-orbit','--player-swing-preview',
 '--whole-arc','--equipment-preview','--technical-traits','--ball-display-fix','--pitcher-workbench','--pitch-library','--pitch-views','--course-seasons','--pitch-menu',
 '--lossless-performance','--maker-recovery','--presentation-v84','--maker-guides','--maker-validation','--course-map-v87','--playback-v88','--pitch-arrows-v89',
 '--maker-editor-v90','--pitch-movement-v92','--rules-v94','--roster='+rosterPath,'--catalog=docs/demos/live-game-roster-catalog-v77.json','--match-renderer='+gamePath]);
let maker=await readFile(makerPath,'utf8');const makerPrior=JSON.parse(await readFile(makerPath+'.build.json'));assert.equal(sha(maker),makerPrior.sha256);
const uiPaths={pitcher:'docs/demos/baseball-maker-pitcher-v92.js',menu:'docs/demos/baseball-maker-pitch-menu-v82.js',arrows:'docs/demos/baseball-maker-pitch-arrows-v89.js',movement:'docs/demos/baseball-maker-pitch-movement-v92.js'},
 ui=Object.fromEntries(await Promise.all(Object.entries(uiPaths).map(async([k,p])=>[k,await readFile(p,'utf8')]))),patched=applyPitchHandUiV97(ui);
for(const k of Object.keys(uiPaths))maker=once(maker,ui[k],patched[k]);
maker=once(maker,'<title>にーくら野球メーカー v94</title>','<title>にーくら野球メーカー v98 守備練習統合</title>');
const labSources=['tools/browser-bridge/maker-field-practice-v98.html','tools/browser-bridge/maker-field-practice-v98.css',
 'tools/browser-bridge/field-practice-renderer-v98.js','tools/browser-bridge/field-workbench-v98.js'],
 fieldPracticeSources=Object.fromEntries(await Promise.all(labSources.map(async p=>[p,sha(await readFile(p))]))),
 [markup,css,renderer,fieldDriver]=await Promise.all(labSources.map(p=>readFile(p,'utf8')));
assert(!/<\/script/i.test(renderer+'\n'+fieldDriver),'field practice closing script');
assert(!maker.includes('id="field-practice-panel"'),'field practice already installed');
maker=once(maker,'</head>','<style id="field-practice-style-v98">'+css+'</style>\n</head>');
const metadata='globalThis.KneekuraFieldPracticeMetadataV98=Object.freeze('+JSON.stringify({...meta,fieldPracticeSources}).replaceAll('<','\\u003c')+');';
maker=once(maker,'</body>',markup+'\n<script>\n'+metadata+'\n'+renderer+'\n'+fieldDriver+'\n</script>\n</body>');
await writeFile(makerPath,maker);await writeFile(makerPath+'.build.json',JSON.stringify({...makerPrior,releaseVersion:98,fieldVersion:95,rulesVersion:94,
 defenseReactionVersion:98,performanceVersion:98,pitchHandednessVersion:97,zoneAppearanceVersion:96,zoneAppearance:prior.zoneAppearance,
 sourceCoreSha256:sha(core),fieldCoreSha256:sha(core),v98Sources,fieldPracticeSources,fieldPracticeVersion:98,
 fieldReactionInitialLadScale:.8,sha256:sha(maker),bytes:Buffer.byteLength(maker)},null,2)+'\n');
console.log(JSON.stringify({output:makerPath,sha256:sha(maker)}));
