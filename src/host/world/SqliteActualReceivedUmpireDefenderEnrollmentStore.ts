import type { DatabaseSync } from 'node:sqlite';
import { receivedEnrollmentInput, receivedId, type ReceivedEnrollmentSource } from './ActualReceivedUmpireDefender';
import { receivedOwnerSchema } from './ActualReceivedUmpireDefenderSchema';
import { receivedDefenderClaims } from './ActualReceivedUmpireDefenderClaims';
import { receivedEnrollmentEvidenceFromSqlite, type DurableReceivedEnrollment } from './ActualReceivedUmpireDefenderEvidence';
import { receivedJournal, appendReceivedJournal, receivedSourceRow } from './ActualReceivedUmpireDefenderJournal';
import { openReceivedTransaction, withReceivedReadProof } from './ActualReceivedUmpireDefenderTransaction';
import { actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table='actual_received_umpire_defender_enrollments';
export const actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite = (db: DatabaseSync) => {
  const original=receivedEnrollmentEvidenceFromSqlite(db);
  const read=(sourceId:string):DurableReceivedEnrollment|null=>{
    if(!receivedId(sourceId))throw new Error('invalid received enrollment Source identity');
    if(receivedOwnerSchema(db)==='pristine')return null;
    const row=receivedSourceRow(db,table,sourceId);if(!row)return null;
    const source=receivedEnrollmentInput(JSON.parse(String(row.source_json)),sourceId);
    const {value}=original.derive(source,Number(row.legacy_prefix_count));
    if(row.source_version!==source.sourceVersion||row.game_id!==value.gameId||row.play_id!==value.playId||row.physical_pitch_source_id!==source.physicalPitchSourceId
      ||row.player_id!==source.playerId||row.runtime_source_id!==source.runtimeSourceId||row.call_source_id!==value.cause.callSourceId
      ||row.origin_communication_source_id!==value.cause.originCommunicationSourceId||row.legacy_prefix_count!==value.anchor.legacyAdmissionPrefix.count
      ||row.legacy_prefix_digest!==value.anchor.legacyAdmissionPrefix.digest||row.source_json!==json(source)||row.source_hash!==hash(source)
      ||row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('received enrollment archive differs');
    receivedJournal(db,value);return value;
  };
  return Object.freeze({read:(sourceId:string)=>withReceivedReadProof(db,()=>read(sourceId))});
};
export const openSqliteActualReceivedUmpireDefenderEnrollmentStore=(path:string,authority?:Readonly<{readAcceptedEnrollment(sourceId:string):ReceivedEnrollmentSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedEnrollment!=='function')throw new Error('invalid received enrollment authority');
  const tx=openReceivedTransaction(path),db=tx.db,original=receivedEnrollmentEvidenceFromSqlite(db),own=actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite(db);
  const accepted=(sourceId:string)=>{const raw=authority?.readAcceptedEnrollment(sourceId)??null;return raw===null?null:receivedEnrollmentInput(raw,sourceId);};
  return Object.freeze({read:(sourceId:string)=>tx.read(()=>own.read(sourceId)),accept(sourceId:string):DurableReceivedEnrollment{
    const {prior,source}=tx.read(()=>({prior:own.read(sourceId),source:accepted(sourceId)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received enrollment Source frozen differently');return tx.read(()=>{const saved=own.read(sourceId);if(!saved||json(saved)!==json(prior))throw new Error('received enrollment retry changed');return saved;});}
    if(!source)throw new Error('accepted received enrollment Source missing');
    const proposal=tx.read(()=>{const derived=original.derive(source);original.qualifyCurrent(derived);if(receivedDefenderClaims(db,{gameId:derived.value.gameId,playId:derived.value.playId,physicalPitchSourceId:derived.value.source.physicalPitchSourceId}).length)throw new Error('received enrollment already has ownership claims');return derived.value;});
    let durableRows:unknown;
    return tx.write({bootstrap:true,changes:2},()=>{
      const qualify=()=>{if(json(accepted(sourceId))!==json(source))throw new Error('received enrollment callback Source changed');const current=original.derive(source);if(json(current.value)!==json(proposal))throw new Error('received enrollment original proof changed');return original.qualifyCurrent(current);};
      const open=tx.proof(qualify);
      if(tx.proof(()=>receivedDefenderClaims(db,{gameId:proposal.gameId,playId:proposal.playId,physicalPitchSourceId:proposal.source.physicalPitchSourceId})).length)throw new Error('received enrollment ownership appeared');
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(sourceId,source.sourceVersion,proposal.gameId,proposal.playId,source.physicalPitchSourceId,source.playerId,source.runtimeSourceId,
        proposal.cause.callSourceId,proposal.cause.originCommunicationSourceId,proposal.anchor.legacyAdmissionPrefix.count,proposal.anchor.legacyAdmissionPrefix.digest,json(source),hash(source),json(proposal),hash(proposal));
      if(tx.proof(qualify)!==open)throw new Error('received enrollment closure state changed');
      appendReceivedJournal(db,proposal,table,sourceId);
      if(tx.proof(qualify)!==open)throw new Error('received enrollment closure state changed');
      const saved=tx.proof(()=>own.read(sourceId));if(!saved||json(saved)!==json(proposal))throw new Error('received enrollment archive changed during write');
      durableRows=[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(sourceId),db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(sourceId)];
      return saved;
    },()=>{const rows=[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(sourceId),db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(sourceId)];
      if(json(rows)!==json(durableRows))throw new Error('received enrollment durable rows differ');});
  },close:tx.close});
};
