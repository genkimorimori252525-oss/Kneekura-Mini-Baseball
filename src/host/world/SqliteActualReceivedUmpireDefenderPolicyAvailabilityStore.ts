import type { DatabaseSync } from 'node:sqlite';
import { receivedAvailabilityInput, type ReceivedAvailabilitySource } from './ActualReceivedUmpireDefender';
import { actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireDefenderEnrollmentStore';
import { receivedEnrollmentEvidenceFromSqlite, type DurableReceivedEnrollment } from './ActualReceivedUmpireDefenderEvidence';
import { receivedUmpireDefenderPolicyDataEvidenceFromSqlite } from './SqliteReceivedUmpireDefenderPolicyDataStore';
import { receivedJournal, appendReceivedJournal, receivedSourceRow } from './ActualReceivedUmpireDefenderJournal';
import { openReceivedTransaction, withReceivedReadProof } from './ActualReceivedUmpireDefenderTransaction';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table='actual_received_umpire_defender_policy_availabilities';
export const qualifyReceivedCurrentEnrollment=(db:DatabaseSync,enrollment:DurableReceivedEnrollment)=>{
  const own=receivedEnrollmentEvidenceFromSqlite(db),derived=own.derive(enrollment.source,enrollment.anchor.legacyAdmissionPrefix.count);
  if(json(derived.value)!==json(enrollment))throw new Error('received current enrollment original evidence differs');
  return own.qualifyCurrent(derived);
};
export const actualReceivedUmpireDefenderPolicyAvailabilityEvidenceFromSqlite=(db:DatabaseSync)=>{
  const derive=(source:ReceivedAvailabilitySource)=>{
    const enrollment=actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite(db).read(source.enrollmentSourceId);
    if(!enrollment)throw new Error('received policy availability enrollment missing');
    for(const key of ['physicalPitchSourceId','playerId','observationSourceId','currentExecutionSourceId'] as const)
      if(source[key]!==enrollment.source[key])throw new Error('received policy availability enrollment binding differs');
    const policyData=receivedUmpireDefenderPolicyDataEvidenceFromSqlite(db).read(source.policyDataSourceId),r=enrollment.receiver;
    if(!policyData||policyData.source.sourceId!==source.policyDataSourceId||policyData.source.careerId!==r.careerId||policyData.source.playerId!==r.playerId
      ||policyData.source.personLinkSourceId!==r.personLinkSourceId||policyData.source.fieldingModelSourceId!==r.fieldingModelSourceId
      ||policyData.fieldingModel.person.personId!==r.personId||policyData.fieldingModel.person.sourceId!==r.personLinkSourceId
      ||hash(policyData.fieldingModel)!==enrollment.anchor.fieldingModelHash||policyData.source.acceptedAtDay>r.gameDay
      ||policyData.source.acceptedAtDay<policyData.fieldingModel.source.acceptedAtDay)throw new Error('received policy availability original binding or day differs');
    const value=freeze({source,enrollmentHash:hash(enrollment),policyDataHash:hash(policyData),observationHash:enrollment.anchor.observation.snapshotHash,
      currentExecutionHash:enrollment.anchor.execution.snapshotHash,availableAt:enrollment.anchor.at,policyData});
    return {value,enrollment};
  };
  const read=(sourceId:string)=>{
    const row=receivedSourceRow(db,table,sourceId);if(!row)return null;
    const source=receivedAvailabilityInput(JSON.parse(String(row.source_json)),sourceId),{value,enrollment}=derive(source);
    if(row.source_version!==source.sourceVersion||row.game_id!==enrollment.gameId||row.play_id!==enrollment.playId||row.physical_pitch_source_id!==source.physicalPitchSourceId
      ||row.player_id!==source.playerId||row.enrollment_source_id!==source.enrollmentSourceId||row.policy_data_source_id!==source.policyDataSourceId
      ||row.observation_source_id!==source.observationSourceId||row.current_execution_source_id!==source.currentExecutionSourceId
      ||row.source_json!==json(source)||row.source_hash!==hash(source)||row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('received policy availability archive differs');
    const journal=receivedJournal(db,enrollment);if(journal.length<3||journal[2].source_id!==sourceId)throw new Error('received policy availability admission differs');return value;
  };
  return {derive,read:(sourceId:string)=>withReceivedReadProof(db,()=>read(sourceId))};
};
export type DurableReceivedAvailability=NonNullable<ReturnType<ReturnType<typeof actualReceivedUmpireDefenderPolicyAvailabilityEvidenceFromSqlite>['read']>>;
export const openSqliteActualReceivedUmpireDefenderPolicyAvailabilityStore=(path:string,authority?:Readonly<{readAcceptedAvailability(sourceId:string):ReceivedAvailabilitySource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedAvailability!=='function')throw new Error('invalid received availability authority');
  const tx=openReceivedTransaction(path),db=tx.db,own=actualReceivedUmpireDefenderPolicyAvailabilityEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedAvailability(id)??null;return raw===null?null:receivedAvailabilityInput(raw,id);};
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableReceivedAvailability{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received availability Source frozen differently');return tx.read(()=>{const saved=own.read(id);if(!saved||json(saved)!==json(prior))throw new Error('received availability retry changed');return saved;});}
    if(!source)throw new Error('accepted received availability Source missing');
    const proposal=tx.read(()=>{const p=own.derive(source);if(receivedJournal(db,p.enrollment).length!==2)throw new Error('received availability requires null process admission stage');qualifyReceivedCurrentEnrollment(db,p.enrollment);return p;});
    let durable:unknown;
    return tx.write({bootstrap:false,changes:2},()=>{
      const current=tx.proof(()=>{if(json(accepted(id))!==json(source))throw new Error('received availability callback changed');const p=own.derive(source);if(json(p)!==json(proposal)||receivedJournal(db,p.enrollment).length!==2)throw new Error('received availability current stage changed');return p;});
      const qualify=()=>{if(json(accepted(id))!==json(source))throw new Error('received availability callback Source changed');return qualifyReceivedCurrentEnrollment(db,current.enrollment);};
      const open=tx.proof(qualify);
      const v=current.value,e=current.enrollment;
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,source.sourceVersion,e.gameId,e.playId,source.physicalPitchSourceId,source.playerId,
        source.enrollmentSourceId,source.policyDataSourceId,source.observationSourceId,source.currentExecutionSourceId,json(source),hash(source),json(v),hash(v));
      if(tx.proof(qualify)!==open)throw new Error('received availability closure changed');
      appendReceivedJournal(db,e,table,id);
      if(tx.proof(qualify)!==open)throw new Error('received availability closure changed');
      const saved=tx.proof(()=>own.read(id));if(!saved||json(saved)!==json(v))throw new Error('received availability changed during write');
      durable=[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(e.source.sourceId)];return saved;
    },()=>{const now=[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(source.enrollmentSourceId)];if(json(now)!==json(durable))throw new Error('received availability durable rows differ');});
  },close:tx.close});
};
