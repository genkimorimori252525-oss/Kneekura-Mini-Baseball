import {spawnSync} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const dir=resolve(process.argv[2]),out=resolve(process.argv[3]),presentationOnly=process.argv[4]==='--presentation';await mkdir(out,{recursive:true});const results=[];
function run(label,args,timeout=120000){const start=Date.now(),r=spawnSync(process.execPath,args,{encoding:'utf8',timeout,maxBuffer:8*1024*1024});
 console.log(label+'\n'+(r.stdout??'')+(r.stderr??''));results.push({label,exitCode:r.status,elapsedMs:Date.now()-start});if(r.error)throw r.error;assert.equal(r.status,0,label);}
try{
 run('audio-event-and-pack',['--test','tools/browser-bridge/check-audio-v100.test.mjs']);
 if(!presentationOnly)run('typescript',['node_modules/typescript/bin/tsc','--noEmit','--pretty','false']);
 for(const kind of ['game','maker','lab'])run(kind+'-1200-and-390',['tools/browser-bridge/check-scoring-audio-v100.mjs',dir,resolve(out,kind),kind]);
 run('source-and-artifact-linkage',['tools/browser-bridge/check-v100-links.mjs',dir,resolve(out,'linkage')]);
 if(presentationOnly)run('audio-ABBA',['tools/browser-bridge/check-audio-performance-v100.mjs',resolve(dir,'ばせぼーるlv100_TBD_vs_LAD_記録判定と状況音声版.html'),resolve(out,'performance')]);
}finally{await writeFile(resolve(out,'verification.json'),JSON.stringify({pass:results.length===6&&results.every(r=>r.exitCode===0),presentationOnly,results},null,2)+'\n');}
