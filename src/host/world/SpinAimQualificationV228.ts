import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { SPIN_TECHNIQUES_V123, type SpinTechniqueV123 } from '../../core/world/traits/SpinControlMasteryV123';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaHash as hash, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SpinTrialIndependenceKeyV227 } from './NativeSpinTrialMotorEvidenceV227';

type Profile=Readonly<{profileId:string;version:string}>;
export type SpinAimDomainV228=Readonly<{version:'spin_aim_domain_v228';bindingReference:SamePaReference<'world_spin_motion_bindings_v225'>;
 modelReference:SamePaReference<'world_player_batting_models'>;profile:Profile;coordinateSystem:'NATIVE_RBOX_METERS_V1';transform:'PLATE_XY_TRANSLATION_V1';
 handedness:'R';plateZ:number;ticksPerSecond:number;geometry:Readonly<{centerOfMass:Vec3;strikeZone:Readonly<{centerX:number;halfWidth:number;lowerY:number;upperY:number}>}>;
 targetPair:Readonly<{anchor:Vec3;target:Vec3}>;equipmentHash:string;forecastParametersHash:string;actualFlightParametersHash:string;
 observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1';nominalObservationValuesHash:string;captureEffectiveValuesHash:string;deliveryEffectiveValuesHash:string;predictionParameterValuesHash:string;deliveryLatencyTicks:number}>;
export type SpinAimCriterionV228=Readonly<{version:'spin_aim_project_criterion_v228';authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED';
 minimumIndependentTrials:number;minimumDirectionalSpinRadPerSecond:number;minimumSuccessFraction:number;miss:'COUNT_FAILURE';unresolved:'HOLD';unclassified:'HOLD'}>;
export type SpinAimCohortMemberV228=Readonly<{commitmentReference:SamePaReference<'pa_physical_v1_commitments'>;
 resolutionReference:SamePaReference<'pa_physical_v1_resolutions'>|null;worldRevision:number;identity:SpinTrialIndependenceKeyV227;
 physicalPitchReference:SamePaReference<'pa_physical_v1_launches'>;inputReference:SamePaReference<'batting_execution_v1_inputs'>;
 observationProvenance:Readonly<{captureReference:SamePaReference<'batting_observation_v1_observations'>;deliveryReference:SamePaReference<'batting_observation_v1_deliveries'>;predictionReference:SamePaReference<'batting_prediction_v1_predictions'>;captureCalibrationReference:SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;deliveryCalibrationReference:SamePaReference<'pa_lifecycle_v1_execution_calibrations'>}>} >;
export type SpinAimInventoryMemberV228=SpinAimCohortMemberV228 & Readonly<{outcome:'CONTACT'|'MISS'|'UNRESOLVED'|'UNCLASSIFIED';directionalSpin:number|null}>;
export type SpinAimQualificationSourceV228=Readonly<{version:'spin_aim_qualification_source_v228';sourceId:string;sourceVersion:string;
 subject:Readonly<{careerId:string;playerId:string;personId:string;technique:SpinTechniqueV123}>;masteryReference:SamePaReference<'world_spin_mastery_v123'>;
 bindingReference:SamePaReference<'world_spin_motion_bindings_v225'>;domain:SpinAimDomainV228;criterion:SpinAimCriterionV228;
 cohort:Readonly<{version:'closed_spin_trial_cohort_v228';start:Readonly<{kind:'EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING';worldRevision:number;commitmentReference:SamePaReference<'pa_physical_v1_commitments'>}>;
 end:Readonly<{kind:'WORLD_REVISION_AT_CLOSURE';worldRevision:number;worldEventHash:string;worldPrefixHash:string}>;members:readonly SpinAimCohortMemberV228[];scopedMemberHash:string}>}>;
export type SpinAimInventoryV228=Readonly<{firstEligibleWorldRevision:number|null;closedWorldRevision:number;closedWorldEventHash:string;closedWorldPrefixHash:string;currentWorldRevision:number;scopeComplete:boolean;members:readonly SpinAimInventoryMemberV228[]}>;
const bad=(m:string):never=>{throw Error('spin aim qualification v228: '+m)};
const nat=(x:unknown):x is number=>Number.isSafeInteger(x)&&Number(x)>=0;
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const vector=(x:unknown):x is Vec3=>fields(x,['x','y','z'])&&[x.x,x.y,x.z].every(finite);
const same=(a:unknown,b:unknown)=>isDeepStrictEqual(a,b);
function validateMember(m:SpinAimCohortMemberV228):void {
 if(!fields(m,['commitmentReference','resolutionReference','worldRevision','identity','physicalPitchReference','inputReference','observationProvenance'])
  ||!ref(m.commitmentReference,'pa_physical_v1_commitments')||m.resolutionReference!==null&&!ref(m.resolutionReference,'pa_physical_v1_resolutions')||!nat(m.worldRevision)
  ||!fields(m.identity,['policy','careerId','playerId','personId','physicalPitchOwner','physicalPitchSourceId'])||m.identity.policy!=='ONE_PER_PHYSICAL_PITCH'
  ||![m.identity.careerId,m.identity.playerId,m.identity.personId,m.identity.physicalPitchSourceId].every(text)||m.identity.physicalPitchOwner!=='pa_physical_v1_launches'
  ||!ref(m.physicalPitchReference,'pa_physical_v1_launches')||m.physicalPitchReference.sourceId!==m.identity.physicalPitchSourceId||!ref(m.inputReference,'batting_execution_v1_inputs')
  ||!fields(m.observationProvenance,['captureReference','deliveryReference','predictionReference','captureCalibrationReference','deliveryCalibrationReference'])
  ||!ref(m.observationProvenance.captureReference,'batting_observation_v1_observations')||!ref(m.observationProvenance.deliveryReference,'batting_observation_v1_deliveries')
  ||!ref(m.observationProvenance.predictionReference,'batting_prediction_v1_predictions')||!ref(m.observationProvenance.captureCalibrationReference,'pa_lifecycle_v1_execution_calibrations')
  ||!ref(m.observationProvenance.deliveryCalibrationReference,'pa_lifecycle_v1_execution_calibrations'))bad('invalid cohort member');
}
/** Lossless numeric-domain identity, including signed zero. Not authority. */
export function hashSpinAimDomainValueV228(raw:unknown):string {
 const encode=(value:unknown):unknown=>{
  if(value===null)return ['null'];if(typeof value==='number'){if(!Number.isFinite(value))bad('nonfinite domain value');const bytes=Buffer.alloc(8);bytes.writeDoubleBE(value);return ['number',bytes.toString('hex')]}
  if(typeof value==='string'||typeof value==='boolean')return [typeof value,value];
  if(Array.isArray(value))return ['array',value.map(encode)];
  if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))
   return ['object',Object.keys(value).sort().map(key=>[key,encode((value as Record<string,unknown>)[key])])];
  return bad('invalid domain value');
 };
 return createHash('sha256').update(JSON.stringify(encode(cloneInert(raw)))).digest('hex');
}
/** Hash of the already-derived in-range member set, not a whole-namespace
 * freshness test or a substitute for normal Owner authentication. */
export function hashScopedSpinAimMembersV228(members:readonly SpinAimCohortMemberV228[]):string {
 return createHash('sha256').update(json(['spin-aim-scoped-members-v228',members])).digest('hex');
}
export function validateSpinAimQualificationSourceV228(raw:unknown):SpinAimQualificationSourceV228 {
 const s=cloneInert(raw) as SpinAimQualificationSourceV228;
 if(!fields(s,['version','sourceId','sourceVersion','subject','masteryReference','bindingReference','domain','criterion','cohort'])||s.version!=='spin_aim_qualification_source_v228'
  ||![s.sourceId,s.sourceVersion].every(text)||!fields(s.subject,['careerId','playerId','personId','technique'])||![s.subject.careerId,s.subject.playerId,s.subject.personId].every(text)
  ||!SPIN_TECHNIQUES_V123.includes(s.subject.technique)||!ref(s.masteryReference,'world_spin_mastery_v123')||!ref(s.bindingReference,'world_spin_motion_bindings_v225'))bad('invalid source');
 const d=s.domain;
 if(!fields(d,['version','bindingReference','modelReference','profile','coordinateSystem','transform','handedness','plateZ','ticksPerSecond','geometry','targetPair','equipmentHash','forecastParametersHash','actualFlightParametersHash','observationMethod','nominalObservationValuesHash','captureEffectiveValuesHash','deliveryEffectiveValuesHash','predictionParameterValuesHash','deliveryLatencyTicks'])
  ||d.version!=='spin_aim_domain_v228'||!same(d.bindingReference,s.bindingReference)||!ref(d.modelReference,'world_player_batting_models')
  ||!fields(d.profile,['profileId','version'])||![d.profile.profileId,d.profile.version].every(text)||d.coordinateSystem!=='NATIVE_RBOX_METERS_V1'||d.transform!=='PLATE_XY_TRANSLATION_V1'||d.handedness!=='R'
  ||!finite(d.plateZ)||!nat(d.ticksPerSecond)||d.ticksPerSecond===0||!fields(d.geometry,['centerOfMass','strikeZone'])||!vector(d.geometry.centerOfMass)
  ||!fields(d.geometry.strikeZone,['centerX','halfWidth','lowerY','upperY'])||!Object.values(d.geometry.strikeZone).every(finite)||d.geometry.strikeZone.halfWidth<=0||d.geometry.strikeZone.lowerY>=d.geometry.strikeZone.upperY
  ||!fields(d.targetPair,['anchor','target'])||!vector(d.targetPair.anchor)||!vector(d.targetPair.target)||d.targetPair.anchor.z!==d.targetPair.target.z||d.targetPair.anchor.z!==d.plateZ
  ||![d.equipmentHash,d.forecastParametersHash,d.actualFlightParametersHash,d.nominalObservationValuesHash,d.captureEffectiveValuesHash,d.deliveryEffectiveValuesHash,d.predictionParameterValuesHash].every(hash)
  ||d.observationMethod!=='OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1'||!nat(d.deliveryLatencyTicks))bad('invalid domain');
 const c=s.criterion;
 if(!fields(c,['version','authority','minimumIndependentTrials','minimumDirectionalSpinRadPerSecond','minimumSuccessFraction','miss','unresolved','unclassified'])
  ||c.version!=='spin_aim_project_criterion_v228'||c.authority!=='PROJECT_DECLARED_NOT_HUMAN_CALIBRATED'||!nat(c.minimumIndependentTrials)||c.minimumIndependentTrials<2
  ||!finite(c.minimumDirectionalSpinRadPerSecond)||c.minimumDirectionalSpinRadPerSecond<=0||!finite(c.minimumSuccessFraction)||c.minimumSuccessFraction<=0||c.minimumSuccessFraction>1
  ||c.miss!=='COUNT_FAILURE'||c.unresolved!=='HOLD'||c.unclassified!=='HOLD')bad('invalid project criterion');
 const q=s.cohort;
 if(!fields(q,['version','start','end','members','scopedMemberHash'])||q.version!=='closed_spin_trial_cohort_v228'||!fields(q.start,['kind','worldRevision','commitmentReference'])
  ||q.start.kind!=='EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING'||!nat(q.start.worldRevision)||!ref(q.start.commitmentReference,'pa_physical_v1_commitments')
  ||!fields(q.end,['kind','worldRevision','worldEventHash','worldPrefixHash'])||q.end.kind!=='WORLD_REVISION_AT_CLOSURE'||!nat(q.end.worldRevision)||q.start.worldRevision>q.end.worldRevision||!hash(q.end.worldEventHash)||!hash(q.end.worldPrefixHash)||!Array.isArray(q.members)||!hash(q.scopedMemberHash))bad('invalid cohort closure');
 q.members.forEach(validateMember);if(q.members.some((m,i)=>i>0&&m.worldRevision<=q.members[i-1].worldRevision)||hashScopedSpinAimMembersV228(q.members)!==q.scopedMemberHash)bad('invalid scoped member hash or order');return freeze(s);
}
/** Pure evaluation accepts an inventory supplied by a separate Native reader;
 * synthetic inputs confer no qualification authority. */
export function evaluateSpinAimQualificationV228(raw:unknown,inventory:SpinAimInventoryV228){
 const s=validateSpinAimQualificationSourceV228(raw),result=(status:'HOLD'|'INELIGIBLE'|'CRITERION_MET_ONLY',reason:string,total=0,successes=0)=>freeze({status,reason,total,successes,successFraction:total?successes/total:null,authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED' as const});
 if(!inventory.scopeComplete||inventory.closedWorldRevision!==s.cohort.end.worldRevision||inventory.currentWorldRevision<inventory.closedWorldRevision||inventory.closedWorldEventHash!==s.cohort.end.worldEventHash||inventory.closedWorldPrefixHash!==s.cohort.end.worldPrefixHash)return result('HOLD','INVENTORY_UNAVAILABLE');
 if(inventory.firstEligibleWorldRevision!==s.cohort.start.worldRevision)return result('HOLD','START_BOUNDARY_DIFFERS');
 const members=inventory.members.map(({outcome:_outcome,directionalSpin:_spin,...m})=>m);
 if(!same(s.cohort.members,members)||!members.length||!same(members[0].commitmentReference,s.cohort.start.commitmentReference))return result('HOLD','MEMBER_SET_DIFFERS');
 const seen=new Map<string,SpinAimCohortMemberV228>(),commitments=new Set<string>(),resolutions=new Set<string>();
 for(const m of members){validateMember(m);
  if(commitments.has(m.commitmentReference.sourceId)||m.resolutionReference!==null&&resolutions.has(m.resolutionReference.sourceId))return result('HOLD','DUPLICATE_OWNER_REFERENCE');
  commitments.add(m.commitmentReference.sourceId);if(m.resolutionReference)resolutions.add(m.resolutionReference.sourceId);if(m.worldRevision<s.cohort.start.worldRevision||m.worldRevision>s.cohort.end.worldRevision
  ||m.identity.careerId!==s.subject.careerId||m.identity.playerId!==s.subject.playerId||m.identity.personId!==s.subject.personId)return result('HOLD','FOREIGN_SCOPE');
  const i=m.identity,k=JSON.stringify([i.policy,i.careerId,i.playerId,i.personId,i.physicalPitchOwner,i.physicalPitchSourceId]),prior=seen.get(k);if(prior)return result('HOLD',same(prior.physicalPitchReference,m.physicalPitchReference)?'DUPLICATE_PHYSICAL_PITCH':'PITCH_IDENTITY_CONFLICT');seen.set(k,m);}
 let successes=0;
 for(const m of inventory.members){if(m.outcome==='UNRESOLVED'||m.resolutionReference===null)return result('HOLD','UNRESOLVED');
  if(m.outcome==='UNCLASSIFIED')return result('HOLD','UNCLASSIFIED');if(m.outcome==='MISS'){if(m.directionalSpin!==null)return result('HOLD','INVALID_OUTCOME');continue}
  if(m.outcome!=='CONTACT'||!finite(m.directionalSpin)||m.directionalSpin<0)return result('HOLD','INVALID_OUTCOME');if(m.directionalSpin>=s.criterion.minimumDirectionalSpinRadPerSecond)successes++;}
 const total=members.length;if(total<s.criterion.minimumIndependentTrials)return result('INELIGIBLE','INSUFFICIENT_TRIALS',total,successes);
 if(successes/total<s.criterion.minimumSuccessFraction)return result('INELIGIBLE','INSUFFICIENT_SUCCESS_FRACTION',total,successes);
 return result('CRITERION_MET_ONLY','PROJECT_CRITERION_MET',total,successes);
}
