import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { PlayerWorkloadActivity,PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import { actorFreeze as freeze,actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields,samePaText,samePaReferenceValid,type SamePaReference,type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
export type SamePaTotalReference=Readonly<{playerId:string;assessmentReference:SamePaReference<'reserved_pa_total_assessments'>}>;
export type AcceptedSamePaExecutionView=Readonly<{sourceId:string;sourceVersion:string;capability:'reserved_same_pa_cumulative_view_v1';
  enrollmentReference:SamePaReference<'same_pa_enrollments'>;prefixReference:SamePaReference<'reserved_pa_work_prefixes'>;participantTotalReferences:readonly SamePaTotalReference[]}>;
export type SamePaExecutionView=Readonly<{kind:'basis_prepared';source:AcceptedSamePaExecutionView;lineage:SamePaExecutionLineage;
  coverageHash:string;assessmentSetHash:string;participants:readonly Readonly<{playerId:string;totalReference:SamePaReference<'reserved_pa_total_assessments'>;
    reservedState:PlayerWorkloadRecoveryState;activity:PlayerWorkloadActivity;projectedState:PlayerWorkloadRecoveryState;projectedStateHash:string}>[]}>;
export const samePaAssessmentSetHash=(refs:readonly SamePaTotalReference[])=>hash([...refs].sort((a,b)=>a.playerId<b.playerId?-1:a.playerId>b.playerId?1:0));
export const samePaViewInput=(raw:unknown,id?:string):AcceptedSamePaExecutionView=>{
  const value=cloneInert(raw) as AcceptedSamePaExecutionView;
  if(!samePaFields(value,['sourceId','sourceVersion','capability','enrollmentReference','prefixReference','participantTotalReferences'])
    ||!samePaText(value.sourceId)||!samePaText(value.sourceVersion)||id!==undefined&&value.sourceId!==id||value.capability!=='reserved_same_pa_cumulative_view_v1'
    ||!samePaReferenceValid(value.enrollmentReference,'same_pa_enrollments')||!samePaReferenceValid(value.prefixReference,'reserved_pa_work_prefixes')
    ||!Array.isArray(value.participantTotalReferences)||value.participantTotalReferences.length!==10||new Set(value.participantTotalReferences.map(p=>p.playerId)).size!==10
    ||value.participantTotalReferences.some(p=>!samePaFields(p,['playerId','assessmentReference'])||!samePaText(p.playerId)||!samePaReferenceValid(p.assessmentReference,'reserved_pa_total_assessments')))throw new Error('invalid same-PA cumulative view Source');
  return freeze(value);
};
