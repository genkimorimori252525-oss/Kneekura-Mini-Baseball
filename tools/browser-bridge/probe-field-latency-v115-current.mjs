// Diagnostic only. Source/dist/raw input are never edited.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';
const expectedCore='04f87009b147a92c412848369bf5c7674570dd13f212666b7514084b93f6dd02',
 names=['estimateLiveDefenseControlV95','planLiveRelayV1','planLiveTransferActionV110','planLiveThrowV1'],
 hash=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.versions.node.split('.')[0],'24');
if(isMainThread){
 const out=resolve('docs/verification/releases/v115/latency-pitch240-1');mkdirSync(out,{recursive:false});
 const source='docs/verification/releases/v115/nine-innings/last-field-input.json',bytes=readFileSync(source),input=JSON.parse(bytes),
  code=readFileSync('dist/native-match-core-browser.js'),shared=new SharedArrayBuffer(128*4),state=new Int32Array(shared);
 assert.equal(hash(code),expectedCore);writeFileSync(resolve(out,'field-input.json'),bytes,{flag:'wx'});
 const manifest={taskId:'MB-20261024-V115',source,sourceSha256:hash(bytes),coreSha256:hash(code),runtime:process.version,node:process.execPath,
  sourceImmediatelyAfterCopySha256:hash(readFileSync(source)),timeoutMs:45000,parentTimeoutMs:48000,wrappedFunctions:names,
  sourceOrDistChanged:false,hugeArgumentFiles:false,logIntervalMs:1000};
 assert.equal(manifest.sourceSha256,manifest.sourceImmediatelyAfterCopySha256);
 writeFileSync(resolve(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 const worker=new Worker(new URL(import.meta.url),{workerData:{code:code.toString('utf8'),input,out,shared}}),
  ready=once(worker,'message'),result=new Promise(done=>{worker.on('message',m=>{if(m.kind==='result'||m.kind==='failure')done(m);});worker.once('error',e=>done({kind:'failure',error:String(e),stack:e.stack}));});
 await ready;const profile=await worker.startCpuProfile(),start=performance.now(),
  snapshot=()=>({wallMs:performance.now()-start,time:Atomics.load(state,0)/1e6,plans:Atomics.load(state,1),loops:Atomics.load(state,3),throws:Atomics.load(state,4),
   stack:Array.from({length:Math.min(40,Atomics.load(state,2))},(_,i)=>names[Atomics.load(state,16+i)]),
   counts:Object.fromEntries(names.map((n,i)=>[n,Atomics.load(state,64+i)]))}),
  interval=setInterval(()=>appendFileSync(resolve(out,'progress.jsonl'),JSON.stringify(snapshot())+'\n'),1000);
 worker.postMessage('go');let timer;
 const outcome=await Promise.race([result,new Promise(done=>{timer=setTimeout(()=>done({kind:'timeout'}),48000);})]);
 clearTimeout(timer);clearInterval(interval);
 try{writeFileSync(resolve(out,'cpu-profile.cpuprofile'),await profile.stop(),{flag:'wx'});}catch(e){writeFileSync(resolve(out,'profile-error.txt'),String(e));}
 const summary={...outcome,...snapshot(),manifest,sourceCurrentSha256:hash(readFileSync(source)),
  coreAfterSha256:hash(readFileSync('dist/native-match-core-browser.js')),safeCopyAfterSha256:hash(readFileSync(resolve(out,'field-input.json')))};
 writeFileSync(resolve(out,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});await worker.terminate();
 assert.equal(summary.coreAfterSha256,expectedCore);assert.equal(summary.safeCopyAfterSha256,manifest.sourceSha256);
 console.log(JSON.stringify({out,kind:summary.kind,wallMs:summary.wallMs,time:summary.time,loops:summary.loops,plans:summary.plans,throws:summary.throws,stack:summary.stack}));
}else{
 const {input,out,shared}=workerData,state=new Int32Array(shared),stack=[];let start=0,lastLog=-Infinity,lastBoundary=null,lastLoop=null,lastPlan=null;
 const diag=(kind,t,detail)=>{
  if(Number.isFinite(t))Atomics.store(state,0,Math.round(t*1e6));
  if(kind==='loop')Atomics.add(state,3,1);if(kind==='plan')Atomics.add(state,1,1);if(kind==='throw')Atomics.add(state,4,1);
  lastBoundary={kind,time:t,detail};if(kind==='loop')lastLoop=lastBoundary;if(kind==='plan')lastPlan=lastBoundary;
  const wallMs=performance.now()-start;
  if(kind==='invalid_motor')writeFileSync(resolve(out,'invalid-motor.json'),JSON.stringify({wallMs,...lastBoundary,lastLoop,lastPlan},null,2)+'\n',{flag:'wx'});
  if(wallMs-lastLog>=1000||kind==='throw'||kind==='invalid_motor'){
   appendFileSync(resolve(out,'boundaries.jsonl'),JSON.stringify({wallMs,...lastBoundary,stack:stack.map(i=>names[i]),loops:Atomics.load(state,3),plans:Atomics.load(state,1),throws:Atomics.load(state,4)})+'\n');lastLog=wallMs;
  }
  if(wallMs>=45000)throw Error('DIAGNOSTIC_WALL_LIMIT_V115');
 };
 const trace=(name,invoke)=>{
  const i=names.indexOf(name);Atomics.add(state,64+i,1);stack.push(i);Atomics.store(state,16+stack.length-1,i);Atomics.store(state,2,stack.length);
  const at=performance.now();diag('call',Atomics.load(state,0)/1e6,{name});
  try{return invoke();}finally{
   if(performance.now()-at>=250)appendFileSync(resolve(out,'slow-calls.jsonl'),JSON.stringify({name,time:Atomics.load(state,0)/1e6,wallMs:performance.now()-start,ms:performance.now()-at})+'\n');
   stack.pop();Atomics.store(state,2,stack.length);
  }
 };
 let code=workerData.code;
 const patch=(a,b)=>{assert.equal(code.split(a).length,2,'unique '+a);code=code.replace(a,b);};
 const athletic='defenders.filter(f=>f.athleticV115).map(f=>({playerId:f.spec.playerId,kind:f.athleticV115.kind,phase:f.athleticV115.sampleAtElapsedSeconds(time).phase,landedSeconds:f.athleticV115.landedSeconds,throughSeconds:f.athleticV115.throughSeconds}))';
 patch('while (time < max && !terminal) {','while (time < max && !terminal) {\ndiag("loop",time,{controlThrough,releaseAt,holder:possession?.spec.playerId??null,targetBase:throwTarget?.base??null,thrower:throwTarget?.throwerPlayerId??null,athletic:'+athletic+'});');
 patch('const plan = (t, plannedThrough) => {','const plan = (t, plannedThrough) => {\ndiag("plan",t,{plannedThrough,holder:possession?.spec.playerId??null,athletic:'+athletic.replaceAll('(time)','(t)')+'});');
 patch('assert15(norm9(a.velocity) <= a.topSpeedMps + 1e-9 && validMotor(a, a.preferred, dt), "preferred motor violates speed, acceleration or stopping constraints");',
  'if(!(norm9(a.velocity) <= a.topSpeedMps + 1e-9 && validMotor(a,a.preferred,dt)))diag("invalid_motor",input.fromSeconds,{fromSeconds:input.fromSeconds,throughSeconds:input.throughSeconds,dt,actor:{playerId:a.playerId,position:a.position,velocity:a.velocity,preferred:a.preferred,accelerationMps2:a.accelerationMps2,topSpeedMps:a.topSpeedMps,locomotionProfile:a.locomotionProfile,canSteer:a.canSteer},speed:norm9(a.velocity),accelerationBudget:accelerationBudget(a,a.preferred.acceleration),motorValid:validMotor(a,a.preferred,dt)});\nassert15(norm9(a.velocity) <= a.topSpeedMps + 1e-9 && validMotor(a, a.preferred, dt), "preferred motor violates speed, acceleration or stopping constraints");');
 patch('emit("throw_release", time, {','diag("throw",time,{playerId:f.spec.playerId,base:target.base});\nemit("throw_release", time, {');
 const wrappers=names.map(n=>`const original_${n}=${n};${n}=(...args)=>trace(${JSON.stringify(n)},()=>original_${n}(...args));`).join('\n');
 patch('return __toCommonJS(browser_exports);',wrappers+'\nreturn {simulateField:simulateLiveFieldPlayV1};');
 const api=new Function('diag','trace',code+';return KneekuraNativeMatchCore;')(diag,trace);
 parentPort.postMessage({kind:'ready'});await once(parentPort,'message');start=performance.now();
 try{const result=api.simulateField(input);parentPort.postMessage({kind:'result',end:result.end,factCount:result.facts.length});}
 catch(error){parentPort.postMessage({kind:'failure',error:String(error),stack:error.stack,lastBoundary,lastLoop,lastPlan});}
}
