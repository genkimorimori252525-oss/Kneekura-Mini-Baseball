// Read-only exact-key audit; it never skips or changes a product computation.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {once} from 'node:events';
const sha=b=>createHash('sha256').update(b).digest('hex'),expected='37279e1cd241c54d44bf15b89cbbc1e6f982122218294cd16575cf4697fd28a0';
assert.equal(process.versions.node.split('.')[0],'24');
if(isMainThread){
 const out=resolve(process.argv[2]??'docs/verification/releases/v116/performance-cache-240-1');
 assert(out.startsWith(resolve('docs/verification/releases/v116/performance-')));mkdirSync(out,{recursive:false});
 const source='docs/verification/releases/v115/latency-pitch240-1/field-input.json',raw=readFileSync(source),code=readFileSync('dist/native-match-core-browser.js','utf8');
 assert.equal(sha(code),expected);const baseline=JSON.parse(readFileSync('docs/verification/releases/v116/profile-240-baseline-inspector/report.json','utf8'));
 assert.equal(baseline.inputSha256,sha(raw));assert.equal(baseline.coreSha256,expected);
 const worker=new Worker(new URL(import.meta.url),{workerData:{code,raw:raw.toString('utf8')}}),ready=once(worker,'message'),
  result=new Promise(done=>{worker.on('message',m=>{if(m.kind==='result'||m.kind==='error')done(m);});worker.once('error',e=>done({kind:'error',error:String(e.stack??e)}));});
 await ready;const start=performance.now();worker.postMessage('go');let timer;
 const outcome=await Promise.race([result,new Promise(done=>{timer=setTimeout(()=>done({kind:'timeout'}),55000);})]);clearTimeout(timer);
 await worker.terminate();const report={...outcome,wallMs:performance.now()-start,coreSha256:expected,inputSha256:sha(raw),runtime:process.version,
  sourceUnchanged:sha(readFileSync(source))===sha(raw),coreUnchanged:sha(readFileSync('dist/native-match-core-browser.js'))===expected,
  baselineProof:baseline.proof,proofIdentical:JSON.stringify(outcome.proof)===JSON.stringify(baseline.proof)};
 writeFileSync(resolve(out,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 assert.equal(report.kind,'result');assert(report.proofIdentical);assert(report.sourceUnchanged&&report.coreUnchanged);
 console.log(JSON.stringify({out,wallMs:report.wallMs,proofIdentical:report.proofIdentical,audit:report.audit}));
}else{
 const memo=new Map(),plans=new Map(),geometries=new Map(),relays=new Map(),verificationPrefixes=new Map(),limit=65536,
  shadows=[32,64,128,256,512,1024].map(max=>({maximumVerificationEntries:max,entries:new Map(),verification:new Map(),shootingHits:0,shootingMisses:0,verificationHits:0,verificationMisses:0}));
 let dropped=0,planRepeatMs=0,relayRepeatMs=0,verificationShorterPrefixCalls=0,verificationDifferentHorizonCalls=0;
 const put=(map,key,create)=>{let entry=map.get(key);if(entry)return entry;if(map.size>=limit){dropped++;return null;}entry=create();map.set(key,entry);return entry;};
 const auditMemo=(kind,key,hit)=>{
  for(const shadow of shadows){
   const cached=shadow.entries.has(key),counter=kind+(cached?'Hits':'Misses');shadow[counter]++;
   const remove=k=>{if(shadow.entries.get(k)==='verification')shadow.verification.delete(k);shadow.entries.delete(k);};
   if(cached){shadow.entries.delete(key);shadow.entries.set(key,kind);if(kind==='verification'){shadow.verification.delete(key);shadow.verification.set(key,true);}continue;}
   if(kind==='verification'&&shadow.verification.size>=shadow.maximumVerificationEntries)remove(shadow.verification.keys().next().value);
   if(shadow.entries.size>=2048)remove(shadow.entries.keys().next().value);
   shadow.entries.set(key,kind);if(kind==='verification')shadow.verification.set(key,true);
  }
  const e=put(memo,key,()=>({kind,calls:0,hits:0,misses:0,repeatMisses:0}));if(!e)return;
  e.calls++;if(hit)e.hits++;else{if(e.misses>0)e.repeatMisses++;e.misses++;}};
 const auditVerification=(key,seconds)=>{const e=put(verificationPrefixes,key,()=>({calls:0,horizons:new Set(),maximum:-Infinity}));if(!e)return;
  if(e.calls&&seconds<e.maximum)verificationShorterPrefixCalls++;if(e.horizons.size&&!e.horizons.has(seconds))verificationDifferentHorizonCalls++;
  e.calls++;e.horizons.add(seconds);e.maximum=Math.max(e.maximum,seconds);};
 const auditPlan=(name,full,geometry,invoke)=>{const map=name==='planLiveRelayV1'?relays:plans,e=put(map,full,()=>({calls:0,ms:0})),
  g=name==='planLiveThrowV1'?put(geometries,geometry,()=>({calls:0,full:new Set()})):null;
  if(g){g.calls++;g.full.add(full);}const repeated=!!e?.calls,start=performance.now();
  const result=invoke(),ms=performance.now()-start;if(e){e.calls++;e.ms+=ms;}if(repeated){if(name==='planLiveRelayV1')relayRepeatMs+=ms;else planRepeatMs+=ms;}return result;};
 let code=workerData.code;
 const patch=(a,b)=>{assert.equal(code.split(a).length,2,a);code=code.replace(a,b);};
 patch('const id8 = kind + ":" + (namespace ? "n" + namespace.id + ":" : "k:") + key3(), cached = context3.entries.get(id8);',
  'const id8 = kind + ":" + (namespace ? "n" + namespace.id + ":" : "k:") + key3(), cached = context3.entries.get(id8);auditMemo(kind,id8,!!cached);');
 patch('verificationKernelBuilds++;','verificationKernelBuilds++;auditVerification(exactLiveThrowPhysicalKeyV113([profileNamespace?.id,initial(velocity),input.materialOrientationAtRelease]),seconds);');
 patch('return __toCommonJS(browser_exports);',`const original_throw_audit=planLiveThrowV1,original_relay_audit=planLiveRelayV1;
 planLiveThrowV1=raw=>auditPlan('planLiveThrowV1',exactLiveThrowPhysicalKeyV113(raw),exactLiveThrowPhysicalKeyV113({...raw,effortSelectionV103:undefined,preferredFlightSecondsV103:undefined}),()=>original_throw_audit(raw));
 planLiveRelayV1=raw=>auditPlan('planLiveRelayV1',exactLiveThrowPhysicalKeyV113(raw),'',()=>original_relay_audit(raw));
 return {simulate:simulateLiveFieldPlayV1};`);
 const api=new Function('auditMemo','auditVerification','auditPlan',code+';return KneekuraNativeMatchCore;')(auditMemo,auditVerification,auditPlan),input=JSON.parse(workerData.raw);
 parentPort.postMessage({kind:'ready'});await once(parentPort,'message');
 try{
  const field=api.simulate(input),proof=Object.fromEntries(['frames','facts','ruleFacts','end'].map(k=>[k,sha(JSON.stringify(field[k]))])),
   totals=kind=>[...memo.values()].filter(e=>e.kind===kind).reduce((a,e)=>({unique:a.unique+1,calls:a.calls+e.calls,hits:a.hits+e.hits,misses:a.misses+e.misses,repeatMisses:a.repeatMisses+e.repeatMisses}),{unique:0,calls:0,hits:0,misses:0,repeatMisses:0}),
   calls=map=>({unique:map.size,calls:[...map.values()].reduce((s,e)=>s+e.calls,0),repeatCalls:[...map.values()].reduce((s,e)=>s+e.calls-1,0)}),
   audit={memo:{shooting:totals('shooting'),verification:totals('verification'),finalStats:field.diagnostics.throwPhysicalMemoV113},
    plans:{...calls(plans),repeatInclusiveMs:planRepeatMs,geometryGroups:geometries.size,geometryRepeatCalls:[...geometries.values()].reduce((s,e)=>s+e.calls-1,0),
      differingTimingGroups:[...geometries.values()].filter(e=>e.full.size>1).length},relays:{...calls(relays),repeatInclusiveMs:relayRepeatMs},
    verification:{prefixGroups:verificationPrefixes.size,calls:[...verificationPrefixes.values()].reduce((s,e)=>s+e.calls,0),
      multipleHorizonGroups:[...verificationPrefixes.values()].filter(e=>e.horizons.size>1).length,verificationShorterPrefixCalls,verificationDifferentHorizonCalls},
    shadowLru:shadows.map(({entries,verification,...stats})=>({...stats,retainedEntries:entries.size,retainedVerificationEntries:verification.size})),
    keyCapacity:limit,droppedDiagnosticKeys:dropped};
  assert.equal(audit.shadowLru[0].shootingHits,audit.memo.shooting.hits);assert.equal(audit.shadowLru[0].shootingMisses,audit.memo.shooting.misses);
  assert.equal(audit.shadowLru[0].verificationHits,audit.memo.verification.hits);assert.equal(audit.shadowLru[0].verificationMisses,audit.memo.verification.misses);
  parentPort.postMessage({kind:'result',proof,end:field.end,audit});
 }catch(e){parentPort.postMessage({kind:'error',error:String(e.stack??e)});}
 await once(parentPort,'message');
}
