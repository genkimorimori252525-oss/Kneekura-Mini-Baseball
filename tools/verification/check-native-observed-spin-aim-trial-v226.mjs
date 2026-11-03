import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync, constants as fsConstants, createWriteStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync, constants as sqliteConstants } from 'node:sqlite';
import { compilePinnedNativeEntry, databaseFiles, fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

// Executable only after a separately reviewed freeze manifest is provided.
// No connection is opened on the retained V209 database or its ancestors.
const root=resolve('.'), out=resolve(process.argv[2]??''), freezePath=resolve(process.argv[3]??''), rel=relative(root,out);
assert(process.argv.length===4 && rel && !rel.startsWith('..') && !isAbsolute(rel) && !existsSync(out), 'new workspace output and reviewed freeze manifest required');
mkdirSync(out,{recursive:false});
const preflightFailure=error=>{const value={pass:false,phase:'PREFLIGHT_OR_UNHANDLED_FAILURE',originalDatabaseOpened:false,error:String(error?.stack??error)};
 try{if(!existsSync(resolve(out,'preflight-failure.json')))writeFileSync(resolve(out,'preflight-failure.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
 if(!existsSync(resolve(out,'report.json')))writeFileSync(resolve(out,'report.json'),JSON.stringify(value,null,2)+'\n',{flag:'wx'});}finally{process.exitCode=1;console.error(value.error)}};
process.on('uncaughtException',preflightFailure);process.on('unhandledRejection',preflightFailure);
const retained=resolve('docs/verification/realism-debug-20261027/native-execution-input-recovery-v209-01');
const original=resolve(retained,'execution-input-recovered-private.sqlite'), copy=resolve(out,'owned-trial.sqlite');
const receiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_f2977213f9134a6b9dd532aee02c0cd4.json');
const parentPath=resolve(retained,'start-manifest.json'), reportPath=resolve(retained,'report.json'), frontierPath=resolve(retained,'frontier.lossless.json');
const bindingPath=resolve('work/motor-evidence-readonly-gate-v224-01/start-manifest.json');
const bindingReportPath=resolve('work/motor-evidence-readonly-gate-v224-01/report.json');
const bindingReceiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_d6cc23733bcd47b6be14cdc4eff79a10.json');
const sha=b=>createHash('sha256').update(b).digest('hex'), pin=b=>({exists:true,bytes:b.length,sha256:sha(b)}), pins={};
const read=path=>{const bytes=readFileSync(path);pins[path]=pin(bytes);return parseDebugRecord(bytes.toString('utf8'));};
const parent=read(parentPath), previous=read(reportPath), accepted=read(frontierPath), receipt=read(receiptPath), binding=read(bindingPath), bindingReport=read(bindingReportPath), bindingReceipt=read(bindingReceiptPath), freeze=read(freezePath);
const bindingLog=readFileSync(resolve(bindingReceipt.output_path));pins[resolve(bindingReceipt.output_path)]=pin(bindingLog);
assert.equal(bindingReceipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(bindingReceipt.result,'PASS');assert.equal(bindingReceipt.exit_code,0);assert.equal(sha(bindingLog),bindingReceipt.output_sha256);
assert(bindingReport.pass && bindingReport.logicalRowsRowidsSchemaHeadsUnchanged && bindingReport.callerStateAndAuthorizerPreserved && bindingReport.originalDataUnchanged && bindingReport.baselineDataUnchanged && bindingReport.ownedCopyDataUnchanged && bindingReport.currentSourceAndBundleEndPins && bindingReport.retainedArtifactsAndHarnessEndPins);
const log=readFileSync(resolve(receipt.output_path));pins[resolve(receipt.output_path)]=pin(log);
assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
assert(previous.pass && previous.originalDataUnchanged && previous.recoveryAllOldRowsRowidsSchemaAndHeadsUnchanged && previous.sourceAndBundleEndPinProven && previous.harnessAndInputEndPinsProven);
assert.deepEqual(previous.frontier,accepted);assert.equal(accepted.boundary,'NATIVE_EXECUTION_INPUT_RECOVERY_CHECKPOINT_ONLY');
assert(accepted.recoveredCurrentCut9Proven && accepted.executionInputAccepted && accepted.finalLifecycleCurrentProven && accepted.inputAwaitingConsumerContinuation);
for(const key of ['commitmentAccepted','resolutionAccepted','fieldRootAccepted','officialTerminalProven','performancePass'])assert.equal(accepted[key],false);
assert.equal(accepted.finalViewReference.sourceId,'physical-fixture:cut9:view');assert.equal(accepted.eventReferences.length,9);assert.equal(Object.keys(accepted.resumePins).length,12);
assert.equal(accepted.worldAfter.head.worldRevision,1);assert.equal(accepted.calibrations.length,32);
const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(k=>[k,accepted[k]]));
const enrollment=accepted.originalInputs.action.lineage.enrollmentReference.sourceId, career=accepted.worldAfter.head.careerId;
const oldBaselines={
 'src/core/world/psychology/batting/BattingMotorPlanV1.ts':'work/observed-spin-aim-v226-baseline/source-start.ts.txt',
 'src/core/world/psychology/batting/BattingCommitment.ts':'work/same-pa-observed-spin-trial-v226-baseline/BattingCommitment.ts.start.txt',
 'src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite.ts':'work/same-pa-observed-spin-trial-v226-baseline/SamePlateAppearancePhysicalEpisodeFromSqlite.ts.start.txt',
 'src/host/world/SamePlateAppearancePhysicalEpisode.ts':'work/same-pa-observed-spin-trial-v226-baseline/SamePlateAppearancePhysicalEpisode.ts.start.txt',
 'src/host/world/SamePlateAppearanceLifecycleClaimGuard.ts':'work/same-pa-observed-spin-trial-v226-baseline/SamePlateAppearanceLifecycleClaimGuard.ts.start.txt',
 'src/host/world/SqliteStandalonePracticeStore.ts':'work/native-standalone-motor-evidence-baseline/source-start.ts.txt',
 'src/host/world/SamePlateAppearanceLifecycleFixture.test-support.ts':'work/native-field-clock-v212-baseline/SamePlateAppearanceLifecycleFixture.test-support.ts',
 'src/host/world/InFlightBattingLifecycleFixture.test-support.ts':'work/native-post-input-v210-baseline/InFlightBattingLifecycleFixture.test-support.ts' };
assert.equal(freeze.boundary,'REVIEWED_V226_SOURCE_FREEZE');assert.equal(freeze.task,'MB-20261027-REALISM-DEBUG-PLAN');
assert.deepEqual(Object.keys(freeze.changedParentSources).sort(),Object.keys(oldBaselines).sort());
async function pinParent(){
 for(const artifact of [parent.bundle,parent.digestBundle])assert.deepEqual(await fileState(resolve(artifact.bundlePath)),{exists:true,bytes:artifact.bytes,sha256:artifact.sha256},'parent bundle differs');
 for(const [path,expected] of Object.entries(parent.harnessPins)){const relPath=relative(root,resolve(path)).replaceAll('\\','/');const actual=await fileState(resolve(oldBaselines[relPath]??path));assert.deepEqual(actual,expected,'parent harness artifact differs: '+path);}
 for(const [path,expected] of Object.entries(binding.pins))assert.deepEqual(await fileState(resolve(path)),expected,'V224 artifact differs: '+path);
 assert.deepEqual(await fileState(resolve(binding.bundle.bundlePath)),{exists:true,bytes:binding.bundle.bytes,sha256:binding.bundle.sha256},'V224 bundle differs');
 const changed=[];
 for(const [path,old] of Object.entries(parent.bundle.sourcePins)){
  const current=await fileState(resolve(path));assert(current.exists,'parent source missing: '+path);
  if(oldBaselines[path]){changed.push(path);const baseline=await fileState(resolve(oldBaselines[path]));
   assert.deepEqual(baseline,{exists:true,bytes:old.bytes,sha256:old.sha256},'parent baseline differs: '+path);
   assert.deepEqual(current,freeze.changedParentSources[path],'frozen current source differs: '+path);
  }else assert.deepEqual(current,{exists:true,bytes:old.bytes,sha256:old.sha256},'unlisted parent source differs: '+path);
 }
 assert.deepEqual(changed.sort(),Object.keys(oldBaselines).sort());
 for(const [path,old] of Object.entries(parent.digestBundle.sourcePins))assert.deepEqual(await fileState(resolve(path)),{exists:true,bytes:old.bytes,sha256:old.sha256});
}
const appendCounts={pa_lifecycle_v1_work_prefixes:2,pa_lifecycle_v1_total_assessments:20,pa_lifecycle_v1_execution_views:2,
 pa_lifecycle_v1_execution_calibrations:64,pa_physical_v1_commitments:1,pa_physical_v1_resolutions:1,world_decision_revision_events:1};
const appendTables=Object.keys(appendCounts),mutable=['pa_physical_v1_heads','world_control_heads'],bindingTable='world_spin_motion_bindings_v225';
const rawRows=(db,table)=>{const q=db.prepare('SELECT rowid AS native_rowid,* FROM main.'+table+' ORDER BY rowid');q.setReadBigInts(true);return q.all()};
const persist=rows=>rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,typeof v==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(v)}:v])));
const dbData=x=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,x[k]]));
const save=(name,value)=>writeFileSync(resolve(out,name),stringifyDebugRecord(value)+'\n',{flag:'wx'});
const report={pass:false,boundary:'NATIVE_OBSERVED_SPIN_AIM_TRIAL_ONLY',originalDatabaseOpened:false,fieldRootAccepted:false,officialTerminalProven:false,
 qualifiedTransferProven:false,performancePass:false,physicsAuthority:'RETAINED_PROSPECTIVE_FIELD_DECLARATION_NOT_NATIVE_FIELD_ADOPTION',originalPath:original,copyPath:copy};
let db,bundle,digestBundle,before,copyBefore,originalBefore,physicalBefore,worldBefore,through,workerExit;
const retainedFiles=new Map(Object.entries(previous.retainedDataAfter).map(([path,state])=>[resolve(path),state]));
assert(!retainedFiles.has(original));retainedFiles.set(original,previous.copyAfter);assert.equal(retainedFiles.size,8);
try{
 await pinParent();report.retainedBefore={};for(const [path,expected] of retainedFiles){const actual=await databaseFiles(path);assert.deepEqual(dbData(actual),dbData(expected),'retained database differs: '+path);report.retainedBefore[path]=actual;}
 originalBefore=report.retainedBefore[original];report.originalBefore=originalBefore;
 assert(originalBefore.main.exists && !originalBefore['-journal'].exists,'retained main missing or journal present');
 assert.deepEqual(dbData(originalBefore),dbData(previous.copyAfter),'retained V209 data differs');
 for(const suffix of ['','-wal','-shm'])if(originalBefore[suffix||'main'].exists)copyFileSync(original+suffix,copy+suffix,fsConstants.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),originalBefore,'original files changed during paired copy');copyBefore=await databaseFiles(copy);assert.deepEqual(copyBefore,originalBefore);
 bundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-observed-spin-aim-trial-v226.test.ts',outputPath:resolve(out,'source-closure.mjs')});
 digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest.mjs')});
 assert.deepEqual(Object.keys(bundle.sourcePins).sort(),Object.keys(freeze.closureSources).sort(),'frozen closure paths differ');
 for(const [path,p] of Object.entries(bundle.sourcePins))assert.deepEqual({exists:true,bytes:p.bytes,sha256:p.sha256},freeze.closureSources[path],'frozen closure differs: '+path);
 for(const path of ['tools/verification/check-native-observed-spin-aim-trial-v226.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs',...Object.values(oldBaselines)])pins[resolve(path)]=await fileState(resolve(path));
 const workerInput={input};save('execution-input.lossless.json',workerInput);pins[resolve(out,'execution-input.lossless.json')]=await fileState(resolve(out,'execution-input.lossless.json'));
 save('start-manifest.json',{originalBefore,copyBefore,parentReceipt:receiptPath,freezePath,bundle,digestBundle,pins,appendCounts,mutable,bindingTable});
 const startPin=await fileState(resolve(out,'start-manifest.json'));pins[resolve(out,'start-manifest.json')]=startPin;
 const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
 const open=()=>{const c=new DatabaseSync(copy,{readOnly:true});c.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v226');c.setAuthorizer(code=>code===sqliteConstants.SQLITE_ATTACH||code===sqliteConstants.SQLITE_DETACH?sqliteConstants.SQLITE_DENY:sqliteConstants.SQLITE_OK);return c};
 const close=c=>{c.exec('ROLLBACK TO caller_v226; RELEASE caller_v226');assert(c.isTransaction);c.exec('ROLLBACK');c.setAuthorizer(null);c.close()};
 const stamps=c=>({transaction:c.isTransaction,queryOnly:c.prepare('PRAGMA query_only').get().query_only,changes:c.prepare('SELECT total_changes() n').get().n,mainSchema:c.prepare('PRAGMA main.schema_version').get().schema_version,tempSchema:c.prepare('PRAGMA temp.schema_version').get().schema_version});
 db=open();let stamp=stamps(db);assert.equal(stamp.queryOnly,1);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v226"),/not authorized/);
 before=digest(db);assert(!Object.hasOwn(before.tables,bindingTable));save('logical-before.lossless.json',before);through=Object.create(null);
 for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=db.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const r=q.get();assert(r.lo===null||r.lo>0n);through[table]=r.hi??0n;}
 physicalBefore=rawRows(db,'pa_physical_v1_heads');worldBefore=rawRows(db,'world_control_heads');save('heads-before.lossless.json',{physical:persist(physicalBefore),world:persist(worldBefore)});
 const p=physicalBefore.filter(x=>x.enrollment_source_id===enrollment),w=worldBefore.filter(x=>x.career_id===career);assert.equal(p.length,1);assert.equal(w.length,1);assert.equal(p[0].operation_ordinal,3n);assert.equal(w[0].world_revision,1n);
 assert.deepEqual(stamps(db),stamp);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v226"),/not authorized/);close(db);db=null;
 const records=resolve(out,'records'),stream=createWriteStream(resolve(out,'worker.log'),{flags:'wx'});
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-observed-spin-aim-trial-v226.test.ts','--testNamePattern','V226 actual trial on an owned copy only','--maxWorkers=1','--minWorkers=1'],
  {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_V226_DATABASE:copy,BASEBALL_V226_INPUT:resolve(out,'execution-input.lossless.json'),BASEBALL_V226_OUTPUT:records}});
 child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});save('worker-process.json',{pid:child.pid,records,startedAt:new Date().toISOString()});
 try{workerExit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}))})}finally{await new Promise(done=>stream.end(done))}report.workerExit=workerExit;
 for(const path of [resolve(out,'worker.log'),resolve(out,'worker-process.json'),...(existsSync(records)?readdirSync(records).map(name=>resolve(records,name)):[])])pins[path]=await fileState(path);
 // A miss or reverse spin remains a recorded observation, not a harness failure.
 if(existsSync(resolve(records,'result.lossless.json'))){report.result=read(resolve(records,'result.lossless.json')).summary;}
 if(existsSync(resolve(records,'failure.json')))report.workerFailure=read(resolve(records,'failure.json'));
 db=open();stamp=stamps(db);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v226"),/not authorized/);
 const after=digest(db),prior=digest(db,through);save('logical-after.lossless.json',after);
 if(workerExit.code===0){
  assert(report.result,'worker result missing');const result=read(resolve(records,'result.lossless.json')),frontier=result.result;
  assert(frontier.postInputEntryAuthenticated && frontier.nativeBattingSuffixResolved && frontier.lifecycleResolvedProven && frontier.finalLifecycleCurrentProven);
  assert.equal(frontier.normalLifecycleAdvances,2);assert.equal(frontier.worldBefore.head.worldRevision,1);assert.equal(frontier.worldAfter.head.worldRevision,2);
  assert.equal(frontier.finalViewReference.sourceId,'physical-fixture:cut11:view');assert.equal(frontier.calibrations.length,32);
  assert.equal(frontier.newPracticeAccepted,0);assert.equal(frontier.twoTakeReplayed,false);assert.equal(frontier.forecastRegenerated,false);
  assert.deepEqual(frontier.retainedInputReferences,input.retainedInputReferences);assert.equal(result.bindings.registered.length,2);
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const find=name=>{const matches=stages.filter(x=>x.name===name);assert.equal(matches.length,1,'stage count: '+name);return matches[0].index};
  assert(find('trial-source-before-acceptance')<find('normal-cut10-current-cal32-physical-world-checkpoint'));
  assert(find('normal-cut10-current-cal32-physical-world-checkpoint')<find('normal-cut11-current-cal32-physical-world-checkpoint'));
  assert(find('normal-cut11-current-cal32-physical-world-checkpoint')<find('trial-actual-contact-before-flight'));
  pins[resolve(records,'stages.jsonl')]=await fileState(resolve(records,'stages.jsonl'));for(const stage of stages)pins[resolve(records,'stage-'+stage.index+'-'+stage.name+'.lossless.json')]=await fileState(resolve(records,'stage-'+stage.index+'-'+stage.name+'.lossless.json'));
  assert.deepEqual(after.catalog.filter(row=>row.name!==bindingTable&&row.tbl_name!==bindingTable),before.catalog,'old catalog changed');
  assert.deepEqual(Object.keys(after.tables).filter(k=>!Object.hasOwn(before.tables,k)),[bindingTable]);assert.equal(after.tables[bindingTable].rows,2);
  for(const [table,old] of Object.entries(before.tables))if(!mutable.includes(table))assert.deepEqual(prior.tables[table],old,'old rows or rowids changed: '+table);
  assert.deepEqual(Object.fromEntries(appendTables.map(t=>[t,after.tables[t].rows-before.tables[t].rows])),appendCounts);
  assert.deepEqual(Object.keys(before.tables).filter(t=>JSON.stringify(before.tables[t])!==JSON.stringify(after.tables[t])).sort(),[...appendTables,...mutable].sort());
  const pa=rawRows(db,'pa_physical_v1_heads'),wa=rawRows(db,'world_control_heads');save('heads-after.lossless.json',{physical:persist(pa),world:persist(wa)});
  assert.deepEqual(pa.filter(x=>x.enrollment_source_id!==enrollment),physicalBefore.filter(x=>x.enrollment_source_id!==enrollment));
  assert.deepEqual(wa.filter(x=>x.career_id!==career),worldBefore.filter(x=>x.career_id!==career));
  const op=physicalBefore.find(x=>x.enrollment_source_id===enrollment),ow=worldBefore.find(x=>x.career_id===career);
  assert.deepEqual(pa.filter(x=>x.enrollment_source_id===enrollment),[Object.assign(Object.create(null),op,{operation_ordinal:op.operation_ordinal+2n,last_owner:frontier.resolutionReference.owner,last_source_id:frontier.resolutionReference.sourceId,last_snapshot_hash:frontier.resolutionReference.snapshotHash})]);
  assert.deepEqual(wa.filter(x=>x.career_id===career),[Object.assign(Object.create(null),ow,{world_revision:ow.world_revision+1n})]);
  report.oldRowsRowidsCatalogAndOtherHeadsUnchanged=true;report.expectedAppendsAndCas=true;report.pass=true;
 }else {
  report.oldImmutableDifferences=Object.entries(before.tables).filter(([table,old])=>!mutable.includes(table)&&JSON.stringify(prior.tables[table])!==JSON.stringify(old)).map(([table])=>table);
  report.postFailureHeads={physical:persist(rawRows(db,'pa_physical_v1_heads')),world:persist(rawRows(db,'world_control_heads'))};
  report.error='worker failed; preserved worker output, post-failure logical digest and old-row comparison';process.exitCode=1; }
 assert.deepEqual(stamps(db),stamp);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v226"),/not authorized/);close(db);db=null;report.callerStatePreserved=true;
}catch(e){report.pass=false;report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.cleanupError=String(e);report.pass=false;process.exitCode=1}
 try{
  report.retainedAfter={};for(const [path,b] of Object.entries(report.retainedBefore??{})){const a=await databaseFiles(path);assert.deepEqual(a,b,'retained database files changed: '+path);report.retainedAfter[path]=a;}
  if(originalBefore){report.originalAfter=report.retainedAfter[original];assert.deepEqual(report.originalAfter,originalBefore,'original database files changed');report.originalFilesUnchanged=true}
  if(copyBefore)report.copyAfter=await databaseFiles(copy);
  await pinParent();for(const b of [bundle,digestBundle].filter(Boolean)){assert.deepEqual(await fileState(b.bundlePath),{exists:true,bytes:b.bytes,sha256:b.sha256});for(const [path,p] of Object.entries(b.sourcePins))assert.deepEqual(await fileState(resolve(path)),{exists:true,bytes:p.bytes,sha256:p.sha256},'source changed: '+path)}
  for(const [path,p] of Object.entries(pins))assert.deepEqual(await fileState(path),p,'artifact changed: '+path);report.endPinsProven=!!bundle&&!!digestBundle;
 }catch(e){report.pinError=String(e.stack??e);report.pass=false;process.exitCode=1}
 save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,trial:report.result??null,error:report.error??report.pinError??null}));
