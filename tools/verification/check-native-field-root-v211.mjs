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
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V210 and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-post-input-resolution-v210-01'));
const pins={};
const bytesPin=bytes=>({exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
const readPinnedBytes=path=>{const bytes=readFileSync(path);pins[path]=bytesPin(bytes);return bytes;};
const readPinned=path=>parseDebugRecord(readPinnedBytes(path).toString('utf8'));
const parentManifestPath=resolve(retained,'start-manifest.json');
const acceptedReport=readPinned(resolve(retained,'report.json')),accepted=readPinned(resolve(retained,'frontier.lossless.json')),parent=readPinned(parentManifestPath);
const parentReceiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_5512921515fa408d956bcd16e0ba463c.json');
const parentReceipt=readPinned(parentReceiptPath);assert.equal(parentReceipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(parentReceipt.result,'PASS');assert.equal(parentReceipt.exit_code,0);
assert.deepEqual(parentReceipt.command,['node','tools/verification/check-native-post-input-resolution-v210.mjs',
  'docs/verification/realism-debug-20261027/native-execution-input-recovery-v209-01',relative(root,retained).replaceAll('\\','/')]);
assert.equal(bytesPin(readPinnedBytes(resolve(parentReceipt.output_path))).sha256,parentReceipt.output_sha256);
for(const key of['pass','originalDataUnchanged','onlyExpectedTwoPhysicalAndOneWorldHeadCasProven','existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged',
  'launchCompanionsAndBattingInvocationRowsUnchanged','parentCombinedHistoryProven','parentCombinedHistoryRowsAndSchemaPreserved','sourceAndBundleEndPinProven','harnessAndInputEndPinsProven'])assert.equal(acceptedReport[key],true);
assert.equal(acceptedReport.failedV208Preserved,true);assert.equal(acceptedReport.originalFailedRunCompleted,false);assert.equal(acceptedReport.originalFailedRunEndPinsClaimed,false);
assert.deepEqual(acceptedReport.frontier,accepted);assert.deepEqual(acceptedReport.startManifestPin,pins[parentManifestPath]);
assert.equal(acceptedReport.nativeTestExit.code,0);assert.equal(acceptedReport.nativeSummary.pass,true);assert.equal(parent.runtime.closureBundleExecuted,false);
assert.equal(accepted.boundary,'NATIVE_POST_INPUT_RESOLUTION_CHECKPOINT_ONLY');
for(const key of['nativeBattingSuffixResolved','lifecycleResolvedProven','commitmentAccepted','resolutionAccepted','finalLifecycleCurrentProven','postInputEntryAuthenticated'])assert.equal(accepted[key],true);
for(const key of['nativePostResolvedConsumerProven','resumeReady','fullContinuationComplete','fieldRootAccepted','officialTerminalProven','wholeRngConsumptionProven','performancePass'])assert.equal(accepted[key],false);
assert.equal(accepted.nativeResumeAdapterRequired,true);assert.equal(accepted.normalLifecycleAdvances,2);assert.equal(accepted.finalViewReference.sourceId,'physical-fixture:cut11:view');
assert.equal(accepted.eventReferences.length,11);assert.equal(Object.keys(accepted.resumePins).length,14);assert.equal(accepted.calibrations.length,32);assert.equal(accepted.calibrationReferences.length,32);
assert.deepEqual(accepted.finalCurrent,accepted.finalHistorical);assert.equal(accepted.finalCurrent.view.cut.stage,'resolved');
assert.deepEqual(accepted.currentPhysicalOperation.reference,accepted.resumePins.resolutionReference);assert.deepEqual(accepted.currentPhysicalOperation.record,accepted.resolution);
assert.deepEqual(accepted.finalCurrent.view.cut.operationReference,accepted.resumePins.resolutionReference);assert.deepEqual(accepted.finalCurrent.view.cut.physicalOperationReference,accepted.resumePins.resolutionReference);
assert.deepEqual(accepted.resolutionReference,accepted.resumePins.resolutionReference);assert.equal(accepted.resolution.kind,'same_pa_physical_resolution_v1');assert.equal(accepted.resolution.operationOrdinal,5);
assert(accepted.resolution.contact);assert.deepEqual(accepted.actualContact,accepted.resolution.contact);assert.deepEqual(accepted.canonicalTimeline,accepted.resolution.timeline);
assert.equal(accepted.resolution.timeline.status.kind,'batted_ball_pending');assert.equal(accepted.worldAfter.head.worldRevision,2);
assert.deepEqual(accepted.historicalInput,accepted.originalInputs.executionInput);
for(const calibration of accepted.calibrations)assert.deepEqual(calibration.source.viewReference,accepted.finalViewReference);
assert.deepEqual(acceptedReport.appendedRows,{pa_lifecycle_v1_work_prefixes:2,pa_lifecycle_v1_total_assessments:20,pa_lifecycle_v1_execution_views:2,
  pa_lifecycle_v1_execution_calibrations:64,pa_physical_v1_commitments:1,pa_physical_v1_resolutions:1,world_decision_revision_events:1});
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]]));
const preparation=input.retainedInputReferences,profile=preparation.futureProfileDeclarationOnly;
assert.equal(profile.futureFieldRootSourceVersion,'same_pa_field_root_aero_ground_escape_v3');assert.equal(profile.futureBallPhysics.kind,'aero_ground_v1');
assert.equal(profile.futureFieldRootAccepted,false);assert.equal(profile.outcomeBasedProfileAdjustment,false);
const enrollmentSourceId=accepted.originalInputs.action.lineage.enrollmentReference.sourceId,careerId=accepted.worldAfter.head.careerId;
assert.equal(careerId,accepted.finalCurrent.actor.binding.careerId);assert.equal(enrollmentSourceId,'native-enrollment');
const original=resolve(acceptedReport.copyPath),destination=resolve(out,'field-root-private.sqlite');
assert.equal(original,resolve(retained,'post-input-resolution-private.sqlite'));

// V211 changes no existing Source. Parent closure, end pins, harness and new
// same-buffer input pins are compared independently, without merging maps.
const pinParent=async()=>{
  assert.equal(acceptedReport.bundles.length,2);
  for(const p of[parent.bundle,parent.digestBundle]){
    assert.deepEqual(await fileState(p.bundlePath),{exists:true,bytes:p.bytes,sha256:p.sha256});
    const ended=acceptedReport.bundles.filter(value=>value.sha256===p.sha256);assert.equal(ended.length,1);assert.equal(ended[0].inputCount,p.inputCount);
    assert.equal(ended[0].executed,p===parent.digestBundle);assert.deepEqual(Object.keys(ended[0].sourcePins).sort(),Object.keys(p.sourcePins).sort());
    for(const[path,pin]of Object.entries(p.sourcePins)){
      assert.deepEqual(ended[0].sourcePins[path],{...pin,endSha256:pin.sha256});
      assert.deepEqual(await fileState(resolve(root,path)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});
    }
  }
  for(const[path,pin]of Object.entries(parent.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  for(const[path,pin]of Object.entries(pins))assert.deepEqual(await fileState(resolve(root,path)),pin);
};
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const retainedDatabases=new Map(Object.entries(acceptedReport.retainedDataAfter).map(([path,pin])=>[resolve(path),pin]));
assert(!retainedDatabases.has(original));retainedDatabases.set(original,acceptedReport.copyAfter);assert.equal(retainedDatabases.size,9);
const appendCounts={pa_physical_v1_field_roots:1,pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,
  pa_lifecycle_v1_execution_views:1,pa_lifecycle_v1_execution_calibrations:32};
const appendTables=Object.keys(appendCounts),mutableTables=['pa_physical_v1_heads'],allowed=new Set([...appendTables,...mutableTables]);
assert.equal(Object.values(appendCounts).reduce((sum,n)=>sum+n,0),45);
const rawRows=(db,table)=>{const q=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');q.setReadBigInts(true);return q.all();};
const persistedRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const report={pass:false,boundary:'NATIVE_FIELD_ROOT_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,parentV210Receipt:parentReceiptPath,parentV210Accepted:true,parentSourceChanges:0,
  failedV208Preserved:true,originalFailedRunCompleted:false,originalFailedRunEndPinsClaimed:false,parentCombinedHistoryProven:true,
  normalLifecycleAdvances:0,finalLifecycleCurrentProven:false,fieldRootAccepted:false,fieldStepAccepted:false,
  nativePostFieldRootConsumerProven:false,nativeResumeAdapterRequired:true,resumeReady:false,fullContinuationComplete:false,
  officialTerminalProven:false,wholeRngConsumptionProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.retainedDataBefore={};for(const[path,pin]of retainedDatabases){const actual=await databaseFiles(path);assert.deepEqual(dataPin(actual),dataPin(pin),'retained data changed: '+path);report.retainedDataBefore[path]=actual;}
  report.originalBefore=report.retainedDataBefore[original];report.harnessPins={...pins};
  for(const path of['tools/verification/check-native-field-root-v211.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  await pinParent();digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  assert.equal(digestBundle.inputCount,1);assert.deepEqual(Object.keys(digestBundle.sourcePins),['tools/verification/NativeSpinNeutralV193-sql.ts']);
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-field-root-v211.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  for(const[path,pin]of Object.entries(report.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,retainedDataBefore:report.retainedDataBefore,input,enrollmentSourceId,careerId,
    parentV210Receipt:parentReceiptPath,parentSourceChanges:0,parentCombinedHistoryProven:true,failedV208Preserved:true,originalFailedRunEndPinsClaimed:false,
    appendCounts,mutableTables,stopBoundary:'NORMAL_FIELD_ROOT_CUT12_AFTER_RETAINED_ESCAPE_V3_ROOT_AND_CAL32_ONLY',
    constraints:['ONE_REAL_VITEST_NF211_S01_ON_NEW_OWNED_SQLITE_BACKUP','NO_BATTING_OR_OLD_CALIBRATION_OR_BODY_REACCEPT','RETAINED_V198_ESCAPE_V3_PROFILE_UNCHANGED',
      'ONE_NORMAL_LIFECYCLE_ADVANCE_WITH_OWNER_RELEASED_CAL32_CHECKPOINT','ONE_PHYSICAL_HEAD_CAS_WORLD_AND_OTHER_HEADS_UNCHANGED','NO_SCHEMA_CHANGE',
      'NO_SHARED_FIELD_APPEND_CLOSURE_OR_CONTINUOUS_V2_OR_FIELD_STEP_OR_AI_OR_OFFICIAL','OLD_FAILURE_AND_ALL_ANCESTOR_DATA_PRESERVED',
      'NO_FIXTURE_BUNDLE_EXECUTION','NO_PERFORMANCE_OR_WHOLE_RNG_COMPLETION_CLAIM']});
  report.startManifestPin=await fileState(resolve(out,'start-manifest.json'));
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);
  const through=Object.create(null);for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  const physicalBefore=rawRows(source,'pa_physical_v1_heads'),worldBefore=rawRows(source,'world_control_heads');
  const oldP=physicalBefore.filter(row=>row.enrollment_source_id===enrollmentSourceId),oldW=worldBefore.filter(row=>row.career_id===careerId);
  assert.equal(oldP.length,1);assert.equal(oldW.length,1);assert.equal(oldP[0].operation_ordinal,5n);assert.equal(oldW[0].world_revision,2n);
  assert.equal(oldP[0].last_owner,accepted.resolutionReference.owner);assert.equal(oldP[0].last_source_id,accepted.resolutionReference.sourceId);assert.equal(oldP[0].last_snapshot_hash,accepted.resolutionReference.snapshotHash);
  save('physical-heads-before.lossless.json',persistedRows(physicalBefore));save('world-heads-before.lossless.json',persistedRows(worldBefore));
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-field-root-v211.test.ts','--testNamePattern','NF211-S01','--maxWorkers=1','--minWorkers=1'],
    {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_NATIVE_FIELD_ROOT_V211_DATABASE:destination,BASEBALL_NATIVE_FIELD_ROOT_V211_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_FIELD_ROOT_V211_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'Native field root failed; retain records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert.equal(report.nativeSummary.pass,true);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert.equal(frontier.fieldRootAccepted,true);assert.equal(frontier.finalLifecycleCurrentProven,true);
  for(const key of['nativePostFieldRootConsumerProven','fieldStepAccepted','resumeReady','fullContinuationComplete','officialTerminalProven','wholeRngConsumptionProven','performancePass',
    'twoTakeReplayed','forecastRegenerated','fieldRootRegenerated','flightAdvanceProven','ballRunAccepted','contactFieldingAccepted','defensiveAiAccepted'])assert.equal(frontier[key],false);
  assert.equal(frontier.newPracticeAccepted,0);assert.deepEqual(frontier.declaration,profile);assert.deepEqual(frontier.actualContact,accepted.actualContact);assert.deepEqual(frontier.historicalInput,accepted.historicalInput);
  assert.equal(frontier.nativeResumeAdapterRequired,true);assert.equal(frontier.normalLifecycleAdvances,1);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut12:view');
  assert.deepEqual(frontier.retainedInputReferences,input.retainedInputReferences);
  assert.deepEqual(Object.keys(frontier.resumePins).sort(),[...Object.keys(input.resumePins),'fieldRootReference'].sort());
  for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  assert.deepEqual(frontier.resumePins.fieldRootReference,frontier.fieldRootReference);assert.deepEqual(frontier.eventReferences,[...input.eventReferences,frontier.fieldRootReference]);assert.equal(frontier.eventReferences.length,12);
  assert.deepEqual(frontier.finalPrefixReference,frontier.finalCurrent.view.source.prefixReference);assert.deepEqual(frontier.prefix.source.eventReferences,frontier.eventReferences);assert.equal(frontier.totals.length,10);
  assert.deepEqual(frontier.finalCurrent,frontier.finalHistorical);assert.equal(frontier.finalCurrent.view.cut.stage,'field_active');
  assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,frontier.fieldRootReference);assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,frontier.fieldRootReference);
  assert.deepEqual(frontier.currentPhysicalOperation.reference,frontier.fieldRootReference);assert.deepEqual(frontier.currentPhysicalOperation.record,frontier.fieldRoot);
  const fieldRoot=frontier.fieldRoot,rootSource=fieldRoot.source;assert.equal(fieldRoot.kind,'same_pa_physical_field_root_v1');assert.equal(fieldRoot.operationOrdinal,6);
  assert.equal(rootSource.capability,'same_pa_physical_field_root_v1');assert.equal(rootSource.sourceId,profile.fieldLabel+':field-root');
  assert.deepEqual(rootSource.viewReference,input.finalViewReference);assert.deepEqual(rootSource.launchReference,input.resumePins.launchReference);
  assert.deepEqual(rootSource.previousOperationReference,input.resumePins.resolutionReference);assert.deepEqual(rootSource.resolutionReference,input.resumePins.resolutionReference);assert.deepEqual(rootSource.postureReference,input.resumePins.postureReference);
  assert.deepEqual(rootSource.fieldInputs,{kind:'fresh_physical_field_calibration_v1',calibrationReference:preparation.calibrationReference});
  assert.equal(rootSource.sourceVersion,profile.futureFieldRootSourceVersion);assert.deepEqual(rootSource.ballPhysics,profile.futureBallPhysics);
  assert.deepEqual(rootSource.parameters,profile.calibrationParameters);assert.equal(rootSource.throughTick,accepted.actualContact.tick);assert.equal(fieldRoot.evaluationTick,accepted.actualContact.tick);
  for(const key of['liveProducerProfile','actorProducerPolicies','venuePolicy','venueLegalCoveragePolicy','parkEquipment'])assert.equal(Object.hasOwn(rootSource,key),false);
  assert.deepEqual(frontier.fieldRootSource,rootSource);assert.deepEqual(frontier.fieldCalibrationReference,preparation.calibrationReference);assert.deepEqual(frontier.fieldModelReference,preparation.bodyModelReference);
  assert.deepEqual(frontier.fieldModel,accepted.originalInputs.fieldCalibration.calibration.model);assert.deepEqual(frontier.rootBallPhysics,profile.futureBallPhysics);
  const expectedCommands=frontier.fieldModel.actors.map(actor=>({playerId:actor.playerId,bodyAcceleration:{x:0,y:0,z:0},primitiveMotions:actor.primitives.map(primitive=>({role:primitive.role,offsetVelocity:{x:0,y:0,z:0},offsetAcceleration:{x:0,y:0,z:0}}))}));
  assert.deepEqual(rootSource.commands,expectedCommands);assert.deepEqual(frontier.sourceCurve,fieldRoot.response.world.sourceCurve);assert(frontier.sourceCurve);
  assert.deepEqual(frontier.sourceCurve.profile,profile.futureBallPhysics);assert.equal(frontier.sourceCurve.initial.originTick,accepted.actualContact.tick);assert.equal(frontier.sourceCurve.initial.elapsedSeconds,0);assert.equal(frontier.sourceCurve.throughElapsedSeconds,0);
  assert(fieldRoot.ballSolverEvidence);assert.deepEqual(frontier.ballSolverEvidence,fieldRoot.ballSolverEvidence);
  for(const key of['actor','launch','action','posture','intent','fieldCalibration','bodyModel','batterBody','originalAction'])assert.deepEqual(frontier.originalInputs[key],accepted.originalInputs[key]);
  assert.deepEqual(frontier.originalInputs.resolution,accepted.resolution);assert.equal(frontier.originalInputs.action.source.nominalPitch.delivery.matchSeed,19);assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.matchSeed,19);
  assert.equal(frontier.originalInputs.originalAction.nominalPitch.delivery.outingId,'outing-1');assert.equal(frontier.originalInputs.action.lineage.playId,7);assert.equal(frontier.originalInputs.launch.pitchOrdinal,3);
  assert.deepEqual(frontier.worldBefore,accepted.worldAfter);assert.deepEqual(frontier.worldAfter,accepted.worldAfter);
  assert.equal(frontier.calibrations.length,32);assert.equal(frontier.calibrationReferences.length,32);for(const calibration of frontier.calibrations)assert.deepEqual(calibration.source.viewReference,frontier.finalViewReference);
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  const checkpointName='normal-cut12-current-cal32-physical-world-checkpoint',matches=stages.filter(value=>value.name===checkpointName);assert.equal(matches.length,1);
  const checkpoint=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+matches[0].index+'-'+checkpointName+'.lossless.json'),'utf8'));
  for(const key of['finalViewReference','finalCurrent','finalPrefixReference','prefix','totals','calibrations','calibrationReferences','eventReferences','resumePins','currentPhysicalOperation','fieldRootReference','fieldRoot'])assert.deepEqual(checkpoint[key],frontier[key]);
  assert.equal(checkpoint.finalLifecycleCurrentProven,true);assert.equal(checkpoint.normalLifecycleAdvances,1);assert.equal(checkpoint.fieldRootAccepted,true);assert.deepEqual(checkpoint.world,accepted.worldAfter);
  const requiredStageNames=['retained-resolved-cut11-and-field-inputs-authenticated','field-root-source-declared-before-acceptance','normal-field-root-accepted-before-cut12',checkpointName,'normal-field-root-cut12-cal32-and-world-authenticated'];
  const requiredStages=requiredStageNames.map(name=>{const found=stages.filter(value=>value.name===name);assert.equal(found.length,1);return found[0];});
  for(let index=1;index<requiredStages.length;index++)assert(requiredStages[index-1].index<requiredStages[index].index,'field root normal proof stages must preserve authentication and acceptance order');
  report.normalCheckpointStages=matches;
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('after-logical-with-rowid.json',after);
  assert.deepEqual(after.catalog,before.catalog,'V211 must not add or change any schema');
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'retained immutable row/rowid changed: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,after.tables[table].rows-before.tables[table].rows]));assert.deepEqual(report.appendedRows,appendCounts);
  assert.equal(Object.values(report.appendedRows).reduce((sum,count)=>sum+count,0),45);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));assert.deepEqual([...report.changedTables].sort(),[...allowed].sort());
  const physicalAfter=rawRows(target,'pa_physical_v1_heads'),worldAfter=rawRows(target,'world_control_heads');
  save('physical-heads-after.lossless.json',persistedRows(physicalAfter));save('world-heads-after.lossless.json',persistedRows(worldAfter));
  assert.deepEqual(physicalAfter.filter(row=>row.enrollment_source_id!==enrollmentSourceId),physicalBefore.filter(row=>row.enrollment_source_id!==enrollmentSourceId));assert.deepEqual(worldAfter,worldBefore);
  const newP=physicalAfter.filter(row=>row.enrollment_source_id===enrollmentSourceId);assert.equal(newP.length,1);
  assert.deepEqual(newP[0],Object.assign(Object.create(null),oldP[0],{operation_ordinal:oldP[0].operation_ordinal+1n,last_owner:frontier.fieldRootReference.owner,last_source_id:frontier.fieldRootReference.sourceId,last_snapshot_hash:frontier.fieldRootReference.snapshotHash}));
  report.onlyExpectedOnePhysicalHeadCasProven=true;report.worldAndAllOtherHeadsUnchanged=true;report.existingImmutableRowsRowidsSchemaAndOtherHeadsUnchanged=true;
  report.noFieldStepAiOrOfficialRowsAccepted=true;target.exec('ROLLBACK');target.close();target=null;
  report.fieldRootAccepted=true;report.normalLifecycleAdvances=1;report.finalLifecycleCurrentProven=true;report.parentCombinedHistoryRowsAndSchemaPreserved=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.retainedDataAfter={};for(const[path,before]of Object.entries(report.retainedDataBefore??{})){const after=await databaseFiles(path);assert.deepEqual(dataPin(after),dataPin(before),'retained data changed: '+path);report.retainedDataAfter[path]=after;}
    assert.equal(Object.keys(report.retainedDataAfter).length,retainedDatabases.size);report.originalAfter=report.retainedDataAfter[original];report.copyAfter=await databaseFiles(destination);report.originalDataUnchanged=true;
    await pinParent();report.parentSourceAndHarnessPinsUnchanged=true;report.bundles=[];
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
console.log(JSON.stringify({pass:report.pass,fieldRootAccepted:report.fieldRootAccepted,finalLifecycleCurrentProven:report.finalLifecycleCurrentProven,
  appendedRows:report.appendedRows,onlyExpectedOnePhysicalHeadCasProven:report.onlyExpectedOnePhysicalHeadCasProven,worldAndAllOtherHeadsUnchanged:report.worldAndAllOtherHeadsUnchanged,
  originalDataUnchanged:report.originalDataUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  resumeReady:false,fullContinuationComplete:false,performancePass:false,error:report.error??report.cleanupError??report.pinError??null}));
