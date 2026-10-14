import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {receivedId} from './ActualReceivedUmpireDefender';
import {receivedHandoffInput,receivedHandoffSuccessorInputs,type ReceivedHandoffSource} from './ActualReceivedUmpireHandoff';
import {receivedHandoffSchema,receivedHandoffTable as table} from './ActualReceivedUmpireHandoffSchema';
import {receivedHandoffHeader,type DurableReceivedHandoff} from './ActualReceivedUmpireHandoffHeader';
import {receivedUnionReferenceClaims} from './ActualReceivedUmpireDefenderClaims';
import {actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite} from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import {receivedRenewalEnrollmentEvidenceFromSqlite} from './ActualReceivedUmpireRenewalEvidence';
import {actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite} from './SqliteActualReceivedUmpireRenewalAdoptionStore';
import {actualReceivedUmpireContinuationEvidenceFromSqlite} from './SqliteActualReceivedUmpireContinuationStore';
import {actualCommunicationEvidenceFromSqlite} from './SqliteActualCommunicationStore';
import type {AcceptedActualCallCommunication,DurableActualCallCommunication} from './ActualCallCommunication';
import {battedWorldFieldExecutionEvidenceFromSqlite,writeReceivedHandoffPhysicalRows,type AcceptedBattedWorldFieldExecution,type DurableBattedWorldFieldExecution} from './SqliteBattedWorldFieldExecutionStore';
import {renewalJournal} from './ActualReceivedUmpireRenewalJournal';
import {openRenewalTransaction,withRenewalReadProof} from './ActualReceivedUmpireRenewalTransaction';
import {ownedScheduledMotionArchiveEncoding as encoding} from './OwnedScheduledMotionArchive';
import {deriveQuantizerClosedGenerationBoundary} from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import {actorHash as hash,actorJson as json,actorFreeze as freeze} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
const X='batted_world_field_executions',C='actual_call_communications';
type Grant={physical:DurableBattedWorldFieldExecution;row:Record<string,unknown>;stage:number;verify(stage:number):void};
const grants=new WeakMap<DatabaseSync,Grant>();
export const assertReceivedHandoffPhysicalWrite=(db:DatabaseSync,value:DurableBattedWorldFieldExecution,stage:number)=>{
  const g=grants.get(db);if(!g||g.physical!==value||!db.isTransaction||db.prepare('PRAGMA query_only').get()!.query_only!==0
    ||stage!==g.stage&&stage!==g.stage+1||stage<0||stage>5)throw new Error('received handoff private grant missing or stage differs');g.verify(stage);g.stage=stage;
};
/** Metadata descent may see only this owner's exact staged physical row while
 * its communication is being derived. No token can be supplied by a caller. */
export const isStagedReceivedHandoffPhysical=(db:DatabaseSync,row:Readonly<Record<string,unknown>>)=>{
  const g=grants.get(db);if(!g||g.stage<2||g.stage>4)return false;
  if(json(row)!==json(g.row)||!db.isTransaction)throw new Error('received handoff staged physical metadata differs');g.verify(g.stage);return true;
};
const physicalRef=(v:DurableBattedWorldFieldExecution)=>({sourceId:v.source.sourceId,sourceHash:hash(v.source),snapshotHash:encoding(v).hash,revision:v.revision});
const predecessor=(db:DatabaseSync,id:string)=>{
  const row=db.prepare('SELECT source_json FROM batted_world_field_executions WHERE source_id=?').get(id);if(!row)throw new Error('received handoff predecessor missing');
  const kind=JSON.parse(String(row.source_json)).action?.kind;
  const value=kind==='received_renewal_adoption_v1'?actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite(db).read(id):kind==='received_renewal_continuation_v1'?actualReceivedUmpireContinuationEvidenceFromSqlite(db).read(id):null;
  if(!value)throw new Error('received handoff requires an authenticated adoption or continuation');return value;
};
const assertSeal=(prior:DurableBattedWorldFieldExecution,value:DurableBattedWorldFieldExecution)=>{
  const x=value.execution,s=value.source.action,m=prior.execution.field.motion.world.moment,tps=value.baseField.response.touch.worldContact.flight.source.execution.ballFlightParameters.ticksPerSecond;
  if(!prior.execution.field.motion.cursor||x.kind!=='owned_motion_v2'||s.kind!=='owned_motion_v2'||s.checkpoint.kind!=='retained_quantizer_bucket_v1'
    ||s.checkpoint.throughTick!==m.ball.tick||x.composition.mode!=='retained'||x.operation!==null||x.adoption.status!=='checkpoint_reached'||x.field.motion.world.kind!=='moving')throw new Error('received handoff exact retained seal remains pending');
  const boundary=deriveQuantizerClosedGenerationBoundary({originTick:m.originTick,throughTick:m.ball.tick,ticksPerSecond:tps});
  if(json(x.composition.quantizerBoundary)!==json(boundary)||x.field.motion.world.moment.elapsedSeconds!==boundary.lastIncludedElapsedSeconds
    ||x.field.motion.world.moment.elapsedSeconds<=m.elapsedSeconds||json(x.field.motion.actors)!==json(prior.execution.field.motion.actors))throw new Error('received handoff quantizer boundary or retained curves differ');
};
const manifest=(source:ReceivedHandoffSource,e:import('./ActualReceivedUmpireRenewalEvidence').DurableReceivedRenewalEnrollment,
  prior:DurableBattedWorldFieldExecution,physical:DurableBattedWorldFieldExecution,communication:DurableActualCallCommunication):DurableReceivedHandoff=>{
  if(physical.source.previousExecutionSourceId!==prior.source.sourceId||physical.source.baseFieldSourceId!==e.anchor.baseField.sourceId
    ||(prior.execution.kind==='received_renewal_adoption_v1'?prior.execution.adoption.renewalEnrollmentSourceId:prior.execution.kind==='received_renewal_continuation_v1'?prior.execution.renewalEnrollmentSourceId:null)!==e.source.sourceId
    ||communication.originCommunicationSourceId!==e.cause.originCommunicationSourceId||communication.source.callSourceId!==e.cause.callSourceId||communication.physicalPitchSourceId!==e.physicalPitchSourceId
    ||communication.gameId!==e.gameId||communication.playId!==e.playId||communication.source.currentExecutionSourceId!==physical.source.sourceId)throw new Error('received handoff cause participant or output scope differs');
  assertSeal(prior,physical);const at=physical.execution.field.motion.world.moment;
  if(json(communication.evaluatedThrough)!==json({originTick:at.originTick,elapsedSeconds:at.elapsedSeconds,tick:at.ball.tick}))throw new Error('received handoff communication does not own the final actual cut');
  return freeze({source,gameId:e.gameId,playId:e.playId,physicalPitchSourceId:e.physicalPitchSourceId,playerId:e.playerId,runtimeSourceId:e.runtimeSourceId,
    receivedEnrollmentSourceId:e.receivedEnrollmentSourceId,renewalEnrollmentSourceId:e.source.sourceId,cause:e.cause,enrollmentHash:hash(e),predecessor:physicalRef(prior),physical:physicalRef(physical),
    communication:{sourceId:communication.source.sourceId,sourceHash:hash(communication.source),snapshotHash:hash(communication),revision:communication.revision},
    legacyAdmissionPrefix:e.anchor.legacyAdmissionPrefix,transfer:'retained_quantizer_and_normal_communication_v1'});
};
export const actualReceivedUmpireHandoffEvidenceFromSqlite=(db:DatabaseSync)=>{
  const physical=battedWorldFieldExecutionEvidenceFromSqlite(db),communications=actualCommunicationEvidenceFromSqlite(db);
  const withOriginal=<T>(enrollmentId:string,consume:(v:Readonly<{value:DurableReceivedHandoff;physical:DurableBattedWorldFieldExecution;communication:DurableActualCallCommunication}>)=>T):T|null=>withRenewalReadProof(db,()=>{
    const header=receivedHandoffHeader(db,enrollmentId);if(!header)return null;
    const result=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db).withOriginal(enrollmentId,original=>{
      const e=original.value,prior=predecessor(db,header.source.predecessorExecutionSourceId),next=physical.read(header.source.executionSourceId),communication=communications.read(header.source.communicationSourceId);
      if(!next||!communication)throw new Error('received handoff admitted output missing');
      receivedHandoffSuccessorInputs(header.source,next.source,communication.source);
      const value=manifest(header.source,e,prior,next,communication);if(json(value)!==json(header.value))throw new Error('received handoff original archive differs');return consume({value,physical:next,communication});
    });if(result===null)throw new Error('received handoff renewal enrollment missing');return result;
  });
  const read=(id:string)=>withRenewalReadProof(db,()=>{
    if(!receivedId(id))throw new Error('received handoff identity invalid');
    const rows=receivedHandoffSchema(db)==='pristine'?[]:db.prepare(`SELECT * FROM ${table} WHERE source_id=? OR (json_valid(source_json) AND json_extract(source_json,'$.sourceId')=?)`).all(id,id);
    if(!rows.length){if(receivedUnionReferenceClaims(db,[{owner:table,sourceId:id}]).length)throw new Error('received handoff orphan claim');return null;}
    if(rows.length!==1||rows[0].source_id!==id)throw new Error('received handoff identity differs');return withOriginal(String(rows[0].renewal_enrollment_source_id),v=>v.value);
  });
  return {read,withOriginal,current:(v:Parameters<Parameters<typeof withOriginal>[1]>[0])=>{physical.currentAdmission(v.physical);communications.current(v.communication);}};
};
export const openSqliteActualReceivedUmpireHandoffStore=(path:string,authority?:Readonly<{readAcceptedHandoff(id:string):ReceivedHandoffSource|null;
  readAcceptedExecution(id:string):AcceptedBattedWorldFieldExecution|null;readAcceptedCommunication(id:string):AcceptedActualCallCommunication|null}>)=>{
  if(authority&&[authority.readAcceptedHandoff,authority.readAcceptedExecution,authority.readAcceptedCommunication].some(f=>typeof f!=='function'))throw new Error('received handoff authority invalid');
  const tx=openRenewalTransaction(path),db=tx.db,own=actualReceivedUmpireHandoffEvidenceFromSqlite(db),physical=battedWorldFieldExecutionEvidenceFromSqlite(db),comm=actualCommunicationEvidenceFromSqlite(db);
  const enrollments=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db),originalOwner=receivedRenewalEnrollmentEvidenceFromSqlite(db);
  const accepted=(id:string)=>{const raw=authority?.readAcceptedHandoff(id)??null;if(!raw)return null;const source=receivedHandoffInput(raw,id),x=authority!.readAcceptedExecution(source.executionSourceId),c=authority!.readAcceptedCommunication(source.communicationSourceId);
    if(!x||!c)throw new Error('received handoff accepted successor Sources missing');return {source,...receivedHandoffSuccessorInputs(source,x,c)};};
  return Object.freeze({read:(id:string)=>tx.read(()=>own.read(id)),readPhysical:(sourceId:string)=>tx.read(()=>{
    if(!receivedId(sourceId))throw new Error('received handoff physical identity invalid');
    const rows=receivedHandoffSchema(db)==='installed'?db.prepare(`SELECT renewal_enrollment_source_id FROM ${table} WHERE execution_source_id=?`).all(sourceId):[];
    if(rows.length!==1)throw new Error('received handoff physical admission missing');return own.withOriginal(String(rows[0].renewal_enrollment_source_id),v=>{if(v.physical.source.sourceId!==sourceId)throw new Error('received handoff physical identity differs');return v.physical;});
  }),accept(id:string):DurableReceivedHandoff{
    const {saved,a}=tx.read(()=>({saved:own.read(id),a:accepted(id)}));
    if(saved){if(a&&json(a.source)!==json(saved.source))throw new Error('received handoff Source frozen differently');if(a&&(hash(a.execution)!==saved.physical.sourceHash||hash(a.communication)!==saved.communication.sourceHash))throw new Error('received handoff successor Source frozen differently');return tx.read(()=>{const reread=own.read(id);if(!reread||json(reread)!==json(saved))throw new Error('received handoff retry changed');return reread;});}
    if(!a)throw new Error('accepted received handoff Source missing');
    const none=()=>{if(receivedUnionReferenceClaims(db,[{owner:'actual_received_umpire_renewal_enrollments',sourceId:a.source.renewalEnrollmentSourceId}]).some(c=>c.owner===table))throw new Error('received handoff already claimed');};
    const proposal=()=>{none();const result=enrollments.withOriginal(a.source.renewalEnrollmentSourceId,original=>{
      const e=original.value,j=renewalJournal(db,e);if(j.length!==4)throw new Error('received handoff controller adoption pending');
      const prior=predecessor(db,a.source.predecessorExecutionSourceId);physical.current(prior);originalOwner.qualifyNonPhysicalCurrent(original);
      const next=physical.derive(a.execution);assertSeal(prior,next);
      const previousCommunication=comm.scope(a.communication.callSourceId).at(-1);
      if(!previousCommunication||previousCommunication.source.sourceId!==a.communication.previousCommunicationSourceId||previousCommunication.originCommunicationSourceId!==e.cause.originCommunicationSourceId
        ||a.communication.callSourceId!==e.cause.callSourceId||comm.read(a.communication.sourceId))throw new Error('received handoff communication predecessor or historical cause differs');
      return {e,prior,next};});if(!result)throw new Error('received handoff enrollment missing');return result;};
    const p=tx.read(proposal),encoded=encoding(p.next),e=p.e;
    const ph=tx.read(()=>db.prepare('SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(e.physicalPitchSourceId));
    const ch=tx.read(()=>db.prepare('SELECT * FROM actual_call_communication_heads WHERE call_source_id=?').get(a.communication.callSourceId));
    const xrow={source_id:a.execution.sourceId,physical_pitch_source_id:e.physicalPitchSourceId,base_field_source_id:a.execution.baseFieldSourceId,previous_source_id:a.execution.previousExecutionSourceId,
      revision:p.next.revision,game_id:e.gameId,source_json:json(a.execution),source_hash:hash(a.execution),snapshot_json:encoded.json,snapshot_hash:encoded.hash};
    let crow:Record<string,unknown>|undefined,hrow:Record<string,unknown>|undefined,output:DurableReceivedHandoff|undefined,conserved:string|undefined;
    const storage=()=>{const h=createHash('sha256'),schema=db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all();h.update(JSON.stringify(schema));for(const s of schema.filter(s=>s.type==='table')){const n=String(s.name),rows=db.prepare('SELECT * FROM "'+n.replaceAll('"','""')+'"').all().filter(r=>
      !(n===table&&r.source_id===id)&&!(n===X&&r.source_id===a.execution.sourceId)&&!(n===C&&r.source_id===a.communication.sourceId)
      &&!(n==='batted_world_field_execution_heads'&&r.physical_pitch_source_id===e.physicalPitchSourceId)&&!(n==='actual_call_communication_heads'&&r.call_source_id===a.communication.callSourceId));h.update(n);for(const row of rows.map(r=>JSON.stringify(r)).sort())h.update(row);}return h.digest('hex');};
    const verify=(stage:number)=>{if(json(accepted(id))!==json(a))throw new Error('received handoff callback Sources changed');if(storage()!==conserved)throw new Error('received handoff original storage changed');
      const x=db.prepare('SELECT * FROM batted_world_field_executions WHERE source_id=?').get(a.execution.sourceId),c=db.prepare('SELECT * FROM actual_call_communications WHERE source_id=?').get(a.communication.sourceId),h=db.prepare(`SELECT * FROM ${table} WHERE source_id=?`).get(id);
      if(stage<1?x!==undefined:json(x)!==json(xrow))throw new Error('received handoff staged physical differs');if(stage<3?c!==undefined:json(c)!==json(crow))throw new Error('received handoff staged communication differs');if(stage<5?h!==undefined:json(h)!==json(hrow))throw new Error('received handoff staged receipt differs');
      if(json(db.prepare('SELECT * FROM batted_world_field_execution_heads WHERE physical_pitch_source_id=?').get(e.physicalPitchSourceId))!==json(stage<2?ph:{...ph,source_id:a.execution.sourceId,revision:p.next.revision})
        ||json(db.prepare('SELECT * FROM actual_call_communication_heads WHERE call_source_id=?').get(a.communication.callSourceId))!==json(stage<4?ch:{...ch,source_id:a.communication.sourceId,revision:Number(ch!.revision)+1}))throw new Error('received handoff staged heads differ');};
    const durable=()=>{verify(5);const result=own.withOriginal(e.source.sourceId,v=>{if(json(v.value)!==json(output))throw new Error('received handoff durable original differs');own.current(v);return v.value;});if(!result)throw new Error('received handoff durable receipt missing');return result;};
    return tx.write({bootstrap:false,changes:5,handoffBootstrap:true},()=>{
      const count=tx.proof(()=>{if(json(accepted(id))!==json(a))throw new Error('received handoff callback Sources changed');const fresh=proposal();if(json(fresh.e)!==json(e)||encoding(fresh.next).json!==encoded.json)throw new Error('received handoff proposal changed');conserved=storage();verify(0);return Number(db.prepare('SELECT total_changes() AS n').get()!.n);});
      grants.set(db,{physical:p.next,row:xrow,stage:0,verify:stage=>tx.proof(()=>{verify(stage);if(db.prepare('SELECT total_changes() AS n').get()!.n!==count+stage)throw new Error('received handoff write count differs');})});
      try{
        writeReceivedHandoffPhysicalRows(db,p.next);
        const communication=tx.proof(()=>{const c=comm.derive(a.communication);comm.currentBefore(c);return c;});
        output=manifest(a.source,e,p.prior,p.next,communication);
        crow={source_id:a.communication.sourceId,source_version:a.communication.sourceVersion,game_id:communication.gameId,play_id:communication.playId,physical_pitch_source_id:communication.physicalPitchSourceId,
          call_source_id:a.communication.callSourceId,model_source_id:a.communication.modelSourceId,current_execution_source_id:a.communication.currentExecutionSourceId,previous_source_id:a.communication.previousCommunicationSourceId,
          revision:communication.revision,source_json:json(a.communication),source_hash:hash(a.communication),snapshot_json:json(communication),snapshot_hash:hash(communication)};
        hrow={source_id:id,source_version:a.source.sourceVersion,game_id:e.gameId,play_id:e.playId,physical_pitch_source_id:e.physicalPitchSourceId,player_id:e.playerId,runtime_source_id:e.runtimeSourceId,renewal_enrollment_source_id:e.source.sourceId,
          previous_source_id:p.prior.source.sourceId,execution_source_id:p.next.source.sourceId,communication_source_id:communication.source.sourceId,source_json:json(a.source),source_hash:hash(a.source),snapshot_json:json(output),snapshot_hash:hash(output)};
        db.prepare('INSERT INTO actual_call_communications VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(crow) as never[]);assertReceivedHandoffPhysicalWrite(db,p.next,3);
        const changed=db.prepare('UPDATE actual_call_communication_heads SET source_id=?,revision=? WHERE call_source_id=? AND source_id=? AND revision=?').run(a.communication.sourceId,communication.revision,a.communication.callSourceId,a.communication.previousCommunicationSourceId,communication.revision-1);
        if(changed.changes!==1)throw new Error('received handoff communication head CAS failed');assertReceivedHandoffPhysicalWrite(db,p.next,4);
        db.prepare(`INSERT INTO ${table} VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...Object.values(hrow) as never[]);assertReceivedHandoffPhysicalWrite(db,p.next,5);
      }finally{grants.delete(db);}
      return tx.proof(durable);
    },durable,none);
  },close:tx.close});
};
