import { expect,it } from 'vitest';
import { validateLiveContactFrameMotorV244,validateLiveObservedContactFrameTrialV244,resolveLiveContactFrameMotorPracticeV244 } from './LiveContactFrameMotorV244';
import { evaluateLiveContactFrameMotorPracticeV244,validateLiveSpinMotorV239 } from './LiveSpinMotorPracticeV239';
const h='a'.repeat(64),clip={id:'clip',sourceSha256:h,bats:'R' as const},domain={plateZ:.15,coordinateSystem:'LIVE_WORLD_METERS_V1' as const};
const motor={version:'live_contact_frame_motor_v244' as const,motorId:'m',motorVersion:'v1',subjectId:'p',technique:'TOPSPIN' as const,clip,domain,policy:'FIXED_25_UNCALIBRATED_V243' as const,thresholds:{minimumComponent:1,minimumImprovement:1},provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'s',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
const request={version:'live_observed_contact_frame_trial_v244' as const,subjectId:motor.subjectId,technique:motor.technique,clip,domain,policy:motor.policy,thresholds:motor.thresholds};
const o=(pitchOrdinal:number)=>({configurationBinding:h,pitchOrdinal,pitchFingerprint:h}),ids=[o(1),o(2)];
const spin=(x:number)=>({velocityMps:{x:0,y:0,z:10},spinRadPerSecond:{x,y:0,z:0},bats:'R' as const});
const trial=(i:number,n:number,a:number)=>({opportunity:ids[i],motorId:'m',motorVersion:'v1',motorSnapshot:motor,outcome:'CONTACT' as const,normal:spin(n),actual:spin(a),direction:{requestedDegrees:0,normalDegrees:0,actualDegrees:0}});
const cohort={version:'live_spin_practice_cohort_v244' as const,scopeId:'scope',motorId:'m',motorVersion:'v1',motorSnapshot:motor,opportunities:ids};
const criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const,minimumIndependentTrials:2,minimumContactFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:1};
it('strictly separates contact-frame from XY schemas and freezes clones',()=>{
 const validated=validateLiveContactFrameMotorV244(motor);expect(validated).toEqual(motor);expect(validated).not.toBe(motor);expect(Object.isFrozen(validated.thresholds)).toBe(true);
 expect(Object.isFrozen(validateLiveObservedContactFrameTrialV244(request).clip)).toBe(true);
 for(const bad of [{...motor,delta:{x:0,y:0}},{...motor,version:'live_spin_xy_motor_v239'},{...motor,thresholds:{minimumComponent:0,minimumImprovement:1}},{...motor,thresholds:{minimumComponent:1,minimumImprovement:Infinity}}])expect(()=>validateLiveContactFrameMotorV244(bad)).toThrow();
 expect(()=>validateLiveSpinMotorV239(motor)).toThrow();expect(()=>validateLiveObservedContactFrameTrialV244({...request,delta:{x:0,y:0}})).toThrow();
});
it('resolves exact identity and refuses earned, ambiguity and conflicting IDs',()=>{
 const x={mode:'PRACTICE_EXPLICIT' as const,subjectId:'p',technique:'TOPSPIN' as const,clip,domain,motors:[motor]};
 expect(resolveLiveContactFrameMotorPracticeV244(x)).toMatchObject({status:'READY_PRACTICE',request,earnedQualification:false});
 expect(resolveLiveContactFrameMotorPracticeV244({...x,mode:'EARNED'})).toMatchObject({reason:'EARNED_NOT_AUTHENTICATED'});
 expect(resolveLiveContactFrameMotorPracticeV244({...x,subjectId:'other'})).toMatchObject({reason:'NO_MATCH'});
 expect(resolveLiveContactFrameMotorPracticeV244({...x,motors:[motor,{...motor,motorId:'n'}]})).toMatchObject({reason:'AMBIGUOUS_MATCH'});
 expect(()=>resolveLiveContactFrameMotorPracticeV244({...x,motors:[motor,{...motor,motorVersion:'v2'}]})).toThrow(/conflict/);
});
it('evaluates paired closed sets and holds mismatched snapshots',()=>{
 const run=(trials:ReturnType<typeof trial>[])=>evaluateLiveContactFrameMotorPracticeV244({motor,cohort,criterion,trials});
 expect(run([trial(0,0,3),trial(1,0,3)])).toMatchObject({status:'DIAGNOSTIC_CRITERION_MET',earnedQualification:false,total:2});
 expect(run([trial(0,4,3),trial(1,0,3)])).toMatchObject({status:'UNAVAILABLE',successes:1});
 expect(run([trial(0,0,3)])).toMatchObject({status:'HOLD',reason:'COHORT_INCOMPLETE'});
 expect(evaluateLiveContactFrameMotorPracticeV244({motor,cohort:{...cohort,motorSnapshot:{...motor,thresholds:{minimumComponent:2,minimumImprovement:1}}},criterion,trials:[]})).toMatchObject({status:'HOLD',reason:'MOTOR_VERSION_PAYLOAD_DIFFERS'});
});
it('rejects swapped schemas and holds reused training or changed trial snapshot',()=>{
 expect(()=>validateLiveContactFrameMotorV244({...motor,version:'live_spin_xy_motor_v239',delta:{x:0,y:0}})).toThrow();
 expect(()=>validateLiveObservedContactFrameTrialV244({...request,thresholds:{minimumComponent:-1,minimumImprovement:1}})).toThrow();
 const trained={...motor,trainingOpportunities:[ids[0]]};
 expect(evaluateLiveContactFrameMotorPracticeV244({motor:trained,cohort:{...cohort,motorSnapshot:trained},criterion,trials:[]})).toMatchObject({status:'HOLD',reason:'TRAINING_REUSE'});
 expect(evaluateLiveContactFrameMotorPracticeV244({motor,cohort,criterion,trials:[{...trial(0,0,3),motorSnapshot:{...motor,motorVersion:'v2'}}]})).toMatchObject({status:'HOLD',reason:'MOTOR_VERSION_PAYLOAD_DIFFERS'});
});
