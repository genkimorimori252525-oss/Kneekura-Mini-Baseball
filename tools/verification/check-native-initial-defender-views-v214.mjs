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
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V212 and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-field-clock-v212-01'));
const pins={};
const bytesPin=bytes=>({exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
const readPinnedBytes=path=>{const bytes=readFileSync(path);pins[path]=bytesPin(bytes);return bytes;};
const readPinned=path=>parseDebugRecord(readPinnedBytes(path).toString('utf8'));
const parentManifestPath=resolve(retained,'start-manifest.json');
const acceptedReport=readPinned(resolve(retained,'report.json')),accepted=readPinned(resolve(retained,'frontier.lossless.json')),parent=readPinned(parentManifestPath);
const parentReceiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_d82d9c8c60844232af8fe4b1b0445b56.json');
const parentReceipt=readPinned(parentReceiptPath);assert.equal(parentReceipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(parentReceipt.result,'PASS');assert.equal(parentReceipt.exit_code,0);
assert.equal(parentReceipt.command.length,4);assert.deepEqual(parentReceipt.command.slice(0,3),['node','tools/verification/check-native-field-clock-v212.mjs',
  'docs/verification/realism-debug-20261027/native-field-root-v211-01']);
assert.equal(typeof parentReceipt.command[3],'string');assert.equal(resolve(root,parentReceipt.command[3]),retained);
assert.equal(bytesPin(readPinnedBytes(resolve(parentReceipt.output_path))).sha256,parentReceipt.output_sha256);
for(const key of['pass','originalDataUnchanged','onlyExpectedOnePhysicalHeadCasProven','worldAndAllOtherHeadsUnchanged','existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged',
  'noExtraFieldAiOrOfficialRowsAccepted','parentCombinedHistoryProven','parentCombinedHistoryRowsAndSchemaPreserved','parentSourcePinsReconciledWithApprovedPatch','sourceAndBundleEndPinProven','harnessAndInputEndPinsProven'])assert.equal(acceptedReport[key],true);
assert.equal(acceptedReport.failedV208Preserved,true);assert.equal(acceptedReport.originalFailedRunCompleted,false);assert.equal(acceptedReport.originalFailedRunEndPinsClaimed,false);
assert.deepEqual(acceptedReport.frontier,accepted);assert.deepEqual(acceptedReport.startManifestPin,pins[parentManifestPath]);
assert.equal(acceptedReport.nativeTestExit.code,0);assert.equal(acceptedReport.nativeSummary.pass,true);assert.equal(parent.runtime.closureBundleExecuted,false);
assert.equal(accepted.boundary,'NATIVE_FIELD_CLOCK_CHECKPOINT_ONLY');
for(const key of['fieldStepAccepted','finalLifecycleCurrentProven','observationClockProjected','clockProjectionApplicable'])assert.equal(accepted[key],true);
for(const key of['nativePostFieldClockConsumerProven','executedObservationClockProbeProven','defensiveAiAccepted','legalOutcomeProven','resumeReady','fullContinuationComplete','officialTerminalProven','wholeRngConsumptionProven','performancePass'])assert.equal(accepted[key],false);
assert.equal(accepted.executedObservationClockProbeStatus,'UNKNOWN');assert.equal(accepted.observationClockProjectionCount,9);
assert.equal(accepted.nativeResumeAdapterRequired,true);assert.equal(accepted.normalLifecycleAdvances,1);assert.equal(accepted.finalViewReference.sourceId,'physical-fixture:cut13:view');
assert.equal(accepted.eventReferences.length,13);assert.equal(Object.keys(accepted.resumePins).length,16);assert.equal(accepted.calibrations.length,32);assert.equal(accepted.calibrationReferences.length,32);
assert.deepEqual(accepted.finalCurrent,accepted.finalHistorical);assert.equal(accepted.finalCurrent.view.cut.stage,'field_active');
assert.deepEqual(accepted.currentPhysicalOperation.reference,accepted.resumePins.fieldStepReference);assert.deepEqual(accepted.currentPhysicalOperation.record,accepted.fieldStep);
assert.deepEqual(accepted.finalCurrent.view.cut.operationReference,accepted.resumePins.fieldStepReference);assert.deepEqual(accepted.finalCurrent.view.cut.physicalOperationReference,accepted.resumePins.fieldStepReference);
assert.deepEqual(accepted.fieldStepReference,accepted.resumePins.fieldStepReference);assert.equal(accepted.fieldStep.kind,'same_pa_physical_field_step_v1');assert.equal(accepted.fieldStep.operationOrdinal,7);
assert.equal(accepted.fieldStep.source.sourceVersion,'same_pa_field_step_aero_ground_escape_v3');assert.equal(accepted.fieldStep.field.motion.carrierPlayerId,null);assert(accepted.fieldStep.field.motion.cursor?.sourceCurve);
assert.equal(accepted.worldAfter.head.worldRevision,2);assert.deepEqual(accepted.worldBefore,accepted.worldAfter);assert.deepEqual(accepted.historicalInput,accepted.originalInputs.historicalInput);
for(const calibration of accepted.calibrations)assert.deepEqual(calibration.source.viewReference,accepted.finalViewReference);
assert.deepEqual(acceptedReport.appendedRows,{pa_physical_v1_field_steps:1,pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,
  pa_lifecycle_v1_execution_views:1,pa_lifecycle_v1_execution_calibrations:32});
const modelDeclaration={sourceId:'native-initial-defender-views-v214:nominal-initial-view-model',sourceVersion:'same_pa_initial_defender_observation_view_v214',
  evidenceAuthority:'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW',empiricallyCalibrated:false,scope:'INITIAL_VIEW_ONLY',params:{eyeHeightRatio:.92,
    eyeHorizontalOffsetMeters:{x:0,z:0},crouchMeters:0,forwardPolicy:'PRE_PITCH_HOME_PLATE_CORE_ATAN2_SIN_COS',attentionPolicy:'KNOWN_BALL_INTENT'}};
const input={...Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]])),modelDeclaration};
const preparation=input.retainedInputReferences,profile=preparation.futureProfileDeclarationOnly;
assert.equal(profile.futureFieldRootSourceVersion,'same_pa_field_root_aero_ground_escape_v3');assert.equal(profile.futureBallPhysics.kind,'aero_ground_v1');
assert.equal(profile.futureFieldRootAccepted,false);assert.equal(profile.outcomeBasedProfileAdjustment,false);
const enrollmentSourceId=accepted.originalInputs.action.lineage.enrollmentReference.sourceId,careerId=accepted.worldAfter.head.careerId;
assert.equal(careerId,accepted.finalCurrent.actor.binding.careerId);assert.equal(enrollmentSourceId,'native-enrollment');
const original=resolve(acceptedReport.copyPath),destination=resolve(out,'initial-defender-views-private.sqlite');
assert.equal(original,resolve(retained,'field-clock-private.sqlite'));

// Reconcile V213 only if this older parent closure really contains that Core
// Source. No unrelated Source receives an exception.
const approved=new Map(),liveFieldPath='src/core/sim/fielding/LiveFieldPlayV1.ts';
const parentLiveFieldPin=parent.bundle.sourcePins[liveFieldPath]??parent.digestBundle.sourcePins[liveFieldPath];
if(parentLiveFieldPin){
  const proofPath=resolve('work/live-pole-contact-witness-v213-baseline/source-equivalence-proof.json'),proof=readPinned(proofPath);
  const verified=readPinned(resolve('work/live-pole-contact-witness-v213-baseline/source-equivalence-verification.json'));
  assert.equal(proof.pass,true);assert.equal(verified.pass,true);assert.equal(proof.sourcePath,liveFieldPath);assert.equal(proof.reverseWholeSourceBytesExact,true);
  assert.equal(verified.literalReverseWholeSourceBytesExact,true);assert.equal(verified.sourceCodeExecuted,false);assert.equal(verified.nativeOperations,0);assert.equal(verified.databaseOpens,0);
  assert.deepEqual(verified.proofPin,pins[proofPath]);assert.equal(proof.transformations.length,9);
  const baseline=readPinnedBytes(resolve(proof.baselinePath)),current=readPinnedBytes(resolve(liveFieldPath));
  assert.deepEqual(bytesPin(baseline),{exists:true,bytes:parentLiveFieldPin.bytes,sha256:parentLiveFieldPin.sha256});assert.deepEqual(bytesPin(baseline),proof.baselinePin);
  assert.equal(proof.baselinePin.sha256,'b0588cae08b6f44f240f13511b5fe24258577f06922c0152d070cdc0fdb3e006');
  assert.deepEqual(bytesPin(current),proof.currentPin);assert.deepEqual(bytesPin(current),verified.sourcePins[liveFieldPath]);
  assert.equal(proof.currentPin.sha256,'536a418b06fe3e0d9863b78ef2f9673289667c24c493a2be8c6cdba2b8e5eb9d');
  let reconstructed=current.toString('utf8');for(const change of proof.transformations){assert.equal(reconstructed.split(change.replacementBlock).length,2);reconstructed=reconstructed.replace(change.replacementBlock,change.originalBlock);}
  assert(Buffer.from(reconstructed,'utf8').equals(baseline));approved.set(liveFieldPath,{baselinePath:proof.baselinePath,oldPin:parentLiveFieldPin,currentPin:proof.currentPin,proofPin:pins[proofPath]});
}
const v213HelperPath='src/core/sim/fielding/LivePoleContactWitnessV213.ts',v213HelperBytes=readPinnedBytes(resolve(v213HelperPath));
assert.equal(bytesPin(v213HelperBytes).sha256,'3fc15159a6d9c9c71aa45d579c757808c382e7e82aed350bc4c76985bf758359');
const parentPinPath=(path,pin)=>{const patch=approved.get(relative(root,resolve(root,path)).replaceAll('\\','/'));if(!patch)return resolve(root,path);
  assert.equal(pin.bytes,patch.oldPin.bytes);assert.equal(pin.sha256,patch.oldPin.sha256);return resolve(patch.baselinePath);};
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
assert(!retainedDatabases.has(original));retainedDatabases.set(original,acceptedReport.copyAfter);assert.equal(retainedDatabases.size,11);
const appendCounts={pa_physical_v1_field_steps:9,pa_lifecycle_v1_work_prefixes:9,pa_lifecycle_v1_total_assessments:90,
  pa_lifecycle_v1_execution_views:9,pa_lifecycle_v1_execution_calibrations:9};
const appendTables=Object.keys(appendCounts),mutableTables=['pa_physical_v1_heads'],allowed=new Set([...appendTables,...mutableTables]);
assert.equal(Object.values(appendCounts).reduce((sum,n)=>sum+n,0),126);
const rawRows=(db,table)=>{const q=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');q.setReadBigInts(true);return q.all();};
const persistedRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const report={pass:false,boundary:'NATIVE_INITIAL_DEFENDER_VIEWS_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,parentV212Receipt:parentReceiptPath,parentV212Command:parentReceipt.command,parentV212Accepted:true,parentSourceChanges:approved.size,
  failedV208Preserved:true,originalFailedRunCompleted:false,originalFailedRunEndPinsClaimed:false,parentCombinedHistoryProven:true,
  normalLifecycleAdvances:0,finalLifecycleCurrentProven:false,initialDefenderObservationsAccepted:false,initialDefenderObservationCount:0,firstObservationHistoryProven:false,
  scopedDefenderCalibrationCount:0,otherRoutesFullReady:false,allRoutesReady:false,rawGazeRestored:false,continuingGazeProven:false,empiricallyCalibrated:false,defensiveAiAccepted:false,legalOutcomeProven:false,
  nativePostInitialDefenderObservationConsumerProven:false,nativeResumeAdapterRequired:true,resumeReady:false,fullContinuationComplete:false,
  officialTerminalProven:false,wholeRngConsumptionProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.retainedDataBefore={};for(const[path,pin]of retainedDatabases){const actual=await databaseFiles(path);assert.deepEqual(dataPin(actual),dataPin(pin),'retained data changed: '+path);report.retainedDataBefore[path]=actual;}
  report.originalBefore=report.retainedDataBefore[original];report.harnessPins={...pins};
  for(const path of['tools/verification/check-native-initial-defender-views-v214.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  await pinParent();digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  assert.equal(digestBundle.inputCount,1);assert.deepEqual(Object.keys(digestBundle.sourcePins),['tools/verification/NativeSpinNeutralV193-sql.ts']);
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-initial-defender-views-v214.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  const modelArtifactPath=resolve(out,'nominal-initial-view-model.lossless.json'),modelArtifactBytes=Buffer.from(stringifyDebugRecord(modelDeclaration)+'\n');
  writeFileSync(modelArtifactPath,modelArtifactBytes,{flag:'wx'});pins[modelArtifactPath]=bytesPin(modelArtifactBytes);input.modelDeclaration=parseDebugRecord(modelArtifactBytes.toString('utf8'));
  report.modelArtifact={path:modelArtifactPath,pin:pins[modelArtifactPath],declaration:input.modelDeclaration};report.harnessPins[modelArtifactPath]=pins[modelArtifactPath];
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  for(const[path,pin]of Object.entries(report.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,retainedDataBefore:report.retainedDataBefore,input,enrollmentSourceId,careerId,
    parentV212Receipt:parentReceiptPath,parentV212Command:parentReceipt.command,parentSourceChanges:approved.size,approvedV213Patches:Object.fromEntries(approved),
    supplementalV213HelperPin:pins[resolve(v213HelperPath)],v213HelperInClosure:Object.hasOwn(bundle.sourcePins,v213HelperPath),modelArtifact:report.modelArtifact,
    parentCombinedHistoryProven:true,failedV208Preserved:true,originalFailedRunEndPinsClaimed:false,
    appendCounts,mutableTables,stopBoundary:'NINE_NORMAL_INITIAL_DEFENDER_OBSERVATIONS_AND_SCOPED_CALIBRATIONS_THROUGH_CUT22',
    constraints:['ONE_REAL_VITEST_NI214_S01_ON_NEW_OWNED_SQLITE_BACKUP','EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW_MODEL_ONLY','NO_BATTING_OR_OLD_CALIBRATION_OR_BODY_REACCEPT',
      'NINE_NORMAL_LIFECYCLE_ADVANCES_WITH_SCOPED_CAL1_NOT_FULL_ROUTE_READY','NINE_PHYSICAL_HEAD_CAS_WORLD_AND_OTHER_HEADS_UNCHANGED','NO_OBSERVATION_TABLE_OR_HEAD_OR_SCHEMA_ADDITION',
      'NO_RAW_GAZE_RESTORATION_OR_HAND_AUTHORED_OBSERVATION_RESULTS_OR_AI_OR_OFFICIAL','OLD_FAILURE_AND_ALL_ANCESTOR_DATA_PRESERVED',
      'NO_FIXTURE_BUNDLE_EXECUTION','NO_PERFORMANCE_OR_WHOLE_RNG_COMPLETION_CLAIM']});
  report.startManifestPin=await fileState(resolve(out,'start-manifest.json'));
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);
  const through=Object.create(null);for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  const physicalBefore=rawRows(source,'pa_physical_v1_heads'),worldBefore=rawRows(source,'world_control_heads');
  const oldP=physicalBefore.filter(row=>row.enrollment_source_id===enrollmentSourceId),oldW=worldBefore.filter(row=>row.career_id===careerId);
  assert.equal(oldP.length,1);assert.equal(oldW.length,1);assert.equal(oldP[0].operation_ordinal,7n);assert.equal(oldW[0].world_revision,2n);
  assert.equal(oldP[0].last_owner,accepted.fieldStepReference.owner);assert.equal(oldP[0].last_source_id,accepted.fieldStepReference.sourceId);assert.equal(oldP[0].last_snapshot_hash,accepted.fieldStepReference.snapshotHash);
  save('physical-heads-before.lossless.json',persistedRows(physicalBefore));save('world-heads-before.lossless.json',persistedRows(worldBefore));
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-initial-defender-views-v214.test.ts','--testNamePattern','NI214-S01','--maxWorkers=1','--minWorkers=1'],
    {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_V214_DATABASE:destination,BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_V214_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_INITIAL_DEFENDER_VIEWS_V214_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'Native initial defender views failed; retain normal owner records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert.equal(report.nativeSummary.pass,true);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert.equal(frontier.initialDefenderObservationsAccepted,true);assert.equal(frontier.initialDefenderObservationCount,9);assert.equal(frontier.firstObservationHistoryProven,true);assert.equal(frontier.finalLifecycleCurrentProven,true);
  assert.equal(frontier.scopedDefenderCalibrationCount,9);assert.equal(frontier.normalLifecycleAdvances,9);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut22:view');
  for(const key of['otherRoutesFullReady','allRoutesReady','rawGazeRestored','continuingGazeProven','empiricallyCalibrated','defensiveAiAccepted','legalOutcomeProven','nativePostInitialDefenderObservationConsumerProven','resumeReady','fullContinuationComplete','officialTerminalProven','wholeRngConsumptionProven','performancePass'])assert.equal(frontier[key],false);
  assert.equal(frontier.nativeResumeAdapterRequired,true);assert.deepEqual(frontier.retainedInputReferences,input.retainedInputReferences);assert.deepEqual(frontier.modelDeclaration,input.modelDeclaration);
  assert.deepEqual(frontier.normalOriginal,frontier.originalInputs);assert.deepEqual(frontier.originalInputs.current,accepted.finalCurrent);assert.deepEqual(frontier.originalInputs.fieldStep,accepted.fieldStep);assert.deepEqual(frontier.originalInputs.fieldRoot,accepted.fieldRoot);
  assert.deepEqual(frontier.originalInputs.calibrations,accepted.calibrations);assert.deepEqual(frontier.originalInputs.unprojectedCalibrations,accepted.originalInputs.calibrations);
  for(const key of['actor','bodyModel','fieldCalibration','batterBody','posture','intent','action','launch','resolution','commitment','historicalInput','score','emotion','acceptedAction','originalAction','qualifications'])assert.deepEqual(frontier.originalInputs[key],accepted.originalInputs[key]);
  assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.matchSeed,19);assert.equal(frontier.originalInputs.action.source.nominalPitch.delivery.matchSeed,19);assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.outingId,'outing-1');assert.equal(frontier.originalInputs.action.lineage.playId,7);assert.equal(frontier.originalInputs.launch.pitchOrdinal,3);
  const defenderIds=new Set(accepted.originalInputs.actor.defenderBindings.map(binding=>binding.playerId));
  const playerIds=accepted.originalInputs.bodyModel.actors.filter(actor=>defenderIds.has(actor.playerId)).map(actor=>actor.playerId);assert.equal(playerIds.length,9);assert.equal(new Set(playerIds).size,9);
  assert.equal(frontier.observations.length,9);assert.deepEqual(frontier.observations.map(value=>value.playerId),playerIds);
  assert.equal(frontier.views.length,9);assert.deepEqual(frontier.views.map(value=>value.playerId),playerIds);
  const defenderInputs=accepted.originalInputs.bodyModel.actors.filter(actor=>defenderIds.has(actor.playerId)).map(body=>({playerId:body.playerId,heightMeters:body.heightMeters,
    bodyOriginHeightMeters:body.bodyOriginHeightMeters,bodyPrimitiveOffset:body.primitives.find(primitive=>primitive.role==='body').offset,
    prePitchPosition:accepted.originalInputs.actor.world.defenders.find(defender=>defender.playerId===body.playerId).position}));
  const homePlate=accepted.fieldRoot.geometry.bases.home.region.center;assert.deepEqual(frontier.originalInputs.defenders,defenderInputs);assert.deepEqual(frontier.originalInputs.homePlate,homePlate);
  const provenancePath=resolve(out,'nominal-initial-view-provenance.lossless.json');
  save('nominal-initial-view-provenance.lossless.json',{modelDeclaration:input.modelDeclaration,actorReference:preparation.retainedInputReferences.actorReference,
    bodyModelReference:preparation.bodyModelReference,fieldCalibrationReference:preparation.calibrationReference,fieldRootReference:input.resumePins.fieldRootReference,
    defenders:defenderInputs,homePlate,views:frontier.views,scope:'INITIAL_VIEW_ONLY',rawGazeRestored:false,empiricallyCalibrated:false});
  report.resultArtifactPins={[provenancePath]:await fileState(provenancePath)};
  const newPinNames=playerIds.map((_,index)=>'defenderObservationReference'+(index+1));
  assert.deepEqual(Object.keys(frontier.resumePins).sort(),[...Object.keys(input.resumePins),...newPinNames].sort());
  for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  const observationRefs=frontier.observations.map(value=>value.observationReference);
  for(let index=0;index<9;index++)assert.deepEqual(frontier.resumePins[newPinNames[index]],observationRefs[index]);
  assert.deepEqual(frontier.eventReferences,[...input.eventReferences,...observationRefs]);assert.equal(frontier.eventReferences.length,22);
  assert.deepEqual(frontier.finalPrefixReference,frontier.finalCurrent.view.source.prefixReference);assert.deepEqual(frontier.prefix.source.eventReferences,frontier.eventReferences);assert.equal(frontier.totals.length,10);
  assert.deepEqual(frontier.finalCurrent,frontier.finalHistorical);assert.equal(frontier.finalCurrent.view.cut.stage,'field_active');
  assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,observationRefs[8]);assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,observationRefs[8]);
  assert.deepEqual(frontier.currentPhysicalOperation.reference,observationRefs[8]);assert.deepEqual(frontier.currentPhysicalOperation.record,frontier.observations[8].observation);
  assert.deepEqual(frontier.worldBefore,accepted.worldAfter);assert.deepEqual(frontier.worldAfter,accepted.worldAfter);
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  const stage=(name)=>{const matches=stages.filter(value=>value.name===name);assert.equal(matches.length,1);return matches[0];};
  const authStage=stage('retained-current-cut13-and-initial-history-authenticated'),modelStage=stage('nominal-initial-defender-views-declared');assert(authStage.index<modelStage.index);
  report.normalCheckpointStages=[];let precedingPhysicalReference=accepted.fieldStepReference,precedingLifecycleViewReference=input.finalViewReference,precedingCheckpoint=null,lastStage=modelStage;
  const fieldMoment=accepted.fieldStep.field.motion.world.moment,expectedObservationAt={originTick:fieldMoment.originTick,elapsedSeconds:fieldMoment.elapsedSeconds,tick:fieldMoment.ball.tick};
  for(let index=0;index<9;index++){
    const item=frontier.observations[index],record=item.observation,source=item.observationSource,result=item.actionResult,playerId=playerIds[index],cut=14+index;
    assert.equal(record.kind,'same_pa_physical_field_step_v1');assert.equal(record.operationOrdinal,8+index);assert.equal(record.stage,'field');assert.equal(record.evaluationTick,accepted.fieldStep.evaluationTick);
    assert.deepEqual(record.source,source);assert.equal(source.capability,'same_pa_physical_field_step_v1');assert.equal(source.sourceVersion,profile.futureFieldStepSourceVersion);
    assert.deepEqual(source.viewReference,precedingLifecycleViewReference);assert.deepEqual(item.precedingLifecycleViewReference,precedingLifecycleViewReference);
    assert.deepEqual(source.previousOperationReference,precedingPhysicalReference);assert.deepEqual(source.previousFieldReference,precedingPhysicalReference);assert.deepEqual(source.fieldRootReference,input.resumePins.fieldRootReference);
    assert.equal(source.throughTick,accepted.fieldStep.evaluationTick);assert.equal(source.action.kind,'defender_observation_v1');assert.equal(source.action.member.playerId,playerId);assert.equal(source.action.previousObservationReference,null);
    assert.deepEqual(source.action.calibrationReference,item.inputCalibrationReference);assert.deepEqual(source.action.view,frontier.views[index].view);
    assert.deepEqual(Object.keys(source.action.view).sort(),['poseVersion','bodyRelativeEyeOffset','forward','attentionTarget'].sort());
    assert.equal(source.action.view.poseVersion,modelDeclaration.sourceId+':'+modelDeclaration.sourceVersion);assert.deepEqual(source.action.view.attentionTarget,{kind:'ball'});
    const body=defenderInputs[index],yaw=Math.atan2(homePlate.x-body.prePitchPosition.x,homePlate.z-body.prePitchPosition.z),clean=value=>Object.is(value,-0)?0:value;
    assert.deepEqual(source.action.view.forward,{x:Math.sin(yaw),y:0,z:Math.cos(yaw)});
    assert.deepEqual(source.action.view.bodyRelativeEyeOffset,{x:clean(-body.bodyPrimitiveOffset.x),y:clean(.92*body.heightMeters-body.bodyOriginHeightMeters-body.bodyPrimitiveOffset.y),z:clean(-body.bodyPrimitiveOffset.z)});
    const inputCalibrations=index===0?accepted.calibrations:precedingCheckpoint.calibrations,inputReferences=index===0?accepted.calibrationReferences:precedingCheckpoint.calibrationReferences;
    const inputIndex=inputCalibrations.findIndex(calibration=>calibration.source.route==='defender_observation'&&calibration.source.member.playerId===playerId);assert(inputIndex>=0);
    assert.deepEqual(item.inputCalibrationReference,inputReferences[inputIndex]);assert.deepEqual(source.action.member,inputCalibrations[inputIndex].source.member);
    assert.deepEqual(record.actionResult,result);assert.equal(result.kind,'defender_observation_v1');assert.equal(result.playerId,playerId);assert.deepEqual(result.receipt,item.receipt);
    assert.equal(result.samplingRequest.previousObservationSourceId,null);assert.equal(result.samplingRequest.sourceId,source.sourceId);assert.equal(result.samplingRequest.playerId,playerId);
    assert.equal(result.samplingRequest.executionSourceId,precedingPhysicalReference.sourceId);assert.equal(result.samplingRequest.baseFieldSourceId,input.resumePins.fieldRootReference.sourceId);
    assert.equal(result.samplingRequest.physicalPitchSourceId,input.resumePins.launchReference.sourceId);assert.deepEqual(result.samplingRequest.view,source.action.view);
    assert.deepEqual(item.receipt.at,expectedObservationAt);assert.deepEqual(item.receipt.focusStartedAt,expectedObservationAt);assert.equal(item.receipt.temporalPolicy,'instantaneous_capture_tick_refresh_and_memory');
    assert.equal(item.receipt.viewGeometry.eyeAnchor,'body_primitive_center');assert.equal(item.receipt.viewGeometry.offsetAxes,'world');assert.deepEqual(item.receipt.viewGeometry.bodyRelativeEyeOffset,source.action.view.bodyRelativeEyeOffset);
    assert.deepEqual(record.field,accepted.fieldStep.field);assert.deepEqual(record.timeline,accepted.fieldStep.timeline);assert.deepEqual(record.ballSolverEvidence,accepted.fieldStep.ballSolverEvidence);
    const acceptedStage=stage('normal-defender-observation-'+(index+1)+'-accepted-before-lifecycle'),checkpointName='normal-cut'+cut+'-current-scoped-calibration-physical-world-checkpoint',checkpointStage=stage(checkpointName);
    assert(lastStage.index<acceptedStage.index&&acceptedStage.index<checkpointStage.index);
    const checkpoint=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+checkpointStage.index+'-'+checkpointName+'.lossless.json'),'utf8'));
    assert.equal(checkpoint.finalLifecycleCurrentProven,true);assert.equal(checkpoint.normalLifecycleAdvances,index+1);assert.equal(checkpoint.finalViewReference.sourceId,'physical-fixture:cut'+cut+':view');
    assert.deepEqual(checkpoint.finalCurrent,checkpoint.finalHistorical);assert.equal(checkpoint.finalCurrent.view.cut.stage,'field_active');assert.deepEqual(checkpoint.currentPhysicalOperation.reference,item.observationReference);assert.deepEqual(checkpoint.currentPhysicalOperation.record,record);
    assert.deepEqual(checkpoint.finalCurrent.view.cut.operationReference,item.observationReference);assert.deepEqual(checkpoint.finalCurrent.view.cut.physicalOperationReference,item.observationReference);
    assert.deepEqual(checkpoint.prefix.source.eventReferences,[...input.eventReferences,...observationRefs.slice(0,index+1)]);assert.deepEqual(checkpoint.eventReferences,checkpoint.prefix.source.eventReferences);assert.equal(checkpoint.totals.length,10);
    assert.deepEqual(checkpoint.observations,frontier.observations.slice(0,index+1));assert.equal(checkpoint.otherRoutesFullReady,false);assert.equal(checkpoint.allRoutesReady,false);assert.deepEqual(checkpoint.world,accepted.worldAfter);
    assert.equal(checkpoint.calibrations.length,1);assert.equal(checkpoint.calibrationReferences.length,1);assert.deepEqual(checkpoint.scopedCalibration,checkpoint.calibrations[0]);
    const scoped=checkpoint.scopedCalibration,nextPlayerId=playerIds[(index+1)%9],old=accepted.calibrations.find(calibration=>calibration.source.route==='defender_observation'&&calibration.source.member.playerId===nextPlayerId);
    assert(old);assert.equal(scoped.source.route,'defender_observation');assert.equal(scoped.source.member.playerId,nextPlayerId);assert.equal(scoped.source.sourceVersion,'same_pa_observation_clock_projection_v1');
    assert.deepEqual(scoped.source.viewReference,checkpoint.finalViewReference);assert.deepEqual(scoped.source.response,old.source.response);
    assert.deepEqual(scoped.source.observationClockProjection,{...old.source.observationClockProjection,fieldReference:item.observationReference});
    assert.equal(scoped.observationClockProjection.originalTicksPerSecond,1000);assert.equal(scoped.observationClockProjection.targetTicksPerSecond,1000000);assert.deepEqual(scoped.observationClockProjection.fieldReference,item.observationReference);
    assert.deepEqual(checkpoint.projectionProof.evidence,scoped.observationClockProjection);assert.deepEqual(checkpoint.projectionProof.nominalInput.fieldReference,item.observationReference);
    assert.deepEqual(item.finalViewReference,checkpoint.finalViewReference);assert.deepEqual(item.scopedCalibrationReference,checkpoint.calibrationReferences[0]);
    if(index===8){for(const key of['finalViewReference','finalCurrent','finalHistorical','finalPrefixReference','prefix','totals','calibrations','calibrationReferences','scopedCalibration','eventReferences','resumePins','currentPhysicalOperation'])assert.deepEqual(checkpoint[key],frontier[key]);}
    report.normalCheckpointStages.push(checkpointStage);precedingPhysicalReference=item.observationReference;precedingLifecycleViewReference=checkpoint.finalViewReference;precedingCheckpoint=checkpoint;lastStage=checkpointStage;
  }
  const finalStage=stage('normal-initial-defender-views-cut22-authenticated');assert(lastStage.index<finalStage.index);
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('after-logical-with-rowid.json',after);
  assert.deepEqual(after.catalog,before.catalog,'V214 must not add or change any schema');
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'retained immutable row/rowid changed: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,after.tables[table].rows-before.tables[table].rows]));assert.deepEqual(report.appendedRows,appendCounts);
  assert.equal(Object.values(report.appendedRows).reduce((sum,count)=>sum+count,0),126);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));assert.deepEqual([...report.changedTables].sort(),[...allowed].sort());
  const physicalAfter=rawRows(target,'pa_physical_v1_heads'),worldAfter=rawRows(target,'world_control_heads');
  save('physical-heads-after.lossless.json',persistedRows(physicalAfter));save('world-heads-after.lossless.json',persistedRows(worldAfter));
  assert.deepEqual(physicalAfter.filter(row=>row.enrollment_source_id!==enrollmentSourceId),physicalBefore.filter(row=>row.enrollment_source_id!==enrollmentSourceId));assert.deepEqual(worldAfter,worldBefore);
  const newP=physicalAfter.filter(row=>row.enrollment_source_id===enrollmentSourceId);assert.equal(newP.length,1);
  assert.deepEqual(newP[0],Object.assign(Object.create(null),oldP[0],{operation_ordinal:oldP[0].operation_ordinal+9n,last_owner:observationRefs[8].owner,last_source_id:observationRefs[8].sourceId,last_snapshot_hash:observationRefs[8].snapshotHash}));
  report.onlyExpectedNinePhysicalHeadCasProven=true;report.worldAndAllOtherHeadsUnchanged=true;report.existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged=true;
  report.noObservationTableOrHeadOrExtraAiOrOfficialRowsAccepted=true;target.exec('ROLLBACK');target.close();target=null;
  report.initialDefenderObservationsAccepted=true;report.initialDefenderObservationCount=9;report.firstObservationHistoryProven=true;report.scopedDefenderCalibrationCount=9;report.normalLifecycleAdvances=9;report.finalLifecycleCurrentProven=true;report.parentCombinedHistoryRowsAndSchemaPreserved=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.retainedDataAfter={};for(const[path,before]of Object.entries(report.retainedDataBefore??{})){const after=await databaseFiles(path);assert.deepEqual(dataPin(after),dataPin(before),'retained data changed: '+path);report.retainedDataAfter[path]=after;}
    assert.equal(Object.keys(report.retainedDataAfter).length,retainedDatabases.size);report.originalAfter=report.retainedDataAfter[original];report.copyAfter=await databaseFiles(destination);report.originalDataUnchanged=true;
    await pinParent();report.parentSourcePinsUnchangedOrApprovedV213=true;report.bundles=[];
    for(const p of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(p.bundlePath),{exists:true,bytes:p.bytes,sha256:p.sha256});const sourcePins={};
      for(const[path,pin]of Object.entries(p.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});sourcePins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:p===digestBundle,inputCount:p.inputCount,sha256:p.sha256,sourcePins});
    }
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;assert.deepEqual(await fileState(resolve(out,'start-manifest.json')),report.startManifestPin);
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
    for(const[path,pin]of Object.entries(report.resultArtifactPins??{}))assert.deepEqual(await fileState(path),pin);report.resultArtifactEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,parentV212Command:parentReceipt.command,initialDefenderObservationsAccepted:report.initialDefenderObservationsAccepted,initialDefenderObservationCount:report.initialDefenderObservationCount,finalLifecycleCurrentProven:report.finalLifecycleCurrentProven,
  appendedRows:report.appendedRows,onlyExpectedNinePhysicalHeadCasProven:report.onlyExpectedNinePhysicalHeadCasProven,worldAndAllOtherHeadsUnchanged:report.worldAndAllOtherHeadsUnchanged,
  originalDataUnchanged:report.originalDataUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  resumeReady:false,fullContinuationComplete:false,performancePass:false,error:report.error??report.cleanupError??report.pinError??null}));
