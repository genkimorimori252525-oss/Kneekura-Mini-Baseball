import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex'),out=resolve('../../outputs'),cases=[];
for(const name of ['ばせぼーるlv92_TBD_vs_LAD_球種別変化量版.html','にーくら野球メーカー_v92_変化量と後方軌道版.html','カメラワーク調整室_v92_球種別変化量.html']){
 const path=resolve(out,name),meta=JSON.parse(await readFile(path+'.build.json')),bytes=await readFile(path);assert.equal(sha(bytes),meta.sha256,name);
 assert.equal(meta.pitchMovementVersion,92);let coreInputs=0,uiInputs=0;
 if(meta.kind!=='CAMERA_WORKBENCH'){
  const pins=JSON.parse(await readFile(path+'.bundle-inputs.json'));assert.equal(pins.entrySha256,meta.coreSha256??meta.sourceCoreSha256);
  for(const [input,hash]of Object.entries(pins.inputs)){assert.equal(sha(await readFile(input)),hash,input);coreInputs++;}
 }
 for(const [key,map]of Object.entries(meta).filter(([k,v])=>k.endsWith('Sources')&&v&&typeof v==='object'))
  for(const [input,hash]of Object.entries(map)){const source=key==='performanceSources'&&!input.includes('/')?'tools/browser-bridge/'+input:input;assert.equal(sha(await readFile(source)),hash,key+':'+input);uiInputs++;}
 cases.push({name,sha256:meta.sha256,bytes:bytes.length,coreInputs,uiInputs});
}
const report={pass:true,cases};await writeFile('docs/verification/releases/v92/inputs-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
