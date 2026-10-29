import { expect, it } from 'vitest';
import { evaluateSpinAimQualificationV228, hashScopedSpinAimMembersV228 } from './SpinAimQualificationV228';
const h='a'.repeat(64),ref=<T extends string>(owner:T,id:string)=>({owner,sourceId:id,sourceHash:h,snapshotHash:h});
const domain={version:'spin_aim_domain_v228',bindingReference:ref('world_spin_motion_bindings_v225','binding'),modelReference:ref('world_player_batting_models','model'),
 profile:{profileId:'course',version:'v1'},coordinateSystem:'NATIVE_RBOX_METERS_V1',transform:'PLATE_XY_TRANSLATION_V1',handedness:'R',plateZ:0,ticksPerSecond:1000000,
 geometry:{centerOfMass:{x:0,y:1,z:0},strikeZone:{centerX:0,halfWidth:.2,lowerY:.5,upperY:1.8}},targetPair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1.02,z:0}},
 equipmentHash:h,forecastParametersHash:h,actualFlightParametersHash:h,observationMethod:'OWNED_IN_FLIGHT_BATTING_CAPTURE_DELIVERY_V1',nominalObservationValuesHash:h,captureEffectiveValuesHash:h,deliveryEffectiveValuesHash:h,predictionParameterValuesHash:h,deliveryLatencyTicks:10000};
const criterion={version:'spin_aim_project_criterion_v228',authority:'PROJECT_DECLARED_NOT_HUMAN_CALIBRATED',minimumIndependentTrials:2,minimumDirectionalSpinRadPerSecond:10,minimumSuccessFraction:.5,miss:'COUNT_FAILURE',unresolved:'HOLD',unclassified:'HOLD'};
const key=(id:string)=>({policy:'ONE_PER_PHYSICAL_PITCH' as const,careerId:'c',playerId:'p',personId:'person',physicalPitchOwner:'pa_physical_v1_launches' as const,physicalPitchSourceId:id});
const member=(id:string,rev:number,outcome:'CONTACT'|'MISS'|'UNRESOLVED')=>({commitmentReference:ref('pa_physical_v1_commitments','c'+id),resolutionReference:outcome==='UNRESOLVED'?null:ref('pa_physical_v1_resolutions','r'+id),worldRevision:rev,
 identity:key(id),physicalPitchReference:ref('pa_physical_v1_launches',id),inputReference:ref('batting_execution_v1_inputs','i'+id),observationProvenance:{captureReference:ref('batting_observation_v1_observations','o'+id),deliveryReference:ref('batting_observation_v1_deliveries','d'+id),predictionReference:ref('batting_prediction_v1_predictions','p'+id),captureCalibrationReference:ref('pa_lifecycle_v1_execution_calibrations','cc'+id),deliveryCalibrationReference:ref('pa_lifecycle_v1_execution_calibrations','dc'+id)},outcome,directionalSpin:outcome==='CONTACT'?20:null});
const a=member('one',5,'CONTACT'),b=member('two',7,'MISS');
const sourceMember=(m:typeof a)=>{const {outcome:_outcome,directionalSpin:_spin,...r}=m;return r};
const source={version:'spin_aim_qualification_source_v228',sourceId:'qual',sourceVersion:'v1',subject:{careerId:'c',playerId:'p',personId:'person',technique:'TOPSPIN'},
 masteryReference:ref('world_spin_mastery_v123','mastery'),bindingReference:domain.bindingReference,domain,criterion,
 cohort:{version:'closed_spin_trial_cohort_v228',start:{kind:'EARLIEST_AUTHENTIC_ELIGIBLE_AFTER_BINDING',worldRevision:5,commitmentReference:a.commitmentReference},
  end:{kind:'WORLD_REVISION_AT_CLOSURE',worldRevision:7,worldEventHash:h,worldPrefixHash:h},members:[sourceMember(a),sourceMember(b)],scopedMemberHash:hashScopedSpinAimMembersV228([sourceMember(a),sourceMember(b)])}};
it('V228-P01 includes misses in denominator and permits later range-external additions',()=>{
 const inventory={firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:12,members:[a,b],scopeComplete:true};
 const r=evaluateSpinAimQualificationV228(source,inventory);expect(r.status).toBe('CRITERION_MET_ONLY');expect(r.total).toBe(2);expect(r.successes).toBe(1);expect(r.successFraction).toBe(.5);
});
it('V228-P02 holds unresolved, missing members and duplicate pitch or conflicting hashes',()=>{
 const unresolved=member('two',7,'UNRESOLVED');const base={firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,scopeComplete:true};
 expect(evaluateSpinAimQualificationV228({...source,cohort:{...source.cohort,members:[sourceMember(a),sourceMember(unresolved)],scopedMemberHash:hashScopedSpinAimMembersV228([sourceMember(a),sourceMember(unresolved)])}},{...base,members:[a,unresolved]}).status).toBe('HOLD');
 expect(evaluateSpinAimQualificationV228(source,{...base,members:[a]}).status).toBe('HOLD');
 const duplicate={...b,identity:a.identity,physicalPitchReference:{...a.physicalPitchReference,sourceHash:'b'.repeat(64)}};
 expect(evaluateSpinAimQualificationV228({...source,cohort:{...source.cohort,members:[sourceMember(a),sourceMember(duplicate)],scopedMemberHash:hashScopedSpinAimMembersV228([sourceMember(a),sourceMember(duplicate)])}},{...base,members:[a,duplicate]}).reason).toBe('PITCH_IDENTITY_CONFLICT');
});

it('V228-P03 refuses a selected-only success set and enforces first eligible start',()=>{
 const only={...source,cohort:{...source.cohort,members:[sourceMember(a)],scopedMemberHash:hashScopedSpinAimMembersV228([sourceMember(a)])}};
 const inventory={firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,scopeComplete:true,members:[a,b]};
 expect(evaluateSpinAimQualificationV228(only,inventory).reason).toBe('MEMBER_SET_DIFFERS');
 expect(evaluateSpinAimQualificationV228(source,{...inventory,firstEligibleWorldRevision:4}).reason).toBe('START_BOUNDARY_DIFFERS');
 expect(evaluateSpinAimQualificationV228(source,{...inventory,closedWorldPrefixHash:'b'.repeat(64)}).status).toBe('HOLD');
});
it('V228-P04 fixed scope does not infer calibration or default numerical criterion',()=>{
 const inventory={firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,scopeComplete:true,members:[a,b]};
 for(const bad of [{...source,criterion:{...criterion,minimumIndependentTrials:0}},{...source,criterion:{...criterion,minimumIndependentTrials:1}},{...source,criterion:{...criterion,minimumDirectionalSpinRadPerSecond:0}},
  {...source,criterion:{...criterion,authority:'HUMAN_CALIBRATED'}},{...source,cohort:{...source.cohort,scopedMemberHash:'b'.repeat(64)}}])expect(()=>evaluateSpinAimQualificationV228(bad,inventory)).toThrow();
});

it('V228-P05 hashes finite domain floats by IEEE bits, preserving signed zero',async()=>{
 const { hashSpinAimDomainValueV228 }=await import('./SpinAimQualificationV228');
 expect(hashSpinAimDomainValueV228({x:0})).not.toBe(hashSpinAimDomainValueV228({x:-0}));
 expect(hashSpinAimDomainValueV228({a:1,b:2})).toBe(hashSpinAimDomainValueV228({b:2,a:1}));
 expect(()=>hashSpinAimDomainValueV228({x:NaN})).toThrow();
});

it('V228-P06 identity grouping is independent of object key order',()=>{
 const reordered={physicalPitchSourceId:'one',physicalPitchOwner:'pa_physical_v1_launches' as const,personId:'person',playerId:'p',careerId:'c',policy:'ONE_PER_PHYSICAL_PITCH' as const},
  duplicate={...b,identity:reordered,physicalPitchReference:{...a.physicalPitchReference,sourceHash:'b'.repeat(64)}},members=[sourceMember(a),sourceMember(duplicate)],
  altered={...source,cohort:{...source.cohort,members,scopedMemberHash:hashScopedSpinAimMembersV228(members)}};
 expect(evaluateSpinAimQualificationV228(altered,{firstEligibleWorldRevision:5,closedWorldRevision:7,closedWorldEventHash:h,closedWorldPrefixHash:h,currentWorldRevision:7,scopeComplete:true,members:[a,duplicate]}).reason).toBe('PITCH_IDENTITY_CONFLICT');
});
