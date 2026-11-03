import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { validateMeasuredPelvisReferenceV1,type MeasuredPelvisReferenceV1 } from '../../core/sim/contact/MeasuredPelvisControlV1';
import { actorHash as hash,actorJson as json,actorFreeze as freeze,readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readInitialBatEquipmentFromSqlite,type InitialBatEquipmentReference } from './SqliteInitialBatEquipmentStore';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { readSamePaInitialSetupFromSqlite } from './SqliteSamePlateAppearanceInitialBallStore';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { assertSamePaLifecycleReservedStateFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';

export const measuredBattingBodyReferenceTable='batting_measured_body_v1_sources';
export type MeasuredBattingBodyReference=SamePaReference<typeof measuredBattingBodyReferenceTable>;
export type AcceptedMeasuredBattingBodyReferenceV1=Readonly<{
  sourceId:string;sourceVersion:string;capability:'owned_measured_batting_body_reference_v1';
  initialBatReference:InitialBatEquipmentReference;profileId:string;availableAtDay:number;
  reference:Pick<MeasuredPelvisReferenceV1,'provenance'|'frames'|'sourceTicksPerSecond'>;
  postureSpeed:Readonly<{maximumSpeedMps:number;basis:'MEASURED_PERSON_POSTURE_SPEED_V1'|'EXPLICIT_SYNTHETIC_PERSON_POSTURE_SPEED_V1';
    provenance:Readonly<{assessmentSourceId:string;assessmentVersion:string;calibrationSourceId:string;calibrationVersion:string}>}>;
}>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('measured batting body reference: '+message);}
const same=(a:unknown,b:unknown)=>{assert(json(a)===json(b),'original source, data or row differs');};
export function measuredBattingBodyReferenceInput(raw:unknown,id?:string):AcceptedMeasuredBattingBodyReferenceV1{
  const s=cloneInert(raw) as AcceptedMeasuredBattingBodyReferenceV1;
  assert(fields(s,['sourceId','sourceVersion','capability','initialBatReference','profileId','availableAtDay','reference','postureSpeed'])
    &&text(s.sourceId)&&text(s.sourceVersion)&&text(s.profileId)&&(id===undefined||s.sourceId===id)
    &&s.capability==='owned_measured_batting_body_reference_v1'&&validRef(s.initialBatReference,'batting_initial_equipment_v1_sources')
    &&Number.isSafeInteger(s.availableAtDay)&&s.availableAtDay>=0&&fields(s.reference,['provenance','frames','sourceTicksPerSecond'])
    &&fields(s.postureSpeed,['maximumSpeedMps','basis','provenance'])&&Number.isFinite(s.postureSpeed.maximumSpeedMps)&&s.postureSpeed.maximumSpeedMps>0
    &&['MEASURED_PERSON_POSTURE_SPEED_V1','EXPLICIT_SYNTHETIC_PERSON_POSTURE_SPEED_V1'].includes(s.postureSpeed.basis)
    &&fields(s.postureSpeed.provenance,['assessmentSourceId','assessmentVersion','calibrationSourceId','calibrationVersion'])
    &&Object.values(s.postureSpeed.provenance).every(text),'invalid explicit source or posture calibration');
  validateMeasuredPelvisReferenceV1({...s.reference,startTick:0,ticksPerSecond:1000000,playbackRate:1,
    transform:{rotation:{x:0,y:0,z:0,w:1},translation:{x:0,y:0,z:0},scale:1}});
  return freeze(s);
}
const schema=`CREATE TABLE ${measuredBattingBodyReferenceTable}(source_id TEXT PRIMARY KEY,initial_bat_source_id TEXT NOT NULL UNIQUE,profile_id TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
const storage=(db:DatabaseSync)=>{
  const rows=(s:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${s}.sqlite_master WHERE lower(name) GLOB 'batting_measured_body_v1_*' OR lower(tbl_name) GLOB 'batting_measured_body_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const main=rows('main');if(!main.length)return false;
  assert(main.length===3,'partial or extended namespace');
  const t=main.find(v=>v.name===measuredBattingBodyReferenceTable);assert(t?.type==='table'&&t.tbl_name===measuredBattingBodyReferenceTable&&t.sql===schema,'schema differs');
  const columns=['source_id','initial_bat_source_id','profile_id','source_json','source_hash','snapshot_json','snapshot_hash'];
  const actual=db.prepare('PRAGMA main.table_xinfo('+measuredBattingBodyReferenceTable+')').all();
  assert(actual.length===columns.length&&actual.every((c,i)=>c.cid===i&&c.name===columns[i]&&c.type==='TEXT'&&c.notnull===(i===0?0:1)
    &&c.pk===(i===0?1:0)&&c.hidden===0&&c.dflt_value===null),'columns differ');
  const indexes=db.prepare('PRAGMA main.index_list('+measuredBattingBodyReferenceTable+')').all();assert(indexes.length===2,'index count differs');
  [['source_id'],['initial_bat_source_id']].forEach((keys,i)=>{
    const name='sqlite_autoindex_'+measuredBattingBodyReferenceTable+'_'+(i+1),row=main.find(r=>r.name===name),idx=indexes.find(r=>r.name===name);
    assert(row?.type==='index'&&row.tbl_name===measuredBattingBodyReferenceTable&&row.sql===null&&idx?.unique===1&&idx.partial===0&&idx.origin===(i===0?'pk':'u'),'index identity differs');
    const info=db.prepare('PRAGMA main.index_xinfo('+name+')').all();same(info.filter(c=>c.key===1).map(c=>c.name),keys);
    assert(info.length===2&&info.every(c=>c.coll==='BINARY'&&c.desc===0)&&info.at(-1)?.cid===-1,'index shape differs');
  });return true;
};
const derive=(db:DatabaseSync,source:AcceptedMeasuredBattingBodyReferenceV1,current:boolean)=>{
  const bat=readInitialBatEquipmentFromSqlite(db,source.initialBatReference),model=playerBattingModelEvidenceFromSqlite(db).read(bat.modelReference.sourceId);
  assert(model,'original batting model missing');same(reference('world_player_batting_models',model),bat.modelReference);
  same(reference('world_player_body_materializations',model.bodyMaterialization),bat.bodyReference);
  const actor=readPhysicalPlateAppearanceActorFromSqlite(db,bat.actorReference.sourceId);assert(actor,'original person actor missing');same(reference('physical_plate_appearance_actors',actor),bat.actorReference);
  const profile=model.repertoire.values.sampledProfiles?.find(p=>p.profileId===source.profileId),r=source.reference;
  assert(profile&&source.profileId===bat.source.profileId
    &&r.provenance.clipId===profile.measured.provenance.clipId&&r.provenance.batSourceSha256===profile.measured.provenance.sourceSha256
    &&r.sourceTicksPerSecond===profile.measured.sourceTicksPerSecond&&r.frames.length===profile.measured.frames.length
    &&r.frames.every((f,i)=>f.tick===profile.measured.frames[i].tick),'original measured bat/body clip, side or clock differs');
  assert(source.availableAtDay>=model.source.acceptedAtDay&&source.availableAtDay<=actor.binding.gameDay,'body reference is unavailable for the original model/day');
  if(current){const setup=readSamePaInitialSetupFromSqlite(db,bat.source.setupReference),view=readHistoricalSamePaExecutionView(db,setup.source.viewReference).view;
    assertSamePaLifecycleReservedStateFromSqlite(db,{actor,view});}
  return freeze({kind:'measured_batting_body_reference_v1' as const,source,lineage:bat.lineage,modelReference:bat.modelReference,
    bodyReference:bat.bodyReference,personId:model.source.personId,playerId:model.source.playerId,
    bodyReferenceOwned:true as const,motionIssued:false as const,physicalEffect:'none' as const});
};
export type OwnedMeasuredBattingBodyReferenceV1=ReturnType<typeof derive>;
const rowFor=(v:OwnedMeasuredBattingBodyReferenceV1)=>({source_id:v.source.sourceId,initial_bat_source_id:v.source.initialBatReference.sourceId,profile_id:v.source.profileId,
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
const read=(db:DatabaseSync,id:string):OwnedMeasuredBattingBodyReferenceV1|null=>{
  if(!storage(db))return null;
  const rows=db.prepare(`SELECT * FROM ${measuredBattingBodyReferenceTable} WHERE source_id=? OR json_extract(source_json,'$.sourceId')=? OR json_extract(snapshot_json,'$.source.sourceId')=?`).all(id,id,id);
  assert(rows.length<=1,'duplicate source claim');if(!rows.length)return null;assert(rows[0].source_id===id,'source identity differs');
  const s=measuredBattingBodyReferenceInput(JSON.parse(String(rows[0].source_json)),id),value=derive(db,s,false);same(rows[0],rowFor(value));return value;
};
export function readMeasuredBattingBodyReferenceFromSqlite(db:DatabaseSync,ref:MeasuredBattingBodyReference){
  assert(validRef(ref,measuredBattingBodyReferenceTable),'invalid owned reference');const v=read(db,ref.sourceId);assert(v,'original body reference missing; repair forbidden');
  same(reference(measuredBattingBodyReferenceTable,v),ref);return v;
}
export function openSqliteMeasuredBattingBodyReferenceStore(path:string,authority?:Readonly<{readAcceptedBodyReference:(id:string)=>unknown|null}>){
  assert(text(path)&&(!authority||typeof authority.readAcceptedBodyReference==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({read:(id:string)=>{assert(text(id),'invalid source ID');return tx.run(false,proof=>proof(()=>read(db,id)),()=>{});},
    accept:(id:string)=>{assert(text(id),'invalid source ID');const raw=authority?.readAcceptedBodyReference(id)??null,s=raw===null?null:measuredBattingBodyReferenceInput(raw,id);
      return tx.run(true,(proof,step)=>{
        const prior=proof(()=>read(db,id));if(prior){if(s)same(prior.source,s);return prior;}
        if(!s)return freeze({kind:'pending' as const,reason:'explicit_measured_body_reference_required'});
        const v=proof(()=>derive(db,s,true));if(!proof(()=>storage(db)))step(()=>db.exec(schema),0,1);
        proof(()=>{same(derive(db,s,true),v);assert(!read(db,id),'source appeared during acceptance');});
        const row=rowFor(v);step(()=>{assert(db.prepare(`INSERT INTO ${measuredBattingBodyReferenceTable} VALUES(?,?,?,?,?,?,?)`).run(...Object.values(row)).changes===1,'exact insert differs');},1);
        same(proof(()=>read(db,id)),v);return v;
      },v=>{if(v.kind==='measured_batting_body_reference_v1')same(read(db,id),v);});},close:()=>tx.close()});
}
