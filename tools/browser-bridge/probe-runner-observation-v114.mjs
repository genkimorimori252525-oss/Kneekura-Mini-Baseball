// Read-only diagnostic; existing bundle is wrapped in memory, never rebuilt.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';
const sha=b=>createHash('sha256').update(b).digest('hex'),expectedCore='3d0ef3a2477816a3157e59f9a8235e1459913fa35f74f791541c8cee8e885a37';
assert.equal(process.versions.node.split('.')[0],'24');
if(isMainThread){
 const out=resolve(process.argv[2]);assert(out.startsWith(resolve('docs/verification/releases/v114/runner-observation-')));
 mkdirSync(dirname(out),{recursive:true});mkdirSync(out,{recursive:false});
 const bytes=readFileSync('dist/native-match-core-browser.js');assert.equal(sha(bytes),expectedCore);
 const started=performance.now(),reports=[];
 for(const [name,file] of [['deep','fly-probes/deep-RF-17-22-25.json'],['middle','fly-probe-fourth/middle-RF-16-21-24.json']]){
  const path='docs/verification/releases/v95-investigation/'+file,raw=readFileSync(path),input=JSON.parse(raw).input,
   worker=new Worker(new URL(import.meta.url),{workerData:{code:bytes.toString('utf8'),input}}),ready=once(worker,'message'),
   result=new Promise(resolveResult=>{worker.on('message',m=>{if(m.kind==='result'||m.kind==='failure')resolveResult(m);});worker.once('error',e=>resolveResult({kind:'failure',error:String(e)}));});
  await ready;worker.postMessage('go');let timer;
  const row=await Promise.race([result,new Promise(resolveTimeout=>{timer=setTimeout(()=>resolveTimeout({kind:'timeout'}),Math.max(0,55000-(performance.now()-started)));})]);
  clearTimeout(timer);await worker.terminate();
  const report={name,inputPath:path,inputSha256:sha(raw),...row};writeFileSync(resolve(out,name+'.json'),JSON.stringify(report,null,2)+'\n');
  reports.push({name,kind:row.kind,end:row.end,runner:row.runner,estimates:row.estimates?.length});if(row.kind!=='result')break;
 }
 assert.equal(sha(readFileSync('dist/native-match-core-browser.js')),expectedCore);
 const report={coreSha256:expectedCore,wallMs:performance.now()-started,reports,sourceEdited:false};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
 assert.equal(reports.length,2);assert(reports.every(r=>r.kind==='result'),'Both diagnoses must complete within bound');
}else{
 const input=workerData.input,before=JSON.stringify(input),estimates=[];
 const trace=(raw,result)=>{
  estimates.push({observedAtSeconds:raw.observedAtSeconds,nowSeconds:raw.nowSeconds,snapshotKey:raw.snapshotKey,target:raw.target,sources:raw.sources,
   actors:raw.actors,result});return result;
 };
 try{
  const marker='return __toCommonJS(browser_exports);';assert.equal(workerData.code.split(marker).length,2);
  const code=workerData.code.replace(marker,`const originalEstimate=estimateLiveDefenseControlV95;
   estimateLiveDefenseControlV95=(...args)=>trace(args[0],originalEstimate(...args));
   return {simulate:simulateLiveFieldPlayV1};`),api=new Function('trace',code+';return KneekuraNativeMatchCore;')(trace);
  parentPort.postMessage({kind:'ready'});await once(parentPort,'message');
  const result=api.simulate(input);assert.equal(JSON.stringify(input),before);
  const d=result.diagnostics;
  parentPort.postMessage({kind:'result',end:result.end,runner:result.finalRunners.find(r=>r.runnerId==='runner-2'),
   facts:result.facts,ruleFacts:result.ruleFacts,finalRunners:result.finalRunners,estimates,
   runnerDecisions:d.aiTelemetry.runnerDecisions,runnerMotions:d.aiTelemetry.runnerMotions,runnerObservations:d.aiTelemetry.runnerObservationsV95,
   holderDecisions:d.aiTelemetry.holderDecisions,handPreparationProofs:d.handPreparationProofs,throwDecisions:d.throwDecisions,
   inputUnchanged:true});
 }catch(e){parentPort.postMessage({kind:'failure',error:String(e),stack:e.stack});}
}
