import { expect,it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openSqliteInitialJointRecoveryWorkloadStore,initialJointRecoveryWorkloadTable } from './SqliteInitialJointRecoveryWorkloadStore';
import { openSqliteInitialJointRecoveryExecutionStore,initialJointRecoveryExecutionTable } from './SqliteInitialJointRecoveryExecutionStore';
import { assertNoJointPhysicalDescendantClaims } from './JointPhysicalDescendantClaims';
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');

const ref=<T extends string>(owner:T)=>({owner,sourceId:'original-parent',sourceHash:'a'.repeat(64),snapshotHash:'b'.repeat(64)});
const workloadSource={sourceId:'new-attempt',sourceVersion:'v1',capability:'initial_joint_recovery_cumulative_workload_view_v1',
  recoveryReference:ref('pa_joint_recovery_v1_executions'),coverageHash:'c'.repeat(64),
  assessment:{basis:'EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1',availableAtDay:1,assessmentSourceId:'explicit-test',assessmentVersion:'v1',calibrationSourceId:'explicit-test',calibrationVersion:'v1'},
  participantTotals:Array.from({length:10},(_,i)=>({participantReference:{playerId:'p'+i,bindingHash:'a'.repeat(64),personHash:'b'.repeat(64),baselineSourceId:'b'+i,revision:0,stateHash:'c'.repeat(64)},effortUnits:1}))};
const recoverySource={sourceId:'new-attempt',sourceVersion:'v1',capability:'owned_initial_joint_recovery_execution_v1',
  workloadViewReference:ref('pa_joint_workload_v1_views'),recoveryEndTick:1,
  recoveryModel:{modelId:'c1_post_impact_reference_pose_rest_v1',feedback:'ZERO_DELAY_KINEMATIC_TEST_MODEL',basis:'EXPLICIT_SYNTHETIC_IMPACT_RECOVERY_V1',availableAtDay:1,assessmentSourceId:'explicit-test',assessmentVersion:'v1'},
  capabilityResponse:{playerId:'p0',personHash:'a'.repeat(64),projectedStateHash:'b'.repeat(64),calibrationSourceId:'explicit-test',calibrationVersion:'v1',availableAtDay:1,
    fatigueSamples:[{fatigue:0,maximumSweetSpotSpeedMps:10,maximumBodySpeedMps:2},{fatigue:1,maximumSweetSpotSpeedMps:5,maximumBodySpeedMps:1}]}};

for(const kind of ['workload','recovery'] as const)for(const column of ['source_json','snapshot_json'] as const)it(kind+' refuses consumed parents hidden behind moved indexes and duplicate '+column+' keys',()=>{
  const directory=mkdtempSync(join(tmpdir(),'kneekura-recovery-consumed-')),path=join(directory,'test.sqlite'),db=new DatabaseSync(path),
    table=kind==='workload'?initialJointRecoveryWorkloadTable:initialJointRecoveryExecutionTable,
    parent=kind==='workload'?workloadSource.recoveryReference:recoverySource.workloadViewReference,
    moved={...parent,sourceId:'moved-parent'},key=kind==='workload'?'recoveryReference':'workloadViewReference',
    raw='{"'+key+'":'+JSON.stringify(moved)+',"'+key+'":'+JSON.stringify(parent)+'}';
  const schema=kind==='workload'
    ?`CREATE TABLE ${table}(source_id TEXT PRIMARY KEY,recovery_source_id TEXT NOT NULL UNIQUE,previous_workload_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`
    :`CREATE TABLE ${table}(source_id TEXT PRIMARY KEY,parent_execution_source_id TEXT NOT NULL UNIQUE,workload_view_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
  db.exec(schema);db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?)`).run('hidden-row','moved-parent','moved-parent','enrollment',column==='source_json'?raw:'{}','0'.repeat(64),column==='snapshot_json'?raw:'{}','0'.repeat(64));
  const before=JSON.stringify(db.prepare('SELECT * FROM '+table).all()),owner=kind==='workload'
    ?openSqliteInitialJointRecoveryWorkloadStore(path,{readAcceptedAssessment:()=>workloadSource})
    :openSqliteInitialJointRecoveryExecutionStore(path,{readAcceptedCommand:()=>recoverySource});
  try {
    expect(()=>owner.accept('new-attempt')).toThrow(/already consumed or invalid surviving reference/);
    expect(JSON.stringify(db.prepare('SELECT * FROM '+table).all())).toBe(before);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).toHaveLength(1);
  } finally {owner.close();db.close();rmSync(directory,{recursive:true,force:true});}
});
it('detects a previous workload parent hidden in nested duplicate typed references',()=>{
  const db=new DatabaseSync(':memory:'),table=initialJointRecoveryWorkloadTable,parent=ref('pa_joint_workload_v1_views'),moved={...parent,sourceId:'moved'};
  try {
    db.exec(`CREATE TABLE ${table}(previous_workload_source_id TEXT,source_json TEXT,snapshot_json TEXT)`);
    const raw='{"nested":{"previousWorkloadViewReference":'+JSON.stringify(moved)+',"previousWorkloadViewReference":'+JSON.stringify(parent)+'}}';
    db.prepare(`INSERT INTO ${table} VALUES(?,?,?)`).run('moved',raw,'{}');
    expect(()=>assertNoJointPhysicalDescendantClaims(db,parent.owner,parent.sourceId,[{table,indexColumn:'previous_workload_source_id'}])).toThrow(/surviving typed descendant/);
  } finally {db.close();}
});
