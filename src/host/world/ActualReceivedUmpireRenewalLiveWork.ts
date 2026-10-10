import { receivedHandoffHeader } from './ActualReceivedUmpireHandoffHeader';
import { receivedHandoffTable } from './ActualReceivedUmpireHandoffSchema';
import { actualReceivedUmpireHandoffEvidenceFromSqlite } from './SqliteActualReceivedUmpireHandoffStore';
import { receivedContinuationAdmission } from './ActualReceivedUmpireContinuationAdmission';
import { actualReceivedUmpireContinuationEvidenceFromSqlite } from './SqliteActualReceivedUmpireContinuationStore';
import { receivedContinuationTable } from './ActualReceivedUmpireContinuationSchema';
import { actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalAdoptionStore';
import type { DatabaseSync } from 'node:sqlite';
import { receivedUnionReferenceClaims } from './ActualReceivedUmpireDefenderClaims';
import { receivedId } from './ActualReceivedUmpireDefender';
import { actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import { actualReceivedUmpireRenewalDecisionEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalDecisionStore';
import { actualReceivedUmpireRenewalMotorEvidenceFromSqlite } from './SqliteActualReceivedUmpireRenewalMotorStore';
import { receivedRenewalEnrollmentEvidenceFromSqlite } from './ActualReceivedUmpireRenewalEvidence';
import { renewalJournal } from './ActualReceivedUmpireRenewalJournal';
import { withRenewalReadProof } from './ActualReceivedUmpireRenewalTransaction';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
/** Current projection only. Immutable dependency readers never call this path. */
export const actualReceivedUmpireRenewalLiveWorkFromSqlite=(db:DatabaseSync)=>Object.freeze({read(receivedEnrollmentId:string){return withRenewalReadProof(db,()=>{
  if(!receivedId(receivedEnrollmentId))throw new Error('received renewal work enrollment identity differs');
  const claims=receivedUnionReferenceClaims(db,[{owner:'actual_received_umpire_defender_enrollments',sourceId:receivedEnrollmentId}])
    .filter(c=>c.owner===receivedHandoffTable||c.owner===receivedContinuationTable||c.owner.startsWith('actual_received_umpire_renewal_')||c.owner==='batted_world_field_executions');
  if(!claims.length)return null;
  const candidates=claims.filter(c=>c.owner==='actual_received_umpire_renewal_enrollments');
  if(candidates.length!==1)throw new Error('received renewal work has orphan or multiple enrollment claims');
  const result=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db).withOriginal(String(candidates[0].row.source_id),original=>{
    const e=original.value;if(e.receivedEnrollmentSourceId!==receivedEnrollmentId)throw new Error('received renewal work original enrollment differs');
    const journal=renewalJournal(db,e),stage=journal.length,continued=receivedContinuationAdmission(db,e.source.sourceId);
    const handed=receivedHandoffHeader(db,e.source.sourceId);
    if(handed){
      if(stage!==4)throw new Error('received handoff requires adopted renewal journal');
      const own=actualReceivedUmpireHandoffEvidenceFromSqlite(db),result=own.withOriginal(e.source.sourceId,v=>{own.current(v);return v;});
      if(!result)throw new Error('received handoff current owner missing');
      receivedRenewalEnrollmentEvidenceFromSqlite(db).qualifyNonPhysicalCurrent(original);
      return freeze({kind:'received_renewal_work' as const,renewalEnrollmentSourceId:e.source.sourceId,originProcessSourceId:e.originProcessSourceId,
        receivedReplanSourceId:e.receivedReplanSourceId,stage,cause:e.cause,work:{kind:'retained_physical_owner' as const,
          sourceId:result.physical.source.sourceId,handoffSourceId:result.value.source.sourceId,dueTick:result.physical.execution.field.motion.world.moment.ball.tick,cause:e.cause}});
    }
    if(continued){
      if(stage!==4)throw new Error('received continuation requires adopted renewal journal');
      const own=actualReceivedUmpireContinuationEvidenceFromSqlite(db),value=own.read(String(continued.source_id));
      if(!value||value.execution.kind!=='received_renewal_continuation_v1')throw new Error('received continuation current physical owner missing');
      own.current(value);receivedRenewalEnrollmentEvidenceFromSqlite(db).qualifyNonPhysicalCurrent(original);
      return freeze({kind:'received_renewal_work' as const,renewalEnrollmentSourceId:e.source.sourceId,originProcessSourceId:e.originProcessSourceId,
        receivedReplanSourceId:e.receivedReplanSourceId,stage,cause:e.cause,work:{...value.execution.liveWork,cause:e.cause}});
    }
    // Adoption gets a distinct current physical-head proof. Never requalify the
    // frozen old cut after that head advances.
    if(stage===4){
      const own=actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite(db),adoption=own.read(String(journal[3].source_id));
      if(!adoption)throw new Error('received renewal current physical adoption missing');own.current(adoption);
      receivedRenewalEnrollmentEvidenceFromSqlite(db).qualifyNonPhysicalCurrent(original);
      return freeze({kind:'received_renewal_work' as const,renewalEnrollmentSourceId:e.source.sourceId,originProcessSourceId:e.originProcessSourceId,
        receivedReplanSourceId:e.receivedReplanSourceId,stage,cause:e.cause,work:{kind:'physical_continuation' as const,sourceId:adoption.source.sourceId,dueTick:e.cut.tick,cause:e.cause}});
    }
    receivedRenewalEnrollmentEvidenceFromSqlite(db).qualifyCurrent(original);
    if(stage===2&&!actualReceivedUmpireRenewalDecisionEvidenceFromSqlite(db).read(String(journal[1].source_id)))throw new Error('received renewal work decision missing');
    if(stage===3&&!actualReceivedUmpireRenewalMotorEvidenceFromSqlite(db).read(String(journal[2].source_id)))throw new Error('received renewal work motor missing');
    return freeze({kind:'received_renewal_work' as const,renewalEnrollmentSourceId:e.source.sourceId,originProcessSourceId:e.originProcessSourceId,
      receivedReplanSourceId:e.receivedReplanSourceId,stage,cause:e.cause,work:{kind:stage===1?'renewal_decision' as const:stage===2?'renewal_motor' as const:'renewal_physical_adoption' as const,
        sourceId:String(journal.at(-1)!.source_id),dueTick:e.cut.tick,cause:e.cause}});
  });
  if(!result)throw new Error('received renewal work owner missing');return result;
});}});
