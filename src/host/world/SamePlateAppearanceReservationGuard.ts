import { actualLivePlayOwnerIdentityRow } from './ActualLivePlayOwnerMetadata';
import type { DatabaseSync } from 'node:sqlite';
import { samePaId as id, samePlateAppearanceEnrollmentInput as input, type ReservedSamePlateAppearanceEnrollment } from './SamePlateAppearanceEnrollment';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sqliteJsonMetadataNodes as nodes, type SqliteJsonMetadataPath as Path } from './SqliteOwnershipMetadata';
export type SamePaDb = Pick<DatabaseSync,'prepare'>;
export type SamePaScope = Readonly<{gameId:string;playId:number;physicalPitchSourceId?:string}>;
export const samePaSchema = Object.freeze({
  same_pa_enrollments: `CREATE TABLE same_pa_enrollments(source_id TEXT PRIMARY KEY,career_id TEXT NOT NULL,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,actor_source_id TEXT NOT NULL UNIQUE,first_pitch_source_id TEXT NOT NULL UNIQUE,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,UNIQUE(game_id,play_id))`,
  same_pa_participant_reservations: `CREATE TABLE same_pa_participant_reservations(enrollment_source_id TEXT NOT NULL,career_id TEXT NOT NULL,player_id TEXT NOT NULL,baseline_source_id TEXT NOT NULL,revision INTEGER NOT NULL,state_hash TEXT NOT NULL,member_json TEXT NOT NULL,PRIMARY KEY(enrollment_source_id,player_id),UNIQUE(career_id,player_id))`,
  same_pa_successor_rights: `CREATE TABLE same_pa_successor_rights(enrollment_source_id TEXT PRIMARY KEY,first_pitch_source_id TEXT NOT NULL UNIQUE,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,state TEXT NOT NULL,predecessor_resume_source_id TEXT,consuming_source_id TEXT,slot_json TEXT NOT NULL,UNIQUE(game_id,play_id))`,
} as const);
const names = Object.keys(samePaSchema) as (keyof typeof samePaSchema)[];
const fail = (detail: string): never => {throw new Error('same-PA reservation '+detail);};
/** No open/read path creates or repairs a namespace. A partly installed owner
 * cannot be mistaken for a pristine database, including SQLite name aliases. */
export const assertSamePaStorage = (db: SamePaDb): boolean => {
  const catalog = (schema: string) => db.prepare(`SELECT type,name,tbl_name,sql FROM ${schema}.sqlite_master WHERE lower(name) GLOB 'same_pa_*' OR lower(tbl_name) IN (${names.map(()=>'?').join(',')})`).all(...names);
  if (catalog('temp').length) fail('temporary namespace shadows the owner');
  const rows=catalog('main');if(!rows.length)return false;
  for(const name of names){
    const tables=rows.filter(r=>String(r.name).toLowerCase()===name);
    if(tables.length!==1||tables[0].name!==name||tables[0].type!=='table'||tables[0].sql!==samePaSchema[name])fail('schema is partial or differs');
  }
  if(rows.some(r=>r.type==='index'?r.sql!==null||!String(r.name).startsWith('sqlite_autoindex_'):r.type!=='table'||!names.includes(r.name as keyof typeof samePaSchema)))fail('schema contains an unexpected object');
  return true;
};
/** Typed raw identities retain duplicate/escaped keys during discovery. */
export const samePaMetadataClaim = (document:string,path:Path,value:string,numeric=false) =>
  `EXISTS(SELECT 1 FROM (${nodes(document,path)}) identity WHERE identity.type${numeric?" IN ('integer','real')":"='text'"} AND identity.atom=${value})`;
const claim=samePaMetadataClaim;
const memberRoot=(value:string)=>`(m.enrollment_source_id IS ${value} OR ${claim('m.member_json',['enrollmentSourceId'],value)})`;
const slotRoot=(value:string)=>`(s.enrollment_source_id IS ${value} OR ${claim('s.slot_json',['enrollmentSourceId'],value)})`;
const scopeClaim=(scope:SamePaScope)=>({sql:`((r.game_id=$game OR ${claim('r.snapshot_json',['gameId'],'$game')}) AND (r.play_id=$play OR ${claim('r.snapshot_json',['playId'],'$play',true)}))
 OR r.first_pitch_source_id=$pitch OR ${claim('r.source_json',['firstPhysicalPitchSourceId'],'$pitch')} OR ${claim('r.snapshot_json',['source','firstPhysicalPitchSourceId'],'$pitch')}
 OR EXISTS(SELECT 1 FROM main.same_pa_successor_rights s WHERE (${slotRoot('r.source_id')}) AND (((s.game_id=$game OR ${claim('s.slot_json',['gameId'],'$game')}) AND (s.play_id=$play OR ${claim('s.slot_json',['playId'],'$play',true)})) OR s.first_pitch_source_id=$pitch OR ${claim('s.slot_json',['physicalPitchSourceId'],'$pitch')}))`,
 params:{game:scope.gameId,play:scope.playId,pitch:scope.physicalPitchSourceId??null}});
const playerClaim=(scope:Readonly<{careerId:string;playerId:string}>)=>({sql:`((r.career_id=$career OR ${claim('r.snapshot_json',['careerId'],'$career')} OR ${claim('r.snapshot_json',['participants',{array:'all'},'binding','careerId'],'$career')} OR ${claim('r.snapshot_json',['participants',{array:'all'},'state','careerId'],'$career')})
 AND (${claim('r.source_json',['participantBaselineReferences',{array:'all'},'playerId'],'$player')} OR ${claim('r.snapshot_json',['source','participantBaselineReferences',{array:'all'},'playerId'],'$player')}
 OR ${claim('r.snapshot_json',['participants',{array:'all'},'binding','playerId'],'$player')} OR ${claim('r.snapshot_json',['participants',{array:'all'},'state','playerId'],'$player')}))
 OR EXISTS(SELECT 1 FROM main.same_pa_participant_reservations m WHERE (${memberRoot('r.source_id')}) AND (m.career_id=$career OR ${claim('m.member_json',['careerId'],'$career')}) AND (m.player_id=$player OR ${claim('m.member_json',['playerId'],'$player')}))`,params:{career:scope.careerId,player:scope.playerId}});
const actorReference=(value:string)=>`(r.actor_source_id=${value} OR ${claim('r.source_json',['actorReference','sourceId'],value)} OR ${claim('r.snapshot_json',['source','actorReference','sourceId'],value)})`;
const originalActorLink=`(${actorReference('a.source_id')} OR EXISTS(SELECT 1 FROM (${nodes('a.source_json',['sourceId'])} UNION ALL ${nodes('a.snapshot_json',['source','sourceId'])}) original_actor WHERE original_actor.type='text' AND ${actorReference('original_actor.atom')}))`;
const installed=(db:SamePaDb,name:string)=>{
  const rows=db.prepare('SELECT type,name FROM main.sqlite_master WHERE lower(name)=lower(?)').all(name);
  if(!rows.length)return false;if(rows.length!==1||rows[0].type!=='table'||rows[0].name!==name)fail('original authority namespace differs');return true;
};
/** An unchanged reference to an original authority survives moved copied scope
 * mirrors. Player identities alone are used only for career/player exclusion. */
const playerAuthorityLinks=(db:SamePaDb):string=>{
  const links:string[]=[];
  if(installed(db,'physical_plate_appearance_actors'))links.push(`EXISTS(SELECT 1 FROM main.physical_plate_appearance_actors a WHERE ${originalActorLink}
    AND (${claim('a.snapshot_json',['binding','careerId'],'$career')} OR ${claim('a.snapshot_json',['defenderBindings',{array:'all'},'careerId'],'$career')} OR ${claim('a.snapshot_json',['worldFixture','careerId'],'$career')})
    AND (a.player_id=$player OR ${claim('a.source_json',['playerId'],'$player')} OR ${claim('a.snapshot_json',['binding','playerId'],'$player')} OR ${claim('a.snapshot_json',['defenderBindings',{array:'all'},'playerId'],'$player')}))`);
  if(installed(db,'world_player_workload_baselines')){
    const refs=`${nodes('r.source_json',['participantBaselineReferences',{array:'all'}])} UNION ALL ${nodes('r.snapshot_json',['source','participantBaselineReferences',{array:'all'}])}`;
    const baselineReference=(value:string)=>claim('ref.value',['baselineSourceId'],value);
    links.push(`EXISTS(SELECT 1 FROM (${refs}) ref,main.world_player_workload_baselines b WHERE ref.type='object'
      AND ${claim('ref.value',['playerId'],'$player')} AND (${baselineReference('b.source_id')} OR EXISTS(SELECT 1 FROM (${nodes('b.source_json',['sourceId'])}) original_baseline WHERE original_baseline.type='text' AND ${baselineReference('original_baseline.atom')}))
      AND (b.career_id=$career OR ${claim('b.source_json',['careerId'],'$career')} OR ${claim('b.initial_json',['careerId'],'$career')})
      AND (b.player_id=$player OR ${claim('b.source_json',['playerId'],'$player')} OR ${claim('b.initial_json',['playerId'],'$player')}))`);
  }
  return links.length?' OR '+links.join(' OR '):'';
};
export const samePaEnrollmentRow = (db:SamePaDb,sourceId:string) => {
  if(!id(sourceId))fail('invalid Source identity');if(!assertSamePaStorage(db))return null;
  const row=actualLivePlayOwnerIdentityRow(db,'same_pa_enrollments',sourceId);
  if(!row&&(db.prepare(`SELECT 1 FROM main.same_pa_participant_reservations m WHERE ${memberRoot('$id')}`).get({id:sourceId})
    ||db.prepare(`SELECT 1 FROM main.same_pa_successor_rights s WHERE ${slotRoot('$id')}`).get({id:sourceId})))fail('original root is missing');
  return row;
};
export const samePaMember = (value:ReservedSamePlateAppearanceEnrollment,p:ReservedSamePlateAppearanceEnrollment['participants'][number])=>({
  enrollmentSourceId:value.source.sourceId,careerId:value.careerId,playerId:p.binding.playerId,baselineSourceId:p.baselineSourceId,
  revision:p.state.revision,stateHash:hash(p.state),baselineSourceHash:p.baselineSourceHash,bindingHash:hash(p.binding),personHash:p.personHash,
});
export const samePaSlot = (value:ReservedSamePlateAppearanceEnrollment)=>({enrollmentSourceId:value.source.sourceId,gameId:value.gameId,playId:value.playId,...value.firstPitch});
/** Validate complete immutable root/member/right mirrors. Deleting a member
 * never converts the surviving root's claim into a free participant. */
export const authenticateSamePaRow = (db:SamePaDb,row:Record<string,unknown>):ReservedSamePlateAppearanceEnrollment => {
  const source=input(JSON.parse(String(row.source_json)),String(row.source_id));
  const v=JSON.parse(String(row.snapshot_json)) as ReservedSamePlateAppearanceEnrollment;
  if(v.kind!=='reserved'||json(v.source)!==json(source)||!id(v.careerId)||!id(v.gameId)||!Number.isSafeInteger(v.playId)||v.playId<0
    ||row.career_id!==v.careerId||row.game_id!==v.gameId||row.play_id!==v.playId||row.actor_source_id!==source.actorReference.sourceId
    ||row.first_pitch_source_id!==source.firstPhysicalPitchSourceId||row.source_json!==json(source)||row.source_hash!==hash(source)
    ||row.snapshot_json!==json(v)||row.snapshot_hash!==hash(v)||!Array.isArray(v.participants)||v.participants.length!==10
    ||new Set(v.participants.map(p=>p.binding.playerId)).size!==10||new Set(v.participants.map(p=>p.binding.personId)).size!==10
    ||json(v.firstPitch)!==json({physicalPitchSourceId:source.firstPhysicalPitchSourceId,state:'blocked_execution_basis',predecessorResumeSourceId:null,consumingSourceId:null}))fail('immutable root differs');
  const members=db.prepare(`SELECT * FROM main.same_pa_participant_reservations m WHERE ${memberRoot('$id')}`).all({id:source.sourceId});
  if(members.length!==10)fail('member set is incomplete');
  for(const p of v.participants){
    const ref=source.participantBaselineReferences.find(r=>r.playerId===p.binding.playerId),m=samePaMember(v,p);
    if(!ref||p.binding.careerId!==v.careerId||p.binding.gameId!==v.gameId||p.state.careerId!==v.careerId||p.state.playerId!==p.binding.playerId
      ||ref.baselineSourceId!==p.baselineSourceId||ref.revision!==p.state.revision||ref.stateHash!==hash(p.state))fail('participant baseline differs');
    const rows=members.filter(row=>row.player_id===m.playerId||db.prepare(`SELECT ${claim('$document',['playerId'],'$player')} AS matched`).get({document:String(row.member_json),player:m.playerId})!.matched===1);
    if(rows.length!==1||json(rows[0])!==json({enrollment_source_id:source.sourceId,career_id:v.careerId,player_id:m.playerId,baseline_source_id:m.baselineSourceId,revision:m.revision,state_hash:m.stateHash,member_json:json(m)}))fail('member ownership differs');
  }
  const slots=db.prepare(`SELECT * FROM main.same_pa_successor_rights s WHERE ${slotRoot('$id')}`).all({id:source.sourceId});
  if(slots.length!==1||json(slots[0])!==json({enrollment_source_id:source.sourceId,first_pitch_source_id:source.firstPhysicalPitchSourceId,game_id:v.gameId,play_id:v.playId,state:'blocked_execution_basis',predecessor_resume_source_id:null,consuming_source_id:null,slot_json:json(samePaSlot(v))}))fail('first-pitch slot differs');
  return v;
};
export const assertNoSamePaPlayerReservation = (db:SamePaDb,scope:Readonly<{careerId:string;playerId:string}>,ownSourceId?:string):void => {
  if(!assertSamePaStorage(db))return;const q=playerClaim(scope);
  const links=playerAuthorityLinks(db);
  const own:Record<string,string>=ownSourceId===undefined?{}:{own:ownSourceId};
  if(db.prepare(`SELECT 1 FROM main.same_pa_enrollments r WHERE ${ownSourceId===undefined?'1':'r.source_id IS NOT $own'} AND (${q.sql}${links}) LIMIT 1`).get({...q.params,...own}))fail('blocks new global Player workload');
  // Orphans remain claims, even if an external fault removed the root.
  if(db.prepare(`SELECT 1 FROM main.same_pa_participant_reservations m WHERE (m.career_id=$career OR ${claim('m.member_json',['careerId'],'$career')}) AND (m.player_id=$player OR ${claim('m.member_json',['playerId'],'$player')}) AND ${ownSourceId===undefined?'1':`NOT (${memberRoot('$own')})`}`).get({...q.params,...own}))fail('orphan member blocks new global Player workload');
};
export const assertNoSamePaWorkReservation = (db:SamePaDb,scope:SamePaScope,ownSourceId?:string):void => {
  if(!assertSamePaStorage(db))return;const q=scopeClaim(scope);
  const actorTable=installed(db,'physical_plate_appearance_actors');
  const actorLink=actorTable?` OR EXISTS(SELECT 1 FROM main.physical_plate_appearance_actors a WHERE
    ${originalActorLink}
    AND (a.game_id=$game OR ${claim('a.source_json',['gameId'],'$game')} OR ${claim('a.snapshot_json',['source','gameId'],'$game')})
    AND (a.play_id=$play OR ${claim('a.snapshot_json',['match','playId'],'$play',true)}))`:'';
  const rows=db.prepare(`SELECT r.* FROM main.same_pa_enrollments r WHERE ${q.sql}${actorLink}`).all(q.params);
  if(rows.some(r=>r.source_id!==ownSourceId))fail('blocks causal work until an execution basis exists');
  if(db.prepare(`SELECT 1 FROM main.same_pa_successor_rights s WHERE (((s.game_id=$game OR ${claim('s.slot_json',['gameId'],'$game')}) AND (s.play_id=$play OR ${claim('s.slot_json',['playId'],'$play',true)})) OR s.first_pitch_source_id=$pitch OR ${claim('s.slot_json',['physicalPitchSourceId'],'$pitch')}) AND ${ownSourceId===undefined?'1':`NOT (${slotRoot('$own')})`}`).get({...q.params,...(ownSourceId===undefined?{}:{own:ownSourceId})}))fail('orphan first-pitch slot blocks causal work');
};

/** A runtime Source has a pitch reference before its PA can be reconstructed. */
export const assertNoSamePaOriginalPitchReservation = (db:SamePaDb,physicalPitchSourceId:string):void => {
  assertNoSamePaWorkReservation(db,{gameId:'',playId:-1,physicalPitchSourceId});
};
