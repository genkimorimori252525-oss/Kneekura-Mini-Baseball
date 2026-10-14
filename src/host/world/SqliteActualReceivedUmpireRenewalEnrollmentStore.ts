import type { DatabaseSync } from 'node:sqlite';
import { renewalEnrollmentInput,type RenewalEnrollmentSource } from './ActualReceivedUmpireRenewal';
import { receivedRenewalEnrollmentEvidenceFromSqlite,type DurableReceivedRenewalEnrollment } from './ActualReceivedUmpireRenewalEvidence';
import { receivedDefenderClaims,receivedUnionClaims } from './ActualReceivedUmpireDefenderClaims';
import { openRenewalTransaction,withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
import { renewalJournal,appendRenewalJournal,renewalSourceRow,renewalScope } from './ActualReceivedUmpireRenewalJournal';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table='actual_received_umpire_renewal_enrollments';
export const actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite=(db:DatabaseSync)=>{
  const original=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const readOriginal=(id:string):ReturnType<typeof original.derive>|null=>{
    const row=renewalSourceRow(db,table,id);if(!row)return null;
    const source=renewalEnrollmentInput(JSON.parse(String(row.source_json)),id),derived=original.derive(source),{value}=derived;
    if(row.source_version!==source.sourceVersion||Object.entries(renewalScope(value)).some(([k,v])=>row[k]!==v)
      ||row.source_json!==json(source)||row.source_hash!==hash(source)||row.snapshot_json!==json(value)||row.snapshot_hash!==hash(value))throw new Error('received renewal enrollment archive differs');
    renewalJournal(db,value);return derived;
  };
  const withOriginal=<T>(id:string,consume:(derived:ReturnType<typeof original.derive>)=>T):T|null=>withRenewalReadProof(db,()=>{
    const derived=readOriginal(id);return derived===null?null:consume(derived);
  });
  return Object.freeze({read:(id:string)=>withOriginal(id,original=>original.value),withOriginal});
};
export const openSqliteActualReceivedUmpireRenewalEnrollmentStore=(path:string,authority?:Readonly<{readAcceptedEnrollment(id:string):RenewalEnrollmentSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedEnrollment!=='function')throw new Error('invalid received renewal authority');
  const tx=openRenewalTransaction(path),db=tx.db,own=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db),original=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedEnrollment(id)??null;return raw===null?null:renewalEnrollmentInput(raw,id);};
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableReceivedRenewalEnrollment{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received renewal Source frozen differently');return tx.read(()=>{const saved=own.read(id);if(!saved||json(saved)!==json(prior))throw new Error('received renewal historical retry changed');return saved;});}
    if(!source)throw new Error('accepted received renewal Source missing');
    const noClaims=(e:DurableReceivedRenewalEnrollment)=>{if(json(receivedUnionClaims(db,e))!==json(receivedDefenderClaims(db,e)))throw new Error('received renewal enrollment has unexplained union claims');};
    const proposal=tx.read(()=>{const d=original.derive(source);original.qualifyCurrent(d);noClaims(d.value);return d.value;});let durable:unknown;
    const rows=()=>[db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id),db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=?').get(id),db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? ORDER BY sequence').all(id)];
    return tx.write({bootstrap:true,changes:3},()=>{
      const qualify=()=>{if(json(accepted(id))!==json(source))throw new Error('received renewal callback Source changed');const d=original.derive(source);if(json(d.value)!==json(proposal))throw new Error('received renewal original proposal proof changed');return original.qualifyCurrent(d);};
      const open=tx.proof(qualify);tx.proof(()=>noClaims(proposal));const e=proposal;
      db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(id,source.sourceVersion,e.gameId,e.playId,e.physicalPitchSourceId,e.playerId,e.runtimeSourceId,e.receivedEnrollmentSourceId,e.originProcessSourceId,e.receivedReplanSourceId,id,json(source),hash(source),json(e),hash(e));
      if(tx.proof(qualify)!==open)throw new Error('received renewal closure changed after enrollment');
      db.prepare('INSERT INTO actual_received_umpire_renewal_heads VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,e.gameId,e.playId,e.physicalPitchSourceId,e.playerId,e.runtimeSourceId,e.receivedEnrollmentSourceId,e.originProcessSourceId,e.receivedReplanSourceId,1,table,id,null,null,null,e.anchor.physicalPredecessor.sourceId,e.anchor.physicalPredecessor.revision);
      if(tx.proof(qualify)!==open)throw new Error('received renewal closure changed after head');
      appendRenewalJournal(db,e,table,id);
      if(tx.proof(qualify)!==open)throw new Error('received renewal closure changed after journal');
      const saved=tx.proof(()=>own.read(id));if(!saved||json(saved)!==json(e))throw new Error('received renewal enrollment changed during write');durable=rows();return saved;
    },()=>{
      if(json(rows())!==json(durable))throw new Error('received renewal committed rows differ');
      if(json(accepted(id))!==json(source))throw new Error('received renewal committed callback Source changed');
      const d=own.withOriginal(id,original=>{if(json(original.value)!==json(proposal))throw new Error('received renewal committed original differs');return original;});
      if(!d)throw new Error('received renewal committed owner missing');original.qualifyCurrent(d);
    },()=>noClaims(proposal));
  },close:tx.close});
};
