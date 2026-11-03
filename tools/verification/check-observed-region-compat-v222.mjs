import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseDebugRecord,stringifyDebugRecord } from './live-debug-record.mjs';
import { verifyPinnedLiveCore } from './live-debug-core.mjs';
if(process.argv[2]==='--maker-qa-r3') {
 const {createRequire}=await import('node:module'),{pathToFileURL}=await import('node:url');
 const dir='docs/verification/realism-debug-20261027/candidate-maker-observed-region-v222-01',html=dir+'/maker.html',out=dir+'/integration-v222-report-r3.json';
 const r2Report=dir+'/integration-v222-report-r2.json',r2Archive=dir+'/r2-qa-harness.referenced-source.txt',r2Receipt='docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_43b7827df28e436db2ee8b195d273bcc.json';
 const nativeManifest='docs/verification/realism-debug-20261027/candidate-observed-region-native-v222-01/manifest.json',wbManifest='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/manifest.json';
 const currentHarness='tools/verification/check-observed-region-compat-v222.mjs',diagnostic=dir+'/normal-init-observation-v222.json';
 const sha=b=>createHash('sha256').update(b).digest('hex'),pin=async p=>{const b=await readFile(p);return {bytes:b.length,sha256:sha(b)}};
 const result={pass:false,scope:'V222_REMAINING_TWO_NORMAL_IFRAMES_AND_390_ONLY',cases:[],errors:[],consoleErrors:[],requests:[],
  reused1200Practice:true,reuseReason:'R2_PARTIAL_CASE1_SUCCEEDED_WITHOUT_END_PINS; NO_PRACTICE_REEXECUTION',r2Overall:'FAIL',r2OriginalEndPinsUnknown:true,performancePass:false};let browser;
 try{
  const receipt=JSON.parse(await readFile(r2Receipt,'utf8')),prior=JSON.parse(await readFile(r2Report,'utf8'));
  assert.equal(receipt.result,'FAIL');assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');
  assert.deepEqual(receipt.command,['node',currentHarness,'--maker-qa']);assert.equal(sha(await readFile(receipt.output_path)),receipt.output_sha256);
  assert.equal((await pin(r2Report)).sha256,'d131a2b9da014a1d76a157783576a49da7e4c3a410e46bd672f9b1f76c8238e9');
  assert.equal((await pin(r2Archive)).sha256,'3b292e172537d72fe9c97268da73cc59008c2e5bdaaf6cb5019a57c93c5a6b93');
  assert.equal((await pin(diagnostic)).sha256,'48a32169a59508aaddf5c7a4e0e0e7276858910facffdee80c896409f681df86');
  assert.equal(prior.pass,false);assert.equal(prior.cases.length,1);const accepted=prior.cases[0];assert.equal(accepted.width,1200);
  for(const key of ['workerHostFullRecordAndRng','previewNoncommit','pairedSamples','regionMeanExact','regionPriorActuallyMixed','unknownFamily','continuationExact','newUiResumeNextExact','oldUiRestoreExact'])assert.equal(accepted[key],true,key);
  assert.equal(accepted.oldBuildNegativeRejected,5);assert.equal(accepted.region45Members.length,2);
  for(const [path,oldPin] of Object.entries(prior.inputPins)){const source=path===currentHarness?r2Archive:path;assert.deepEqual(await pin(source),oldPin,'r2 start pin changed: '+path)}
  result.r2PartialCase1=accepted;result.r2Receipt=r2Receipt;result.r2StartPinsMatchR3Start=true;
  const additional=[r2Receipt,receipt.output_path,r2Report,r2Archive,diagnostic,currentHarness];
  const start=Object.fromEntries(await Promise.all(additional.map(async p=>[p,await pin(p)])));result.r3AdditionalStartPins=start;
  assert.equal((await pin(html)).sha256,'cdfadbaf8ed1a0e857bc6a3282ad162cd6d4cbcb9584715ab9b1556060c48067');
  await verifyPinnedLiveCore({manifestPath:nativeManifest});await verifyPinnedLiveCore({manifestPath:wbManifest});
  const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});result.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:1200,height:1050}});
  await context.addInitScript(()=>{const original=Worker.prototype.postMessage;window.__v222WorkerInits=[];Worker.prototype.postMessage=function(message,...rest){
   if(message?.kind==='init'&&message.configuration){const c=message.configuration;window.__v222WorkerInits.push(structuredClone({batterObservationV151:c.batterObservationV151,
     batterDirectionMotorV153:c.batterDirectionMotorV153,randomnessV152:c.randomnessV152,batterObservedRegionExperienceV222:c.batterObservedRegionExperienceV222}));}
   return original.call(this,message,...rest)};});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')result.consoleErrors.push(m.text())});
  page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))result.requests.push(r.url())});
  await page.goto(pathToFileURL(resolve(html)).href,{timeout:120000});await page.waitForFunction(()=>globalThis.KneekuraBattingPractice&&globalThis.KneekuraReferenceBatMotions,null,{timeout:90000});
  const suite=await page.evaluate(()=>({batterObservationV151:KneekuraBaseballWorkbench.AUTHORED_LIVE_BATTER_OBSERVATION_V151,
   batterDirectionMotorV153:KneekuraBaseballWorkbench.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:KneekuraBaseballWorkbench.AUTHORED_MATCH_RANDOMNESS_V152,
   batterObservedRegionExperienceV222:KneekuraBaseballWorkbench.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222}));
  const library=await page.evaluate(()=>({clips:KneekuraReferenceBatMotions.clips.length,frames:KneekuraReferenceBatMotions.clips.reduce((n,c)=>n+c.frames.length,0)}));
  assert.equal(library.clips,673);assert.equal(library.frames,92201);result.parentLibrary=library;
  for(const owner of ['KneekuraMakerMatchHtmlV70','KneekuraMakerPitcherMatchHtmlV77']){
   const element=await page.evaluateHandle(key=>{const iframe=document.createElement('iframe');iframe.dataset.qaOwner=key;
    iframe.srcdoc=window[key];document.body.append(iframe);return iframe},owner);
   const frame=await element.asElement().contentFrame();assert(frame,'normal game iframe unavailable');
   await frame.waitForFunction(()=>{if(!globalThis.liveMatchPlayback)return false;const announcement=document.getElementById('announcement')?.textContent??'';
    try{return !!liveMatchPlayback.inspect().host||announcement.includes('Core処理を停止')}catch{return announcement.includes('Core処理を停止')}},null,{timeout:90000});
   const ready=await frame.evaluate(()=>{const announcement=document.getElementById('announcement')?.textContent??'';
    try{const state=liveMatchPlayback.inspect();return {ready:!!state.host,error:state.error,announcement,hasObserved:!!state.host?.batterObservedMemoryV151,hasRegion:!!state.host?.batterObservedRegionExperienceV222}}
    catch(e){return {ready:false,error:String(e),announcement}}});
   assert(ready.ready&&!ready.error&&!ready.announcement.includes('Core処理を停止'),owner+' initialization failed: '+JSON.stringify(ready));
   assert(ready.hasObserved&&ready.hasRegion,owner+' Host policy absent');
   await frame.locator('#next-pitch').click();await frame.waitForFunction(()=>window.__v222WorkerInits?.length>0,null,{timeout:90000});
   const seen=await frame.evaluate(()=>window.__v222WorkerInits[0]);for(const k of Object.keys(suite))assert.deepEqual(seen[k],suite[k],owner+' real Worker '+k+' differs');
   result.cases.push({owner,hostReady:true,hostObservedAndRegion:true,workerConfigExact:true});await element.dispose();
   await page.evaluate(key=>document.querySelector('iframe[data-qa-owner="'+key+'"]')?.remove(),owner);
  }
  const smallContext=await browser.newContext({viewport:{width:390,height:1050}}),small=await smallContext.newPage();try{
   await small.goto(pathToFileURL(resolve(html)).href,{timeout:120000});await small.waitForFunction(()=>globalThis.KneekuraBattingPractice,null,{timeout:90000});
   await small.locator('#tab-bat').click();assert(await small.locator('#batting-practice-editor').isVisible());
   const bounds=await small.locator('#batting-practice-editor').evaluate(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,client:e.clientWidth,scroll:e.scrollWidth}));
   assert(bounds.left>=-1&&bounds.right<=391&&bounds.scroll<=bounds.client+1);result.cases.push({width:390,initialDisplay:true,bounds});
  }finally{await small.close();await smallContext.close()}
  await page.close();await context.close();assert.deepEqual(result.errors,[]);assert.deepEqual(result.consoleErrors,[]);assert.deepEqual(result.requests,[]);
  for(const [path,oldPin] of Object.entries(prior.inputPins)){const source=path===currentHarness?r2Archive:path;assert.deepEqual(await pin(source),oldPin,'r2 input changed at r3 end: '+path)}
  for(const p of additional)assert.deepEqual(await pin(p),start[p],p+' changed');
  await verifyPinnedLiveCore({manifestPath:nativeManifest});await verifyPinnedLiveCore({manifestPath:wbManifest});
  result.r3EndPinsEqual=true;result.transitiveR2InputsStableThroughR3=true;result.pass=true;
 }catch(error){result.error=String(error.stack??error);process.exitCode=1}finally{if(browser)await browser.close();await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'})}
 console.log(JSON.stringify({pass:result.pass,cases:result.cases.length,error:result.error??null}));
} else if(process.argv[2]==='--maker-qa') {
 const {createRequire}=await import('node:module'),{pathToFileURL}=await import('node:url');
 const folder='docs/verification/realism-debug-20261027/candidate-maker-observed-region-v222-01',htmlPath=folder+'/maker.html',out=folder+'/integration-v222-report-r2.json';
 const nativeManifest='docs/verification/realism-debug-20261027/candidate-observed-region-native-v222-01/manifest.json',newManifest='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/manifest.json';
 const oldBundle='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-workbench-current-01/batting-workbench-core.js';
 const fixturePath='docs/verification/realism-debug-20261027/ui-direction-motor-practice-02/practice-1200.json';
 const proofPath='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/browser-old-workbench-compat-proof.json';
 const inputs=[htmlPath,folder+'/manifest.json',nativeManifest,newManifest,oldBundle,fixturePath,proofPath,
  'docs/verification/realism-debug-20261027/candidate-maker-direction-practice-current-01/maker.html',
  'docs/demos/baseball-maker-batting-practice-v150.js','docs/demos/baseball-maker-ui-v94.mjs','docs/demos/baseball-maker-pitcher-v92.js',
  'docs/demos/baseball-maker-ball-comparison-v69.js','tools/verification/prepare-maker-direction.mjs','tools/browser-bridge/background-match-v116.mjs',
  'tools/verification/live-debug-core.mjs','tools/verification/live-debug-record.mjs','tools/verification/check-observed-region-compat-v222.mjs',
  'docs/demos/measured-bat-library-v1.json','tools/browser-bridge/measured-bat-library-v1.js',
  'tools/browser-bridge/maker-match-renderer-v94.js','tools/browser-bridge/maker-pitcher-renderer-v94.js',
  'tools/verification/live-debug-case.mjs','docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_01adc2e6ca2c4094b00e25acd7826dd6.json',
  'docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/browser-compat-harness.referenced-source.txt',
  'docs/verification/realism-debug-20261027/candidate-maker-observed-region-v222-01/failed-qa-harness.referenced-source.txt',
  'docs/verification/realism-debug-20261027/candidate-maker-observed-region-v222-01/integration-v222-report.json',
  'docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_439949061cb643c99f007db36d4c1b1c.json'];
 const sha=x=>createHash('sha256').update(x).digest('hex'),pin=async p=>{const b=await readFile(p);return {bytes:b.length,sha256:sha(b)}};
 const result={pass:false,scope:'MAKER_V222_SINGLE_SYNTHETIC_FIXTURE_NOT_FAMILY_OR_HUMAN_CALIBRATION',cases:[],errors:[],requests:[],performancePass:false};let browser;
 try{
  const start=Object.fromEntries(await Promise.all(inputs.map(async p=>[p,await pin(p)])));result.inputPins=start;
  assert.equal(start[htmlPath].sha256,'cdfadbaf8ed1a0e857bc6a3282ad162cd6d4cbcb9584715ab9b1556060c48067');
  assert.equal(start[proofPath].sha256,'43fc46c6bc80d1e4c41f60c71d13eeab6697994f0b55dbaf9b3c79e8314e136b');
  assert.equal(start[oldBundle].sha256,'2b954cb4d974957954331ba8c4378c593cf45a09ace32ca0c0147b7dd7675dc2');
  const native=await verifyPinnedLiveCore({manifestPath:nativeManifest}),wb=await verifyPinnedLiveCore({manifestPath:newManifest});
  const candidate=JSON.parse(await readFile(folder+'/manifest.json','utf8'));assert.equal(candidate.htmlSha256,start[htmlPath].sha256);
  assert.equal(candidate.nativeCoreSha256,native.manifest.entry.sha256);assert.equal(candidate.workbenchCoreSha256,wb.manifest.entry.sha256);
  const fixture=parseDebugRecord(await readFile(fixturePath,'utf8')),oldCode=await readFile(oldBundle,'utf8');
  const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});result.browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:1200,height:1050}});
  await context.addInitScript(()=>{const original=Worker.prototype.postMessage;window.__v222WorkerInits=[];Worker.prototype.postMessage=function(message,...rest){
    if(message?.kind==='init'&&message.configuration){const c=message.configuration;window.__v222WorkerInits.push(structuredClone({batterObservationV151:c.batterObservationV151,
      batterDirectionMotorV153:c.batterDirectionMotorV153,randomnessV152:c.randomnessV152,batterObservedRegionExperienceV222:c.batterObservedRegionExperienceV222}));}
    return original.call(this,message,...rest);};});
  const page=await context.newPage();page.on('pageerror',e=>result.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))result.requests.push(r.url())});
  await page.goto(pathToFileURL(resolve(htmlPath)).href,{timeout:120000});await page.waitForFunction(()=>globalThis.KneekuraBattingPractice&&globalThis.baseballMaker,null,{timeout:90000});
  await page.locator('#tab-player').click();await page.locator('#live-roster-player').selectOption('1-b0');await page.locator('#tab-bat').click();
  await page.locator('#comparison-pitcher').selectOption('0-p0');await page.locator('#comparison-seed').fill('20261019');await page.locator('#practice-batting').selectOption('take');
  await page.evaluate(()=>KneekuraBattingPractice.start());
  const initial=await page.evaluate(async code=>{const codec=KneekuraBattingPracticeCodecV150,s=codec.parse(await KneekuraBattingPractice.exportText());
    globalThis.__nativeApiV222=new Function(code+';return KneekuraNativeMatchCore;')();
    globalThis.__hostV222=__nativeApiV222.createLiveBaseballMatchWorkerV116(s.capture.configuration);return {configuration:s.capture.configuration,build:s.build}},native.code);
  assert.equal(initial.configuration.measuredClips.length,673);assert.equal(initial.configuration.measuredClips.reduce((n,c)=>n+c.frames.length,0),92201);
  assert.equal(initial.configuration.batterObservedRegionExperienceV222.version,'batter_observed_region_experience_policy_v222');
  assert.equal(initial.configuration.batterObservationV151.version,'live_batter_observation_v151');assert.equal(initial.configuration.batterDirectionMotorV153.version,'observed_direction_motor_v153');
  const records=[];for(let i=0;i<3;i++)records.push(await page.evaluate(async()=>{const a=await KneekuraBattingPractice.next(),b=__hostV222.issuePitch(a.record.command),c=KneekuraBattingPracticeCodecV150;
    return {exact:c.stringify(a.record)===c.stringify(b),rngExact:c.stringify(a.record.play.diagnostics.randomnessV152)===c.stringify(b.play.diagnostics.randomnessV152)}}));
  assert(records.every(r=>r.exact&&r.rngExact));
  const prepared=await page.evaluate(async()=>{const codec=KneekuraBattingPracticeCodecV150,text=await KneekuraBattingPractice.exportText(),s=codec.parse(text),
    practice=KneekuraBaseballWorkbench.createLiveBattingPracticeV150(s.capture.configuration,s.capture),before=codec.stringify(practice.capture()),preview=practice.preview({batting:'take',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'maker-continuous-practice-v150',mode:document.getElementById('comparison-direction').value}});
    return {capture:s.capture,before,after:codec.stringify(practice.capture()),preview:preview.record}});
  assert.equal(prepared.before,prepared.after);const memories=prepared.capture.continuation.batterObservedMemoryV151.memories;
  const pair=memories.find(m=>m.observerPlayerId==='1-b0'&&m.pitcherId==='0-p0');assert(pair);const same=pair.entries.filter(e=>e.regionId==='45');assert.equal(same.length,2);
  const sides=prepared.capture.continuation.batterObservedRegionExperienceV222.entries;
  for(const e of pair.entries){const side=sides.find(x=>x.evidenceId===e.evidenceId);assert(side);assert.deepEqual(side.samples.map(x=>x.observationId),e.sourceObservationIds);
    assert.equal(side.rawForecast.cutoffTick,e.availableTick);assert.equal(side.accelerationBasis,side.samples.length===2?'TWO_SAMPLE_ZERO_ASSUMED':'THREE_SAMPLE_ESTIMATED');assert.equal(side.familyId,null);assert.equal(side.confidence,null);assert.equal(side.familyRecognized,false);assert.equal(side.humanCalibration,'NOT_MEASURED');}
  const fourth=await page.evaluate(async()=>{const a=await KneekuraBattingPractice.next(),b=__hostV222.issuePitch(a.record.command),c=KneekuraBattingPracticeCodecV150;
    return {record:a.record,exact:c.stringify(a.record)===c.stringify(b),rngExact:c.stringify(a.record.play.diagnostics.randomnessV152)===c.stringify(b.play.diagnostics.randomnessV152),capture:c.parse(await KneekuraBattingPractice.exportText()).capture,
      hostCapture:__hostV222.captureContinuationV116()}});
  assert(fourth.exact&&fourth.rngExact);assert.deepEqual(fourth.capture.continuation,fourth.hostCapture);assert.deepEqual(fourth.record,prepared.preview);
  const recall=fourth.record.play.diagnostics.batterObservedRegionExperienceV222.recall;assert.equal(recall.regionId,'45');assert.deepEqual(recall.memberEvidenceIds,same.map(e=>e.evidenceId));
  for(const axis of ['x','y','z'])assert.equal(recall.position[axis],same.reduce((n,e)=>n+e.position[axis],0)/same.length);
  assert.equal(recall.arrivalAfterReleaseSeconds,same.reduce((n,e)=>n+e.arrivalAfterReleaseSeconds,0)/same.length);
  assert.notDeepEqual(recall.position,same.find(e=>e.evidenceId===recall.selectedEvidenceId).position);
  const observation=fourth.record.play.diagnostics.batterObservationV151,raw=observation.rawForecast.prediction,weight=observation.effectivePriorWeight;
  assert(raw&&weight>0);assert.equal(observation.preparedPredictionOwner,'UNCLASSIFIED_EXPERIENCE_V151');
  assert.deepEqual(observation.preparedRecall.position,recall.position);assert.equal(observation.preparedRecall.arrivalAfterReleaseSeconds,recall.arrivalAfterReleaseSeconds);
  const prediction=observation.preparedAndObservedPrediction;
  assert.equal(prediction.x,raw.position.x*(1-weight)+recall.position.x*weight);
  assert.equal(prediction.y,raw.position.y*(1-weight)+recall.position.y*weight);assert.equal(prediction.z,raw.position.z);
  const snap=fourth.record.play.diagnostics.batterObservedRegionExperienceV222.snapshot;
  assert.equal(observation.preparedAndObservedArrivalAfterReleaseSeconds,Math.max((observation.decisionTick-snap.originTick)/snap.ticksPerSecond,
    raw.arrivalAfterReleaseSeconds*(1-weight)+recall.arrivalAfterReleaseSeconds*weight));
  assert.notDeepEqual(prediction,raw.position);

  const resumedNew=await page.evaluate(async()=>{const codec=KneekuraBattingPracticeCodecV150,saved=await KneekuraBattingPractice.exportText(),first=await KneekuraBattingPractice.next();
    await KneekuraBattingPractice.restore(saved);const second=await KneekuraBattingPractice.next();
    return {nextRecordExact:codec.stringify(first.record)===codec.stringify(second.record),nextStateExact:codec.stringify(first.state)===codec.stringify(second.state)};});
  assert(resumedNew.nextRecordExact&&resumedNew.nextStateExact);

  const legacy=await page.evaluate(async({code,configuration,oldBuild})=>{const codec=KneekuraBattingPracticeCodecV150,old=new Function(code+';return KneekuraBaseballWorkbench;')(),p=old.createLiveBattingPracticeV150(configuration),
    req={batting:'take',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'maker-continuous-practice-v150',mode:'AUTO'}},record=p.issuePitch(req),capture=p.capture(),
    count=m=>m.balls+'B '+m.strikes+'S '+m.outs+'O',row={pitchCount:1,batterPlayerId:record.batterPlayerId,pitcherPlayerId:record.pitcherPlayerId,classification:record.play.classification,call:record.play.call,
      beforeCount:count(record.beforeMatch),afterCount:count(record.match),direction:'AUTO',batting:'take',battingDirectionV149:record.play.diagnostics.battingDirectionV149,batterAdvanced:record.play.rules.batterAdvanced},
    saved={version:'maker_batting_practice_v150',authority:'LOCAL_DEBUG_ARTIFACT_NOT_NATIVE',build:oldBuild,capture,context:{startingBatterId:record.batterPlayerId,pitcherId:record.pitcherPlayerId},rows:[row]};
    const variants=[{...saved,build:{...oldBuild,extra:1}},{...saved,build:{workbenchSha256:oldBuild.workbenchSha256}},
      {...saved,build:{...oldBuild,workbenchSha256:'d62b888004ad9baa723c3f316200a39c815d50667f4d7def2521194773ed7201'}},
      {...saved,capture:{...capture,configuration:{...capture.configuration,batterObservedRegionExperienceV222:KneekuraBaseballWorkbench.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222}}},
      {...saved,capture:{...capture,continuation:{...capture.continuation,batterObservedRegionExperienceV222:{policyBinding:'x',entries:[]}}}}];
    let rejected=0;for(const variant of variants)try{await KneekuraBattingPractice.restore(codec.stringify(variant))}catch{rejected++}
    await KneekuraBattingPractice.restore(codec.stringify(saved));const resumed=await KneekuraBattingPractice.next(),expected=p.issuePitch(req);
    return {rejected,fullRecordExact:codec.stringify(resumed.record)===codec.stringify(expected),oldConfigPreserved:!Object.hasOwn(codec.parse(await KneekuraBattingPractice.exportText()).capture.configuration,'batterObservedRegionExperienceV222')};
  },{code:oldCode,configuration:fixture.capture.configuration,oldBuild:candidate.compatibilityV222.oldBuild});
  assert.equal(legacy.rejected,5);assert(legacy.fullRecordExact&&legacy.oldConfigPreserved);
  result.cases.push({width:1200,workerHostFullRecordAndRng:true,previewNoncommit:true,pairedSamples:true,region45Members:recall.memberEvidenceIds,
    regionMeanExact:true,regionPriorActuallyMixed:true,unknownFamily:true,continuationExact:true,newUiResumeNextExact:true,oldUiRestoreExact:true,oldBuildNegativeRejected:legacy.rejected});
  const suite=await page.evaluate(()=>({batterObservationV151:KneekuraBaseballWorkbench.AUTHORED_LIVE_BATTER_OBSERVATION_V151,batterDirectionMotorV153:KneekuraBaseballWorkbench.AUTHORED_OBSERVED_DIRECTION_MOTOR_V153,randomnessV152:KneekuraBaseballWorkbench.AUTHORED_MATCH_RANDOMNESS_V152,batterObservedRegionExperienceV222:KneekuraBaseballWorkbench.AUTHORED_BATTER_OBSERVED_REGION_EXPERIENCE_V222}));
  const gameUrls=await page.evaluate(()=>[KneekuraMakerMatchHtmlV70,KneekuraMakerPitcherMatchHtmlV77].map(html=>URL.createObjectURL(new Blob([html],{type:'text/html'}))));
  for(const url of gameUrls){const game=await context.newPage();game.on('pageerror',e=>result.errors.push(String(e)));try{
    await game.goto(url,{timeout:120000});await game.waitForFunction(()=>globalThis.liveMatchPlayback,null,{timeout:90000});
    const host=await game.evaluate(()=>liveMatchPlayback.inspect().host);assert(host.batterObservedMemoryV151);assert(host.batterObservedRegionExperienceV222);
    await game.locator('#next-pitch').click();await game.waitForFunction(()=>window.__v222WorkerInits.length>0,null,{timeout:90000});
    const seen=await game.evaluate(()=>window.__v222WorkerInits[0]);for(const k of ['batterObservationV151','batterDirectionMotorV153','randomnessV152','batterObservedRegionExperienceV222'])assert.deepEqual(seen[k],suite[k],k+' differs in real Worker init');
    result.cases.push({normalGameWorkerSuite:true,workerConfig:seen});
   }finally{await game.close()}}
  const smallContext=await browser.newContext({viewport:{width:390,height:1050}}),small=await smallContext.newPage();try{await small.goto(pathToFileURL(resolve(htmlPath)).href,{timeout:120000});
   await small.waitForFunction(()=>globalThis.KneekuraBattingPractice,null,{timeout:90000});await small.locator('#tab-bat').click();assert(await small.locator('#batting-practice-editor').isVisible());
   const bounds=await small.locator('#batting-practice-editor').evaluate(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right,client:e.clientWidth,scroll:e.scrollWidth}));
   assert(bounds.left>=-1&&bounds.right<=391&&bounds.scroll<=bounds.client+1);result.cases.push({width:390,initialDisplay:true,bounds});}finally{await small.close();await smallContext.close()}
  await page.close();await context.close();assert.deepEqual(result.errors,[]);assert.deepEqual(result.requests,[]);
  for(const p of inputs)assert.deepEqual(await pin(p),start[p]);await verifyPinnedLiveCore({manifestPath:nativeManifest});await verifyPinnedLiveCore({manifestPath:newManifest});
  result.endPinsEqual=true;result.pass=true;
 }catch(error){result.error=String(error.stack??error);process.exitCode=1}finally{if(browser)await browser.close();await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'})}
 console.log(JSON.stringify({pass:result.pass,cases:result.cases.length,error:result.error??null}));
} else if(process.argv[2]==='--browser-compat') {
  const {createRequire}=await import('node:module'),{pathToFileURL}=await import('node:url');
  const out='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/browser-old-workbench-compat-proof.json';
  const oldHtml='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-current-01/maker.html';
  const oldManifest='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-workbench-current-01/manifest.json';
  const newManifest='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/manifest.json';
  const fixturePath='docs/verification/realism-debug-20261027/ui-direction-motor-practice-02/practice-1200.json';
  const inputs=[oldHtml,oldManifest,newManifest,fixturePath,'docs/verification/realism-debug-20261027/candidate-maker-direction-practice-current-01/manifest.json',
    'docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_4ff9502360504dac845f4b89cfb43864.json',
    'tools/verification/check-observed-region-compat-v222.mjs','tools/verification/live-debug-record.mjs','tools/verification/live-debug-core.mjs'];
  const sha=x=>createHash('sha256').update(x).digest('hex'),pin=async p=>{const b=await readFile(p);return {bytes:b.length,sha256:sha(b)}};
  let browser;const result={pass:false,scope:'CHROME_SINGLE_OLD_4FF_TO_NEW_WORKBENCH_CAPTURE_NOT_UNIVERSAL_COMPATIBILITY'};
  try{
    const start=Object.fromEntries(await Promise.all(inputs.map(async p=>[p,await pin(p)])));result.inputPins=start;
    assert.equal(start[oldHtml].sha256,'36cc176a94e15f61f677a9aa62288bce8da87561b036c1a90f7f8b5b15a41ea1');
    const old=JSON.parse(await readFile(oldManifest,'utf8')),current=await verifyPinnedLiveCore({manifestPath:newManifest});
    const html=await readFile(oldHtml,'utf8'),embedded=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].filter(m=>m[1].includes('var KneekuraBaseballWorkbench =')&&m[1].includes('__toCommonJS'));
    assert.equal(embedded.length,1);assert.equal(sha(embedded[0][1].slice(0,-1)),old.entry.sha256);
    assert.equal(old.entry.sha256,'2b954cb4d974957954331ba8c4378c593cf45a09ace32ca0c0147b7dd7675dc2');
    assert.equal(current.manifest.entry.sha256,'e7a5d07bb12c423d503930e2af8a2c1bb3d71e563d02f8b44b39b0b569337fae');
    const fixture=parseDebugRecord(await readFile(fixturePath,'utf8'));assert(!Object.hasOwn(fixture.capture.configuration,'batterObservedRegionExperienceV222'));
    const {chromium}=createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
    browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});result.browserVersion=browser.version();
    const page=await browser.newPage();try{
      await page.goto(pathToFileURL(resolve(oldHtml)).href,{timeout:120000});await page.waitForFunction(()=>globalThis.KneekuraBaseballWorkbench&&globalThis.KneekuraBattingPracticeCodecV150,null,{timeout:90000});
      const compared=await page.evaluate(({code,configuration})=>{
        const old=KneekuraBaseballWorkbench,current=new Function(code+';return KneekuraBaseballWorkbench;')(),codec=KneekuraBattingPracticeCodecV150;
        const request={batting:'take',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v222-compat-fixture',mode:'AUTO'}};
        const first=old.createLiveBattingPracticeV150(configuration);first.issuePitch(request);const capture=first.capture();
        const prior=old.createLiveBattingPracticeV150(configuration,capture),next=current.createLiveBattingPracticeV150(configuration,capture);
        const a=prior.issuePitch(request),b=next.issuePitch(request),ca=prior.capture(),cb=next.capture();
        return {oldBuild:structuredClone(KneekuraBattingPracticeBuildV150),oldConfigOmittedV222:!Object.hasOwn(configuration,'batterObservedRegionExperienceV222'),oldSidecarAbsent:!Object.hasOwn(capture.continuation,'batterObservedRegionExperienceV222'),
          nextRecordExact:codec.stringify(a)===codec.stringify(b),nextCaptureExact:codec.stringify(ca)===codec.stringify(cb),
          rngTraceExact:codec.stringify(a.play.diagnostics.randomnessV152)===codec.stringify(b.play.diagnostics.randomnessV152),
          oldCaptureText:codec.stringify(capture),recordText:codec.stringify(a),nextCaptureText:codec.stringify(ca)};
      },{code:current.code,configuration:fixture.capture.configuration});
      assert.deepEqual(compared.oldBuild,{workbenchSha256:old.entry.sha256,practiceUiSha256:'f5f634e9403ba156434f8cf4d72e0a61b21919ad738693debd9df7ce83bb0115'});
      result.oldBuild=compared.oldBuild;result.targetBuild=null;result.uiCompatibilityGateReady=false;
      for(const key of ['oldConfigOmittedV222','oldSidecarAbsent','nextRecordExact','nextCaptureExact','rngTraceExact'])assert.equal(compared[key],true,key);
      Object.assign(result,{oldCaptureSha256:sha(compared.oldCaptureText),recordSha256:sha(compared.recordText),nextCaptureSha256:sha(compared.nextCaptureText),
        oldCaptureCreatedInOld4ffHtml:true,oldConfigOmittedV222:true,oldSidecarAbsent:true,nextRecordExact:true,nextCaptureExact:true,rngTraceExact:true});
    }finally{await page.close()}
    for(const p of inputs)assert.deepEqual(await pin(p),start[p],p+' changed');await verifyPinnedLiveCore({manifestPath:newManifest});
    Object.assign(result,{oldWorkbenchSha256:old.entry.sha256,newWorkbenchSha256:current.manifest.entry.sha256,
      endPinsEqual:true,pass:true});
  }catch(error){result.error=String(error.stack??error);process.exitCode=1}finally{if(browser)await browser.close();await writeFile(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'})}
  console.log(JSON.stringify({pass:result.pass,scope:result.scope,error:result.error??null}));
} else {
const oldManifest='docs/verification/realism-debug-20261027/candidate-maker-direction-practice-workbench-current-01/manifest.json';
const newManifest='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/manifest.json';
const input='docs/verification/realism-debug-20261027/ui-direction-motor-practice-02/practice-1200.json';
const proof='docs/verification/realism-debug-20261027/candidate-observed-region-workbench-v222-01/old-workbench-compat-proof.json';
const sha=x=>createHash('sha256').update(x).digest('hex'),pin=async p=>{const b=await readFile(p);return {bytes:b.length,sha256:sha(b)}};
const paths=[oldManifest,newManifest,input,'docs/verification/realism-debug-20261027/candidate-maker-direction-practice-current-01/manifest.json',
 'docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_4ff9502360504dac845f4b89cfb43864.json',
 'tools/verification/check-observed-region-compat-v222.mjs','tools/verification/live-debug-record.mjs','tools/verification/live-debug-core.mjs'];
const start=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await pin(p)])));
const old=JSON.parse(await readFile(oldManifest,'utf8')),oldPath=resolve('docs/verification/realism-debug-20261027/candidate-maker-direction-practice-workbench-current-01',old.entry.path),
 oldBytes=await readFile(oldPath),current=await verifyPinnedLiveCore({manifestPath:newManifest});
assert.equal(old.entry.sha256,'2b954cb4d974957954331ba8c4378c593cf45a09ace32ca0c0147b7dd7675dc2');assert.equal(sha(oldBytes),old.entry.sha256);assert.equal(oldBytes.length,old.entry.bytes);
const oldApi=new Function(oldBytes.toString('utf8')+';return KneekuraBaseballWorkbench;')(),newApi=new Function(current.code+';return KneekuraBaseballWorkbench;')();
const fixture=parseDebugRecord(await readFile(input,'utf8')),configuration=fixture.capture.configuration;
assert(!Object.hasOwn(configuration,'batterObservedRegionExperienceV222'));const initial=oldApi.createLiveBattingPracticeV150(configuration);
const request={batting:'take',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'v222-compat-fixture',mode:'AUTO'}};
initial.issuePitch(request);const capture=initial.capture();assert(!Object.hasOwn(capture.continuation,'batterObservedRegionExperienceV222'));
const oldResume=oldApi.createLiveBattingPracticeV150(configuration,capture),newResume=newApi.createLiveBattingPracticeV150(configuration,capture);
const oldRecord=oldResume.issuePitch(request),newRecord=newResume.issuePitch(request),oldNext=oldResume.capture(),newNext=newResume.capture();
assert.equal(stringifyDebugRecord(oldRecord),stringifyDebugRecord(newRecord),'old/new full next record differs');
assert.equal(stringifyDebugRecord(oldNext),stringifyDebugRecord(newNext),'old/new next capture differs');
assert.equal(stringifyDebugRecord(oldRecord.play.diagnostics.randomnessV152),stringifyDebugRecord(newRecord.play.diagnostics.randomnessV152),'random trace differs');
for(const p of paths)assert.deepEqual(await pin(p),start[p],p+' changed');assert.equal(sha(await readFile(oldPath)),old.entry.sha256);await verifyPinnedLiveCore({manifestPath:newManifest});
const result={pass:true,scope:'EXACT_SINGLE_LEGACY_CONFIGURATION_OLD_WORKBENCH_TO_NEW_WORKBENCH_NOT_UNIVERSAL_COMPATIBILITY',oldWorkbenchSha256:old.entry.sha256,
 newWorkbenchSha256:current.manifest.entry.sha256,oldBuild:{workbenchSha256:old.entry.sha256,practiceUiSha256:'f5f634e9403ba156434f8cf4d72e0a61b21919ad738693debd9df7ce83bb0115'},
 oldCaptureCreatedByOldBundle:true,oldConfigOmittedV222:true,oldSidecarAbsent:true,nextRecordExact:true,nextCaptureExact:true,rngTraceExact:true,
 recordSha256:sha(stringifyDebugRecord(oldRecord)),captureSha256:sha(stringifyDebugRecord(oldNext)),inputPins:start,oldBundlePin:await pin(oldPath),endPinsEqual:true};
await writeFile(proof,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({pass:true,proof,oldWorkbenchSha256:result.oldWorkbenchSha256,newWorkbenchSha256:result.newWorkbenchSha256,recordSha256:result.recordSha256,captureSha256:result.captureSha256}));

}
