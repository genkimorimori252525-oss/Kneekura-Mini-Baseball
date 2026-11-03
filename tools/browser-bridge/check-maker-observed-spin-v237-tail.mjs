import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve,relative,isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPinnedLiveCore } from '../verification/live-debug-core.mjs';
import { parseDebugRecord,stringifyDebugRecord } from '../verification/live-debug-record.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const root=process.cwd(),out=resolve(process.argv[2]??''),rel=relative(root,out);
assert(process.argv.length===3&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new workspace output required');await mkdir(out,{recursive:false});
const old=resolve('work/maker-observed-spin-v237-genuine-01'),candidate=resolve('work/maker-observed-spin-v237-candidate-02'),
 receiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_adfdd374ba9f40698011636807622ed6.json'),
 userPath='C:/Users/genki/Downloads/にーくら選手とバット (2).json',baseline=resolve('work/maker-v237-tail-baseline-01/checker-before.mjs'),
 currentChecker=resolve('tools/browser-bridge/check-maker-observed-spin-v237.mjs');
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=async p=>{const b=await readFile(p);pins[p]={bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))},
 save=(n,v)=>writeFile(resolve(out,n),stringifyDebugRecord(v)+'\n',{flag:'wx'});
const report={pass:false,boundary:'V237_COMPARISON_UI_TAIL_ONLY',priorOverall:'FAIL',priorPrefixReused:true,priorRunPromotedToPass:false,
 practicePitchReplayed:0,qualificationProven:false,errors:[],requests:[],privateArtifactNotForPublication:true};let browser,endAudit;
try{
 const receipt=await read(receiptPath),prior=await read(resolve(old,'report.json')),start=await read(resolve(old,'start.json')),
  protocol=await read(resolve(old,'protocol-before-trials.json')),manifest=await read(resolve(candidate,'manifest.json')),
  prefixPins=await read(resolve('work/maker-v237-tail-baseline-01/prefix-pins.json'));
 assert.equal(pins[resolve('work/maker-v237-tail-baseline-01/prefix-pins.json')].sha256,'34c4186ae4f4bf73108903e4838dc79a0c7be1d70edd6e96f7c62730679bd771');
 assert.equal(prefixPins.boundary,'PRIOR_FAILED_RUN_PREFIX_FILES_PINNED_NOW_NOT_ORIGINAL_END_HASH');
 for(const [p,pin] of Object.entries(prefixPins.pins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256,'prior prefix pin differs: '+p)}
 const log=await readFile(resolve(receipt.output_path));pins[resolve(receipt.output_path)]={bytes:log.length,sha256:sha(log)};
 assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'FAIL');assert.notEqual(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
 assert.deepEqual(receipt.command,['node','tools/browser-bridge/check-maker-observed-spin-v237.mjs','work/maker-observed-spin-v237-genuine-01','work/maker-observed-spin-v237-candidate-02']);
 assert.equal(prior.pass,false);assert.equal(prior.inputEndPins,true);assert.equal(prior.browserVersion,'156.0.8078.49');assert.equal(prior.sameBuildRestoreNextExact,true);
 assert.match(prior.error,/Cannot read properties of undefined \(reading 'observedSpinTrialV236'\)/);assert.match(prior.error,/check-maker-observed-spin-v237\.mjs:105/);
 assert.equal(prior.cases.length,5);assert.deepEqual(prior.cases.map(c=>c.name),['BASELINE','BACKSPIN','TOPSPIN','SLICE','HOOK']);
 assert(prior.cases.every(c=>c.workerHostFullRecordExact&&c.previewNonconsuming&&c.continuationExact));
 assert.equal(prior.warmup.pitchCount,1);assert.equal(prior.sharedOpportunity.priorPitchCount,1);assert.equal(prior.sharedOpportunity.subject,'1-b0');
 const originalChecker=await readFile(baseline),current=await readFile(currentChecker);pins[baseline]={bytes:originalChecker.length,sha256:sha(originalChecker)};pins[currentChecker]={bytes:current.length,sha256:sha(current)};
 assert.equal(sha(originalChecker),'ad61671c18cc525f072309cd5da09dd1719f69d21a733e42060623616529ff37');
 const beforeText=originalChecker.toString('utf8'),afterText=current.toString('utf8'),oldNeedle='comparisonInput.pitch.observedSpinTrialV236',newNeedle='comparisonInput.observedSpinTrialV236';
 assert.equal(beforeText.split(oldNeedle).length,3);assert.equal(beforeText.replaceAll(oldNeedle,newNeedle),afterText,'checker changed beyond shape fix');
 const raw=await readFile(userPath),user=JSON.parse(raw.toString('utf8'));pins[userPath]={bytes:raw.length,sha256:sha(raw)};assert.equal(raw.length,59857);assert.equal(sha(raw),'e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce');
 const capturePath=resolve(old,'shared-second-pitch-capture.lossless.json'),captureBytes=await readFile(capturePath);pins[capturePath]={bytes:captureBytes.length,sha256:sha(captureBytes)};
 assert.equal(sha(captureBytes),prior.sharedOpportunity.sha256);const captureText=captureBytes.toString('utf8');
 const storedCases=[],storedRequests=[];
 for(const name of ['warmup-first-pitch.json',...Array.from({length:5},(_,i)=>'case-'+i+'.json'),...Array.from({length:5},(_,i)=>'case-'+i+'-request-before-worker.json')]){
  const path=resolve(old,name),data=await read(path);if(name.startsWith('case-')&&!name.includes('-request')){const index=Number(name.slice(5,6));
   assert.equal(data.summary.name,prior.cases[index].name);assert.equal(data.summary.workerHostFullRecordExact,true);assert.equal(data.summary.continuationExact,true);assert.equal(data.summary.previewNonconsuming,true);
   assert.deepEqual(data.summary,prior.cases[index]);assert.equal(data.record.batterPlayerId,'1-b0');storedCases[index]=data;}
  else if(name.includes('-request-before-worker'))storedRequests[Number(name.slice(5,6))]=data;
 }
 for(let i=0;i<5;i++){const request=storedRequests[i],item=storedCases[i];assert.equal(request.name,item.summary.name);
  assert.deepEqual(request.request.observedSpinTrialV236??null,item.record.command.observedSpinTrialV236??null);assert.deepEqual(request.trial,request.request.observedSpinTrialV236??null);
  if(i>0){assert.equal(request.trial.subjectId,'1-b0');assert.equal(request.trial.technique,item.summary.name);assert.equal(request.trial.clip.id,'obp-23_5')}}
 const htmlPath=resolve(candidate,'maker.html'),html=await readFile(htmlPath);pins[htmlPath]={bytes:html.length,sha256:sha(html)};assert.equal(sha(html),manifest.htmlSha256);
 for(const [p,pin]of Object.entries(manifest.inputPins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256);pins[resolve(p)]={bytes:b.length,sha256:sha(b)}}
 for(const [p,pin]of Object.entries(start.pins)){const actual=resolve(p)===currentChecker?baseline:p,b=await readFile(actual);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256,'prior start pin differs: '+p);}
 const n=await verifyPinnedLiveCore({manifestPath:resolve(candidate,'native/manifest.json')}),w=await verifyPinnedLiveCore({manifestPath:resolve(candidate,'workbench/manifest.json')});
 assert.equal(n.manifest.entry.sha256,manifest.native.sha256);assert.equal(w.manifest.entry.sha256,manifest.workbench.sha256);
 const expected=[{technique:'BACKSPIN',delta:{x:0,y:0.01}},{technique:'TOPSPIN',delta:{x:0,y:-0.01}}, {technique:'SLICE',delta:{x:0.01,y:0}},{technique:'HOOK',delta:{x:-0.01,y:0}}];
 assert.deepEqual(protocol.trialDeclarations,expected);assert.equal(protocol.plateZ,protocol.contactDepthZ);assert.equal(protocol.depthDelta,0);
 endAudit=async()=>{for(const [p,pin] of Object.entries(pins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256,'input changed: '+p)}
  await verifyPinnedLiveCore({manifestPath:resolve(candidate,'native/manifest.json')});await verifyPinnedLiveCore({manifestPath:resolve(candidate,'workbench/manifest.json')});};
 await save('start.json',{pins,previousReceipt:receiptPath,previousOverall:'FAIL',sourceIdentity:'SAVED_FAILING_RUN_PREFIX_NOT_PASS',
  caseHashesCapturedNow:true,caseHashesInOldReceipt:false,protocol,priorBrowserVersion:prior.browserVersion});
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();assert.equal(report.browserVersion,'156.0.8078.49','unreviewed Chrome version');
 const page=await browser.newPage({viewport:{width:1200,height:1050}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
 await page.goto(pathToFileURL(htmlPath).href,{timeout:120000});await page.waitForFunction(()=>globalThis.baseballMaker&&globalThis.KneekuraBattingPractice&&globalThis.KneekuraBallComparison,null,{timeout:90000});
 await page.evaluate(packet=>baseballMaker.importState(packet),user);
 const imported=await page.evaluate(()=>{const roster=baseballMaker.getLiveRoster(),validated=baseballMaker.validateLiveRoster(roster),subject=KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:KneekuraLiveGameRosterCatalog.players,roster}).players.find(p=>p.playerId==='1-b0');return{roster,validated,subject,reference:baseballMaker.getState().reference}});
 assert.deepEqual(imported.roster,imported.validated);assert.equal(imported.subject.bats,'L');assert.equal(imported.subject.physical.clipId,'obp-23_5');assert.equal(imported.reference.clipId,'obp-103_5');
 await page.locator('#tab-player').click();await page.locator('#live-roster-player').selectOption('1-b0');await page.locator('#tab-bat').click();await page.locator('#comparison-pitcher').selectOption('0-p0');
 await page.locator('#comparison-spin-trial summary').click();assert.equal(await page.locator('#comparison-spin-trial').evaluate(e=>e.open),true);
 await page.locator('#comparison-seed').fill('20261019');await page.locator('#practice-batting').selectOption('balanced');await page.locator('#comparison-direction').selectOption('AUTO');
 await page.evaluate(text=>KneekuraBattingPractice.restore(text),captureText);
 const same=await page.evaluate(async text=>{const codec=KneekuraBattingPracticeCodecV150,a=codec.parse(text).capture,b=codec.parse(await KneekuraBattingPractice.exportText()).capture;return codec.stringify(a)===codec.stringify(b)},captureText);assert(same,'retained second-pitch capture restore differs');
 await page.locator('#comparison-spin-technique').selectOption('TOPSPIN');await page.locator('#comparison-spin-x').fill('0');await page.locator('#comparison-spin-y').fill('-0.01');await page.locator('#comparison-spin-depth').fill(String(protocol.contactDepthZ));
 const compared=await page.evaluate(async()=>{const before=await KneekuraBattingPractice.exportText(),value=await KneekuraBallComparison.run(),after=await KneekuraBattingPractice.exportText();return value&&{previewNonconsuming:before===after,cases:value.cases.map(c=>({level:c.level,contact:c.pitch.contact,trial:c.pitch.diagnostics.observedSpinTrialV236??null})),text:document.getElementById('comparison-status').textContent}});
 assert(compared&&compared.cases?.length===4&&compared.previewNonconsuming);const comparisonInput=await page.evaluate(()=>KneekuraBallComparison.getInput());
 assert.equal(comparisonInput.observedSpinTrialV236.subjectId,'1-b0');assert.equal(comparisonInput.observedSpinTrialV236.clip.id,'obp-23_5');assert.deepEqual(comparisonInput.observedSpinTrialV236.delta,{x:0,y:-0.01});
 assert.equal(comparisonInput.observedSpinTrialV236.domain.contactDepthZ,protocol.contactDepthZ);assert.equal(comparisonInput.observedSpinTrialV236.domain.plateZ,protocol.plateZ);
 await save('comparison-result.json',{input:comparisonInput,summary:compared});assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),imported.roster);
 await page.screenshot({path:resolve(out,'maker-1200.png')});await page.setViewportSize({width:390,height:1050});const panel=page.locator('#comparison-spin-trial');await panel.scrollIntoViewIfNeeded();
 assert.equal(await panel.evaluate(el=>el.open),true);const box=await panel.boundingBox();assert(box&&box.x>=-2&&box.x+box.width<=392);
 const controls=await panel.locator('select,input').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return{id:el.id,left:r.left,right:r.right,width:r.width}}));
 assert.equal(controls.length,4);assert(controls.every(r=>r.width>0&&r.left>=-2&&r.right<=392));await page.screenshot({path:resolve(out,'maker-390.png')});
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.result={comparisonUiDelivered:true,previewNonconsuming:true,normalImport:true,originalRosterUnchanged:true,narrow:{box,controls,open:true,samePage:true},
  savedPrefix:prior.cases.map(c=>({name:c.name,actualContact:c.actualContact,trialApplied:c.trialApplied,directionOutcome:c.directionOutcome})),sameBuildRestoreEvidence:'REUSED_PRIOR_FAILED_RUN_PREFIX'};report.pass=true;
}catch(e){report.error=String(e.stack??e);report.pass=false;process.exitCode=1}
finally{if(browser)try{await browser.close()}catch(e){report.cleanupError=String(e.stack??e);report.pass=false;process.exitCode=1}
 if(endAudit)try{await endAudit();report.inputEndPins=true}catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}await save('report.json',report)}
console.log(JSON.stringify({pass:report.pass,priorOverall:report.priorOverall,error:report.error??report.pinError??null}));
