import { expect, it } from 'vitest';
import { fixture } from './BattingFixtures.test-support';
import { measuredFixture } from './MeasuredBattingFixtures.test-support';
import { calculateObservedBattingMotorPlanV1, type BattingMotorPlanInputV1 } from './BattingMotorPlanV1';
import { findAerodynamicPitchPlateCrossing } from '../../../sim/pitching/AerodynamicPitchTrajectory';
import { calculateObservedSpinAimTrialV226 } from './ObservedSpinAimTrialV226';
function input(measured=false){const r=measured?measuredFixture():fixture(),s=r.source,p=s.predictions[1];
 const base:BattingMotorPlanInputV1={decisionTick:r.currentFrame.time.tick,aggression:r.acceptedExecution.proposal.inputs.swingAggression,
  geometry:{handedness:s.handedness,centerOfMass:s.centerOfMass,batPhysical:s.batPhysical,plateZ:s.plateZ,strikeZone:s.strikeZone,bodyReadyTick:s.bodyReadyTick,latestMotorStartTick:s.latestMotorStartTick},
  motor:{motorLatencyTicks:s.motorLatencyTicks,technicalTimingOffsetTicks:s.technicalTimingOffsetTicks,maximumSweetSpotSpeedMps:s.maximumSweetSpotSpeedMps},
  repertoire:{repertoireId:s.repertoireId,repertoireVersion:s.repertoireVersion,profiles:s.profiles,...(s.sampledProfiles?{sampledProfiles:s.sampledProfiles}:{})},
  forecast:{observedTick:p.observedTick,availableTick:p.availableTick,validUntilTick:p.validUntilTick,trajectory:p.trajectory}};
 const chosen=base.repertoire.profiles.filter(p=>p.minimumAggression<=base.aggression).at(-1)!.profile;
 return {version:'observed_spin_aim_trial_v226' as const,base,selectedProfile:{profileId:chosen.profileId,version:chosen.version},
  pair:{anchor:{x:0,y:1,z:0},target:{x:0,y:1,z:0}},transform:'PLATE_XY_TRANSLATION_V1' as const,
  trace:{sourceId:'test',observationIds:['obs-a','obs-b'],cutoffTick:base.decisionTick,coordinateSystem:'NATIVE_RBOX_METERS_V1' as const}};
}
it('V226 zero aim reproduces the entire original course-aware motor and never mutates input',()=>{
 const x=input(),before=structuredClone(x),old=calculateObservedBattingMotorPlanV1(x.base),result=calculateObservedSpinAimTrialV226(x);
 expect(old.ok).toBe(true);expect(result.ok).toBe(true);if(!old.ok||!result.ok)throw Error('planning failed');
 expect(result.value.plan).toEqual(old.value);expect(x).toEqual(before);expect(result.value.trace.authority).toBe('UNCALIBRATED_EXPLICIT_TRIAL');expect(result.value.trace.futureTransferProven).toBe(false);
});
it('V226 translated aim changes motor while preserving the neutral forecast and contact-depth crossing time',()=>{
 const x=input();x.pair.target.y=1.02;const before=structuredClone(x),result=calculateObservedSpinAimTrialV226(x),old=calculateObservedBattingMotorPlanV1(x.base);
 expect(result.ok&&old.ok).toBe(true);if(!result.ok||!old.ok)throw Error('planning failed');expect(result.value.plan).not.toEqual(old.value);
 expect(result.value.trace.aimedContact.z).toBe(result.value.trace.neutralContact.z);
 expect(result.value.trace.aimedContact.y).toBe(result.value.trace.neutralContact.y+(1.02-1));
 const crossing=findAerodynamicPitchPlateCrossing(x.base.forecast.trajectory,x.base.geometry.centerOfMass.z+result.value.trace.contactDepthM);
 expect(crossing).not.toBeNull();expect(result.value.trace.contactTick).toBe(crossing!.tick);expect(result.value.trace.neutralContact).toEqual(crossing!.position);
 expect(result.value.trace.contactTick).toBeGreaterThan(x.base.decisionTick);expect(x).toEqual(before);
});
it('V226 rejects unsupported geometry, unavailable observations, unknown metadata and measured profile',()=>{
 const edits=[(v:any)=>v.pair.target.z=.01,(v:any)=>v.transform='other',(v:any)=>v.trace.cutoffTick=v.base.decisionTick+1,
  (v:any)=>v.base.forecast.availableTick=v.base.decisionTick+1,(v:any)=>v.pair.target.y=NaN,(v:any)=>v.extra=true,
  (v:any)=>v.trace.observationIds=[],(v:any)=>v.trace.observationIds=['x','x'],(v:any)=>v.trace.extra=true,
  (v:any)=>{v.base.decisionTick=600000;v.base.forecast.validUntilTick=700000;v.trace.cutoffTick=600000},(v:any)=>v.base.geometry.plateZ=-100];
 for(const edit of edits){const v=structuredClone(input());edit(v);expect(calculateObservedSpinAimTrialV226(v).ok).toBe(false)}
 expect(calculateObservedSpinAimTrialV226(input(true)).ok).toBe(false);
});

it('V226 shares latency, missed-window and speed-envelope outcomes with the original finalizer',()=>{
 const first=calculateObservedSpinAimTrialV226(input());if(!first.ok||first.value.plan.status!=='READY')throw Error('fixture unavailable');
 const start=first.value.plan.motion.motorStartTick;if(start===null)throw Error('missing start');
 const x=structuredClone(input());Object.assign(x.base.geometry,{bodyReadyTick:start+30000});
 const delayed=calculateObservedSpinAimTrialV226(x),old=calculateObservedBattingMotorPlanV1(x.base);
 expect(delayed.ok&&old.ok).toBe(true);if(!delayed.ok||!old.ok||delayed.value.plan.status!=='READY')throw Error('delayed fixture unavailable');
 expect(delayed.value.plan).toEqual(old.value);expect(delayed.value.plan.motion.motorDelayTicks).toBe(30000);
 const delayedStart=delayed.value.plan.motion.motorStartTick;if(delayedStart===null)throw Error('missing delayed start');
 Object.assign(x.base.geometry,{latestMotorStartTick:delayedStart-1});
 const missed=calculateObservedSpinAimTrialV226(x);expect(missed.ok).toBe(true);if(!missed.ok)throw Error('missed fixture invalid');
 expect(missed.value.plan).toEqual({status:'MOTOR_WINDOW_MISSED',motion:null});
 const tooFast=structuredClone(input());Object.assign(tooFast.base.motor,{maximumSweetSpotSpeedMps:1});expect(calculateObservedSpinAimTrialV226(tooFast).ok).toBe(false);
});

it('V226-RBOX rejects left-handed input until a matching coordinate contract exists',()=>{
 const value=structuredClone(input());Object.assign(value.base.geometry,{handedness:'L'});
 expect(calculateObservedSpinAimTrialV226(value).ok).toBe(false);
});
