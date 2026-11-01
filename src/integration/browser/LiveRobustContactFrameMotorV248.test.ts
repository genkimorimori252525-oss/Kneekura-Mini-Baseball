import {expect,it} from 'vitest';
import {validateLiveRobustContactFrameMotorV248,validateLiveObservedRobustContactFrameTrialV248,resolveLiveRobustContactFrameMotorPracticeV248} from './LiveRobustContactFrameMotorV248';
import {validateLiveSpinMotorV239,evaluateLiveRobustContactFrameMotorPracticeV248} from './LiveSpinMotorPracticeV239';
import {validateLiveContactFrameMotorV244} from './LiveContactFrameMotorV244';
const h='a'.repeat(64),clip={id:'c',sourceSha256:h,bats:'R' as const},domain={plateZ:0,coordinateSystem:'LIVE_WORLD_METERS_V1' as const};
const motor={version:'live_robust_contact_frame_motor_v248' as const,motorId:'m',motorVersion:'v1',subjectId:'p',technique:'TOPSPIN' as const,clip,domain,policy:'finite_sigma_v247' as const,thresholds:{minimumComponent:1,minimumImprovement:1},maximumEvaluations:259,maximumSearchSamples:259*4096,provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'s',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
const request={version:'live_observed_robust_contact_frame_trial_v248' as const,subjectId:'p',technique:motor.technique,clip,domain,policy:motor.policy,thresholds:motor.thresholds,maximumEvaluations:259,maximumSearchSamples:259*4096};
it('validates strict robust declarations, clones and freezes, never accepts future or legacy fields',()=>{
 const m=validateLiveRobustContactFrameMotorV248(motor);expect(m).toEqual(motor);expect(m).not.toBe(motor);expect(Object.isFrozen(m.thresholds)).toBe(true);expect(validateLiveObservedRobustContactFrameTrialV248(request)).toEqual(request);
 for(const bad of [{...motor,delta:{x:0,y:0}},{...motor,seed:1},{...motor,actualFuture:{}},{...motor,maximumEvaluations:-1},{...motor,maximumSearchSamples:Infinity},{...motor,thresholds:{minimumComponent:0,minimumImprovement:1}}])expect(()=>validateLiveRobustContactFrameMotorV248(bad)).toThrow();
 expect(validateLiveObservedRobustContactFrameTrialV248({...request,maximumEvaluations:0,maximumSearchSamples:0}).maximumEvaluations).toBe(0);expect(()=>validateLiveObservedRobustContactFrameTrialV248({...request,seed:1})).toThrow();expect(()=>validateLiveSpinMotorV239(motor)).toThrow();expect(()=>validateLiveContactFrameMotorV244(motor)).toThrow();
});
it('resolves exact identity only in explicit practice',()=>{
 const x={mode:'PRACTICE_EXPLICIT' as const,subjectId:'p',technique:'TOPSPIN' as const,clip,domain,motors:[motor]};expect(resolveLiveRobustContactFrameMotorPracticeV248(x)).toMatchObject({status:'READY_PRACTICE',request,earnedQualification:false});
 expect(resolveLiveRobustContactFrameMotorPracticeV248({...x,mode:'EARNED'})).toMatchObject({reason:'EARNED_NOT_AUTHENTICATED'});expect(resolveLiveRobustContactFrameMotorPracticeV248({...x,motors:[motor,{...motor,motorId:'n'}]})).toMatchObject({reason:'AMBIGUOUS_MATCH'});expect(()=>resolveLiveRobustContactFrameMotorPracticeV248({...x,motors:[motor,{...motor,motorVersion:'v2'}]})).toThrow(/conflict/);
});
it('uses full V248 snapshot and retains the closed-set denominator',()=>{
 const o={configurationBinding:h,pitchOrdinal:1,pitchFingerprint:h},cohort={version:'live_spin_practice_cohort_v248' as const,scopeId:'s',motorId:'m',motorVersion:'v1',motorSnapshot:motor,opportunities:[o]};
 const criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,minimumIndependentTrials:1,minimumContactFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:1,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const};
 const trial={opportunity:o,motorId:'m',motorVersion:'v1',motorSnapshot:motor,outcome:'NO_TARGET' as const,normal:null,actual:null,direction:{requestedDegrees:null,normalDegrees:null,actualDegrees:null}};
 expect(evaluateLiveRobustContactFrameMotorPracticeV248({motor,cohort,criterion,trials:[trial]})).toMatchObject({status:'UNAVAILABLE',total:1,successes:0,earnedQualification:false});
 expect(evaluateLiveRobustContactFrameMotorPracticeV248({motor,cohort:{...cohort,motorSnapshot:{...motor,maximumEvaluations:258}},criterion,trials:[trial]})).toMatchObject({status:'HOLD',reason:'MOTOR_VERSION_PAYLOAD_DIFFERS'});
});
it('keeps unresolved trials on HOLD even when the fallback produced contact',()=>{
 const o={configurationBinding:h,pitchOrdinal:1,pitchFingerprint:h},cohort={version:'live_spin_practice_cohort_v248' as const,scopeId:'s',motorId:'m',motorVersion:'v1',motorSnapshot:motor,opportunities:[o]};
 const criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,minimumIndependentTrials:1,minimumContactFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:1,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const};
 const trial={opportunity:o,motorId:'m',motorVersion:'v1',motorSnapshot:motor,outcome:'UNRESOLVED' as const,normal:null,actual:null,direction:{requestedDegrees:null,normalDegrees:null,actualDegrees:null}};
 expect(evaluateLiveRobustContactFrameMotorPracticeV248({motor,cohort,criterion,trials:[trial]})).toMatchObject({status:'HOLD',reason:'UNRESOLVED',total:1,contacts:0});
});
it('compares paired robust contact without changing the motor snapshot',()=>{
 const o={configurationBinding:h,pitchOrdinal:2,pitchFingerprint:h},cohort={version:'live_spin_practice_cohort_v248' as const,scopeId:'s',motorId:'m',motorVersion:'v1',motorSnapshot:motor,opportunities:[o]},criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,minimumIndependentTrials:1,minimumContactFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:1,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const};
 const spin=(x:number)=>({velocityMps:{x:0,y:0,z:10},spinRadPerSecond:{x,y:0,z:0},bats:'R' as const}),trial={opportunity:o,motorId:'m',motorVersion:'v1',motorSnapshot:motor,outcome:'CONTACT' as const,normal:spin(0),actual:spin(3),direction:{requestedDegrees:0,normalDegrees:0,actualDegrees:0}};
 expect(evaluateLiveRobustContactFrameMotorPracticeV248({motor,cohort,criterion,trials:[trial]})).toMatchObject({status:'DIAGNOSTIC_CRITERION_MET',total:1,successes:1,earnedQualification:false});
});
