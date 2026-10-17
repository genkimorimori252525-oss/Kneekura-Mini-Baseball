import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strictEqual,deepStrictEqual,throws } from 'node:assert';
import { openSqliteInitialJointPhysicalExecutionStore } from '../../../src/host/world/SqliteInitialJointPhysicalExecutionStore';
import { initialJointExecutionTable,assertNoUnsettledInitialJointExecution } from '../../../src/host/world/InitialJointPhysicalExecutionMetadata';
import { actorHash as hash,actorJson as json } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';

const [inputArg,originalArg,mode]=process.argv.slice(2);
if(!inputArg||!originalArg||!['guards','retry'].includes(mode))throw new Error('requires executed directory, original owned-joint directory and guards|retry');
const input=resolve(inputArg),path=resolve(input,'match.sqlite'),original=resolve(originalArg,'match.sqlite'),Native=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const db=new Native.DatabaseSync(path),old=new Native.DatabaseSync(original,{readOnly:true});
const census=(d:typeof db)=>d.prepare("SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>({name:r.name,sql:r.sql,
  hash:createHash('sha256').update(JSON.stringify(d.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')}));
const before=census(db),originalRows=census(old),expected=JSON.parse(readFileSync(resolve(input,'execution.json'),'utf8'));
deepStrictEqual(before.filter(r=>originalRows.some(o=>o.name===r.name)),originalRows);strictEqual(originalRows.length,74);
const sources=new Map<string,unknown>(),owner=openSqliteInitialJointPhysicalExecutionStore(path,{readAcceptedSource:id=>sources.get(id)??null});
try{
  if(mode==='guards'){
    const scope={careerId:expected.lineage.careerId,gameId:expected.lineage.gameId,playId:expected.lineage.playId};
    throws(()=>assertNoUnsettledInitialJointExecution(db,scope),/executed joint physical work/);
    const row=db.prepare('SELECT * FROM '+initialJointExecutionTable+' WHERE source_id=?').get(expected.source.sourceId)!;
    const corrupt=structuredClone(expected);corrupt.calculation.result.kind='forged-boundary';
    db.prepare('UPDATE '+initialJointExecutionTable+' SET snapshot_json=? WHERE source_id=?').run(json(corrupt),expected.source.sourceId);
    try{throws(()=>owner.readExecution(expected.source.sourceId),/stored source or snapshot hash differs/);}
    finally{db.prepare('UPDATE '+initialJointExecutionTable+' SET snapshot_json=? WHERE source_id=?').run(String(row.snapshot_json),expected.source.sourceId);}
    // A recomputed hash cannot hide executed work by moving only its scope.
    const moved=structuredClone(expected);moved.lineage.playId++;
    db.prepare('UPDATE '+initialJointExecutionTable+' SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(json(moved),hash(moved),expected.source.sourceId);
    try{throws(()=>assertNoUnsettledInitialJointExecution(db,scope),/scope or reference differs/);}
    finally{db.prepare('UPDATE '+initialJointExecutionTable+' SET snapshot_json=?,snapshot_hash=? WHERE source_id=?').run(String(row.snapshot_json),String(row.snapshot_hash),expected.source.sourceId);}
    const duplicate={...expected.source,sourceId:expected.source.sourceId+':second'};sources.set(duplicate.sourceId,duplicate);
    process.stdout.write('CHECK_DUPLICATE_REAL_EXECUTION_REFUSAL\n');
    throws(()=>owner.accept(duplicate.sourceId),/executed joint physical work/);
  }else{
    process.stdout.write('CHECK_CALLBACK_FREE_IDEMPOTENT_ACCEPTANCE\n');
    deepStrictEqual(owner.accept(expected.source.sourceId),expected);
  }
  deepStrictEqual(census(db),before);
  writeFileSync(resolve(input,mode+'-report.json'),JSON.stringify({status:'PASS_NATIVE_EXECUTED_JOINT_'+mode.toUpperCase(),ownerMocks:false,original74TableSchemasAndAllRowsUnchanged:true,
    finalAll76TableSchemasAndRowsRestored:true,duplicateExecutionRefused:mode==='guards',corruptSnapshotRefused:mode==='guards',rehashedMovedScopeRefused:mode==='guards',
    callbackFreeIdempotentAccept:mode==='retry',physicalExecutionAdmitted:true,workloadTotalAdmitted:false,nextMotionAllowed:false,fullMatchVerified:false},null,2)+'\n',{flag:'wx'});
  process.stdout.write('PASS_NATIVE_EXECUTED_JOINT_'+mode.toUpperCase()+'\n');
}finally{owner.close();db.close();old.close();}
