import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { createPitchHandHoldRenewalV1 } from '../../core/sim/pitch/PitchHandHoldRenewalV1';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readObservedInitialPitchHandControlFromSqlite } from './SqliteObservedInitialPitchStore';
import { battingInvocationTransaction } from './BattingInvocationTransaction';

export const initialPitchHandHoldTable='pa_pitch_hand_hold_v1_sources';
export type InitialPitchHandHoldReference=SamePaReference<typeof initialPitchHandHoldTable>;
export type AcceptedInitialPitchHandHoldV1=Readonly<{
  sourceId:string;sourceVersion:string;capability:'owned_initial_pitch_hand_hold_v1';
  operationReference:SamePaReference<'pa_observed_initial_v1_operations'>;throughTick:number;
}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial pitch hand hold: '+message);}
const same=(a:unknown,b:unknown)=>{assert(json(a)===json(b),'original dependency, source or row differs');};
export function initialPitchHandHoldInput(raw:unknown,id?:string):AcceptedInitialPitchHandHoldV1{
  const s=cloneInert(raw) as AcceptedInitialPitchHandHoldV1;
  assert(fields(s,['sourceId','sourceVersion','capability','operationReference','throughTick'])&&text(s.sourceId)&&text(s.sourceVersion)
    &&(id===undefined||s.sourceId===id)&&s.capability==='owned_initial_pitch_hand_hold_v1'
    &&validRef(s.operationReference,'pa_observed_initial_v1_operations')&&Number.isSafeInteger(s.throughTick)&&s.throughTick>0,'invalid explicit successor source');
  return freeze(s);
}
const schema=`CREATE TABLE ${initialPitchHandHoldTable}(source_id TEXT PRIMARY KEY,launch_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
const storage=(db:DatabaseSync)=>{
  const rows=(s:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${s}.sqlite_master WHERE lower(name) GLOB 'pa_pitch_hand_hold_v1_*' OR lower(tbl_name) GLOB 'pa_pitch_hand_hold_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const main=rows('main');if(!main.length)return false;assert(main.length===3,'partial or extended namespace');
  const t=main.find(r=>r.name===initialPitchHandHoldTable);assert(t?.type==='table'&&t.tbl_name===initialPitchHandHoldTable&&t.sql===schema,'schema differs');
  const columns=['source_id','launch_source_id','source_json','source_hash','snapshot_json','snapshot_hash'],actual=db.prepare('PRAGMA main.table_xinfo('+initialPitchHandHoldTable+')').all();
  assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i]&&c.type==='TEXT'&&c.notnull===(i===0?0:1)
    &&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'columns differ');
  const indexes=db.prepare('PRAGMA main.index_list('+initialPitchHandHoldTable+')').all();assert(indexes.length===2,'index count differs');
  [['source_id'],['launch_source_id']].forEach((keys,i)=>{
    const name='sqlite_autoindex_'+initialPitchHandHoldTable+'_'+(i+1),row=main.find(v=>v.name===name),idx=indexes.find(v=>v.name===name);
    assert(row?.type==='index'&&row.tbl_name===initialPitchHandHoldTable&&row.sql===null&&idx?.unique===1&&idx.partial===0&&idx.origin===(i===0?'pk':'u'),'index identity differs');
    const info=db.prepare('PRAGMA main.index_xinfo('+name+')').all();same(info.filter(c=>c.key===1).map(c=>c.name),keys);
    assert(info.length===2&&info.every(c=>c.desc===0&&c.coll==='BINARY')&&info.at(-1)?.cid===-1,'index shape differs');
  });return true;
};
const derive=(db:DatabaseSync,source:AcceptedInitialPitchHandHoldV1,current:boolean)=>{
  const input=readObservedInitialPitchHandControlFromSqlite(db,source.operationReference,current),c=input.control;
  assert(input.issuedAtTick<=c.anchors.followThroughEndTick,'a successor cannot be backdated after the original deadline');
  const control=createPitchHandHoldRenewalV1(c.motion,c.anchors,{version:'pitch_hand_hold_renewal_v1',fromTick:c.anchors.followThroughEndTick,
    throughTick:source.throughTick,sceneThroughTick:input.sceneThroughTick});
  return freeze({kind:'initial_pitch_hand_hold_renewal_v1' as const,source,lineage:input.lineage,launchReference:input.launchReference,
    pitcherPlayerId:c.pitcherPlayerId,sceneBodyReferences:input.sceneBodyReferences,issuedAtTick:input.issuedAtTick,
    request:control.request,initialHand:control.initialHand,originalControlBindingHash:hash(control.originalBinding),
    commandOwned:true as const,predecessorChanged:false as const,maximumHandSpeedMps:0 as const,
    motionIssued:false as const,physicalEffect:'none' as const});
};
export type OwnedInitialPitchHandHoldV1=ReturnType<typeof derive>;
const rowFor=(v:OwnedInitialPitchHandHoldV1)=>({source_id:v.source.sourceId,launch_source_id:v.launchReference.sourceId,
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
const read=(db:DatabaseSync,id:string):OwnedInitialPitchHandHoldV1|null=>{
  if(!storage(db))return null;
  const rows=db.prepare(`SELECT * FROM ${initialPitchHandHoldTable} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id,id,id);
  assert(rows.length<=1,'duplicate source claim');if(!rows.length)return null;assert(rows[0].source_id===id,'source identity differs');
  const source=initialPitchHandHoldInput(JSON.parse(String(rows[0].source_json)),id),v=derive(db,source,false);same(rows[0],rowFor(v));return v;
};
export function readInitialPitchHandHoldFromSqlite(db:DatabaseSync,ref:InitialPitchHandHoldReference){
  assert(validRef(ref,initialPitchHandHoldTable),'invalid owned successor reference');const v=read(db,ref.sourceId);assert(v,'original successor missing; repair forbidden');
  same(reference(initialPitchHandHoldTable,v),ref);return v;
}
/** Component inputs only. The forward physical owner must compose the active
 * batter/body/bat and every other actor; this is not a full-world cut. */
export function readInitialPitchHandHoldControlFromSqlite(db:DatabaseSync,ref:InitialPitchHandHoldReference){
  const hold=readInitialPitchHandHoldFromSqlite(db,ref),original=readObservedInitialPitchHandControlFromSqlite(db,hold.source.operationReference);
  return freeze({hold,original,fullWorldAdvanceAllowed:false as const});
}
export function openSqliteInitialPitchHandHoldStore(path:string,authority?:Readonly<{readAcceptedHandHold:(id:string)=>unknown|null}>){
  assert(text(path)&&(!authority||typeof authority.readAcceptedHandHold==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({read:(id:string)=>{assert(text(id),'invalid source ID');return tx.run(false,proof=>proof(()=>read(db,id)),()=>{});},
    accept:(id:string)=>{assert(text(id),'invalid source ID');const raw=authority?.readAcceptedHandHold(id)??null,source=raw===null?null:initialPitchHandHoldInput(raw,id);
      return tx.run(true,(proof,step)=>{
        const prior=proof(()=>read(db,id));if(prior){if(source)same(prior.source,source);return prior;}
        if(!source)return freeze({kind:'pending' as const,reason:'explicit_successor_hand_command_required'});
        const v=proof(()=>derive(db,source,true));if(!proof(()=>storage(db)))step(()=>db.exec(schema),0,1);
        proof(()=>{same(derive(db,source,true),v);assert(!read(db,id),'source appeared during acceptance');});const row=rowFor(v);
        step(()=>{assert(db.prepare(`INSERT INTO ${initialPitchHandHoldTable} VALUES(?,?,?,?,?,?)`).run(...Object.values(row)).changes===1,'exact insert differs');},1);
        same(proof(()=>read(db,id)),v);return v;
      },v=>{if(v.kind==='initial_pitch_hand_hold_renewal_v1')same(read(db,id),v);});},close:()=>tx.close()});
}
