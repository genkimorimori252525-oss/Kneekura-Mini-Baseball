import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { recordBatBallContact } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { actorFreeze as freeze,actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { initialJointRightTable,initialJointExecutionTable,initialJointSchemas,assertInitialJointPhysicalStorage as storage } from './InitialJointPhysicalExecutionMetadata';
import { prepareInitialOwnedJointControlFromSqlite,readHistoricalInitialOwnedJointControlFromSqlite } from './InitialOwnedJointControlPreparationFromSqlite';
import { calculateInitialOwnedJointPhysicalFromSqlite,calculateHistoricalInitialOwnedJointPhysicalFromSqlite,type InitialOwnedJointPhysicalCalculationRequestV1 } from './InitialOwnedJointPhysicalCalculationFromSqlite';
import { readSamePaObservedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { assertNoJointPhysicalDescendantClaims } from './JointPhysicalDescendantClaims';

export type InitialJointPhysicalRightSource=Readonly<{sourceId:string;sourceVersion:string;capability:'initial_joint_physical_right_v1';calculation:InitialOwnedJointPhysicalCalculationRequestV1}>;
export type InitialJointPhysicalExecutionSource=Readonly<{sourceId:string;sourceVersion:string;capability:'initial_joint_physical_execution_v1';rightReference:SamePaReference<typeof initialJointRightTable>}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint physical execution: '+message);}
const same=(a:unknown,b:unknown)=>assert(json(a)===json(b),'original source, dependencies or stored row differs');
export function initialJointPhysicalSourceInput(raw:unknown,id?:string){
  const s=cloneInert(raw) as InitialJointPhysicalRightSource|InitialJointPhysicalExecutionSource;
  assert(s&&text(s.sourceId)&&text(s.sourceVersion)&&(id===undefined||s.sourceId===id),'invalid source identity');
  if(s.capability==='initial_joint_physical_right_v1')assert(fields(s,['sourceId','sourceVersion','capability','calculation'])&&fields(s.calculation,['controls','throughTick'])
    &&Number.isSafeInteger(s.calculation.throughTick),'invalid prospective right');
  else assert(s.capability==='initial_joint_physical_execution_v1'&&fields(s,['sourceId','sourceVersion','capability','rightReference'])&&validRef(s.rightReference,initialJointRightTable),'invalid execution source');
  return freeze(s);
}
function deriveRight(db:DatabaseSync,source:InitialJointPhysicalRightSource,current:boolean){
  const joint=(current?prepareInitialOwnedJointControlFromSqlite:readHistoricalInitialOwnedJointControlFromSqlite)(db,source.calculation.controls);
  assert(source.calculation.throughTick>joint.evaluatedAtTick&&source.calculation.throughTick<=joint.throughTick,'right exceeds owned control interval');
  const launch=readSamePaObservedPitchFromSqlite(db,joint.pitcherHandHold.launchReference);
  same(launch.pitch.lineage,joint.lineage);
  return freeze({kind:'initial_joint_physical_right_v1' as const,source,lineage:joint.lineage,launchReference:joint.pitcherHandHold.launchReference,
    issuedAtTick:joint.evaluatedAtTick,throughTick:source.calculation.throughTick,originalJointControlHash:hash(joint),
    originalDispatchRightReference:launch.pitch.source.rightReference,originalPitchConsumerReferences:launch.pitch.consumerReferences,
    motionIssued:false as const});
}
type Right=ReturnType<typeof deriveRight>;
function deriveExecution(db:DatabaseSync,source:InitialJointPhysicalExecutionSource,right:Right,current:boolean){
  same(reference(initialJointRightTable,right),source.rightReference);
  same(deriveRight(db,right.source,current),right);
  const calculation=(current?calculateInitialOwnedJointPhysicalFromSqlite:calculateHistoricalInitialOwnedJointPhysicalFromSqlite)(db,right.source.calculation),r=calculation.result;
  assert(r.kind!=='unresolved','unresolved full physical query cannot execute');
  assert(r.kind!=='scene_result'||r.physical.kind!=='unresolved','unresolved scene query cannot execute');
  const moment=r.kind==='scene_result'?(assert(r.physical.kind!=='unresolved','unresolved'),r.physical.moment):r.moment;
  const launch=readSamePaObservedPitchFromSqlite(db,right.launchReference);
  // Record the actual rigid impulse, not another bat-only contact search or
  // TAKE/count adjudication. Exact sub-tick moment is retained alongside it.
  const timeline=r.kind==='bat_contact'?recordBatBallContact(launch.pitch.beforeTimeline,{tick:r.contact.tick,ballCenter:r.contact.ballCenter,
    point:r.contact.ballSurfacePoint,batPoint:r.contact.batSurfacePoint,normal:r.contact.normal,segmentT:r.contact.segmentT,
    exitVelocity:r.contact.exitVelocity,exitSpin:r.contact.exitSpin}):launch.pitch.beforeTimeline;
  return freeze({kind:'initial_joint_physical_execution_v1' as const,source,lineage:right.lineage,launchReference:right.launchReference,
    rightConsumed:source.rightReference,issuedAtTick:right.issuedAtTick,executedThroughMoment:moment,calculation,timeline,
    // This is a real, nonempty executed interval awaiting an accepted workload
    // assessment. It cannot masquerade as the initial empty/zero TOTAL.
    physicalWork:{kind:'executed_joint_control_prefix_v1' as const,fromTick:right.issuedAtTick,throughMoment:moment,
      batterPlayerId:calculation.input.batterPlayerId,pitcherPlayerId:calculation.input.pitch.pitcherPlayerId,
      originalJointControlHash:right.originalJointControlHash,assessmentStatus:'REQUIRES_NONEMPTY_WORKLOAD_SETTLEMENT' as const},
    stop:{requiresPhysicalSuccessor:true as const,postImpactBatControlRequiresSuccessor:r.kind==='bat_contact',
      workloadTotalAdmitted:false as const,nextMotionAllowed:false as const},physicalExecutionAdmitted:true as const,
    motionIssued:true as const,fullMatchVerified:false as const});
}
type Execution=ReturnType<typeof deriveExecution>;
type Value=Right|Execution;
const rowFor=(v:Value)=>({source_id:v.source.sourceId,launch_source_id:v.launchReference.sourceId,enrollment_source_id:v.lineage.enrollmentReference.sourceId,
  ...(v.kind==='initial_joint_physical_execution_v1'?{right_source_id:v.source.rightReference.sourceId}:{}),
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
function readRight(db:DatabaseSync,id:string):Right|null{
  const row=identityRow(db,initialJointRightTable,id);if(!row)return null;
  const source=initialJointPhysicalSourceInput(JSON.parse(String(row.source_json)),id);assert(source.capability==='initial_joint_physical_right_v1','right source kind differs');
  const v=deriveRight(db,source,false);same(row,rowFor(v));return v;
}
function identityRow(db:DatabaseSync,table:string,id:string){
  const absent=()=>{if(table===initialJointExecutionTable)assertNoJointPhysicalDescendantClaims(db,table,id,[{table:'pa_joint_workload_v1_views',indexColumn:'execution_source_id'},
    {table:'pa_joint_recovery_v1_executions',indexColumn:'parent_execution_source_id'}]);return null;};
  if(!storage(db))return absent();
  const rows=db.prepare(`SELECT * FROM ${table} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id,id,id);
  assert(rows.length<=1,'duplicate source identity');if(!rows.length)return absent();const row=rows[0];assert(row.source_id===id,'source index differs');
  const source=JSON.parse(String(row.source_json)),snapshot=JSON.parse(String(row.snapshot_json));
  assert(hash(source)===row.source_hash&&hash(snapshot)===row.snapshot_hash&&json(snapshot.source)===json(source),'stored source or snapshot hash differs');
  return row;
}
function readExecution(db:DatabaseSync,id:string):Execution|null{
  const row=identityRow(db,initialJointExecutionTable,id);if(!row)return null;
  const source=initialJointPhysicalSourceInput(JSON.parse(String(row.source_json)),id);assert(source.capability==='initial_joint_physical_execution_v1','execution source kind differs');
  const right=readRight(db,source.rightReference.sourceId);assert(right,'original right missing; repair forbidden');
  const v=deriveExecution(db,source,right,false);same(row,rowFor(v));return v;
}
/** Borrowed immutable Native proof. The caller owns the query-only snapshot;
 * this reference authenticates historical execution, never a new right. */
export function readInitialJointPhysicalExecutionFromSqlite(db:DatabaseSync,ref:SamePaReference<typeof initialJointExecutionTable>){
  assert(validRef(ref,initialJointExecutionTable),'invalid execution reference');
  assert(db.isTransaction&&db.prepare('PRAGMA query_only').get()!.query_only===1,'query-only Native proof required');
  const value=readExecution(db,ref.sourceId);assert(value,'original execution missing; repair forbidden');same(reference(initialJointExecutionTable,value),ref);return value;
}
/** One actual finite prefix only. The next physical owner must explicitly
 * adopt its exact boundary, impulse/recoil and settle nonempty work before
 * issuing another motion. Neither old control leases nor zero TOTALs resume. */
export function openSqliteInitialJointPhysicalExecutionStore(path:string,authority?:Readonly<{readAcceptedSource:(id:string)=>unknown|null}>){
  assert(text(path)&&(!authority||typeof authority.readAcceptedSource==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({readRight:(id:string)=>tx.run(false,proof=>proof(()=>readRight(db,id)),()=>{}),
    readExecution:(id:string)=>tx.run(false,proof=>proof(()=>readExecution(db,id)),()=>{}),
    accept:(id:string)=>{
      assert(text(id),'invalid source ID');const raw=authority?.readAcceptedSource(id)??null,s=raw===null?null:initialJointPhysicalSourceInput(raw,id);
      return tx.run(true,(proof,step)=>{
        const prior=proof(()=>{const a=readRight(db,id),b=readExecution(db,id);assert(!(a&&b),'duplicate cross-kind source');return a??b;});
        if(prior){if(s)same(s,prior.source);return prior;}
        if(!s)return freeze({kind:'pending' as const,reason:'accepted_joint_physical_source_required'});
        const value=proof(()=>{
          if(s.capability==='initial_joint_physical_right_v1')return deriveRight(db,s,true);
          const right=readRight(db,s.rightReference.sourceId);assert(right,'owned prospective right required');return deriveExecution(db,s,right,true);
        });
        if(!proof(()=>storage(db)))step(()=>Object.values(initialJointSchemas).forEach(sql=>db.exec(sql)),0,2);
        const table=value.kind==='initial_joint_physical_right_v1'?initialJointRightTable:initialJointExecutionTable,row=rowFor(value);
        step(()=>{assert(db.prepare(`INSERT INTO ${table}(${Object.keys(row).join(',')}) VALUES(${Object.keys(row).map(()=>'?').join(',')})`).run(...Object.values(row)).changes===1,'exact insert differs');},1);
        same(proof(()=>value.kind==='initial_joint_physical_right_v1'?readRight(db,id):readExecution(db,id)),value);return value;
      },v=>{if(v.kind!=='pending')same(v.kind==='initial_joint_physical_right_v1'?readRight(db,id):readExecution(db,id),v);});
    },close:()=>tx.close()});
}
