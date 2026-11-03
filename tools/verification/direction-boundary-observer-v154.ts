import { createReferenceBatKinematicsV1 } from '../../src/core/sim/contact/ReferenceBatKinematicsV1';
import { normalizeQuaternion, multiplyQuaternions, quaternionFromAxisAngle } from '../../src/core/sim/pitching/BaseballOrientation';
import type { ObservedDirectionRegistrationInputV153 } from '../../src/core/sim/contact/ObservedDirectionRegistrationV153';
import { planObservedDirectionRegistrationV153 } from '../../src/core/sim/contact/ObservedDirectionRegistrationV153';

type Failure=Readonly<{rates:readonly Readonly<{rate:number;input:ObservedDirectionRegistrationInputV153;
  diagnostics:ReturnType<typeof planObservedDirectionRegistrationV153>['diagnostics']}>[]}>;
const sub=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const add=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const magnitude=(v:{x:number;y:number;z:number})=>Math.hypot(v.x,v.y,v.z);
const divide=(v:{x:number;y:number;z:number},s:number)=>({x:v.x/s,y:v.y/s,z:v.z/s});
const exact=(a:unknown,b:unknown):boolean=>Object.is(a,b)||!!a&&!!b&&typeof a==='object'&&typeof b==='object'
  &&Object.keys(a).join('|')===Object.keys(b).join('|')&&Object.keys(a).every(k=>exact((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));

/** Read-only replay of the exact nominal references captured on failure. This
 * exports no match/ball/rule engine and never changes a selected candidate. */
export function observeDirectionBoundaryV154(failure:Failure){
  const raw=failure.rates.flatMap((entry,rateIndex)=>entry.diagnostics.candidates.map((candidate,candidateIndex)=>({
    rateIndex,candidateIndex,rate:entry.rate,yawDegrees:candidate.yawDegrees,status:candidate.status,reason:candidate.reason,
    certificateSpeed:candidate.certificates?.maximumSweetSpotSpeedMps??null,
    intervals:candidate.certificates?.intervalCertificatesV154??null}))),
    usable=raw.filter(row=>row.certificateSpeed!==null&&row.intervals!==null),
    minimum=(values:typeof usable)=>values.reduce((a,b)=>a.certificateSpeed!<=b.certificateSpeed!?a:b),
    focus=usable.length?[minimum(usable),minimum(usable.filter(x=>x.rateIndex===usable[0].rateIndex)),
      minimum(usable.filter(x=>x.rateIndex===usable.at(-1)!.rateIndex))].filter((row,index,array)=>
        array.findIndex(other=>other.rateIndex===row.rateIndex&&other.candidateIndex===row.candidateIndex)===index):[];
  const details=focus.map(row=>{
    const entry=failure.rates[row.rateIndex],input=entry.input,candidate=entry.diagnostics.candidates[row.candidateIndex],
      rotation=normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle({x:0,y:1,z:0},row.yawDegrees*Math.PI/180),input.reference.transform.rotation)),
      rotated={...input.reference,transform:{...input.reference.transform,rotation}},
      pivot=createReferenceBatKinematicsV1(rotated).sampleAtSourceTick(input.contactSourceTick).sweetSpot,
      reference={...rotated,transform:{...rotated.transform,translation:add(rotated.transform.translation,sub(candidate.nominalTargetSweetSpot!,pivot))}},
      motion=createReferenceBatKinematicsV1(reference),intervals=motion.intervalCertificatesV154!;
    const sampled=Object.fromEntries(Object.entries(intervals).map(([name,bounds])=>{
      const duration=(bounds.throughTick-bounds.fromTick)/reference.ticksPerSecond,
        peaks={gripSpeed:0,angularSpeed:0,sweetSpotSpeed:0,gripAcceleration:0,angularAcceleration:0,sweetSpotAcceleration:0},
        fd={gripSpeed:0,sweetSpotSpeed:0},h=Math.min(1e-6,duration/10000),
        quaternionDot=Math.abs(bounds.startPose.orientation.x*bounds.endPose.orientation.x+bounds.startPose.orientation.y*bounds.endPose.orientation.y+
          bounds.startPose.orientation.z*bounds.endPose.orientation.z+bounds.startPose.orientation.w*bounds.endPose.orientation.w);
      for(let i=0;i<=256;i++){
        const tick=bounds.fromTick+(bounds.throughTick-bounds.fromTick)*i/256,s=motion.sampleContinuous(tick),
          lo=Math.max(bounds.fromTick,tick-h*reference.ticksPerSecond),hi=Math.min(bounds.throughTick,tick+h*reference.ticksPerSecond),
          a=motion.sampleContinuous(lo),b=motion.sampleContinuous(hi),dt=(hi-lo)/reference.ticksPerSecond;
        peaks.gripSpeed=Math.max(peaks.gripSpeed,magnitude(s.state.linearVelocity));peaks.angularSpeed=Math.max(peaks.angularSpeed,magnitude(s.state.angularVelocity));
        peaks.sweetSpotSpeed=Math.max(peaks.sweetSpotSpeed,magnitude(s.sweetSpotVelocity));
        if(dt>0){peaks.gripAcceleration=Math.max(peaks.gripAcceleration,magnitude(divide(sub(b.state.linearVelocity,a.state.linearVelocity),dt)));
          peaks.angularAcceleration=Math.max(peaks.angularAcceleration,magnitude(divide(sub(b.state.angularVelocity,a.state.angularVelocity),dt)));
          peaks.sweetSpotAcceleration=Math.max(peaks.sweetSpotAcceleration,magnitude(divide(sub(b.sweetSpotVelocity,a.sweetSpotVelocity),dt)));
          fd.gripSpeed=Math.max(fd.gripSpeed,magnitude(divide(sub(b.state.pose.grip,a.state.pose.grip),dt)));
          fd.sweetSpotSpeed=Math.max(fd.sweetSpotSpeed,magnitude(divide(sub(b.sweetSpot,a.sweetSpot),dt)));}
      }
      return [name,{durationSeconds:duration,gripDistanceMeters:magnitude(sub(bounds.endPose.grip,bounds.startPose.grip)),
        orientationDistanceRadians:2*Math.acos(Math.min(1,quaternionDot)),certificate:bounds,sampledPeaks:peaks,
        finiteDifferenceSpeedPeaks:fd,sampleCount:257,finiteDifferenceStepSeconds:h,
        samplerProvesContinuousMaximum:false}];
    }));
    return {...row,replayReference:reference,replayedIntervals:intervals,recordedIntervals:row.intervals,
      intervalReplayExact:exact(intervals,row.intervals),sampled};
  });
  return {authority:'READ_ONLY_NOMINAL_REFERENCE_ANALYSIS_NOT_NATIVE',selectionRule:'MINIMUM_CERTIFICATE_AND_FIRST_LAST_RATE_MINIMUM_NO_SEED_OR_WORLD_SEARCH',
    raw,details,physicalFeasibilityCertified:false};
}
