import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { isAbsolute,relative,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { databaseFiles,fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord,stringifyDebugRecord } from './live-debug-record.mjs';

const root=process.cwd(),retained=resolve(process.argv[2]??''),archivedDriver=resolve(process.argv[3]??''),out=resolve(process.argv[4]??'');
const rel=relative(root,out);
assert(process.argv.length===5&&rel&&!rel.startsWith('..')&&!isAbsolute(rel));
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-field-delivery-v204-01'));
assert.equal(archivedDriver,resolve('work/native-delivery-v204-executed-driver.mjs'));
assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const persisted=value=>parseDebugRecord(stringifyDebugRecord(value));
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const paths=['report.json','start-manifest.json','frontier.lossless.json','original-logical-with-rowid.json',
  'observed-logical-with-rowid.json','physical-heads-before.lossless.json','physical-heads-after.lossless.json',
  'records/summary.json','records/frontier.lossless.json','vitest.log'].map(name=>resolve(retained,name));
paths.push(resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_698e12aaf8a64ce199ad35944cf6e2ff.json'));
const values=new Map(),pins={};
for(const path of paths){const bytes=readFileSync(path);pins[path]={exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  if(!path.endsWith('vitest.log'))values.set(path,parseDebugRecord(bytes.toString('utf8')));}
const load=name=>values.get(resolve(retained,name));
const failed=load('report.json'),manifest=load('start-manifest.json'),frontier=load('frontier.lossless.json');
const receipt=values.get(paths.at(-1));
const oldOutput=resolve(receipt.output_path),oldOutputBytes=readFileSync(oldOutput);
pins[oldOutput]={exists:true,bytes:oldOutputBytes.length,sha256:createHash('sha256').update(oldOutputBytes).digest('hex')};
assert.equal(receipt.result,'FAIL');assert.equal(receipt.exit_code,1);
assert.equal(failed.pass,false);assert.equal(failed.nativeTestExit.code,0);assert.equal(failed.nativeTestExit.signal,null);
assert.equal(failed.nativeSummary.pass,true);assert.equal(load('records/summary.json').pass,true);
assert.equal(failed.boundary,'NATIVE_FIXTURE_DELIVERY_CHECKPOINT_ONLY');
assert(failed.error.includes('check-native-field-delivery-v204.mjs:93:10')&&failed.error.includes('[Object: null prototype]'));
assert.equal(failed.cleanupError,undefined);assert.equal(failed.pinError,undefined);
assert(failed.sourceAndBundleEndPinProven&&failed.harnessAndInputEndPinsProven&&failed.originalDataUnchanged);
assert.deepEqual(failed.frontier,frontier);assert.deepEqual(load('records/frontier.lossless.json'),frontier);
assert(frontier.deliveryCheckpointProven&&frontier.deliveryAfterFenceProven&&frontier.deliveryAccepted&&frontier.deliveryAwaitingLifecycleAdmission);
assert.equal(frontier.fullContinuationComplete,false);assert.equal(frontier.finalLifecycleCurrentProven,false);
assert.equal(frontier.resumeReady,false);assert.equal(frontier.nativePostDeliveryConsumerProven,false);assert.equal(frontier.nativeResumeAdapterRequired,true);
assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut5:view');
assert.deepEqual(frontier.finalHistorical.view.cut.physicalOperationReference,frontier.resumePins.deliveryCutReference);
assert.deepEqual(frontier.delivery.source.viewReference,frontier.finalViewReference);
assert.deepEqual(frontier.delivery.source.observationReference,manifest.input.resumePins.observationReference);
const driver='tools/verification/check-native-field-delivery-v204.mjs';
assert.deepEqual(await fileState(archivedDriver),failed.harnessPins[driver]);
const oldDriverBytes=readFileSync(archivedDriver),currentDriverBytes=readFileSync(resolve(driver));
const bytePin=bytes=>({exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
assert.deepEqual(bytePin(oldDriverBytes),failed.harnessPins[driver]);
const oldDriver=oldDriverBytes.toString('utf8'),currentDriver=currentDriverBytes.toString('utf8');
const oldOpen='assert.deepEqual(afterHead[0],{...beforeHead[0],operation_ordinal:beforeHead[0].operation_ordinal+1n,';
const newOpen='assert.deepEqual(afterHead[0],Object.assign(Object.create(Object.getPrototypeOf(beforeHead[0])),beforeHead[0],{operation_ordinal:beforeHead[0].operation_ordinal+1n,';
const oldClose='last_snapshot_hash:frontier.resumePins.deliveryCutReference.snapshotHash});report.onlyExpectedPhysicalHeadUpdated=true;';
const newClose='last_snapshot_hash:frontier.resumePins.deliveryCutReference.snapshotHash}));report.onlyExpectedPhysicalHeadUpdated=true;';
assert.equal(oldDriver.split(oldOpen).length,2);assert.equal(oldDriver.split(oldClose).length,2);
assert.equal(currentDriver,oldDriver.replace(oldOpen,newOpen).replace(oldClose,newClose));
pins[archivedDriver]=failed.harnessPins[driver];pins[resolve(driver)]=bytePin(currentDriverBytes);
pins[resolve('tools/verification/check-native-field-delivery-retained-v204.mjs')]=await fileState(resolve('tools/verification/check-native-field-delivery-retained-v204.mjs'));
const appendTables=['pa_lifecycle_v1_work_prefixes','pa_lifecycle_v1_total_assessments','pa_lifecycle_v1_execution_views',
  'pa_lifecycle_v1_execution_calibrations','pa_physical_v1_cuts','batting_observation_v1_deliveries','batting_observation_v1_invocation_heads'];
const mutableTables=['pa_physical_v1_heads'],allowed=new Set([...appendTables,...mutableTables]);
assert.deepEqual(manifest.appendTables,appendTables);assert.deepEqual(manifest.mutableTables,mutableTables);
const before=load('original-logical-with-rowid.json'),through=Object.fromEntries(Object.entries(failed.priorAppendRowidThrough).map(([key,value])=>[key,BigInt(value)]));
const physicalHeads=db=>{const query=db.prepare('SELECT rowid AS native_rowid,* FROM main.pa_physical_v1_heads ORDER BY rowid');query.setReadBigInts(true);return query.all();};
const persistedHeads=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,
  typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
const report={pass:false,boundary:'NATIVE_FIXTURE_DELIVERY_RETAINED_VERIFICATION_ONLY',execution:'READONLY_RETAINED_NATIVE_RESULT',
  nativeRunRepeated:0,newAccepts:0,closureBundleExecuted:false,digestBundleExecuted:false,originalFailedReceipt:paths.at(-1),originalNativeCasePassed:true,
  copyPath:failed.copyPath,originalPath:failed.originalPath,frontier,fullContinuationComplete:false,resumeReady:false,
  nativePostDeliveryConsumerProven:false,nativeResumeAdapterRequired:true,privateArtifactNotForPublication:true};
let source,target;
const pinSources=async()=>{
  for(const pinned of[manifest.bundle,manifest.digestBundle]){
    assert.deepEqual(await fileState(pinned.bundlePath),{exists:true,bytes:pinned.bytes,sha256:pinned.sha256});
    for(const[path,pin]of Object.entries(pinned.sourcePins))assert.deepEqual(await fileState(resolve(root,path)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});}
  for(const[path,pin]of Object.entries(failed.harnessPins))if(path!==driver)assert.deepEqual(await fileState(resolve(root,path)),pin);
  for(const[path,pin]of Object.entries(pins))assert.deepEqual(await fileState(path),pin);
};
try{
  await pinSources();
  report.originalBefore=await databaseFiles(failed.originalPath);report.copyBefore=await databaseFiles(failed.copyPath);
  assert.deepEqual(dataPin(report.originalBefore),dataPin(failed.originalAfter));assert.deepEqual(dataPin(report.copyBefore),dataPin(failed.copyAfter));
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,nativeRunRepeated:0,closureBundleExecuted:false},
    reason:'COMPLETE_RETAINED_DELIVERY_PRESERVATION_CHECKS_AFTER_SQLITE_ROW_PROTOTYPE_ASSERTION_FAILURE',
    originalFailedReceipt:report.originalFailedReceipt,inputPins:pins,originalBefore:report.originalBefore,copyBefore:report.copyBefore,
    originalBundle:manifest.bundle,digestBundle:manifest.digestBundle,originalHarnessPins:failed.harnessPins,
    prototypeOnlyDriverChangeProven:true,appendTables,mutableTables});
  const digest=(await import(pathToFileURL(manifest.digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  report.digestBundleExecuted=true;
  source=new DatabaseSync(failed.originalPath,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');
  assert.deepEqual(persisted(digest(source)),before);const headsBefore=physicalHeads(source);
  assert.deepEqual(persistedHeads(headsBefore),load('physical-heads-before.lossless.json'));
  target=new DatabaseSync(failed.copyPath,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');
  const after=digest(target),prior=digest(target,through),headsAfter=physicalHeads(target);
  assert.deepEqual(persisted(after),load('observed-logical-with-rowid.json'));
  assert.deepEqual(persistedHeads(headsAfter),load('physical-heads-after.lossless.json'));
  const enrollment=manifest.enrollmentSourceId;
  assert.deepEqual(headsAfter.filter(row=>row.enrollment_source_id!==enrollment),headsBefore.filter(row=>row.enrollment_source_id!==enrollment));
  const oldHead=headsBefore.filter(row=>row.enrollment_source_id===enrollment),newHead=headsAfter.filter(row=>row.enrollment_source_id===enrollment);
  assert.equal(oldHead.length,1);assert.equal(newHead.length,1);
  assert.equal(oldHead[0].last_owner,manifest.input.resumePins.captureCutReference.owner);
  assert.equal(oldHead[0].last_source_id,manifest.input.resumePins.captureCutReference.sourceId);
  assert.equal(oldHead[0].last_snapshot_hash,manifest.input.resumePins.captureCutReference.snapshotHash);
  const expected=Object.assign(Object.create(Object.getPrototypeOf(oldHead[0])),oldHead[0],{
    operation_ordinal:oldHead[0].operation_ordinal+1n,last_owner:frontier.resumePins.deliveryCutReference.owner,
    last_source_id:frontier.resumePins.deliveryCutReference.sourceId,last_snapshot_hash:frontier.resumePins.deliveryCutReference.snapshotHash});
  assert.deepEqual(newHead[0],expected);report.onlyExpectedPhysicalHeadUpdated=true;
  for(const old of before.catalog)assert.deepEqual(persisted(after.catalog.find(row=>row.type===old.type&&row.name===old.name)),old);
  report.catalogAdded=after.catalog.filter(row=>!before.catalog.some(old=>row.type===old.type&&row.name===old.name));
  for(const added of report.catalogAdded)assert(allowed.has(added.tbl_name));
  for(const[table,old]of Object.entries(before.tables))if(!mutableTables.includes(table))assert.deepEqual(persisted(prior.tables[table]),old,'old row/rowid/head changed: '+table);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(persisted(after.tables[table]))!==JSON.stringify(before.tables[table]));
  for(const table of report.changedTables)assert(allowed.has(table),'unexpected table: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,(after.tables[table]?.rows??0)-(before.tables[table]?.rows??0)]));
  assert.deepEqual(report.appendedRows,{pa_lifecycle_v1_work_prefixes:1,pa_lifecycle_v1_total_assessments:10,pa_lifecycle_v1_execution_views:1,
    pa_lifecycle_v1_execution_calibrations:32,pa_physical_v1_cuts:1,batting_observation_v1_deliveries:1,batting_observation_v1_invocation_heads:1});
  report.existingImmutableRowsRowidsSchemaAndHeadsUnchanged=true;report.deliveryCheckpointProven=true;report.deliveryAfterFenceProven=true;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    if(report.originalBefore){report.originalAfter=await databaseFiles(failed.originalPath);report.copyAfter=await databaseFiles(failed.copyPath);
      assert.deepEqual(dataPin(report.originalAfter),dataPin(report.originalBefore));assert.deepEqual(dataPin(report.copyAfter),dataPin(report.copyBefore));
      report.originalDataUnchanged=true;report.retainedTargetDataUnchanged=true;}
    await pinSources();report.sourceAndBundleEndPinProven=true;report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('retained-input-pins.json',pins);save('frontier.lossless.json',frontier);save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,nativeRunRepeated:0,deliveryCheckpointProven:report.deliveryCheckpointProven,
  existingImmutableRowsRowidsSchemaAndHeadsUnchanged:report.existingImmutableRowsRowidsSchemaAndHeadsUnchanged,
  sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,error:report.error??report.cleanupError??report.pinError??null}));
