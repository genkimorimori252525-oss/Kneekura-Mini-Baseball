import assert from 'node:assert/strict';
import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getHeapStatistics } from 'node:v8';
import { DatabaseSync, backup } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const root=process.cwd(), retained=resolve(process.argv[2]??''), out=resolve(process.argv[3]??''), rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'V198 preparation proof directory and new workspace output required');
const proofPath=resolve(retained,'report.json'), frontierPath=resolve(retained,'frontier.lossless.json'), manifestPath=resolve(retained,'start-manifest.json');
const proof=parseDebugRecord(readFileSync(proofPath,'utf8')), preparation=parseDebugRecord(readFileSync(frontierPath,'utf8'));
assert(proof.pass&&proof.originalDataUnchanged&&proof.existingRowsRowidAndCatalogUnchanged&&proof.sourceAndBundleEndPinProven&&proof.onlyThreePreparationAppendTablesChanged);
assert.deepEqual(preparation,proof.frontier);
assert(preparation.currentLifecycleProven&&preparation.nextPitchBasisProven&&preparation.unlaunched&&preparation.originalActorValuesExact);
const original=resolve(proof.copyPath), destination=resolve(out,'field-continuation-private.sqlite');
const input={retainedInputReferences:preparation.retainedInputReferences,calibrationReference:preparation.calibrationReference,
  bodyModelReference:preparation.bodyModelReference,batterBodyReference:preparation.matchDayBatterPreparation.reference,
  futureProfileDeclarationOnly:preparation.futureProfileDeclarationOnly};
assert(existsSync(original));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const appendTables=['pa_lifecycle_v1_work_prefixes','pa_lifecycle_v1_total_assessments','pa_lifecycle_v1_execution_views','pa_lifecycle_v1_execution_calibrations',
  'pa_physical_v1_cuts','pa_physical_v1_launches','pa_physical_v1_pitch_consumers','pa_physical_v1_consumptions','pa_physical_v1_admissions'];
const mutableTables=['pa_physical_v1_heads'];
const allowed=new Set([...appendTables,...mutableTables]);
const report={pass:false,boundary:'NATIVE_FIXTURE_FIRST_CAPTURE_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,changeReason:'BOUNDED_NORMAL_LAUNCH_ADVANCE_CAPTURE_CHECKPOINT_FROM_ACCEPTED_V198_PREPARATION',
  fullContinuationComplete:false,fieldRootAccepted:false,resolutionAccepted:false,
  secondNativeControlBranchProven:false,officialTerminalProven:false,wholeRngConsumptionProven:false,productionMasteryCalibrationProven:false,
  naturalGoldRarityProven:false,privateArtifactNotForPublication:true,stages:[]};
const stage=(name,value)=>{const s={name,at:new Date().toISOString(),memory:process.memoryUsage(),heapLimitBytes:getHeapStatistics().heap_size_limit};
  report.stages.push(s);save('stage-'+report.stages.length+'.json',s);
  if(value!==undefined)save('checkpoint-'+report.stages.length+'-'+name+'.lossless.json',value);console.log(JSON.stringify(s));};
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
let source,target,bundle,digestBundle;
try{
  report.originalBefore=await databaseFiles(original);assert.deepEqual(dataPin(report.originalBefore),dataPin(proof.copyAfter),'V198 preparation data changed');
  report.harnessPins={};
  for(const path of [proofPath,frontierPath,manifestPath,'tools/verification/check-native-field-continuation-v199.mjs',
    'tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-field-continuation-v199.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);
  report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  save('start-manifest.json',{runtime:{execution:report.execution,nodeVersion:process.version,closureBundleExecuted:false},bundle,digestBundle,harnessPins:report.harnessPins,
    originalBefore:report.originalBefore,input,appendTables,mutableTables,
    stopBoundary:'FIRST_CAPTURE_ACCEPTED_CURRENT_AND_NOT_YET_ADMITTED_IN_LIFECYCLE',
    constraints:['NEW_OWNED_SQLITE_BACKUP_ONLY','ORIGINAL_PRACTICE_TAKE_BODY_MODEL_CALIBRATION_IMMUTABLE','PROSPECTIVE_PROFILE_UNCHANGED_AND_NOT_APPLIED_TO_A_NEW_FIELD_ROOT',
      'NORMAL_RIGHT_LAUNCH_ONE_ADVANCE_AND_CAPTURE_ONLY','NO_COMMITMENT_RESOLUTION_FIELD_OR_OFFICIAL','PRESERVE_ALL_OLD_IMMUTABLE_ROWS_ROWIDS_AND_SCHEMA']});
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');
  const before=digest(source);save('original-logical-with-rowid.json',before);const through=Object.create(null);
  for(const table of appendTables.filter(table=>Object.hasOwn(before.tables,table))){
    const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();
    assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;
  }
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;
  report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);
  target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);stage('consistent-owned-copy-authenticated');
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-field-continuation-v199.test.ts',
    '--testNamePattern','NF199-S02','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,
    env:{...process.env,BASEBALL_NATIVE_FIELD_V199_DATABASE:destination,BASEBALL_NATIVE_FIELD_V199_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_FIELD_V199_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;
  stage('original-source-native-runtime-started',{processId:child.pid,recordsPath:records});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>done({code,signal}));});
  await new Promise(done=>output.end(done));report.nativeTestExit=exit;
  assert.equal(exit.code,0,'Native continuation failed; inspect retained records and vitest.log');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert(report.nativeSummary.pass);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert(frontier.currentCaptureProven&&frontier.precedingLifecycleAuthenticated&&frontier.resumeReady&&frontier.launchAdvanceCompleted);
  assert.equal(frontier.captureAwaitingLifecycleAdmission,true);assert.equal(frontier.fullContinuationComplete,false);
  assert.equal(frontier.fieldRootAccepted,false);assert.equal(frontier.resolutionAccepted,false);
  assert.equal(frontier.newPracticeAccepted,0);assert.equal(frontier.twoTakeReplayed,false);
  assert.equal(frontier.prospectiveProfileAdjustedAfterOutcome,false);
  assert.deepEqual(frontier.retainedInputReferences,input);
  assert.deepEqual(frontier.captureCut.source.launchReference,frontier.launchReference);
  assert.deepEqual(frontier.captureCut.source.previousOperationReference,frontier.launchReference);
  assert.equal(frontier.captureCut.evaluationTick,frontier.launch.evaluationTick+50_000);
  assert.deepEqual(frontier.resumePins,{postureReference:input.retainedInputReferences.postureReference,intentReference:input.retainedInputReferences.intentReference,
    launchReference:frontier.launchReference,captureCutReference:frontier.captureCutReference});
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');
  const after=digest(target),prior=digest(target,through);save('continued-logical-with-rowid.json',after);
  for(const old of before.catalog)assert.deepEqual(after.catalog.find(row=>row.type===old.type&&row.name===old.name),old,'existing schema entry changed: '+old.name);
  report.catalogAdded=after.catalog.filter(row=>!before.catalog.some(old=>row.type===old.type&&row.name===old.name));
  for(const added of report.catalogAdded)assert(allowed.has(added.tbl_name),'unexpected new schema entry: '+added.name);
  for(const [table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(prior.tables[table],old,'existing immutable owner row or rowid changed: '+table);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));
  for(const table of report.changedTables)assert(allowed.has(table),'unexpected changed table: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,(after.tables[table]?.rows??0)-(before.tables[table]?.rows??0)]));
  assert.deepEqual(report.appendedRows,{pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,pa_lifecycle_v1_execution_views:1,
    pa_lifecycle_v1_execution_calibrations:32,pa_physical_v1_cuts:1,pa_physical_v1_launches:1,
    pa_physical_v1_pitch_consumers:1,pa_physical_v1_consumptions:1,pa_physical_v1_admissions:1});
  target.exec('ROLLBACK');target.close();target=null;
  report.allowedAppendTables=appendTables;report.allowedMutableTables=mutableTables;report.existingImmutableRowsRowidsAndSchemaUnchanged=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}
    catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.originalAfter=await databaseFiles(original);report.copyAfter=await databaseFiles(destination);
    assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));report.originalDataUnchanged=true;
    report.shmObservation={before:report.originalBefore['-shm'],afterBackup:report.originalAfterBackup?.['-shm'],after:report.originalAfter['-shm']};
    report.bundles=[];
    for(const pinned of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});const pins={};
      for(const[path,pin]of Object.entries(pinned.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});pins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:pinned===digestBundle,inputCount:pinned.inputCount,sha256:pinned.sha256,sourcePins:pins});}
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,currentCaptureProven:report.frontier?.currentCaptureProven,resumeReady:report.frontier?.resumeReady,
  fullContinuationComplete:report.fullContinuationComplete,originalDataUnchanged:report.originalDataUnchanged,
  existingImmutableRowsRowidsAndSchemaUnchanged:report.existingImmutableRowsRowidsAndSchemaUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
