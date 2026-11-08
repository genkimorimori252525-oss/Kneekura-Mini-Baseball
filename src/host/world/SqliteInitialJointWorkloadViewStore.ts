import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorHash as hash,actorJson as json,actorFreeze as freeze,assertPhysicalActorOpenFrame } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readInitialJointPhysicalExecutionFromSqlite } from './SqliteInitialJointPhysicalExecutionStore';
import { readSamePaObservedPitchFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { readHistoricalObservedInitialPitchOperationFromSqlite } from './SqliteObservedInitialPitchStore';
import { readEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { initialJointWorkloadViewInput,projectInitialJointWorkload,type AcceptedInitialJointWorkloadView } from './InitialJointWorkloadProjection';
import { reusableBattedWorldFieldReadSnapshot } from './SqliteBattedWorldFieldStore';
import { assertNoJointPhysicalDescendantClaims } from './JointPhysicalDescendantClaims';

export const initialJointWorkloadViewTable='pa_joint_workload_v1_views';
export type InitialJointWorkloadViewReference=SamePaReference<typeof initialJointWorkloadViewTable>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint workload view: '+message);}
const same=(a:unknown,b:unknown)=>assert(json(a)===json(b),'original dependency, scope or stored row differs');
const schema=`CREATE TABLE ${initialJointWorkloadViewTable}(source_id TEXT PRIMARY KEY,execution_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
function storage(db:DatabaseSync){
  const rows=(s:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${s}.sqlite_master WHERE lower(name) GLOB 'pa_joint_workload_v1_*' OR lower(tbl_name) GLOB 'pa_joint_workload_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const catalog=rows('main');if(!catalog.length)return false;assert(catalog.length===3,'partial or extended namespace');
  const t=catalog.find(r=>r.name===initialJointWorkloadViewTable);assert(t?.type==='table'&&t.tbl_name===initialJointWorkloadViewTable&&t.sql===schema,'schema differs');
  const columns=['source_id','execution_source_id','enrollment_source_id','source_json','source_hash','snapshot_json','snapshot_hash'];
  const actual=db.prepare('PRAGMA main.table_xinfo('+initialJointWorkloadViewTable+')').all();
  assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i]&&c.type==='TEXT'&&c.notnull===(i===0?0:1)&&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'columns differ');
  const indexes=db.prepare('PRAGMA main.index_list('+initialJointWorkloadViewTable+')').all();assert(indexes.length===2,'index count differs');
  [['source_id'],['execution_source_id']].forEach((keys,i)=>{
    const name='sqlite_autoindex_'+initialJointWorkloadViewTable+'_'+(i+1),r=catalog.find(v=>v.name===name),ix=indexes.find(v=>v.name===name);
    assert(r?.type==='index'&&r.tbl_name===initialJointWorkloadViewTable&&r.sql===null&&ix?.unique===1&&ix.partial===0&&ix.origin===(i===0?'pk':'u'),'index differs');
    const info=db.prepare('PRAGMA main.index_xinfo('+name+')').all();same(info.filter(c=>c.key===1).map(c=>c.name),keys);
    assert(info.length===2&&info.every(c=>c.desc===0&&c.coll==='BINARY')&&info.at(-1)?.cid===-1,'index columns differ');
  });return true;
}
function deriveBasis(db:DatabaseSync,ref:SamePaReference<'pa_initial_joint_v1_executions'>){
  const execution=readInitialJointPhysicalExecutionFromSqlite(db,ref),launch=readSamePaObservedPitchFromSqlite(db,execution.launchReference);
  const originalViewReference=launch.action.source.viewReference,original=readHistoricalSamePaExecutionView(db,originalViewReference).view;
  same(original.lineage,execution.lineage);const actor=launch.pitch.originalActor;
  const through=execution.executedThroughMoment.originTick+execution.executedThroughMoment.elapsedSeconds*1e6;
  const activePlayerIds=[execution.calculation.input.pitch.pitcherPlayerId,
    ...(through>execution.calculation.input.batterControl.bat.bridgeStartTick?[execution.calculation.input.batterPlayerId]:[])];
  const coverage={version:'initial_joint_executed_work_coverage_v1' as const,originalViewReference,executionReference:ref,
    launchReference:execution.launchReference,decisionReference:execution.calculation.request.controls.batter.decisionReference,
    lineage:execution.lineage,fromTick:actor.world.tick,throughMoment:execution.executedThroughMoment,
    physicalControlHash:execution.physicalWork.originalJointControlHash,activePlayerIds};
  assert(through>actor.world.tick,'executed coverage must be nonempty');
  return {execution,original,actor,coverage,coverageHash:hash(coverage),activePlayerIds,gameDay:actor.binding.gameDay};
}
// Only this owner seeds completed proofs. Opaque snapshot identity plus the
// existing transaction/query-only/schema/row fences delimit their reuse. No
// native statement, caller proof or cache survives an effect/transaction.
const bases=new WeakMap<object,WeakMap<DatabaseSync,Map<string,ReturnType<typeof deriveBasis>>>>();
function basis(db:DatabaseSync,raw:SamePaReference<'pa_initial_joint_v1_executions'>){
  const ref=cloneInert(raw),snapshot=reusableBattedWorldFieldReadSnapshot(db);if(!snapshot)return deriveBasis(db,ref);
  let connections=bases.get(snapshot);if(!connections){connections=new WeakMap();bases.set(snapshot,connections);}
  let entries=connections.get(db);if(!entries){entries=new Map();connections.set(db,entries);}
  const key=json(ref),old=entries.get(key);if(old)return old;
  const value=freeze(deriveBasis(db,ref));assert(reusableBattedWorldFieldReadSnapshot(db)===snapshot,'completed workload basis read snapshot expired');
  entries.set(key,value);return value;
}
/** Source data for an explicit workload assessment. No guessed effort units,
 * physiological calibration or new control authorization is supplied. */
export function readInitialJointWorkloadBasisFromSqlite(db:DatabaseSync,ref:SamePaReference<'pa_initial_joint_v1_executions'>){
  const b=basis(db,ref);return freeze({kind:'initial_joint_workload_basis_v1' as const,executionReference:ref,coverage:b.coverage,coverageHash:b.coverageHash,
    originalView:b.original,gameDay:b.gameDay,activePlayerIds:b.activePlayerIds,motionIssued:false as const});
}
function assertCurrent(db:DatabaseSync,b:ReturnType<typeof basis>){
  // Dedicated settlement admission for the EXECUTED frontier. Do not relax
  // the old parked-actor current guard or pretend a physical successor exists.
  assertPhysicalActorOpenFrame(db,b.actor);
  const originals=readSamePaOriginalParticipants(db,b.actor);
  for(const p of b.original.participants){const binding=originals.find(x=>x.binding.playerId===p.playerId)?.binding;assert(binding,'original participant missing');
    same(readActualRoleWorkloadState(db,binding.careerId,binding.playerId,undefined,binding.personLinkSourceId),p.reservedState);}
  const decision=readHistoricalObservedInitialPitchOperationFromSqlite(db,b.coverage.decisionReference);
  assert(decision.kind==='observed_initial_decision_v1','original decision kind differs');
  same(db.prepare('SELECT * FROM pa_observed_initial_v1_heads WHERE enrollment_source_id=?').get(b.original.lineage.enrollmentReference.sourceId),
    {enrollment_source_id:b.original.lineage.enrollmentReference.sourceId,launch_source_id:b.execution.launchReference.sourceId,
      operation_ordinal:decision.operationOrdinal,last_source_id:decision.source.sourceId,snapshot_hash:hash(decision)});
  const world=readEmotionWorldRevisionFromSqlite(db,b.original.lineage.careerId);assert(world,'current original World missing');
  same(decision.source.expectedWorld,{careerId:b.original.lineage.careerId,worldRevision:world.head.worldRevision,controlRevision:world.head.control.revision,controlHash:hash(world.head.control)});
}
function derive(db:DatabaseSync,source:AcceptedInitialJointWorkloadView,current:boolean){
  const b=basis(db,source.executionReference);if(current)assertCurrent(db,b);
  const projection=projectInitialJointWorkload(source,{original:b.original,coverageHash:b.coverageHash,gameDay:b.gameDay,activePlayerIds:b.activePlayerIds});
  return freeze({kind:'initial_joint_cumulative_workload_view_v1' as const,source,lineage:b.execution.lineage,coverage:b.coverage,coverageHash:b.coverageHash,
    originalViewReference:b.coverage.originalViewReference,physicalCut:b.execution.executedThroughMoment,timeline:b.execution.timeline,...projection});
}
export type InitialJointWorkloadView=ReturnType<typeof derive>;
const rowFor=(v:InitialJointWorkloadView)=>({source_id:v.source.sourceId,execution_source_id:v.source.executionReference.sourceId,
  enrollment_source_id:v.lineage.enrollmentReference.sourceId,source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
function read(db:DatabaseSync,id:string){
  const absent=()=>{assertNoJointPhysicalDescendantClaims(db,initialJointWorkloadViewTable,id,[{table:'pa_joint_recovery_v1_executions',indexColumn:'workload_view_source_id'},
    {table:'pa_joint_recovery_workload_v1_views',indexColumn:'previous_workload_source_id'}]);return null;};
  if(!storage(db))return absent();
  const rows=db.prepare(`SELECT * FROM ${initialJointWorkloadViewTable} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id,id,id);
  assert(rows.length<=1,'duplicate Source identity');if(!rows.length)return absent();const r=rows[0];assert(r.source_id===id,'Source index differs');
  const source=initialJointWorkloadViewInput(JSON.parse(String(r.source_json)),id),snapshot=JSON.parse(String(r.snapshot_json));
  assert(hash(source)===r.source_hash&&hash(snapshot)===r.snapshot_hash,'Source/snapshot hash differs');
  const v=derive(db,source,false);same(r,rowFor(v));return v;
}
export function readInitialJointWorkloadViewFromSqlite(db:DatabaseSync,ref:InitialJointWorkloadViewReference){
  assert(validRef(ref,initialJointWorkloadViewTable),'invalid view reference');const v=read(db,ref.sourceId);assert(v,'original workload view missing; repair forbidden');same(reference(initialJointWorkloadViewTable,v),ref);return v;
}
/** Same immutable proof's authenticated physical dependencies, not a new
 * motor policy, recalibration or execution right. No stored frame is trusted. */
export function readInitialJointPostImpactBasisFromSqlite(db:DatabaseSync,ref:InitialJointWorkloadViewReference){
  const workload=readInitialJointWorkloadViewFromSqlite(db,ref),b=basis(db,workload.source.executionReference);
  return freeze({workload,execution:b.execution,gameDay:b.gameDay});
}
/** Current admission for the executed frontier only. Old parked-scene guards
 * remain closed; a consumer must still uniquely consume this physical parent. */
export function assertCurrentInitialJointPostImpactBasisFromSqlite(db:DatabaseSync,ref:InitialJointWorkloadViewReference){
  const context=readInitialJointPostImpactBasisFromSqlite(db,ref);assertCurrent(db,basis(db,context.workload.source.executionReference));return context;
}
export function openSqliteInitialJointWorkloadViewStore(path:string,authority?:Readonly<{readAcceptedAssessment:(id:string)=>unknown|null}>){
  assert(text(path)&&(!authority||typeof authority.readAcceptedAssessment==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({read:(id:string)=>tx.run(false,proof=>proof(()=>read(db,id)),()=>{}),accept:(id:string)=>{
    assert(text(id),'invalid Source ID');const raw=authority?.readAcceptedAssessment(id)??null,source=raw===null?null:initialJointWorkloadViewInput(raw,id);
    return tx.run(true,(proof,step)=>{
      const prior=proof(()=>read(db,id));if(prior){if(source)same(prior.source,source);return prior;}
      if(!source)return freeze({kind:'pending' as const,reason:'explicit_nonempty_workload_assessment_required'});
      const v=proof(()=>derive(db,source,true));if(!proof(()=>storage(db)))step(()=>db.exec(schema),0,1);
      const row=rowFor(v);step(()=>{assert(db.prepare(`INSERT INTO ${initialJointWorkloadViewTable} VALUES(?,?,?,?,?,?,?)`).run(...Object.values(row)).changes===1,'exact insert differs');},1);
      same(proof(()=>read(db,id)),v);return v;
    },v=>{if(v.kind!=='pending')same(read(db,id),v);});},close:()=>tx.close()});
}
