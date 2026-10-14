import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { renewalAdoptionInput,type RenewalAdoptionExecutionSource } from './ActualReceivedUmpireRenewal';
import { battedWorldFieldExecutionEvidenceFromSqlite,writeReceivedRenewalPhysicalRows,type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { actualReceivedUmpireRenewalMotorEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalMotorStore';
import { receivedRenewalEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireRenewalEvidence';
import { openRenewalTransaction,withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
import { renewalJournal,appendRenewalJournal,renewalSourceRow } from './ActualReceivedUmpireRenewalJournal';
import { ownedScheduledMotionArchiveEncoding as encoding } from './OwnedScheduledMotionArchive';
import { actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const table='batted_world_field_executions',motorTable='actual_received_umpire_renewal_motors';
type Grant={value:DurableBattedWorldFieldExecution;stage:number;verify(stage:number):void};
const grants=new WeakMap<DatabaseSync,Grant>();
/** Internal check only. No token constructor or caller-supplied permission is
 * exported. The four-write owner alone installs this lexical same-DB grant. */
export const assertReceivedRenewalPhysicalWrite=(db:DatabaseSync,value:DurableBattedWorldFieldExecution,stage:number)=>{
  const grant=grants.get(db);
  if(!grant||grant.value!==value||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==0
    ||stage!==grant.stage&&stage!==grant.stage+1||stage<0||stage>4)throw new Error('received renewal private physical grant missing or stage differs');
  grant.verify(stage);grant.stage=stage;
};

export const actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite=(db:DatabaseSync)=>{
  const physical=battedWorldFieldExecutionEvidenceFromSqlite(db);
  return {read:(id:string)=>withRenewalReadProof(db,()=>{
    const row=renewalSourceRow(db,table,id);if(!row)return null;
    const source=renewalAdoptionInput(JSON.parse(String(row.source_json)),id),value=physical.read(id);
    if(!value||value.execution.kind!=='received_renewal_adoption_v1'||json(value.source)!==json(source))throw new Error('received renewal adoption physical owner differs');
    return value;
  }),current:(value:DurableBattedWorldFieldExecution)=>physical.current(value)};
};

export const openSqliteActualReceivedUmpireRenewalAdoptionStore=(path:string,authority?:Readonly<{readAcceptedAdoption(id:string):RenewalAdoptionExecutionSource|null}>)=>{
  if(authority!==undefined&&typeof authority.readAcceptedAdoption!=='function')throw new Error('invalid received renewal adoption authority');
  const tx=openRenewalTransaction(path),db=tx.db,own=actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite(db),physical=battedWorldFieldExecutionEvidenceFromSqlite(db);
  const motors=actualReceivedUmpireRenewalMotorEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedAdoption(id)??null;return raw===null?null:renewalAdoptionInput(raw,id);};
  const proposal=(source:RenewalAdoptionExecutionSource)=>{
    const result=motors.withOriginal(source.action.renewalMotorSourceId,derived=>{
      const e=derived.original.value,journal=renewalJournal(db,e);
      if(e.source.sourceId!==source.action.renewalEnrollmentSourceId||journal.length!==3||journal[2].source_id!==source.action.renewalMotorSourceId)throw new Error('received renewal adoption pending stage differs');
      originalOwner.qualifyCurrent(derived.original);return derived;
    });
    if(!result)throw new Error('received renewal adoption motor missing');
    const value=physical.derive(source);return {value,enrollment:result.original.value};
  };
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),accept(id:string):DurableBattedWorldFieldExecution{
    const {prior,source}=tx.read(()=>({prior:own.read(id),source:accepted(id)}));
    if(prior){if(source&&json(source)!==json(prior.source))throw new Error('received renewal adoption Source frozen differently');return tx.read(()=>{const value=own.read(id);if(!value||encoding(value).json!==encoding(prior).json)throw new Error('received renewal adoption retry changed');return value;});}
    if(!source)throw new Error('accepted received renewal adoption Source missing');
    const p=tx.read(()=>proposal(source)),e=p.enrollment,encoded=encoding(p.value);let conserved:string|undefined;
    const ownerRow={source_id:id,physical_pitch_source_id:e.physicalPitchSourceId,base_field_source_id:source.baseFieldSourceId,previous_source_id:source.previousExecutionSourceId,
      revision:p.value.revision,game_id:e.gameId,source_json:json(source),source_hash:hash(source),snapshot_json:encoded.json,snapshot_hash:encoded.hash};
    const beforePhysical=tx.read(()=>db.prepare('SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(e.physicalPitchSourceId));
    const beforeRenewal=tx.read(()=>db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=?').get(e.source.sourceId));
    // The fixed four-row grant is the sole exception to this storage digest.
    // Each original row/schema and every other receiver/head remains conserved.
    const storage=()=>{
      const digest=createHash('sha256'),schema=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all();digest.update(JSON.stringify(schema));
      for(const s of schema.filter(s=>s.type==='table')){
        const name=String(s.name),rows=db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'"').all().filter(r=>
          !(name===table&&r.source_id===id)&&!(name==='batted_world_field_execution_heads'&&r.physical_pitch_source_id===e.physicalPitchSourceId)
          &&!(name==='actual_received_umpire_renewal_heads'&&r.renewal_enrollment_source_id===e.source.sourceId)
          &&!(name==='actual_received_umpire_renewal_admissions'&&r.renewal_enrollment_source_id===e.source.sourceId&&r.sequence===4));
        digest.update(name);for(const raw of rows.map(r=>JSON.stringify(r)).sort())digest.update(raw);
      }return digest.digest('hex');
    };
    const verify=(stage:number)=>{
      if(json(accepted(id))!==json(source))throw new Error('received renewal adoption callback Source changed');
      if(storage()!==conserved)throw new Error('received renewal adoption original storage changed');
      const row=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(id);
      if(stage===0?row!==undefined:json(row)!==json(ownerRow))throw new Error('received renewal staged physical row differs');
      const ph=db.prepare('SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(e.physicalPitchSourceId);
      if(json(ph)!==json(stage<2?beforePhysical:{...beforePhysical,source_id:id,revision:p.value.revision}))throw new Error('received renewal staged physical head differs');
      const rh=db.prepare('SELECT * FROM actual_received_umpire_renewal_heads WHERE renewal_enrollment_source_id=?').get(e.source.sourceId);
      if(json(rh)!==json(stage<3?beforeRenewal:{...beforeRenewal,stage:4,owner:table,source_id:id,adoption_source_id:id}))throw new Error('received renewal staged journal head differs');
      const admissions=db.prepare('SELECT * FROM actual_received_umpire_renewal_admissions WHERE renewal_enrollment_source_id=? ORDER BY sequence').all(e.source.sourceId);
      if(admissions.length!==(stage<4?3:4))throw new Error('received renewal staged journal length differs');
      if(stage===4&&renewalJournal(db,e)[3].source_id!==id)throw new Error('received renewal staged physical admission differs');
    };
    return tx.write({bootstrap:false,changes:4},()=>{
      const baseline=tx.proof(()=>{if(json(accepted(id))!==json(source))throw new Error('received renewal adoption callback Source changed');const fresh=proposal(source);
        if(encoding(fresh.value).json!==encoded.json||json(fresh.enrollment)!==json(e))throw new Error('received renewal adoption proposal changed');conserved=storage();verify(0);return Number(db.prepare('SELECT total_changes() AS n').get()!.n);});
      if(grants.has(db))throw new Error('received renewal physical grant already active');
      grants.set(db,{value:p.value,stage:0,verify:stage=>tx.proof(()=>{verify(stage);if(db.prepare('SELECT total_changes() AS n').get()!.n!==baseline+stage)throw new Error('received renewal staged write count differs');})});
      try{
        writeReceivedRenewalPhysicalRows(db,p.value);
        const change=db.prepare('UPDATE actual_received_umpire_renewal_heads SET stage=4,owner=?,source_id=?,adoption_source_id=? WHERE renewal_enrollment_source_id=? AND stage=3 AND owner=? AND source_id=? AND renewal_motor_source_id=?')
          .run(table,id,id,e.source.sourceId,motorTable,source.action.renewalMotorSourceId,source.action.renewalMotorSourceId);
        if(change.changes!==1)throw new Error('received renewal adoption head CAS failed');assertReceivedRenewalPhysicalWrite(db,p.value,3);
        appendRenewalJournal(db,e,table,id);assertReceivedRenewalPhysicalWrite(db,p.value,4);
      }finally{grants.delete(db);}
      const saved=tx.proof(()=>{const value=own.read(id);if(!value||encoding(value).json!==encoded.json)throw new Error('received renewal adoption physical readback differs');own.current(value);verify(4);return value;});
      return saved;
    },()=>{verify(4);const value=own.read(id);if(!value||encoding(value).json!==encoded.json)throw new Error('received renewal adoption committed original differs');own.current(value);});
  },close:tx.close});
};
