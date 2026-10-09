import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {receivedHandoffInput,receivedHandoffSuccessorInputs,type ReceivedHandoffSource} from './ActualReceivedUmpireHandoff';
import {receivedHandoffSchema,receivedHandoffTable as table} from './ActualReceivedUmpireHandoffSchema';
import {actorHash as hash,actorJson as json} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Db=Pick<DatabaseSync,'prepare'>;
type Ref=Readonly<{sourceId:string;sourceHash:string;snapshotHash:string;revision:number}>;
export type DurableReceivedHandoff=Readonly<{source:ReceivedHandoffSource;gameId:string;playId:number;physicalPitchSourceId:string;playerId:string;runtimeSourceId:string;
  receivedEnrollmentSourceId:string;renewalEnrollmentSourceId:string;cause:Readonly<{physicalPitchSourceId:string;playerId:string;callSourceId:string;originCommunicationSourceId:string}>;
  enrollmentHash:string;predecessor:Ref;physical:Ref;communication:Ref;legacyAdmissionPrefix:Readonly<{count:number;digest:string}>;
  transfer:'retained_quantizer_and_normal_communication_v1'}>;
export const receivedHandoffHeader=(db:Db,enrollmentId:string)=>{
  if(receivedHandoffSchema(db)==='pristine')return null;
  const rows=db.prepare(`SELECT * FROM ${table} WHERE renewal_enrollment_source_id=?`).all(enrollmentId);
  if(rows.length>1)throw new Error('received handoff enrollment fork');if(!rows.length)return null;
  const row=rows[0],source=receivedHandoffInput(JSON.parse(String(row.source_json)),String(row.source_id)),value=JSON.parse(String(row.snapshot_json)) as DurableReceivedHandoff;
  const bytes=(s:unknown)=>typeof s==='string'?createHash('sha256').update(s).digest('hex'):null;
  if(json(source)!==row.source_json||hash(source)!==row.source_hash||bytes(row.snapshot_json)!==row.snapshot_hash||json(value)!==row.snapshot_json||json(value.source)!==json(source)
    ||value.transfer!=='retained_quantizer_and_normal_communication_v1'||source.renewalEnrollmentSourceId!==enrollmentId||source.sourceVersion!==row.source_version
    ||value.renewalEnrollmentSourceId!==enrollmentId||value.gameId!==row.game_id||value.playId!==row.play_id||value.physicalPitchSourceId!==row.physical_pitch_source_id||value.playerId!==row.player_id||value.runtimeSourceId!==row.runtime_source_id
    ||value.predecessor.sourceId!==source.predecessorExecutionSourceId||value.physical.sourceId!==source.executionSourceId||value.communication.sourceId!==source.communicationSourceId
    ||row.previous_source_id!==source.predecessorExecutionSourceId||row.execution_source_id!==source.executionSourceId||row.communication_source_id!==source.communicationSourceId)throw new Error('received handoff header or Source mirror differs');
  for(const [owner,ref] of [['batted_world_field_executions',value.predecessor],['batted_world_field_executions',value.physical],['actual_call_communications',value.communication]] as const){
    const own=db.prepare(`SELECT * FROM ${owner} WHERE source_id=?`).get(ref.sourceId);
    if(!own||own.game_id!==value.gameId||own.physical_pitch_source_id!==value.physicalPitchSourceId||own.revision!==ref.revision||own.source_hash!==ref.sourceHash||own.snapshot_hash!==ref.snapshotHash
      ||bytes(own.source_json)!==ref.sourceHash||bytes(own.snapshot_json)!==ref.snapshotHash)throw new Error('received handoff admitted output header differs');
  }
  if(value.physical.revision!==value.predecessor.revision+1)throw new Error('received handoff physical predecessor rank differs');
  const enrollment=db.prepare('SELECT * FROM actual_received_umpire_renewal_enrollments WHERE source_id=?').get(enrollmentId);
  const previous=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(value.predecessor.sourceId)!;
  const physical=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(value.physical.sourceId)!;
  const communication=db.prepare('SELECT * FROM actual_call_communications WHERE source_id=?').get(value.communication.sourceId)!;
  if(!enrollment||enrollment.snapshot_hash!==value.enrollmentHash||['game_id','play_id','physical_pitch_source_id','player_id','runtime_source_id'].some(k=>enrollment[k]!==row[k])
    ||physical.previous_source_id!==value.predecessor.sourceId||physical.base_field_source_id!==previous.base_field_source_id||communication.current_execution_source_id!==physical.source_id
    ||communication.call_source_id!==value.cause.callSourceId)throw new Error('received handoff dependency header continuity differs');
  const cause=db.prepare("SELECT type,value FROM json_each(?) WHERE key='cause'").all(String(enrollment.snapshot_json));
  const origin=db.prepare("SELECT type,atom FROM json_each(?) WHERE key='originCommunicationSourceId'").all(String(communication.snapshot_json));
  if(cause.length!==1||cause[0].type!=='object'||cause[0].value!==json(value.cause)||origin.length!==1||origin[0].type!=='text'||origin[0].atom!==value.cause.originCommunicationSourceId)throw new Error('received handoff cause header differs');
  receivedHandoffSuccessorInputs(source,JSON.parse(String(physical.source_json)),JSON.parse(String(communication.source_json)));
  return {row,source,value};
};
