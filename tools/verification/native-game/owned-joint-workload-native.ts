import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual,strictEqual,throws } from 'node:assert';
import { openSqliteInitialJointWorkloadViewStore,readInitialJointWorkloadBasisFromSqlite,readInitialJointWorkloadViewFromSqlite,initialJointWorkloadViewTable } from '../../../src/host/world/SqliteInitialJointWorkloadViewStore';
import { initialJointExecutionTable } from '../../../src/host/world/InitialJointPhysicalExecutionMetadata';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import type { AcceptedInitialJointWorkloadView } from '../../../src/host/world/InitialJointWorkloadProjection';

const [mode,inputArg,outputArg]=process.argv.slice(2);if(!['prepare','accept','readback','tamper'].includes(mode)||!inputArg||!outputArg)throw new Error('requires prepare|accept|readback|tamper, original executed directory, workload directory');
const input=resolve(inputArg),output=resolve(outputArg),original=resolve(input,'match.sqlite'),path=resolve(output,'match.sqlite');
const Native=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=(p:string)=>({main:sha(p),wal:existsSync(p+'-wal')&&readFileSync(p+'-wal').length?sha(p+'-wal'):null});
const originalDurable=durable(original),closed=JSON.parse(readFileSync(resolve(input,'final-readback-v2.json'),'utf8'));
deepStrictEqual(originalDurable,closed.beforeDurableContent);
const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const census=(db:InstanceType<typeof Native.DatabaseSync>)=>({schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all().map(r=>({...r})),
  rows:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')])});
const proof=<T>(db:InstanceType<typeof Native.DatabaseSync>,body:()=>T)=>{db.exec('PRAGMA query_only=1; BEGIN');try{const v=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,body));db.exec('COMMIT');return v;}finally{if(db.isTransaction)db.exec('ROLLBACK');}};
if(mode==='prepare'){
  mkdirSync(output);const stage=resolve(output,'input-snapshot.sqlite');copyFileSync(original,stage);if(originalDurable.wal)copyFileSync(original+'-wal',stage+'-wal');
  const sourceDb=new Native.DatabaseSync(stage,{readOnly:true});try{await Native.backup(sourceDb,path);}finally{sourceDb.close();}
  const db=new Native.DatabaseSync(path,{readOnly:true});try{
    const before=census(db);strictEqual(before.rows.length,76);
    const execution=JSON.parse(readFileSync(resolve(input,'execution.json'),'utf8'));
    process.stdout.write('READ_AUTHENTIC_EXECUTED_WORK_BASIS\n');
    const basis=proof(db,()=>readInitialJointWorkloadBasisFromSqlite(db,reference(initialJointExecutionTable,execution)));
    const source:AcceptedInitialJointWorkloadView={sourceId:'authored-joint:nonempty-workload',sourceVersion:'explicit-synthetic-prefix-assessment-v1',capability:'initial_joint_cumulative_workload_view_v1',
      executionReference:basis.executionReference,coverageHash:basis.coverageHash,
      assessment:{basis:'EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1',availableAtDay:basis.gameDay,assessmentSourceId:'synthetic-executed-interval-effort-assessment',assessmentVersion:'v1',
        calibrationSourceId:'synthetic-test-only-not-named-NLB',calibrationVersion:'v1'},
      participantTotals:basis.originalView.lineage.participantReferences.map(p=>({participantReference:p,
        // Explicit test assessment, NOT a derived physiological measurement or
        // production default. Genuine physical coverage is independently bound.
        effortUnits:p.playerId===execution.calculation.input.pitch.pitcherPlayerId?1.25:basis.activePlayerIds.includes(p.playerId)?.75:0}))};
    deepStrictEqual(census(db),before);deepStrictEqual(durable(original),originalDurable);
    save('basis.json',basis);save('source.json',source);save('before-census.json',before);
    save('prepare-report.json',{status:'PASS_AUTHENTIC_EXECUTED_WORKLOAD_BASIS',original76TablesUnchanged:true,sourceBasis:source.assessment.basis,namedNlbCalibration:false,globalWorkloadCommitted:false,nextMotionAllowed:false});
    process.stdout.write('PASS_AUTHENTIC_EXECUTED_WORKLOAD_BASIS\n');
  }finally{db.close();}
}else if(mode==='accept'){
  const source=JSON.parse(readFileSync(resolve(output,'source.json'),'utf8')),before=JSON.parse(readFileSync(resolve(output,'before-census.json'),'utf8'));
  const owner=openSqliteInitialJointWorkloadViewStore(path,{readAcceptedAssessment:id=>id===source.sourceId?source:null});
  try{
    process.stdout.write('ADOPT_ACTUAL_NONEMPTY_CUMULATIVE_WORK\n');const value=owner.accept(source.sourceId);if(value.kind==='pending')throw new Error('explicit assessment unexpectedly pending');
    strictEqual(value.workloadTotalAdmitted,true);strictEqual(value.globalWorkloadCommitted,false);strictEqual(value.nextMotionAllowed,false);
    const active=value.coverage.activePlayerIds.map(id=>value.participants.find(p=>p.playerId===id)!);
    strictEqual(active.every(p=>p.projectedState.fatigue>p.reservedState.fatigue),true);
    strictEqual(value.participants.every(p=>p.projectedState.revision===p.reservedState.revision+1),true);
    const db=new Native.DatabaseSync(path,{readOnly:true});try{
      const after=census(db);strictEqual(after.rows.length,77);deepStrictEqual(after.rows.filter(r=>r[0]!==initialJointWorkloadViewTable),before.rows);
      deepStrictEqual(after.schema.filter(r=>r.tbl_name!==initialJointWorkloadViewTable),before.schema);
      save('view.json',value);save('accept-report.json',{status:'PASS_NATIVE_NONEMPTY_WORKLOAD_TOTAL_PROJECTION',ownerMocks:false,original76TableSchemasAndRowsUnchanged:true,
        tableCount:77,participantCount:value.participants.length,activeFatigue:active.map(p=>({playerId:p.playerId,effortUnits:p.effortUnits,before:p.reservedState.fatigue,after:p.projectedState.fatigue})),
        sourceBasis:source.assessment.basis,namedNlbCalibration:false,cumulativeFromReservedState:true,workloadTotalAdmitted:true,globalWorkloadCommitted:false,nextMotionAllowed:false,fullMatchVerified:false});
    }finally{db.close();}
  }finally{owner.close();}
}else if(mode==='tamper'){
  const value=JSON.parse(readFileSync(resolve(output,'view.json'),'utf8')),db=new Native.DatabaseSync(path),before=census(db),row=db.prepare('SELECT * FROM '+initialJointWorkloadViewTable+' WHERE source_id=?').get(value.source.sourceId)!;
  const owner=openSqliteInitialJointWorkloadViewStore(path);try{
    const changed=structuredClone(value);changed.participants[0].projectedState.fatigue=0;
    db.prepare('UPDATE '+initialJointWorkloadViewTable+' SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(changed),value.source.sourceId);
    try{throws(()=>owner.read(value.source.sourceId),/hash differs/);}finally{db.prepare('UPDATE '+initialJointWorkloadViewTable+' SET snapshot_json=? WHERE source_id=?').run(String(row.snapshot_json),value.source.sourceId);}
    deepStrictEqual(census(db),before);save('tamper-report.json',{status:'PASS_NATIVE_WORKLOAD_SNAPSHOT_TAMPER_REFUSAL_AND_RESTORE',all77TableSchemasAndRowsRestored:true});
  }finally{owner.close();db.close();}
}else{
  const value=JSON.parse(readFileSync(resolve(output,'view.json'),'utf8')),db=new Native.DatabaseSync(path,{readOnly:true}),before=census(db),beforeDurable=durable(path);
  try{
    process.stdout.write('COLD_READ_NORMAL_WORKLOAD_OWNER\n');const actual=proof(db,()=>readInitialJointWorkloadViewFromSqlite(db,reference(initialJointWorkloadViewTable,value)));
    deepStrictEqual(actual,value);deepStrictEqual(census(db),before);deepStrictEqual(durable(path),beforeDurable);deepStrictEqual(durable(original),originalDurable);
    save('independent-readback.json',{status:'PASS_COLD_OS_READONLY_NONEMPTY_WORKLOAD_VIEW',ownerMocks:false,authorCallbacks:false,tableCount:before.rows.length,allSchemasAndRowsUnchanged:true,
      durableContentUnchanged:true,beforeDurableContent:beforeDurable,workloadTotalAdmitted:true,globalWorkloadCommitted:false,nextMotionAllowed:false,fullMatchVerified:false});
    process.stdout.write('PASS_COLD_OS_READONLY_NONEMPTY_WORKLOAD_VIEW\n');
  }finally{db.close();}
}
