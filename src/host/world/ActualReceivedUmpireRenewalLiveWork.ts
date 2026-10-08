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
    .filter(c=>c.owner.startsWith('actual_received_umpire_renewal_')||c.owner==='batted_world_field_executions');
  if(!claims.length)return null;
  const candidates=claims.filter(c=>c.owner==='actual_received_umpire_renewal_enrollments');
  if(candidates.length!==1)throw new Error('received renewal work has orphan or multiple enrollment claims');
  const result=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db).withOriginal(String(candidates[0].row.source_id),original=>{
    const e=original.value;if(e.receivedEnrollmentSourceId!==receivedEnrollmentId)throw new Error('received renewal work original enrollment differs');
    const journal=renewalJournal(db,e),stage=journal.length;
    // Adoption gets a distinct current physical-head proof. Never requalify the
    // frozen old cut after that head advances.
    if(stage===4)throw new Error('received renewal adoption current projection is not implemented');
    receivedRenewalEnrollmentEvidenceFromSqlite(db).qualifyCurrent(original);
    if(stage===2&&!actualReceivedUmpireRenewalDecisionEvidenceFromSqlite(db).read(String(journal[1].source_id)))throw new Error('received renewal work decision missing');
    if(stage===3&&!actualReceivedUmpireRenewalMotorEvidenceFromSqlite(db).read(String(journal[2].source_id)))throw new Error('received renewal work motor missing');
    return freeze({kind:'received_renewal_work' as const,renewalEnrollmentSourceId:e.source.sourceId,originProcessSourceId:e.originProcessSourceId,
      receivedReplanSourceId:e.receivedReplanSourceId,stage,cause:e.cause,work:{kind:stage===1?'renewal_decision' as const:stage===2?'renewal_motor' as const:'renewal_physical_adoption' as const,
        sourceId:String(journal.at(-1)!.source_id),dueTick:e.cut.tick,cause:e.cause}});
  });
  if(!result)throw new Error('received renewal work owner missing');return result;
});}});
