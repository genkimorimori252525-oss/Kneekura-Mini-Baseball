import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { receivedId } from './ActualReceivedUmpireDefender';
import { receivedContinuationInput,type ReceivedContinuationSource } from './ActualReceivedUmpireContinuation';
import { receivedContinuationTable as table } from './ActualReceivedUmpireContinuationSchema';
import { receivedContinuationAdmission,receivedContinuationRows } from './ActualReceivedUmpireContinuationAdmission';
import { assertReceivedContinuationCurrentKnownWork } from './ActualReceivedUmpireContinuationExecution';
import { battedWorldFieldExecutionEvidenceFromSqlite,writeReceivedContinuationPhysicalRows,type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import { receivedRenewalEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireRenewalEvidence';
import { receivedUnionReferenceClaims } from './ActualReceivedUmpireDefenderClaims';
import { renewalJournal } from './ActualReceivedUmpireRenewalJournal';
import { openRenewalTransaction,withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
import { ownedScheduledMotionArchiveEncoding as encoding } from './OwnedScheduledMotionArchive';
import { actorJson as json,actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const X='batted_world_field_executions';
type Grant={value:DurableBattedWorldFieldExecution;stage:number;verify(stage:number):void};
const grants=new WeakMap<DatabaseSync,Grant>();
export const assertReceivedContinuationPhysicalWrite=(db:DatabaseSync,value:DurableBattedWorldFieldExecution,stage:number)=>{
  const grant=grants.get(db);
  if(!grant||grant.value!==value||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==0
    ||stage!==grant.stage&&stage!==grant.stage+1||stage<0||stage>3)throw new Error('received continuation private physical grant missing or stage differs');
  grant.verify(stage);grant.stage=stage;
};
export const actualReceivedUmpireContinuationEvidenceFromSqlite=(db:DatabaseSync)=>{
  const physical=battedWorldFieldExecutionEvidenceFromSqlite(db);
  const read=(id:string):DurableBattedWorldFieldExecution|null=>withRenewalReadProof(db,()=>{
    if(!receivedId(id))throw new Error('invalid received continuation Source identity');
    const rows=receivedContinuationRows(db,id);
    if(!rows.length){if(receivedUnionReferenceClaims(db,[{owner:X,sourceId:id}]).length)throw new Error('received continuation orphan physical or admission claim');return null;}
    if(rows.length!==1||rows[0].source_id!==id)throw new Error('received continuation admission identity differs');
    const row=receivedContinuationAdmission(db,String(rows[0].renewal_enrollment_source_id)),value=physical.read(id);
    if(!row||row.source_id!==id||!value||value.execution.kind!=='received_renewal_continuation_v1')throw new Error('received continuation physical owner differs');
    return value;
  });
  return {read,current:(value:DurableBattedWorldFieldExecution)=>{physical.current(value);assertReceivedContinuationCurrentKnownWork(db,value);}};
};
export const openSqliteActualReceivedUmpireContinuationStore=(path:string,authority?:Readonly<{readAcceptedContinuation(id:string):ReceivedContinuationSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedContinuation!=='function')throw new Error('invalid received continuation authority');
  const tx=openRenewalTransaction(path),db=tx.db,own=actualReceivedUmpireContinuationEvidenceFromSqlite(db),physical=battedWorldFieldExecutionEvidenceFromSqlite(db);
  const enrollments=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedContinuation(id)??null;return raw===null?null:receivedContinuationInput(raw,id);};
  const noContinuation=(enrollmentId:string)=>{
    const claims=receivedUnionReferenceClaims(db,[{owner:'actual_received_umpire_renewal_enrollments',sourceId:enrollmentId}]);
    if(claims.some(c=>c.owner===table||c.owner===X&&db.prepare("SELECT 1 FROM json_tree(?) WHERE key='kind' AND type='text' AND atom='received_renewal_continuation_v1' LIMIT 1").get(String(c.row.source_json))))throw new Error('received continuation already has an admission or orphan claim');
  };
  const proposal=(source:ReceivedContinuationSource)=>{
    const result=enrollments.withOriginal(source.action.renewalEnrollmentSourceId,original=>{
      const e=original.value,j=renewalJournal(db,e);
      if(j.length!==4||j[3].source_id!==source.action.renewalAdoptionSourceId||e.anchor.baseField.sourceId!==source.baseFieldSourceId)throw new Error('received continuation requires the adopted renewal head');
      noContinuation(e.source.sourceId);originalOwner.qualifyNonPhysicalCurrent(original);
      const value=physical.derive(source);assertReceivedContinuationCurrentKnownWork(db,value);
      return {enrollment:e,value};
    });
    if(!result)throw new Error('received continuation enrollment missing');return result;
  };
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableBattedWorldFieldExecution{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received continuation Source frozen differently');return tx.read(()=>{const saved=own.read(id);if(!saved||encoding(saved).json!==encoding(prior).json)throw new Error('received continuation retry changed');return saved;});}
    if(!source)throw new Error('accepted received continuation Source missing');
    const p=tx.read(()=>proposal(source)),e=p.enrollment,encoded=encoding(p.value);let conserved:string|undefined;
    const expectedPhysical={source_id:id,physical_pitch_source_id:e.physicalPitchSourceId,base_field_source_id:source.baseFieldSourceId,previous_source_id:source.previousExecutionSourceId,
      revision:p.value.revision,game_id:e.gameId,source_json:json(source),source_hash:hash(source),snapshot_json:encoded.json,snapshot_hash:encoded.hash};
    const admission={source_id:id,source_version:source.sourceVersion,game_id:e.gameId,play_id:e.playId,physical_pitch_source_id:e.physicalPitchSourceId,player_id:e.playerId,
      renewal_enrollment_source_id:e.source.sourceId,adoption_source_id:source.action.renewalAdoptionSourceId,revision:p.value.revision,source_hash:hash(source),snapshot_hash:encoded.hash};
    const expectedAdmission={...admission,receipt_hash:hash(admission)};
    const beforeHead=tx.read(()=>db.prepare('SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(e.physicalPitchSourceId));
    const storage=()=>{
      const digest=createHash('sha256'),schema=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all();digest.update(JSON.stringify(schema));
      for(const s of schema.filter(s=>s.type==='table')){const name=String(s.name),rows=db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().filter(r=>
        !((name===table||name===X)&&r.source_id===id)&&!(name==='batted_world_field_execution_heads'&&r.physical_pitch_source_id===e.physicalPitchSourceId));
        digest.update(name);for(const row of rows.map(r=>JSON.stringify(r)).sort())digest.update(row);
      }return digest.digest('hex');
    };
    const verify=(stage:number)=>{
      if(json(accepted(id))!==json(source))throw new Error('received continuation callback Source changed');
      if(storage()!==conserved)throw new Error('received continuation original storage changed');
      const row=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(id);
      if(stage===0?row!==undefined:json(row)!==json(expectedPhysical))throw new Error('received continuation staged physical row differs');
      const head=db.prepare('SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(e.physicalPitchSourceId);
      if(json(head)!==json(stage<2?beforeHead:{...beforeHead,source_id:id,revision:p.value.revision}))throw new Error('received continuation staged physical head differs');
      const entry=db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id);
      if(stage<3?entry!==undefined:json(entry)!==json(expectedAdmission))throw new Error('received continuation staged admission differs');
      if(stage===3&&receivedContinuationAdmission(db,e.source.sourceId)?.source_id!==id)throw new Error('received continuation admitted header differs');
    };
    const durable=()=>{
      verify(3);const saved=own.read(id);if(!saved||encoding(saved).json!==encoded.json)throw new Error('received continuation durable original differs');own.current(saved);
      const current=enrollments.withOriginal(e.source.sourceId,original=>{if(json(original.value)!==json(e))throw new Error('received continuation original enrollment changed');originalOwner.qualifyNonPhysicalCurrent(original);return true;});
      if(!current)throw new Error('received continuation original enrollment missing');return saved;
    };
    return tx.write({bootstrap:false,changes:3,continuationBootstrap:true},()=>{
      const count=tx.proof(()=>{if(json(accepted(id))!==json(source))throw new Error('received continuation callback Source changed');const fresh=proposal(source);
        if(encoding(fresh.value).json!==encoded.json||json(fresh.enrollment)!==json(e))throw new Error('received continuation proposal changed');conserved=storage();verify(0);return Number(db.prepare('SELECT total_changes() AS n').get()!.n);});
      if(grants.has(db))throw new Error('received continuation grant already active');
      grants.set(db,{value:p.value,stage:0,verify:stage=>tx.proof(()=>{verify(stage);if(db.prepare('SELECT total_changes() AS n').get()!.n!==count+stage)throw new Error('received continuation staged write count differs');})});
      try{writeReceivedContinuationPhysicalRows(db,p.value);db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(expectedAdmission));assertReceivedContinuationPhysicalWrite(db,p.value,3);}
      finally{grants.delete(db);}
      return tx.proof(durable);
    },durable,()=>noContinuation(e.source.sourceId));
  },close:tx.close});
};
