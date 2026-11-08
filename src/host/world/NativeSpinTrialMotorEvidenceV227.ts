import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { observeBattedBallSpinV123 } from '../../core/sim/contact/BattedBallSpinObservationV123';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readSamePaBattingExecutionInputFromSqlite } from './SqliteBattingExecutionInputStore';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';

export type SpinTrialIndependenceKeyV227=Readonly<{policy:'ONE_PER_PHYSICAL_PITCH';careerId:string;playerId:string;personId:string;
 physicalPitchOwner:'pa_physical_v1_launches';physicalPitchSourceId:string}>;
export function spinTrialIndependenceKeyV227(raw:Readonly<{careerId:string;playerId:string;personId:string;
 physicalPitchReference:SamePaReference<'pa_physical_v1_launches'>}>):SpinTrialIndependenceKeyV227 {
 const value=cloneInert(raw);if(!fields(value,['careerId','playerId','personId','physicalPitchReference'])
  ||![value.careerId,value.playerId,value.personId].every(text)||!ref(value.physicalPitchReference,'pa_physical_v1_launches'))
  throw Error('spin trial evidence v227: invalid independent trial identity');
 return freeze({policy:'ONE_PER_PHYSICAL_PITCH',careerId:value.careerId,playerId:value.playerId,personId:value.personId,
  physicalPitchOwner:value.physicalPitchReference.owner,physicalPitchSourceId:value.physicalPitchReference.sourceId});
}
/** A synthetic caller can exercise the null branch; no-contact is never
 * discarded or relabeled as a successful spin observation. */
export function describeSpinTrialContactV227(raw:BatBallContactResult|null,bats:'R'|'L') {
 if(raw===null)return freeze({hasActualContact:false as const,contact:null,exitVelocity:null,exitSpin:null,spinObservation:null});
 const contact=cloneInert(raw),spinObservation=observeBattedBallSpinV123({velocityMps:contact.exitVelocity,spinRadPerSecond:contact.exitSpin,bats});
 return freeze({hasActualContact:true as const,contact,exitVelocity:contact.exitVelocity,exitSpin:contact.exitSpin,spinObservation});
}
const same=(a:unknown,b:unknown,label:string)=>{if(!isDeepStrictEqual(a,b))throw Error('spin trial evidence v227: '+label+' differs')};
/** Only the original Physical Owner and authenticated in-flight input can
 * supply this record. It does not award or change any earned qualification. */
export function readNativeSpinTrialMotorEvidenceV227(db:DatabaseSync,resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>) {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  if(!ref(resolutionReference,'pa_physical_v1_resolutions'))throw Error('spin trial evidence v227: invalid resolution fullref');
  const resolutionProof=readSamePaPhysicalOperationFromSqlite(db,resolutionReference),resolution=resolutionProof.record;
  if(resolution.kind!=='same_pa_physical_resolution_v1'||!resolution.source.commitmentReference)throw Error('spin trial evidence v227: trial commitment missing');
  const commitmentReference=resolution.source.commitmentReference,commitmentProof=readSamePaPhysicalOperationFromSqlite(db,commitmentReference),commitment=commitmentProof.record;
  if(commitment.kind!=='same_pa_physical_commitment_v1'||commitment.source.capability!=='same_pa_physical_observed_spin_aim_trial_v226'
   ||commitment.calculation.algorithm!=='batting-observed-spin-aim-trial-v226'||!commitment.trialEvidenceV226)throw Error('spin trial evidence v227: original operation is not an explicit trial');
  same(commitmentProof.actor,resolutionProof.actor,'actor');same(commitmentProof.lineage,resolutionProof.lineage,'lineage');
  same(commitmentProof.physicalPitchReference,resolutionProof.physicalPitchReference,'physical pitch');
  const inputReference=commitment.source.inputReference,input=readSamePaBattingExecutionInputFromSqlite(db,inputReference);
  if(input.source.capability!=='owned_in_flight_same_pa_batting_execution_input_v1')throw Error('spin trial evidence v227: input owner differs');
  same(input.lineage,commitment.lineage,'input lineage');same(input.physicalPitchReference,resolutionProof.physicalPitchReference,'input pitch');
  same(input.source,commitment.inputSource,'input Source');same(input.nominalRequest,commitment.calculation.nominalRequest,'nominal request');same(input.effectiveValues,commitment.calculation.effectiveValues,'effective values');
  same(commitment.trialEvidenceV226.bindingReference,commitment.source.trial.bindingReference,'binding reference');
  same(commitment.trialEvidenceV226.assessmentReference,commitment.source.trial.assessmentReference,'assessment reference');
  if(commitment.trialEvidenceV226.originalEvidenceEventId!==commitment.source.trial.originalEvidenceEventId
   ||commitment.trialEvidenceV226.authority!=='EXPLICIT_UNCALIBRATED_CONTROL'||commitment.trialEvidenceV226.qualifiedTransferProven!==false)
   throw Error('spin trial evidence v227: trial authority or original evidence differs');
  const actor=resolutionProof.actor,identity=spinTrialIndependenceKeyV227({careerId:actor.binding.careerId,playerId:actor.binding.playerId,personId:actor.binding.personId,
   physicalPitchReference:resolutionProof.physicalPitchReference});
  const trialEvidence=commitment.trialEvidenceV226,contact=describeSpinTrialContactV227(resolution.contact,input.nominalRequest.source.handedness);
  return freeze(cloneInert({version:'native_spin_trial_motor_evidence_v227' as const,scope:'EXPLICIT_UNCALIBRATED_CONTROL' as const,independenceKey:identity,
   provenance:{physicalPitchReference:resolutionProof.physicalPitchReference,inputReference},identityConflictPolicy:'SAME_PITCH_ID_DIFFERENT_FULLREF_IS_CONFLICT' as const,
   resolutionReference,commitmentReference,bindingReference:trialEvidence.bindingReference,masteryReference:trialEvidence.masteryReference,
   assessmentReference:trialEvidence.assessmentReference,predictionReference:trialEvidence.predictionReference,deliveryReference:trialEvidence.deliveryReference,
   observationReference:trialEvidence.observationReference,trialEvidence,motorTrace:commitment.calculation.observedSpinAimTrialV226,
   ...contact,qualifiedTransferProven:false as const,earnedQualification:false as const}));
 }));
}
