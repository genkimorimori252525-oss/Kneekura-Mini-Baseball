import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { receivedRenewalClaims,receivedUnionReferenceClaims } from './ActualReceivedUmpireDefenderClaims';
import { renewalOwnerSchema } from './ActualReceivedUmpireRenewalSchema';
import { renewalEnrollmentInput,renewalDecisionInput,renewalMotorInput,renewalAdoptionInput } from './ActualReceivedUmpireRenewal';
import { receivedId } from './ActualReceivedUmpireDefender';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurableReceivedRenewalEnrollment } from './ActualReceivedUmpireRenewalEvidence';
export const renewalJournalOwners=['actual_received_umpire_renewal_enrollments','actual_received_umpire_renewal_decisions','actual_received_umpire_renewal_motors','batted_world_field_executions'] as const;
export type RenewalJournalOwner=typeof renewalJournalOwners[number];
const bytesHash=(v:unknown)=>typeof v==='string'?createHash('sha256').update(v).digest('hex'):null;
export const renewalScope=(e:DurableReceivedRenewalEnrollment)=>({game_id:e.gameId,play_id:e.playId,physical_pitch_source_id:e.physicalPitchSourceId,player_id:e.playerId,
  runtime_source_id:e.runtimeSourceId,received_enrollment_source_id:e.receivedEnrollmentSourceId,origin_process_source_id:e.originProcessSourceId,received_replan_source_id:e.receivedReplanSourceId,renewal_enrollment_source_id:e.source.sourceId});
export const renewalJournal=(db:DatabaseSync,e:DurableReceivedRenewalEnrollment)=>{
  const rows=db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? ORDER BY sequence').all(e.source.sourceId),scope=renewalScope(e);
  if(rows.length<1||rows.length>4)throw new Error('received renewal journal stage differs');
  for(const [i,row] of rows.entries()){
    const {receipt_hash,...body}=row;
    if(row.sequence!==i+1||row.owner!==renewalJournalOwners[i]||Object.entries(scope).some(([key,value])=>row[key]!==value)
      ||row.legacy_prefix_digest!==e.anchor.legacyAdmissionPrefix.digest||row.received_prefix_digest!==e.anchor.receivedJournal.digest
      ||row.previous_receipt_hash!==(i?rows[i-1].receipt_hash:null)||receipt_hash!==hash(body))throw new Error('received renewal journal identity or hash differs');
    const own=db.prepare(`SELECT * FROM ${renewalJournalOwners[i]} WHERE source_id=?`).get(row.source_id);
    if(!own||i<3&&own.source_version!==row.source_version||own.source_hash!==row.source_hash||own.snapshot_hash!==row.snapshot_hash
      ||bytesHash(own.source_json)!==own.source_hash||bytesHash(own.snapshot_json)!==own.snapshot_hash)throw new Error('received renewal admitted archive differs');
    const mirrors=db.prepare("SELECT type,value FROM json_each(?) WHERE key='source'").all(String(own.snapshot_json));
    if(mirrors.length!==1||mirrors[0].type!=='object'||mirrors[0].value!==own.source_json)throw new Error('received renewal Source mirror differs');
    if(i<3){
      if(Object.entries(scope).some(([key,value])=>own[key]!==value))throw new Error('received renewal owner scope metadata differs');
      const parse=i===0?renewalEnrollmentInput:i===1?renewalDecisionInput:renewalMotorInput,source=parse(JSON.parse(String(own.source_json)),String(row.source_id));
      if(json(source)!==own.source_json||source.sourceVersion!==row.source_version||i===0&&row.source_id!==e.source.sourceId
        ||i>0&&Reflect.get(source,'renewalEnrollmentSourceId')!==e.source.sourceId
        ||i===2&&(Reflect.get(source,'renewalDecisionSourceId')!==rows[1].source_id||own.renewal_decision_source_id!==rows[1].source_id))throw new Error('received renewal Source lineage differs');
      if(i>0){const headers=db.prepare("SELECT type,atom FROM json_each(?) WHERE key='enrollmentHash'").all(String(own.snapshot_json));if(headers.length!==1||headers[0].type!=='text'||headers[0].atom!==hash(e))throw new Error('received renewal enrollment header differs');}
    }else{
      // Stage four's concrete physical format is admitted only by its explicit
      // writer. Journal replay inspects metadata, never that later result.
      const source=renewalAdoptionInput(JSON.parse(String(own.source_json)),String(row.source_id));
      const formats=db.prepare("SELECT type,atom FROM json_each(?) WHERE key='snapshotFormat'").all(String(own.snapshot_json));
      if(json(source)!==own.source_json||source.sourceVersion!==row.source_version||source.action.renewalEnrollmentSourceId!==e.source.sourceId
        ||source.action.renewalMotorSourceId!==rows[2].source_id||source.baseFieldSourceId!==e.anchor.baseField.sourceId||source.previousExecutionSourceId!==e.anchor.physicalPredecessor.sourceId
        ||own.game_id!==e.gameId||own.physical_pitch_source_id!==e.physicalPitchSourceId||own.base_field_source_id!==e.anchor.baseField.sourceId
        ||own.previous_source_id!==e.anchor.physicalPredecessor.sourceId||own.revision!==e.anchor.physicalPredecessor.revision+1
        ||formats.length!==1||formats[0].type!=='text'||formats[0].atom!=='received_renewal_adoption_snapshot_v1')throw new Error('received renewal adoption header lineage differs');
    }
  }
  const heads=db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=? OR (physical_pitch_source_id=? AND player_id=?)').all(e.source.sourceId,e.physicalPitchSourceId,e.playerId),head=heads[0],last=rows.at(-1)!;
  if(heads.length!==1||Object.entries(scope).some(([key,value])=>head[key]!==value)||head.stage!==rows.length||head.owner!==last.owner||head.source_id!==last.source_id
    ||head.renewal_decision_source_id!==(rows[1]?.source_id??null)||head.renewal_motor_source_id!==(rows[2]?.source_id??null)||head.adoption_source_id!==(rows[3]?.source_id??null)
    ||head.physical_predecessor_source_id!==e.anchor.physicalPredecessor.sourceId||head.physical_predecessor_revision!==e.anchor.physicalPredecessor.revision)throw new Error('received renewal head metadata differs');
  const claims=receivedRenewalClaims(db,e),expected=rows.length<4?rows.length*2+1:8;
  if(claims.length!==expected||claims.some(c=>c.owner!=='actual_received_umpire_renewal_heads'&&c.owner!=='actual_received_umpire_renewal_admissions'
    &&!rows.some(r=>r.owner===c.owner&&r.source_id===c.row.source_id)))throw new Error('received renewal journal orphan claims differ');
  const physicalClaims=receivedUnionReferenceClaims(db,[{owner:'actual_received_umpire_renewal_enrollments',sourceId:e.source.sourceId}]).filter(c=>c.owner==='batted_world_field_executions');
  if(physicalClaims.length!==(rows.length===4?1:0)||rows.length===4&&physicalClaims[0].row.source_id!==rows[3].source_id)throw new Error('received renewal physical journal claims differ');
  return rows;
};
export const appendRenewalJournal=(db:DatabaseSync,e:DurableReceivedRenewalEnrollment,owner:RenewalJournalOwner,sourceId:string)=>{
  const rows=db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? ORDER BY sequence').all(e.source.sourceId);
  if(rows.length>=4||renewalJournalOwners[rows.length]!==owner)throw new Error('received renewal journal append stage differs');
  const own=db.prepare(`SELECT * FROM ${owner} WHERE source_id=?`).get(sourceId);if(!own)throw new Error('received renewal journal output missing');
  const row={renewal_enrollment_source_id:e.source.sourceId,sequence:rows.length+1,game_id:e.gameId,play_id:e.playId,physical_pitch_source_id:e.physicalPitchSourceId,player_id:e.playerId,
    runtime_source_id:e.runtimeSourceId,received_enrollment_source_id:e.receivedEnrollmentSourceId,origin_process_source_id:e.originProcessSourceId,received_replan_source_id:e.receivedReplanSourceId,
    owner,source_id:sourceId,source_version:owner==='batted_world_field_executions'?renewalAdoptionInput(JSON.parse(String(own.source_json)),sourceId).sourceVersion:own.source_version,legacy_prefix_digest:e.anchor.legacyAdmissionPrefix.digest,received_prefix_digest:e.anchor.receivedJournal.digest,
    source_hash:own.source_hash,snapshot_hash:own.snapshot_hash,previous_receipt_hash:rows.at(-1)?.receipt_hash??null};
  db.prepare('INSERT INTO actual_received_umpire_renewal_admissions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(row),hash(row));
};
export const renewalSourceRow=(db:DatabaseSync,table:RenewalJournalOwner,sourceId:string)=>{
  if(!receivedId(sourceId))throw new Error('received renewal Source identity differs');
  const state=renewalOwnerSchema(db);
  const rows=state==='pristine'?[]:db.prepare(`SELECT * FROM ${table} WHERE source_id=? OR EXISTS(SELECT 1 FROM (${nodes('source_json',['sourceId'])}) n WHERE n.atom=?) OR EXISTS(SELECT 1 FROM (${nodes('snapshot_json',['source','sourceId'])}) n WHERE n.atom=?)`).all(sourceId,sourceId,sourceId);
  if(!rows.length){if(receivedUnionReferenceClaims(db,[{owner:table,sourceId}]).length)throw new Error('received renewal orphan journal or owner claims');return null;}
  if(rows.length!==1||rows[0].source_id!==sourceId)throw new Error('received renewal Source row differs');return rows[0];
};
