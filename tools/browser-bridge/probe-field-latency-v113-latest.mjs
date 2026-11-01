// Diagnostic only: wrap the existing bundle in memory; never rebuild or edit src/dist.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';

const expectedCore='de35397ff34d7e33a756a9622ed997771804d0bb1816bb0f5aab4bff6bc58c58';
const names=['estimateLiveDefenseControlV95','planLiveRelayV1','planLiveTransferActionV110','planLiveThrowV1',
 'createLiveHandPreparationV1','createLiveBodyHandPreparationV105','createSourceFreeBallKernel',
 'createLiveFieldForecastV1','predictLiveDefensiveOpportunityV1','resolveGroundedActorContactResponseV1'];
const hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.versions.node.split('.')[0],'24','Use the pinned Node 24 runtime');

if(isMainThread){
 assert(process.argv[2],'Usage: node probe-field-latency-v113-latest.mjs <new latency-* evidence directory> [timeout-ms]');
 const out=resolve(process.argv[2]),timeoutMs=Number(process.argv[3]??45000);
 assert(out.startsWith(resolve('docs/verification/releases/v113/latency-')),'Evidence must stay in the owned latency-* namespace');
 assert(Number.isSafeInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=60000);
 mkdirSync(dirname(out),{recursive:true});mkdirSync(out,{recursive:false});
 const code=readFileSync('dist/native-match-core-browser.js'),source='docs/verification/releases/v113/slow-user110-field-input.json',
  fixtureBytes=readFileSync(source),input=JSON.parse(fixtureBytes);
 assert.equal(hash(code),expectedCore,'The pinned current core must be unchanged');
 const shared=new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT*128),state=new Int32Array(shared),
  manifest={runtime:process.version,node:process.execPath,coreSha256:hash(code),source,sourceSha256:hash(fixtureBytes),
   fieldInputSha256:hash(JSON.stringify(input)),timeoutMs,wrappedFunctions:names,perCallArgumentFiles:false,progressIntervalMs:1000,physicsOrAbilityChanges:false};
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 const worker=new Worker(new URL(import.meta.url),{workerData:{out,code:code.toString('utf8'),input,shared}}),
  ready=once(worker,'message'),result=new Promise(resolveResult=>{
   worker.on('message',event=>{if(event.kind==='result'||event.kind==='failure')resolveResult(event);});
   worker.once('error',error=>resolveResult({kind:'failure',error:String(error),stack:error.stack}));
  });
 await ready;
 const profile=await worker.startCpuProfile(),start=performance.now();
 let previous='';
 const interval=setInterval(()=>{
  const row={wallMs:performance.now()-start,time:Atomics.load(state,0)/1e6,plans:Atomics.load(state,1),
   stack:Array.from({length:Atomics.load(state,2)},(_,i)=>names[Atomics.load(state,16+i)]),
   callCounts:Object.fromEntries(names.map((name,i)=>[name,Atomics.load(state,64+i)]))},signature=JSON.stringify(row);
  if(signature!==previous){appendFileSync(resolve(out,'progress.jsonl'),signature+'\n');previous=signature;}
 },1000);
 worker.postMessage('go');
 let timer;const outcome=await Promise.race([result,new Promise(resolveTimeout=>{timer=setTimeout(()=>resolveTimeout({kind:'timeout'}),timeoutMs);})]);
 clearTimeout(timer);clearInterval(interval);
 try{writeFileSync(resolve(out,'cpu-profile.cpuprofile'),await profile.stop());}
 catch(error){writeFileSync(resolve(out,'profile-error.txt'),String(error));}
 const summary={...outcome,wallMs:performance.now()-start,time:Atomics.load(state,0)/1e6,plans:Atomics.load(state,1),
  activeStack:Array.from({length:Atomics.load(state,2)},(_,i)=>names[Atomics.load(state,16+i)]),
  callCounts:Object.fromEntries(names.map((name,i)=>[name,Atomics.load(state,64+i)])),manifest};
 writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n');await worker.terminate();
 assert.equal(hash(readFileSync('dist/native-match-core-browser.js')),manifest.coreSha256);
 console.log(JSON.stringify({out,kind:summary.kind,wallMs:summary.wallMs,time:summary.time,activeStack:summary.activeStack}));
}else{
 const {out,input,shared}=workerData,state=new Int32Array(shared),stack=[];
 const step=t=>{Atomics.store(state,0,Math.round(t*1e6));Atomics.add(state,1,1);};
 const trace=(name,args,invoke)=>{
  const index=names.indexOf(name);Atomics.add(state,64+index,1);stack.push(index);
  Atomics.store(state,16+stack.length-1,index);Atomics.store(state,2,stack.length);
  const time=Atomics.load(state,0)/1e6,start=performance.now();
  if(name==='planLiveThrowV1'){
   const a=args[0],canonical=JSON.stringify(a,(_key,value)=>{
    if(typeof value!=='number')return value;const bytes=Buffer.allocUnsafe(8);bytes.writeDoubleBE(value);return 'f64:'+bytes.toString('hex');
   });
   // Small per-solve metadata only; the full input is never written here.
   appendFileSync(resolve(out,'throw-requests.jsonl'),JSON.stringify({time,fingerprint:hash(canonical),caller:stack.slice(0,-1).map(i=>names[i]),
    releasePosition:a.releasePosition,target:a.target,maximumThrowSpeedMps:a.maximumThrowSpeedMps,
    effort:a.effortSelectionV103,seamScale:a.physics?.air?.aerodynamics?.seamForce?.coefficientScale??0})+'\n');
  }
  try{return invoke();}finally{
   if(performance.now()-start>=50)appendFileSync(resolve(out,'slow-calls.jsonl'),JSON.stringify({time,name,ms:performance.now()-start})+'\n');
   stack.pop();Atomics.store(state,2,stack.length);
  }
 };
 let code=workerData.code;
 const planNeedle='plan(time, controlThrough);';assert.equal(code.split(planNeedle).length,2);
 code=code.replace(planNeedle,'step(time);plan(time, controlThrough);');
 const end='return __toCommonJS(browser_exports);';assert.equal(code.split(end).length,2);
 const wrappers=names.map(name=>`const original_${name}=${name};${name}=(...args)=>trace(${JSON.stringify(name)},args,()=>original_${name}(...args));`).join('\n');
 code=code.replace(end,wrappers+'\nreturn {simulateField:simulateLiveFieldPlayV1};');
 const api=new Function('trace','step',code+';return KneekuraNativeMatchCore;')(trace,step);
 parentPort.postMessage({kind:'ready'});await once(parentPort,'message');
 try{
  const result=api.simulateField(input);writeFileSync(resolve(out,'field-result.json'),JSON.stringify(result));
  parentPort.postMessage({kind:'result',end:result.end});
 }catch(error){parentPort.postMessage({kind:'failure',error:String(error),stack:error.stack});}
}
