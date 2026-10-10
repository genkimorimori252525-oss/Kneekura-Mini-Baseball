import type { DatabaseSync } from 'node:sqlite';
import { renewalDecisionInput,renewalExactCut,assertRenewalCut,type RenewalDecisionSource } from './ActualReceivedUmpireRenewal';
import { actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import { receivedRenewalEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireRenewalEvidence';
import { openRenewalTransaction,withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
import { renewalJournal,appendRenewalJournal,renewalSourceRow,renewalScope } from './ActualReceivedUmpireRenewalJournal';
import { actorHash as hash,actorJson as json,actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table='actual_received_umpire_renewal_decisions',enrollmentTable='actual_received_umpire_renewal_enrollments';
type Original=ReturnType<ReturnType<typeof receivedRenewalEnrollmentEvidenceFromSqlite>['derive']>;
const decisionValue=(source:RenewalDecisionSource,original:Original)=>{
  const e=original.value,s=e.selection;
  assertRenewalCut(e.cut,renewalExactCut(s.selectedAt,e.cut.ticksPerSecond));
  if(s.movementStartTick!==e.cut.tick||s.dueTick!==e.cut.tick
    ||!['ball_handler','hold'].includes(s.selected.intent.kind)||(s.selected.intent.kind==='hold')!==(s.target===null))throw new Error('received renewal decision selection or exact issuance cut differs');
  return freeze({source,gameId:e.gameId,playId:e.playId,physicalPitchSourceId:e.physicalPitchSourceId,playerId:e.playerId,
    renewalEnrollmentSourceId:e.source.sourceId,enrollmentHash:hash(e),receivedReplanHash:e.anchor.receivedReplan.snapshotHash,
    receipt:{kind:'received_umpire_renewal_decision_v1' as const,sourceId:source.sourceId,playerId:e.playerId,physicalPitchSourceId:e.physicalPitchSourceId,
      personId:e.receiver.personId,personLinkSourceId:e.receiver.personLinkSourceId,gameDay:e.receiver.gameDay,
      cut:e.cut,selected:s.selected,target:s.target,movementStartTick:s.movementStartTick,
      lifecycle:{status:'issued' as const,issuedBySourceId:source.sourceId}}});
};
export type DurableReceivedRenewalDecision=ReturnType<typeof decisionValue>;
export const actualReceivedUmpireRenewalDecisionEvidenceFromSqlite=(db:DatabaseSync)=>{
  const enrollments=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const derive=(raw:RenewalDecisionSource,current=false)=>{
    const source=renewalDecisionInput(raw);
    const result=enrollments.withOriginal(source.renewalEnrollmentSourceId,original=>{
      const value=decisionValue(source,original);
      if(current){if(renewalJournal(db,original.value).length!==1)throw new Error('received renewal decision is already issued or head stage differs');originalOwner.qualifyCurrent(original);}
      return {value,original};
    });
    if(!result)throw new Error('received renewal decision enrollment missing');return result;
  };
  const readOriginal=(id:string)=>{
    const row=renewalSourceRow(db,table,id);if(!row)return null;
    const source=renewalDecisionInput(JSON.parse(String(row.source_json)),id);
    return enrollments.withOriginal(source.renewalEnrollmentSourceId,original=>{
      const value=decisionValue(source,original),e=original.value;
      if(row.source_version!==source.sourceVersion||Object.entries(renewalScope(e)).some(([k,v])=>row[k]!==v)
        ||row.source_json!==json(source)||row.source_hash!==hash(source)||row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('received renewal decision archive differs');
      if(renewalJournal(db,e)[1]?.source_id!==id)throw new Error('received renewal decision historical admission differs');return {value,original};
    });
  };
  const withOriginal=<T>(id:string,consume:(derived:{value:DurableReceivedRenewalDecision;original:Original})=>T):T|null=>withRenewalReadProof(db,()=>{
    const derived=readOriginal(id);return derived===null?null:consume(derived);
  });
  return {derive,deriveCurrent:(s:RenewalDecisionSource)=>derive(s,true),read:(id:string)=>withOriginal(id,d=>d.value),withOriginal};
};
export const openSqliteActualReceivedUmpireRenewalDecisionStore=(path:string,authority?:Readonly<{readAcceptedDecision(id:string):RenewalDecisionSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedDecision!=='function')throw new Error('invalid received renewal decision authority');
  const tx=openRenewalTransaction(path),db=tx.db,own=actualReceivedUmpireRenewalDecisionEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedDecision(id)??null;return raw===null?null:renewalDecisionInput(raw,id);};
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableReceivedRenewalDecision{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received renewal decision Source frozen differently');return tx.read(()=>{const saved=own.read(id);if(!saved||json(saved)!==json(prior))throw new Error('received renewal decision retry changed');return saved;});}
    if(!source)throw new Error('accepted received renewal decision Source missing');
    const proposal=tx.read(()=>own.deriveCurrent(source)),e=proposal.original.value;let durable:unknown;
    const rows=()=>[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=?').get(e.source.sourceId),db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? ORDER BY sequence').all(e.source.sourceId)];
    return tx.write({bootstrap:false,changes:3},()=>{
      const frozenEnrollment=tx.proof(()=>{if(json(accepted(id))!==json(source))throw new Error('received renewal decision callback Source changed');const d=own.deriveCurrent(source);if(json(d.value)!==json(proposal.value)||json(d.original.value)!==json(e))throw new Error('received renewal decision original proposal changed');return db.prepare(`SELECT * FROM ${enrollmentTable} WHERE source_id=?`).get(e.source.sourceId);});
      const qualify=()=>{if(json(accepted(id))!==json(source))throw new Error('received renewal decision callback Source changed');const d=originalOwner.derive(e.source);
        if(json(d.value)!==json(e)||json(db.prepare(`SELECT * FROM ${enrollmentTable} WHERE source_id=?`).get(e.source.sourceId))!==json(frozenEnrollment))throw new Error('received renewal decision dependency proof changed');return originalOwner.qualifyCurrent(d);};
      const open=tx.proof(qualify),v=proposal.value;
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,source.sourceVersion,e.gameId,e.playId,e.physicalPitchSourceId,e.playerId,e.runtimeSourceId,e.receivedEnrollmentSourceId,e.originProcessSourceId,e.receivedReplanSourceId,e.source.sourceId,json(source),hash(source),json(v),hash(v));
      if(tx.proof(qualify)!==open)throw new Error('received renewal decision closure changed after owner');
      const changed=db.prepare('UPDATE actual_received_umpire_renewal_heads SET stage=2,owner=?,source_id=?,renewal_decision_source_id=? WHERE renewal_enrollment_source_id=? AND stage=1 AND owner=? AND source_id=?')
        .run(table,id,id,e.source.sourceId,enrollmentTable,e.source.sourceId);if(changed.changes!==1)throw new Error('received renewal decision head CAS failed');
      if(tx.proof(qualify)!==open)throw new Error('received renewal decision closure changed after head');
      appendRenewalJournal(db,e,table,id);if(tx.proof(qualify)!==open)throw new Error('received renewal decision closure changed after journal');
      const saved=tx.proof(()=>own.read(id));if(!saved||json(saved)!==json(v))throw new Error('received renewal decision changed during write');durable=rows();return saved;
    },()=>{
      if(json(rows())!==json(durable))throw new Error('received renewal decision committed rows differ');
      if(json(accepted(id))!==json(source))throw new Error('received renewal decision committed callback Source changed');
      const d=own.withOriginal(id,derived=>{if(json(derived.value)!==json(proposal.value)||json(derived.original.value)!==json(e))throw new Error('received renewal decision committed original differs');return derived;});
      if(!d)throw new Error('received renewal decision committed owner missing');originalOwner.qualifyCurrent(d.original);
    });
  },close:tx.close});
};
