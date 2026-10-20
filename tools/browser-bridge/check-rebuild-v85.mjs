import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const base='../../outputs/にーくら野球メーカー_v85_設定解説と比較切替版.html',
 sha=b=>createHash('sha256').update(b).digest('hex'),suffixes=['','.build.json','.bundle-inputs.json'];
const before=await Promise.all(suffixes.map(s=>readFile(base+s)));
const result=spawnSync(process.execPath,['tools/browser-bridge/build-maker-release-v85.mjs'],{encoding:'utf8'});
assert.equal(result.status,0,result.stderr+'\n'+result.stdout);
const files=[];
for(let i=0;i<suffixes.length;i++){
 const current=await readFile(base+suffixes[i]);assert(before[i].equals(current),'Non-reproducible v85 '+suffixes[i]);
 files.push({suffix:suffixes[i],sha256:sha(current)});
}
await writeFile('docs/verification/releases/v85/rebuild.json',JSON.stringify({pass:true,files},null,2)+'\n');
console.log(JSON.stringify({pass:true,reproducedFiles:files.length}));
