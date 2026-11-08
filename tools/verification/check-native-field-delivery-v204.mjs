import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root=process.cwd(),retained=resolve(process.argv[2]??''),out=resolve(process.argv[3]??''),rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V203 observation and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-field-observation-v203-01'));
const inputPaths=['report.json','frontier.lossless.json','start-manifest.json'].map(name=>resolve(retained,name));
const inputBytes=inputPaths.map(path=>readFileSync(path)),inputPins=Object.fromEntries(inputPaths.map((path,i)=>[path,
  {exists:true,bytes:inputBytes[i].length,sha256:createHash('sha256').update(inputBytes[i]).digest('hex')}]));
const[proof,capture]=inputBytes.map(bytes=>parseDebugRecord(bytes.toString('utf8')));
assert(proof.pass&&proof.originalDataUnchanged&&proof.existingRowsRowidsSchemaAndHeadsUnchanged&&proof.sourceAndBundleEndPinProven);
assert.equal(proof.boundary,'NATIVE_FIXTURE_POST_OBSERVATION_CHECKPOINT_ONLY');assert.deepEqual(capture,proof.frontier);
assert(capture.postObservationCurrentProven&&capture.wrongTimeRejected&&capture.resumeReady);
assert.equal(capture.fullContinuationComplete,false);
const original=resolve(proof.copyPath),destination=resolve(out,'field-delivery-private.sqlite');
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,capture[key]]));
const enrollmentSourceId=capture.originalInputs.action.lineage.enrollmentReference.sourceId;
assert(existsSync(original));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const appendTables=['pa_lifecycle_v1_work_prefixes','pa_lifecycle_v1_total_assessments','pa_lifecycle_v1_execution_views','pa_lifecycle_v1_execution_calibrations',
  'pa_physical_v1_cuts','batting_observation_v1_deliveries','batting_observation_v1_invocation_heads'];
const mutableTables=['pa_physical_v1_heads'];
const allowed=new Set([...appendTables,...mutableTables]);
const report={pass:false,boundary:'NATIVE_FIXTURE_DELIVERY_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,changeReason:'NORMAL_LATENCY_CUT_AND_DELIVERY_ONLY_FROM_SAVED_V203',
  fullContinuationComplete:false,deliveryAccepted:false,resolutionAccepted:false,fieldRootAccepted:false,newPracticeAccepted:0,newTakeAccepted:0,
  secondNativeControlBranchProven:false,officialTerminalProven:false,wholeRngConsumptionProven:false,performancePass:false,
  privateArtifactNotForPublication:true,stages:[]};
const stage=(name,value)=>{const s={name,at:new Date().toISOString(),memory:process.memoryUsage(),heapLimitBytes:getHeapStatistics().heap_size_limit};
  report.stages.push(s);save('stage-'+report.stages.length+'.json',s);
  if(value!==undefined)save('checkpoint-'+report.stages.length+'-'+name+'.lossless.json',value);console.log(JSON.stringify(s));};
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
let source,target,bundle,digestBundle,physicalHeadsBefore;
const physicalHeads=db=>{const query=db.prepare('SELECT rowid AS native_rowid,* FROM main.pa_physical_v1_heads ORDER BY rowid');query.setReadBigInts(true);return query.all();};
const persistedHeads=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,
  typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
try{
  report.originalBefore=await databaseFiles(original);assert.deepEqual(dataPin(report.originalBefore),dataPin(proof.copyAfter),'retained capture data changed');
  report.harnessPins={};
  for(const path of[...inputPaths,'tools/verification/check-native-field-delivery-v204.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs']){
    report.harnessPins[path]=await fileState(resolve(root,path));if(inputPins[path])assert.deepEqual(report.harnessPins[path],inputPins[path]);}
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-field-delivery-v204.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  save('start-manifest.json',{runtime:{execution:report.execution,nodeVersion:process.version,closureBundleExecuted:false},bundle,digestBundle,harnessPins:report.harnessPins,
    originalBefore:report.originalBefore,input,enrollmentSourceId,appendTables,mutableTables,expectedAppendCounts:[1,10,1,32,1,1,1],stopBoundary:'NORMAL_DELIVERY_ACCEPTED_BEFORE_LIFECYCLE_ADMISSION',
    constraints:['NEW_OWNED_SQLITE_BACKUP_ONLY','NO_LAUNCH_CAPTURE_OBSERVATION_PRACTICE_TAKE_REGENERATION','EXISTING_INVOCATION_HEAD_ROWS_IMMUTABLE_PHYSICAL_HEAD_NORMAL_UPDATE_ONLY',
      'SENTINEL_IDENTITY_ONLY_OTHER_ERRORS_PROPAGATE','NO_DELIVERY_ADMISSION_PREDICTION_COMMITMENT_RESOLUTION_FIELD_OR_OFFICIAL']});
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');
  const before=digest(source);save('original-logical-with-rowid.json',before);const through=Object.create(null);
  physicalHeadsBefore=physicalHeads(source);save('physical-heads-before.lossless.json',persistedHeads(physicalHeadsBefore));
  for(const table of appendTables.filter(table=>Object.hasOwn(before.tables,table))){const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();
    assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);
  target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);stage('consistent-owned-copy-authenticated');
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-field-delivery-v204.test.ts',
    '--testNamePattern','NF204-S01','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,
    env:{...process.env,BASEBALL_NATIVE_FIELD_DELIVERY_V204_DATABASE:destination,BASEBALL_NATIVE_FIELD_DELIVERY_V204_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_FIELD_DELIVERY_V204_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;stage('original-source-observation-runtime-started',{processId:child.pid,recordsPath:records});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
  await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'observation checkpoint failed; inspect retained records/vitest.log');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert(report.nativeSummary.pass);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert(frontier.deliveryCheckpointProven);assert.equal(frontier.fullContinuationComplete,false);
  assert.equal(frontier.deliveryAfterFenceProven,true);
  assert.equal(frontier.resumeReady,false);assert.equal(frontier.nativePostDeliveryConsumerProven,false);assert.equal(frontier.nativeResumeAdapterRequired,true);
  assert.equal(frontier.deliveryAwaitingLifecycleAdmission,true);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut5:view');
  assert.equal(frontier.finalLifecycleCurrentProven,false);assert.equal(frontier.deliveryAccepted,true);report.deliveryAccepted=true;
  assert.deepEqual(frontier.finalHistorical.view.cut.physicalOperationReference,frontier.resumePins.deliveryCutReference);
  assert.deepEqual(frontier.delivery.source.viewReference,frontier.finalViewReference);
  assert.deepEqual(frontier.delivery.source.observationReference,input.resumePins.observationReference);
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('observed-logical-with-rowid.json',after);
  const headsAfter=physicalHeads(target);save('physical-heads-after.lossless.json',persistedHeads(headsAfter));
  assert.deepEqual(headsAfter.filter(row=>row.enrollment_source_id!==enrollmentSourceId),physicalHeadsBefore.filter(row=>row.enrollment_source_id!==enrollmentSourceId));
  const beforeHead=physicalHeadsBefore.filter(row=>row.enrollment_source_id===enrollmentSourceId),afterHead=headsAfter.filter(row=>row.enrollment_source_id===enrollmentSourceId);
  assert.equal(beforeHead.length,1);assert.equal(afterHead.length,1);assert.equal(afterHead[0].native_rowid,beforeHead[0].native_rowid);
  assert.equal(beforeHead[0].last_owner,input.resumePins.captureCutReference.owner);assert.equal(beforeHead[0].last_source_id,input.resumePins.captureCutReference.sourceId);
  assert.equal(beforeHead[0].last_snapshot_hash,input.resumePins.captureCutReference.snapshotHash);
  assert.deepEqual(afterHead[0],Object.assign(Object.create(Object.getPrototypeOf(beforeHead[0])),beforeHead[0],{operation_ordinal:beforeHead[0].operation_ordinal+1n,
    last_owner:frontier.resumePins.deliveryCutReference.owner,last_source_id:frontier.resumePins.deliveryCutReference.sourceId,
    last_snapshot_hash:frontier.resumePins.deliveryCutReference.snapshotHash}));report.onlyExpectedPhysicalHeadUpdated=true;
  for(const old of before.catalog)assert.deepEqual(after.catalog.find(row=>row.type===old.type&&row.name===old.name),old,'existing schema changed: '+old.name);
  report.catalogAdded=after.catalog.filter(row=>!before.catalog.some(old=>row.type===old.type&&row.name===old.name));for(const added of report.catalogAdded)assert(allowed.has(added.tbl_name));
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'existing immutable row/rowid/head changed: '+table);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));
  for(const table of report.changedTables)assert(allowed.has(table),'unexpected changed table: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,(after.tables[table]?.rows??0)-(before.tables[table]?.rows??0)]));
  assert.deepEqual(report.appendedRows,{pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,pa_lifecycle_v1_execution_views:1,pa_lifecycle_v1_execution_calibrations:32,
    pa_physical_v1_cuts:1,batting_observation_v1_deliveries:1,batting_observation_v1_invocation_heads:1});
  target.exec('ROLLBACK');target.close();target=null;report.existingImmutableRowsRowidsSchemaAndHeadsUnchanged=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.originalAfter=await databaseFiles(original);report.copyAfter=await databaseFiles(destination);assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));report.originalDataUnchanged=true;
    report.shmObservation={before:report.originalBefore['-shm'],afterBackup:report.originalAfterBackup?.['-shm'],after:report.originalAfter['-shm']};report.bundles=[];
    for(const pinned of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});const pins={};
      for(const[path,pin]of Object.entries(pinned.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});pins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:pinned===digestBundle,inputCount:pinned.inputCount,sha256:pinned.sha256,sourcePins:pins});}
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,deliveryCheckpointProven:report.frontier?.deliveryCheckpointProven,resumeReady:report.frontier?.resumeReady,
  fullContinuationComplete:false,originalDataUnchanged:report.originalDataUnchanged,existingImmutableRowsRowidsSchemaAndHeadsUnchanged:report.existingImmutableRowsRowidsSchemaAndHeadsUnchanged,
  sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,error:report.error??report.cleanupError??report.pinError??null}));
