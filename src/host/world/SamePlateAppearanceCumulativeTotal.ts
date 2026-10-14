import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields,samePaText,samePaReferenceValid,samePaParticipantValid,type SamePaReference,type SamePaParticipantReference,type SamePaExecutionLineage } from './SamePlateAppearanceWorkPrefix';
export type AcceptedSamePaCumulativeTotal=Readonly<{sourceId:string;sourceVersion:string;capability:'reserved_same_pa_cumulative_total_v1';
  enrollmentReference:SamePaReference<'same_pa_enrollments'>;prefixReference:SamePaReference<'reserved_pa_work_prefixes'>;
  participantReference:SamePaParticipantReference;effortUnits:0;
  provenance:Readonly<{assessmentSourceId:string;assessmentVersion:string;calibrationSourceId:string;calibrationVersion:string}>}>;
export type SamePaCumulativeTotal=Readonly<{kind:'cumulative_total';source:AcceptedSamePaCumulativeTotal;lineage:SamePaExecutionLineage;coverageHash:string;effortUnits:0}>;
export const samePaTotalInput=(raw:unknown,id?:string):AcceptedSamePaCumulativeTotal=>{
  const value=cloneInert(raw) as AcceptedSamePaCumulativeTotal;
  if(!samePaFields(value,['sourceId','sourceVersion','capability','enrollmentReference','prefixReference','participantReference','effortUnits','provenance'])
    ||!samePaText(value.sourceId)||!samePaText(value.sourceVersion)||id!==undefined&&value.sourceId!==id||value.capability!=='reserved_same_pa_cumulative_total_v1'
    ||!samePaReferenceValid(value.enrollmentReference,'same_pa_enrollments')||!samePaReferenceValid(value.prefixReference,'reserved_pa_work_prefixes')
    ||!samePaParticipantValid(value.participantReference)||value.effortUnits!==0
    ||!samePaFields(value.provenance,['assessmentSourceId','assessmentVersion','calibrationSourceId','calibrationVersion'])||!Object.values(value.provenance).every(samePaText))throw new Error('invalid same-PA empty zero TOTAL Source');
  return freeze(value);
};
