import { receivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { receivedId } from './ActualReceivedUmpireDefender';
import type { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { receivedDefenderClaims, receivedDefenderReferenceClaims } from './ActualReceivedUmpireDefenderClaims';
import { receivedEnrollmentInput, receivedAvailabilityInput, receivedReplanInput } from './ActualReceivedUmpireDefender';
import type { DurableReceivedEnrollment } from './ActualReceivedUmpireDefenderEvidence';
export const receivedJournalOwners = ['actual_received_umpire_defender_enrollments','actual_received_umpire_defender_replans',
  'actual_received_umpire_defender_policy_availabilities','actual_received_umpire_defender_replans'] as const;
const bytesHash = (raw: unknown) => typeof raw === 'string' ? createHash('sha256').update(raw).digest('hex') : null;
export const receivedJournal = (db: DatabaseSync, enrollment: DurableReceivedEnrollment) => {
  const id = enrollment.source.sourceId, rows = db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(id);
  if (rows.length<1 || rows.length>4) throw new Error('received defender admission journal stage differs');
  const seen = new Set<string>(), processSources: string[] = [];
  const header = (snapshot: string, expected: Readonly<Record<string, string | number | null>>) => {
    const keys = Object.keys(expected);
    const values = db.prepare(`SELECT key,type,atom FROM json_each(?) WHERE key IN (${keys.map(() => '?').join(',')})`).all(snapshot, ...keys);
    for (const [key,value] of Object.entries(expected)) {
      const matches = values.filter(row => row.key === key), type = value === null ? 'null' : typeof value === 'number' ? 'integer' : 'text';
      if (matches.length !== 1 || matches[0].type !== type || matches[0].atom !== value) throw new Error('received defender journal snapshot header metadata differs');
    }
  };
  for (const [index,row] of rows.entries()) {
    const {receipt_hash,...body} = row;
    if (row.sequence!==index+1 || row.owner!==receivedJournalOwners[index] || row.game_id!==enrollment.gameId || row.play_id!==enrollment.playId
      || row.physical_pitch_source_id!==enrollment.source.physicalPitchSourceId || row.player_id!==enrollment.source.playerId || row.runtime_source_id!==enrollment.source.runtimeSourceId
      || row.legacy_prefix_count!==enrollment.anchor.legacyAdmissionPrefix.count || row.legacy_prefix_digest!==enrollment.anchor.legacyAdmissionPrefix.digest
      || row.previous_receipt_hash!==(index ? rows[index-1].receipt_hash : null) || receipt_hash!==hash(body)
      || typeof row.source_id!=='string' || seen.has(json([row.owner,row.source_id]))) throw new Error('received defender journal identity or hash differs');
    const own = db.prepare(`SELECT * FROM ${row.owner} WHERE source_id=?`).get(row.source_id);
    if (!own || own.source_hash!==row.source_hash || own.snapshot_hash!==row.snapshot_hash || bytesHash(own.source_json)!==own.source_hash
      || bytesHash(own.snapshot_json)!==own.snapshot_hash) throw new Error('received defender journal owner archive hash differs');
    const parse = row.owner===receivedJournalOwners[0] ? receivedEnrollmentInput : row.owner===receivedJournalOwners[2] ? receivedAvailabilityInput : receivedReplanInput;
    const source = parse(JSON.parse(String(own.source_json)),row.source_id);
    // Later receipts remain opaque Core payloads, but every cached owner mirror
    // and declared Source/header edge must agree with this admitted scope.
    if (own.source_id !== row.source_id || own.source_version !== source.sourceVersion
      || own.game_id !== enrollment.gameId || own.play_id !== enrollment.playId
      || own.physical_pitch_source_id !== source.physicalPitchSourceId || own.player_id !== source.playerId) {
      throw new Error('received defender journal owner scope or Source-version metadata differs');
    }
    for (const key of ['observationSourceId','currentExecutionSourceId'] as const) {
      if (source[key] !== enrollment.source[key]) throw new Error('received defender journal frozen Source reference metadata differs');
    }

    if (json(source)!==own.source_json || source.physicalPitchSourceId!==enrollment.source.physicalPitchSourceId || source.playerId!==enrollment.source.playerId
      || row.owner!==receivedJournalOwners[0] && Reflect.get(source,'enrollmentSourceId')!==id) throw new Error('received defender journal Source differs');
    const mirrors = db.prepare("SELECT value,type FROM json_each(?) WHERE key='source'").all(String(own.snapshot_json));
    if (mirrors.length!==1 || mirrors[0].type!=='object' || mirrors[0].value!==own.source_json) throw new Error('received defender journal snapshot Source mirror differs');
    if (index===0 && row.source_id!==id || index>0 && own.enrollment_source_id!==id) throw new Error('received defender journal enrollment differs');
    if (index === 0) {
      if (Reflect.get(source,'runtimeSourceId') !== enrollment.source.runtimeSourceId || own.runtime_source_id !== enrollment.source.runtimeSourceId
        || own.call_source_id !== enrollment.cause.callSourceId || own.origin_communication_source_id !== enrollment.cause.originCommunicationSourceId
        || own.legacy_prefix_count !== enrollment.anchor.legacyAdmissionPrefix.count || own.legacy_prefix_digest !== enrollment.anchor.legacyAdmissionPrefix.digest) {
        throw new Error('received defender journal enrollment owner metadata differs');
      }
    } else {
      header(String(own.snapshot_json), {enrollmentHash:hash(enrollment)});
    }
    if (index === 2 && (own.policy_data_source_id !== Reflect.get(source,'policyDataSourceId')
      || own.observation_source_id !== source.observationSourceId || own.current_execution_source_id !== source.currentExecutionSourceId)) {
      throw new Error('received defender journal availability owner metadata differs');
    }

    if (index===1 || index===3) {
      const revision=index===1?1:2;
      if (own.revision!==revision || own.previous_source_id!==(revision===1?null:rows[1].source_id)
        || own.origin_process_source_id!==rows[1].source_id || own.policy_source_id!==(revision===1?null:rows[2].source_id)
        || Reflect.get(source,'previousReplanSourceId') !== own.previous_source_id || Reflect.get(source,'policySourceId') !== own.policy_source_id
        || own.call_source_id !== enrollment.cause.callSourceId || own.origin_communication_source_id !== enrollment.cause.originCommunicationSourceId) {
        throw new Error('received defender journal process lineage metadata differs');
      }
      for (const key of ['predecessorDecisionSourceId','predecessorMotorSourceId','predecessorAdoptionSourceId'] as const) {
        if (Reflect.get(source,key) !== enrollment.source[key]) throw new Error('received defender journal incumbent Source metadata differs');
      }
      header(String(own.snapshot_json), {revision,originProcessSourceId:String(rows[1].source_id),
        previousReplanHash:revision===1?null:String(rows[1].snapshot_hash),policyAvailabilityHash:revision===1?null:String(rows[2].snapshot_hash)});
      processSources.push(String(own.source_json));
      const histories = db.prepare("SELECT type,value FROM json_each(?) WHERE key='history'").all(String(own.snapshot_json));
      if (histories.length !== 1 || histories[0].type !== 'array') throw new Error('received defender journal history metadata differs');
      const history = db.prepare('SELECT key,type,value FROM json_each(?) ORDER BY CAST(key AS INTEGER)').all(String(histories[0].value));
      if (history.length !== revision || history.some((entry,i) => entry.key !== i || entry.type !== 'object' || entry.value !== processSources[i])) {
        throw new Error('received defender journal Source history metadata differs');
      }
    }
    seen.add(json([row.owner,row.source_id]));
  }
  const claims = receivedDefenderClaims(db,{gameId:enrollment.gameId,playId:enrollment.playId,physicalPitchSourceId:enrollment.source.physicalPitchSourceId});
  const expected = rows.length+(rows.length>=2?1:0);
  // Every admitted owner and journal row, plus one head once a process exists.
  if (claims.length!==rows.length*2+(rows.length>=2?1:0)) throw new Error('received defender journal orphan ownership claims differ');
  const owners = claims.filter(c=>c.owner!=='actual_received_umpire_defender_admissions');
  if (owners.length!==expected || owners.some(c=>c.owner!=='actual_received_umpire_defender_replan_heads'
    && !seen.has(json([c.owner,c.row.source_id])))) throw new Error('received defender journal unadmitted ownership differs');
  const heads = db.prepare('SELECT * FROM actual_received_umpire_defender_replan_heads WHERE enrollment_source_id=? OR (physical_pitch_source_id=? AND player_id=?)').all(id,enrollment.source.physicalPitchSourceId,enrollment.source.playerId);
  if (rows.length===1 ? heads.length!==0 : heads.length!==1) throw new Error('received defender process head differs');
  if (heads.length) {
    const head=heads[0],revision=rows.length===4?2:1;
    if (head.source_id!==rows[revision===1?1:3].source_id || head.revision!==revision || head.origin_process_source_id!==rows[1].source_id
      || head.enrollment_source_id!==id || head.physical_pitch_source_id!==enrollment.source.physicalPitchSourceId || head.player_id!==enrollment.source.playerId
      || head.call_source_id!==enrollment.cause.callSourceId || head.origin_communication_source_id!==enrollment.cause.originCommunicationSourceId) throw new Error('received defender current process head differs');
  }
  return rows;
};
export const appendReceivedJournal = (db: DatabaseSync, enrollment: DurableReceivedEnrollment, owner: string, sourceId: string) => {
  const rows=db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(enrollment.source.sourceId);
  if (rows.length>=4 || owner!==receivedJournalOwners[rows.length]) throw new Error('received defender admission stage is unsupported');
  const output=db.prepare(`SELECT source_hash,snapshot_hash FROM ${owner} WHERE source_id=?`).get(sourceId);
  if (!output) throw new Error('received defender admission output missing');
  const row={enrollment_source_id:enrollment.source.sourceId,sequence:rows.length+1,game_id:enrollment.gameId,play_id:enrollment.playId,
    physical_pitch_source_id:enrollment.source.physicalPitchSourceId,player_id:enrollment.source.playerId,runtime_source_id:enrollment.source.runtimeSourceId,
    owner,source_id:sourceId,source_hash:output.source_hash,snapshot_hash:output.snapshot_hash,
    legacy_prefix_count:enrollment.anchor.legacyAdmissionPrefix.count,legacy_prefix_digest:enrollment.anchor.legacyAdmissionPrefix.digest,
    previous_receipt_hash:rows.at(-1)?.receipt_hash??null};
  db.prepare('INSERT INTO actual_received_umpire_defender_admissions VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(row),hash(row));
};

export const receivedSourceRow=(db:DatabaseSync,table:typeof receivedJournalOwners[number],sourceId:string)=>{
  if(!receivedId(sourceId))throw new Error('invalid received owner Source identity');
  if(receivedOwnerSchema(db)==='pristine')return null;
  const rows=db.prepare(`SELECT * FROM ${table} WHERE source_id=? OR EXISTS(SELECT 1 FROM (${nodes('source_json',['sourceId'])}) n WHERE n.atom=?)
    OR EXISTS(SELECT 1 FROM (${nodes('snapshot_json',['source','sourceId'])}) n WHERE n.atom=?)`).all(sourceId,sourceId,sourceId);
  if(!rows.length){if(receivedDefenderReferenceClaims(db,[{owner:table,sourceId}]).length)throw new Error('received owner orphan Source ownership claims');return null;}
  if(rows.length!==1||rows[0].source_id!==sourceId)throw new Error('received owner Source ownership differs');
  return rows[0];
};
