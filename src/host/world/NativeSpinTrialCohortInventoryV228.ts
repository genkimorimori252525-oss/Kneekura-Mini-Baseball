import { isDeepStrictEqual } from 'node:util';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { assertSamePaPhysicalEpisodeStorage } from './SamePlateAppearancePhysicalEpisodeStorage';
import { readPhysicalCommitmentWorldMembershipV232 } from './PhysicalCommitmentWorldMembershipV232';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import { readNativeSpinTrialMotorEvidenceV227, type SpinTrialIndependenceKeyV227 } from './NativeSpinTrialMotorEvidenceV227';
import { readNativeSpinMotionBindingV225, spinMotionBindingReferenceV225 } from './SqliteSpinMotionBindingV225';
import { readNativeSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { readBattingPerceptionFromSqlite } from './SqliteBattingPerceptionStore';
import { readEmotionWorldRevisionFromSqlite, readHistoricalEmotionWorldRevisionFromSqlite } from './EmotionWorldRevisionFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { readSamePaLifecycleCalibrationFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaReferenceValid, samePaFields, samePaText, samePaHash, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { deriveObservedSpinAimDomainV231 } from './SpinAimObservedDomainConditionsV231';
import { SPIN_TECHNIQUES_V123 } from '../../core/world/traits/SpinControlMasteryV123';
import { hashSpinAimDomainValueV228, validateSpinAimQualificationSourceV228, type SpinAimQualificationSourceV228, type SpinAimDomainV228, type SpinAimCohortMemberV228, type SpinAimInventoryMemberV228, type SpinAimInventoryV228 } from './SpinAimQualificationV228';

const same=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b);
type Commitment=Extract<ReturnType<typeof readSamePaPhysicalOperationFromSqlite>['record'],{kind:'same_pa_physical_commitment_v1'}>;
type Binding=NonNullable<ReturnType<typeof readNativeSpinMotionBindingV225>>;
type Perception=ReturnType<typeof readBattingPerceptionFromSqlite>;
type Calibration=ReturnType<typeof readSamePaLifecycleCalibrationFromSqlite>;
/** Pure transformation of already-authenticated Owner results. Source IDs and
 * per-pitch refs stay in provenance, never in the shared method/value domain. */
export function deriveSpinTrialDomainFromRecordsV228(record:Commitment,binding:Binding,capture:Perception,delivery:Perception,prediction:Perception,captureCal:Calibration,deliveryCal:Calibration):Readonly<{domain:SpinAimDomainV228;provenance:SpinAimCohortMemberV228['observationProvenance']}> {
 if(record.source.capability!=='same_pa_physical_observed_spin_aim_trial_v226'||record.calculation.algorithm!=='batting-observed-spin-aim-trial-v226'||!record.trialEvidenceV226)
  throw Error('spin trial domain v228: trial commitment differs');
 return deriveObservedSpinAimDomainV231({trialContext:record.calculation.trialContext,evidence:record.trialEvidenceV226,bindingReference:record.source.trial.bindingReference,binding,capture,delivery,prediction,captureCalibration:captureCal,deliveryCalibration:deliveryCal});
}
function readDomainFromCommitmentV228(db:DatabaseSync,record:Commitment,binding:Binding) {
 if(!record.trialEvidenceV226)throw Error('spin trial domain v228: trial evidence missing');const e=record.trialEvidenceV226,
  capture=readBattingPerceptionFromSqlite(db,'observation',e.observationReference),delivery=readBattingPerceptionFromSqlite(db,'delivery',e.deliveryReference),
  prediction=readBattingPerceptionFromSqlite(db,'prediction',e.predictionReference);
 if(capture.kind!=='batting_observation'||capture.source.capability!=='owned_in_flight_batting_observation_v1'
  ||delivery.kind!=='batting_observation_delivery'||delivery.source.capability!=='owned_in_flight_batting_observation_delivery_v1')throw Error('spin trial domain v228: observation owners differ');
 const cc=readSamePaLifecycleCalibrationFromSqlite(db,capture.source.calibrationReference),dc=readSamePaLifecycleCalibrationFromSqlite(db,delivery.source.calibrationReference);
 return deriveSpinTrialDomainFromRecordsV228(record,binding,capture,delivery,prediction,cc,dc);
}
/** Reader for an existing V227 trial: this derives conditions only and never
 * classifies the contact, grants authority, or changes stored records. */
export function readNativeSpinTrialDomainV228(db:DatabaseSync,resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>) {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  if(db.prepare('PRAGMA query_only').get()!.query_only!==1)throw Error('spin trial domain v228: query_only snapshot required');
  const trial=readNativeSpinTrialMotorEvidenceV227(db,resolutionReference),proof=readSamePaPhysicalOperationFromSqlite(db,trial.commitmentReference),record=proof.record;
  if(record.kind!=='same_pa_physical_commitment_v1')throw Error('spin trial domain v228: commitment missing');
  const binding=readNativeSpinMotionBindingV225(db,trial.bindingReference.sourceId);
  if(!binding||!same(spinMotionBindingReferenceV225(binding),trial.bindingReference))throw Error('spin trial domain v228: binding differs');
  return readDomainFromCommitmentV228(db,record,binding);
 }));
}

/** Complete trial census, not a contact-only inventory or a qualification.
 * Scoped closure is historical: ordinary events after the end do not by
 * themselves invalidate an authenticated frozen World prefix. */
export function readNativeSpinTrialCohortInventoryV228(db:DatabaseSync,raw:unknown):SpinAimInventoryV228 {
 const source=validateSpinAimQualificationSourceV228(raw);
 return readCensusV228(db,{subject:source.subject,masteryReference:source.masteryReference,bindingReference:source.bindingReference,domain:source.domain,endWorldRevision:source.cohort.end.worldRevision},source.cohort.start.worldRevision,{worldEventHash:source.cohort.end.worldEventHash,worldPrefixHash:source.cohort.end.worldPrefixHash});
}
export type SpinTrialCohortSnapshotScopeV228=Readonly<{subject:SpinAimQualificationSourceV228['subject'];masteryReference:SpinAimQualificationSourceV228['masteryReference'];bindingReference:SpinAimQualificationSourceV228['bindingReference'];domain:SpinAimDomainV228;endWorldRevision:number}>;
/** Observational census only; no criterion, qualification, or authority is issued. */
export function readNativeSpinTrialCohortSnapshotV228(db:DatabaseSync,raw:unknown):SpinAimInventoryV228 {
 const scope=cloneInert(raw) as SpinTrialCohortSnapshotScopeV228,d=scope?.domain;
 const finite=(n:unknown)=>typeof n==='number'&&Number.isFinite(n),nat=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
 const vector=(v:unknown):v is {x:number;y:number;z:number}=>samePaFields(v,['x','y','z'])&&[v.x,v.y,v.z].every(finite);
 if(!samePaFields(scope,['subject','masteryReference','bindingReference','domain','endWorldRevision'])||!samePaFields(scope.subject,['careerId','playerId','personId','technique'])
  ||![scope.subject.careerId,scope.subject.playerId,scope.subject.personId].every(samePaText)||!SPIN_TECHNIQUES_V123.includes(scope.subject.technique)
  ||!samePaReferenceValid(scope.masteryReference,'world_spin_mastery_v123')||!samePaReferenceValid(scope.bindingReference,'world_spin_motion_bindings_v225')||!nat(scope.endWorldRevision)||scope.endWorldRevision<1
  ||!samePaFields(d,['version','bindingReference','modelReference','profile','coordinateSystem','transform','handedness','plateZ','ticksPerSecond','geometry','targetPair','equipmentHash','forecastParametersHash','actualFlightParametersHash','observationMethod','nominalObservationValuesHash','captureEffectiveValuesHash','deliveryEffectiveValuesHash','predictionParameterValuesHash','deliveryLatencyTicks'])
  ||d.version!=='spin_aim_domain_v228'||!same(d.bindingReference,scope.bindingReference)||!samePaReferenceValid(d.modelReference,'world_player_batting_models')
  ||!samePaFields(d.profile,['profileId','version'])||![d.profile.profileId,d.profile.version].every(samePaText)||d.coordinateSystem!=='NATIVE_RBOX_METERS_V1'||d.transform!=='PLATE_XY_TRANSLATION_V1'||d.handedness!=='R'
  ||!finite(d.plateZ)||!nat(d.ticksPerSecond)||d.ticksPerSecond===0||!samePaFields(d.geometry,['centerOfMass','strikeZone'])||!vector(d.geometry.centerOfMass)
  ||!samePaFields(d.geometry.strikeZone,['centerX','halfWidth','lowerY','upperY'])||!Object.values(d.geometry.strikeZone).every(finite)||d.geometry.strikeZone.halfWidth<=0||d.geometry.strikeZone.lowerY>=d.geometry.strikeZone.upperY
  ||!samePaFields(d.targetPair,['anchor','target'])||!vector(d.targetPair.anchor)||!vector(d.targetPair.target)||d.targetPair.anchor.z!==d.targetPair.target.z||d.targetPair.anchor.z!==d.plateZ
  ||![d.equipmentHash,d.forecastParametersHash,d.actualFlightParametersHash,d.nominalObservationValuesHash,d.captureEffectiveValuesHash,d.deliveryEffectiveValuesHash,d.predictionParameterValuesHash].every(samePaHash)
  ||d.observationMethod!=='OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1'||!nat(d.deliveryLatencyTicks))throw Error('spin trial cohort v228: invalid snapshot scope');
 return readCensusV228(db,scope,0);
}
function readCensusV228(db:DatabaseSync,scope:SpinTrialCohortSnapshotScopeV228,startWorldRevision:number,expected?:Readonly<{worldEventHash:string;worldPrefixHash:string}>):SpinAimInventoryV228 {
 return withBattedVenueLegalReadSnapshot(db,()=>withSamePaLifecycleReadPhase(db,()=>{
  if(db.prepare('PRAGMA query_only').get()!.query_only!==1)throw Error('spin trial cohort v228: query_only snapshot required');
  const world=readEmotionWorldRevisionFromSqlite(db,scope.subject.careerId),end=scope.endWorldRevision;
  const unavailable=()=>freeze({firstEligibleWorldRevision:null,closedWorldRevision:end,closedWorldEventHash:'',closedWorldPrefixHash:'',currentWorldRevision:world?.head.worldRevision??0,scopeComplete:false,members:[]});
  if(!world||world.head.worldRevision<end||!assertSamePaPhysicalEpisodeStorage(db))return unavailable();
  if(end<1)return unavailable();readHistoricalEmotionWorldRevisionFromSqlite(db,scope.subject.careerId,end);
  const prefix=db.prepare('SELECT career_id,world_revision,source_kind,source_event_id,event_json FROM main.world_decision_revision_events WHERE career_id=? AND world_revision<=? ORDER BY world_revision').all(scope.subject.careerId,end);
  if(prefix.length!==end||Number(prefix.at(-1)?.world_revision)!==end)return unavailable();
  const closedWorldEventHash=hashSpinAimDomainValueV228(prefix.at(-1)),closedWorldPrefixHash=hashSpinAimDomainValueV228(prefix);
  const membership=readPhysicalCommitmentWorldMembershipV232(db,{careerId:scope.subject.careerId,endWorldRevision:end,expectedWorldPrefixHash:expected?.worldPrefixHash??closedWorldPrefixHash,expectedWorldEventHash:expected?.worldEventHash??closedWorldEventHash});
  const binding=readNativeSpinMotionBindingV225(db,scope.bindingReference.sourceId),mastery=readNativeSpinControlMasteryV123(db,scope.masteryReference.sourceId);
  if(!binding||!mastery||!same(spinMotionBindingReferenceV225(binding),scope.bindingReference)||!same(binding.source.masteryReference,scope.masteryReference)
   ||binding.source.technique!==scope.subject.technique||binding.source.careerId!==scope.subject.careerId||binding.source.playerId!==scope.subject.playerId
   ||mastery.person.personId!==scope.subject.personId)throw Error('spin trial cohort v228: original binding/mastery scope differs');
  const authenticatedResolutions=membership.resolutionCandidates.map(candidate=>{
   const reference=candidate.reference,proof=readSamePaPhysicalOperationFromSqlite(db,reference),record=proof.record;
   if(record.kind!=='same_pa_physical_resolution_v1'||!same(record.source.commitmentReference,candidate.commitmentReference))throw Error('spin trial cohort v228: resolution classification differs');
   return {reference,commitmentReference:record.source.commitmentReference};
  });
  const expectedDomain=scope.domain,candidates:SpinAimInventoryMemberV228[]=[];let complete=true;
  for(const member of membership.commitments){
   const commitmentReference=member.reference,proof=readSamePaPhysicalOperationFromSqlite(db,commitmentReference),record=proof.record;
   if(record.kind!=='same_pa_physical_commitment_v1'||record.afterWorldRevision!==member.afterWorldRevision||record.beforeWorldRevision!==member.beforeWorldRevision||record.actionKey!==member.actionKey)throw Error('spin trial cohort v228: original commitment classification differs');
   if(record.source.capability!=='same_pa_physical_observed_spin_aim_trial_v226')continue;
   if(record.calculation.algorithm!=='batting-observed-spin-aim-trial-v226'||!record.trialEvidenceV226)throw Error('spin trial cohort v228: trial calculation differs');
   const actor=proof.actor;if(actor.binding.careerId!==scope.subject.careerId||actor.binding.playerId!==scope.subject.playerId||actor.binding.personId!==scope.subject.personId)continue;
   if(!same(record.source.trial.bindingReference,scope.bindingReference)||!same(record.trialEvidenceV226.masteryReference,scope.masteryReference))continue;
   const {domain:actualDomain,provenance:observationProvenance}=readDomainFromCommitmentV228(db,record,binding);
   if(!same(actualDomain,expectedDomain))continue;
   const pitchRef=proof.physicalPitchReference,inputReference=record.source.inputReference,
    identity:SpinTrialIndependenceKeyV227={policy:'ONE_PER_PHYSICAL_PITCH',careerId:actor.binding.careerId,playerId:actor.binding.playerId,personId:actor.binding.personId,
      physicalPitchOwner:pitchRef.owner,physicalPitchSourceId:pitchRef.sourceId};
   const matches=authenticatedResolutions.filter(item=>item.commitmentReference?.owner==='pa_physical_v1_commitments'
    &&item.commitmentReference.sourceId===commitmentReference.sourceId);
   if(matches.length>1||matches.some(m=>!same(m.commitmentReference,commitmentReference))){complete=false;continue}
   const resolutionReference=matches.length?matches[0].reference:null;
   let outcome:SpinAimInventoryMemberV228['outcome']='UNRESOLVED',directionalSpin:number|null=null;
   if(resolutionReference){const trial=readNativeSpinTrialMotorEvidenceV227(db,resolutionReference);
    if(!same(trial.commitmentReference,commitmentReference)||!same(trial.independenceKey,identity)||!same(trial.provenance.physicalPitchReference,pitchRef)||!same(trial.provenance.inputReference,inputReference))
     throw Error('spin trial cohort v228: resolution lineage differs');
    if(!trial.hasActualContact)outcome='MISS';else if(!trial.spinObservation||trial.spinObservation.basisStatus!=='DEFINED')outcome='UNCLASSIFIED';
    else {const component={BACKSPIN:'backspinRadPerSecond',TOPSPIN:'topspinRadPerSecond',SLICE:'sliceRadPerSecond',HOOK:'hookRadPerSecond'} as const;
      directionalSpin=trial.spinObservation[component[scope.subject.technique]];outcome=directionalSpin===null?'UNCLASSIFIED':'CONTACT'}
   }
   candidates.push({commitmentReference,resolutionReference,worldRevision:record.afterWorldRevision,identity,physicalPitchReference:pitchRef,inputReference,observationProvenance,outcome,directionalSpin});
  }
  candidates.sort((a,b)=>a.worldRevision-b.worldRevision||a.commitmentReference.sourceId.localeCompare(b.commitmentReference.sourceId));
  const firstEligibleWorldRevision=candidates[0]?.worldRevision??null,members=candidates.filter(m=>m.worldRevision>=startWorldRevision&&m.worldRevision<=end);
  return freeze(cloneInert({firstEligibleWorldRevision,closedWorldRevision:end,closedWorldEventHash,closedWorldPrefixHash,currentWorldRevision:world.head.worldRevision,scopeComplete:complete,members}));
 }));
}
