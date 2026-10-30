import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { resolve,relative,isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPinnedLiveCore } from '../verification/live-debug-core.mjs';
import { stringifyDebugRecord } from '../verification/live-debug-record.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.BASEBALL_PLAYWRIGHT_CORE_PATH??resolve(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'));
const root=process.cwd(),out=resolve(process.argv[2]??''),candidate=resolve(process.argv[3]??''),rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'new output and frozen candidate directory required');await mkdir(out,{recursive:false});
const sha=b=>createHash('sha256').update(b).digest('hex'),save=(n,v)=>writeFile(resolve(out,n),stringifyDebugRecord(v)+'\n',{flag:'wx'});
const userPath='C:/Users/genki/Downloads/にーくら選手とバット (2).json',manifestPath=resolve(candidate,'manifest.json'),htmlPath=resolve(candidate,'maker.html');
const report={pass:false,boundary:'GENUINE_MAKER_EXPLICIT_OBSERVED_SPIN_TRIAL_ONLY',earnedQualification:false,nativeQualification:false,calibratedHumanPerformance:false,
 protocol:'FOUR_FIXED_LIVE_WORLD_XY_PROBES_ZERO_DEPTH_DELTA',
 cases:[],errors:[],requests:[],privateArtifactNotForPublication:true};let browser,endAudit;
try{
 const manifest=JSON.parse(await readFile(manifestPath,'utf8')),userBytes=await readFile(userPath),user=JSON.parse(userBytes.toString('utf8')),html=await readFile(htmlPath);
 assert.equal(userBytes.length,59857);assert.equal(sha(userBytes),'e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce');assert.equal(sha(html),manifest.htmlSha256);
 assert.equal(manifest.boundary,'V237_NEW_LIVE_RUNTIME_CANDIDATE_NOT_NATIVE_QUALIFICATION');assert.equal(manifest.oldBuildCompatibilityAssumed,false);
 assert.equal(user.livePhysicalRoster.entries.find(x=>x.playerId==='1-b0')?.physical?.clipId,'obp-23_5');assert.equal(user.reference.clipId,'obp-103_5');
 const pins={};for(const p of [manifestPath,htmlPath,userPath,'tools/browser-bridge/check-maker-observed-spin-v237.mjs']){const b=await readFile(p);pins[p]={bytes:b.length,sha256:sha(b)}}
 const native=await verifyPinnedLiveCore({manifestPath:resolve(candidate,'native/manifest.json')}),wb=await verifyPinnedLiveCore({manifestPath:resolve(candidate,'workbench/manifest.json')});
 assert.equal(native.manifest.entry.sha256,manifest.native.sha256);assert.equal(wb.manifest.entry.sha256,manifest.workbench.sha256);
 for(const [p,pin] of Object.entries(manifest.inputPins)){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256)}
 endAudit=async()=>{for(const [p,pin]of Object.entries({...pins,...manifest.inputPins})){const b=await readFile(p);assert.equal(b.length,pin.bytes);assert.equal(sha(b),pin.sha256)}
  await verifyPinnedLiveCore({manifestPath:resolve(candidate,'native/manifest.json')});await verifyPinnedLiveCore({manifestPath:resolve(candidate,'workbench/manifest.json')});};
 const protocol=[{technique:'BACKSPIN',delta:{x:0,y:0.01}},{technique:'TOPSPIN',delta:{x:0,y:-0.01}},
  {technique:'SLICE',delta:{x:0.01,y:0}},{technique:'HOOK',delta:{x:-0.01,y:0}}];
 assert.deepEqual(manifest.trialDeclarations,protocol);assert.equal(manifest.contactDepthRule,'NORMAL_SUBJECT_CONTACT_PLANE_ZERO_DEPTH_DELTA');
 await save('start.json',{pins,trialDeclarations:protocol,contactDepthRule:'NORMAL_SUBJECT_CONTACT_PLANE_ZERO_DEPTH_DELTA',native:manifest.native,workbench:manifest.workbench,
  originalJsonSha256:sha(userBytes),opportunityRule:'ONE_NORMAL_WARMUP_THEN_SHARED_SECOND_PITCH_CAPTURE',note:'same pitch branch controls are not independent qualification trials'});
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});report.browserVersion=browser.version();assert.equal(report.browserVersion,'156.0.8078.49','unreviewed Chrome version; separate protocol required');
 const page=await browser.newPage({viewport:{width:1200,height:1050}});page.on('pageerror',e=>report.errors.push(String(e)));page.on('request',r=>{if(!/^(file:|data:|blob:|about:)/.test(r.url()))report.requests.push(r.url())});
 await page.goto(pathToFileURL(htmlPath).href,{timeout:120000});await page.waitForFunction(()=>globalThis.baseballMaker&&globalThis.KneekuraBattingPractice&&globalThis.KneekuraBallComparison,null,{timeout:90000});
 await page.evaluate(packet=>baseballMaker.importState(packet),user);
 const imported=await page.evaluate(()=>{const r=baseballMaker.getLiveRoster(),validated=baseballMaker.validateLiveRoster(r),p=KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:KneekuraLiveGameRosterCatalog.players,roster:r}).players.find(x=>x.playerId==='1-b0');return {roster:r,validated,subject:p,reference:baseballMaker.getState().reference}});
 assert.deepEqual(imported.roster,imported.validated);report.normalizedRosterEqualsOriginal=JSON.stringify(imported.roster)===JSON.stringify(user.livePhysicalRoster);assert.equal(imported.subject.bats,'L');assert.equal(imported.subject.physical.clipId,'obp-23_5');assert.equal(imported.reference.clipId,'obp-103_5');
 await page.locator('#tab-player').click();await page.locator('#live-roster-player').selectOption('1-b0');await page.locator('#tab-bat').click();await page.locator('#comparison-pitcher').selectOption('0-p0');
 await page.locator('#comparison-spin-trial summary').click();assert.equal(await page.locator('#comparison-spin-trial').evaluate(el=>el.open),true);
 await page.locator('#comparison-seed').fill('20261019');await page.locator('#practice-batting').selectOption('balanced');await page.locator('#comparison-direction').selectOption('AUTO');
 const counts=await page.evaluate(()=>({clips:KneekuraMeasuredBatLibrary.decode(document.getElementById('v68-measured-bat-library').textContent).clips.length})).catch(()=>null);
 // The accepted Maker loads its original 673-trial library through its normal UI; authoritative counts are checked in its actual practice capture below.
 report.libraryPreflight=counts;
 const exactSource=native.code;await page.evaluate(code=>{globalThis.__v237Native=new Function(code+';return KneekuraNativeMatchCore;')()},exactSource);
 const depth=await page.evaluate(()=>{const r=baseballMaker.getLiveRoster(),b=KneekuraBaseballWorkbench.applyLivePhysicalRosterV1({players:KneekuraLiveGameRosterCatalog.players,roster:r}).players.find(p=>p.playerId==='1-b0');
  const physical=KneekuraBaseballWorkbench.resolveLiveMatchPlayerPhysicalV98(b),setup=KneekuraBaseballWorkbench.resolveLiveBattingSetupV94({...physical,heightMeters:b.heightMeters,bats:b.bats});return setup.contactPlaneZ});
 assert(Number.isFinite(depth));await save('protocol-before-trials.json',{trialDeclarations:protocol,plateZ:depth,contactDepthZ:depth,depthDelta:0,subjectId:'1-b0',clipId:'obp-23_5',calibration:'UNCONFIRMED'});
 await page.locator('#comparison-spin-technique').selectOption('');
 await page.evaluate(()=>KneekuraBattingPractice.start());
 const warmup=await page.evaluate(()=>KneekuraBattingPractice.next());
 assert.equal(warmup.record.batterPlayerId,'1-b0');assert.equal(Object.hasOwn(warmup.record.command,'observedSpinTrialV236'),false);
 const opportunity=await page.evaluate(async()=>{const text=await KneekuraBattingPractice.exportText(),parsed=KneekuraBattingPracticeCodecV150.parse(text);
  globalThis.__v237OpportunityText=text;return {text,pitchCount:parsed.capture.continuation.pitchCount,current:KneekuraBattingPractice.inspect().state.batterPlayerId}});
 assert.equal(opportunity.pitchCount,1);assert.equal(opportunity.current,'1-b0');
 await save('warmup-first-pitch.json',{record:warmup.record,subject:warmup.record.batterPlayerId,classification:warmup.record.play.classification});
 await writeFile(resolve(out,'shared-second-pitch-capture.lossless.json'),opportunity.text+'\n',{flag:'wx'});
 report.warmup={pitchCount:1,subject:warmup.record.batterPlayerId,classification:warmup.record.play.classification,trialDelivered:false};
 report.sharedOpportunity={priorPitchCount:1,subject:opportunity.current,sha256:sha(Buffer.from(opportunity.text+'\n'))};
 const cases=[{technique:null,delta:null},...protocol];let baselineSpin=null;
 for(let index=0;index<cases.length;index++){
  const item=cases[index],name=item.technique??'BASELINE';
  try{
   await page.locator('#comparison-spin-technique').selectOption(item.technique??'');
   if(item.technique){await page.locator('#comparison-spin-x').fill(String(item.delta.x));await page.locator('#comparison-spin-y').fill(String(item.delta.y));await page.locator('#comparison-spin-depth').fill(String(depth));}
   await page.evaluate(()=>KneekuraBattingPractice.restore(globalThis.__v237OpportunityText));
   const initial=await page.evaluate(async()=>{const codec=KneekuraBattingPracticeCodecV150,s=codec.parse(await KneekuraBattingPractice.exportText());
    globalThis.__v237Capture=s.capture;const original=codec.parse(globalThis.__v237OpportunityText).capture,batter=s.capture.configuration.players.find(p=>p.playerId==='1-b0');return {sameCapture:codec.stringify(s.capture)===codec.stringify(original),batter,clips:s.capture.configuration.measuredClips.length,frames:s.capture.configuration.measuredClips.reduce((n,c)=>n+c.frames.length,0)}});
   assert(initial.sameCapture,'restored second-pitch opportunity differs');assert.equal(await page.evaluate(()=>KneekuraBattingPractice.inspect().state.pitchCount),1);
   assert.equal(initial.clips,673);assert.equal(initial.frames,92201);assert.equal(initial.batter.bats,'L');assert.equal(initial.batter.physical.clipId,'obp-23_5');
   const prepared=await page.evaluate(({item})=>{const capture=globalThis.__v237Capture,config=capture.configuration,batter=config.players.find(p=>p.playerId==='1-b0'),physical=KneekuraBaseballWorkbench.resolveLiveMatchPlayerPhysicalV98(batter),
     trial=item.technique?KneekuraBallComparison.getObservedSpinTrial(batter.playerId,physical,batter.bats,batter.heightMeters,config.measuredClips):null;
    const request={batting:'balanced',battingDirectionRequestV149:{version:'batting_direction_request_v149',sourceId:'maker-continuous-practice-v150',mode:'AUTO'},...(trial?{observedSpinTrialV236:trial}:{})};
    const p=KneekuraBaseballWorkbench.createLiveBattingPracticeV150(config,capture),codec=KneekuraBattingPracticeCodecV150,before=codec.stringify(p.capture()),preview=p.preview(request),after=codec.stringify(p.capture());
    return {trial,request,previewRecord:preview.record,previewNonconsuming:before===after};},{item});
   assert(prepared.previewNonconsuming);if(item.technique){assert.equal(prepared.trial.subjectId,'1-b0');assert.equal(prepared.trial.technique,item.technique);assert.equal(prepared.trial.clip.id,'obp-23_5');assert.deepEqual(prepared.trial.delta,item.delta);assert.equal(prepared.trial.domain.contactDepthZ,depth);assert.equal(prepared.trial.domain.plateZ,depth)}else assert.equal(prepared.trial,null);
   await save('case-'+index+'-request-before-worker.json',{name,request:prepared.request,trial:prepared.trial});
   const actual=await page.evaluate(()=>KneekuraBattingPractice.next());
   const comparison=await page.evaluate(({request,record})=>{const capture=globalThis.__v237Capture,host=__v237Native.createLiveBaseballMatchWorkerV116(capture.configuration,capture.continuation),codec=KneekuraBattingPracticeCodecV150;
    const command={...request,managedTeam:capture.continuation.match.half==='top'?0:1,pitchType:'auto',location:'auto'},expected=host.issuePitch(command),saved=host.captureContinuationV116();
    return {recordExact:codec.stringify(expected)===codec.stringify(record),continuation:saved};},{request:prepared.request,record:actual.record});
   assert(comparison.recordExact);assert.deepEqual(actual.record,prepared.previewRecord);
   const after=await page.evaluate(async()=>{const parsed=KneekuraBattingPracticeCodecV150.parse(await KneekuraBattingPractice.exportText());globalThis.__v237AfterCapture=parsed.capture;return parsed.capture.continuation});assert.deepEqual(after,comparison.continuation);
   const record=actual.record, delivered=record.command.observedSpinTrialV236??null,diagnostics=record.play.diagnostics.observedSpinTrialV236??null;
   assert.equal(record.batterPlayerId,'1-b0');assert.equal(Object.hasOwn(record.command,'observedSpinTrialV236'),!!item.technique);
   if(!item.technique)assert.equal(Object.hasOwn(record.play.diagnostics,'observedSpinTrialV236'),false);assert.deepEqual(delivered,prepared.trial);if(item.technique&&diagnostics){assert.equal(diagnostics.subjectId,'1-b0');assert.equal(diagnostics.earnedQualification,false)}
   const observation=record.play.contact?await page.evaluate(c=>KneekuraBaseballWorkbench.observeBattedBallSpinV123({velocityMps:c.exitVelocity,spinRadPerSecond:c.exitSpin,bats:'L'}),record.play.contact):null;
   if(record.play.contact){assert(record.play.outgoingBallMoment);assert.deepEqual(record.play.outgoingBallMoment.ball.velocity,record.play.contact.exitVelocity);assert.deepEqual(record.play.outgoingBallMoment.ball.spin,record.play.contact.exitSpin);}
   const selected=observation?.basisStatus==='DEFINED'&&item.technique?{BACKSPIN:observation.backspinRadPerSecond,TOPSPIN:observation.topspinRadPerSecond,SLICE:observation.sliceRadPerSecond,HOOK:observation.hookRadPerSecond}[item.technique]:null;
   if(index===0&&record.play.contact)baselineSpin=record.play.contact.exitSpin;
   const opposite=observation?.basisStatus==='DEFINED'&&item.technique?{BACKSPIN:observation.topspinRadPerSecond,TOPSPIN:observation.backspinRadPerSecond,SLICE:observation.hookRadPerSecond,HOOK:observation.sliceRadPerSecond}[item.technique]:null;
   const directionOutcome=!record.play.contact?'NO_CONTACT':observation?.basisStatus!=='DEFINED'?'UNCLASSIFIED':selected===null?'BASELINE':selected>0?'REQUESTED_DIRECTION':opposite>0?'OPPOSITE_DIRECTION':'ZERO_OR_OTHER_AXIS';
   const summary={name,trialDelivered:!!delivered,trialApplied:diagnostics?.status==='APPLIED',earnedQualification:diagnostics?.earnedQualification??false,
    actualContact:!!record.play.contact,requestedDirectionObserved:selected===null?null:selected>0,directionOutcome,
    spinExactlyMatchesBaseline:baselineSpin&&record.play.contact?['x','y','z'].every(k=>Object.is(record.play.contact.exitSpin[k],baselineSpin[k])):null,spinObservation:observation,
    existingFieldAeroConnected:!!(record.play.contact&&record.play.outgoingBallMoment&&record.play.field),subject:record.batterPlayerId,clipId:diagnostics?.registration?.clipId??null,
    workerHostFullRecordExact:true,previewNonconsuming:true,continuationExact:true};
   await save('case-'+index+'.json',{summary,request:prepared.request,record,continuation:after});report.cases.push(summary);
   if(index===0)report.sameBuildRestoreNextExact=true;
  }catch(e){const failure={name,error:String(e.stack??e)};report.cases.push(failure);await save('case-'+index+'-failure.json',failure);throw e}
 }
 await page.locator('#comparison-spin-technique').selectOption('TOPSPIN');await page.locator('#comparison-spin-x').fill('0');await page.locator('#comparison-spin-y').fill('-0.01');await page.locator('#comparison-spin-depth').fill(String(depth));
 const compared=await page.evaluate(async()=>{const before=await KneekuraBattingPractice.exportText(),value=await KneekuraBallComparison.run(),after=await KneekuraBattingPractice.exportText();return value&&{previewNonconsuming:before===after,cases:value.cases.map(c=>({level:c.level,contact:c.pitch.contact,trial:c.pitch.diagnostics.observedSpinTrialV236??null})),text:document.getElementById('comparison-status').textContent}});
 assert(compared&&compared.cases?.length===4&&compared.previewNonconsuming);const comparisonInput=await page.evaluate(()=>KneekuraBallComparison.getInput());assert.equal(comparisonInput.observedSpinTrialV236.subjectId,'1-b0');assert.equal(comparisonInput.observedSpinTrialV236.clip.id,'obp-23_5');
 await save('comparison-result.json',{input:comparisonInput,summary:compared});report.comparisonVisibleStatus=compared.text;
 assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),imported.roster);await page.screenshot({path:resolve(out,'maker-1200.png')});
 await page.setViewportSize({width:390,height:1050});const panel=page.locator('#comparison-spin-trial');await panel.scrollIntoViewIfNeeded();
 assert.equal(await panel.evaluate(el=>el.open),true);const box=await panel.boundingBox();assert(box&&box.x>=-2&&box.x+box.width<=392);
 const controls=await panel.locator('select,input').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,left:r.left,right:r.right,width:r.width}}));
 assert.equal(controls.length,4);assert(controls.every(r=>r.width>0&&r.left>=-2&&r.right<=392),'open trial inputs exceed narrow viewport');
 await page.screenshot({path:resolve(out,'maker-390.png')});report.narrow={box,controls,open:true,samePage:true};
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);
 report.originalRosterUnchanged=true;report.comparisonUiTrialDelivered=true;report.pass=true;
}catch(e){report.error=String(e.stack??e);report.pass=false;process.exitCode=1}
finally{
 if(browser)try{await browser.close()}catch(e){report.cleanupError=String(e.stack??e);report.pass=false;process.exitCode=1}
 if(endAudit)try{await endAudit();report.inputEndPins=true}catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}
 await save('report.json',report)
}
console.log(JSON.stringify({pass:report.pass,cases:report.cases.map(x=>({name:x.name,actualContact:x.actualContact,trialApplied:x.trialApplied})),error:report.error??null}));
