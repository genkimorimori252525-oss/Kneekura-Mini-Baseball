import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { readNativeSpinTrialMotorEvidenceV227 } from '../../src/host/world/NativeSpinTrialMotorEvidenceV227';
import { readNativeSpinTrialCohortSnapshotV228, readNativeSpinTrialDomainV228 } from '../../src/host/world/NativeSpinTrialCohortInventoryV228';
import { readNativeSpinMotionBindingV225, spinMotionBindingReferenceV225 } from '../../src/host/world/SqliteSpinMotionBindingV225';
import { readEmotionWorldRevisionFromSqlite } from '../../src/host/world/EmotionWorldRevisionFromSqlite';
import type { SamePaReference } from '../../src/host/world/SamePlateAppearanceWorkPrefix';
export { rawNativeSpinNeutralSqlDigestV193 } from './NativeSpinNeutralV193-sql';
type Evidence=ReturnType<typeof readNativeSpinTrialMotorEvidenceV227>;
const same=(a:unknown,b:unknown,label:string)=>{if(!isDeepStrictEqual(a,b))throw Error('V228 retained '+label+' differs')};
/** Reauthenticate the retained trial and inventory all eligible commitments in
 * the current frozen World prefix. No project criterion or qualification is created. */
export function inspectNativeSpinTrialCohortV228(db:DatabaseSync,resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>,retained:Evidence) {
 const evidence=readNativeSpinTrialMotorEvidenceV227(db,resolutionReference);same(evidence,retained,'V227 evidence');
 const binding=readNativeSpinMotionBindingV225(db,evidence.bindingReference.sourceId);
 if(!binding)throw Error('V228 binding unavailable');same(spinMotionBindingReferenceV225(binding),evidence.bindingReference,'binding');
 const i=evidence.independenceKey,subject={careerId:i.careerId,playerId:i.playerId,personId:i.personId,technique:binding.source.technique};
 const world=readEmotionWorldRevisionFromSqlite(db,subject.careerId);if(!world)throw Error('V228 World unavailable');
 const observed=readNativeSpinTrialDomainV228(db,resolutionReference);
 const inventory=readNativeSpinTrialCohortSnapshotV228(db,{subject,masteryReference:evidence.masteryReference,bindingReference:evidence.bindingReference,domain:observed.domain,endWorldRevision:world.head.worldRevision});
 if(!inventory.scopeComplete||inventory.members.length!==1)throw Error('V228 expected one complete retained trial');
 const member=inventory.members[0];same(member.resolutionReference,evidence.resolutionReference,'resolution');same(member.commitmentReference,evidence.commitmentReference,'commitment');
 same(member.identity,evidence.independenceKey,'identity');same(member.physicalPitchReference,evidence.provenance.physicalPitchReference,'pitch');same(member.inputReference,evidence.provenance.inputReference,'input');same(member.observationProvenance,observed.provenance,'observation provenance');
 if(!evidence.hasActualContact||member.outcome!=='CONTACT'||!evidence.spinObservation||evidence.spinObservation.basisStatus!=='DEFINED')throw Error('V228 retained contact differs');
 const component={BACKSPIN:'backspinRadPerSecond',TOPSPIN:'topspinRadPerSecond',SLICE:'sliceRadPerSecond',HOOK:'hookRadPerSecond'} as const;
 same(member.directionalSpin,evidence.spinObservation[component[subject.technique]],'directional spin');
 return {subject,domain:observed.domain,provenance:observed.provenance,inventory,evidence,
  summary:{boundary:'V228_READONLY_CENSUS_NO_QUALIFICATION' as const,normalOwnersReauthenticated:true,actualTrialCount:inventory.members.length,minimumOfTwoNotMet:true,criterionCreated:false,qualificationIssued:false,qualifiedTransferProven:false,earnedQualification:false}};
}
