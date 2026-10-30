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
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V211 and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-field-root-v211-01'));
const pins={};
const bytesPin=bytes=>({exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
const readPinnedBytes=path=>{const bytes=readFileSync(path);pins[path]=bytesPin(bytes);return bytes;};
const readPinned=path=>parseDebugRecord(readPinnedBytes(path).toString('utf8'));
const parentManifestPath=resolve(retained,'start-manifest.json');
const acceptedReport=readPinned(resolve(retained,'report.json')),accepted=readPinned(resolve(retained,'frontier.lossless.json')),parent=readPinned(parentManifestPath);
const parentReceiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_431cec0b82524ddcbe89373624b1504f.json');
const parentReceipt=readPinned(parentReceiptPath);assert.equal(parentReceipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(parentReceipt.result,'PASS');assert.equal(parentReceipt.exit_code,0);
assert.equal(parentReceipt.command.length,4);assert.deepEqual(parentReceipt.command.slice(0,3),['node','tools/verification/check-native-field-root-v211.mjs',
  'docs/verification/realism-debug-20261027/native-post-input-resolution-v210-01']);
assert.equal(typeof parentReceipt.command[3],'string');assert.equal(resolve(root,parentReceipt.command[3]),retained);
assert.equal(bytesPin(readPinnedBytes(resolve(parentReceipt.output_path))).sha256,parentReceipt.output_sha256);
for(const key of['pass','originalDataUnchanged','onlyExpectedOnePhysicalHeadCasProven','worldAndAllOtherHeadsUnchanged','existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged',
  'noFieldStepAiOrOfficialRowsAccepted','parentCombinedHistoryProven','parentCombinedHistoryRowsAndSchemaPreserved','parentSourceAndHarnessPinsUnchanged','sourceAndBundleEndPinProven','harnessAndInputEndPinsProven'])assert.equal(acceptedReport[key],true);
assert.equal(acceptedReport.failedV208Preserved,true);assert.equal(acceptedReport.originalFailedRunCompleted,false);assert.equal(acceptedReport.originalFailedRunEndPinsClaimed,false);
assert.deepEqual(acceptedReport.frontier,accepted);assert.deepEqual(acceptedReport.startManifestPin,pins[parentManifestPath]);
assert.equal(acceptedReport.nativeTestExit.code,0);assert.equal(acceptedReport.nativeSummary.pass,true);assert.equal(parent.runtime.closureBundleExecuted,false);
assert.equal(accepted.boundary,'NATIVE_FIELD_ROOT_CHECKPOINT_ONLY');
assert.equal(accepted.fieldRootAccepted,true);assert.equal(accepted.finalLifecycleCurrentProven,true);
for(const key of['nativePostFieldRootConsumerProven','fieldStepAccepted','resumeReady','fullContinuationComplete','officialTerminalProven','wholeRngConsumptionProven','performancePass',
  'twoTakeReplayed','forecastRegenerated','fieldRootRegenerated','flightAdvanceProven','ballRunAccepted','contactFieldingAccepted','defensiveAiAccepted'])assert.equal(accepted[key],false);
assert.equal(accepted.nativeResumeAdapterRequired,true);assert.equal(accepted.normalLifecycleAdvances,1);assert.equal(accepted.finalViewReference.sourceId,'physical-fixture:cut12:view');
assert.equal(accepted.eventReferences.length,12);assert.equal(Object.keys(accepted.resumePins).length,15);assert.equal(accepted.calibrations.length,32);assert.equal(accepted.calibrationReferences.length,32);
assert.deepEqual(accepted.finalCurrent,accepted.finalHistorical);assert.equal(accepted.finalCurrent.view.cut.stage,'field_active');
assert.deepEqual(accepted.currentPhysicalOperation.reference,accepted.resumePins.fieldRootReference);assert.deepEqual(accepted.currentPhysicalOperation.record,accepted.fieldRoot);
assert.deepEqual(accepted.finalCurrent.view.cut.operationReference,accepted.resumePins.fieldRootReference);assert.deepEqual(accepted.finalCurrent.view.cut.physicalOperationReference,accepted.resumePins.fieldRootReference);
assert.deepEqual(accepted.fieldRootReference,accepted.resumePins.fieldRootReference);assert.equal(accepted.fieldRoot.kind,'same_pa_physical_field_root_v1');assert.equal(accepted.fieldRoot.operationOrdinal,6);
assert.equal(accepted.worldAfter.head.worldRevision,2);assert.deepEqual(accepted.worldBefore,accepted.worldAfter);
assert.deepEqual(accepted.historicalInput,accepted.originalInputs.historicalInput);assert.equal(accepted.originalInputs.posture.source.geometry.validUntilTick,42765369);
for(const calibration of accepted.calibrations)assert.deepEqual(calibration.source.viewReference,accepted.finalViewReference);
assert.deepEqual(acceptedReport.appendedRows,{pa_physical_v1_field_roots:1,pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,
  pa_lifecycle_v1_execution_views:1,pa_lifecycle_v1_execution_calibrations:32});
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]]));
const preparation=input.retainedInputReferences,profile=preparation.futureProfileDeclarationOnly;
assert.equal(profile.futureFieldRootSourceVersion,'same_pa_field_root_aero_ground_escape_v3');assert.equal(profile.futureBallPhysics.kind,'aero_ground_v1');
assert.equal(profile.futureFieldRootAccepted,false);assert.equal(profile.outcomeBasedProfileAdjustment,false);
const enrollmentSourceId=accepted.originalInputs.action.lineage.enrollmentReference.sourceId,careerId=accepted.worldAfter.head.careerId;
assert.equal(careerId,accepted.finalCurrent.actor.binding.careerId);assert.equal(enrollmentSourceId,'native-enrollment');
const original=resolve(acceptedReport.copyPath),destination=resolve(out,'field-clock-private.sqlite');
assert.equal(original,resolve(retained,'field-root-private.sqlite'));

// Only the explicitly approved optional helper hook changes a parent Source.
// Every old harness pin and each new read pin is still checked separately.
const sourceProofPath=resolve('work/native-field-clock-v212-baseline/source-equivalence-proof.json'),sourceProof=readPinned(sourceProofPath);
readPinned(resolve('work/native-field-clock-v212-baseline/manifest.json'));
assert.equal(sourceProof.pass,true);assert.equal(sourceProof.generatedJavaScriptExecuted,false);assert.equal(sourceProof.databaseOpens,0);assert.equal(sourceProof.nativeOperations,0);
assert.equal(sourceProof.oldOuterBytesExact,true);assert.equal(sourceProof.originalCalibrationFactoryBytesExact,true);assert.equal(sourceProof.defaultContextAbsentDeclarationAndOwnerPathPreserved,true);assert.equal(sourceProof.genericCallbacksAdded,0);
assert.equal(resolve(sourceProof.parentManifestPath),parentManifestPath);assert.deepEqual(sourceProof.parentManifestPin,pins[parentManifestPath]);
const approvedPath='src/host/world/SamePlateAppearanceLifecycleFixture.test-support.ts';
assert.equal(sourceProof.sources.length,1);const patch=sourceProof.sources[0];assert.equal(patch.sourcePath,approvedPath);
const baselineBytes=readPinnedBytes(resolve(patch.baselinePath)),currentBytes=readPinnedBytes(resolve(patch.sourcePath)),oldSourcePin=parent.bundle.sourcePins[approvedPath];assert(oldSourcePin);
assert.deepEqual(bytesPin(baselineBytes),{exists:true,bytes:oldSourcePin.bytes,sha256:oldSourcePin.sha256});assert.deepEqual(bytesPin(currentBytes),patch.currentPin);
assert.equal(sourceProof.transformations.length,3);let reconstructed=currentBytes.toString('utf8');
for(const change of sourceProof.transformations){assert.equal(reconstructed.split(change.replacementBlock).length,2);reconstructed=reconstructed.replace(change.replacementBlock,change.originalBlock);}
assert(Buffer.from(reconstructed,'utf8').equals(baselineBytes),'optional hook must reconstruct every original helper byte');
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
assert(!retainedDatabases.has(original));retainedDatabases.set(original,acceptedReport.copyAfter);assert.equal(retainedDatabases.size,10);
const appendCounts={pa_physical_v1_field_steps:1,pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,
  pa_lifecycle_v1_execution_views:1,pa_lifecycle_v1_execution_calibrations:32};
const appendTables=Object.keys(appendCounts),mutableTables=['pa_physical_v1_heads'],allowed=new Set([...appendTables,...mutableTables]);
assert.equal(Object.values(appendCounts).reduce((sum,n)=>sum+n,0),45);
const rawRows=(db,table)=>{const q=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');q.setReadBigInts(true);return q.all();};
const persistedRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const report={pass:false,boundary:'NATIVE_FIELD_CLOCK_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,parentV211Receipt:parentReceiptPath,parentV211Command:parentReceipt.command,parentV211Accepted:true,parentSourceChanges:1,parentSourcePatchProofRecomputed:true,
  failedV208Preserved:true,originalFailedRunCompleted:false,originalFailedRunEndPinsClaimed:false,parentCombinedHistoryProven:true,
  normalLifecycleAdvances:0,finalLifecycleCurrentProven:false,fieldStepAccepted:false,observationClockProjected:false,observationClockProjectionCount:0,
  nativePostFieldClockConsumerProven:false,executedObservationClockProbeProven:false,executedObservationClockProbeStatus:'UNKNOWN',executedObservationClockProbeReason:'NO_RETAINED_ACTUAL_DEFENDER_OBSERVATION_SOURCE',
  nativeResumeAdapterRequired:true,resumeReady:false,fullContinuationComplete:false,
  officialTerminalProven:false,wholeRngConsumptionProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.retainedDataBefore={};for(const[path,pin]of retainedDatabases){const actual=await databaseFiles(path);assert.deepEqual(dataPin(actual),dataPin(pin),'retained data changed: '+path);report.retainedDataBefore[path]=actual;}
  report.originalBefore=report.retainedDataBefore[original];report.harnessPins={...pins};
  for(const path of['tools/verification/check-native-field-clock-v212.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  await pinParent();digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  assert.equal(digestBundle.inputCount,1);assert.deepEqual(Object.keys(digestBundle.sourcePins),['tools/verification/NativeSpinNeutralV193-sql.ts']);
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-field-clock-v212.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  for(const[path,pin]of Object.entries(report.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,retainedDataBefore:report.retainedDataBefore,input,enrollmentSourceId,careerId,
    parentV211Receipt:parentReceiptPath,parentV211Command:parentReceipt.command,parentSourceChanges:1,parentCombinedHistoryProven:true,failedV208Preserved:true,originalFailedRunEndPinsClaimed:false,
    approvedSourcePatch:{sourcePath:approvedPath,baselinePath:patch.baselinePath,oldPin:oldSourcePin,currentPin:patch.currentPin},sourceEquivalenceProof:pins[sourceProofPath],sourceEquivalenceRecomputed:true,
    appendCounts,mutableTables,stopBoundary:'NORMAL_FIELD_STEP_CUT13_AND_NINE_OWNER_AUTHENTICATED_CLOCK_PROJECTIONS',
    constraints:['ONE_REAL_VITEST_NF212_S01_ON_NEW_OWNED_SQLITE_BACKUP','NO_BATTING_OR_OLD_CALIBRATION_OR_BODY_REACCEPT','RETAINED_ESCAPE_V3_FREE_STEP_THROUGH_ORIGINAL_COVERAGE_42765369',
      'ONE_NORMAL_LIFECYCLE_ADVANCE_WITH_OWNER_RELEASED_CAL32_CHECKPOINT','ONE_PHYSICAL_HEAD_CAS_WORLD_AND_OTHER_HEADS_UNCHANGED','NO_SCHEMA_CHANGE',
      'NO_DEFAULT_CALIBRATION_FALLBACK_AFTER_CLOCK_PROJECTION_INAPPLICABLE','NO_HORIZON_RETUNE_OR_EXTRA_FIELD_STEP_OR_AI_OR_OFFICIAL','OLD_FAILURE_AND_ALL_ANCESTOR_DATA_PRESERVED',
      'NO_FIXTURE_BUNDLE_EXECUTION','NO_PERFORMANCE_OR_WHOLE_RNG_COMPLETION_CLAIM']});
  report.startManifestPin=await fileState(resolve(out,'start-manifest.json'));
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);
  const through=Object.create(null);for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  const physicalBefore=rawRows(source,'pa_physical_v1_heads'),worldBefore=rawRows(source,'world_control_heads');
  const oldP=physicalBefore.filter(row=>row.enrollment_source_id===enrollmentSourceId),oldW=worldBefore.filter(row=>row.career_id===careerId);
  assert.equal(oldP.length,1);assert.equal(oldW.length,1);assert.equal(oldP[0].operation_ordinal,6n);assert.equal(oldW[0].world_revision,2n);
  assert.equal(oldP[0].last_owner,accepted.fieldRootReference.owner);assert.equal(oldP[0].last_source_id,accepted.fieldRootReference.sourceId);assert.equal(oldP[0].last_snapshot_hash,accepted.fieldRootReference.snapshotHash);
  save('physical-heads-before.lossless.json',persistedRows(physicalBefore));save('world-heads-before.lossless.json',persistedRows(worldBefore));
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-field-clock-v212.test.ts','--testNamePattern','NF212-S01','--maxWorkers=1','--minWorkers=1'],
    {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_NATIVE_FIELD_CLOCK_V212_DATABASE:destination,BASEBALL_NATIVE_FIELD_CLOCK_V212_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_FIELD_CLOCK_V212_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});await new Promise(done=>output.end(done));report.nativeTestExit=exit;
  if(exit.code!==0&&existsSync(resolve(records,'stages.jsonl'))){
    const stagesPath=resolve(records,'stages.jsonl'),failedStages=readPinnedBytes(stagesPath).toString('utf8').trim().split('\n').map(line=>JSON.parse(line));
    const inapplicable=failedStages.filter(stage=>stage.name==='normal-field-step-clock-projection-inapplicable');assert(inapplicable.length<=1);
    if(inapplicable.length===1){
      const stage=inapplicable[0],path=resolve(records,'checkpoint-'+stage.index+'-'+stage.name+'.lossless.json'),checkpoint=readPinned(path);
      assert.equal(checkpoint.clockProjectionApplicable,false);assert.equal(checkpoint.observationClockProjected,false);assert.equal(checkpoint.normalLifecycleAdvances,0);
      assert.equal(checkpoint.reason,'NORMAL_FIELD_STEP_HAS_CARRIER_OR_NO_FREE_SOURCE_CURSOR');assert.equal(checkpoint.executedObservationClockProbeProven,false);
      assert.equal(checkpoint.fieldStep.kind,'same_pa_physical_field_step_v1');assert.equal(checkpoint.fieldStep.operationOrdinal,7);
      assert.deepEqual(checkpoint.currentPhysicalOperation.record,checkpoint.fieldStep);assert.deepEqual(checkpoint.currentPhysicalOperation.reference,checkpoint.fieldStepReference);
      assert.deepEqual(checkpoint.fieldStepSource,checkpoint.fieldStep.source);assert.equal(checkpoint.fieldStepSource.throughTick,42765369);assert.equal(Object.hasOwn(checkpoint.fieldStepSource,'action'),false);
      assert.deepEqual(checkpoint.eventReferences,[...input.eventReferences,checkpoint.fieldStepReference]);assert.deepEqual(checkpoint.world,accepted.worldAfter);
      assert.deepEqual(checkpoint.resumePins,{...input.resumePins,fieldStepReference:checkpoint.fieldStepReference});
      report.fieldStepAccepted=true;report.clockProjectionApplicable=false;report.partialAcceptedFieldStepBeforeClockGuardProven=true;
      report.clockProjectionInapplicable={stage,checkpoint};report.nativeFailureEvidencePins={[stagesPath]:pins[stagesPath],[path]:pins[path]};
    }
  }
  assert.equal(exit.code,0,'Native field clock failed; retain inapplicable-clock stage and original guard errors');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert.equal(report.nativeSummary.pass,true);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert.equal(frontier.fieldStepAccepted,true);assert.equal(frontier.finalLifecycleCurrentProven,true);
  assert.equal(frontier.observationClockProjected,true);assert.equal(frontier.observationClockProjectionCount,9);
  for(const key of['nativePostFieldClockConsumerProven','executedObservationClockProbeProven','defensiveAiAccepted','resumeReady','fullContinuationComplete','officialTerminalProven','wholeRngConsumptionProven','performancePass','twoTakeReplayed','forecastRegenerated','fieldRootRegenerated'])assert.equal(frontier[key],false);
  assert.equal(frontier.clockProjectionApplicable,true);assert.equal(frontier.executedObservationClockProbeStatus,'UNKNOWN');assert.equal(frontier.executedObservationClockProbeReason,'NO_RETAINED_ACTUAL_DEFENDER_OBSERVATION_SOURCE');
  assert.equal(frontier.newPracticeAccepted,0);assert.deepEqual(frontier.declaration,profile);assert.deepEqual(frontier.historicalInput,accepted.historicalInput);
  assert.equal(frontier.nativeResumeAdapterRequired,true);assert.equal(frontier.normalLifecycleAdvances,1);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut13:view');
  assert.deepEqual(frontier.retainedInputReferences,input.retainedInputReferences);
  assert.deepEqual(Object.keys(frontier.resumePins).sort(),[...Object.keys(input.resumePins),'fieldStepReference'].sort());
  for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  assert.deepEqual(frontier.resumePins.fieldStepReference,frontier.fieldStepReference);assert.deepEqual(frontier.eventReferences,[...input.eventReferences,frontier.fieldStepReference]);assert.equal(frontier.eventReferences.length,13);
  assert.deepEqual(frontier.finalPrefixReference,frontier.finalCurrent.view.source.prefixReference);assert.deepEqual(frontier.prefix.source.eventReferences,frontier.eventReferences);assert.equal(frontier.totals.length,10);
  assert.deepEqual(frontier.finalCurrent,frontier.finalHistorical);assert.equal(frontier.finalCurrent.view.cut.stage,'field_active');
  assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,frontier.fieldStepReference);assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,frontier.fieldStepReference);
  assert.deepEqual(frontier.currentPhysicalOperation.reference,frontier.fieldStepReference);assert.deepEqual(frontier.currentPhysicalOperation.record,frontier.fieldStep);
  const step=frontier.fieldStep,stepSource=step.source;assert.equal(step.kind,'same_pa_physical_field_step_v1');assert.equal(step.operationOrdinal,7);
  assert.equal(stepSource.capability,'same_pa_physical_field_step_v1');assert.equal(stepSource.sourceId,profile.fieldLabel+':field-step');assert.equal(stepSource.sourceVersion,profile.futureFieldStepSourceVersion);
  assert.deepEqual(frontier.fieldStepSource,stepSource);assert.deepEqual(stepSource.viewReference,input.finalViewReference);assert.deepEqual(stepSource.launchReference,input.resumePins.launchReference);
  for(const key of['previousOperationReference','previousFieldReference','fieldRootReference'])assert.deepEqual(stepSource[key],input.resumePins.fieldRootReference);
  assert.equal(stepSource.throughTick,42765369);assert.equal(Object.hasOwn(stepSource,'action'),false);assert(step.evaluationTick>accepted.fieldRoot.evaluationTick&&step.evaluationTick<=stepSource.throughTick);
  assert.deepEqual(frontier.originalInputs.fieldRoot,accepted.fieldRoot);assert.deepEqual(frontier.originalInputs.current,accepted.finalCurrent);
  for(const key of['actor','launch','action','posture','intent','fieldCalibration','bodyModel','batterBody','originalAction'])assert.deepEqual(frontier.originalInputs[key],accepted.originalInputs[key]);
  assert.equal(frontier.originalInputs.action.source.nominalPitch.delivery.matchSeed,19);assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.matchSeed,19);
  assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.outingId,'outing-1');assert.equal(frontier.originalInputs.action.lineage.playId,7);assert.equal(frontier.originalInputs.launch.pitchOrdinal,3);
  assert.equal(step.field.motion.carrierPlayerId,null);assert(step.field.motion.cursor?.sourceCurve);assert.deepEqual(frontier.sourceCurve,step.field.motion.cursor.sourceCurve);
  assert.deepEqual(frontier.sourceCurve.profile,profile.futureBallPhysics);assert(step.ballSolverEvidence);assert.deepEqual(frontier.ballSolverEvidence,step.ballSolverEvidence);
  assert.deepEqual(frontier.worldBefore,accepted.worldAfter);assert.deepEqual(frontier.worldAfter,accepted.worldAfter);
  assert.equal(frontier.calibrations.length,32);assert.equal(frontier.calibrationReferences.length,32);for(const calibration of frontier.calibrations)assert.deepEqual(calibration.source.viewReference,frontier.finalViewReference);
  const projected=frontier.calibrations.filter(c=>c.source.route==='defender_observation');assert.equal(projected.length,9);
  assert.equal(frontier.projectionProofs.length,9);assert.deepEqual(frontier.originalObservationCalibrations,accepted.calibrations.filter(c=>c.source.route==='defender_observation'));
  for(const calibration of projected){
    const priorIndex=accepted.calibrations.findIndex(c=>c.source.route==='defender_observation'&&c.source.member.playerId===calibration.source.member.playerId);assert(priorIndex>=0);
    const prior=accepted.calibrations[priorIndex],old=prior.source.response.values,newValues=calibration.source.response.values,projection=calibration.source.observationClockProjection,evidence=calibration.observationClockProjection;
    assert.equal(Object.hasOwn(prior.source,'observationClockProjection'),false);assert.equal(Object.hasOwn(prior,'observationClockProjection'),false);
    assert.equal(calibration.source.sourceVersion,'same_pa_observation_clock_projection_v1');assert.equal(old.memoryDecayParameters.ticksPerSecond,1000);assert.equal(newValues.memoryDecayParameters.ticksPerSecond,1000000);
    assert.deepEqual(newValues,{...old,refreshPolicy:{attendedIntervalTicks:old.refreshPolicy.attendedIntervalTicks*1000,peripheralIntervalTicks:old.refreshPolicy.peripheralIntervalTicks*1000},memoryDecayParameters:{...old.memoryDecayParameters,ticksPerSecond:1000000}});
    assert.deepEqual(projection,{kind:'observation_clock_projection_v1',originalNominalReference:prior.source.nominalReference,originalEffectiveCalibrationReference:accepted.calibrationReferences[priorIndex],fieldReference:frontier.fieldStepReference});
    assert.equal(evidence.authority,'UNIT_CONVERSION_NOT_ABILITY_CHANGE');assert.equal(evidence.originalTicksPerSecond,1000);assert.equal(evidence.targetTicksPerSecond,1000000);assert.deepEqual(evidence.fieldReference,frontier.fieldStepReference);
    const calibrationIndex=frontier.calibrations.indexOf(calibration),proofs=frontier.projectionProofs.filter(p=>p.calibrationReference.sourceId===calibration.source.sourceId);assert.equal(proofs.length,1);
    assert.deepEqual(proofs[0].calibrationReference,frontier.calibrationReferences[calibrationIndex]);assert.deepEqual(proofs[0].proof.evidence,evidence);
    assert.deepEqual(proofs[0].proof.nominalInput.originalNominalReference,projection.originalNominalReference);assert.deepEqual(proofs[0].proof.nominalInput.originalEffectiveCalibrationReference,projection.originalEffectiveCalibrationReference);assert.deepEqual(proofs[0].proof.nominalInput.fieldReference,frontier.fieldStepReference);
    assert.equal(proofs[0].proof.nominalInput.projectedNominalCalibration.memoryDecayParameters.ticksPerSecond,1000000);
  }
  for(const calibration of frontier.calibrations.filter(c=>c.source.route!=='defender_observation')){
    assert.equal(Object.hasOwn(calibration.source,'observationClockProjection'),false);assert.equal(Object.hasOwn(calibration,'observationClockProjection'),false);
    const prior=accepted.calibrations.filter(c=>c.source.route===calibration.source.route&&c.source.member.playerId===calibration.source.member.playerId);assert.equal(prior.length,1);assert.deepEqual(calibration.source.response,prior[0].source.response);
  }
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.equal(stages.filter(value=>value.name==='normal-field-step-clock-projection-inapplicable').length,0);
  const checkpointName='normal-cut13-current-cal32-clock-physical-world-checkpoint',matches=stages.filter(value=>value.name===checkpointName);assert.equal(matches.length,1);
  const checkpoint=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+matches[0].index+'-'+checkpointName+'.lossless.json'),'utf8'));
  for(const key of['finalViewReference','finalCurrent','finalPrefixReference','prefix','totals','calibrations','calibrationReferences','eventReferences','resumePins','currentPhysicalOperation','fieldStepReference','fieldStep','fieldStepSource','sourceCurve','ballSolverEvidence','observationClockProjection','projectionProofs'])assert.deepEqual(checkpoint[key],frontier[key]);
  assert.equal(checkpoint.finalLifecycleCurrentProven,true);assert.equal(checkpoint.normalLifecycleAdvances,1);assert.equal(checkpoint.fieldStepAccepted,true);assert.equal(checkpoint.observationClockProjected,true);assert.equal(checkpoint.observationClockProjectionCount,9);assert.deepEqual(checkpoint.world,accepted.worldAfter);
  const stageNames=['retained-current-cut12-and-original-clocks-authenticated','field-step-source-declared-before-acceptance','normal-field-step-accepted-before-cut13','advance-13-start',checkpointName,'normal-field-clock-cut13-and-world-authenticated'];
  const requiredStages=stageNames.map(name=>{const found=stages.filter(value=>value.name===name);assert.equal(found.length,1);return found[0];});
  for(let index=1;index<requiredStages.length;index++)assert(requiredStages[index-1].index<requiredStages[index].index);
  const acceptedStep=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+requiredStages[2].index+'-'+requiredStages[2].name+'.lossless.json'),'utf8'));
  for(const key of['fieldStepReference','fieldStep','fieldStepSource','currentPhysicalOperation','eventReferences'])assert.deepEqual(acceptedStep[key],frontier[key]);
  assert.equal(acceptedStep.normalLifecycleAdvances,0);assert.equal(acceptedStep.observationClockProjected,false);assert.deepEqual(acceptedStep.world,accepted.worldAfter);report.normalCheckpointStages=matches;
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('after-logical-with-rowid.json',after);
  assert.deepEqual(after.catalog,before.catalog,'V212 must not add or change any schema');
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'retained immutable row/rowid changed: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,after.tables[table].rows-before.tables[table].rows]));assert.deepEqual(report.appendedRows,appendCounts);
  assert.equal(Object.values(report.appendedRows).reduce((sum,count)=>sum+count,0),45);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));assert.deepEqual([...report.changedTables].sort(),[...allowed].sort());
  const physicalAfter=rawRows(target,'pa_physical_v1_heads'),worldAfter=rawRows(target,'world_control_heads');
  save('physical-heads-after.lossless.json',persistedRows(physicalAfter));save('world-heads-after.lossless.json',persistedRows(worldAfter));
  assert.deepEqual(physicalAfter.filter(row=>row.enrollment_source_id!==enrollmentSourceId),physicalBefore.filter(row=>row.enrollment_source_id!==enrollmentSourceId));assert.deepEqual(worldAfter,worldBefore);
  const newP=physicalAfter.filter(row=>row.enrollment_source_id===enrollmentSourceId);assert.equal(newP.length,1);
  assert.deepEqual(newP[0],Object.assign(Object.create(null),oldP[0],{operation_ordinal:oldP[0].operation_ordinal+1n,last_owner:frontier.fieldStepReference.owner,last_source_id:frontier.fieldStepReference.sourceId,last_snapshot_hash:frontier.fieldStepReference.snapshotHash}));
  report.onlyExpectedOnePhysicalHeadCasProven=true;report.worldAndAllOtherHeadsUnchanged=true;report.existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged=true;
  report.noExtraFieldAiOrOfficialRowsAccepted=true;target.exec('ROLLBACK');target.close();target=null;
  report.fieldStepAccepted=true;report.observationClockProjected=true;report.observationClockProjectionCount=9;report.normalLifecycleAdvances=1;report.finalLifecycleCurrentProven=true;report.parentCombinedHistoryRowsAndSchemaPreserved=true;report.pass=true;
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
console.log(JSON.stringify({pass:report.pass,parentV211Command:parentReceipt.command,fieldStepAccepted:report.fieldStepAccepted,observationClockProjected:report.observationClockProjected,observationClockProjectionCount:report.observationClockProjectionCount,finalLifecycleCurrentProven:report.finalLifecycleCurrentProven,
  appendedRows:report.appendedRows,onlyExpectedOnePhysicalHeadCasProven:report.onlyExpectedOnePhysicalHeadCasProven,worldAndAllOtherHeadsUnchanged:report.worldAndAllOtherHeadsUnchanged,
  originalDataUnchanged:report.originalDataUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  resumeReady:false,fullContinuationComplete:false,performancePass:false,error:report.error??report.cleanupError??report.pinError??null}));
