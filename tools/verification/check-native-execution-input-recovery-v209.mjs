import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { closeSync,createWriteStream,existsSync,mkdirSync,openSync,readFileSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute,relative,resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync,backup } from 'node:sqlite';
import { transform } from 'esbuild';
import { compilePinnedNativeEntry,databaseFiles,fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord,stringifyDebugRecord } from './live-debug-record.mjs';

const root=process.cwd(),retained=resolve(process.argv[2]??''),inventoryDir=resolve(process.argv[3]??''),out=resolve(process.argv[4]??''),rel=relative(root,out);
assert(process.argv.length===5&&rel&&!rel.startsWith('..')&&!isAbsolute(rel),'failed V208, verified readonly inventory, new output required');
assert.equal(retained,resolve('docs/verification/realism-debug-20261027/native-execution-input-v208-01'));
assert.equal(inventoryDir,resolve('work/native-input-recovery-inventory-v209-01'));
const pins={};
const bytesPin=bytes=>({exists:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
const readPinned=path=>{const bytes=readFileSync(path);pins[path]=bytesPin(bytes);return parseDebugRecord(bytes.toString('utf8'));};
const parentManifestPath=resolve(retained,'start-manifest.json'),parent=readPinned(parentManifestPath);
const failedReceiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_3acc21cde7c7453e8edb64989b4615a9.json');
const failedReceipt=readPinned(failedReceiptPath);assert.equal(failedReceipt.result,'FAIL');assert.equal(failedReceipt.exit_code,124);
const inventoryReport=readPinned(resolve(inventoryDir,'report.json')),inventory=readPinned(resolve(inventoryDir,'inventory.lossless.json'));
readPinned(resolve(inventoryDir,'start-manifest.json'));assert(inventoryReport.pass&&inventoryReport.dataUnchanged&&inventoryReport.endPinsProven);
assert.equal(inventoryReport.newAcceptedOperations,0);assert.deepEqual(inventoryReport.inventory,inventory);
assert.equal(inventory.viewReference.sourceId,'physical-fixture:cut9:view');assert.equal(inventory.calibrationCount,0);assert.equal(inventory.inputCount,0);
assert.equal(inventory.partialCalibrationSet,false);assert.equal(inventory.world.head.worldRevision,1);
const retainedInput=readPinned(resolve(retained,'execution-input.lossless.json'));assert.deepEqual(retainedInput,parent.input);
const checkpoint8=readPinned(resolve(retained,'records/checkpoint-11-normal-cut8-current-cal32-physical-world-checkpoint.lossless.json'));
const advance9=readPinned(resolve(retained,'records/checkpoint-13-advance-9-start.lossless.json'));
const originalRecord=readPinned(resolve(retained,'records/checkpoint-1-retained-current-cut7-and-original-inputs-authenticated.lossless.json'));
assert.equal(checkpoint8.finalLifecycleCurrentProven,true);assert.equal(checkpoint8.finalViewReference.sourceId,'physical-fixture:cut8:view');
assert.equal(checkpoint8.calibrations.length,32);assert.deepEqual(checkpoint8.retainedInputReferences,retainedInput.retainedInputReferences);
assert.equal(advance9.eventReferences.length,9);assert.deepEqual(inventory.current.view.cut.operationReference,advance9.eventReference);
const input={retainedInput,checkpoint8,advance9,inventory,originalObservationValues:originalRecord.observationValues};
const beforeHistory=readPinned(resolve(retained,'before-logical-with-rowid.json'));
const physicalHistory=readPinned(resolve(retained,'physical-heads-before.lossless.json')),worldHistory=readPinned(resolve(retained,'world-heads-before.lossless.json'));
const sourceProofPath=resolve('work/native-execution-input-v209-baseline/source-equivalence-proof.json'),sourceProof=readPinned(sourceProofPath);
readPinned(resolve('work/native-execution-input-v209-baseline/manifest.json'));
assert.equal(sourceProof.pass,true);assert.equal(sourceProof.generatedJavaScriptExecuted,false);assert.equal(sourceProof.databaseOpens,0);assert.equal(sourceProof.nativeOperations,0);
assert.equal(resolve(sourceProof.parentManifestPath),parentManifestPath);assert.deepEqual(sourceProof.parentManifestPin,pins[parentManifestPath]);
const approvedPaths=['src/host/world/SamePlateAppearanceLifecycleFixture.test-support.ts','src/host/world/InFlightBattingLifecycleFixture.test-support.ts'];
assert.deepEqual(sourceProof.sources.map(value=>value.sourcePath).sort(),[...approvedPaths].sort());
const approved=new Map();
for(const s of sourceProof.sources){
  const old=readFileSync(resolve(s.baselinePath)),current=readFileSync(resolve(s.sourcePath));
  const parentPin=parent.bundle.sourcePins[s.sourcePath];assert(parentPin);
  assert.deepEqual(bytesPin(old),{exists:true,bytes:parentPin.bytes,sha256:parentPin.sha256});assert.deepEqual(bytesPin(current),s.currentPin);
  pins[resolve(s.baselinePath)]=bytesPin(old);pins[resolve(s.sourcePath)]=bytesPin(current);
  approved.set(s.sourcePath,{...s,old,current});
}
const lifecycle=approved.get(approvedPaths[0]),inFlight=approved.get(approvedPaths[1]),factory=sourceProof.factory;
assert.equal(factory.name,'createSamePaLifecycleFixtureCalibrationSources');
const currentText=lifecycle.current.toString('utf8');assert.equal(currentText.split(factory.factoryBlock).length,2);assert.equal(currentText.split(factory.replacementCallBlock).length,2);
assert(Buffer.from(currentText.replace(factory.factoryBlock,'').replace(factory.replacementCallBlock,factory.originalCalibrationBlock),'utf8').equals(lifecycle.old),'pure factory extraction must inline to every original byte');
const annotation=sourceProof.genericDecisionCut;
assert.equal(inFlight.old.toString('utf8').split(annotation.oldTypeAnnotation).length,2);
assert.equal(inFlight.current.toString('utf8'),inFlight.old.toString('utf8').replace(annotation.oldTypeAnnotation,annotation.newTypeAnnotation));
const emitOptions={loader:'ts',format:'esm',target:'node26',sourcemap:false};
const[oldEmit,newEmit]=await Promise.all([transform(inFlight.old.toString('utf8'),emitOptions),transform(inFlight.current.toString('utf8'),emitOptions)]);
assert.equal(newEmit.code,oldEmit.code,'generic thin-context change must erase to identical JavaScript');
const original=resolve(inventoryReport.database),destination=resolve(out,'execution-input-recovered-private.sqlite');
assert.equal(original,resolve(retained,'execution-input-private.sqlite'));assert(existsSync(original));assert(!existsSync(out));mkdirSync(out,{recursive:false});
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const persisted=value=>parseDebugRecord(stringifyDebugRecord(value));
const dataPin=files=>Object.fromEntries(['main','-wal','-journal'].map(key=>[key,files[key]]));
const retainedDatabases=new Map(Object.entries(parent.retainedDataBefore).map(([path,pin])=>[resolve(path),pin]));retainedDatabases.set(original,inventoryReport.after);
assert.equal(retainedDatabases.size,Object.keys(parent.retainedDataBefore).length+1);
const appendCounts={pa_lifecycle_v1_execution_calibrations:32,batting_execution_v1_inputs:1},appendTables=Object.keys(appendCounts);
const historyAppendCounts=parent.appendCounts,historyTables=Object.keys(historyAppendCounts),mutableTables=parent.mutableTables;
assert.equal(Object.values(historyAppendCounts).reduce((sum,n)=>sum+n,0),94);assert.deepEqual(mutableTables,['pa_physical_v1_heads','world_control_heads']);
const orderedCatalog=rows=>rows.map(row=>[row.type,row.name,row.tbl_name,row.sql]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))||String(a[1]).localeCompare(String(b[1])));
const rawRows=(db,table)=>{const q=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');q.setReadBigInts(true);return q.all();};
const persistedRows=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key,typeof value==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(value)}:value])));
const restoreRows=rows=>rows.map(row=>Object.assign(Object.create(null),Object.fromEntries(Object.entries(row).map(([key,value])=>[key,
  value&&typeof value==='object'&&value.kind==='SQLITE_INTEGER'?BigInt(value.decimal):value]))));
const rowidThrough=before=>Object.fromEntries(historyTables.filter(table=>Object.hasOwn(before.tables,table)).map(table=>[table,BigInt(before.tables[table].rows)]));
const report={pass:false,boundary:'NATIVE_EXECUTION_INPUT_RECOVERY_CHECKPOINT_ONLY',originalPath:original,copyPath:destination,
  execution:'VITEST_ORIGINAL_SOURCE_ENTRY',closureBundleExecuted:false,failedV208Receipt:failedReceiptPath,failedV208Preserved:true,
  originalFailedRunCompleted:false,originalFailedRunEndPinsClaimed:false,parentSourcePatchProofRecomputed:true,
  normalLifecycleAdvances:0,fullContinuationComplete:false,executionInputAccepted:false,wholeRngConsumptionProven:false,
  commitmentAccepted:false,resolutionAccepted:false,fieldRootAccepted:false,officialTerminalProven:false,performancePass:false,privateArtifactNotForPublication:true};
let source,target,bundle,digestBundle;
const pinParent=async()=>{
  for(const p of[parent.bundle,parent.digestBundle]){
    assert.deepEqual(await fileState(p.bundlePath),{exists:true,bytes:p.bytes,sha256:p.sha256});
    for(const[path,pin]of Object.entries(p.sourcePins)){
      const s=approved.get(path);assert.deepEqual(await fileState(resolve(root,s?s.baselinePath:path)),{exists:true,bytes:pin.bytes,sha256:pin.sha256});}
  }
  for(const[path,pin]of Object.entries(parent.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  for(const[path,pin]of Object.entries(pins))assert.deepEqual(await fileState(resolve(root,path)),pin);
};
if(process.report){process.report.directory=out;process.report.reportOnFatalError=true;process.report.excludeEnv=true;}
try{
  report.retainedDataBefore={};for(const[path,pin]of retainedDatabases){const actual=await databaseFiles(path);assert.deepEqual(dataPin(actual),dataPin(pin));report.retainedDataBefore[path]=actual;}
  report.originalBefore=report.retainedDataBefore[original];report.harnessPins={...pins};
  for(const path of['tools/verification/check-native-execution-input-recovery-v209.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs'])report.harnessPins[path]=await fileState(resolve(path));
  await pinParent();digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest-bundle.mjs')});
  assert.equal(digestBundle.inputCount,1);assert.deepEqual(Object.keys(digestBundle.sourcePins),['tools/verification/NativeSpinNeutralV193-sql.ts']);
  bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-execution-input-recovery-v209.test.ts',outputPath:resolve(out,'source-closure-not-executed.mjs')});
  save('execution-input.lossless.json',input);report.harnessPins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
  for(const[path,pin]of Object.entries(report.harnessPins))assert.deepEqual(await fileState(resolve(root,path)),pin);
  save('start-manifest.json',{runtime:{nodeVersion:process.version,execution:report.execution,closureBundleExecuted:false},bundle,digestBundle,harnessPins:report.harnessPins,
    originalBefore:report.originalBefore,retainedDataBefore:report.retainedDataBefore,input,failedV208Receipt:failedReceiptPath,failedV208Preserved:true,
    originalFailedRunEndPinsClaimed:false,approvedSourcePatches:sourceProof.sources.map(s=>({sourcePath:s.sourcePath,baselinePath:s.baselinePath,oldPin:{bytes:s.bytes,sha256:s.sha256},currentPin:s.currentPin})),
    sourceEquivalenceProof:pins[sourceProofPath],sourceEquivalenceRecomputed:true,appendCounts,historyAppendCounts,
    stopBoundary:'NORMAL_INPUT_ACCEPTED_FROM_RETAINED_CUT9_AFTER_MISSING_CAL32_ONLY',constraints:['NO_PREFIX_TOTAL_VIEW_SCORE_EMOTION_DECISION_REACCEPT','ONE_NORMAL_CALIBRATION_SET_AND_ONE_INPUT_ONLY',
      'NO_HEAD_CAS_OR_SCHEMA_CHANGE_DURING_RECOVERY','OLD_FAILURE_AND_ALL_ANCESTOR_DATA_PRESERVED','NO_FIXTURE_BUNDLE_EXECUTION','SENTINEL_IDENTITY_ONLY_OTHER_ERRORS_PROPAGATE']});
  report.startManifestPin=await fileState(resolve(out,'start-manifest.json'));
  const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
  source=new DatabaseSync(original,{readOnly:true});source.exec('PRAGMA query_only=1; BEGIN');const before=digest(source);save('before-logical-with-rowid.json',before);
  const through=Object.create(null);for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=source.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const row=q.get();assert(row.lo===null||row.lo>0n);through[table]=row.hi??0n;}
  const historyThrough=rowidThrough(beforeHistory);
  // Recover the old append cutoff from the first N retained rows, including any original gaps; the later ROWID digest must still match every old row.
  for(const table of Object.keys(historyThrough)){
    assert.equal(beforeHistory.tables[table].rowIdentity,'ROWID');
    const q=source.prepare('SELECT rowid FROM main.'+table+' ORDER BY rowid LIMIT 1 OFFSET ?');q.setReadBigInts(true);
    const oldRows=beforeHistory.tables[table].rows;if(oldRows===0)historyThrough[table]=0n;
    else{const row=q.get(oldRows-1);assert(row&&typeof row.rowid==='bigint');historyThrough[table]=row.rowid;}
  }
  const physicalBefore=rawRows(source,'pa_physical_v1_heads'),worldBefore=rawRows(source,'world_control_heads');
  save('physical-heads-before.lossless.json',persistedRows(physicalBefore));save('world-heads-before.lossless.json',persistedRows(worldBefore));
  report.priorAppendRowidThrough=Object.fromEntries(Object.entries(through).map(([key,value])=>[key,String(value)]));
  report.historyRowidThrough=Object.fromEntries(Object.entries(historyThrough).map(([key,value])=>[key,String(value)]));
  assert(!existsSync(destination));closeSync(openSync(destination,'wx'));report.backupPages=await backup(source,destination,{source:'main',target:'main'});
  source.exec('ROLLBACK');source.close();source=null;report.originalAfterBackup=await databaseFiles(original);assert.deepEqual(dataPin(report.originalAfterBackup),dataPin(report.originalBefore));
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');assert.deepEqual(digest(target),before);target.exec('ROLLBACK');target.close();target=null;report.copyBefore=await databaseFiles(destination);
  const records=resolve(out,'records'),output=createWriteStream(resolve(out,'vitest.log'),{flags:'wx'});
  const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-execution-input-recovery-v209.test.ts','--testNamePattern','NR209-S01','--maxWorkers=1','--minWorkers=1'],
    {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_NATIVE_EXECUTION_INPUT_RECOVERY_V209_DATABASE:destination,BASEBALL_NATIVE_EXECUTION_INPUT_RECOVERY_V209_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_NATIVE_EXECUTION_INPUT_RECOVERY_V209_OUTPUT:records}});
  child.stdout.pipe(output,{end:false});child.stderr.pipe(output,{end:false});report.nativeTestProcessId=child.pid;save('native-process.json',{processId:child.pid,recordsPath:records,at:new Date().toISOString()});
  const exit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}));});await new Promise(done=>output.end(done));report.nativeTestExit=exit;assert.equal(exit.code,0,'cut9 recovery failed; retain records');
  report.nativeSummary=parseDebugRecord(readFileSync(resolve(records,'summary.json'),'utf8'));assert.equal(report.nativeSummary.pass,true);
  const frontier=parseDebugRecord(readFileSync(resolve(records,'frontier.lossless.json'),'utf8'));save('frontier.lossless.json',frontier);report.frontier=frontier;
  assert.equal(frontier.boundary,report.boundary);assert(frontier.recoveredCurrentCut9Proven&&frontier.executionInputAccepted&&frontier.finalLifecycleCurrentProven&&frontier.inputAwaitingConsumerContinuation);
  assert.equal(frontier.calibrationAcceptanceCount,1);assert.equal(frontier.calibrationReaccepted,false);assert.equal(frontier.normalLifecycleAdvances,0);
  assert.equal(frontier.nativePostInputConsumerProven,false);assert.equal(frontier.nativeResumeAdapterRequired,true);assert.equal(frontier.resumeReady,false);assert.equal(frontier.fullContinuationComplete,false);
  assert.equal(frontier.wholeRngConsumptionProven,false);for(const key of['commitmentAccepted','resolutionAccepted','fieldRootAccepted','officialTerminalProven'])assert.equal(frontier[key],false);
  assert.deepEqual(frontier.finalViewReference,inventory.viewReference);assert.deepEqual(frontier.finalCurrent,inventory.current);assert.deepEqual(frontier.finalHistorical,frontier.finalCurrent);
  assert.deepEqual(frontier.worldBefore,inventory.world);assert.deepEqual(frontier.worldAfter,inventory.world);assert.equal(frontier.currentDecisionCut.record.operationOrdinal,3);
  const expectedPinNames=[...Object.keys(retainedInput.resumePins),'scoreReference','emotionReference','decisionCutReference','inputReference'];assert.deepEqual(Object.keys(frontier.resumePins).sort(),expectedPinNames.sort());
  for(const[key,value]of Object.entries(retainedInput.resumePins))assert.deepEqual(frontier.resumePins[key],value);
  assert.deepEqual(frontier.resumePins.scoreReference,checkpoint8.scoreReference);assert.deepEqual(frontier.resumePins.emotionReference,checkpoint8.emotionReference);
  assert.deepEqual(frontier.resumePins.decisionCutReference,advance9.eventReference);assert.deepEqual(frontier.resumePins.inputReference,frontier.inputReference);
  assert.deepEqual(frontier.eventReferences,advance9.eventReferences);assert.equal(frontier.eventReferences.length,9);assert.equal(frontier.calibrations.length,32);
  assert.deepEqual(frontier.input.source.viewReference,inventory.viewReference);assert.deepEqual(frontier.input.source.physicalOperationReference,advance9.eventReference);
  assert.deepEqual(frontier.input.source.emotionReference,checkpoint8.emotionReference);assert.deepEqual(frontier.input.source.assessmentReferences,[checkpoint8.scoreReference]);
  for(const calibration of frontier.calibrations)assert.deepEqual(calibration.source.viewReference,frontier.finalViewReference);
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
  const checkpointStage=stages.filter(s=>s.name==='normal-current-cut9-cal32-recovered-checkpoint');assert.equal(checkpointStage.length,1);
  const checkpoint=parseDebugRecord(readFileSync(resolve(records,'checkpoint-'+checkpointStage[0].index+'-'+checkpointStage[0].name+'.lossless.json'),'utf8'));
  assert.equal(checkpoint.executionInputAccepted,false);assert.deepEqual(checkpoint.finalCurrent,frontier.finalCurrent);assert.deepEqual(checkpoint.calibrations,frontier.calibrations);
  assert.equal(stages.filter(s=>s.name==='execution-input-ready-stop').length,1);assert.equal(stages.filter(s=>s.name==='normal-current-cut9-recovered-input-and-world-authenticated').length,1);
  target=new DatabaseSync(destination,{readOnly:true});target.exec('PRAGMA query_only=1; BEGIN');const after=digest(target),prior=digest(target,through),historyPrior=digest(target,historyThrough);save('after-logical-with-rowid.json',after);
  assert.deepEqual(after.catalog,before.catalog,'recovery may not add any schema');for(const[table,old]of Object.entries(before.tables))assert.deepEqual(prior.tables[table],old,'retained row/rowid/head changed: '+table);
  report.appendedRows=Object.fromEntries(appendTables.map(table=>[table,after.tables[table].rows-before.tables[table].rows]));assert.deepEqual(report.appendedRows,appendCounts);
  report.changedTables=Object.keys(after.tables).filter(table=>JSON.stringify(after.tables[table])!==JSON.stringify(before.tables[table]));assert.deepEqual([...report.changedTables].sort(),[...appendTables].sort());
  assert.deepEqual(rawRows(target,'pa_physical_v1_heads'),physicalBefore);assert.deepEqual(rawRows(target,'world_control_heads'),worldBefore);report.recoveryAllOldRowsRowidsSchemaAndHeadsUnchanged=true;
  const oldPhysical=restoreRows(physicalHistory),oldWorld=restoreRows(worldHistory),newPhysical=rawRows(target,'pa_physical_v1_heads'),newWorld=rawRows(target,'world_control_heads');
  assert.deepEqual(newPhysical.filter(x=>x.enrollment_source_id!==parent.enrollmentSourceId),oldPhysical.filter(x=>x.enrollment_source_id!==parent.enrollmentSourceId));
  assert.deepEqual(newWorld.filter(x=>x.career_id!==parent.careerId),oldWorld.filter(x=>x.career_id!==parent.careerId));
  const oldP=oldPhysical.filter(x=>x.enrollment_source_id===parent.enrollmentSourceId),newP=newPhysical.filter(x=>x.enrollment_source_id===parent.enrollmentSourceId),oldW=oldWorld.filter(x=>x.career_id===parent.careerId),newW=newWorld.filter(x=>x.career_id===parent.careerId);
  assert.equal(oldP.length,1);assert.equal(newP.length,1);assert.equal(oldW.length,1);assert.equal(newW.length,1);assert.equal(oldP[0].operation_ordinal,2n);assert.equal(oldW[0].world_revision,0n);
  assert.deepEqual(newP[0],Object.assign(Object.create(null),oldP[0],{operation_ordinal:3n,last_owner:advance9.eventReference.owner,last_source_id:advance9.eventReference.sourceId,last_snapshot_hash:advance9.eventReference.snapshotHash}));
  assert.deepEqual(newW[0],Object.assign(Object.create(null),oldW[0],{world_revision:1n}));
  for(const old of beforeHistory.catalog)assert.deepEqual(persisted(after.catalog.find(row=>row.type===old.type&&row.name===old.name)),old);
  const historyCatalogAdded=after.catalog.filter(row=>!beforeHistory.catalog.some(old=>row.type===old.type&&row.name===old.name));assert.deepEqual(orderedCatalog(historyCatalogAdded),orderedCatalog(parent.expectedCatalogAdditions));
  for(const[table,old]of Object.entries(beforeHistory.tables))if(!mutableTables.includes(table))assert.deepEqual(persisted(historyPrior.tables[table]),old,'pre-V208 immutable row/rowid changed: '+table);
  report.combinedV208AndRecoveryAppendRows=Object.fromEntries(historyTables.map(table=>[table,(after.tables[table]?.rows??0)-(beforeHistory.tables[table]?.rows??0)]));assert.deepEqual(report.combinedV208AndRecoveryAppendRows,historyAppendCounts);
  const historyChanged=Object.keys(after.tables).filter(table=>JSON.stringify(persisted(after.tables[table]))!==JSON.stringify(beforeHistory.tables[table]));for(const table of historyChanged)assert([...historyTables,...mutableTables].includes(table));
  report.combinedV208AndRecovery94RowsTwoCasAndSevenCatalogAdditionsProven=true;report.combinedVerificationDoesNotCompleteFailedRun=true;
  target.exec('ROLLBACK');target.close();target=null;report.executionInputAccepted=true;report.resumeReady=false;report.pass=true;
}catch(error){report.error=String(error.stack??error);process.exitCode=1;}
finally{
  for(const db of[source,target])if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.close();}catch(error){report.cleanupError=String(error);report.pass=false;process.exitCode=1;}
  try{
    report.retainedDataAfter={};for(const[path,before]of Object.entries(report.retainedDataBefore??{})){const after=await databaseFiles(path);assert.deepEqual(dataPin(after),dataPin(before));report.retainedDataAfter[path]=after;}
    report.originalAfter=report.retainedDataAfter[original];report.copyAfter=await databaseFiles(destination);report.originalDataUnchanged=true;await pinParent();report.parentSourcePinsReconciledWithApprovedPatches=true;
    report.bundles=[];for(const p of[bundle,digestBundle].filter(Boolean)){
      assert.deepEqual(await fileState(p.bundlePath),{exists:true,bytes:p.bytes,sha256:p.sha256});const sourcePins={};for(const[path,pin]of Object.entries(p.sourcePins)){const end=await fileState(resolve(root,path));assert.deepEqual(end,{exists:true,bytes:pin.bytes,sha256:pin.sha256});sourcePins[path]={...pin,endSha256:end.sha256};}
      report.bundles.push({executed:p===digestBundle,inputCount:p.inputCount,sha256:p.sha256,sourcePins});}
    report.sourceAndBundleEndPinProven=!!bundle&&!!digestBundle;assert.deepEqual(await fileState(resolve(out,'start-manifest.json')),report.startManifestPin);
    for(const[path,pin]of Object.entries(report.harnessPins??{}))assert.deepEqual(await fileState(resolve(root,path)),pin);report.harnessAndInputEndPinsProven=true;
  }catch(error){report.pinError=String(error.stack??error);report.pass=false;process.exitCode=1;}
  save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,executionInputAccepted:report.executionInputAccepted,recoveryRows:report.appendedRows,
  oldFailurePreserved:report.failedV208Preserved,recoveryAllOldRowsRowidsSchemaAndHeadsUnchanged:report.recoveryAllOldRowsRowidsSchemaAndHeadsUnchanged,
  combinedHistoryProven:report.combinedV208AndRecovery94RowsTwoCasAndSevenCatalogAdditionsProven,sourceAndBundleEndPinProven:report.sourceAndBundleEndPinProven,
  error:report.error??report.cleanupError??report.pinError??null}));
