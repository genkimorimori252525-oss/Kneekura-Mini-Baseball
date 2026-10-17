import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import type { Vec3 } from '../../core/model/geometry';
import type { Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { validateInitialHeldBatV1 } from '../../core/sim/contact/InitialHeldBatV1';
import { actorHash as hash,actorJson as json,actorFreeze as freeze,readPhysicalPlateAppearanceActorFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaReferenceValid as validRef,type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readSamePaInitialSetupFromSqlite } from './SqliteSamePlateAppearanceInitialBallStore';
import { readSamePaPreparedActionFromSqlite } from './SqliteSamePlateAppearanceDispatchStore';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { deriveSamePaObservedPitchScene } from './SamePlateAppearanceInitialBallProof';
import { assertFreshPaDispatchEnrollment } from './SamePlateAppearanceDispatchClaimGuard';
import { readHistoricalSamePaExecutionView } from './SamePlateAppearanceHistoricalExecutionEvidenceFromSqlite';
import { assertSamePaLifecycleReservedStateFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { battingInvocationTransaction } from './BattingInvocationTransaction';

export const initialBatEquipmentTable='batting_initial_equipment_v1_sources';
export type InitialBatEquipmentReference=SamePaReference<typeof initialBatEquipmentTable>;
export type AcceptedInitialBatEquipmentV1=Readonly<{
  sourceId:string;sourceVersion:string;capability:'owned_initial_bat_equipment_v1';
  setupReference:SamePaReference<'pa_initial_ball_v1_setups'>;profileId:string;
  custody:'explicit_initial_secure_bat_grasp_v1';throughTick:number;pose:Readonly<{grip:Vec3;orientation:Quaternion}>;
  provenance:Readonly<{assessmentSourceId:string;assessmentVersion:string;calibrationSourceId:string;calibrationVersion:string}>;
}>;
const same=(a:unknown,b:unknown)=>{if(json(a)!==json(b))throw new Error('initial bat equipment original data or row differs');};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial bat equipment: '+message);}
export const initialBatEquipmentInput=(raw:unknown,id?:string):AcceptedInitialBatEquipmentV1=>{
  const s=cloneInert(raw) as AcceptedInitialBatEquipmentV1;
  assert(fields(s,['sourceId','sourceVersion','capability','setupReference','profileId','custody','throughTick','pose','provenance'])
    &&text(s.sourceId)&&text(s.sourceVersion)&&text(s.profileId)&&(id===undefined||s.sourceId===id)
    &&s.capability==='owned_initial_bat_equipment_v1'&&validRef(s.setupReference,'pa_initial_ball_v1_setups')
    &&s.custody==='explicit_initial_secure_bat_grasp_v1'&&Number.isSafeInteger(s.throughTick)&&s.throughTick>0
    &&fields(s.pose,['grip','orientation'])&&fields(s.provenance,['assessmentSourceId','assessmentVersion','calibrationSourceId','calibrationVersion'])
    &&Object.values(s.provenance).every(text),'invalid explicit Source');
  return freeze(s);
};
const schema=`CREATE TABLE ${initialBatEquipmentTable}(source_id TEXT PRIMARY KEY,enrollment_source_id TEXT NOT NULL,setup_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL)`;
const storage=(db:DatabaseSync)=>{
  const rows=(name:string)=>db.prepare(`SELECT type,name,tbl_name,sql FROM ${name}.sqlite_master WHERE lower(name) GLOB 'batting_initial_equipment_v1_*' OR lower(tbl_name) GLOB 'batting_initial_equipment_v1_*'`).all();
  assert(rows('temp').length===0,'temporary namespace shadow');const main=rows('main');if(!main.length)return false;
  assert(main.length===3,'partial or extended namespace');
  const table=main.find(r=>r.name===initialBatEquipmentTable);assert(table?.type==='table'&&table.tbl_name===initialBatEquipmentTable&&table.sql===schema,'schema differs');
  const indexes=db.prepare('PRAGMA main.index_list('+initialBatEquipmentTable+')').all();assert(indexes.length===2,'index count differs');
  for(const [i,keys]of [['source_id'],['setup_source_id']].entries()){
    const name='sqlite_autoindex_'+initialBatEquipmentTable+'_'+(i+1),r=main.find(v=>v.name===name),index=indexes.find(v=>v.name===name);
    assert(r?.type==='index'&&r.tbl_name===initialBatEquipmentTable&&r.sql===null&&index?.unique===1&&index.partial===0&&index.origin===(i===0?'pk':'u'),'index identity differs');
    const info=db.prepare('PRAGMA main.index_xinfo('+name+')').all();same(info.filter(v=>v.key===1).map(v=>v.name),keys);
    assert(info.length===keys.length+1&&info.every(v=>v.desc===0&&v.coll==='BINARY')&&info.at(-1)?.cid===-1,'index shape differs');
  }
  return true;
};
const derive=(db:DatabaseSync,source:AcceptedInitialBatEquipmentV1,current:boolean)=>{
  const setup=readSamePaInitialSetupFromSqlite(db,source.setupReference),action=readSamePaPreparedActionFromSqlite(db,setup.source.actionReference);
  const actor=readPhysicalPlateAppearanceActorFromSqlite(db,setup.actorReference.sourceId);assert(actor,'original actor missing');
  same(reference('physical_plate_appearance_actors',actor),setup.actorReference);
  const posture=readBattingPerceptionFromSqlite(db,'posture',setup.source.postureReference);assert(posture.kind==='batting_invocation_posture','original posture missing');
  assert(action.source.variant==='observer_decision_v1'&&posture.source.capability==='owned_batting_invocation_posture_v1','observed initial posture required');
  same(posture.source.modelReference,action.source.batterModelReference);same(posture.lineage,setup.lineage);same(action.lineage,setup.lineage);
  const body=posture.model.bodyMaterialization,profile=posture.model.repertoire.values.sampledProfiles?.find(p=>p.profileId===source.profileId),g=posture.source.geometry;
  assert(body.source.role==='batter'&&body.source.playerId===actor.binding.playerId&&profile&&profile.handedness===g.handedness,'original batter body or measured profile differs');
  assert(setup.ball.tick===g.startedAtTick&&source.throughTick>setup.ball.tick&&source.throughTick<=g.validUntilTick,'equipment exceeds original scene clock');
  const pitcherBody=posture.sceneBodies.find(b=>b.source.playerId===setup.source.pitcherPlayerId);assert(pitcherBody?.releaseGeometry,'original pitcher geometry missing');
  const scene=deriveSamePaObservedPitchScene(setup,{actor,posture,body:{...pitcherBody.releaseGeometry.body,moundReference:action.source.nominalPitch.delivery.moundReference}});
  const hand=scene.otherActors.find(p=>p.playerId===actor.binding.playerId&&p.primitive.role==='tag_hand');assert(hand,'original batting hand missing');
  const physical=posture.model.equipment.values.batPhysical;
  const control={version:'initial_held_bat_v1' as const,startTick:setup.ball.tick,throughTick:source.throughTick,...source.pose,
    batLengthM:profile.measured.batLengthM,maximumBatRadiusM:Math.max(...physical.radiusProfile.knots.map(k=>k.radiusM)),handReferenceFromKnobM:profile.measured.handReferenceFromKnobM};
  const binding=validateInitialHeldBatV1(control,{bodyOrigin:{x:g.centerOfMass.x,y:body.actor.bodyOriginHeightMeters,z:g.centerOfMass.z},
    maximumHandReachM:body.reach.maximumTagReachMeters,handCenter:hand.primitive.startCenter,handRadiusM:hand.primitive.radius,
    obstacles:scene.otherActors.filter(p=>!(p.playerId===actor.binding.playerId&&p.primitive.role==='tag_hand')).map(p=>({center:p.primitive.startCenter,radiusM:p.primitive.radius}))});
  if(current){
    assertFreshPaDispatchEnrollment(db,setup.lineage.enrollmentReference.sourceId);
    const view=readHistoricalSamePaExecutionView(db,setup.source.viewReference).view;
    assertSamePaLifecycleReservedStateFromSqlite(db,{actor,view});
  }
  return freeze({kind:'initial_bat_equipment_v1' as const,source,lineage:setup.lineage,actorReference:setup.actorReference,
    modelReference:posture.source.modelReference,bodyReference:reference('world_player_body_materializations',body),
    occurredAt:setup.occurredAt,holderPlayerId:actor.binding.playerId,equipmentHash:hash(posture.model.equipment),binding});
};
export type InitialBatEquipmentV1=ReturnType<typeof derive>;
const rowFor=(v:InitialBatEquipmentV1)=>({source_id:v.source.sourceId,enrollment_source_id:v.lineage.enrollmentReference.sourceId,setup_source_id:v.source.setupReference.sourceId,
  source_json:json(v.source),source_hash:hash(v.source),snapshot_json:json(v),snapshot_hash:hash(v)});
const read=(db:DatabaseSync,id:string):InitialBatEquipmentV1|null=>{
  if(!storage(db))return null;const row=db.prepare('SELECT * FROM '+initialBatEquipmentTable+' WHERE source_id=?').get(id);if(!row)return null;
  const source=initialBatEquipmentInput(JSON.parse(String(row.source_json)),id),value=derive(db,source,false);same(row,rowFor(value));return value;
};
export const readInitialBatEquipmentFromSqlite=(db:DatabaseSync,ref:InitialBatEquipmentReference)=>{
  assert(validRef(ref,initialBatEquipmentTable),'invalid original reference');const value=read(db,ref.sourceId);assert(value,'original equipment missing; repair forbidden');
  same(reference(initialBatEquipmentTable,value),ref);return value;
};
export const openSqliteInitialBatEquipmentStore=(path:string,authority?:Readonly<{readAcceptedInitialBat:(id:string)=>unknown|null}>)=>{
  assert(text(path)&&(!authority||typeof authority.readAcceptedInitialBat==='function'),'invalid owner');
  const Native=(createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')).DatabaseSync,db=new Native(path),tx=battingInvocationTransaction(db,()=>storage(db));
  return Object.freeze({read:(id:string)=>{assert(text(id),'invalid Source identity');return tx.run(false,proof=>proof(()=>read(db,id)),()=>{});},
    accept:(id:string)=>{
      assert(text(id),'invalid Source identity');const raw=authority?.readAcceptedInitialBat(id)??null,source=raw===null?null:initialBatEquipmentInput(raw,id);
      return tx.run(true,(proof,step)=>{
        const prior=proof(()=>read(db,id));if(prior){if(source)same(prior.source,source);return prior;}
        if(!source)return freeze({kind:'pending' as const,reason:'explicit_initial_bat_source_required'});
        const value=proof(()=>derive(db,source,true));
        if(!proof(()=>storage(db)))step(()=>db.exec(schema),0,1);
        proof(()=>{same(derive(db,source,true),value);assert(!read(db,id),'unexpected Source appeared');});
        const row=rowFor(value);step(()=>{assert(db.prepare(`INSERT INTO ${initialBatEquipmentTable} VALUES(?,?,?,?,?,?,?)`).run(...Object.values(row)).changes===1,'exact initial equipment insert differs');},1);
        same(proof(()=>read(db,id)),value);return value;
      },value=>{if(value.kind==='initial_bat_equipment_v1')same(read(db,id),value);});
    },close:()=>tx.close()});
};
