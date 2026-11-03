import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync,existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { readInitialJointPhysicalExecutionFromSqlite } from '../../../src/host/world/SqliteInitialJointPhysicalExecutionStore';
import { initialJointExecutionTable } from '../../../src/host/world/InitialJointPhysicalExecutionMetadata';
import { prepareInitialOwnedJointControlFromSqlite } from '../../../src/host/world/InitialOwnedJointControlPreparationFromSqlite';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';

const [inputArg,mode]=process.argv.slice(2);if(!inputArg||mode!==undefined&&!['recover_committed','verify_final'].includes(mode))throw new Error('requires executed joint physical directory and optional recover_committed|verify_final');
const input=resolve(inputArg),path=resolve(input,'match.sqlite');
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=()=>({main:sha(path),wal:existsSync(path+'-wal')&&readFileSync(path+'-wal').length?sha(path+'-wal'):null});
const beforeDurable=durable(),Native=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),db=new Native.DatabaseSync(path,{readOnly:true});
const census=()=>({schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all(),rows:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,
  createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')])});
try{
  db.exec('PRAGMA query_only=1; BEGIN');const before=census();strictEqual(before.rows.length,76);
  const expected=mode==='recover_committed'?JSON.parse(String(db.prepare('SELECT snapshot_json FROM '+initialJointExecutionTable+' WHERE source_id=?').get('authored-joint:physical-execution')?.snapshot_json))
    :JSON.parse(readFileSync(resolve(input,'execution.json'),'utf8'));
  process.stdout.write('START_COLD_NORMAL_OWNER_REPLAY\n');
  const actual=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readInitialJointPhysicalExecutionFromSqlite(db,reference(initialJointExecutionTable,expected))));
  deepStrictEqual(actual,expected);
  process.stdout.write('AUTHENTICATED_EXECUTED_PREFIX\n');
  const rightRow=db.prepare('SELECT * FROM pa_initial_joint_v1_rights WHERE source_id=?').get(actual.source.rightReference.sourceId)!;
  const right=JSON.parse(String(rightRow.snapshot_json)),controls=right.source.calculation.controls;
  throws(()=>withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>prepareInitialOwnedJointControlFromSqlite(db,controls))),/executed joint physical work/);
  deepStrictEqual(census(),before);db.exec('COMMIT');deepStrictEqual(durable(),beforeDurable);
  if(mode==='recover_committed'){
    const save=(name:string,value:unknown)=>writeFileSync(resolve(input,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
    save('execution.json',actual);save('execution-source.json',actual.source);save('right.json',right);save('right-source.json',right.source);save('controls.json',controls);
  }
  const priorRecovery=mode==='verify_final'?JSON.parse(readFileSync(resolve(input,'independent-readback.json'),'utf8')):null;
  writeFileSync(resolve(input,mode==='verify_final'?'final-readback-v2.json':'independent-readback.json'),JSON.stringify({status:'PASS_COLD_OS_READONLY_ACTUAL_JOINT_EXECUTION_REPLAY',ownerMocks:false,authorCallbacks:false,
    tableCount:before.rows.length,allSchemasAndRowsUnchanged:true,durableContentUnchanged:true,beforeDurableContent:beforeDurable,
    recoveredCommittedPrefix:mode==='recover_committed',originalOneShotVerificationTimedOut:mode==='recover_committed'||priorRecovery?.originalOneShotVerificationTimedOut===true,
    physicalExecutionAdmitted:actual.physicalExecutionAdmitted,actualBoundaryKind:actual.calculation.result.kind,canonicalContactEvents:actual.timeline.events.filter(e=>e.kind==='BatBallContact').length,
    oldParkedAdvanceRefused:true,workloadTotalAdmitted:false,nextMotionAllowed:false,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_COLD_OS_READONLY_ACTUAL_JOINT_EXECUTION_REPLAY\n');
}finally{db.close();}
