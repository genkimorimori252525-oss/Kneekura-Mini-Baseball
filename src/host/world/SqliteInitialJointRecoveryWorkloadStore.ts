import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze,actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';
import { readInitialJointRecoveryExecutionFromSqlite,type InitialJointRecoveryExecutionReference } from './SqliteInitialJointRecoveryExecutionStore';
import { readInitialJointWorkloadBasisFromSqlite,readInitialJointWorkloadViewFromSqlite,assertCurrentInitialJointPostImpactBasisFromSqlite } from './SqliteInitialJointWorkloadViewStore';
import { initialJointRecoveryWorkloadViewInput,projectInitialJointRecoveryWorkload,type AcceptedInitialJointRecoveryWorkloadView } from './InitialJointRecoveryWorkloadProjection';
import { assertNoJointPhysicalDescendantClaims } from './JointPhysicalDescendantClaims';
import { reusableBattedWorldFieldReadSnapshot } from './SqliteBattedWorldFieldStore';

export const initialJointRecoveryWorkloadTable='pa_joint_recovery_workload_v1_views';
export type InitialJointRecoveryWorkloadReference=SamePaReference<typeof initialJointRecoveryWorkloadTable>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint recovery workload view: '+message);}
const same=(a:unknown,b:unknown)=>assert(json(a)===json(b),'source, original dependency or stored row differs');
const schema=`CREATE TABLE ${initialJointRecoveryWorkloadTable}(source_id TEXT PRIMARY KEY,recovery_source_id TEXT NOT NULL UNIQUE,previous_workload_source_id TEXT NOT NULL UNIQUE,enrollment_source_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
function storage(db:DatabaseSync){
  const rows=(s:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${s}.sqlite_master WHERE lower(name) GLOB 'pa_joint_recovery_workload_v1_*' OR lower(tbl_name) GLOB 'pa_joint_recovery_workload_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const catalog=rows('main');if(!catalog.length)return false;assert(catalog.length===4,'partial or extended namespace');
  const t=catalog.find(r=>r.name===initialJointRecoveryWorkloadTable);assert(t?.type==='table'&&t.tbl_name===initialJointRecoveryWorkloadTable&&t.sql===schema,'schema differs');
  const columns=['source_id','recovery_source_id','previous_workload_source_id','enrollment_source_id','source_json','source_hash','snapshot_json','snapshot_hash'],actual=db.prepare('PRAGMA main.table_xinfo('+initialJointRecoveryWorkloadTable+')').all();
  assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i]&&c.type==='TEXT'&&c.notnull===(i===0?0:1)&&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'columns differ');
  const indexes=db.prepare('PRAGMA main.index_list('+initialJointRecoveryWorkloadTable+')').all();assert(indexes.length===3,'index count differs');
  [['source_id'],['recovery_source_id'],['previous_workload_source_id']].forEach((keys,i)=>{
    const name='sqlite_autoindex_'+initialJointRecoveryWorkloadTable+'_'+(i+1),r=catalog.find(v=>v.name===name),ix=indexes.find(v=>v.name===name);
    assert(r?.type==='index'&&r.tbl_name===initialJointRecoveryWorkloadTable&&r.sql===null&&ix?.unique===1&&ix.partial===0&&ix.origin===(i===0?'pk':'u'),'index differs');
    const info=db.prepare('PRAGMA main.index_xinfo('+name+')').all();same(info.filter(c=>c.key===1).map(c=>c.name),keys);
    assert(info.length===2&&info.every(c=>c.desc===0&&c.coll==='BINARY')&&info.at(-1)?.cid===-1,'index columns differ');
  });return true;
}
/** Reconstruct the complete executed prefix from original owners. This is an
 * assessment basis only; it grants no actuation or global fatigue settlement. */
function deriveBasis(db:DatabaseSync,recoveryReference:InitialJointRecoveryExecutionReference){
  const recovery=readInitialJointRecoveryExecutionFromSqlite(db,recoveryReference),b=readInitialJointWorkloadBasisFromSqlite(db,recovery.consumedParentReference),
    previousWorkload=readInitialJointWorkloadViewFromSqlite(db,recovery.workloadViewReference);
  same(b.originalView.lineage,recovery.lineage);same(previousWorkload.physicalCut,recovery.issuedAtMoment);
  assert(recovery.executedThroughMoment.elapsedSeconds>recovery.issuedAtMoment.elapsedSeconds
    &&recovery.executedThroughMoment.originTick===recovery.issuedAtMoment.originTick,'nonempty original-clock recovery required');
  const activePlayerIds=b.activePlayerIds,advancedPlayerIds=[recovery.input.control.world.batterPlayerId];
  assert(advancedPlayerIds.every(id=>activePlayerIds.includes(id)),'recovery participant not in original active work');
  const coverage={version:'initial_joint_recovery_executed_work_coverage_v1' as const,originalPrefix:b.coverage,originalPrefixHash:b.coverageHash,
    recoveryReference,previousWorkloadViewReference:recovery.workloadViewReference,previousCoverageHash:previousWorkload.coverageHash,
    issuedAtMoment:recovery.issuedAtMoment,throughMoment:recovery.executedThroughMoment,recoveryControlHash:hash(recovery.input),activePlayerIds,advancedPlayerIds};
  return freeze({kind:'initial_joint_recovery_workload_basis_v1' as const,recovery,originalView:b.originalView,previousWorkload,
    recoveryReference,coverage,coverageHash:hash(coverage),gameDay:b.gameDay,activePlayerIds,advancedPlayerIds,motionIssued:false as const});
}
const completedBases=new WeakMap<object,WeakMap<DatabaseSync,Map<string,ReturnType<typeof deriveBasis>>>>();
/** Only completed owner reconstruction is reused inside the existing opaque
 * Native read snapshot. No caller proof or native statement is retained. */
export function readInitialJointRecoveryWorkloadBasisFromSqlite(db:DatabaseSync,raw:InitialJointRecoveryExecutionReference){
  const ref=cloneInert(raw),snapshot=reusableBattedWorldFieldReadSnapshot(db);if(!snapshot)return deriveBasis(db,ref);
  let connections=completedBases.get(snapshot);if(!connections){connections=new WeakMap();completedBases.set(snapshot,connections);}
  let entries=connections.get(db);if(!entries){entries=new Map();connections.set(db,entries);}
  const key=json(ref),old=entries.get(key);if(old)return old;
  const value=deriveBasis(db,ref);assert(reusableBattedWorldFieldReadSnapshot(db)===snapshot,'completed recovery workload basis snapshot expired');
  entries.set(key,value);return value;
}
function derive(db:DatabaseSync,source:AcceptedInitialJointRecoveryWorkloadView,current:boolean){
  const b=readInitialJointRecoveryWorkloadBasisFromSqlite(db,source.recoveryReference);
  if(current){const c=assertCurrentInitialJointPostImpactBasisFromSqlite(db,b.recovery.workloadViewReference);same(c.workload,b.previousWorkload);}
  const projection=projectInitialJointRecoveryWorkload(source,{original:b.originalView,previous:b.previousWorkload,
    coverageHash:b.coverageHash,gameDay:b.gameDay,activePlayerIds:b.activePlayerIds,advancedPlayerIds:b.advancedPlayerIds});
  return freeze({kind:'initial_joint_recovery_cumulative_workload_view_v1' as const,source,lineage:b.recovery.lineage,
    recoveryReference:source.recoveryReference,previousWorkloadViewReference:b.recovery.workloadViewReference,
    originalViewReference:b.previousWorkload.originalViewReference,coverage:b.coverage,coverageHash:b.coverageHash,
    physicalCut:b.recovery.executedThroughMoment,timeline:b.recovery.timeline,recoveryModelBasis:b.recovery.recoveryModelBasis,...projection});
}
export type InitialJointRecoveryWorkloadView=ReturnType<typeof derive>;
const rowFor=(v:InitialJointRecoveryWorkloadView)=>({source_id:v.source.sourceId,recovery_source_id:v.recoveryReference.sourceId,
  previous_workload_source_id:v.previousWorkloadViewReference.sourceId,enrollment_source_id:v.lineage.enrollmentReference.sourceId,
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
function read(db:DatabaseSync,id:string){
  const absent=()=>{assertNoJointPhysicalDescendantClaims(db,initialJointRecoveryWorkloadTable,id,[{table:'pa_joint_field_successor_v1_executions',indexColumn:'workload_view_source_id'}]);return null;};
  if(!storage(db))return absent();
  const rows=db.prepare(`SELECT * FROM ${initialJointRecoveryWorkloadTable} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id,id,id);
  assert(rows.length<=1,'duplicate Source identity');if(!rows.length)return absent();const r=rows[0];assert(r.source_id===id,'Source index differs');
  const source=initialJointRecoveryWorkloadViewInput(JSON.parse(String(r.source_json)),id),snapshot=JSON.parse(String(r.snapshot_json));
  assert(hash(source)===r.source_hash&&hash(snapshot)===r.snapshot_hash,'Source/snapshot hash differs');const v=derive(db,source,false);same(r,rowFor(v));return v;
}
export function readInitialJointRecoveryWorkloadFromSqlite(db:DatabaseSync,ref:InitialJointRecoveryWorkloadReference){
  assert(validRef(ref,initialJointRecoveryWorkloadTable),'invalid recovery workload reference');const v=read(db,ref.sourceId);assert(v,'original recovery workload missing; repair forbidden');same(reference(initialJointRecoveryWorkloadTable,v),ref);return v;
}
export function readInitialJointRecoveryWorkloadContextFromSqlite(db:DatabaseSync,ref:InitialJointRecoveryWorkloadReference){
  const workload=readInitialJointRecoveryWorkloadFromSqlite(db,ref),b=readInitialJointRecoveryWorkloadBasisFromSqlite(db,workload.recoveryReference);
  return freeze({workload,recovery:b.recovery,originalView:b.originalView,previousWorkload:b.previousWorkload,gameDay:b.gameDay});
}
export function assertCurrentInitialJointRecoveryWorkloadBasisFromSqlite(db:DatabaseSync,ref:InitialJointRecoveryWorkloadReference){
  const c=readInitialJointRecoveryWorkloadContextFromSqlite(db,ref),prior=assertCurrentInitialJointPostImpactBasisFromSqlite(db,c.recovery.workloadViewReference);
  same(prior.workload,c.previousWorkload);return c;
}
export function openSqliteInitialJointRecoveryWorkloadStore(path:string,authority?:Readonly<{readAcceptedAssessment:(id:string)=>unknown|null}>){
  assert(text(path)&&(!authority||typeof authority.readAcceptedAssessment==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({read:(id:string)=>tx.run(false,proof=>proof(()=>read(db,id)),()=>{}),accept:(id:string)=>{
    assert(text(id),'invalid Source ID');const raw=authority?.readAcceptedAssessment(id)??null,source=raw===null?null:initialJointRecoveryWorkloadViewInput(raw,id);
    return tx.run(true,(proof,step)=>{
      const prior=proof(()=>read(db,id));if(prior){if(source)same(prior.source,source);return prior;}
      if(!source)return freeze({kind:'pending' as const,reason:'explicit_recovery_cumulative_workload_assessment_required'});
      const v=proof(()=>{
        const unused=(owner:string,id:string,indexColumn:string)=>{
          try {assertNoJointPhysicalDescendantClaims(db,owner,id,[{table:initialJointRecoveryWorkloadTable,indexColumn}]);}
          catch(cause){throw new Error('initial joint recovery workload view: parent already consumed or invalid surviving reference',{cause});}
        };
        // Scan every typed raw reference, including duplicate JSON keys. Index
        // mirrors and json_extract's first matching key are not sufficient.
        unused('pa_joint_recovery_v1_executions',source.recoveryReference.sourceId,'recovery_source_id');
        const b=readInitialJointRecoveryWorkloadBasisFromSqlite(db,source.recoveryReference);
        unused('pa_joint_workload_v1_views',b.recovery.workloadViewReference.sourceId,'previous_workload_source_id');
        return derive(db,source,true);
      });if(!proof(()=>storage(db)))step(()=>db.exec(schema),0,1);
      const row=rowFor(v);step(()=>{assert(db.prepare(`INSERT INTO ${initialJointRecoveryWorkloadTable} VALUES(?,?,?,?,?,?,?,?)`).run(...Object.values(row)).changes===1,'exact insert differs');},1);
      same(proof(()=>read(db,id)),v);return v;
    },v=>{if(v.kind!=='pending')same(read(db,id),v);});},close:()=>tx.close()});
}
