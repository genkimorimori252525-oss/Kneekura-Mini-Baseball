import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
const sha=b=>createHash('sha256').update(b).digest('hex'),out=resolve(process.argv[2]),mode=process.argv[3]??'baseline';
await mkdir(out,{recursive:true});
const cases=[...['close-normal','close-first-weak','close-both-weak','separate-first-weak'].map(name=>({name,path:'docs/verification/defense-multiple-approach-2026-10-25/pair-initial/'+name+'.json',nested:true,repetitions:20})),
 {name:'first-base-dive-carry',path:'docs/verification/defense-multiple-approach-2026-10-25/first-base/lateral-one-meter.json',nested:true,repetitions:20},
 {name:'old-slowest',path:'docs/verification/releases/v119/nine-final/slowest-field-input.json',nested:false,repetitions:3}];
if(process.argv.includes('--child')){
 const index=Number(process.argv.at(-1)),c=cases[index],config=JSON.parse(await readFile(out+'/configuration.json','utf8')),
 code=await readFile(mode==='baseline'?out+'/frozen-core.js':config.candidateCore,'utf8'),input=JSON.parse(await readFile(out+'/'+c.name+'-input.json','utf8')),
 seam='return __toCommonJS(browser_exports);',compile=performance.now();
 assert.equal(code.split(seam).length,2);const api=new Function(code.replace(seam,'return {simulate:simulateLiveFieldPlayV1};')+';return KneekuraNativeMatchCore;')(),compileMs=performance.now()-compile;
 global.gc?.();const heapBefore=process.memoryUsage().heapUsed,samples=[],hashes=[],ends=[];
 for(let i=0;i<c.repetitions;i++){
  const at=performance.now(),r=api.simulate(input);samples.push(performance.now()-at);
  hashes.push(sha(JSON.stringify({facts:r.facts,ruleFacts:r.ruleFacts,end:r.end,finalRunners:r.finalRunners})));ends.push(r.end);
 }
 assert.equal(new Set(hashes).size,1,c.name+' repeatability');global.gc?.();
 const sorted=samples.toSorted((a,b)=>a-b),report={name:c.name,mode,repetitions:c.repetitions,sourceCoreSha256:sha(code),inputSha256:sha(JSON.stringify(input)),
  compileMs,coldFirstMs:samples[0],reuseSamplesMs:samples.slice(1),samplesMs:samples,p50:sorted[Math.ceil(sorted.length*.5)-1],
  p95:c.repetitions>=20?sorted[Math.ceil(sorted.length*.95)-1]:null,maximum:sorted.at(-1),retainedHeapBytes:process.memoryUsage().heapUsed-heapBefore,
  stateSha256:hashes[0],end:ends[0],allComplete:ends.every(e=>e.complete)};
 await writeFile(out+'/'+mode+'-'+c.name+'.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({name:c.name,mode,p50:report.p50,maximum:report.maximum,complete:report.allComplete}));
}else{
 if(mode==='baseline'){
  const published=JSON.parse(await readFile('docs/verification/releases/v119/publish.json','utf8')),
   html=await readFile(published.artifacts.find(r=>r.destination.endsWith('.html')&&r.destination.includes('ばせぼーる')).destination,'utf8'),
   code=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).find(s=>s.includes('var KneekuraNativeMatchCore =')).replace(/\n$/,'');
  assert.equal(sha(code),published.sourceCoreSha256);await writeFile(out+'/frozen-core.js',code);
  const pins=JSON.parse(await readFile('dist/native-match-core-browser.js.inputs.json','utf8'));assert.equal(pins.entrySha256,sha(code));
  for(const [p,h]of Object.entries(pins.inputs))assert.equal(sha(await readFile(p)),h,p);
  const config={task:'MB-20261025-COOPERATIVE-DEFENSE-V120',baselineRelease:119,sourceCoreSha256:sha(code),nativeInputs:pins.inputs,
   protectedArtifacts:published.artifacts.map(({destination,sha256})=>({destination,sha256})),candidateCore:'dist/native-match-core-browser.js',
   methodology:'one fresh child process per case, first cold and 19 reuse samples; slow case three samples; serial CPU only',
   budgets:{p95Factor:1.25,p95OffsetMs:25,maximumFactor:1.25,maximumOffsetMs:50,maximumRetainedHeapBytes:64*1024*1024},
   partialPinOnly:true};
  await writeFile(out+'/configuration.json',JSON.stringify(config,null,2)+'\n');
  for(const c of cases){const value=JSON.parse(await readFile(c.path,'utf8'));await writeFile(out+'/'+c.name+'-input.json',JSON.stringify(c.nested?value.input:value)+'\n');}
 }
 for(let i=0;i<cases.length;i++){
  const r=spawnSync(process.execPath,['--expose-gc',import.meta.filename,out,mode,'--child',String(i)],{stdio:'inherit'});
  if(r.error)throw r.error;assert.equal(r.status,0,cases[i].name);
 }
 const rows=await Promise.all(cases.map(c=>readFile(out+'/'+mode+'-'+c.name+'.json','utf8').then(JSON.parse)));
 if(mode!=='baseline')for(const r of rows){const old=JSON.parse(await readFile(out+'/baseline-'+r.name+'.json','utf8'));
  if(old.p95!==null)assert(r.p95<=old.p95*1.25+25,r.name+' p95');assert(r.maximum<=old.maximum*1.25+50,r.name+' maximum');
  assert(r.retainedHeapBytes<=old.retainedHeapBytes+64*1024*1024,r.name+' retained heap');assert(r.allComplete,r.name+' complete');}
 await writeFile(out+'/'+mode+'-summary.json',JSON.stringify({pass:true,mode,cases:rows,parallelSimulationLoads:false,peakHeapMeasured:false},null,2)+'\n');
 console.log(JSON.stringify({pass:true,mode,cases:rows.length}));
}
