import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { copyFileSync,existsSync,mkdirSync,readFileSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual,strictEqual,throws } from 'node:assert';
import { openSqliteInitialJointRecoveryExecutionStore,readInitialJointRecoveryExecutionFromSqlite,initialJointRecoveryExecutionTable } from '../../../src/host/world/SqliteInitialJointRecoveryExecutionStore';
import { initialJointRecoveryCommandInput,type AcceptedInitialJointRecoveryCommand } from '../../../src/host/world/InitialJointRecoveryCommand';
import { openSqliteInitialJointWorkloadViewStore } from '../../../src/host/world/SqliteInitialJointWorkloadViewStore';
import { openSqliteInitialJointPhysicalExecutionStore } from '../../../src/host/world/SqliteInitialJointPhysicalExecutionStore';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { cloneInert } from '../../../src/core/adjudication/OfficialWindowPolicy';
import { actorJson as json } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';

const [mode,inputArg,outputArg]=process.argv.slice(2);if(!['prepare','accept','guards','readback'].includes(mode)||!inputArg||!outputArg)throw new Error('requires prepare|accept|guards|readback, original workload directory, recovery directory');
const input=resolve(inputArg),output=resolve(outputArg),original=resolve(input,'match.sqlite'),path=resolve(output,'match.sqlite');
const Native=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'),sha=(p:string)=>createHash('sha256').update(readFileSync(p)).digest('hex');
const durable=(p:string)=>({main:sha(p),wal:existsSync(p+'-wal')&&readFileSync(p+'-wal').length?sha(p+'-wal'):null}),originalDurable=durable(original);
const prior=JSON.parse(readFileSync(resolve(input,'independent-readback.json'),'utf8'));deepStrictEqual(originalDurable,prior.beforeDurableContent);
const census=(db:InstanceType<typeof Native.DatabaseSync>)=>({schema:db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master ORDER BY type,name").all().map(r=>({...r})),
  rows:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>[r.name,createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+String(r.name).replaceAll('"','""')+'"').all().map(v=>JSON.stringify(v)).sort())).digest('hex')])});
const save=(name:string,v:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
if(mode==='prepare'){
  mkdirSync(output);const stage=resolve(output,'input-snapshot.sqlite');copyFileSync(original,stage);if(originalDurable.wal)copyFileSync(original+'-wal',stage+'-wal');
  const source=new Native.DatabaseSync(stage,{readOnly:true});try{await Native.backup(source,path);}finally{source.close();}
  const db=new Native.DatabaseSync(path,{readOnly:true});try{
    const before=census(db);strictEqual(before.rows.length,77);const view=JSON.parse(readFileSync(resolve(input,'view.json'),'utf8'));
    const b=view.participants.find((p:any)=>p.effortUnits===.75);if(!b)throw new Error('original declared synthetic batter assessment missing');
    // Candidate Source data only. Adoption below reauthenticates every original
    // owner, exact person/state and current World; this JSON is not its proof.
    const command:AcceptedInitialJointRecoveryCommand={sourceId:'authored-joint:actual-recovery',sourceVersion:'explicit-synthetic-current-response-v1',capability:'owned_initial_joint_recovery_execution_v1',
      workloadViewReference:reference('pa_joint_workload_v1_views',view),recoveryEndTick:11134216,
      recoveryModel:{modelId:'c1_post_impact_reference_pose_rest_v1',feedback:'ZERO_DELAY_KINEMATIC_TEST_MODEL',basis:'EXPLICIT_SYNTHETIC_IMPACT_RECOVERY_V1',availableAtDay:b.activity.atDay,
        assessmentSourceId:'explicit-synthetic-kinematic-recovery-not-neural-measurement',assessmentVersion:'v1'},
      capabilityResponse:{playerId:b.playerId,personHash:b.participantReference.personHash,projectedStateHash:b.projectedStateHash,
        calibrationSourceId:'explicit-synthetic-fatigue-to-SI-ceiling-test-only',calibrationVersion:'v1',availableAtDay:b.activity.atDay,
        fatigueSamples:[{fatigue:0,maximumSweetSpotSpeedMps:50,maximumBodySpeedMps:5},{fatigue:1,maximumSweetSpotSpeedMps:40,maximumBodySpeedMps:4}]}};
    initialJointRecoveryCommandInput(command);save('source.json',command);save('before-census.json',before);deepStrictEqual(durable(original),originalDurable);
    save('prepare-report.json',{status:'PREPARED_EXPLICIT_SYNTHETIC_RECOVERY_SOURCE_NOT_ADOPTED',originalInputUnchanged:true,motionIssued:false});
  }finally{db.close();}
}else if(mode==='accept'){
  const source=JSON.parse(readFileSync(resolve(output,'source.json'),'utf8')),before=JSON.parse(readFileSync(resolve(output,'before-census.json'),'utf8'));
  const owner=openSqliteInitialJointRecoveryExecutionStore(path,{readAcceptedCommand:id=>id===source.sourceId?source:null});
  try{
    process.stdout.write('ADOPT_AUTHENTIC_POST_IMPACT_RECOVERY\n');const v=owner.accept(source.sourceId);if(v.kind==='pending')throw new Error('explicit command pending');
    strictEqual(v.physicalExecutionAdmitted,true);strictEqual(v.motionIssued,true);strictEqual(v.effectiveCapability.maximumSweetSpotSpeedMps,49.25);strictEqual(v.effectiveCapability.maximumBodySpeedMps,4.925);
    strictEqual(v.executedThroughMoment.elapsedSeconds>v.issuedAtMoment.elapsedSeconds,true);strictEqual(v.nextMotionAllowed,false);
    const db=new Native.DatabaseSync(path,{readOnly:true});try{
      const after=census(db);strictEqual(after.rows.length,78);deepStrictEqual(after.rows.filter(r=>r[0]!==initialJointRecoveryExecutionTable),before.rows);
      deepStrictEqual(after.schema.filter(r=>r.tbl_name!==initialJointRecoveryExecutionTable),before.schema);deepStrictEqual(durable(original),originalDurable);
      save('execution.json',v);save('accept-report.json',{status:'PASS_NATIVE_OWNED_RECOVERY_EXECUTION',ownerMocks:false,tableCount:78,original77SchemasAndRowsUnchanged:true,
        physicalExecutionAdmitted:true,motionIssued:true,kind:v.result.kind,fromElapsedSeconds:v.issuedAtMoment.elapsedSeconds,throughElapsedSeconds:v.executedThroughMoment.elapsedSeconds,
        throughTick:v.executedThroughMoment.ball.tick,effectiveCapability:v.effectiveCapability,recoveryModelBasis:v.recoveryModelBasis,neuralReactionModel:v.neuralReactionModel,
        muscleTorqueCalibrated:false,requiresCumulativeWorkloadReassessment:true,nextMotionAllowed:false,fullMatchVerified:false});
    }finally{db.close();}
  }finally{owner.close();}
}else if(mode==='guards'){
  const value=JSON.parse(readFileSync(resolve(output,'execution.json'),'utf8')),db=new Native.DatabaseSync(path),before=census(db),sources=new Map<string,unknown>();
  const owner=openSqliteInitialJointRecoveryExecutionStore(path,{readAcceptedCommand:id=>sources.get(id)??null});
  try{
    const duplicate={...value.source,sourceId:value.source.sourceId+':duplicate'};sources.set(duplicate.sourceId,duplicate);throws(()=>owner.accept(duplicate.sourceId),/already consumed/);
    const row=db.prepare('SELECT * FROM '+initialJointRecoveryExecutionTable+' WHERE source_id=?').get(value.source.sourceId)!,changed=structuredClone(value);changed.effectiveCapability.maximumBodySpeedMps=100;
    db.prepare('UPDATE '+initialJointRecoveryExecutionTable+' SET snapshot_json=? WHERE source_id=?').run(JSON.stringify(changed),value.source.sourceId);
    try{throws(()=>owner.read(value.source.sourceId),/hash differs/);}finally{db.prepare('UPDATE '+initialJointRecoveryExecutionTable+' SET snapshot_json=? WHERE source_id=?').run(String(row.snapshot_json),value.source.sourceId);}
    for(const [table,id,open]of [
      ['pa_joint_workload_v1_views',value.workloadViewReference.sourceId,()=>openSqliteInitialJointWorkloadViewStore(path)],
      ['pa_initial_joint_v1_executions',value.consumedParentReference.sourceId,()=>openSqliteInitialJointPhysicalExecutionStore(path)],
    ]as const){const originalRow=db.prepare('SELECT * FROM '+table+' WHERE source_id=?').get(id)!;db.prepare('DELETE FROM '+table+' WHERE source_id=?').run(id);
      try{const originalOwner=open();try{if('readExecution'in originalOwner)throws(()=>originalOwner.readExecution(id),/surviving/);else throws(()=>originalOwner.read(id),/surviving/);}finally{originalOwner.close();}}
      finally{db.prepare('INSERT INTO '+table+'('+Object.keys(originalRow).join(',')+') VALUES('+Object.keys(originalRow).map(()=>'?').join(',')+')').run(...Object.values(originalRow));}
    }
    // Raw typed refs must still prevent repair when an indexed mirror and the
    // last parsed duplicate key both hide the original workload view identity.
    const viewId=value.workloadViewReference.sourceId,viewRow=db.prepare('SELECT * FROM pa_joint_workload_v1_views WHERE source_id=?').get(viewId)!;
    const moved=structuredClone(value.source);moved.workloadViewReference.sourceId='moved-view';
    const hidden=JSON.stringify(moved).replace('"sourceId":"moved-view"','"sourceId":'+JSON.stringify(viewId)+',"sourceId":"moved-view"');
    db.prepare('DELETE FROM pa_joint_workload_v1_views WHERE source_id=?').run(viewId);
    db.prepare('UPDATE '+initialJointRecoveryExecutionTable+' SET workload_view_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?').run('moved-view',hidden,'{}',value.source.sourceId);
    try{const viewOwner=openSqliteInitialJointWorkloadViewStore(path);try{throws(()=>viewOwner.read(viewId),/surviving typed/);}finally{viewOwner.close();}}
    finally{
      db.prepare('UPDATE '+initialJointRecoveryExecutionTable+' SET workload_view_source_id=?,source_json=?,snapshot_json=? WHERE source_id=?').run(String(row.workload_view_source_id),String(row.source_json),String(row.snapshot_json),value.source.sourceId);
      db.prepare('INSERT INTO pa_joint_workload_v1_views('+Object.keys(viewRow).join(',')+') VALUES('+Object.keys(viewRow).map(()=>'?').join(',')+')').run(...Object.values(viewRow));
    }
    deepStrictEqual(census(db),before);save('guards-report.json',{status:'PASS_NATIVE_RECOVERY_DUPLICATE_TAMPER_MISSING_OWNER_REFUSAL',duplicateExecutionRefused:true,snapshotTamperRefusedAndRestored:true,
      missingWorkloadAndInitialExecutionRepairRefused:true,hiddenDuplicateKeyTypedWorkloadClaimRefused:true,all78SchemasAndRowsRestored:true});
  }finally{owner.close();db.close();}
}else{
  const value=JSON.parse(readFileSync(resolve(output,'execution.json'),'utf8')),db=new Native.DatabaseSync(path,{readOnly:true}),before=census(db),beforeDurable=durable(path);
  try{
    db.exec('PRAGMA query_only=1; BEGIN');process.stdout.write('COLD_READ_AUTHENTIC_RECOVERY_EXECUTION\n');
    const actual=withBattedWorldPhysicalReadTraversal(db,()=>withSamePaLifecycleReadPhase(db,()=>readInitialJointRecoveryExecutionFromSqlite(db,reference(initialJointRecoveryExecutionTable,value))));
    // Native owners persist canonical inert JSON, whose number model has no
    // signed zero. Validate every value first; compare that exact persisted
    // representation without changing physical poses, velocities or clocks.
    strictEqual(json(cloneInert(actual)),json(value));deepStrictEqual(census(db),before);db.exec('COMMIT');deepStrictEqual(durable(path),beforeDurable);deepStrictEqual(durable(original),originalDurable);
    save('independent-readback.json',{status:'PASS_COLD_OS_READONLY_RECOVERY_EXECUTION',ownerMocks:false,authorCallbacks:false,tableCount:78,allSchemasAndRowsUnchanged:true,durableContentUnchanged:true,
      beforeDurableContent:beforeDurable,physicalExecutionAdmitted:true,motionIssued:true,requiresCumulativeWorkloadReassessment:true,nextMotionAllowed:false,fullMatchVerified:false});
    process.stdout.write('PASS_COLD_OS_READONLY_RECOVERY_EXECUTION\n');
  }finally{db.close();}
}
