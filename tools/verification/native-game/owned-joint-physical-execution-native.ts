import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual,strictEqual,throws } from 'node:assert';
import { openSqliteInitialJointPhysicalExecutionStore,type InitialJointPhysicalRightSource } from '../../../src/host/world/SqliteInitialJointPhysicalExecutionStore';
import { initialJointRightTable,initialJointExecutionTable } from '../../../src/host/world/InitialJointPhysicalExecutionMetadata';
import { readInitialOwnedJointControlPreparation } from '../../../src/host/world/InitialOwnedJointControlPreparationFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';

const [inputArg,outputArg]=process.argv.slice(2);if(!inputArg||!outputArg)throw new Error('requires original owned-joint directory and NEW output directory');
const input=resolve(inputArg),output=resolve(outputArg),original=resolve(input,'match.sqlite'),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(original),wal:existsSync(original+'-wal')&&readFileSync(original+'-wal').length?sha(original+'-wal'):null});
const originalDurable=durable(),expected=JSON.parse(readFileSync(resolve(input,'independent-readback.json'),'utf8'));
deepStrictEqual(originalDurable,expected.beforeDurableContent);strictEqual(expected.tableCount,74);
mkdirSync(output);const path=resolve(output,'match.sqlite'),stage=resolve(output,'input-snapshot.sqlite');copyFileSync(original,stage);
if(originalDurable.wal)copyFileSync(original+'-wal',stage+'-wal');
const Native=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),inputDb=new Native.DatabaseSync(stage,{readOnly:true});
try{await Native.backup(inputDb,path);}finally{inputDb.close();}deepStrictEqual(durable(),originalDurable);
const db=new Native.DatabaseSync(path),census=()=>db.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>({name:r.name,sql:r.sql,
  hash:createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')}));
const before=census(),sources=new Map<string,unknown>(),owner=openSqliteInitialJointPhysicalExecutionStore(path,{readAcceptedSource:id=>sources.get(id)??null});
const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
try{
  strictEqual(before.length,74);strictEqual(owner.accept('missing').kind,'pending');deepStrictEqual(census(),before);
  const controls=JSON.parse(readFileSync(resolve(input,'request.json'),'utf8'));
  const source:InitialJointPhysicalRightSource={sourceId:'authored-joint:physical-right',sourceVersion:'native-actual-prefix-v1',capability:'initial_joint_physical_right_v1',
    calculation:{controls,throughTick:controls.batter.throughTick}};
  for(const [name,change]of [
    ['expired',(s:any)=>{s.calculation.throughTick+=1000000;}],
    ['forged-original',(s:any)=>{s.calculation.controls.batter.decisionReference.sourceHash='0'.repeat(64);} ],
    ['injected-result',(s:any)=>{s.result={kind:'bat_contact'};}],
  ]as const){const s={...structuredClone(source),sourceId:source.sourceId+':'+name};change(s);sources.set(s.sourceId,s);throws(()=>owner.accept(s.sourceId));deepStrictEqual(census(),before);}
  sources.set(source.sourceId,source);const right=owner.accept(source.sourceId);if(right.kind!=='initial_joint_physical_right_v1')throw new Error('prospective right missing');
  strictEqual(right.motionIssued,false);strictEqual(db.prepare('SELECT count(*) n FROM '+initialJointExecutionTable).get()!.n,0);
  const executionSource={sourceId:'authored-joint:physical-execution',sourceVersion:'native-actual-prefix-v1',capability:'initial_joint_physical_execution_v1',rightReference:reference(initialJointRightTable,right)};
  const forged={...executionSource,sourceId:executionSource.sourceId+':forged',rightReference:{...executionSource.rightReference,snapshotHash:'0'.repeat(64)}};sources.set(forged.sourceId,forged);
  const beforeExecution=census();throws(()=>owner.accept(forged.sourceId));deepStrictEqual(census(),beforeExecution);
  sources.set(executionSource.sourceId,executionSource);const execution=owner.accept(executionSource.sourceId);
  if(execution.kind!=='initial_joint_physical_execution_v1')throw new Error('physical execution missing');
  strictEqual(execution.motionIssued,true);strictEqual(execution.physicalExecutionAdmitted,true);strictEqual(execution.stop.nextMotionAllowed,false);
  strictEqual(execution.stop.workloadTotalAdmitted,false);strictEqual(execution.physicalWork.assessmentStatus,'REQUIRES_NONEMPTY_WORKLOAD_SETTLEMENT');
  const r=execution.calculation.result,m=execution.executedThroughMoment;
  deepStrictEqual(m.ball,createSourceFreeBallKernel(execution.calculation.input.pitch.descriptor).evaluateAt(m.elapsedSeconds,'incoming').moment.ball);
  if(r.kind==='bat_contact'){
    strictEqual(execution.timeline.events.length,1);strictEqual(execution.timeline.events[0].kind,'BatBallContact');
    deepStrictEqual(execution.timeline.events[0].payload.contact.exitVelocity,r.contact.exitVelocity);
    deepStrictEqual(execution.timeline.events[0].payload.contact.exitSpin,r.contact.exitSpin);strictEqual(execution.stop.postImpactBatControlRequiresSuccessor,true);
  }
  // Old parked-actor/zero-work path may no longer advance this physical play.
  throws(()=>readInitialOwnedJointControlPreparation(path,controls),/executed joint physical work/);
  const duplicate={...executionSource,sourceId:executionSource.sourceId+':second'};sources.set(duplicate.sourceId,duplicate);
  const after=census();throws(()=>owner.accept(duplicate.sourceId),/executed joint physical work/);deepStrictEqual(census(),after);
  const reopened=openSqliteInitialJointPhysicalExecutionStore(path);
  try{deepStrictEqual(reopened.accept(executionSource.sourceId),execution);}finally{reopened.close();}
  const row=db.prepare('SELECT * FROM '+initialJointExecutionTable+' WHERE source_id=?').get(executionSource.sourceId)!;
  const bad=JSON.parse(String(row.snapshot_json));bad.calculation.result.kind='forged-boundary';
  db.prepare('UPDATE '+initialJointExecutionTable+' SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(bad),executionSource.sourceId);
  try{throws(()=>owner.readExecution(executionSource.sourceId));}finally{db.prepare('UPDATE '+initialJointExecutionTable+' SET snapshot_json=? WHERE source_id=?').run(String(row.snapshot_json),executionSource.sourceId);}
  deepStrictEqual(census(),after);deepStrictEqual(after.filter(r=>before.some(b=>b.name===r.name)),before);deepStrictEqual(durable(),originalDurable);
  save('right-source.json',source);save('right.json',right);save('execution-source.json',executionSource);save('execution.json',execution);save('controls.json',controls);save('original-table-census.json',before);
  save('native-report.json',{status:'PASS_NATIVE_ACTUAL_JOINT_PHYSICAL_PREFIX',ownerMocks:false,originalTableCount:74,tableCount:after.length,
    original74TablesUnchanged:true,originalInputDurableContentUnchanged:true,realRightConsumed:true,physicalExecutionAdmitted:true,motionIssued:true,
    actualBoundaryKind:r.kind,actualBoundaryTick:m.ball.tick,exactElapsedSeconds:m.elapsedSeconds,
    canonicalContactEvents:execution.timeline.events.filter(e=>e.kind==='BatBallContact').length,oldParkedControlAdvanceRefused:true,duplicateExecutionRefused:true,
    callbackFreeReplay:true,corruptExecutionRefusedAndRestored:true,workloadTotalAdmitted:false,requiresWorkloadSettlement:true,nextMotionAllowed:false,fullMatchVerified:false});
  process.stdout.write('PASS_NATIVE_ACTUAL_JOINT_PHYSICAL_PREFIX\n');
}catch(error){save('rejected-execution.json',{error:error instanceof Error?error.message:String(error),originalInputDurableContentUnchanged:JSON.stringify(durable())===JSON.stringify(originalDurable)});throw error;}
finally{owner.close();db.close();}
