import type { DatabaseSync } from 'node:sqlite';
import { actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite } from './SqliteActualReceivedUmpireDefenderEnrollmentStore';
import { actualReceivedUmpireDefenderReplanEvidenceFromSqlite } from './SqliteActualReceivedUmpireDefenderReplanStore';
import { actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withReceivedReadProof } from './ActualReceivedUmpireDefenderTransaction';
import { actualReceivedUmpireRenewalLiveWorkFromSqlite } from './ActualReceivedUmpireRenewalLiveWork';
/** Exactly one outstanding obligation. No motion or closure consumption exists. */
export const actualReceivedUmpireDefenderLiveWorkFromSqlite=(db:DatabaseSync)=>Object.freeze({read(enrollmentId:string){return withReceivedReadProof(db,()=>{
  const enrollment=actualReceivedUmpireDefenderEnrollmentEvidenceFromSqlite(db).read(enrollmentId);
  if(!enrollment)return null;
  const renewal=actualReceivedUmpireRenewalLiveWorkFromSqlite(db).read(enrollmentId);
  if(renewal)return renewal;
  const head=db.prepare('SELECT source_id FROM actual_received_umpire_defender_replan_heads WHERE enrollment_source_id=?').get(enrollmentId);
  const process=head?actualReceivedUmpireDefenderReplanEvidenceFromSqlite(db).read(String(head.source_id)):null;
  if(head&&!process)throw new Error('received pending work process is missing');
  if(!process||process.replan.work.length===0)return freeze({kind:'received_enrollment_pending' as const,sourceId:enrollmentId,sourceHash:hash(enrollment.source),cause:enrollment.cause,reason:process?'no_core_work' as const:'process_not_admitted' as const});
  if(process.replan.work.length!==1||process.replan.work[0].sourceId!==process.originProcessSourceId)throw new Error('received process current work identity differs');
  return freeze({kind:'received_process_work' as const,originProcessSourceId:process.originProcessSourceId,revisionSourceId:process.source.sourceId,revisionSourceHash:hash(process.source),cause:enrollment.cause,work:process.replan.work[0]});
});}});
