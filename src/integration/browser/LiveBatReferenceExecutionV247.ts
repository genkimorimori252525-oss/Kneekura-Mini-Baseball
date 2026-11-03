import type {Vec3} from '../../core/model/geometry';
import {createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1} from '../../core/sim/contact/ReferenceBatKinematicsV1';
import {referenceElapsedSecondsV121,referenceWorldTickAtSourceV121} from '../../core/sim/contact/ReferenceBatMotorV121';
import {withReferenceImpactTrajectoryV1,type ImpactTrajectorySettingsV1} from '../../core/sim/contact/ReferenceBatImpactTrajectoryV1';
import {resolveMotorStart} from '../../core/world/psychology/batting/BattingTiming';
import {limitDirectionExecutionV153} from './LiveDirectionMotorV153';

type Limits=Parameters<typeof limitDirectionExecutionV153>[1];
/** Pre-error inputs only. No random draw, future flight, actual contact or selected execution time belongs in the recipe. */
export type LiveBatReferenceRecipeV247=Readonly<{
 originTick:number;decisionTick:number;decisionTimeSeconds:number;nominalArrivalSeconds:number;technicalTimingOffsetSeconds:number;
 latencySeconds?:number;startMode:'ENVELOPE'|'MOTOR'|'LEGACY';contactSourceTick:number;rampSeconds:number;
 reference:Omit<ReferenceBatKinematicsInputV1,'startTick'|'transform'> & Readonly<{rotation:ReferenceBatKinematicsInputV1['transform']['rotation']}>;
 normalCenter:Vec3;limits:Limits;impactTrajectory?:ImpactTrajectorySettingsV1;
}>;
export function buildLiveBatReferenceExecutionV247(recipe:LiveBatReferenceRecipeV247,sample:Readonly<{timingSeconds:number;aim:Vec3;actualSweetSpotT?:number}>,delta:Vec3){
 const r=recipe,tps=r.reference.ticksPerSecond,rate=r.reference.playbackRate;
 const desired=Math.max(.055,r.nominalArrivalSeconds+sample.timingSeconds+r.technicalTimingOffsetSeconds);
 const offset=desired-referenceElapsedSecondsV121((r.contactSourceTick-r.reference.frames[0].tick)/1e6/rate,r.rampSeconds);
 const plannedStartTick=r.originTick+Math.max(0,Math.round(offset*tps));
 const latency=Math.ceil((r.latencySeconds??0)*tps),envelope=r.reference.executionEnvelopeV133;
 const startTick=r.startMode==='ENVELOPE'?Math.max(plannedStartTick,r.decisionTick+latency+Math.ceil(envelope!.preparation.durationSeconds*tps))
  :r.startMode==='MOTOR'?resolveMotorStart(plannedStartTick,r.decisionTick,r.originTick,latency)
  :r.latencySeconds===undefined?plannedStartTick:Math.max(plannedStartTick,r.originTick+Math.ceil((r.decisionTimeSeconds+r.latencySeconds)*tps));
 const {rotation,...reference}=r.reference;
 const zero:ReferenceBatKinematicsInputV1={...reference,...(sample.actualSweetSpotT===undefined?{}:{sweetSpotT:sample.actualSweetSpotT}),startTick,transform:{rotation,translation:{x:0,y:0,z:0},scale:1}};
 const at=referenceWorldTickAtSourceV121(zero,r.contactSourceTick),point=createReferenceBatKinematicsV1(zero).sampleContinuous(at).sweetSpot;
 // Match V244's conditional additions, including its signed-zero behavior.
 const shifted=delta.x!==0||delta.y!==0||delta.z!==0?{x:delta.x===0?r.normalCenter.x:r.normalCenter.x+delta.x,y:delta.y===0?r.normalCenter.y:r.normalCenter.y+delta.y,z:delta.z===0?r.normalCenter.z:r.normalCenter.z+delta.z}:r.normalCenter;
 const center={x:shifted.x+sample.aim.x,y:shifted.y+sample.aim.y,z:shifted.z+sample.aim.z};
 const translated:ReferenceBatKinematicsInputV1={...zero,transform:{...zero.transform,translation:{x:center.x-point.x,y:center.y-point.y,z:center.z-point.z}}};
 const impact=r.impactTrajectory===undefined?translated:withReferenceImpactTrajectoryV1(translated,r.contactSourceTick,r.impactTrajectory);
 const saturation=limitDirectionExecutionV153(impact,r.limits),result=saturation.reference,motion=createReferenceBatKinematicsV1(result);
 return {reference:result,plannedStartTick,contactTick:referenceWorldTickAtSourceV121(result,r.contactSourceTick),temporalScale:saturation.temporalScale,motion,
  assumptions:{lateObservationIncluded:false,randomSweetSpotVariationIncluded:false} as const};
}
