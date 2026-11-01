// Isolated exact variant of the two owned V116 changes, over frozen V115 Core.
// No build and no product/dataset edits. Each mode runs in a fresh worker.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';
const sha=b=>createHash('sha256').update(b).digest('hex'),expected='37279e1cd241c54d44bf15b89cbbc1e6f982122218294cd16575cf4697fd28a0';
assert.equal(process.versions.node.split('.')[0],'24');
if(isMainThread){
 const out=resolve('docs/verification/releases/v116/performance-compact-240-1');mkdirSync(out,{recursive:false});
 const code=readFileSync('dist/native-match-core-browser.js','utf8'),file='docs/verification/releases/v115/latency-pitch240-1/field-input.json',raw=readFileSync(file),
  baseline=JSON.parse(readFileSync('docs/verification/releases/v116/profile-240-baseline-inspector/report.json','utf8')),
  owned=['src/core/sim/fielding/LiveThrowPlanV1.ts','src/core/sim/fielding/LiveThrowPhysicalMemoV113.ts'],
  sourceHashes=Object.fromEntries(owned.map(p=>[p,sha(readFileSync(p))]));
 assert.equal(sha(code),expected);assert.equal(sha(raw),baseline.inputSha256);
 const modes=[];
 for(const compact of [false,true]){
  const worker=new Worker(new URL(import.meta.url),{workerData:{code,raw:raw.toString('utf8'),compact}}),ready=once(worker,'message'),
   finished=new Promise(done=>{worker.on('message',m=>{if(m.kind==='result'||m.kind==='error')done(m);});worker.once('error',e=>done({kind:'error',error:String(e.stack??e)}));});
  await ready;const started=performance.now();worker.postMessage('go');let timer;
  const result=await Promise.race([finished,new Promise(done=>{timer=setTimeout(()=>done({kind:'timeout'}),45000);})]);clearTimeout(timer);
  await worker.terminate();modes.push({...result,mode:compact?'compact128':'baseline32',wallMs:performance.now()-started});
 }
 const report={taskId:'MB-20261024-V116',runtime:process.version,node:process.execPath,coreSha256:sha(code),inputSha256:sha(raw),sourceHashes,
  implementation:'Two bounded memory-only seams equivalent to the owned Source compact verification value and 32-to-128 budget change; all other frozen Core bytes retained',
  baselineProof:baseline.proof,modes,allProofsIdentical:modes.every(m=>JSON.stringify(m.proof)===JSON.stringify(baseline.proof)),
  sourceUnchanged:sha(readFileSync(file))===sha(raw)&&owned.every(p=>sha(readFileSync(p))===sourceHashes[p]),
  coreUnchanged:sha(readFileSync('dist/native-match-core-browser.js'))===expected,
  limitations:'Single synthetic/raw regression input and one run per fresh worker; timing is local and not a general benchmark.'};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 assert(modes.every(m=>m.kind==='result'));assert(report.allProofsIdentical&&report.sourceUnchanged&&report.coreUnchanged);
 console.log(JSON.stringify({out,modes:modes.map(m=>({mode:m.mode,wallMs:m.wallMs,memo:m.memo})),allProofsIdentical:true}));
}else{
 let code=workerData.code;
 const patch=(a,b)=>{assert.equal(code.split(a).length,2,'unique seam '+a);code=code.replace(a,b);};
 if(workerData.compact){
  patch('maximumVerificationEntries = options.maximumVerificationEntries ?? Math.min(32, maximumEntries)',
   'maximumVerificationEntries = options.maximumVerificationEntries ?? Math.min(128, maximumEntries)');
  patch('const kernel = memoizeLiveThrowPhysicalV113(\n            "verification",','const verification = memoizeLiveThrowPhysicalV113(\n            "verification",');
  patch('() => createSourceFreeBallKernel({','() => {const verificationKernelV116 = createSourceFreeBallKernel({');
  patch('}),\n            profileNamespace\n          ), verified = kernel.evaluateAt(seconds, "incoming"), verifiedError = norm5(sub6(input.target, verified.moment.ball.position));',
   '});return {verified:verificationKernelV116.evaluateAt(seconds,"incoming"),boundaries:verificationKernelV116.boundaries};},\n            profileNamespace\n          ), verified = verification.verified, verifiedError = norm5(sub6(input.target, verified.moment.ball.position));');
  patch('if (kernel.boundaries.some((b) => b.kind === "ground" && b.elapsedSeconds < seconds) || verifiedError > tolerance) break;',
   'if (verification.boundaries.some((b) => b.kind === "ground" && b.elapsedSeconds < seconds) || verifiedError > tolerance) break;');
 }
 patch('return __toCommonJS(browser_exports);','return {simulate:simulateLiveFieldPlayV1};');
 const api=new Function(code+';return KneekuraNativeMatchCore;')(),input=JSON.parse(workerData.raw);
 parentPort.postMessage({kind:'ready'});await once(parentPort,'message');
 try{const result=api.simulate(input);parentPort.postMessage({kind:'result',proof:Object.fromEntries(['frames','facts','ruleFacts','end'].map(k=>[k,sha(JSON.stringify(result[k]))])),
  end:result.end,memo:result.diagnostics.throwPhysicalMemoV113});}
 catch(e){parentPort.postMessage({kind:'error',error:String(e.stack??e)});}
 await once(parentPort,'message');
}
