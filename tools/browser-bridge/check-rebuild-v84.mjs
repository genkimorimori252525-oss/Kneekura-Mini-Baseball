import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const sha=b=>createHash('sha256').update(b).digest('hex'),root='docs/demos/releases/v84/',
 names={'game.html':'ばせぼーるlv84_TBD_vs_LAD_描画と接地移動版.html','camera-workbench.html':'カメラワーク調整室_v84_描画と接地移動.html','maker.html':'にーくら野球メーカー_v84_描画と接地移動版.html'};
const expected=JSON.parse(await readFile(root+'SHA256.json')),r=spawnSync(process.execPath,['tools/browser-bridge/build-render-locomotion-v84.mjs'],{encoding:'utf8'});
if(r.status!==0)throw Error(r.stderr+'\n'+r.stdout);
const files=[];
for(const [f,n]of Object.entries(names))for(const suffix of ['', '.build.json',...(f==='camera-workbench.html'?[]:['.bundle-inputs.json'])]){
 const frozen=await readFile(root+f+suffix),current=await readFile('../../outputs/'+n+suffix);
 assert.equal(sha(frozen),expected[f+suffix]);assert(frozen.equals(current),'Non-reproducible artifact '+f+suffix);files.push({file:f+suffix,sha256:sha(current)});
}
await writeFile('docs/verification/releases/v84/rebuild.json',JSON.stringify({pass:true,files},null,2)+'\n');
console.log(JSON.stringify({pass:true,reproducedFiles:files.length}));
