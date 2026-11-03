import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync,createWriteStream,existsSync,mkdirSync,openSync,readFileSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute,relative,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync,backup } from 'node:sqlite';
import { compilePinnedNativeEntry,databaseFiles,fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord,stringifyDebugRecord } from './live-debug-record.mjs';

const root=process.cwd(),retained=resolve(process.argv[2]??''),out=resolve(process.argv[3]??''),rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V209 and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-execution-input-recovery-v209-01'));
const pins={};
const bytesPin=bytes=>({exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
const readPinnedBytes=path=>{const bytes=readFileSync(path);pins[path]=bytesPin(bytes);return bytes;};
const readPinned=path=>parseDebugRecord(readPinnedBytes(path).toString('utf8'));
const parentManifestPath=resolve(retained,'start-manifest.json');
const acceptedReport=readPinned(resolve(retained,'report.json')),accepted=readPinned(resolve(retained,'frontier.lossless.json')),parent=readPinned(parentManifestPath);
const parentReceiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_f2977213f9134a6b9dd532aee02c0cd4.json');
const parentReceipt=readPinned(parentReceiptPath);assert.equal(parentReceipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(parentReceipt.result,'PASS');assert.equal(parentReceipt.exit_code,0);
assert.deepEqual(parentReceipt.command,['node','tools/verification/check-native-execution-input-recovery-v209.mjs',
  'docs/verification/realism-debug-20261027/native-execution-input-v208-01','work/native-input-recovery-inventory-v209-01',relative(root,retained).replaceAll('\\','/')]);
assert.equal(bytesPin(readPinnedBytes(resolve(parentReceipt.output_path))).sha256,parentReceipt.output_sha256);
assert(acceptedReport.pass&&acceptedReport.originalDataUnchanged&&acceptedReport.recoveryAllOldRowsRowidsSchemaAndHeadsUnchanged);
assert(acceptedReport.combinedV208AndRecovery94RowsTwoCasAndSevenCatalogAdditionsProven&&acceptedReport.combinedVerificationDoesNotCompleteFailedRun);
assert(acceptedReport.parentSourcePatchProofRecomputed&&acceptedReport.parentSourcePinsReconciledWithApprovedPatches&&acceptedReport.sourceAndBundleEndPinProven&&acceptedReport.harnessAndInputEndPinsProven);
assert.equal(acceptedReport.failedV208Preserved,true);assert.equal(acceptedReport.originalFailedRunCompleted,false);assert.equal(acceptedReport.originalFailedRunEndPinsClaimed,false);
assert.deepEqual(acceptedReport.frontier,accepted);assert.deepEqual(acceptedReport.startManifestPin,pins[parentManifestPath]);
assert.equal(acceptedReport.nativeTestExit.code,0);assert.equal(acceptedReport.nativeSummary.pass,true);assert.equal(parent.runtime.closureBundleExecuted,false);
assert.equal(accepted.boundary,'NATIVE_EXECUTION_INPUT_RECOVERY_CHECKPOINT_ONLY');
for(const key of['recoveredCurrentCut9Proven','executionInputAccepted','finalLifecycleCurrentProven','inputAwaitingConsumerContinuation'])assert.equal(accepted[key],true);
for(const key of['nativePostInputConsumerProven','resumeReady','fullContinuationComplete','wholeRngConsumptionProven','commitmentAccepted','resolutionAccepted','fieldRootAccepted','officialTerminalProven','performancePass'])assert.equal(accepted[key],false);
assert.equal(accepted.nativeResumeAdapterRequired,true);assert.equal(accepted.normalLifecycleAdvances,0);assert.equal(accepted.calibrationAcceptanceCount,1);assert.equal(accepted.calibrationReaccepted,false);
assert.equal(accepted.finalViewReference.sourceId,'physical-fixture:cut9:view');assert.equal(accepted.eventReferences.length,9);assert.equal(accepted.calibrations.length,32);
assert.equal(accepted.calibrationReferences.length,32);assert.equal(accepted.worldAfter.head.worldRevision,1);assert.deepEqual(accepted.worldBefore,accepted.worldAfter);
assert.deepEqual(accepted.finalCurrent,accepted.finalHistorical);assert.deepEqual(accepted.finalCurrent.view.cut.operationReference,accepted.resumePins.decisionCutReference);
assert.deepEqual(accepted.currentDecisionCut.reference,accepted.resumePins.decisionCutReference);assert.equal(accepted.currentDecisionCut.record.operationOrdinal,3);
assert.deepEqual(accepted.input.source.viewReference,accepted.finalViewReference);assert.deepEqual(accepted.input.source.physicalOperationReference,accepted.resumePins.decisionCutReference);
assert.deepEqual(accepted.inputReference,accepted.resumePins.inputReference);assert.equal(Object.keys(accepted.resumePins).length,12);
for(const calibration of accepted.calibrations)assert.deepEqual(calibration.source.viewReference,accepted.finalViewReference);
assert.deepEqual(acceptedReport.appendedRows,{pa_lifecycle_v1_execution_calibrations:32,batting_execution_v1_inputs:1});
assert.equal(Object.values(acceptedReport.combinedV208AndRecoveryAppendRows).reduce((sum,n)=>sum+n,0),94);
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]]));
const enrollmentSourceId=accepted.originalInputs.action.lineage.enrollmentReference.sourceId,careerId=accepted.worldAfter.head.careerId;
assert.equal(careerId,accepted.finalCurrent.actor.binding.careerId);assert.equal(enrollmentSourceId,'native-enrollment');
const original=resolve(acceptedReport.copyPath),destination=resolve(out,'post-input-resolution-private.sqlite');
assert.equal(original,resolve(retained,'execution-input-recovered-private.sqlite'));

// This one approved shared Source patch is reconciled against its saved V209 baseline.
// All parent pins, including duplicate harness pins, are checked independently.
const sourceProofPath=resolve('work/native-post-input-v210-baseline/source-equivalence-proof.json'),sourceProof=readPinned(sourceProofPath);
readPinned(resolve('work/native-post-input-v210-baseline/manifest.json'));
assert.equal(sourceProof.pass,true);assert.equal(sourceProof.generatedJavaScriptExecuted,false);assert.equal(sourceProof.databaseOpens,0);assert.equal(sourceProof.nativeOperations,0);
assert.equal(resolve(sourceProof.parentManifestPath),parentManifestPath);assert.deepEqual(sourceProof.parentManifestPin,pins[parentManifestPath]);
const approvedPath='src/host/world/InFlightBattingLifecycleFixture.test-support.ts';
assert.equal(sourceProof.sources.length,1);const patch=sourceProof.sources[0];assert.equal(patch.sourcePath,approvedPath);
const baselineBytes=readPinnedBytes(resolve(patch.baselinePath)),currentBytes=readPinnedBytes(resolve(patch.sourcePath));
const oldSourcePin=parent.bundle.sourcePins[approvedPath];assert(oldSourcePin);
assert.deepEqual(bytesPin(baselineBytes),{exists:true,bytes:oldSourcePin.bytes,sha256:oldSourcePin.sha256});assert.deepEqual(bytesPin(currentBytes),patch.currentPin);
// The helper's exact replacement proof must recover every byte of the old seven-pin branch.
assert.equal(sourceProof.transformations.length,4);let reconstructed=currentBytes.toString('utf8');
for(const change of sourceProof.transformations){assert.equal(reconstructed.split(change.replacementBlock).length,2);reconstructed=reconstructed.replace(change.replacementBlock,change.originalBlock);}
assert(Buffer.from(reconstructed,'utf8').equals(baselineBytes),'approved Native branch change must reconstruct every V209 Source byte');
const parentPinPath=(path,pin)=>{
  if(resolve(root,path)!==resolve(root,approvedPath))return resolve(root,path);
  assert.equal(pin.bytes,oldSourcePin.bytes);assert.equal(pin.sha256,oldSourcePin.sha256);return resolve(patch.baselinePath);
};
const pinParent=async()=>{
  assert.equal(acceptedReport.bundles.length,2);
  for(const p of[parent.bundle,parent.digestBundle]){
    assert.deepEqual(await fileState(p.bundlePath),{exists:true,bytes:p.bytes,sha256:p.sha256});
    const ended=acceptedReport.bundles.filter(value=>value.sha256===p.sha256);assert.equal(ended.length,1);assert.equal(ended[0].inputCount,p.inputCount);
    assert.equal(ended[0].executed,p===parent.digestBundle);assert.deepEqual(Object.keys(ended[0].sourcePins).sort(),Object.keys(p.sourcePins).sort());
    for(const[path,pin]of Object.entries(p.sourcePins)){
      assert.deepEqual(ended[0].sourcePins[path],{...pin,endSha256:pin.sha256});
      assert.deepEqual(await fileState(parentPinPath(path,pin)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
    }
  }
  for(const[path,pin]of Object.entries(parent.harnessPins))assert.deepEqual(await fileState(parentPinPath(path,pin)),pin);
  for(const[path,pin]of Object.entries(pins))assert.deepEqual(await fileState(resolve(root,path)),pin);
};
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const retainedDatabases=new Map(Object.entries(acceptedReport.retainedDataAfter).map(([path,pin])=>[resolve(path),pin]));
assert(!retainedDatabases.has(original));retainedDatabases.set(original,acceptedReport.copyAfter);assert.equal(retainedDatabases.size,8);
const appendCounts={pa_lifecycle_v1_work_prefixes:2,pa_lifecycle_v1_total_assessments:20,pa_lifecycle_v1_execution_views:2,
  pa_lifecycle_v1_execution_calibrations:64,pa_physical_v1_commitments:1,pa_physical_v1_resolutions:1,world_decision_revision_events:1};
const appendTables=Object.keys(appendCounts),mutableTables=['pa_physical_v1_heads','world_control_heads'],allowed=new Set([...appendTables,...mutableTables]);
assert.equal(Object.values(appendCounts).reduce((sum,n)=>sum+n,0),91);
const rawRows=(db,table)=>{const q=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');q.setReadBigInts(true);return q.all();};
const persistedRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const report={pass:false,boundary:'NATIVE_POST_INPUT_RESOLUTION_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,parentV209Receipt:parentReceiptPath,parentV209Accepted:true,
  failedV208Preserved:true,originalFailedRunCompleted:false,originalFailedRunEndPinsClaimed:false,parentSourcePatchProofRecomputed:true,
  parentCombinedHistoryProven:true,normalLifecycleAdvances:0,finalLifecycleCurrentProven:false,
  nativeBattingSuffixResolved:false,lifecycleResolvedProven:false,commitmentAccepted:false,resolutionAccepted:false,
  nativePostResolvedConsumerProven:false,nativeResumeAdapterRequired:true,resumeReady:false,fullContinuationComplete:false,
  fieldRootAccepted:false,officialTerminalProven:false,wholeRngConsumptionProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.retainedDataBefore={};for(const[path,pin]of retainedDatabases){const actual=await databaseFiles(path);assert.deepEqual(dataPin(actual),dataPin(pin),'retained data changed: '+path);report.retainedDataBefore[path]=actual;}
  report.originalBefore=report.retainedDataBefore[original];report.harnessPins={...pins};
  for(const path of['tools/verification/check-native-post-input-resolution-v210.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  await pinParent();digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  assert.equal(digestBundle.inputCount,1);assert.deepEqual(Object.keys(digestBundle.sourcePins),['tools/verification/NativeSpinNeutralV193-sql.ts']);
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-post-input-resolution-v210.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  for(const[path,pin]of Object.entries(report.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,retainedDataBefore:report.retainedDataBefore,input,enrollmentSourceId,careerId,
    approvedSourcePatch:{sourcePath:approvedPath,baselinePath:patch.baselinePath,oldPin:oldSourcePin,currentPin:patch.currentPin},sourceEquivalenceProof:pins[sourceProofPath],sourceEquivalenceRecomputed:true,
    appendCounts,mutableTables,parentV209Receipt:parentReceiptPath,parentCombinedHistoryProven:true,failedV208Preserved:true,originalFailedRunEndPinsClaimed:false,
    stopBoundary:'NORMAL_RESOLVED_CUT11_AFTER_ORIGINAL_NATIVE_COMMITMENT_AND_RESOLUTION',
    constraints:['ONE_REAL_VITEST_NP210_S01_ON_NEW_OWNED_SQLITE_BACKUP','NO_INPUT_OBSERVATION_EMOTION_FORECAST_REACCEPT','TWO_NORMAL_LIFECYCLE_ADVANCES_WITH_CAL32_CHECKPOINTS',
      'TWO_PHYSICAL_HEAD_CAS_AND_ONE_WORLD_HEAD_CAS_ONLY','NO_SCHEMA_OR_LAUNCH_COMPANION_OR_INVOCATION_CHANGE','OLD_FAILURE_AND_ALL_ANCESTOR_DATA_PRESERVED',
      'NO_FIXTURE_BUNDLE_EXECUTION','NO_FIELD_OR_OFFICIAL_OR_PERFORMANCE_OR_WHOLE_RNG_COMPLETION_CLAIM']});
  report.startManifestPin=await fileState(resolve(out,'start-manifest.json'));
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);
  const through=Object.create(null);for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  const physicalBefore=rawRows(source,'pa_physical_v1_heads'),worldBefore=rawRows(source,'world_control_heads');
  const oldP=physicalBefore.filter(row=>row.enrollment_source_id===enrollmentSourceId),oldW=worldBefore.filter(row=>row.career_id===careerId);
  assert.equal(oldP.length,1);assert.equal(oldW.length,1);assert.equal(oldP[0].operation_ordinal,3n);assert.equal(oldW[0].world_revision,1n);
  assert.equal(oldP[0].last_owner,accepted.resumePins.decisionCutReference.owner);assert.equal(oldP[0].last_source_id,accepted.resumePins.decisionCutReference.sourceId);assert.equal(oldP[0].last_snapshot_hash,accepted.resumePins.decisionCutReference.snapshotHash);
  save('physical-heads-before.lossless.json',persistedRows(physicalBefore));save('world-heads-before.lossless.json',persistedRows(worldBefore));
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-post-input-resolution-v210.test.ts','--testNamePattern','NP210-S01','--maxWorkers=1','--minWorkers=1'],
    {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_NATIVE_POST_INPUT_RESOLUTION_V210_DATABASE:destination,BASEBALL_NATIVE_POST_INPUT_RESOLUTION_V210_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_POST_INPUT_RESOLUTION_V210_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'Native post-input resolution failed; retain records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert.equal(report.nativeSummary.pass,true);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);
  for(const key of['nativeBattingSuffixResolved','lifecycleResolvedProven','commitmentAccepted','resolutionAccepted','finalLifecycleCurrentProven'])assert.equal(frontier[key],true);
  for(const key of['nativePostResolvedConsumerProven','resumeReady','fullContinuationComplete','fieldRootAccepted','officialTerminalProven','wholeRngConsumptionProven','performancePass'])assert.equal(frontier[key],false);
  assert.equal(frontier.nativeResumeAdapterRequired,true);assert.equal(frontier.normalLifecycleAdvances,2);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut11:view');
  assert.equal(frontier.postInputEntryAuthenticated,true);assert.equal(frontier.newPracticeAccepted,0);assert.equal(frontier.twoTakeReplayed,false);assert.equal(frontier.forecastRegenerated,false);
  assert.deepEqual(frontier.retainedInputReferences,input.retainedInputReferences);
  assert.deepEqual(Object.keys(frontier.resumePins).sort(),[...Object.keys(input.resumePins),'commitmentReference','resolutionReference'].sort());
  for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  assert.deepEqual(frontier.resumePins.commitmentReference,frontier.commitmentReference);assert.deepEqual(frontier.resumePins.resolutionReference,frontier.resolutionReference);
  assert.deepEqual(frontier.eventReferences,[...input.eventReferences,frontier.commitmentReference,frontier.resolutionReference]);assert.equal(frontier.eventReferences.length,11);
  assert.deepEqual(frontier.finalPrefixReference,frontier.finalCurrent.view.source.prefixReference);assert.deepEqual(frontier.prefix.source.eventReferences,frontier.eventReferences);assert.equal(frontier.totals.length,10);
  assert.deepEqual(frontier.finalCurrent,frontier.finalHistorical);assert.equal(frontier.finalCurrent.view.cut.stage,'resolved');
  assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,frontier.resolutionReference);assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,frontier.resolutionReference);
  assert.deepEqual(frontier.currentPhysicalOperation.reference,frontier.resolutionReference);assert.deepEqual(frontier.currentPhysicalOperation.record,frontier.resolution);
  assert.equal(frontier.commitment.kind,'same_pa_physical_commitment_v1');assert.equal(frontier.resolution.kind,'same_pa_physical_resolution_v1');
  assert.equal(frontier.commitment.operationOrdinal,4);assert.equal(frontier.resolution.operationOrdinal,5);
  assert.deepEqual(frontier.commitment.source.previousOperationReference,input.resumePins.decisionCutReference);assert.deepEqual(frontier.commitment.source.inputReference,input.resumePins.inputReference);
  assert.deepEqual(frontier.resolution.source.previousOperationReference,frontier.commitmentReference);assert.deepEqual(frontier.resolution.source.commitmentReference,frontier.commitmentReference);
  assert.deepEqual(frontier.actualBatBallResult,frontier.resolution.resolution);assert.deepEqual(frontier.actualContact,frontier.resolution.contact);
  assert.deepEqual(frontier.canonicalTimeline,frontier.resolution.timeline);
  assert.deepEqual(frontier.originalInputs.executionInput,accepted.input);assert.deepEqual(frontier.historicalInput,accepted.input);assert.deepEqual(frontier.originalInputs.current,accepted.finalCurrent);
  for(const key of['actor','launch','captureCut','deliveryCut','decisionCut','action','posture','intent','model','fieldCalibration','bodyModel','batterBody','qualifications','acceptedAction','originalAction','dispatchCalibrationIds','genesis','score','emotion'])assert.deepEqual(frontier.originalInputs[key],accepted.originalInputs[key]);
  assert.equal(frontier.originalInputs.action.source.nominalPitch.delivery.matchSeed,19);assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.matchSeed,19);
  assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.outingId,'outing-1');assert.equal(frontier.originalInputs.action.lineage.playId,7);assert.equal(frontier.originalInputs.launch.pitchOrdinal,3);
  assert.deepEqual(frontier.worldBefore,accepted.worldAfter);assert.deepEqual(frontier.worldAfter,{head:{...accepted.worldAfter.head,worldRevision:2},controlJson:accepted.worldAfter.controlJson});
  assert.equal(frontier.calibrations.length,32);assert.equal(frontier.calibrationReferences.length,32);
  for(const calibration of frontier.calibrations)assert.deepEqual(calibration.source.viewReference,frontier.finalViewReference);
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));report.normalCheckpointStages=[];
  const authStages=stages.filter(value=>value.name==='native-post-input-entry-authenticated'),finalStages=stages.filter(value=>value.name==='normal-resolved-cut11-cal32-and-world-authenticated');
  assert.equal(authStages.length,1);assert.equal(finalStages.length,1);
  for(const cut of[10,11]){
    const name='normal-cut'+cut+'-current-cal32-physical-world-checkpoint',matches=stages.filter(value=>value.name===name);assert.equal(matches.length,1);
    const checkpoint=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+matches[0].index+'-'+name+'.lossless.json'),'utf8'));
    assert.equal(checkpoint.finalLifecycleCurrentProven,true);assert.equal(checkpoint.normalLifecycleAdvances,cut-9);assert.equal(checkpoint.finalViewReference.sourceId,'physical-fixture:cut'+cut+':view');
    assert.equal(checkpoint.calibrations.length,32);assert.equal(checkpoint.calibrationReferences.length,32);assert.equal(checkpoint.resumePins&&Object.keys(checkpoint.resumePins).length,cut+3);
    const operationRef=cut===10?frontier.commitmentReference:frontier.resolutionReference;
    assert.deepEqual(checkpoint.eventReferences,[...input.eventReferences,frontier.commitmentReference,...(cut===11?[frontier.resolutionReference]:[])]);
    assert.deepEqual(checkpoint.finalPrefixReference,checkpoint.finalCurrent.view.source.prefixReference);assert.deepEqual(checkpoint.prefix.source.eventReferences,checkpoint.eventReferences);assert.equal(checkpoint.totals.length,10);
    assert.deepEqual(checkpoint.currentPhysicalOperation.reference,operationRef);assert.deepEqual(checkpoint.currentPhysicalOperation.record,cut===10?frontier.commitment:frontier.resolution);
    assert.deepEqual(checkpoint.finalCurrent.view.cut.operationReference,operationRef);assert.deepEqual(checkpoint.finalCurrent.view.cut.physicalOperationReference,operationRef);
    assert.deepEqual(checkpoint.world,frontier.worldAfter);assert.deepEqual(checkpoint.commitmentReference,frontier.commitmentReference);assert.deepEqual(checkpoint.commitment,frontier.commitment);
    assert.deepEqual(checkpoint.historicalInput,accepted.input);
    for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(checkpoint.resumePins[key],value);
    for(const calibration of checkpoint.calibrations)assert.deepEqual(calibration.source.viewReference,checkpoint.finalViewReference);
    if(cut===11){assert.deepEqual(checkpoint.finalCurrent,frontier.finalCurrent);assert.deepEqual(checkpoint.calibrations,frontier.calibrations);assert.equal(checkpoint.lifecycleResolvedProven,true);assert.equal(checkpoint.nativeBattingSuffixResolved,true);assert.deepEqual(checkpoint.resolutionReference,frontier.resolutionReference);assert.deepEqual(checkpoint.resolution,frontier.resolution);}
    report.normalCheckpointStages.push(matches[0]);
  }
  assert(authStages[0].index<report.normalCheckpointStages[0].index&&report.normalCheckpointStages[0].index<report.normalCheckpointStages[1].index&&report.normalCheckpointStages[1].index<finalStages[0].index,'Native auth and both Owner-released checkpoints must precede final resolution proof');
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('after-logical-with-rowid.json',after);
  assert.deepEqual(after.catalog,before.catalog,'V210 must not add or change any schema');
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'retained immutable row/rowid changed: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,after.tables[table].rows-before.tables[table].rows]));assert.deepEqual(report.appendedRows,appendCounts);
  assert.equal(Object.values(report.appendedRows).reduce((sum,count)=>sum+count,0),91);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));
  assert.deepEqual([...report.changedTables].sort(),[...allowed].sort());
  const physicalAfter=rawRows(target,'pa_physical_v1_heads'),worldAfter=rawRows(target,'world_control_heads');
  save('physical-heads-after.lossless.json',persistedRows(physicalAfter));save('world-heads-after.lossless.json',persistedRows(worldAfter));
  assert.deepEqual(physicalAfter.filter(row=>row.enrollment_source_id!==enrollmentSourceId),physicalBefore.filter(row=>row.enrollment_source_id!==enrollmentSourceId));
  assert.deepEqual(worldAfter.filter(row=>row.career_id!==careerId),worldBefore.filter(row=>row.career_id!==careerId));
  const newP=physicalAfter.filter(row=>row.enrollment_source_id===enrollmentSourceId),newW=worldAfter.filter(row=>row.career_id===careerId);assert.equal(newP.length,1);assert.equal(newW.length,1);
  assert.deepEqual(newP[0],Object.assign(Object.create(null),oldP[0],{operation_ordinal:oldP[0].operation_ordinal+2n,last_owner:frontier.resolutionReference.owner,last_source_id:frontier.resolutionReference.sourceId,last_snapshot_hash:frontier.resolutionReference.snapshotHash}));
  assert.deepEqual(newW[0],Object.assign(Object.create(null),oldW[0],{world_revision:oldW[0].world_revision+1n}));
  report.onlyExpectedTwoPhysicalAndOneWorldHeadCasProven=true;report.existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged=true;report.launchCompanionsAndBattingInvocationRowsUnchanged=true;
  target.exec('ROLLBACK');target.close();target=null;
  report.nativeBattingSuffixResolved=true;report.lifecycleResolvedProven=true;report.commitmentAccepted=true;report.resolutionAccepted=true;
  report.normalLifecycleAdvances=2;report.finalLifecycleCurrentProven=true;report.parentCombinedHistoryRowsAndSchemaPreserved=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.retainedDataAfter={};for(const[path,before]of Object.entries(report.retainedDataBefore??{})){const after=await databaseFiles(path);assert.deepEqual(dataPin(after),dataPin(before),'retained data changed: '+path);report.retainedDataAfter[path]=after;}
    assert.equal(Object.keys(report.retainedDataAfter).length,retainedDatabases.size);report.originalAfter=report.retainedDataAfter[original];report.copyAfter=await databaseFiles(destination);report.originalDataUnchanged=true;
    await pinParent();report.parentSourcePinsReconciledWithApprovedPatch=true;report.bundles=[];
    for(const p of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(p.bundlePath),{exists:true,bytes:p.bytes,sha256:p.sha256});const sourcePins={};
      for(const[path,pin]of Object.entries(p.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});sourcePins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:p===digestBundle,inputCount:p.inputCount,sha256:p.sha256,sourcePins});
    }
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;assert.deepEqual(await fileState(resolve(out,'start-manifest.json')),report.startManifestPin);
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,nativeBattingSuffixResolved:report.nativeBattingSuffixResolved,lifecycleResolvedProven:report.lifecycleResolvedProven,
  appendedRows:report.appendedRows,onlyExpectedTwoPhysicalAndOneWorldHeadCasProven:report.onlyExpectedTwoPhysicalAndOneWorldHeadCasProven,
  originalDataUnchanged:report.originalDataUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  resumeReady:false,fullContinuationComplete:false,performancePass:false,error:report.error??report.cleanupError??report.pinError??null}));
