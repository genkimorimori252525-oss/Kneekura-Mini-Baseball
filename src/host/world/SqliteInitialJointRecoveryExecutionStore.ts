import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { queryPostImpactBatBodyWorldV1 } from '../../core/sim/pitch/PostImpactBatBodyWorldV1';
import { actorFreeze as freeze,actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { assertCurrentInitialJointPostImpactBasisFromSqlite,readInitialJointPostImpactBasisFromSqlite } from './SqliteInitialJointWorkloadViewStore';
import { initialJointRecoveryCommandInput,initialJointRecoveryCapabilityAt,type AcceptedInitialJointRecoveryCommand } from './InitialJointRecoveryCommand';
import { assertNoJointPhysicalDescendantClaims } from './JointPhysicalDescendantClaims';

export const initialJointRecoveryExecutionTable='pa_joint_recovery_v1_executions';
export type InitialJointRecoveryExecutionReference=SamePaReference<typeof initialJointRecoveryExecutionTable>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint recovery execution: '+message);}
const same=(a:unknown,b:unknown)=>assert(json(a)===json(b),'source, original dependency or row differs');
const schema=`CREATE TABLE ${initialJointRecoveryExecutionTable}(source_id TEXT PRIMARY KEY,parent_execution_source_id TEXT NOT NULL UNIQUE,workload_view_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
function storage(db:DatabaseSync){
  const rows=(s:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${s}.sqlite_master WHERE lower(name) GLOB 'pa_joint_recovery_v1_*' OR lower(tbl_name) GLOB 'pa_joint_recovery_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const catalog=rows('main');if(!catalog.length)return false;assert(catalog.length===4,'partial or extended namespace');
  const t=catalog.find(r=>r.name===initialJointRecoveryExecutionTable);assert(t?.type==='table'&&t.tbl_name===initialJointRecoveryExecutionTable&&t.sql===schema,'schema differs');
  const columns=['source_id','parent_execution_source_id','workload_view_source_id','enrollment_source_id','source_json','source_hash','snapshot_json','snapshot_hash'],actual=db.prepare('PRAGMA main.table_xinfo('+initialJointRecoveryExecutionTable+')').all();
  assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i]&&c.type==='TEXT'&&c.notnull===(i===0?0:1)&&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'columns differ');
  const indexes=db.prepare('PRAGMA main.index_list('+initialJointRecoveryExecutionTable+')').all();assert(indexes.length===3,'index count differs');
  [['source_id'],['parent_execution_source_id'],['workload_view_source_id']].forEach((keys,i)=>{
    const name='sqlite_autoindex_'+initialJointRecoveryExecutionTable+'_'+(i+1),r=catalog.find(v=>v.name===name),ix=indexes.find(v=>v.name===name);
    assert(r?.type==='index'&&r.tbl_name===initialJointRecoveryExecutionTable&&r.sql===null&&ix?.unique===1&&ix.partial===0&&ix.origin===(i===0?'pk':'u'),'index identity differs');
    const info=db.prepare('PRAGMA main.index_xinfo('+name+')').all();same(info.filter(c=>c.key===1).map(c=>c.name),keys);
    assert(info.length===2&&info.every(c=>c.desc===0&&c.coll==='BINARY')&&info.at(-1)?.cid===-1,'index columns differ');
  });return true;
}
function derive(db:DatabaseSync,source:AcceptedInitialJointRecoveryCommand,current:boolean){
  const b=(current?assertCurrentInitialJointPostImpactBasisFromSqlite:readInitialJointPostImpactBasisFromSqlite)(db,source.workloadViewReference),w=b.execution.calculation.input;
  const participant=b.workload.participants.find(p=>p.playerId===w.batterPlayerId),person=b.workload.lineage.participantReferences.find(p=>p.playerId===w.batterPlayerId);
  assert(participant&&person&&source.capabilityResponse.playerId===w.batterPlayerId&&source.capabilityResponse.personHash===person.personHash
    &&source.capabilityResponse.projectedStateHash===participant.projectedStateHash,'person/current projected response state differs');
  assert(source.recoveryModel.availableAtDay<=b.gameDay&&source.capabilityResponse.availableAtDay<=b.gameDay,'future recovery model or response');
  assert(source.capabilityResponse.fatigueSamples.every(p=>p.maximumSweetSpotSpeedMps<=w.batterControl.bat.maximumSweetSpotSpeedMps&&p.maximumBodySpeedMps<=w.batterControl.body.maximumSpeedMps),'response exceeds original accepted SI ceiling');
  const effective=initialJointRecoveryCapabilityAt(source,participant.projectedState.fatigue),input={version:'post_impact_bat_body_world_v1' as const,throughTick:source.recoveryEndTick,
    control:{version:'post_impact_bat_body_control_v1' as const,world:w,recoveryEndTick:source.recoveryEndTick,...effective}};
  const result=queryPostImpactBatBodyWorldV1(input);assert(result.kind!=='unresolved','unresolved physical prefix cannot be adopted');
  assert(result.moment.elapsedSeconds>b.execution.executedThroughMoment.elapsedSeconds,'executed prefix must advance actual physical time');
  return freeze({kind:'initial_joint_recovery_executed_v1' as const,source,lineage:b.execution.lineage,
    consumedParentReference:b.workload.source.executionReference,workloadViewReference:source.workloadViewReference,
    issuedAtMoment:b.execution.executedThroughMoment,effectiveCapability:{...effective,projectedFatigue:participant.projectedState.fatigue,projectedStateHash:participant.projectedStateHash},
    input,result,timeline:b.workload.timeline,executedThroughMoment:result.moment,
    physicalWork:{kind:'executed_joint_recovery_prefix_v1' as const,fromMoment:b.execution.executedThroughMoment,throughMoment:result.moment,
      previousWorkloadViewReference:source.workloadViewReference,assessmentStatus:'REQUIRES_NEW_CUMULATIVE_WORKLOAD_ASSESSMENT' as const},
    physicalExecutionAdmitted:true as const,motionIssued:true as const,capabilityResponseAdmitted:true as const,
    recoveryModelBasis:source.recoveryModel.basis,neuralReactionModel:source.recoveryModel.feedback,muscleTorqueCalibrated:false as const,
    requiresPhysicalSuccessor:true as const,requiresCumulativeWorkloadReassessment:true as const,nextMotionAllowed:false as const,fullMatchVerified:false as const});
}
export type InitialJointRecoveryExecution=ReturnType<typeof derive>;
const rowFor=(v:InitialJointRecoveryExecution)=>({source_id:v.source.sourceId,parent_execution_source_id:v.consumedParentReference.sourceId,
  workload_view_source_id:v.workloadViewReference.sourceId,enrollment_source_id:v.lineage.enrollmentReference.sourceId,
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
function read(db:DatabaseSync,id:string){
  const absent=()=>{assertNoJointPhysicalDescendantClaims(db,initialJointRecoveryExecutionTable,id,[
    {table:'pa_joint_recovery_workload_v1_views',indexColumn:'recovery_source_id'},
    {table:'pa_joint_field_successor_v1_executions',indexColumn:'recovery_source_id'}]);return null;};
  if(!storage(db))return absent();
  const rows=db.prepare(`SELECT * FROM ${initialJointRecoveryExecutionTable} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id,id,id);
  assert(rows.length<=1,'duplicate Source identity');if(!rows.length)return absent();const r=rows[0];assert(r.source_id===id,'Source index differs');
  const source=initialJointRecoveryCommandInput(JSON.parse(String(r.source_json)),id),snapshot=JSON.parse(String(r.snapshot_json));
  assert(hash(source)===r.source_hash&&hash(snapshot)===r.snapshot_hash,'Source/snapshot hash differs');const v=derive(db,source,false);same(r,rowFor(v));return v;
}
export function readInitialJointRecoveryExecutionFromSqlite(db:DatabaseSync,ref:InitialJointRecoveryExecutionReference){
  assert(validRef(ref,initialJointRecoveryExecutionTable),'invalid recovery reference');const v=read(db,ref.sourceId);assert(v,'original recovery missing; repair forbidden');same(reference(initialJointRecoveryExecutionTable,v),ref);return v;
}
/** Accepted command is a finite one-shot actuation right. Parent and workload
 * view are consumed atomically/uniquely; no additional motion follows this cut. */
export function openSqliteInitialJointRecoveryExecutionStore(path:string,authority?:Readonly<{readAcceptedCommand:(id:string)=>unknown|null}>){
  assert(text(path)&&(!authority||typeof authority.readAcceptedCommand==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({read:(id:string)=>tx.run(false,proof=>proof(()=>read(db,id)),()=>{}),accept:(id:string)=>{
    assert(text(id),'invalid Source ID');const raw=authority?.readAcceptedCommand(id)??null,source=raw===null?null:initialJointRecoveryCommandInput(raw,id);
    return tx.run(true,(proof,step)=>{
      const prior=proof(()=>read(db,id));if(prior){if(source)same(prior.source,source);return prior;}
      if(!source)return freeze({kind:'pending' as const,reason:'explicit_recovery_model_and_projected_si_response_required'});
      proof(()=>{
        try {assertNoJointPhysicalDescendantClaims(db,'pa_joint_workload_v1_views',source.workloadViewReference.sourceId,
          [{table:initialJointRecoveryExecutionTable,indexColumn:'workload_view_source_id'}]);}
        catch(cause){throw new Error('initial joint recovery execution: physical parent/workload view already consumed or invalid surviving reference',{cause});}
      });
      const v=proof(()=>derive(db,source,true));if(!proof(()=>storage(db)))step(()=>db.exec(schema),0,1);
      const row=rowFor(v);step(()=>{assert(db.prepare(`INSERT INTO ${initialJointRecoveryExecutionTable} VALUES(?,?,?,?,?,?,?,?)`).run(...Object.values(row)).changes===1,'exact insert differs');},1);
      same(proof(()=>read(db,id)),v);return v;
    },v=>{if(v.kind!=='pending')same(read(db,id),v);});},close:()=>tx.close()});
}
