import type { DatabaseSync } from 'node:sqlite';
import { receivedContinuationSchema,receivedContinuationTable as table } from './ActualReceivedUmpireContinuationSchema';
import { receivedContinuationInput,type ReceivedContinuationSource } from './ActualReceivedUmpireContinuation';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
type Db=Pick<DatabaseSync,'prepare'>;
/** Literal admission metadata only. Never evaluates a future physical result. */
export const receivedContinuationAdmission=(db:Db,enrollmentId:string)=>{
  if(receivedContinuationSchema(db)==='pristine')return null;
  const rows=db.prepare(`SELECT * FROM ${table} WHERE renewal_enrollment_source_id=?`).all(enrollmentId);
  if(rows.length>1)throw new Error('received continuation admission fork');
  if(!rows.length)return null;
  const row=rows[0],{receipt_hash,...body}=row;
  if(receipt_hash!==hash(body))throw new Error('received continuation admission hash differs');
  const physical=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(row.source_id);
  if(!physical||physical.source_hash!==row.source_hash||physical.snapshot_hash!==row.snapshot_hash
    ||physical.game_id!==row.game_id||physical.physical_pitch_source_id!==row.physical_pitch_source_id
    ||physical.revision!==row.revision||physical.previous_source_id!==row.adoption_source_id)throw new Error('received continuation admitted physical header differs');
  const source=receivedContinuationInput(JSON.parse(String(physical.source_json)),String(row.source_id));
  if(source.action.renewalEnrollmentSourceId!==enrollmentId||source.action.renewalAdoptionSourceId!==row.adoption_source_id
    ||source.sourceVersion!==row.source_version||json(source)!==physical.source_json||hash(source)!==row.source_hash)throw new Error('received continuation admitted Source lineage differs');
  const enrollment=db.prepare('SELECT * FROM actual_received_umpire_renewal_enrollments WHERE source_id=?').get(enrollmentId);
  const adoption=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(row.adoption_source_id);
  const journal=db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? AND sequence=4').get(enrollmentId);
  if(!enrollment||!adoption||!journal||journal.source_id!==row.adoption_source_id||journal.owner!=='batted_world_field_executions'
    ||['game_id','play_id','physical_pitch_source_id','player_id'].some(k=>row[k]!==enrollment[k])
    ||adoption.revision!==Number(row.revision)-1||source.baseFieldSourceId!==adoption.base_field_source_id
    ||adoption.physical_pitch_source_id!==row.physical_pitch_source_id||adoption.game_id!==row.game_id)throw new Error('received continuation predecessor rank or scope differs');
  return row;
};
export const assertReceivedContinuationPhysicalAdmission=(db:Db,source:ReceivedContinuationSource,revision:number)=>{
  const row=receivedContinuationAdmission(db,source.action.renewalEnrollmentSourceId);
  if(!row||row.source_id!==source.sourceId||row.revision!==revision)throw new Error('received continuation physical admission missing or differs');
};
/** Discover moved admission identity without parsing any domain result. */
export const receivedContinuationRows=(db:Db,id:string)=>receivedContinuationSchema(db)==='pristine'?[]:
  db.prepare(`SELECT c.* FROM ${table} c LEFT JOIN batted_world_field_executions x ON x.source_id=c.source_id WHERE c.source_id=?
    OR EXISTS(SELECT 1 FROM (${nodes('x.source_json',['sourceId'])}) n WHERE n.atom=?)`).all(id,id);
