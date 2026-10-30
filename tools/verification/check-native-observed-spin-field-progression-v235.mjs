import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFileSync,constants as fs,existsSync,mkdirSync,readFileSync,readdirSync,writeFileSync,createWriteStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolve,relative,isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync,constants as sqlite } from 'node:sqlite';
import { compilePinnedNativeEntry,databaseFiles,fileState } from './native-measurement-probe-support-v183.mjs';
import { parseDebugRecord,stringifyDebugRecord } from './live-debug-record.mjs';
const root=resolve('.'),out=resolve(process.argv[2]??''),freezePath=resolve(process.argv[3]??''),rel=relative(root,out);
assert(process.argv.length===4&&rel&&!rel.startsWith('..')&&!isAbsolute(rel)&&!existsSync(out),'new workspace output and reviewed V235 source freeze required');
mkdirSync(out,{recursive:false});const save=(name,v)=>writeFileSync(resolve(out,name),stringifyDebugRecord(v)+'\n',{flag:'wx'});
const sha=b=>createHash('sha256').update(b).digest('hex'),pins={},read=path=>{const b=readFileSync(path);pins[path]={exists:true,bytes:b.length,sha256:sha(b)};return parseDebugRecord(b.toString('utf8'))};
const original=resolve('work/native-observed-spin-field-v234-01/field-root-private.sqlite'),dest=resolve(out,'field-progression-private.sqlite');
const receiptPath=resolve('docs/ai-continuity/verification-receipts/MB-20261027-REALISM-DEBUG-PLAN_4986760742414057a1516f1e749e60f0.json');
const parentPath=resolve('work/native-observed-spin-field-v234-01/start-manifest.json'),reportPath=resolve('work/native-observed-spin-field-v234-01/report.json');
const priorResult=resolve('work/native-observed-spin-field-v234-01/records/result.lossless.json');
const appendCounts={pa_physical_v1_field_steps:3,pa_lifecycle_v1_work_prefixes:3,pa_lifecycle_v1_total_assessments:30,pa_lifecycle_v1_execution_views:3,pa_lifecycle_v1_execution_calibrations:96};
const appendTables=Object.keys(appendCounts),mutable=['pa_physical_v1_heads'],report={pass:false,boundary:'V235_FIELD_CLOCK_OBSERVATION_DECISION_ONLY',originalDatabaseOpened:false,
 newPractice:0,newContact:0,twoTakeReplayed:false,officialTerminalProven:false,terminalSettlementProven:false,releaseProven:false,nextPitchProven:false,
 initialControlAuthority:'EXPLICIT_UNCALIBRATED_GAME_CONTROL',controlCoverage:'INITIAL_HOLD_UNTIL_FIRST_SENSORY_CUT'};
let sourceBefore,entry,digestBundle,db,workerExit,parentCheck,retainedBefore={};
const data=x=>Object.fromEntries(['main','-wal','-journal'].map(k=>[k,x[k]]));
const rows=(d,t)=>{const q=d.prepare('SELECT rowid AS native_rowid,* FROM main.'+t+' ORDER BY rowid');q.setReadBigInts(true);return q.all()};
const stored=rs=>rs.map(r=>Object.fromEntries(Object.entries(r).map(([k,v])=>[k,typeof v==='bigint'?{kind:'SQLITE_INTEGER',decimal:String(v)}:v])));
try{
 const parent=read(parentPath),previous=read(reportPath),accepted=read(priorResult),receipt=read(receiptPath),freeze=read(freezePath),log=readFileSync(resolve(receipt.output_path));
 pins[resolve(receipt.output_path)]={exists:true,bytes:log.length,sha256:sha(log)};
 assert.equal(receipt.task_id,'MB-20261027-REALISM-DEBUG-PLAN');assert.equal(receipt.result,'PASS');assert.equal(receipt.exit_code,0);assert.equal(sha(log),receipt.output_sha256);
 assert(previous.pass&&previous.originalFilesUnchanged&&previous.oldRowsRowidsCatalogOtherHeadsUnchanged&&previous.expected45AppendsAndOnePhysicalHeadCas&&previous.callerStatePreserved&&previous.endPinsProven);
 assert.equal(freeze.boundary,'REVIEWED_V235_SOURCE_FREEZE');assert.equal(freeze.task,'MB-20261027-REALISM-DEBUG-PLAN');
 const final=accepted;assert.equal(final.boundary,'NATIVE_OBSERVED_SPIN_FIELD_ROOT_CHECKPOINT_ONLY');assert(final.actualContact&&final.fieldRootAccepted);
 assert.equal(final.finalViewReference.sourceId,'physical-fixture:cut12:view');assert.equal(final.eventReferences.length,12);assert.equal(Object.keys(final.resumePins).length,15);
 assert.equal(final.fieldRoot.timeline.status.kind,'batted_ball_pending');assert.equal(final.originalInputs.commitment.source.capability,'same_pa_physical_observed_spin_aim_trial_v226');
 const input=Object.fromEntries(['retainedInputReferences','resumePins','finalViewReference','eventReferences'].map(k=>[k,final[k]]));
 const enrollment=final.originalInputs.action.lineage.enrollmentReference.sourceId,career=final.worldAfter.head.careerId;
 const oldSourcePins=parent.entry.sourcePins;
 async function reconcileParent(){
  for(const [path,pin] of Object.entries(parent.pins))assert.deepEqual(await fileState(resolve(path)),pin,'retained V226 artifact differs: '+path);
  for(const artifact of [parent.entry,parent.digestBundle])assert.deepEqual(await fileState(artifact.bundlePath),{exists:true,bytes:artifact.bytes,sha256:artifact.sha256},'retained V226 bundle differs');
  const changed=[];for(const [path,old] of Object.entries(oldSourcePins)){
   const current=await fileState(resolve(path)),expected=freeze.parentSourceBaselines[path];
   if(expected){changed.push(path);assert.deepEqual(await fileState(resolve(expected.baselinePath)),{exists:true,bytes:old.bytes,sha256:old.sha256},'old parent Source differs: '+path);
    assert.deepEqual(current,expected.currentPin,'reviewed Source changed: '+path)}
   else assert.deepEqual(current,{exists:true,bytes:old.bytes,sha256:old.sha256},'unlisted Source change: '+path);
  }
  assert.deepEqual(changed.sort(),Object.keys(freeze.parentSourceBaselines).sort());
 }
 parentCheck=reconcileParent;await parentCheck();
 const retained=new Map(Object.entries(parent.retainedBefore).map(([p,x])=>[resolve(p),x]));assert(!retained.has(original));retained.set(original,previous.copyAfter);
 for(const [path,pin] of retained){const actual=await databaseFiles(path);assert.deepEqual(data(actual),data(pin),'retained DB differs: '+path);retainedBefore[path]=actual}
 sourceBefore=retainedBefore[original];assert(sourceBefore.main.exists&&!sourceBefore['-journal'].exists);
 for(const suffix of ['','-wal','-shm'])if(sourceBefore[suffix||'main'].exists)copyFileSync(original+suffix,dest+suffix,fs.COPYFILE_EXCL);
 assert.deepEqual(await databaseFiles(original),sourceBefore);assert.deepEqual(await databaseFiles(dest),sourceBefore);
 entry=await compilePinnedNativeEntry({root,entryPath:'tools/verification/native-observed-spin-field-progression-v235.test.ts',outputPath:resolve(out,'entry-closure.mjs')});
 digestBundle=await compilePinnedNativeEntry({root,entryPath:'tools/verification/NativeSpinNeutralV193-sql.ts',outputPath:resolve(out,'digest.mjs')});
 assert.equal(entry.sha256,freeze.bundle.sha256,'reviewed entry bundle differs');assert.equal(entry.inputCount,freeze.bundle.inputCount);
 assert.deepEqual(Object.keys(entry.sourcePins).sort(),Object.keys(freeze.entrySources).sort());
 for(const [p,v] of Object.entries(entry.sourcePins))assert.deepEqual({exists:true,bytes:v.bytes,sha256:v.sha256},freeze.entrySources[p],'entry Source differs: '+p);
 for(const p of ['tools/verification/check-native-observed-spin-field-progression-v235.mjs','tools/verification/native-measurement-probe-support-v183.mjs','tools/verification/live-debug-record.mjs']){
  const state=await fileState(resolve(p));assert.deepEqual(state,freeze.harnessPins[p]);pins[resolve(p)]=state;
 }
 save('input.lossless.json',input);pins[resolve(out,'input.lossless.json')]=await fileState(resolve(out,'input.lossless.json'));
 save('start-manifest.json',{sourceBefore,retainedBefore,parentReceipt:receiptPath,parentSourceExceptions:freeze.parentSourceBaselines,entry,digestBundle,pins,appendCounts,mutable});
 pins[resolve(out,'start-manifest.json')]=await fileState(resolve(out,'start-manifest.json'));
 const digest=(await import(pathToFileURL(digestBundle.bundlePath).href)).rawNativeSpinNeutralSqlDigestV193;
 const open=()=>{const d=new DatabaseSync(dest,{readOnly:true});d.exec('PRAGMA query_only=1; BEGIN; SAVEPOINT caller_v235');d.setAuthorizer(c=>c===sqlite.SQLITE_ATTACH||c===sqlite.SQLITE_DETACH?sqlite.SQLITE_DENY:sqlite.SQLITE_OK);return d};
 const stamp=d=>({transaction:d.isTransaction,queryOnly:d.prepare('PRAGMA query_only').get().query_only,changes:d.prepare('SELECT total_changes() n').get().n,schema:d.prepare('PRAGMA main.schema_version').get().schema_version});
 const close=d=>{d.exec('ROLLBACK TO caller_v235; RELEASE caller_v235');assert(d.isTransaction);d.exec('ROLLBACK');d.setAuthorizer(null);d.close()};
 db=open();const beforeStamp=stamp(db);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v235"),/not authorized/);const before=digest(db),through=Object.create(null);
 for(const table of appendTables){assert.equal(before.tables[table].rowIdentity,'ROWID');const q=db.prepare('SELECT min(rowid) lo,max(rowid) hi FROM main.'+table);q.setReadBigInts(true);const r=q.get();assert(r.lo===null||r.lo>0n);through[table]=r.hi??0n;}
 const physicalBefore=rows(db,'pa_physical_v1_heads'),worldBefore=rows(db,'world_control_heads'),oldP=physicalBefore.filter(r=>r.enrollment_source_id===enrollment);assert.equal(oldP.length,1);assert.equal(oldP[0].operation_ordinal,6n);
 save('before-logical.json',before);save('heads-before.json',{physical:stored(physicalBefore),world:stored(worldBefore)});assert.deepEqual(stamp(db),beforeStamp);close(db);db=null;
 const records=resolve(out,'records'),stream=createWriteStream(resolve(out,'worker.log'),{flags:'wx'});
 const child=spawn(process.execPath,['node_modules/vitest/vitest.mjs','run','tools/verification/native-observed-spin-field-progression-v235.test.ts','--testNamePattern','V235 actual field progression on an owned copy only','--maxWorkers=1','--minWorkers=1'],
 {cwd:root,windowsHide:true,env:{...process.env,BASEBALL_V235_DATABASE:dest,BASEBALL_V235_INPUT:resolve(out,'input.lossless.json'),BASEBALL_V235_OUTPUT:records}});
 child.stdout.pipe(stream,{end:false});child.stderr.pipe(stream,{end:false});save('worker-process.json',{pid:child.pid,records,startedAt:new Date().toISOString()});
 try{workerExit=await new Promise((done,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>done({code,signal}))})}finally{await new Promise(done=>stream.end(done))}report.workerExit=workerExit;
 for(const path of [resolve(out,'worker.log'),resolve(out,'worker-process.json'),...(existsSync(records)?readdirSync(records).map(n=>resolve(records,n)):[])])pins[path]=await fileState(path);
 if(existsSync(resolve(records,'failure.json')))report.workerFailure=read(resolve(records,'failure.json'));
 db=open();const afterStamp=stamp(db),after=digest(db),prior=digest(db,through);save('after-logical.json',after);
 if(workerExit.code===0){
  const result=read(resolve(records,'result.lossless.json'));assert(result.fieldStepAccepted&&result.finalLifecycleCurrentProven);
  const early=result.boundary==='V235_PHYSICAL_BOUNDARY_EARLY_STOP';
  if(early){assert.equal(result.normalLifecycleAdvances,1);assert.equal(result.finalViewReference.sourceId,'physical-fixture:cut13:view');assert.equal(result.observationAccepted,false);assert.equal(result.decisionAccepted,false)}
  else{assert.equal(result.boundary,'V235_INITIAL_OBSERVATION_DECISION_CHECKPOINT_ONLY');assert.equal(result.normalLifecycleAdvances,3);assert(result.observationAccepted&&result.decisionAccepted);assert.equal(result.finalViewReference.sourceId,'physical-fixture:cut15:view')}
  assert.equal(result.finalCurrent.view.cut.stage,'field_active');
  assert(result.fieldStep.evaluationTick>=final.actualContact.tick&&result.fieldStep.evaluationTick<=final.actualContact.tick+1000);
  assert.equal(result.initialControlPolicy,'INITIAL_HOLD_UNTIL_FIRST_SENSORY_CUT');
  for(const k of ['officialTerminalProven','terminalSettlementProven','releaseProven','nextTrialProven','fullContinuationComplete','performancePass'])assert.equal(result[k],false);
  const stages=readFileSync(resolve(records,'stages.jsonl'),'utf8').trim().split('\n').map(JSON.parse),index=name=>{const matches=stages.filter(s=>s.name===name);assert.equal(matches.length,1);return matches[0].index};
  assert(index('initial-hold-control-declared-before-acceptance')<index('field-step-source-declared-before-acceptance'));
  assert(index('field-step-source-declared-before-acceptance')<index('normal-field-step-accepted-before-cut13'));
  if(early)assert(index('normal-field-step-accepted-before-cut13')<index('normal-cut13-physical-boundary-early-stop'));
  else{assert(index('observation-source-before-acceptance')<index('normal-observation-accepted'));
   assert(index('decision-source-before-acceptance')<index('normal-decision-accepted'));}
  assert.deepEqual(after.catalog,before.catalog);for(const [t,old] of Object.entries(before.tables))if(!mutable.includes(t))assert.deepEqual(prior.tables[t],old,'old row/rowid differs: '+t);
  const expectedCounts=Object.fromEntries(Object.entries(appendCounts).map(([t,n])=>[t,early?n/3:n]));
  assert.deepEqual(Object.fromEntries(appendTables.map(t=>[t,after.tables[t].rows-before.tables[t].rows])),expectedCounts);
  assert.deepEqual(Object.keys(after.tables).filter(t=>JSON.stringify(after.tables[t])!==JSON.stringify(before.tables[t])).sort(),[...appendTables,...mutable].sort());
  const pa=rows(db,'pa_physical_v1_heads'),wa=rows(db,'world_control_heads');assert.deepEqual(wa,worldBefore);assert.deepEqual(pa.filter(r=>r.enrollment_source_id!==enrollment),physicalBefore.filter(r=>r.enrollment_source_id!==enrollment));
  const lastReference=early?result.fieldStepReference:result.decisionReference;
  assert.deepEqual(pa.filter(r=>r.enrollment_source_id===enrollment),[Object.assign(Object.create(null),oldP[0],{operation_ordinal:early?7n:9n,last_owner:lastReference.owner,last_source_id:lastReference.sourceId,last_snapshot_hash:lastReference.snapshotHash})]);
  report.summary={fieldStepAccepted:true,observationAccepted:result.observationAccepted,decisionAccepted:result.decisionAccepted,movementAccepted:result.movementAccepted,movementPending:result.movementPending,finalViewReference:result.finalViewReference,decisionReference:result.decisionReference??null,elapsedTicks:result.fieldStep.evaluationTick-final.actualContact.tick,remaining:early?'UNRESOLVED_BOUNDARY_THEN_OBSERVATION_DECISION_MOVEMENT_OFFICIAL_TERMINAL_SETTLEMENT_RELEASE_AND_NEXT_TRIAL':'MOVEMENT_OFFICIAL_TERMINAL_SETTLEMENT_RELEASE_AND_NEXT_TRIAL'};
  report.oldRowsRowidsCatalogOtherHeadsUnchanged=true;report.expectedAppendsAndPhysicalHeadCas=true;report.earlyBoundary=early;report.pass=true;
 }else{report.oldImmutableDifferences=Object.entries(before.tables).filter(([t,old])=>!mutable.includes(t)&&JSON.stringify(prior.tables[t])!==JSON.stringify(old)).map(([t])=>t);
  report.catalogUnchanged=JSON.stringify(after.catalog)===JSON.stringify(before.catalog);report.postFailureHeads={physical:stored(rows(db,'pa_physical_v1_heads')),world:stored(rows(db,'world_control_heads'))};
  report.error='worker failed; retained stage, failure, head and before/after digests';process.exitCode=1;}
 assert.deepEqual(stamp(db),afterStamp);assert.throws(()=>db.prepare("ATTACH DATABASE ':memory:' AS denied_v235"),/not authorized/);close(db);db=null;report.callerStatePreserved=true;
}catch(e){report.pass=false;report.error=String(e.stack??e);process.exitCode=1}
finally{
 if(db)try{if(db.isTransaction)db.exec('ROLLBACK');db.setAuthorizer(null);db.close()}catch(e){report.pass=false;report.cleanupError=String(e);process.exitCode=1}
 try{for(const [path,before] of Object.entries(retainedBefore))assert.deepEqual(await databaseFiles(path),before,'retained DB changed: '+path);
  if(sourceBefore){report.originalAfter=await databaseFiles(original);assert.deepEqual(report.originalAfter,sourceBefore);report.originalFilesUnchanged=true;report.copyAfter=await databaseFiles(dest)}
  if(parentCheck)await parentCheck();
  for(const [path,pin] of Object.entries(pins))assert.deepEqual(await fileState(path),pin,'artifact changed: '+path);
  for(const b of [entry,digestBundle].filter(Boolean)){assert.deepEqual(await fileState(b.bundlePath),{exists:true,bytes:b.bytes,sha256:b.sha256});for(const [p,v] of Object.entries(b.sourcePins))assert.deepEqual(await fileState(resolve(p)),{exists:true,bytes:v.bytes,sha256:v.sha256},'Source changed: '+p)}
  report.endPinsProven=!!entry&&!!digestBundle;
 }catch(e){report.pass=false;report.pinError=String(e.stack??e);process.exitCode=1}
 save('report.json',report);
}
console.log(JSON.stringify({pass:report.pass,summary:report.summary??null,error:report.error??report.pinError??null}));
