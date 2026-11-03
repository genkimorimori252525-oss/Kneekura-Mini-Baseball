import type {Vec3} from '../../model/geometry';
import type {ReferenceBatKinematicsInputV1} from './ReferenceBatKinematicsV1';
import type {BatterSwingState} from './BatBallContact';
import type {Quaternion} from '../pitching/BaseballOrientation';
import type {ReferenceBatAccelerationBoundsV122} from './ReferenceBatC1V122';

export type ReferenceAimCorrectionV121=Readonly<{availableTick:number;throughTick:number;offset:Vec3}>;
const finite=(n:number)=>Number.isFinite(n);
/** Integral of a C1, zero-to-one clock speed. The measured keys are untouched. */
export function referencePhaseSecondsV121(elapsed:number,ramp:number){
 if(elapsed<=0)return 0;
 if(ramp===0||elapsed>=ramp)return elapsed-ramp/2;
 const u=elapsed/ramp;return ramp*(u*u*u-u*u*u*u/2);
}
export function referenceElapsedSecondsV121(phase:number,ramp:number){
 if(ramp===0||phase>=ramp/2)return phase+ramp/2;
 if(phase<=0)return phase;
 let lo=0,hi=ramp;for(let n=0;n<56;n++){const mid=(lo+hi)/2;if(referencePhaseSecondsV121(mid,ramp)<phase)lo=mid;else hi=mid;}return (lo+hi)/2;
}
export function referenceWorldTickAtSourceV121(input:Pick<ReferenceBatKinematicsInputV1,'startTick'|'sourceTicksPerSecond'|'ticksPerSecond'|'playbackRate'|'motorRampSecondsV121'> & {frames:readonly {tick:number}[]},sourceTick:number){
 const phase=(sourceTick-input.frames[0].tick)/input.sourceTicksPerSecond/input.playbackRate;
 return input.startTick+referenceElapsedSecondsV121(phase,input.motorRampSecondsV121??0)*input.ticksPerSecond;
}
type Sample={tick:number;sourceTick:number;orientation:Quaternion;state:BatterSwingState;sweetSpot:Vec3;sweetSpotVelocity:Vec3};
type Motion={sample:(tick:number)=>Sample;sampleContinuous:(tick:number)=>Sample;sampleAtSourceTick:(tick:number,side?:'incoming'|'outgoing')=>Sample;
 maximumGripSpeedMps:number;maximumAngularSpeedRadPerSecond:number;maximumSweetSpotSpeedMps:number;maximumSweetSpotSpeedUpperBoundMps:number};
/** One observer/physics sampler; corrections begin only at their delivery time.
 * This bounds clock acceleration, not the unknown performer's joint torques.
 * The original measured segment derivatives can still jump at source keys. */
export function withReferenceMotorV121<T extends Motion>(input:ReferenceBatKinematicsInputV1,base:T):T{
 const ramp=input.motorRampSecondsV121??0,c=input.aimCorrectionV121;
 if(!finite(ramp)||ramp<0||ramp>10)throw Error('invalid reference motor ramp');
 if(c&&(![c.availableTick,c.throughTick].every(n=>Number.isSafeInteger(n)&&n>=input.startTick)||c.throughTick<=c.availableTick
  ||!c.offset||Object.keys(c).sort().join('|')!=='availableTick|offset|throughTick'||Object.keys(c.offset).sort().join('|')!=='x|y|z'
  ||!Object.values(c.offset).every(finite)||Math.hypot(c.offset.x,c.offset.y,c.offset.z)>3))throw Error('invalid delivered reference aim correction');
 if(ramp===0&&!c)return base;
 const rateAt=(tick:number)=>{const elapsed=(tick-input.startTick)/input.ticksPerSecond;if(ramp===0)return 1;
  const u=Math.max(0,Math.min(1,elapsed/ramp));return u*u*(3-2*u);};
 const adjust=(sample:Sample,tick:number):Sample=>{
  const rate=rateAt(tick),v=(p:Vec3):Vec3=>({x:p.x*rate,y:p.y*rate,z:p.z*rate}),
   duration=c?(c.throughTick-c.availableTick)/input.ticksPerSecond:1,u=c?Math.max(0,Math.min(1,(tick-c.availableTick)/(c.throughTick-c.availableTick))):0,
   w=u*u*(3-2*u),dw=c&&tick>c.availableTick&&tick<c.throughTick?6*u*(1-u)/duration:0,
   point=(p:Vec3):Vec3=>c?{x:p.x+c.offset.x*w,y:p.y+c.offset.y*w,z:p.z+c.offset.z*w}:p,
   velocity=(p:Vec3):Vec3=>{const q=v(p);return c?{x:q.x+c.offset.x*dw,y:q.y+c.offset.y*dw,z:q.z+c.offset.z*dw}:q;};
  return {...sample,tick,state:{pose:{grip:point(sample.state.pose.grip),tip:point(sample.state.pose.tip)},linearVelocity:velocity(sample.state.linearVelocity),angularVelocity:v(sample.state.angularVelocity)},sweetSpot:point(sample.sweetSpot),sweetSpotVelocity:velocity(sample.sweetSpotVelocity)};
 };
 const sampleContinuous=(tick:number)=>{
  if(!finite(tick)||tick<0)throw Error('invalid reference motor tick');
  if(Object.hasOwn(input,'executionEnvelopeV133')&&tick===referenceWorldTickAtSourceV121(input,input.frames.at(-1)!.tick))
   return adjust(base.sampleAtSourceTick(input.frames.at(-1)!.tick,'incoming'),tick);
  const mapped=ramp===0?tick:input.startTick+referencePhaseSecondsV121((tick-input.startTick)/input.ticksPerSecond,ramp)*input.ticksPerSecond;
  return adjust(base.sampleContinuous(mapped),tick);
 },extra=c?1.5*Math.hypot(c.offset.x,c.offset.y,c.offset.z)/((c.throughTick-c.availableTick)/input.ticksPerSecond):0;
 const accelerationBounds:Partial<ReferenceBatAccelerationBoundsV122>={};
 if(input.executionInterpolationV122==='cubic-c1'){
  const original=base as T&Partial<ReferenceBatAccelerationBoundsV122>,clockAcceleration=ramp>0?1.5/ramp:0,
   correctionAcceleration=c?6*Math.hypot(c.offset.x,c.offset.y,c.offset.z)/((c.throughTick-c.availableTick)/input.ticksPerSecond)**2:0;
  if(![original.maximumGripAccelerationMps2,original.maximumAngularAccelerationRadPerSecond2,original.maximumSweetSpotAccelerationMps2]
    .every(n=>typeof n==='number'&&finite(n)&&n>=0))throw Error('missing C1 reference acceleration certificate');
  Object.assign(accelerationBounds,{
   maximumGripAccelerationMps2:original.maximumGripAccelerationMps2!+base.maximumGripSpeedMps*clockAcceleration+correctionAcceleration,
   maximumAngularAccelerationRadPerSecond2:original.maximumAngularAccelerationRadPerSecond2!+base.maximumAngularSpeedRadPerSecond*clockAcceleration,
   maximumSweetSpotAccelerationMps2:original.maximumSweetSpotAccelerationMps2!+base.maximumSweetSpotSpeedMps*clockAcceleration+correctionAcceleration});
  if(!Object.values(accelerationBounds).every(n=>typeof n==='number'&&finite(n)))throw Error('nonfinite C1 reference motor acceleration bound');
 }
 return Object.freeze({...base,maximumSweetSpotSpeedMps:base.maximumSweetSpotSpeedMps+extra,maximumSweetSpotSpeedUpperBoundMps:base.maximumSweetSpotSpeedUpperBoundMps+extra,
  maximumGripSpeedMps:base.maximumGripSpeedMps+extra,...accelerationBounds,sampleContinuous,
  sample:(tick:number)=>{if(!Number.isSafeInteger(tick))throw Error('invalid reference motor tick');return sampleContinuous(tick);},
  sampleAtSourceTick:(sourceTick:number,side:'incoming'|'outgoing'='outgoing')=>{
   const tick=referenceWorldTickAtSourceV121(input,sourceTick);return adjust(base.sampleAtSourceTick(sourceTick,side),tick);
  }});
}
