import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { advancePlayerWorkloadRecovery,type PlayerWorkloadActivity } from '../../core/world/development/PlayerWorkloadRecovery';
import type { SamePaExecutionView } from './SamePlateAppearanceExecutionView';
import { actorFreeze as freeze,actorHash as hash,actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields,samePaText as text,samePaHash as digest,samePaReferenceValid as ref,samePaParticipantValid,
  type SamePaReference,type SamePaParticipantReference } from './SamePlateAppearanceWorkPrefix';

export type AcceptedInitialJointWorkloadView=Readonly<{
  sourceId:string;sourceVersion:string;capability:'initial_joint_cumulative_workload_view_v1';
  executionReference:SamePaReference<'pa_initial_joint_v1_executions'>;coverageHash:string;
  assessment:Readonly<{basis:'MEASURED_PERSON_PREFIX_ASSESSMENT_V1'|'EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1';availableAtDay:number;
    assessmentSourceId:string;assessmentVersion:string;calibrationSourceId:string;calibrationVersion:string}>;
  participantTotals:readonly Readonly<{participantReference:SamePaParticipantReference;effortUnits:number}>[];
}>;
export type InitialJointCumulativeWorkloadAssessment=Pick<AcceptedInitialJointWorkloadView,'sourceId'|'coverageHash'|'assessment'|'participantTotals'>;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial joint workload projection: '+message);}
export function initialJointWorkloadViewInput(raw:unknown,id?:string):AcceptedInitialJointWorkloadView{
  const s=cloneInert(raw) as AcceptedInitialJointWorkloadView;
  assert(fields(s,['sourceId','sourceVersion','capability','executionReference','coverageHash','assessment','participantTotals'])
    &&text(s.sourceId)&&text(s.sourceVersion)&&(id===undefined||s.sourceId===id)&&s.capability==='initial_joint_cumulative_workload_view_v1'
    &&ref(s.executionReference,'pa_initial_joint_v1_executions')&&digest(s.coverageHash),'invalid Source identity or exact coverage');
  initialJointCumulativeWorkloadAssessmentInput({sourceId:s.sourceId,coverageHash:s.coverageHash,assessment:s.assessment,participantTotals:s.participantTotals});
  return freeze(s);
}
/** Owner-independent TOTAL grammar. No execution reference or actuation right
 * is accepted here; each physical owner validates its own immutable Source. */
export function initialJointCumulativeWorkloadAssessmentInput(raw:unknown):InitialJointCumulativeWorkloadAssessment{
  const s=cloneInert(raw) as InitialJointCumulativeWorkloadAssessment;
  assert(fields(s,['sourceId','coverageHash','assessment','participantTotals'])&&text(s.sourceId)&&digest(s.coverageHash),'invalid cumulative assessment identity or coverage');
  assert(fields(s.assessment,['basis','availableAtDay','assessmentSourceId','assessmentVersion','calibrationSourceId','calibrationVersion'])
    &&['MEASURED_PERSON_PREFIX_ASSESSMENT_V1','EXPLICIT_SYNTHETIC_PREFIX_ASSESSMENT_V1'].includes(s.assessment.basis)
    &&Number.isSafeInteger(s.assessment.availableAtDay)&&s.assessment.availableAtDay>=0
    &&[s.assessment.assessmentSourceId,s.assessment.assessmentVersion,s.assessment.calibrationSourceId,s.assessment.calibrationVersion].every(text),'explicit assessment provenance required');
  assert(Array.isArray(s.participantTotals)&&s.participantTotals.length>=10&&s.participantTotals.length<=13
    &&s.participantTotals.every(p=>fields(p,['participantReference','effortUnits'])&&samePaParticipantValid(p.participantReference)&&typeof p.effortUnits==='number'&&Number.isFinite(p.effortUnits)&&p.effortUnits>=0)
    &&new Set(s.participantTotals.map(p=>p.participantReference.playerId)).size===s.participantTotals.length,'complete unique accepted TOTAL set required');
  return freeze(s);
}
/** Pure projection, no Native right/global charge. Recompute cumulative work
 * from the ORIGINAL reserved state, never from an already projected state. */
export function projectInitialJointWorkload(raw:AcceptedInitialJointWorkloadView,basis:Readonly<{
  original:SamePaExecutionView;coverageHash:string;gameDay:number;activePlayerIds:readonly string[];
}>){
  const s=initialJointWorkloadViewInput(raw);
  return projectInitialJointCumulativeWorkload({sourceId:s.sourceId,coverageHash:s.coverageHash,assessment:s.assessment,participantTotals:s.participantTotals},basis);
}
/** Pure state projection shared by owners after their own Source validation. */
export function projectInitialJointCumulativeWorkload(raw:InitialJointCumulativeWorkloadAssessment,basis:Readonly<{
  original:SamePaExecutionView;coverageHash:string;gameDay:number;activePlayerIds:readonly string[];
}>){
  const s=initialJointCumulativeWorkloadAssessmentInput(raw),{original}=basis;
  assert(s.coverageHash===basis.coverageHash&&s.assessment.availableAtDay<=basis.gameDay,'different physical coverage or future assessment');
  assert(s.participantTotals.length===original.participants.length&&original.lineage.participantReferences.length===original.participants.length
    &&new Set(original.participants.map(p=>p.playerId)).size===original.participants.length,'original participant extent differs');
  assert(basis.activePlayerIds.length>0&&new Set(basis.activePlayerIds).size===basis.activePlayerIds.length
    &&basis.activePlayerIds.every(id=>original.participants.some(p=>p.playerId===id)),'active physical participant differs');
  const participants=original.participants.map(p=>{
    const total=s.participantTotals.find(t=>t.participantReference.playerId===p.playerId),reference=original.lineage.participantReferences.find(r=>r.playerId===p.playerId);
    assert(total&&reference&&json(total.participantReference)===json(reference)&&reference.stateHash===hash(p.reservedState),'original participant/state reference differs');
    assert(p.activity.kind==='MATCH'&&p.activity.atDay===basis.gameDay&&p.activity.careerId===original.lineage.careerId&&p.activity.playerId===p.playerId
      &&total.effortUnits>=p.activity.effortUnits,'cumulative work cannot erase prior work');
    assert(!basis.activePlayerIds.includes(p.playerId)||total.effortUnits>0,'actual physical work cannot use an empty zero TOTAL');
    const activity:PlayerWorkloadActivity={...p.activity,evidenceId:s.sourceId,effortUnits:total.effortUnits};
    const projectedState=advancePlayerWorkloadRecovery(p.reservedState,p.reservedState.revision,activity);
    return {playerId:p.playerId,participantReference:reference,effortUnits:total.effortUnits,reservedState:p.reservedState,activity,projectedState,projectedStateHash:hash(projectedState)};
  });
  return freeze({participants,assessmentSetHash:hash([...s.participantTotals].sort((a,b)=>a.participantReference.playerId.localeCompare(b.participantReference.playerId))),
    workloadTotalAdmitted:true as const,globalWorkloadCommitted:false as const,physicalSuccessorRequired:true as const,nextMotionAllowed:false as const});
}
