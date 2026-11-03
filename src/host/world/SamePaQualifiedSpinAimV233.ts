import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { deriveSamePaObservedSpinAimComponentsV233 } from './SamePaObservedSpinAimTrialV226';
import { readObservedSpinAimDomainComponentsV233 } from './SpinAimObservedDomainConditionsV231';
import { readNativeSpinAimQualificationHeaderV233, readNativeSpinAimQualificationV230, spinAimQualificationReferenceV230 } from './SqliteSpinAimQualificationV230';
import { assertQualificationDependencyRankV232 } from './PhysicalCommitmentWorldMembershipV232';

export type SamePaQualifiedSpinAimV233=Readonly<{qualificationReference:SamePaReference<'world_spin_aim_qualifications_v230'>;originalEvidenceEventId:string;
 assessmentReference:SamePaReference<'batting_score_v1_assessments'>;transform:'PLATE_XY_TRANSLATION_V1';coordinateSystem:'NATIVE_RBOX_METERS_V1'}>;
export function samePaQualifiedSpinAimInputV233(raw:unknown):SamePaQualifiedSpinAimV233 {
 const s=cloneInert(raw) as SamePaQualifiedSpinAimV233;
 if(!fields(s,['qualificationReference','originalEvidenceEventId','assessmentReference','transform','coordinateSystem'])||!ref(s.qualificationReference,'world_spin_aim_qualifications_v230')
  ||!text(s.originalEvidenceEventId)||!ref(s.assessmentReference,'batting_score_v1_assessments')||s.transform!=='PLATE_XY_TRANSLATION_V1'||s.coordinateSystem!=='NATIVE_RBOX_METERS_V1')throw Error('invalid same-PA qualified spin aim Source');
 return freeze(s);
}
/** A Producer may only select the new arm from an already authenticated
 * current qualification and observed domain. Missing/foreign candidates fall
 * back explicitly; corrupt Owner reads still throw before reaching this API. */
export function selectQualifiedSpinAimCandidateV233(candidate:SamePaQualifiedSpinAimV233|null,qualification:ReturnType<typeof readNativeSpinAimQualificationV230>,subject:Readonly<{careerId:string;playerId:string;personId:string}>,domain:unknown) {
 const fallback=(reason:'NO_CANDIDATE'|'NOT_APPLICABLE'|'FOREIGN'|'DOMAIN_MISMATCH'|'OBSERVATION_UNAVAILABLE')=>freeze({kind:'NORMAL_FALLBACK' as const,reason});
 if(!candidate)return fallback('NO_CANDIDATE');const input=samePaQualifiedSpinAimInputV233(candidate);
 if(!qualification?.snapshotReauthenticated||!qualification.snapshot||!qualification.applicable)return fallback('NOT_APPLICABLE');
 const source=qualification.snapshot.source;if(!isDeepStrictEqual(spinAimQualificationReferenceV230(qualification),input.qualificationReference)
  ||source.subject.careerId!==subject.careerId||source.subject.playerId!==subject.playerId||source.subject.personId!==subject.personId)return fallback('FOREIGN');
 if(domain===null)return fallback('OBSERVATION_UNAVAILABLE');if(!isDeepStrictEqual(source.domain,domain))return fallback('DOMAIN_MISMATCH');return freeze({kind:'QUALIFIED' as const,qualifiedAim:input});
}
/** Header/rank precedes the recursive qualification reader. Metadata alone is
 * never used as a qualification; all input and domain Owners are re-read. */
export function deriveSamePaQualifiedSpinAimV233(db:DatabaseSync,raw:SamePaQualifiedSpinAimV233,basis:Parameters<typeof deriveSamePaObservedSpinAimComponentsV233>[2],beforeWorldRevision:number) {
 const q=samePaQualifiedSpinAimInputV233(raw),header=readNativeSpinAimQualificationHeaderV233(db,q.qualificationReference);
 assertQualificationDependencyRankV232(header.endWorldRevision,beforeWorldRevision,beforeWorldRevision+1);
 const qualification=readNativeSpinAimQualificationV230(db,q.qualificationReference.sourceId);
 if(!qualification?.snapshotReauthenticated||!qualification.snapshot||!qualification.applicable||!isDeepStrictEqual(spinAimQualificationReferenceV230(qualification),q.qualificationReference))throw Error('qualified spin aim v233: qualification not applicable');
 const source=qualification.snapshot.source,subject=source.subject;
 if(subject.careerId!==basis.actor.binding.careerId||subject.playerId!==basis.actor.binding.playerId||subject.personId!==basis.actor.binding.personId)throw Error('qualified spin aim v233: foreign subject');
 const components={bindingReference:source.bindingReference,originalEvidenceEventId:q.originalEvidenceEventId,assessmentReference:q.assessmentReference,transform:q.transform,coordinateSystem:q.coordinateSystem};
 const joined=deriveSamePaObservedSpinAimComponentsV233(db,components,basis),observed=readObservedSpinAimDomainComponentsV233(db,components,basis);
 if(!isDeepStrictEqual(joined.evidence.masteryReference,source.masteryReference)||!isDeepStrictEqual(observed.domain,source.domain))throw Error('qualified spin aim v233: domain or mastery differs');
 return freeze(cloneInert({trialContext:joined.trialContext,qualifiedEvidenceV233:{qualificationReference:q.qualificationReference,masteryReference:source.masteryReference,
  bindingReference:source.bindingReference,endWorldRevision:header.endWorldRevision,subject,domain:observed.domain,observationProvenance:observed.provenance,
  authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED' as const,humanCalibration:'NOT_MEASURED' as const}}));
}
