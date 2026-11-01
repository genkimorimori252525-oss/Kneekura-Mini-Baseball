import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const source=resolve('../../outputs/v99-candidate-5'),target=resolve('../../outputs'),backup=resolve('docs/verification/releases/v99/superseded-root'),sha=b=>createHash('sha256').update(b).digest('hex');
const ready=JSON.parse(await readFile('docs/verification/releases/v99/next-ready-green/report.json'));assert.equal(ready.pass,true);
const names=['ばせぼーるlv99_TBD_vs_LAD_守備連携と送球判断版.html','にーくら野球メーカー_v99_信頼と送球動作版.html','カメラワーク調整室_v99_守備の視線版.html'];
const report={scope:'Reversible refresh of generated V99 artifacts; prior root files retained; no user source/old releases removed',source,target,files:[]};
await mkdir(backup,{recursive:true});
for(const name of names){const html=await readFile(resolve(source,name)),meta=JSON.parse(await readFile(resolve(source,name+'.build.json')));assert.equal(sha(html),meta.sha256);
 if(name===names[0])assert.equal(sha(html),ready.sha256);
 const old=await readFile(resolve(target,name)),oldMeta=JSON.parse(await readFile(resolve(target,name+'.build.json')));assert.equal(sha(old),oldMeta.sha256,'refuse to overwrite changed HTML');
 const entries=(await readdir(source)).filter(p=>p===name||p.startsWith(name+'.'));
 for(const path of entries){try{const previous=await readFile(resolve(target,path));await writeFile(resolve(backup,path),previous,{flag:'wx'});}catch(e){if(e.code!=='ENOENT')throw e;}
  await writeFile(resolve(target,path),await readFile(resolve(source,path)));}
 report.files.push({name,beforeSha256:sha(old),afterSha256:sha(html),backup:resolve(backup,name),currentCore:meta.sourceCoreSha256});
}
await writeFile('docs/verification/releases/v99/publish.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
