import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {applyZoneOutlineV96} from './zone-outline-v96.mjs';

const out=resolve(process.argv[2]??'../../outputs'),sha=b=>createHash('sha256').update(b).digest('hex'),
 basePath=resolve('../../outputs/verified-v95b/ばせぼーるlv95_TBD_vs_LAD_守備走塁の平均基準版.html'),
 base=await readFile(basePath,'utf8'),prior=JSON.parse(await readFile(basePath+'.build.json')),
 pins=await readFile(basePath+'.bundle-inputs.json'),names={game:'ばせぼーるlv96_TBD_vs_LAD_ゾーン表示修正版.html',
 lab:'カメラワーク調整室_v96_ゾーン表示修正.html',maker:'にーくら野球メーカー_v96_ゾーン表示修正版.html'};
assert.equal(sha(base),prior.sha256);assert.equal(prior.sha256,'07a9e96537461e183d372e0234ec77cea11671b122c70540947e98d5d9e3c978');
for(const name of Object.values(names))for(const suffix of ['', '.build.json', '.bundle-inputs.json']){
 try{await access(resolve(out,name+suffix));throw Error('Refusing to overwrite '+name+suffix);}catch(error){if(error.code!=='ENOENT')throw error;}
}
const once=(text,a,b)=>{assert.equal(text.split(a).length,2,a);return text.replace(a,()=>b);};
let game=applyZoneOutlineV96(base);
game=once(game,'<title>にーくらMINIbaseball v95 守備走塁の平均基準</title>','<title>にーくらMINIbaseball v96 ゾーン表示修正</title>');
game=once(game,'守備走塁の平均基準版 95','ゾーン表示修正版 96');
const native=html=>[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore ='));
assert.equal(native(game),native(base),'presentation repair changed Core');
const viewSources=Object.fromEntries(await Promise.all(['tools/browser-bridge/zone-outline-v96.mjs','tools/browser-bridge/build-zone-appearance-v96.mjs'].map(async p=>[p,sha(await readFile(p))]))),
 gamePath=resolve(out,names.game),meta={...prior,releaseVersion:96,zoneAppearanceVersion:96,
 zoneAppearance:'LEGACY_SINGLE_FOUR_EDGE_OUTLINE',zoneJudgment:'UNCHANGED_V94_VOLUME_AND_PLAYER_ANATOMY',
 basePresentationPath:basePath,basePresentationSha256:sha(base),sourceGamePath:gamePath,sourceGameSha256:sha(game),viewSources};
const driver=await readFile('tools/browser-bridge/camera-workbench-v84.js','utf8');
let lab=await readFile('tools/browser-bridge/camera-workbench-v81.html','utf8');lab=lab.replaceAll('調整室 v81','調整室 v96');
lab=once(lab,'__V73_METADATA__',JSON.stringify(meta).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_EMBEDDED_GAME__',JSON.stringify(game).replaceAll('<','\\u003c'));
lab=once(lab,'__V73_WORKBENCH_DRIVER__',driver);
await mkdir(out,{recursive:true});
for(const[name,html,kind]of [[names.game,game,'NORMAL_MATCH'],[names.lab,lab,'CAMERA_WORKBENCH']]){
 const path=resolve(out,name);await writeFile(path,html,{flag:'wx'});await writeFile(path+'.build.json',JSON.stringify({...meta,kind,sha256:sha(html)},null,2)+'\n',{flag:'wx'});
 if(kind==='NORMAL_MATCH')await writeFile(path+'.bundle-inputs.json',pins,{flag:'wx'});
 console.log(JSON.stringify({output:path,sha256:sha(html)}));
}
const makerPath=resolve(out,names.maker),result=spawnSync(process.execPath,['tools/browser-bridge/build-maker-release-v95.mjs',makerPath,gamePath],{stdio:'inherit'});
if(result.error)throw result.error;assert.equal(result.status,0);
const makerBase=await readFile(makerPath,'utf8'),maker=once(makerBase,'<title>にーくら野球メーカー v95 守備走塁の平均基準</title>','<title>にーくら野球メーカー v96 ゾーン表示修正</title>'),
 makerMeta=JSON.parse(await readFile(makerPath+'.build.json'));
assert.equal(sha(makerBase),makerMeta.sha256);
await writeFile(makerPath,maker);await writeFile(makerPath+'.build.json',JSON.stringify({...makerMeta,releaseVersion:96,
 zoneAppearanceVersion:96,zoneAppearance:meta.zoneAppearance,zoneJudgment:meta.zoneJudgment,viewSources,
 sha256:sha(maker),bytes:Buffer.byteLength(maker)},null,2)+'\n');
console.log(JSON.stringify({output:makerPath,sha256:sha(maker)}));
