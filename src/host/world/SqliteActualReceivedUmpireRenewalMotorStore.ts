import type { DatabaseSync } from 'node:sqlite';
import { renewalMotorInput,type RenewalMotorSource } from './ActualReceivedUmpireRenewal';
import { actualReceivedUmpireRenewalDecisionEvidenceFromSqlite,type DurableReceivedRenewalDecision } from './SqliteActualReceivedUmpireRenewalDecisionStore';
import { receivedRenewalEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireRenewalEvidence';
import { deriveReceivedRenewalMotorReceipt } from './ActualReceivedUmpireRenewalMotor';
import { openRenewalTransaction,withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
import { renewalJournal,appendRenewalJournal,renewalSourceRow,renewalScope } from './ActualReceivedUmpireRenewalJournal';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table='actual_received_umpire_renewal_motors',decisionTable='actual_received_umpire_renewal_decisions',enrollmentTable='actual_received_umpire_renewal_enrollments';
type Original=ReturnType<ReturnType<typeof receivedRenewalEnrollmentEvidenceFromSqlite>['derive']>;
const motorValue=(source:RenewalMotorSource,decision:DurableReceivedRenewalDecision,original:Original)=>{
  const e=original.value;
  if(source.renewalEnrollmentSourceId!==e.source.sourceId||decision.source.renewalEnrollmentSourceId!==e.source.sourceId
    ||source.renewalDecisionSourceId!==decision.source.sourceId||decision.enrollmentHash!==hash(e)
    ||hash(original.self)!==e.anchor.selfHash||original.model.source.sourceId!==e.anchor.locomotionModel.sourceId
    ||hash(original.model.source)!==e.anchor.locomotionModel.sourceHash||hash(original.model)!==e.anchor.locomotionModel.snapshotHash)throw new Error('received renewal motor original decision self or model binding differs');
  const receipt=deriveReceivedRenewalMotorReceipt(decision.receipt,original.model,original.self);
  return freeze({source,gameId:e.gameId,playId:e.playId,physicalPitchSourceId:e.physicalPitchSourceId,playerId:e.playerId,
    renewalEnrollmentSourceId:e.source.sourceId,enrollmentHash:hash(e),decisionHash:hash(decision),receipt});
};
export type DurableReceivedRenewalMotor=ReturnType<typeof motorValue>;
export const actualReceivedUmpireRenewalMotorEvidenceFromSqlite=(db:DatabaseSync)=>{
  const decisions=actualReceivedUmpireRenewalDecisionEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const derive=(raw:RenewalMotorSource,current=false)=>{
    const source=renewalMotorInput(raw);
    const result=decisions.withOriginal(source.renewalDecisionSourceId,({value:decision,original})=>{
      const value=motorValue(source,decision,original);
      if(current){const journal=renewalJournal(db,original.value);if(journal.length!==2||journal[1].source_id!==source.renewalDecisionSourceId)throw new Error('received renewal motor is already owned or head stage differs');originalOwner.qualifyCurrent(original);}
      return {value,decision,original};
    });
    if(!result)throw new Error('received renewal motor decision missing');return result;
  };
  const readOriginal=(id:string)=>{
    const row=renewalSourceRow(db,table,id);if(!row)return null;
    const source=renewalMotorInput(JSON.parse(String(row.source_json)),id);
    return decisions.withOriginal(source.renewalDecisionSourceId,({value:decision,original})=>{
      const value=motorValue(source,decision,original),e=original.value;
      if(row.source_version!==source.sourceVersion||row.renewal_decision_source_id!==source.renewalDecisionSourceId||Object.entries(renewalScope(e)).some(([k,v])=>row[k]!==v)
        ||row.source_json!==json(source)||row.source_hash!==hash(source)||row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('received renewal motor archive differs');
      if(renewalJournal(db,e)[2]?.source_id!==id)throw new Error('received renewal motor historical admission differs');return {value,decision,original};
    });
  };
  const withOriginal=<T>(id:string,consume:(derived:{value:DurableReceivedRenewalMotor;decision:DurableReceivedRenewalDecision;original:Original})=>T):T|null=>withRenewalReadProof(db,()=>{
    const derived=readOriginal(id);return derived===null?null:consume(derived);
  });
  return {derive,deriveCurrent:(s:RenewalMotorSource)=>derive(s,true),read:(id:string)=>withOriginal(id,d=>d.value),withOriginal};
};
export const openSqliteActualReceivedUmpireRenewalMotorStore=(path:string,authority?:Readonly<{readAcceptedMotor(id:string):RenewalMotorSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedMotor!=='function')throw new Error('invalid received renewal motor authority');
  const tx=openRenewalTransaction(path),db=tx.db,own=actualReceivedUmpireRenewalMotorEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedMotor(id)??null;return raw===null?null:renewalMotorInput(raw,id);};
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableReceivedRenewalMotor{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received renewal motor Source frozen differently');return tx.read(()=>{const saved=own.read(id);if(!saved||json(saved)!==json(prior))throw new Error('received renewal motor retry changed');return saved;});}
    if(!source)throw new Error('accepted received renewal motor Source missing');
    const proposal=tx.read(()=>own.deriveCurrent(source)),e=proposal.original.value;let durable:unknown;
    const inputs=()=>[db.prepare(`SELECT * FROM ${enrollmentTable} WHERE source_id=?`).get(e.source.sourceId),db.prepare(`SELECT * FROM ${decisionTable} WHERE source_id=?`).get(source.renewalDecisionSourceId)];
    const rows=()=>[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=?').get(e.source.sourceId),db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? ORDER BY sequence').all(e.source.sourceId)];
    return tx.write({bootstrap:false,changes:3},()=>{
      const frozenInputs=tx.proof(()=>{if(json(accepted(id))!==json(source))throw new Error('received renewal motor callback Source changed');const d=own.deriveCurrent(source);if(json(d.value)!==json(proposal.value)||json(d.original.value)!==json(e))throw new Error('received renewal motor original proposal changed');return inputs();});
      const qualify=()=>{if(json(accepted(id))!==json(source))throw new Error('received renewal motor callback Source changed');const d=originalOwner.derive(e.source);
        if(json(d.value)!==json(e)||json(inputs())!==json(frozenInputs))throw new Error('received renewal motor dependency proof changed');return originalOwner.qualifyCurrent(d);};
      const open=tx.proof(qualify),v=proposal.value;
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,source.sourceVersion,e.gameId,e.playId,e.physicalPitchSourceId,e.playerId,e.runtimeSourceId,e.receivedEnrollmentSourceId,e.originProcessSourceId,e.receivedReplanSourceId,e.source.sourceId,source.renewalDecisionSourceId,json(source),hash(source),json(v),hash(v));
      if(tx.proof(qualify)!==open)throw new Error('received renewal motor closure changed after owner');
      const changed=db.prepare('UPDATE actual_received_umpire_renewal_heads SET stage=3,owner=?,source_id=?,renewal_motor_source_id=? WHERE renewal_enrollment_source_id=? AND stage=2 AND owner=? AND source_id=? AND renewal_decision_source_id=?')
        .run(table,id,id,e.source.sourceId,decisionTable,source.renewalDecisionSourceId,source.renewalDecisionSourceId);if(changed.changes!==1)throw new Error('received renewal motor head CAS failed');
      if(tx.proof(qualify)!==open)throw new Error('received renewal motor closure changed after head');
      appendRenewalJournal(db,e,table,id);if(tx.proof(qualify)!==open)throw new Error('received renewal motor closure changed after journal');
      const saved=tx.proof(()=>own.read(id));if(!saved||json(saved)!==json(v))throw new Error('received renewal motor changed during write');durable=rows();return saved;
    },()=>{
      if(json(rows())!==json(durable))throw new Error('received renewal motor committed rows differ');
      if(json(accepted(id))!==json(source))throw new Error('received renewal motor committed callback Source changed');
      const d=own.withOriginal(id,derived=>{if(json(derived.value)!==json(proposal.value)||json(derived.original.value)!==json(e))throw new Error('received renewal motor committed original differs');return derived;});
      if(!d)throw new Error('received renewal motor committed owner missing');originalOwner.qualifyCurrent(d.original);
    });
  },close:tx.close});
};
