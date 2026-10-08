import type { DatabaseSync } from 'node:sqlite';
import { deriveReceivedUmpireDefenderReplan, type ReceivedUmpireDefenderReplanInput } from '../../core/sim/fielding/ReceivedUmpireDefenderReplan';
import { receivedReplanInput, type ReceivedReplanSource } from './ActualReceivedUmpireDefender';
import { actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireDefenderEnrollmentStore';
import { receivedEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireDefenderEvidence';
import { actualReceivedUmpireDefenderPolicyAvailabilityEvidenceFromSqlite, qualifyReceivedCurrentEnrollment } from './SqliteActualReceivedUmpireDefenderPolicyAvailabilityStore';
import { receivedJournal, appendReceivedJournal, receivedSourceRow } from './ActualReceivedUmpireDefenderJournal';
import { openReceivedTransaction, withReceivedReadProof } from './ActualReceivedUmpireDefenderTransaction';
import { actorHash as hash, actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type DurableReceivedReplan = Readonly<{source:ReceivedReplanSource;revision:number;originProcessSourceId:string;history:readonly ReceivedReplanSource[];
  enrollmentHash:string;previousReplanHash:string|null;policyAvailabilityHash:string|null;dependencyHashes:Readonly<Record<string,string>>;
  input:ReceivedUmpireDefenderReplanInput;replan:ReturnType<typeof deriveReceivedUmpireDefenderReplan>}>;
const table='actual_received_umpire_defender_replans';
export const actualReceivedUmpireDefenderReplanEvidenceFromSqlite=(db:DatabaseSync)=>{
  const active=new Set<string>();
  const derive=(source:ReceivedReplanSource):{value:DurableReceivedReplan;enrollment:NonNullable<ReturnType<ReturnType<typeof actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite>['read']>>}=>{
    const enrollment=actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite(db).read(source.enrollmentSourceId);
    if(!enrollment)throw new Error('received process enrollment missing');
    for(const key of ['physicalPitchSourceId','playerId','observationSourceId','currentExecutionSourceId','predecessorDecisionSourceId','predecessorMotorSourceId','predecessorAdoptionSourceId'] as const)
      if(source[key]!==enrollment.source[key])throw new Error('received process frozen origin binding differs');
    if(source.previousReplanSourceId===source.sourceId)throw new Error('received process self predecessor differs');
    const previous=source.previousReplanSourceId===null?null:read(source.previousReplanSourceId);
    if(source.previousReplanSourceId!==null&&!previous)throw new Error('received process predecessor missing');
    if(previous&&(previous.revision!==1||previous.source.enrollmentSourceId!==source.enrollmentSourceId||previous.source.policySourceId!==null
      ||previous.replan.trigger!=='communication_received'||previous.replan.scheduling===null))throw new Error('received process unsupported predecessor transition');
    if(previous===null?source.policySourceId!==null:source.policySourceId===null)throw new Error('received process requires the sole null-to-policy transition');
    const policy=source.policySourceId===null?null:actualReceivedUmpireDefenderPolicyAvailabilityEvidenceFromSqlite(db).read(source.policySourceId);
    if(source.policySourceId!==null&&(!policy||policy.source.enrollmentSourceId!==source.enrollmentSourceId))throw new Error('received process availability binding differs');
    const original=receivedEnrollmentEvidenceFromSqlite(db).derive(enrollment.source,enrollment.anchor.legacyAdmissionPrefix.count);
    if(json(original.value)!==json(enrollment))throw new Error('received process original enrollment changed');
    const originProcessSourceId=previous?.originProcessSourceId??source.sourceId;
    const input:ReceivedUmpireDefenderReplanInput={...original.bridge.input,processSourceId:originProcessSourceId,
      policy:policy===null?null:{sourceId:policy.source.sourceId,hash:hash(policy),availableAt:policy.availableAt,profiles:policy.policyData.source.profiles},previous:previous?.replan??null};
    const replan=deriveReceivedUmpireDefenderReplan(input);
    if(json(replan.cause)!==json(enrollment.cause)||previous&&json(previous.replan.cause)!==json(replan.cause))throw new Error('received process cause differs');
    const value=freeze({source,revision:(previous?.revision??0)+1,originProcessSourceId,history:[...(previous?.history??[]),source],enrollmentHash:hash(enrollment),
      previousReplanHash:previous===null?null:hash(previous),policyAvailabilityHash:policy===null?null:hash(policy),dependencyHashes:original.bridge.dependencyHashes,input,replan});
    return {value,enrollment};
  };
  const read=(id:string):DurableReceivedReplan|null=>{
    if(active.has(id))throw new Error('received process predecessor cycle');active.add(id);
    try{
      const row=receivedSourceRow(db,table,id);if(!row)return null;
      const source=receivedReplanInput(JSON.parse(String(row.source_json)),id),{value,enrollment}=derive(source);
      if(row.source_version!==source.sourceVersion||row.game_id!==enrollment.gameId||row.play_id!==enrollment.playId||row.physical_pitch_source_id!==source.physicalPitchSourceId
        ||row.player_id!==source.playerId||row.enrollment_source_id!==source.enrollmentSourceId||row.call_source_id!==enrollment.cause.callSourceId
        ||row.origin_communication_source_id!==enrollment.cause.originCommunicationSourceId||row.origin_process_source_id!==value.originProcessSourceId
        ||row.previous_source_id!==source.previousReplanSourceId||row.policy_source_id!==source.policySourceId||row.revision!==value.revision
        ||row.source_json!==json(source)||row.source_hash!==hash(source)||row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('received process archive differs');
      const journal=receivedJournal(db,enrollment),index=value.revision===1?1:3;
      if(journal[index]?.source_id!==id)throw new Error('received process historical admission differs');return value;
    }finally{active.delete(id);}
  };
  return {derive,read:(id:string)=>withReceivedReadProof(db,()=>read(id))};
};
export const openSqliteActualReceivedUmpireDefenderReplanStore=(path:string,authority?:Readonly<{readAcceptedReplan(id:string):ReceivedReplanSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedReplan!=='function')throw new Error('invalid received process authority');
  const tx=openReceivedTransaction(path),db=tx.db,own=actualReceivedUmpireDefenderReplanEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedReplan(id)??null;return raw===null?null:receivedReplanInput(raw,id);};
  const before=(source:ReceivedReplanSource)=>{
    const p=own.derive(source),journal=receivedJournal(db,p.enrollment);
    if(p.value.revision===1?journal.length!==1:journal.length!==3||journal[1].source_id!==source.previousReplanSourceId||journal[2].source_id!==source.policySourceId)
      throw new Error('received process current head or admission stage differs');
    qualifyReceivedCurrentEnrollment(db,p.enrollment);return p;
  };
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableReceivedReplan{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received process Source frozen differently');return tx.read(()=>{const saved=own.read(id);if(!saved||json(saved)!==json(prior))throw new Error('received process historical retry changed');return saved;});}
    if(!source)throw new Error('accepted received process Source missing');
    const proposal=tx.read(()=>before(source));let durable:unknown;
    return tx.write({bootstrap:false,changes:3},()=>{
      const p=tx.proof(()=>{if(json(accepted(id))!==json(source))throw new Error('received process callback Source changed');const value=before(source);if(json(value)!==json(proposal))throw new Error('received process original proposal changed');return value;});
      const v=p.value,e=p.enrollment;
      const qualify=()=>{if(json(accepted(id))!==json(source))throw new Error('received process callback Source changed');return qualifyReceivedCurrentEnrollment(db,e);};
      const open=tx.proof(qualify);
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,source.sourceVersion,e.gameId,e.playId,source.physicalPitchSourceId,source.playerId,source.enrollmentSourceId,
        e.cause.callSourceId,e.cause.originCommunicationSourceId,v.originProcessSourceId,source.previousReplanSourceId,source.policySourceId,v.revision,json(source),hash(source),json(v),hash(v));
      if(tx.proof(qualify)!==open)throw new Error('received process closure state changed');
      if(v.revision===1)db.prepare('INSERT INTO actual_received_umpire_defender_replan_heads VALUES(?,?,?,?,?,?,?,?)').run(source.physicalPitchSourceId,source.playerId,source.enrollmentSourceId,id,v.originProcessSourceId,e.cause.callSourceId,e.cause.originCommunicationSourceId,1);
      else{
        const changed=db.prepare('UPDATE actual_received_umpire_defender_replan_heads SET source_id=?,revision=2 WHERE physical_pitch_source_id=? AND player_id=? AND enrollment_source_id=? AND source_id=? AND revision=1 AND origin_process_source_id=? AND call_source_id=? AND origin_communication_source_id=?')
          .run(id,source.physicalPitchSourceId,source.playerId,source.enrollmentSourceId,source.previousReplanSourceId,v.originProcessSourceId,e.cause.callSourceId,e.cause.originCommunicationSourceId);
        if(changed.changes!==1)throw new Error('received process consecutive head CAS failed');
      }
      if(tx.proof(qualify)!==open)throw new Error('received process closure state changed');
      appendReceivedJournal(db,e,table,id);
      if(tx.proof(qualify)!==open)throw new Error('received process closure state changed');
      const saved=tx.proof(()=>own.read(id));if(!saved||json(saved)!==json(v))throw new Error('received process changed during write');
      durable=[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_defender_replan_heads WHERE enrollment_source_id=?').get(source.enrollmentSourceId),db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(source.enrollmentSourceId)];return saved;
    },()=>{const now=[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_defender_replan_heads WHERE enrollment_source_id=?').get(source.enrollmentSourceId),db.prepare('SELECT * FROM actual_received_umpire_defender_admissions WHERE enrollment_source_id=? ORDER BY sequence').all(source.enrollmentSourceId)];if(json(now)!==json(durable))throw new Error('received process durable rows differ');});
  },close:tx.close});
};
