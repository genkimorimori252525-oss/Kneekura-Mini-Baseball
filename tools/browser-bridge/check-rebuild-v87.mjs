import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex'),names=[
 ['ばせぼーるlv87_TBD_vs_LAD_コース認識と打率版.html',['','.build.json','.bundle-inputs.json']],
 ['カメラワーク調整室_v87_コース認識.html',['','.build.json']],
 ['にーくら野球メーカー_v87_コース打率と認識AI版.html',['','.build.json','.bundle-inputs.json']]];
const before=new Map();for(const[name,suffixes]of names)for(const s of suffixes){const path='../../outputs/'+name+s;before.set(path,await readFile(path));}
for(const builder of ['build-course-v87.mjs','build-maker-release-v87.mjs']){const result=spawnSync(process.execPath,['tools/browser-bridge/'+builder],{encoding:'utf8'});assert.equal(result.status,0,result.stderr+'\n'+result.stdout);}
const files=[];for(const[path,prior]of before){const current=await readFile(path);assert(prior.equals(current),'Non-reproducible '+path);files.push({path,sha256:sha(current)});}
await writeFile('docs/verification/releases/v87/rebuild.json',JSON.stringify({pass:true,files},null,2)+'\n');console.log(JSON.stringify({pass:true,reproducedFiles:files.length}));
