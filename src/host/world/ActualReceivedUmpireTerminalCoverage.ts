import {createHash} from 'node:crypto';
import type {DatabaseSync} from 'node:sqlite';
import {receivedUnionClaims} from './ActualReceivedUmpireDefenderClaims';
import {receivedOwnerTables} from './ActualReceivedUmpireDefenderSchema';
import {renewalOwnerTables} from './ActualReceivedUmpireRenewalSchema';
import {receivedContinuationTable} from './ActualReceivedUmpireContinuationSchema';
import {receivedHandoffTable} from './ActualReceivedUmpireHandoffSchema';
import {receivedHandoffHeader} from './ActualReceivedUmpireHandoffHeader';
import {receivedContinuationAdmission} from './ActualReceivedUmpireContinuationAdmission';
import {actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite} from './SqliteActualReceivedUmpireRenewalEnrollmentStore';
import {actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite} from './SqliteActualReceivedUmpireRenewalAdoptionStore';
import {actualReceivedUmpireContinuationEvidenceFromSqlite} from './SqliteActualReceivedUmpireContinuationStore';
import {actualReceivedUmpireHandoffEvidenceFromSqlite} from './SqliteActualReceivedUmpireHandoffStore';
import {receivedLegacyAdmissionPrefix} from './ActualReceivedUmpireDefenderEvidence';
import {renewalJournal} from './ActualReceivedUmpireRenewalJournal';
import {withRenewalReadProof} from './ActualReceivedUmpireRenewalTransaction';
import {ownedScheduledMotionArchiveHash} from './OwnedScheduledMotionArchive';
import {actorHash as hash,actorJson as json,actorFreeze as freeze} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type {DurableActualLivePlayRuntime} from './ActualLivePlayRuntime';
import type {ActualLivePlayPrefix} from './ActualLivePlayScope';
import type {DurableActualCallCommunication} from './ActualCallCommunication';
import type {ActualObservationMoment} from './ActualFieldObservation';
export type ReceivedControllerExtension=Readonly<{version:'received_controller_terminal_coverage_v1';runtimeSourceId:string;claimsDigest:string;allTransferred:boolean;
  physicalReferences:readonly Readonly<{owner:'batted_world_field_executions';sourceId:string;snapshotHash:string}>[];
  communicationReferences:readonly Readonly<{owner:'actual_call_communications';sourceId:string;snapshotHash:string}>[];
  recipients:readonly Readonly<{playerId:string;personId:string;receivedEnrollmentSourceId:string;renewalEnrollmentSourceId:string;callSourceId:string;originCommunicationSourceId:string;
    observationSourceId:string;incumbentDecisionSourceId:string;renewalDecisionSourceId:string;renewalMotorSourceId:string;adoptionSourceId:string;handoffSourceId:string|null;consumedAt:ActualObservationMoment}>[]}>;
const digest=(rows:unknown)=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
/** The Native caller supplies its already authenticated prefix. Every extension
 * entry is independently read through its real original owner; a SQL claim is
 * never sufficient coverage and later domain bodies stay outside the bound. */
export const receivedControllerTerminalCoverage=(db:DatabaseSync,runtime:DurableActualLivePlayRuntime,prefix:ActualLivePlayPrefix,current=false):ReceivedControllerExtension=>withRenewalReadProof(db,()=>{
  const scope={gameId:runtime.gameId,playId:runtime.playId,physicalPitchSourceId:runtime.source.physicalPitchSourceId},claims=receivedUnionClaims(db,scope);
  const rows=claims.filter(c=>c.owner==='actual_received_umpire_renewal_enrollments'),bound=prefix.executions.at(-1)!.revision;
  if(!rows.length)throw new Error('received terminal physical extension has no enrollment owner');
  const recipients:ReceivedControllerExtension['recipients'][number][]=[],physicalReferences:ReceivedControllerExtension['physicalReferences'][number][]=[],communicationReferences:ReceivedControllerExtension['communicationReferences'][number][]=[];
  const physical=(id:string,value:NonNullable<ReturnType<ReturnType<typeof actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite>['read']>>)=>{
    const supplied=prefix.executions.find(v=>v.source.sourceId===id);if(!supplied||supplied.revision!==value.revision||ownedScheduledMotionArchiveHash(supplied)!==ownedScheduledMotionArchiveHash(value))throw new Error('received terminal physical bound or archive differs');
    physicalReferences.push({owner:'batted_world_field_executions',sourceId:id,snapshotHash:ownedScheduledMotionArchiveHash(value)});
  };
  for(const row of rows){const e=actualReceivedUmpireRenewalEnrollmentEvidenceFromSqlite(db).read(String(row.row.source_id));if(!e)throw new Error('received terminal renewal enrollment missing');
    const participant=runtime.membership.participants.find(p=>p.playerId===e.playerId);
    if(e.runtimeSourceId!==runtime.source.sourceId||e.gameId!==scope.gameId||e.playId!==scope.playId||e.physicalPitchSourceId!==scope.physicalPitchSourceId
      ||participant?.role!=='defender'||participant.personId!==e.receiver.personId||e.anchor.baseField.sourceId!==prefix.baseField.source.sourceId
      ||json(e.anchor.legacyAdmissionPrefix)!==json({count:receivedLegacyAdmissionPrefix(db,runtime.source.sourceId).length,digest:hash(receivedLegacyAdmissionPrefix(db,runtime.source.sourceId))}))throw new Error('received terminal original runtime or receiver membership differs');
    const journal=renewalJournal(db,e);if(journal.length!==4)throw new Error('received terminal controller adoption remains pending');
    const adoption=actualReceivedUmpireRenewalAdoptionEvidenceFromSqlite(db).read(String(journal[3].source_id));if(!adoption||adoption.execution.kind!=='received_renewal_adoption_v1')throw new Error('received terminal controller adoption missing');physical(adoption.source.sourceId,adoption);
    const continued=receivedContinuationAdmission(db,e.source.sourceId);
    if(continued&&Number(continued.revision)<=bound){const c=actualReceivedUmpireContinuationEvidenceFromSqlite(db).read(String(continued.source_id));if(!c)throw new Error('received terminal continuation missing');physical(c.source.sourceId,c);}
    const header=receivedHandoffHeader(db,e.source.sourceId);let handoffSourceId:string|null=null;
    if(header&&header.value.physical.revision<=bound){const owner=actualReceivedUmpireHandoffEvidenceFromSqlite(db),h=owner.withOriginal(e.source.sourceId,v=>{if(current)owner.current(v);return v;});if(!h)throw new Error('received terminal handoff missing');
      physical(h.physical.source.sourceId,h.physical);communicationReferences.push({owner:'actual_call_communications',sourceId:h.communication.source.sourceId,snapshotHash:hash(h.communication)});handoffSourceId=h.value.source.sourceId;
    }
    recipients.push({playerId:e.playerId,personId:e.receiver.personId,receivedEnrollmentSourceId:e.receivedEnrollmentSourceId,renewalEnrollmentSourceId:e.source.sourceId,
      callSourceId:e.cause.callSourceId,originCommunicationSourceId:e.cause.originCommunicationSourceId,observationSourceId:e.anchor.observation.sourceId,
      incumbentDecisionSourceId:e.anchor.decision.sourceId,renewalDecisionSourceId:adoption.execution.adoption.renewalDecisionSourceId,renewalMotorSourceId:adoption.execution.adoption.renewalMotorSourceId,
      adoptionSourceId:adoption.source.sourceId,handoffSourceId,consumedAt:adoption.execution.adoption.adoptedAt});
  }
  const oldIds=recipients.map(r=>r.receivedEnrollmentSourceId),renewalIds=recipients.map(r=>r.renewalEnrollmentSourceId),handoffIds=recipients.flatMap(r=>r.handoffSourceId?[r.handoffSourceId]:[]);
  const covered=(c:typeof claims[number])=>{
    if((receivedOwnerTables as readonly string[]).includes(c.owner))return oldIds.includes(String(c.owner==='actual_received_umpire_defender_enrollments'?c.row.source_id:c.row.enrollment_source_id));
    if((renewalOwnerTables as readonly string[]).includes(c.owner)||c.owner===receivedContinuationTable)return renewalIds.includes(String(c.row.renewal_enrollment_source_id));
    if(c.owner===receivedHandoffTable)return handoffIds.includes(String(c.row.source_id));
    return c.owner==='batted_world_field_executions'&&physicalReferences.some(p=>p.sourceId===c.row.source_id);
  };
  if(claims.some(c=>!covered(c)))throw new Error('received terminal has unexplained extension claims');
  return freeze({version:'received_controller_terminal_coverage_v1',runtimeSourceId:runtime.source.sourceId,claimsDigest:digest(claims),allTransferred:recipients.every(r=>r.handoffSourceId!==null),physicalReferences,communicationReferences,recipients});
});
export const receivedRecipientConsumed=(proof:ReceivedControllerExtension|null,communication:DurableActualCallCommunication,playerId:string,at:ActualObservationMoment)=>{
  const matches=proof?.recipients.filter(r=>r.playerId===playerId&&r.callSourceId===communication.source.callSourceId&&r.originCommunicationSourceId===communication.originCommunicationSourceId)??[];
  if(matches.length!==1||matches[0].handoffSourceId===null||matches[0].consumedAt.originTick!==at.originTick||matches[0].consumedAt.elapsedSeconds>at.elapsedSeconds)return false;
  const recipients=communication.recipients.filter(r=>r.playerId===playerId),recipient=recipients[0];
  return recipients.length===1&&recipient.kind==='received'&&recipient.reception.receivedAtElapsedSeconds<=at.elapsedSeconds;
};
/** Exact claim conservation at the existing two-write terminal fence. The
 * complete PlayEnd reader reauthenticates all original bodies before/after
 * insertion; this check never upgrades a raw claim into a consumed receipt. */
export const assertReceivedTerminalClaimsCovered=(db:Pick<DatabaseSync,'prepare'>,value:Readonly<{gameId:string;playId:number;physicalPitchSourceId:string;source:{runtimeSourceId:string};receivedControllerExtension?:ReceivedControllerExtension}>)=>{
  const claims=receivedUnionClaims(db,value);if(!claims.length){if(value.receivedControllerExtension)throw new Error('received terminal extension disappeared');return;}
  const p=value.receivedControllerExtension;if(!p||!p.allTransferred||p.runtimeSourceId!==value.source.runtimeSourceId||p.claimsDigest!==digest(claims))throw new Error('received terminal has pending or changed extension ownership');
};
