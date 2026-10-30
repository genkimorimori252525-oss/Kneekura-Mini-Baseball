import { expect,it } from 'vitest';
import { resolveLiveSpinMotorPracticeV239,evaluateLiveSpinMotorPracticeV239 } from './LiveSpinMotorPracticeV239';
const h='a'.repeat(64),clip={id:'obp-1',sourceSha256:h,bats:'R' as const},domain={plateZ:.15,coordinateSystem:'LIVE_WORLD_METERS_V1' as const};
const motor={version:'live_spin_xy_motor_v239' as const,motorId:'motor-top',motorVersion:'v1',subjectId:'player',technique:'TOPSPIN' as const,clip,domain,delta:{x:0,y:.01},
 provenance:{kind:'EXPLICIT_DIAGNOSTIC_UNCALIBRATED' as const,sourceId:'probe-one',sourceVersion:'v1',humanCalibration:'NOT_MEASURED' as const},trainingOpportunities:[]};
const opportunity=(pitchOrdinal:number)=>({configurationBinding:h,pitchOrdinal,pitchFingerprint:h}),ids=[opportunity(1),opportunity(2)];
const spin=(x:number)=>({velocityMps:{x:0,y:0,z:10},spinRadPerSecond:{x,y:0,z:0},bats:'R' as const});
const trial=(i:number,normal:number,actual:number)=>({opportunity:ids[i],motorId:motor.motorId,motorVersion:motor.motorVersion,motorSnapshot:motor,outcome:'CONTACT' as const,normal:spin(normal),actual:spin(actual),direction:{requestedDegrees:0,normalDegrees:0,actualDegrees:0}});
const cohort={version:'live_spin_practice_cohort_v239' as const,scopeId:'scope',motorId:motor.motorId,motorVersion:motor.motorVersion,motorSnapshot:motor,opportunities:ids},
 criterion={version:'live_spin_practice_criterion_v239' as const,authority:'EXPLICIT_UNCALIBRATED_PROJECT' as const,miss:'COUNT_FAILURE' as const,noTarget:'COUNT_FAILURE' as const,unresolved:'HOLD' as const,minimumIndependentTrials:2,minimumContactFraction:1,minimumDirectionalSpin:1,minimumDirectionalImprovement:1,minimumSuccessFraction:1};
it('V239 resolves only explicit practice and rejects same motor identity with changed payload',()=>{
 const x={mode:'PRACTICE_EXPLICIT' as const,subjectId:'player',technique:'TOPSPIN' as const,clip,domain,motors:[motor]};
 const selected=resolveLiveSpinMotorPracticeV239(x);expect(selected).toMatchObject({status:'READY_PRACTICE',earnedQualification:false,request:{version:'live_observed_spin_compose_trial_v238',delta:motor.delta}});
 expect(resolveLiveSpinMotorPracticeV239({...x,mode:'EARNED'})).toMatchObject({status:'NO_TARGET'});
 expect(()=>resolveLiveSpinMotorPracticeV239({...x,motors:[motor,{...motor,delta:{x:.1,y:0}}]})).toThrow(/conflict/);
});
it('V239 separates already-positive spin from improvement and never grants qualification',()=>{
 const result=evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:[trial(0,30,20),trial(1,10,20)]});
 expect(result).toMatchObject({status:'UNAVAILABLE',earnedQualification:false,total:2,contacts:2});expect(result.observations[0]).toMatchObject({absoluteDirectionalPositive:true,improvedDirectional:false});
 expect(result.observations[1]).toMatchObject({absoluteDirectionalPositive:true,improvedDirectional:true});
});
it('V239 holds missing criterion, duplicate/counterfactual identity, unresolved and training reuse',()=>{
 expect(evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion:null,trials:[trial(0,0,1),trial(1,0,1)]}).status).toBe('HOLD');
 expect(evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:[trial(0,0,1),trial(0,0,1)]}).status).toBe('HOLD');
 expect(evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:[trial(0,0,1)]}).status).toBe('HOLD');
 expect(evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:[trial(0,0,1),{...trial(1,0,1),outcome:'UNRESOLVED',actual:null}]}).status).toBe('HOLD');
 expect(evaluateLiveSpinMotorPracticeV239({motor:{...motor,trainingOpportunities:[ids[0]]},cohort,criterion,trials:[trial(0,0,1),trial(1,0,1)]}).status).toBe('HOLD');
});
it('V239 keeps miss and NO_TARGET in the explicit denominator and retains every trial',()=>{
 const all=[trial(0,0,4),{...trial(1,0,4),outcome:'NO_TARGET' as const,actual:null}],result=evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:all});
 expect(result).toMatchObject({status:'UNAVAILABLE',total:2,contacts:1,contactFraction:.5,successes:1,successFraction:.5});expect(result.trials).toEqual(all);expect(result.observations[1].outcome).toBe('NO_TARGET');
 const pending=evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion:null,trials:all});expect(pending).toMatchObject({status:'HOLD',reason:'CRITERION_MISSING'});expect(pending.trials).toEqual(all);
});
it('V239 rejects reusing one immutable motor ID for a different version',()=>{
 expect(()=>resolveLiveSpinMotorPracticeV239({mode:'PRACTICE_EXPLICIT',subjectId:'player',technique:'TOPSPIN',clip,domain,motors:[motor,{...motor,motorVersion:'v2'}]})).toThrow(/conflict/);
});
it('V239 measures each signed component independently in the existing local flight basis',()=>{
 for(const [technique,x,y] of [['BACKSPIN',-3,0],['TOPSPIN',3,0],['SLICE',0,3],['HOOK',0,-3]] as const){
  const fixed={...motor,motorId:'m-'+technique,technique},one={...cohort,motorId:fixed.motorId,motorSnapshot:fixed,opportunities:[ids[0]]},
   item={...trial(0,0,0),motorId:fixed.motorId,motorSnapshot:fixed,actual:{velocityMps:{x:0,y:0,z:10},spinRadPerSecond:{x,y,z:0},bats:'R' as const}},
   explicit={...criterion,minimumIndependentTrials:1},result=evaluateLiveSpinMotorPracticeV239({motor:fixed,cohort:one,criterion:explicit,trials:[item]});
  expect(result).toMatchObject({status:'DIAGNOSTIC_CRITERION_MET',earnedQualification:false,humanCalibration:'NOT_MEASURED'});expect(result.observations[0]).toMatchObject({absoluteDirectionalPositive:true,improvedDirectional:true});
 }
});
it('V239 rejects altered payload on old evaluation and counts no copied opportunity twice',()=>{
 const changed={...motor,delta:{x:.02,y:0}},result=evaluateLiveSpinMotorPracticeV239({motor:changed,cohort,criterion,trials:[trial(0,0,2),trial(1,0,2)]});
 expect(result).toMatchObject({status:'HOLD',reason:'MOTOR_VERSION_PAYLOAD_DIFFERS'});
 const duplicate={...trial(0,0,2),opportunity:{...ids[0],pitchFingerprint:'b'.repeat(64)}};
 expect(evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:[trial(0,0,2),duplicate]})).toMatchObject({status:'HOLD',reason:'OPPORTUNITY_CONFLICT'});
});
it('V239 rejects non-finite directional improvement instead of classifying overflow',()=>{
 expect(()=>evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion,trials:[trial(0,-1e308,1e308),trial(1,0,2)]})).toThrow(/overflow/);
});
it('V239 retains handed local slice and hook signs without converting the motion',()=>{
 for(const [technique,y] of [['SLICE',-3],['HOOK',3]] as const){const fixed={...motor,motorId:'left-'+technique,technique,clip:{...clip,bats:'L' as const}},one={...cohort,motorId:fixed.motorId,motorSnapshot:fixed,opportunities:[ids[0]]},
  vector=(sy:number)=>({velocityMps:{x:0,y:0,z:10},spinRadPerSecond:{x:0,y:sy,z:0},bats:'L' as const}),item={...trial(0,0,0),motorId:fixed.motorId,motorSnapshot:fixed,normal:vector(0),actual:vector(y)},
  result=evaluateLiveSpinMotorPracticeV239({motor:fixed,cohort:one,criterion:{...criterion,minimumIndependentTrials:1},trials:[item]});
  expect(result.observations[0]).toMatchObject({absoluteDirectionalPositive:true,improvedDirectional:true});expect(result.earnedQualification).toBe(false);
 }
});
it('V239 preserves the exact missing-criterion JSON contract',()=>{
 const result=evaluateLiveSpinMotorPracticeV239({motor,cohort,criterion:null,trials:[]});
 expect(JSON.stringify(result)).toBe(JSON.stringify({status:'HOLD',reason:'CRITERION_MISSING',total:2,contacts:0,successes:0,contactFraction:0,successFraction:0,observations:[],trials:[],cohortAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED',identityAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED',matchedNormalAuthority:'CALLER_DECLARED_NOT_AUTHENTICATED',earnedQualification:false,humanCalibration:'NOT_MEASURED'}));
});
