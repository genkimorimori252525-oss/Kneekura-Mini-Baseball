import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {applyPitchHandUiV97} from './pitch-hand-ui-v97.mjs';

const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 names={game:'ばせぼーるlv97_TBD_vs_LAD_投球手と球種方向の連動版.html',maker:'にーくら野球メーカー_v97_左右投球の矢印連動版.html',lab:'カメラワーク調整室_v97_投球手の方向連動.html'},
 basePath=resolve('../../outputs/ばせぼーるlv96_TBD_vs_LAD_ゾーン表示修正版.html'),base=await readFile(basePath,'utf8'),prior=JSON.parse(await readFile(basePath+'.build.json'));
assert.equal(sha(base),'0ff0e93e82c4f353ce080dc691f7c46bdeab90472ec1ebb46789d5e457bd3a96');
assert.equal(sha(base),prior.sha256);assert.equal(prior.zoneAppearanceVersion,96);
for(const name of Object.values(names))for(const suffix of ['', '.build.json', '.bundle-inputs.json']){
 try{await access(resolve(out,name+suffix));throw Error('Refusing to overwrite '+name+suffix);}catch(e){if(e.code!=='ENOENT')throw e;}
}
function run(args){const r=spawnSync(process.execPath,args,{stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0,'release sub-build failed');}
const once=(text,a,b)=>{assert.equal(text.split(a).length,2,'unique V97 marker '+a.slice(0,80));return text.replace(a,()=>b);};
run(['tools/browser-bridge/build-native.mjs']);
const core=await readFile('dist/native-match-core-browser.js','utf8'),pinsBytes=await readFile('dist/native-match-core-browser.js.inputs.json'),pins=JSON.parse(pinsBytes);
assert.equal(sha(core),pins.entrySha256);assert(pins.inputs['src/integration/browser/LivePitchHandednessV97.ts']);
function replaceCore(html,replacement){let count=0;const result=html.replace(/(<script[^>]*>)([\s\S]*?)(<\/script>)/g,(all,start,body,end)=>{
 if(!body.includes('var KneekuraNativeMatchCore ='))return all;count++;return start+replacement+end;
});assert.equal(count,1);return result;}
const oldTitle='<title>にーくらMINIbaseball v96 ゾーン表示修正</title>',newTitle='<title>にーくらMINIbaseball v97 投球手と球種方向</title>',
 oldLabel='ゾーン表示修正版 96',newLabel='投球手と球種方向の連動版 97';
let game=once(once(replaceCore(base,core+'\n'),oldTitle,newTitle),oldLabel,newLabel);
assert.equal(once(once(replaceCore(game,'__CORE__'),newTitle,'__TITLE__'),newLabel,'__EDITION__'),
 once(once(replaceCore(base,'__CORE__'),oldTitle,'__TITLE__'),oldLabel,'__EDITION__'),'v96 appearance must stay unchanged');
const sourcePaths=['tools/browser-bridge/build-pitch-hand-v97.mjs','tools/browser-bridge/pitch-hand-ui-v97.mjs'],
 pitchHandSources=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await readFile(p))]))),
 paths={pitcher:'docs/demos/baseball-maker-pitcher-v92.js',menu:'docs/demos/baseball-maker-pitch-menu-v82.js',arrows:'docs/demos/baseball-maker-pitch-arrows-v89.js',movement:'docs/demos/baseball-maker-pitch-movement-v92.js'},
 ui=Object.fromEntries(await Promise.all(Object.entries(paths).map(async([key,p])=>[key,await readFile(p,'utf8')]))),patched=applyPitchHandUiV97(ui),
 pitchHandUi=Object.fromEntries(Object.entries(paths).map(([key,path])=>[path,{sourceSha256:sha(ui[key]),patchedSha256:sha(patched[key])}])),
 gamePath=resolve(out,names.game),meta={...prior,releaseVersion:97,pitchHandednessVersion:97,pitchHandSources,pitchHandUi,
 builderSha256:pitchHandSources[sourcePaths[0]],basePresentationPath:basePath,basePresentationSha256:sha(base),sourceCoreChanged:true,
 sourceCoreSha256:sha(core),sourceInputCount:Object.keys(pins.inputs).length,sourceCoreInputCount:Object.keys(pins.inputs).length,
 frozenSourceManifestSha256:sha(pinsBytes),sourceGamePath:gamePath,sourceGameSha256:sha(game),presentationUnchangedOutsideCoreAndReleaseLabels:true};
const driver=await readFile('tools/browser-bridge/camera-workbench-v84.js','utf8');
let lab=await readFile('tools/browser-bridge/camera-workbench-v81.html','utf8');lab=lab.replaceAll('調整室 v81','調整室 v97');
lab=once(lab,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of [[names.game,game,'NORMAL_MATCH'],[names.lab,lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html,{flag:'wx'});await writeFile(path+'.build.json',JSON.stringify({...meta,kind,sha256:sha(html)},null,2)+'\n',{flag:'wx'});
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pinsBytes,{flag:'wx'});
 console.log(JSON.stringify({output:path,sha256:sha(html)}));
}
const makerPath=resolve(out,names.maker);run(['tools/browser-bridge/build-maker-release-v95.mjs',makerPath,gamePath]);
const makerBase=await readFile(makerPath,'utf8'),makerMeta=JSON.parse(await readFile(makerPath+'.build.json'));
assert.equal(sha(makerBase),makerMeta.sha256);
let maker=once(makerBase,'<title>にーくら野球メーカー v95 守備走塁の平均基準</title>','<title>にーくら野球メーカー v97 左右投球の矢印連動</title>');
for(const key of Object.keys(paths))maker=once(maker,ui[key],patched[key]);
await writeFile(makerPath,maker);await writeFile(makerPath+'.build.json',JSON.stringify({...makerMeta,releaseVersion:97,pitchHandednessVersion:97,
 zoneAppearanceVersion:96,zoneAppearance:prior.zoneAppearance,zoneJudgment:prior.zoneJudgment,pitchHandSources,pitchHandUi,
 sha256:sha(maker),bytes:Buffer.byteLength(maker)},null,2)+'\n');
console.log(JSON.stringify({output:makerPath,sha256:sha(maker),sourceCoreSha256:sha(core)}));
