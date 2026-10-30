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
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V207 frontier and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-forecast-admission-v207-01'));
const inputPaths=['report.json','frontier.lossless.json','start-manifest.json'].map(name=>resolve(retained,name));
const inputBytes=inputPaths.map(path=>readFileSync(path)),inputPins=Object.fromEntries(inputPaths.map((path,index)=>[path,
  {exists:true,bytes:inputBytes[index].length,sha256:createHash('sha256').update(inputBytes[index]).digest('hex')}]));
const[proof,accepted,start]=inputBytes.map(bytes=>parseDebugRecord(bytes.toString('utf8')));
assert(proof.pass&&proof.predictionAdmissionProven&&proof.resumeReady&&proof.existingRowsRowidsSchemaAndHeadsUnchanged);
assert(proof.legacy7PinFrontierExact&&proof.commonOriginalInputsExact&&proof.originalDataUnchanged&&proof.sourceAndBundleEndPinProven&&proof.harnessAndInputEndPinsProven);
assert.equal(proof.boundary,'NATIVE_FORECAST_ADMISSION_AND_RESUME_ONLY');assert.deepEqual(accepted,proof.frontier);
assert.equal(start.runtime.closureBundlesExecuted,false);assert.equal(proof.nativeTestExit.code,0);
assert(accepted.finalLifecycleCurrentProven&&accepted.nativePostForecastConsumerProven&&accepted.postAdmissionEntryReauthenticated&&accepted.resumeReady);
assert.equal(accepted.nativeResumeAdapterRequired,false);assert.equal(accepted.fullContinuationComplete,false);
assert.equal(accepted.finalViewReference.sourceId,'physical-fixture:cut7:view');assert.equal(accepted.eventReferences.length,7);
const pinNames=['postureReference','intentReference','launchReference','captureCutReference','observationReference','deliveryCutReference','deliveryReference','forecastReference'];
assert.deepEqual(Object.keys(accepted.resumePins).sort(),[...pinNames].sort());
assert.deepEqual(accepted.finalCurrent.view.cut.operationReference,accepted.resumePins.forecastReference);
assert.deepEqual(accepted.finalCurrent.view.cut.physicalOperationReference,accepted.resumePins.deliveryCutReference);
const original=resolve(proof.copyPath),destination=resolve(out,'execution-input-private.sqlite');
assert.equal(original,resolve(retained,'forecast-admission-private.sqlite'));
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]]));
const enrollmentSourceId=accepted.originalInputs.action.lineage.enrollmentReference.sourceId,careerId=accepted.originalInputs.world.head.careerId;
assert.equal(careerId,accepted.finalCurrent.actor.binding.careerId);assert.equal(accepted.originalInputs.world.head.worldRevision,0);
assert.equal(proof.cases.length,3);assert.deepEqual(proof.cases.map(value=>value.key),['forecast-admission','legacy-delivery-auth','original-input-reader']);
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const retainedDatabases=new Map([[original,proof.copyAfter]]);
for(const value of proof.cases){
  assert.equal(value.logicalVerificationProven,true);assert.deepEqual(dataPin(value.originalBefore),dataPin(value.originalAfter));
  for(const[path,pin]of[[value.original,value.originalAfter],[value.copyPath,value.copyAfter]]){
    const absolute=resolve(path);if(retainedDatabases.has(absolute))assert.deepEqual(dataPin(retainedDatabases.get(absolute)),dataPin(pin));
    retainedDatabases.set(absolute,pin);
  }
}
assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const appendCounts={pa_lifecycle_v1_work_prefixes:2,pa_lifecycle_v1_total_assessments:20,pa_lifecycle_v1_execution_views:2,
  pa_lifecycle_v1_execution_calibrations:64,batting_score_v1_assessments:1,batting_emotion_execution_v1_executions:1,
  batting_emotion_execution_v1_heads:1,pa_physical_v1_cuts:1,batting_execution_v1_inputs:1,world_decision_revision_events:1};
const appendTables=Object.keys(appendCounts),mutableTables=['pa_physical_v1_heads','world_control_heads'],allowed=new Set([...appendTables,...mutableTables]);
const emotionSchemas={
  batting_emotion_execution_v1_executions:'CREATE TABLE batting_emotion_execution_v1_executions(source_id TEXT PRIMARY KEY,execution_id TEXT NOT NULL UNIQUE,career_id TEXT NOT NULL,game_id TEXT NOT NULL,player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,view_source_id TEXT NOT NULL,genesis_source_id TEXT NOT NULL,emotion_revision INTEGER NOT NULL CHECK(emotion_revision>=1),world_revision INTEGER NOT NULL CHECK(world_revision>=1),state_hash TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(career_id,game_id,player_id,emotion_revision),UNIQUE(career_id,world_revision))',
  batting_emotion_execution_v1_heads:'CREATE TABLE batting_emotion_execution_v1_heads(career_id TEXT NOT NULL,game_id TEXT NOT NULL,player_id TEXT NOT NULL,enrollment_source_id TEXT NOT NULL,physical_pitch_source_id TEXT NOT NULL,genesis_source_id TEXT NOT NULL,genesis_source_hash TEXT NOT NULL,genesis_snapshot_hash TEXT NOT NULL,emotion_revision INTEGER NOT NULL CHECK(emotion_revision>=1),first_source_id TEXT NOT NULL,last_source_id TEXT NOT NULL,last_snapshot_hash TEXT NOT NULL,state_hash TEXT NOT NULL,PRIMARY KEY(career_id,game_id,player_id))',
};
const expectedCatalogAdditions=Object.entries(emotionSchemas).flatMap(([name,sql])=>[
  {type:'table',name,tbl_name:name,sql},...Array.from({length:name.endsWith('_executions')?4:1},(_,index)=>
    ({type:'index',name:'sqlite_autoindex_'+name+'_'+(index+1),tbl_name:name,sql:null}))]);
const orderedCatalog=rows=>rows.map(row=>[row.type,row.name,row.tbl_name,row.sql]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||String(a[1]).localeCompare(String(b[1])));
const rawRows=(db,table)=>{const query=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');query.setReadBigInts(true);return query.all();};
const persistedRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,
  typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
const report={pass:false,boundary:'NATIVE_EXECUTION_INPUT_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,fullContinuationComplete:false,executionInputAccepted:false,
  commitmentAccepted:false,resolutionAccepted:false,fieldRootAccepted:false,officialTerminalProven:false,
  wholeRngConsumptionProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.retainedDataBefore={};
  for(const[path,pin]of retainedDatabases){const actual=await databaseFiles(path);assert.deepEqual(dataPin(actual),dataPin(pin),'retained data changed: '+path);report.retainedDataBefore[path]=actual;}
  report.originalBefore=report.retainedDataBefore[original];report.harnessPins={...inputPins};
  for(const path of['tools/verification/check-native-execution-input-v208.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  assert.equal(digestBundle.inputCount,1);assert.deepEqual(Object.keys(digestBundle.sourcePins),['tools/verification/NativeSpinNeutralV193-sql.ts']);
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-execution-input-v208.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  for(const[path,pin]of Object.entries(report.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,retainedDataBefore:report.retainedDataBefore,input,enrollmentSourceId,careerId,
    appendCounts,mutableTables,expectedCatalogAdditions,stopBoundary:'NORMAL_EXECUTION_INPUT_ACCEPTED_BEFORE_COMMITMENT',
    constraints:['ONE_VITEST_NI208_S01_ON_NEW_OWNED_SQLITE_BACKUP','NO_OLD_SETUP_SCORE_EMOTION_INPUT_REGENERATION',
      'NORMAL_CURRENT_CUT9_AFTER_FENCE_NULL_INPUT_OUTSIDE_WORK_OWNERS','TWO_EXACT_HEAD_CAS_OTHER_ROWS_AND_ROWIDS_IMMUTABLE',
      'SENTINEL_IDENTITY_ONLY_OTHER_ERRORS_PROPAGATE','NO_COMMITMENT_RESOLUTION_FIELD_OR_OFFICIAL','CLOSURE_PIN_ONLY_DIGEST_BUNDLE_ONLY_NODE_EXECUTION']});
  report.startManifestPin=await fileState(resolve(out,'start-manifest.json'));
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');
  const before=digest(source);save('before-logical-with-rowid.json',before);const through=Object.create(null);
  for(const name of Object.keys(emotionSchemas))assert(!before.catalog.some(row=>row.name===name||row.tbl_name===name),'new emotion namespace already exists');
  for(const table of appendTables.filter(table=>Object.hasOwn(before.tables,table))){const query=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);query.setReadBigInts(true);const row=query.get();
    assert.equal(before.tables[table].rowIdentity,'ROWID');assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  const physicalHeadsBefore=rawRows(source,'pa_physical_v1_heads'),worldHeadsBefore=rawRows(source,'world_control_heads');
  save('physical-heads-before.lossless.json',persistedRows(physicalHeadsBefore));save('world-heads-before.lossless.json',persistedRows(worldHeadsBefore));
  const physicalTargetBefore=physicalHeadsBefore.filter(row=>row.enrollment_source_id===enrollmentSourceId),worldTargetBefore=worldHeadsBefore.filter(row=>row.career_id===careerId);
  assert.equal(physicalTargetBefore.length,1);assert.equal(worldTargetBefore.length,1);
  assert.equal(physicalTargetBefore[0].operation_ordinal,2n);assert.equal(worldTargetBefore[0].world_revision,0n);
  assert.equal(physicalTargetBefore[0].last_owner,input.resumePins.deliveryCutReference.owner);assert.equal(physicalTargetBefore[0].last_source_id,input.resumePins.deliveryCutReference.sourceId);
  assert.equal(physicalTargetBefore[0].last_snapshot_hash,input.resumePins.deliveryCutReference.snapshotHash);
  assert.equal(worldTargetBefore[0].control_revision,BigInt(accepted.originalInputs.world.head.control.revision));assert.equal(worldTargetBefore[0].control_json,accepted.originalInputs.world.controlJson);
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;
  report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-execution-input-v208.test.ts',
    '--testNamePattern','NI208-S01','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,env:{...process.env,
      BASEBALL_NATIVE_EXECUTION_INPUT_V208_DATABASE:destination,BASEBALL_NATIVE_EXECUTION_INPUT_V208_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_EXECUTION_INPUT_V208_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;
  save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
  await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'Native execution input checkpoint failed; inspect retained records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert.equal(report.nativeSummary.pass,true);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert.equal(frontier.executionInputAccepted,true);assert.equal(frontier.finalLifecycleCurrentProven,true);
  assert.equal(frontier.admittedEntryAuthenticated,true);
  assert.equal(frontier.normalLifecycleAdvances,2);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut9:view');
  assert.equal(frontier.fullContinuationComplete,false);assert.equal(frontier.nativeResumeAdapterRequired,true);assert.equal(frontier.resumeReady,false);
  assert.equal(frontier.inputAwaitingConsumerContinuation,true);assert(!Object.hasOwn(frontier,'inputAwaitingLifecycleAdmission'));
  assert.equal(frontier.nativePostInputConsumerProven,false);assert.equal(frontier.wholeRngConsumptionProven,false);
  assert.equal(frontier.commitmentAccepted,false);assert.equal(frontier.resolutionAccepted,false);assert.equal(frontier.fieldRootAccepted,false);assert.equal(frontier.officialTerminalProven,false);
  assert.deepEqual(Object.keys(frontier.resumePins).sort(),[...pinNames,'scoreReference','emotionReference','decisionCutReference','inputReference'].sort());
  assert.deepEqual(frontier.retainedInputReferences,input.retainedInputReferences);
  for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  assert.deepEqual(frontier.resumePins.inputReference,frontier.inputReference);
  assert.deepEqual(frontier.eventReferences,[...input.eventReferences,frontier.resumePins.emotionReference,frontier.resumePins.decisionCutReference]);
  assert.deepEqual(frontier.finalCurrent,frontier.finalHistorical);assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,frontier.resumePins.decisionCutReference);
  assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,frontier.resumePins.decisionCutReference);
  assert.deepEqual(frontier.currentDecisionCut.reference,frontier.resumePins.decisionCutReference);assert.equal(frontier.currentDecisionCut.record.operationOrdinal,3);
  assert.deepEqual(frontier.input.source.viewReference,frontier.finalViewReference);assert.deepEqual(frontier.input.source.physicalOperationReference,frontier.resumePins.decisionCutReference);
  assert.deepEqual(frontier.input.source.emotionReference,frontier.resumePins.emotionReference);assert.deepEqual(frontier.input.source.assessmentReferences,[frontier.resumePins.scoreReference]);
  assert.equal(frontier.calibrations.length,32);for(const calibration of frontier.calibrations)assert.deepEqual(calibration.source.viewReference,frontier.finalViewReference);
  assert.deepEqual(frontier.worldBefore,accepted.originalInputs.world);assert.deepEqual(frontier.worldAfter,{head:{...frontier.worldBefore.head,worldRevision:1},controlJson:frontier.worldBefore.controlJson});
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  report.normalCheckpointStages=[];
  for(const cut of[8,9]){
    const name='normal-cut'+cut+'-current-cal32-physical-world-checkpoint',matches=stages.filter(value=>value.name===name);assert.equal(matches.length,1);
    const checkpoint=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+matches[0].index+'-'+name+'.lossless.json'),'utf8'));
    assert.equal(checkpoint.finalLifecycleCurrentProven,true);assert.equal(checkpoint.normalLifecycleAdvances,cut-7);assert.equal(checkpoint.executionInputAccepted,false);
    assert.equal(checkpoint.finalViewReference.sourceId,'physical-fixture:cut'+cut+':view');assert.equal(checkpoint.calibrations.length,32);assert.equal(checkpoint.calibrationReferences.length,32);
    assert.deepEqual(checkpoint.eventReferences,[...input.eventReferences,frontier.resumePins.emotionReference,...(cut===9?[frontier.resumePins.decisionCutReference]:[])]);
    assert.deepEqual(checkpoint.world,frontier.worldAfter);assert.deepEqual(checkpoint.currentPhysicalCut.reference,cut===8?input.resumePins.deliveryCutReference:frontier.resumePins.decisionCutReference);
    for(const calibration of checkpoint.calibrations)assert.deepEqual(calibration.source.viewReference,checkpoint.finalViewReference);
    if(cut===9){assert.deepEqual(checkpoint.finalCurrent,frontier.finalCurrent);assert.deepEqual(checkpoint.calibrations,frontier.calibrations);}
    report.normalCheckpointStages.push(matches[0]);
  }
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('after-logical-with-rowid.json',after);
  const physicalHeadsAfter=rawRows(target,'pa_physical_v1_heads'),worldHeadsAfter=rawRows(target,'world_control_heads');
  save('physical-heads-after.lossless.json',persistedRows(physicalHeadsAfter));save('world-heads-after.lossless.json',persistedRows(worldHeadsAfter));
  assert.deepEqual(physicalHeadsAfter.filter(row=>row.enrollment_source_id!==enrollmentSourceId),physicalHeadsBefore.filter(row=>row.enrollment_source_id!==enrollmentSourceId));
  assert.deepEqual(worldHeadsAfter.filter(row=>row.career_id!==careerId),worldHeadsBefore.filter(row=>row.career_id!==careerId));
  const physicalTargetAfter=physicalHeadsAfter.filter(row=>row.enrollment_source_id===enrollmentSourceId),worldTargetAfter=worldHeadsAfter.filter(row=>row.career_id===careerId);
  assert.equal(physicalTargetAfter.length,1);assert.equal(worldTargetAfter.length,1);
  assert.deepEqual(physicalTargetAfter[0],Object.assign(Object.create(Object.getPrototypeOf(physicalTargetBefore[0])),physicalTargetBefore[0],{
    operation_ordinal:3n,last_owner:frontier.resumePins.decisionCutReference.owner,last_source_id:frontier.resumePins.decisionCutReference.sourceId,last_snapshot_hash:frontier.resumePins.decisionCutReference.snapshotHash}));
  assert.deepEqual(worldTargetAfter[0],Object.assign(Object.create(Object.getPrototypeOf(worldTargetBefore[0])),worldTargetBefore[0],{world_revision:1n}));
  report.onlyExpectedPhysicalAndWorldHeadsUpdated=true;
  for(const old of before.catalog)assert.deepEqual(after.catalog.find(row=>row.type===old.type&&row.name===old.name),old,'existing schema changed: '+old.name);
  report.catalogAdded=after.catalog.filter(row=>!before.catalog.some(old=>row.type===old.type&&row.name===old.name));
  assert.deepEqual(orderedCatalog(report.catalogAdded),orderedCatalog(expectedCatalogAdditions),'only the two normal emotion tables and five autoindexes may be added');
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'existing immutable row/rowid/head changed: '+table);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));
  for(const table of report.changedTables)assert(allowed.has(table),'unexpected changed table: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,(after.tables[table]?.rows??0)-(before.tables[table]?.rows??0)]));
  assert.deepEqual(report.appendedRows,appendCounts);assert.equal(Object.values(report.appendedRows).reduce((sum,count)=>sum+count,0),94);
  target.exec('ROLLBACK');target.close();target=null;report.existingImmutableRowsRowidsSchemaAndHeadsUnchanged=true;report.executionInputAccepted=true;report.resumeReady=false;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.retainedDataAfter={};report.retainedShmObservation={};
    for(const[path,before]of Object.entries(report.retainedDataBefore??{})){const after=await databaseFiles(path);assert.deepEqual(dataPin(after),dataPin(before),'retained data changed: '+path);
      report.retainedDataAfter[path]=after;report.retainedShmObservation[path]={before:before['-shm'],after:after['-shm']};}
    assert.equal(Object.keys(report.retainedDataAfter).length,retainedDatabases.size);report.originalAfter=report.retainedDataAfter[original];report.copyAfter=await databaseFiles(destination);report.originalDataUnchanged=true;
    report.bundles=[];
    for(const pinned of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});const pins={};
      for(const[path,pin]of Object.entries(pinned.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});pins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:pinned===digestBundle,inputCount:pinned.inputCount,sha256:pinned.sha256,sourcePins:pins});}
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;
    assert.deepEqual(await fileState(resolve(out,'start-manifest.json')),report.startManifestPin);
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,executionInputAccepted:report.executionInputAccepted,resumeReady:report.resumeReady,fullContinuationComplete:false,
  originalDataUnchanged:report.originalDataUnchanged,existingImmutableRowsRowidsSchemaAndHeadsUnchanged:report.existingImmutableRowsRowidsSchemaAndHeadsUnchanged,
  onlyExpectedPhysicalAndWorldHeadsUpdated:report.onlyExpectedPhysicalAndWorldHeadsUpdated,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
