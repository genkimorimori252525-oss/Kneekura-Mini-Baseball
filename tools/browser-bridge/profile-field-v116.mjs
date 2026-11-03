// Diagnostic only: profile a frozen raw input without editing Source or dist.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';
import {Session} from 'node:inspector';
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.versions.node.split('.')[0],'24');
if(isMainThread){
 assert(process.argv[2]&&process.argv[3]);const file=resolve(process.argv[2]),out=resolve(process.argv[3]),
  code=readFileSync('dist/native-match-core-browser.js','utf8'),raw=readFileSync(file);
 mkdirSync(out,{recursive:true});const worker=new Worker(new URL(import.meta.url),{workerData:{code,raw:raw.toString('utf8')}}),
  ready=once(worker,'message'),finished=new Promise(done=>{worker.on('message',m=>{if(m.kind==='result'||m.kind==='error')done(m);});worker.once('error',e=>done({kind:'error',error:String(e.stack??e)}));});
 await ready;const start=performance.now();worker.postMessage('go');let timer;
 const result=await Promise.race([finished,new Promise(done=>{timer=setTimeout(()=>done({kind:'timeout'}),120000);})]);clearTimeout(timer);
 assert(result.profile,JSON.stringify(result));const {profile,...summary}=result,nodes=new Map(profile.nodes.map(n=>[n.id,n])),total=(profile.timeDeltas??[]).reduce((a,b)=>a+b,0),self=new Map();
 for(let i=0;i<(profile.samples??[]).length;i++)self.set(profile.samples[i],(self.get(profile.samples[i])??0)+(profile.timeDeltas?.[i]??0));
 const hot=[...self].sort((a,b)=>b[1]-a[1]).slice(0,35).map(([id,us])=>({name:nodes.get(id).callFrame.functionName,line:nodes.get(id).callFrame.lineNumber,percent:100*us/total}));
 const report={...summary,wallMs:performance.now()-start,coreSha256:sha(code),inputSha256:sha(raw),file,runtime:process.version,hot};
 writeFileSync(resolve(out,'cpu-profile.cpuprofile'),JSON.stringify(profile));writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');
 await worker.terminate();assert.equal(sha(readFileSync(file)),sha(raw));assert.equal(sha(readFileSync('dist/native-match-core-browser.js')),sha(code));assert.equal(result.kind,'result',JSON.stringify(summary));
 console.log(JSON.stringify({out,wallMs:report.wallMs,proof:report.proof,hot:hot.slice(0,15)}));
}else{
 const seam='return __toCommonJS(browser_exports);';assert.equal(workerData.code.split(seam).length,2);
 const code=workerData.code.replace(seam,'return {simulate:simulateLiveFieldPlayV1};'),
  api=new Function(code+';return KneekuraNativeMatchCore;')(),input=JSON.parse(workerData.raw);
 parentPort.postMessage({kind:'ready'});await once(parentPort,'message');
 const session=new Session();session.connect();const post=(m)=>new Promise((done,reject)=>session.post(m,(e,r)=>e?reject(e):done(r)));
 await post('Profiler.enable');await post('Profiler.start');let result;
 try{const field=api.simulate(input);assert(field.end.complete);
  const proof=Object.fromEntries(['frames','facts','ruleFacts','end'].map(k=>[k,sha(JSON.stringify(field[k]))]));
  result={kind:'result',proof,end:field.end,actions:field.diagnostics.athleticDecisionsV115??[],frameCount:field.frames.length};
 }catch(e){result={kind:'error',error:String(e.stack??e)};}
 const {profile}=await post('Profiler.stop');session.disconnect();parentPort.postMessage({...result,profile});
 await once(parentPort,'message');
}
