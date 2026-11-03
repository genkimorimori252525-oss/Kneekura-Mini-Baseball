import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyPinnedLiveCore } from './live-debug-core.mjs';
import { stringifyDebugRecord, parseDebugRecord, firstDebugDifference } from './live-debug-record.mjs';

const args=process.argv.slice(2);
assert(args.length===4&&args.every(Boolean),
  'usage: node tools/verification/recover-constrained-pole-practice-v173.mjs priorOutput priorReceipt archivedExecutedHarness newRecoveryOutput');
const [priorOutput,priorReceipt,archivedHarness,newOutput]=args,root=resolve('.'),prior=resolve(priorOutput),out=resolve(newOutput),
  task='MB-20261027-REALISM-DEBUG-PLAN',receiptId=task+'_d7b59a0c42a3491a9a7fde22eeaef91b',
  expectedBlob='blob:null/7dd0bd6e-05ca-4380-b670-9d394ca65cd3',
  originalHarness=resolve('tools/verification/check-constrained-pole-practice-v173.mjs'),
  executedHarnessPin={bytes:18057,sha256:'043e17ec33ff62db402ef065b5273127d82275af0ccb5a8c77e9ed2b8e84e492'},
  maximumFileBytes=64*1024*1024,sha=bytes=>createHash('sha256').update(bytes).digest('hex'),pin=bytes=>({bytes:bytes.length,sha256:sha(bytes)}),
  inside=(parent,path)=>{const r=relative(parent,path);return r!==''&&!isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+sep);},
  inputPins={},started=Date.now(),report={pass:false,scope:'DATA_RECOVERY_ONLY_NO_NEW_CORE_EXECUTION',
    priorReceiptId:receiptId,priorResult:'FAIL',priorFailureRetained:true,originalReportUnchanged:false,
    sourceFlights:0,gameCoreExecutions:0,browserExecutions:0,nativeAdmission:false,legalAdmission:false,custodyAdmission:false,
    officialResult:null,crossBuildEquivalenceClaimed:false,checks:[],captureRecords:[],predicateObservations:[],
    originalReportHashAuthority:'CURRENT_BYTES_LINKED_BY_RECEIPT_LOG_SUMMARY_AND_ALL_PINNED_ARTIFACTS_NOT_A_REPORT_HASH_IN_THE_ORIGINAL_RECEIPT',
    recoveryRevisionReason:'Recovery-01 reconstructed identical checks in a different chronology. This revision preserves the original three field comparisons before the old capture. Prior recovery FAIL remains unchanged.'};
assert(inside(root,prior)&&inside(root,out)&&prior!==out&&!inside(prior,out),'separate new recovery output required inside project');
assert(out!==resolve('dist')&&!inside(resolve('dist'),out),'recovery output cannot use shared dist');
const physicalRoot=await realpath(root),physicalOut=resolve(await realpath(dirname(out)),basename(out));
assert(inside(physicalRoot,physicalOut)&&physicalOut!==resolve(physicalRoot,'dist')&&!inside(resolve(physicalRoot,'dist'),physicalOut),
  'recovery output must physically stay inside project outside dist');
await mkdir(out);
async function pinRead(path){
  const absolute=resolve(path),physical=await realpath(absolute);
  assert(inside(root,absolute)&&inside(physicalRoot,physical)&&absolute!==out&&!inside(out,absolute),'input must be inside project outside new output');
  assert((await stat(absolute)).size<=maximumFileBytes,'bounded file required');
  const bytes=await readFile(absolute),actual=pin(bytes);
  if(inputPins[absolute])assert.deepEqual(inputPins[absolute],actual,'input changed during recovery');
  inputPins[absolute]=actual;return bytes;
}
function exact(label,a,b){
  const x=stringifyDebugRecord(a),y=stringifyDebugRecord(b),equal=x===y,
    row={label,equal,expectedSha256:sha(x),actualSha256:sha(y),firstDifference:equal?null:firstDebugDifference(a,b)};
  report.checks.push(row);assert(equal,'saved exact comparison failed: '+label);return row;
}
function ordinaryFixture(record,variant){
  const {request,result}=record.data,f=result.field,t=request.fieldInput.ball.elapsedSeconds;
  assert.equal(record.inputUnchanged,true);assert.equal(record.callerFreezeStateUnchanged,true);
  assert.equal(result.input.fielders.length,9);
  assert(result.input.fielders.every(x=>x.gloveRadiusMeters===.11&&x.bodyModelV105!==undefined));
  assert.equal(request.fieldInput.maxPlaySeconds,.0000001);assert.equal(request.fieldInput.frameSeconds,.055);
  assert.equal(f.facts.filter(x=>x.kind==='wall_support').length,1);assert.equal(f.facts.filter(x=>x.kind==='pole_contact').length,0);
  assert.equal(f.diagnostics.poleV148?.impulses.length??0,0);assert.equal(f.end.tick,request.fieldInput.ball.ball.tick);
  assert.equal(f.end.complete,false);assert.equal(result.rules,null);
  const windows=f.diagnostics.poleV148?.constrainedWindowsV170??[];
  if(variant==='near'){
    assert.equal(f.end.elapsedSeconds,t);assert.equal(f.diagnostics.unresolvedDetail?.kind,'constrained_pole_motion_not_supported_v148');
    assert.equal(f.diagnostics.unresolvedDetail?.window?.reason,'separation_not_proved');assert.equal(windows.length,0);
  }else{
    assert(f.end.elapsedSeconds>t);assert.equal(f.diagnostics.unresolvedDetail,null);
    if(variant==='far')assert(windows.length>0);
  }
  return {variant,end:f.end,wallSupport:1,windows:windows.length,unresolved:f.diagnostics.unresolvedDetail,
    gloveRadius:result.input.fielders[0].gloveRadiusMeters,bodyModels:true};
}
try{
  for(const path of [fileURLToPath(import.meta.url),'tools/verification/live-debug-core.mjs','tools/verification/live-debug-record.mjs'])await pinRead(path);
  const receipt=JSON.parse((await pinRead(priorReceipt)).toString('utf8'));
  assert.equal(receipt.schema_version,1);assert.equal(receipt.task_id,task);assert.equal(receipt.receipt_id,receiptId);
  assert.equal(receipt.result,'FAIL');assert.equal(receipt.exit_code,1);
  assert.deepEqual(receipt.command,['node','tools/verification/check-constrained-pole-practice-v173.mjs',
    'docs/verification/realism-debug-20261027/candidate-constrained-release-native-v170-01/manifest.json',
    'docs/verification/realism-debug-20261027/candidate-constrained-release-workbench-v170-01/manifest.json',
    'docs/verification/realism-debug-20261027/constrained-pole-practice-v173-chrome-02']);
  assert.equal(resolve(receipt.command[4]),prior);
  const logBytes=await pinRead(receipt.output_path);assert.equal(sha(logBytes),receipt.output_sha256);
  const logLines=logBytes.toString('utf8').trim().split(/\r?\n/);assert.equal(logLines.length,1);
  const log=JSON.parse(logLines[0]),oldBytes=await pinRead(resolve(prior,'report.json')),old=parseDebugRecord(oldBytes.toString('utf8'));
  assert.equal(log.pass,false);assert.equal(log.scope,'PUBLIC_FIELD_PRACTICE_CONSTRAINED_WINDOW_CHROME_PARITY_V173');
  assert.equal(resolve(log.out),prior);assert.equal(log.browserVersion,'156.0.8078.49');assert.equal(log.captures,4);assert.equal(log.checks,31);
  assert.equal(log.error,old.error);assert.equal(log.elapsedMilliseconds,old.elapsedMilliseconds);
  assert.equal(stringifyDebugRecord(log.fixtureObservations),stringifyDebugRecord(old.fixtureObservations));
  assert.equal(old.pass,false);assert.equal(old.browserVersion,'156.0.8078.49');assert.equal(old.endPinsEqual,true);
  assert.equal(old.endPinError,undefined);assert.equal(old.disposalError,undefined);assert.deepEqual(old.errors,[]);
  assert.deepEqual(old.requests,[expectedBlob]);
  assert.equal(old.error,'AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:\n\n1 !== 0\n\n    at file:///'
    +originalHarness.split(sep).join('/')+':209:49');
  const executedBytes=await pinRead(archivedHarness);assert.deepEqual(pin(executedBytes),executedHarnessPin);
  assert.deepEqual(old.inputPins[originalHarness],executedHarnessPin);
  const executedText=executedBytes.toString('utf8'),lines=executedText.split(/\r?\n/);
  assert.equal(lines[208].trim(),'assert.equal(report.errors.length,0);assert.equal(report.requests.length,0);report.browserExecuted=true;');
  assert.equal((executedText.match(/URL\.createObjectURL\(/g)??[]).length,1);assert.equal((executedText.match(/new Worker\(/g)??[]).length,1);
  assert(executedText.includes("page.on('request',r=>report.requests.push(r.url()))"));
  const currentHarness=await pinRead(originalHarness);assert.notDeepEqual(pin(currentHarness),executedHarnessPin,'future-only harness repair must be separate');
  report.harnessSubstitution={originalPath:originalHarness,executedArchivedPath:resolve(archivedHarness),executedPin:executedHarnessPin,
    currentRepairedPin:pin(currentHarness),onlyThisHistoricalPinResolvedThroughArchive:true};
  report.singleBlobFailure={observedRequest:expectedBlob,recordedRequestCount:1,networkRequestCount:0,
    separatelyRecordedCreatedWorkerUrl:false,
    attribution:'INFERRED_FROM_PINNED_HARNESS_SINGLE_WORKER_CREATION_AND_SINGLE_BLOB_REQUEST_NOT_A_SEPARATE_URL_RECEIPT',
    soleTerminalFailure:'The original zero-requests assertion counted its own Worker blob load.'};
  for(const [path,expected] of Object.entries(old.inputPins)){
    if(resolve(path)===originalHarness)continue;
    assert.deepEqual(pin(await pinRead(path)),expected,'original input pin changed: '+path);
  }
  for(const [path,expected] of Object.entries(old.artifactPins)){
    assert(inside(prior,resolve(path)),'original artifact must be inside original output');
    assert.deepEqual(pin(await pinRead(path)),expected,'original artifact changed: '+path);
  }
  assert.equal(Object.keys(old.artifactPins).length,28);
  const labels=['omitted','far','near','old-v168-far'],all={},inputs={},consumed=new Set();
  assert.deepEqual(Object.keys(old.captures),labels);
  for(const label of labels){
    if(label==='old-v168-far')for(const key of ['frames','facts','end'])
      exact('far-versus-omitted:'+key,all.omitted.data.result.field[key],all.far.data.result.field[key]);
    const inputPath=resolve(prior,'inputs',label+'.json'),inputBytes=await pinRead(inputPath),inputText=inputBytes.toString('utf8').trimEnd(),input=parseDebugRecord(inputText);
    consumed.add(inputPath);inputs[label]=input;assert.equal(stringifyDebugRecord(input),inputText);exact(label+':saved-input',input,parseDebugRecord(inputText));
    const cores=label==='old-v168-far'?['old-native','old-workbench']:['native','workbench'],keys=[];let first;
    for(const channel of ['main','worker','json'])for(const core of cores){
      const key=channel+':'+core;keys.push(key);const capture=old.captures[label][key],file=channel+'/'+label+'-'+core+'.json';
      assert.equal(capture.file,file);const path=resolve(prior,file),bytes=await pinRead(path),text=bytes.toString('utf8').trimEnd(),record=parseDebugRecord(text);
      consumed.add(path);assert.equal(stringifyDebugRecord(record),text);assert.equal(sha(text),capture.sha256);assert.equal(Buffer.byteLength(text),capture.bytes);
      assert.equal(stringifyDebugRecord(record.data.request),inputText,'captured request must match saved request');
      assert.equal(record.inputUnchanged,true);assert.equal(record.callerFreezeStateUnchanged,true);
      if(first===undefined){first=record;all[label]=record;}exact(label+':'+channel+':'+core,first,record);
      report.captureRecords.push({label,channel,core,path,sha256:capture.sha256,bytes:capture.bytes});
    }
    assert.deepEqual(Object.keys(old.captures[label]),keys);
  }
  assert.equal(report.captureRecords.length,24);assert.equal(report.checks.length,31);
  assert(stringifyDebugRecord(report.checks)===stringifyDebugRecord(old.checks),
    'all 31 original comparison details and chronology must be reproduced: '+JSON.stringify(firstDebugDifference(old.checks,report.checks)));
  assert.deepEqual([...consumed].sort(),Object.keys(old.artifactPins).map(resolvePath=>resolve(resolvePath)).sort());
  for(const variant of ['omitted','far','near'])report.predicateObservations.push(ordinaryFixture(all[variant],variant));
  assert.equal(stringifyDebugRecord(report.predicateObservations),stringifyDebugRecord(old.fixtureObservations));
  const of=all['old-v168-far'].data.result.field,nf=all.far.data.result.field;
  assert.equal(stringifyDebugRecord(inputs.far),stringifyDebugRecord(inputs['old-v168-far']));
  assert.equal(of.facts.filter(x=>x.kind==='wall_support').length,1);assert.equal(of.end.elapsedSeconds,inputs.far.fieldInput.ball.elapsedSeconds);
  assert.equal(of.diagnostics.unresolvedDetail?.kind,'constrained_pole_motion_not_supported_v148');assert(nf.end.elapsedSeconds>of.end.elapsedSeconds);
  const comparison={oldArtifactsActuallyExecuted:true,oldStudyRerun:false,sameAuthoredInput:true,oldEnd:of.end,newEnd:nf.end,
    oldUnresolved:of.diagnostics.unresolvedDetail,newUnresolved:nf.diagnostics.unresolvedDetail,oldStopReproduced:true,newPositiveSubTickWindow:true};
  assert.equal(stringifyDebugRecord(comparison),stringifyDebugRecord(old.oldFarComparison));report.oldFarComparison=comparison;
  assert.equal(old.oldArtifactVerification.length,2);
  for(const artifact of old.oldArtifactVerification){
    const manifestBytes=await pinRead(artifact.path);assert.deepEqual(pin(manifestBytes),artifact.manifestPin);
    const m=JSON.parse(manifestBytes.toString('utf8'));assert.deepEqual(m.entry,artifact.entry);assert.equal(m.target,artifact.target);
    assert.deepEqual(pin(await pinRead(resolve(dirname(artifact.path),m.entry.path))),{bytes:m.entry.bytes,sha256:m.entry.sha256});
    assert.equal(artifact.oldSourceVerifiedAgainstCurrent,false);
  }
  report.currentManifests=[];
  for(const [index,target] of [[2,'native'],[3,'workbench']]){
    const manifestPath=receipt.command[index],{manifest}=await verifyPinnedLiveCore({manifestPath});assert.equal(manifest.target,target);
    assert.equal(manifest.entry.sha256,target==='native'?old.nativeSha256:old.workbenchSha256);
    await pinRead(resolve(dirname(manifestPath),manifest.entry.path));
    for(const path of Object.keys(manifest.inputs))await pinRead(path);
    report.currentManifests.push({path:manifestPath,target,entry:manifest.entry,sourceCount:Object.keys(manifest.inputs).length});
  }
  report.runtime=old.runtime;report.receiptLogSha256=receipt.output_sha256;report.originalReportSha256=sha(oldBytes);
  report.priorReceiptVerified=true;report.all28ArtifactsVerified=true;report.all24RecordsRecompared=true;report.all31ChecksReproduced=true;
  report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  try{
    for(const [path,expected] of Object.entries(inputPins))assert.deepEqual(pin(await readFile(path)),expected,'input changed before recovery close: '+path);
    report.endPinsEqual=true;report.originalReportUnchanged=true;
  }catch(error){report.endPinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  report.inputPins=inputPins;report.elapsedMilliseconds=Date.now()-started;
  await writeFile(resolve(out,'report.json'),stringifyDebugRecord(report)+'\n',{flag:'wx'});
  console.log(JSON.stringify({pass:report.pass,scope:report.scope,priorResult:report.priorResult,priorFailureRetained:report.priorFailureRetained,
    records:report.captureRecords.length,checks:report.checks.length,endPinsEqual:report.endPinsEqual,sourceFlights:0,gameCoreExecutions:0,
    browserExecutions:0,elapsedMilliseconds:report.elapsedMilliseconds,error:report.error??report.endPinError??null}));
}
