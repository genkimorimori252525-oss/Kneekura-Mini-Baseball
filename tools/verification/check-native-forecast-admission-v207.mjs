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
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel));
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-delivery-forecast-v206-01'));
assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const persisted=value=>parseDebugRecord(stringifyDebugRecord(value));
const inputPins={};
const readPinned=path=>{const bytes=readFileSync(path);inputPins[path]={exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};return parseDebugRecord(bytes.toString('utf8'));};
const retainedCase=(key,dir)=>{
  const proof=readPinned(resolve(dir,'report.json')),frontier=readPinned(resolve(dir,'frontier.lossless.json'));
  readPinned(resolve(dir,'start-manifest.json'));assert(proof.pass&&proof.originalDataUnchanged&&proof.sourceAndBundleEndPinProven&&proof.harnessAndInputEndPinsProven);
  assert.deepEqual(frontier,proof.frontier);
  return{key,proof,frontier,original:resolve(proof.copyPath),destination:resolve(out,key+'-private.sqlite'),input:Object.fromEntries(
    ['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(name=>[name,frontier[name]]))};
};
const main=retainedCase('forecast-admission',retained);
const legacy=retainedCase('legacy-delivery-auth',resolve('docs/verification/realism-debug-20261027/native-field-delivery-retained-v204-01'));
const reader=retainedCase('original-input-reader',resolve('docs/verification/realism-debug-20261027/native-post-delivery-auth-v205-01'));
assert.equal(main.proof.boundary,'NATIVE_DELIVERY_FORECAST_CHECKPOINT_ONLY');assert(main.proof.existingRowsRowidsSchemaAndHeadsUnchanged&&main.proof.forecastAccepted);
assert.equal(main.frontier.resumeReady,false);assert.equal(main.frontier.forecastAwaitingLifecycleAdmission,true);
assert.equal(legacy.proof.boundary,'NATIVE_FIXTURE_DELIVERY_RETAINED_VERIFICATION_ONLY');assert(legacy.proof.existingImmutableRowsRowidsSchemaAndHeadsUnchanged&&legacy.proof.retainedTargetDataUnchanged);
assert.equal(reader.proof.boundary,'NATIVE_POST_DELIVERY_ENTRY_AUTHENTICATION_ONLY');assert(reader.proof.allRowsRowidsSchemaAndHeadsUnchanged&&reader.frontier.resumeReady);
const original206Input=readPinned(resolve(retained,'execution-input.lossless.json'));assert.deepEqual(reader.input,original206Input);
const cases=[main,legacy,reader];
const appendTables=['pa_lifecycle_v1_work_prefixes','pa_lifecycle_v1_total_assessments','pa_lifecycle_v1_execution_views','pa_lifecycle_v1_execution_calibrations'];
const report={pass:false,boundary:'NATIVE_FORECAST_ADMISSION_AND_RESUME_ONLY',execution:'VITEST_ORIGINAL_SOURCE_ENTRIES',closureBundlesExecuted:false,
  fullContinuationComplete:false,scoreAccepted:false,emotionAccepted:false,officialTerminalProven:false,performancePass:false,
  privateArtifactNotForPublication:true,compatibilityReason:'SHARED_NATIVE_RESUME_AND_ORIGINAL_INPUT_READER_SOURCE_CHANGED',cases:[]};
let source,target,digestBundle,newBundle,legacyBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  for(const c of cases){c.originalBefore=await databaseFiles(c.original);assert.deepEqual(dataPin(c.originalBefore),dataPin(c.proof.copyAfter));}
  report.harnessPins={...inputPins};
  for(const path of['tools/verification/check-native-forecast-admission-v207.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(path));
  for(const[path,pin]of Object.entries(inputPins))assert.deepEqual(await fileState(path),pin);
  for(const c of cases){c.inputPath=resolve(out,c.key+'-input.lossless.json');save(c.key+'-input.lossless.json',c.input);report.harnessPins[c.inputPath]=await fileState(c.inputPath);}
  const readerBaseline=resolve(out,'original-input-reader-baseline.lossless.json');save('original-input-reader-baseline.lossless.json',main.frontier);report.harnessPins[readerBaseline]=await fileState(readerBaseline);
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  newBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-forecast-admission-v207.test.ts',outputPath:resolve(out,'new-source-closure-not-executed.mjs')});
  legacyBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-post-delivery-auth-v205.test.ts',outputPath:resolve(out,'legacy-source-closure-not-executed.mjs')});
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundlesExecuted:false},digestBundle,newBundle,legacyBundle,
    harnessPins:report.harnessPins,cases:cases.map(c=>({key:c.key,original:c.original,destination:c.destination,originalBefore:c.originalBefore,input:c.input})),
    expectedMainAppendCounts:[1,10,1,32],appendTables,compatibilityReason:report.compatibilityReason,
    constraints:['THREE_ISOLATED_OWNED_SQLITE_BACKUPS','NO_OLD_SETUP_OR_FORECAST_REGENERATION','NORMAL_CUT7_AND_PERSISTED_CAL32_REQUIRED',
      'NO_CALLER_BOOLEAN_ADMISSION_BYPASS','LEGACY7PIN_FULL_FRONTIER_EXACT','COMMON_READER_ALL_RETURN_FIELDS_EXACT','NO_SCORE_OR_LATER_ACCEPT']});
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  for(const c of cases){
    source=new DatabaseSync(c.original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');c.before=digest(source);save(c.key+'-before-logical-with-rowid.json',c.before);c.through=Object.create(null);
    if(c===main)for(const table of appendTables){assert(Object.hasOwn(c.before.tables,table));const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);c.through[table]=row.hi??0n;}
    assert(!existsSync(c.destination));closeSync(openSync(c.destination,'wx'));c.backupPages=await backup(source,c.destination,{source:'main',target:'main'});
    source.exec('ROLLBACK');source.close();source=null;c.originalAfterBackup=await databaseFiles(c.original);assert.deepEqual(dataPin(c.originalAfterBackup),dataPin(c.originalBefore));
    target=new DatabaseSync(c.destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),c.before);target.exec('ROLLBACK');target.close();target=null;c.copyBefore=await databaseFiles(c.destination);
    save(c.key+'-backup-authenticated.json',{originalAfterBackup:c.originalAfterBackup,copyBefore:c.copyBefore,backupPages:c.backupPages});
  }
  const mainRecords=resolve(out,'main-records'),legacyRecords=resolve(out,'legacy-records'),readerRecords=resolve(out,'reader-records');
  const output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-forecast-admission-v207.test.ts','tools/verification/native-post-delivery-auth-v205.test.ts',
    '--testNamePattern','(?:NF207-S0[12]|NP205-S01)','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,env:{...process.env,
    BASEBALL_NATIVE_FORECAST_ADMISSION_V207_DATABASE:main.destination,BASEBALL_NATIVE_FORECAST_ADMISSION_V207_INPUT:main.inputPath,BASEBALL_NATIVE_FORECAST_ADMISSION_V207_OUTPUT:mainRecords,
    BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_DATABASE:reader.destination,BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_INPUT:reader.inputPath,
    BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_BASELINE:readerBaseline,BASEBALL_NATIVE_FORECAST_ADMISSION_V207_COMPAT_OUTPUT:readerRecords,
    BASEBALL_NATIVE_POST_DELIVERY_AUTH_V205_DATABASE:legacy.destination,BASEBALL_NATIVE_POST_DELIVERY_AUTH_V205_INPUT:legacy.inputPath,BASEBALL_NATIVE_POST_DELIVERY_AUTH_V205_OUTPUT:legacyRecords}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;save('native-process.json',{processId:child.pid,at:new Date().toISOString(),cases:3});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});await new Promise(done=>output.end(done));report.nativeTestExit=exit;
  assert.equal(exit.code,0,'Native forecast admission or compatibility case failed; inspect retained records');
  for(const dir of[mainRecords,legacyRecords,readerRecords])assert(parseDebugRecord(readFileSync(resolve(dir,'summary.json'),'utf8')).pass);
  const frontier=parseDebugRecord(readFileSync(resolve(mainRecords,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert(frontier.predictionAdmissionProven&&frontier.postAdmissionEntryReauthenticated&&frontier.finalLifecycleCurrentProven&&frontier.nativePostForecastConsumerProven&&frontier.resumeReady);
  assert.equal(frontier.pendingEntryAuthenticated,true);assert.equal(frontier.missingCalibrationRejected,true);
  assert.equal(frontier.nativeResumeAdapterRequired,false);assert.equal(frontier.normalLifecycleAdvances,1);assert.equal(frontier.fullContinuationComplete,false);
  assert.equal(frontier.scoreAccepted,false);assert.equal(frontier.emotionAccepted,false);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut7:view');
  assert.deepEqual(frontier.resumePins,main.input.resumePins);assert.deepEqual(frontier.eventReferences,[...main.input.eventReferences,main.input.resumePins.forecastReference]);
  assert.deepEqual(frontier.finalCurrent.view.cut.operationReference,main.input.resumePins.forecastReference);
  assert.deepEqual(frontier.finalCurrent.view.cut.physicalOperationReference,main.input.resumePins.deliveryCutReference);
  assert.equal(frontier.calibrations.length,32);assert.equal(frontier.calibrationReferences.length,32);
  for(const calibration of frontier.calibrations)assert.deepEqual(calibration.source.viewReference,frontier.finalViewReference);
  const legacyFrontier=parseDebugRecord(readFileSync(resolve(legacyRecords,'frontier.lossless.json'),'utf8'));assert.deepEqual(legacyFrontier,reader.frontier,'legacy Native7pin frontier changed');report.legacy7PinFrontierExact=true;
  const common=parseDebugRecord(readFileSync(resolve(readerRecords,'original-inputs-common-reader.lossless.json'),'utf8'));
  const readerSummary=parseDebugRecord(readFileSync(resolve(readerRecords,'summary.json'),'utf8')),keys=Object.keys(common);assert(keys.length>0);assert.deepEqual(readerSummary.comparedFieldNames,keys);
  const expectedCommonFields=['action','posture','intent','model','fieldCalibration','bodyModel','batterBody','qualifications','acceptedAction',
    'dispatchCalibrationIds','genesis','world','physicalHead','observationHead','deliveryHead'];
  assert.deepEqual([...keys].sort(),[...expectedCommonFields].sort(),'common reader must preserve every original field');
  for(const key of keys)assert(Object.hasOwn(main.frontier.originalInputs,key),'unexpected common input field: '+key);
  assert.deepEqual(persisted(common),persisted(Object.fromEntries(keys.map(key=>[key,main.frontier.originalInputs[key]]))));report.commonOriginalInputsExact=true;report.commonOriginalInputFields=keys;
  for(const c of cases){
    target=new DatabaseSync(c.destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target);save(c.key+'-after-logical-with-rowid.json',after);
    if(c===main){
      const prior=digest(target,c.through);assert.deepEqual(after.catalog,c.before.catalog,'schema changed');
      for(const[table,old]of Object.entries(c.before.tables))assert.deepEqual(prior.tables[table],old,'old row/rowid/head changed: '+table);
      c.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(c.before.tables[table]));for(const table of c.changedTables)assert(appendTables.includes(table));
      c.appendedRows=Object.fromEntries(appendTables.map(table=>[table,after.tables[table].rows-c.before.tables[table].rows]));
      assert.deepEqual(c.appendedRows,{pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,pa_lifecycle_v1_execution_views:1,pa_lifecycle_v1_execution_calibrations:32});
      report.appendedRows=c.appendedRows;report.existingRowsRowidsSchemaAndHeadsUnchanged=true;
    }else assert.deepEqual(after,c.before,c.key+' compatibility case mutated data');
    target.exec('ROLLBACK');target.close();target=null;c.logicalVerificationProven=true;
  }
  report.resumeReady=true;report.predictionAdmissionProven=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    for(const c of cases){c.originalAfter=await databaseFiles(c.original);assert.deepEqual(dataPin(c.originalAfter),dataPin(c.originalBefore));c.copyAfter=await databaseFiles(c.destination);
      report.cases.push({key:c.key,original:c.original,copyPath:c.destination,originalBefore:c.originalBefore,originalAfter:c.originalAfter,copyBefore:c.copyBefore,copyAfter:c.copyAfter,
        logicalVerificationProven:c.logicalVerificationProven??false,changedTables:c.changedTables??[],appendedRows:c.appendedRows??{}});}
    report.originalDataUnchanged=true;report.copyPath=main.destination;report.copyAfter=main.copyAfter;report.bundles=[];
    for(const pinned of[newBundle,legacyBundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});const pins={};
      for(const[path,pin]of Object.entries(pinned.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});pins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:pinned===digestBundle,inputCount:pinned.inputCount,sha256:pinned.sha256,sourcePins:pins});}
    report.sourceAndBundleEndPinProven=!!newBundle&&!!legacyBundle&&!!digestBundle;
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,predictionAdmissionProven:report.predictionAdmissionProven,resumeReady:report.resumeReady,
  legacy7PinFrontierExact:report.legacy7PinFrontierExact,commonOriginalInputsExact:report.commonOriginalInputsExact,
  existingRowsRowidsSchemaAndHeadsUnchanged:report.existingRowsRowidsSchemaAndHeadsUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
