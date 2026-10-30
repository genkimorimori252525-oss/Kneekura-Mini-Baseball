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
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-post-delivery-auth-v205-01'));
const inputPaths=['report.json','frontier.lossless.json','start-manifest.json'].map(name=>resolve(retained,name));
const inputBytes=inputPaths.map(path=>readFileSync(path)),inputPins=Object.fromEntries(inputPaths.map((path,i)=>[path,
  {exists:true,bytes:inputBytes[i].length,sha256:createHash('sha256').update(inputBytes[i]).digest('hex')}]));
const[proof,accepted]=inputBytes.map(bytes=>parseDebugRecord(bytes.toString('utf8')));
assert(proof.pass&&proof.nativePostDeliveryConsumerProven&&proof.resumeReady&&proof.allRowsRowidsSchemaAndHeadsUnchanged);
assert(proof.originalDataUnchanged&&proof.sourceAndBundleEndPinProven&&proof.harnessAndInputEndPinsProven);
assert.equal(proof.boundary,'NATIVE_POST_DELIVERY_ENTRY_AUTHENTICATION_ONLY');assert.deepEqual(accepted,proof.frontier);
assert.equal(accepted.resumeReady,true);assert.equal(accepted.nativeResumeAdapterRequired,false);assert.equal(accepted.fullContinuationComplete,false);
const original=resolve(proof.copyPath),destination=resolve(out,'delivery-forecast-private.sqlite');
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(key=>[key,accepted[key]]));
assert.equal(Object.keys(input.resumePins).length,7);assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const appendTables=['pa_lifecycle_v1_work_prefixes','pa_lifecycle_v1_total_assessments','pa_lifecycle_v1_execution_views',
  'pa_lifecycle_v1_execution_calibrations','batting_prediction_v1_predictions','batting_observation_v1_invocation_heads'];
const allowed=new Set(appendTables);
const report={pass:false,boundary:'NATIVE_DELIVERY_FORECAST_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,fullContinuationComplete:false,forecastAccepted:false,
  predictionAdmissionPerformed:false,deliveryRegenerated:false,officialTerminalProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.originalBefore=await databaseFiles(original);assert.deepEqual(dataPin(report.originalBefore),dataPin(proof.copyAfter));
  report.harnessPins={...inputPins};
  for(const path of['tools/verification/check-native-delivery-forecast-v206.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(root,path));
  for(const[path,pin]of Object.entries(inputPins))assert.deepEqual(await fileState(path),pin);
  digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-delivery-forecast-v206.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,
    harnessPins:report.harnessPins,originalBefore:report.originalBefore,input,appendTables,expectedAppendCounts:[1,10,1,32,1,1],stopBoundary:'NATIVE_FORECAST_ACCEPTED_BEFORE_LIFECYCLE_ADMISSION',
    constraints:['NEW_OWNED_SQLITE_BACKUP_ONLY','NO_OLD_SETUP_REGENERATION','ONLY_LIFECYCLE_AND_FORECAST_APPEND_EXISTING_HEADS_IMMUTABLE','LAN_ENTRY_AND_GUARDS_UNCHANGED','SENTINEL_IDENTITY_ONLY_OTHER_ERRORS_PROPAGATE']});
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);const through=Object.create(null);
  for(const table of appendTables.filter(table=>Object.hasOwn(before.tables,table))){const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;
  report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-delivery-forecast-v206.test.ts',
    '--testNamePattern','NF206-S01','--maxWorkers=1','--minWorkers=1'],{cwd:root,windowsHide:true,
    env:{...process.env,BASEBALL_NATIVE_DELIVERY_FORECAST_V206_DATABASE:destination,BASEBALL_NATIVE_DELIVERY_FORECAST_V206_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_DELIVERY_FORECAST_V206_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;
  save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});
  await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'Native delivery/forecast checkpoint failed; inspect retained records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert(report.nativeSummary.pass);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert(frontier.nativePostDeliveryEntryAuthenticated&&frontier.deliveryAdmissionProven&&frontier.forecastAccepted&&frontier.forecastAfterFenceProven);
  assert.equal(frontier.nativePostForecastConsumerProven,false);assert.equal(frontier.resumeReady,false);assert.equal(frontier.nativeResumeAdapterRequired,true);
  assert.equal(frontier.normalLifecycleAdvances,1);assert.equal(frontier.forecastAwaitingLifecycleAdmission,true);
  assert.equal(frontier.finalLifecycleCurrentProven,false);assert.equal(frontier.fullContinuationComplete,false);assert.equal(frontier.predictionAdmissionPerformed,false);
  assert.equal(frontier.deliveryRegenerated,false);assert.equal(frontier.physicalHeadUnchanged,true);assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut6:view');
  assert.equal(Object.keys(frontier.resumePins).length,8);for(const[key,value]of Object.entries(input.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  assert.deepEqual(frontier.resumePins.forecastReference,frontier.forecastReference);assert.deepEqual(frontier.eventReferences,[...input.eventReferences,input.resumePins.deliveryReference]);
  assert.deepEqual(frontier.finalHistorical.view.cut.operationReference,input.resumePins.deliveryReference);
  assert.deepEqual(frontier.finalHistorical.view.cut.physicalOperationReference,input.resumePins.deliveryCutReference);
  assert.deepEqual(frontier.forecast.source.viewReference,frontier.finalViewReference);assert.deepEqual(frontier.forecast.source.deliveryReference,input.resumePins.deliveryReference);
  assert.deepEqual(frontier.forecast.source.observationReference,input.resumePins.observationReference);
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through);save('after-logical-with-rowid.json',after);
  for(const old of before.catalog)assert.deepEqual(after.catalog.find(row=>row.type===old.type&&row.name===old.name),old,'existing schema changed: '+old.name);
  report.catalogAdded=after.catalog.filter(row=>!before.catalog.some(old=>row.type===old.type&&row.name===old.name));for(const added of report.catalogAdded)assert(allowed.has(added.tbl_name));
  for(const[table,old]of Object.entries(before.tables))assert.deepEqual(prior.tables[table],old,'existing row/rowid/head changed: '+table);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));for(const table of report.changedTables)assert(allowed.has(table),'unexpected changed table: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,(after.tables[table]?.rows??0)-(before.tables[table]?.rows??0)]));
  assert.deepEqual(report.appendedRows,{pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,pa_lifecycle_v1_execution_views:1,
    pa_lifecycle_v1_execution_calibrations:32,batting_prediction_v1_predictions:1,batting_observation_v1_invocation_heads:1});
  target.exec('ROLLBACK');target.close();target=null;report.existingRowsRowidsSchemaAndHeadsUnchanged=true;report.forecastAccepted=true;report.resumeReady=false;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.originalAfter=await databaseFiles(original);report.copyAfter=await databaseFiles(destination);assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));report.originalDataUnchanged=true;
    report.bundles=[];
    for(const pinned of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});const pins={};
      for(const[path,pin]of Object.entries(pinned.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});pins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:pinned===digestBundle,inputCount:pinned.inputCount,sha256:pinned.sha256,sourcePins:pins});}
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,forecastAccepted:report.forecastAccepted,resumeReady:report.resumeReady,
  existingRowsRowidsSchemaAndHeadsUnchanged:report.existingRowsRowidsSchemaAndHeadsUnchanged,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
