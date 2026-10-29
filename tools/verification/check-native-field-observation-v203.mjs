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
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'accepted V199 capture and new workspace output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-field-continuation-v199-01'));
const inputPaths=['report.json','frontier.lossless.json','start-manifest.json'].map(name=>resolve(retained,name));
const inputBytes=inputPaths.map(path=>readFileSync(path)),inputPins=Object.fromEntries(inputPaths.map((path,i)=>[path,
  {exists:true,bytes:inputBytes[i].length,sha256:createHash('sha256').update(inputBytes[i]).digest('hex')}]));
const[proof,capture]=inputBytes.map(bytes=>parseDebugRecord(bytes.toString('utf8')));
assert(proof.pass&&proof.originalDataUnchanged&&proof.existingImmutableRowsRowidsAndSchemaUnchanged&&proof.sourceAndBundleEndPinProven);
assert.equal(proof.boundary,'NATIVE_FIXTURE_FIRST_CAPTURE_CHECKPOINT_ONLY');assert.deepEqual(capture,proof.frontier);
assert(capture.currentCaptureProven&&capture.precedingLifecycleAuthenticated&&capture.resumeReady&&capture.captureAwaitingLifecycleAdmission);
assert.equal(capture.fullContinuationComplete,false);
const original=resolve(proof.copyPath),destination=resolve(out,'field-observation-private.sqlite');
const input=Object.fromEntries(['retainedInputReferences','resumePins','precedingLifecycleViewReference','eventReferences'].map(key=>[key,capture[key]]));
assert(existsSync(original));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const appendTables=['pa_lifecycle_v1_work_prefixes','pa_lifecycle_v1_total_assessments','pa_lifecycle_v1_execution_views','pa_lifecycle_v1_execution_calibrations',
  'batting_observation_v1_observations','batting_observation_v1_invocation_heads'];
const allowed=new Set(appendTables);
const report={pass:false,boundary:'NATIVE_FIXTURE_POST_OBSERVATION_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,changeReason:'NORMAL_CAPTURE_ADMISSION_AND_OBSERVATION_ONLY_FROM_SAVED_V199',
  fullContinuationComplete:false,deliveryAccepted:false,resolutionAccepted:false,fieldRootAccepted:false,newPracticeAccepted:0,newTakeAccepted:0,
  secondNativeControlBranchProven:false,officialTerminalProven:false,wholeRngConsumptionProven:false,performancePass:false,
  privateArtifactNotForPublication:true,stages:[]};
const stage=(name,value)=>{const s={name,at:new Date().toISOString(),memory:process.memoryUsage(),heapLimitBytes:getHeapStatistics().heap_size_limit};
  report.stages.push(s);save('stage-'+report.stages.length+'.json',s);
  if(value!==undefined)save('checkpoint-'+report.stages.length+'-'+name+'.lossless.json',value);console.log(JSON.stringify(s));};
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
let source,target,bundle,digestBundle;
try{
  report.originalBefore=await databaseFiles(original);assert.deepEqual(dataPin(report.originalBefore),dataPin(proof.copyAfter),'retained capture data changed');
  report.harnessPins={};
  for(const path of[...inputPaths,'tools/verification/check-native-field-observation-v203.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs']){
    report.harnessPins[path]=await fileState(resolve(root,path));if(inputPins[path])assert.deepEqual(report.harnessPins[path],inputPins[path]);}
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-field-observation-v203.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  save('start-manifest.json',{runtime:{execution:report.execution,nodeVersion:process.version,closureBundleExecuted:false},bundle,digestBundle,harnessPins:report.harnessPins,
    originalBefore:report.originalBefore,input,appendTables,expectedAppendCounts:[2,20,2,64,1,1],stopBoundary:'FORMAL_POST_OBSERVATION_CURRENT_CUT4_BEFORE_DELIVERY',
    constraints:['NEW_OWNED_SQLITE_BACKUP_ONLY','NO_LAUNCH_CAPTURE_PRACTICE_TAKE_REGENERATION','EXISTING_INVOCATION_HEAD_ROWS_AND_PHYSICAL_HEAD_IMMUTABLE',
      'WRONG_TIME_REJECT_WITH_NO_SOURCE_ROW_OR_HEAD_CHANGE','SENTINEL_IDENTITY_ONLY_OTHER_ERRORS_PROPAGATE','NO_DELIVERY_COMMITMENT_RESOLUTION_FIELD_OR_OFFICIAL']});
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');
  const before=digest(source);save('original-logical-with-rowid.json',before);const through=Object.create(null);
  for(const table of appendTables.filter(table=>Object.hasOwn(before.tables,table))){const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();
    assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);
  target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);stage('consistent-owned-copy-authenticated');
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-field-observation-v203.test.ts',
    '--testNamePattern','NF203-S01','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,
    env:{...process.env,BASEBALL_NATIVE_FIELD_OBSERVATION_V203_DATABASE:destination,BASEBALL_NATIVE_FIELD_OBSERVATION_V203_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_FIELD_OBSERVATION_V203_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;stage('original-source-observation-runtime-started',{processId:child.pid,recordsPath:records});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
  await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'observation checkpoint failed; inspect retained records/vitest.log');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert(report.nativeSummary.pass);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert(frontier.postObservationCurrentProven&&frontier.wrongTimeRejected);assert.equal(frontier.fullContinuationComplete,false);
  assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut4:view');
  assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,frontier.observationReference);
  assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,input.resumePins.captureCutReference);
  assert.deepEqual(frontier.resumePins,{...input.resumePins,observationReference:frontier.observationReference});
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('observed-logical-with-rowid.json',after);
  for(const old of before.catalog)assert.deepEqual(after.catalog.find(row=>row.type===old.type&&row.name===old.name),old,'existing schema changed: '+old.name);
  report.catalogAdded=after.catalog.filter(row=>!before.catalog.some(old=>row.type===old.type&&row.name===old.name));for(const added of report.catalogAdded)assert(allowed.has(added.tbl_name));
  for(const[table,old]of Object.entries(before.tables))assert.deepEqual(prior.tables[table],old,'existing immutable row/rowid/head changed: '+table);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));
  for(const table of report.changedTables)assert(allowed.has(table),'unexpected changed table: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,(after.tables[table]?.rows??0)-(before.tables[table]?.rows??0)]));
  assert.deepEqual(report.appendedRows,{pa_lifecycle_v1_work_prefixes:2,pa_lifecycle_v1_total_assessments:20,pa_lifecycle_v1_execution_views:2,pa_lifecycle_v1_execution_calibrations:64,
    batting_observation_v1_observations:1,batting_observation_v1_invocation_heads:1});
  target.exec('ROLLBACK');target.close();target=null;report.existingRowsRowidsSchemaAndHeadsUnchanged=true;report.pass=true;
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
console.log(JSON.stringify({pass:report.pass,postObservationCurrentProven:report.frontier?.postObservationCurrentProven,wrongTimeRejected:report.frontier?.wrongTimeRejected,
  fullContinuationComplete:false,originalDataUnchanged:report.originalDataUnchanged,existingRowsRowidsSchemaAndHeadsUnchanged:report.existingRowsRowidsSchemaAndHeadsUnchanged,
  sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,error:report.error??report.cleanupError??report.pinError??null}));
