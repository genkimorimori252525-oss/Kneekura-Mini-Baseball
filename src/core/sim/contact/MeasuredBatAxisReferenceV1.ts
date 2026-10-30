import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { createReferenceBatKinematicsV1, type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { multiplyQuaternions, normalizeQuaternion, type Quaternion } from '../pitching/BaseballOrientation';

export type MeasuredBatAxisReferenceInputV1 = Omit<ReferenceBatKinematicsInputV1, 'frames'|'sweetSpotT'> & Readonly<{
  /** Points are already explicitly registered in the same metre coordinate frame. */
  frames: readonly Readonly<{ tick: number; handReference: Vec3; sweetSpot: Vec3 }>[];
  sweetSpotFromTipM: number; handReferenceFromKnobM: number; maximumHandResidualM: number;
}>;
const add = (a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub = (a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale = (a:Vec3,n:number):Vec3=>({x:a.x*n,y:a.y*n,z:a.z*n});
const norm = (a:Vec3)=>Math.hypot(a.x,a.y,a.z);
const dot = (a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross = (a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const fields = (value:unknown,names:readonly string[]) => !!value&&typeof value==='object'&&!Array.isArray(value)
  && Object.keys(value).sort().join('|')===[...names].sort().join('|');
const vector = (value:Vec3) => fields(value,['x','y','z'])&&Object.values(value).every(n=>Number.isFinite(n)&&Math.abs(n)<=1_000_000);
const freeze = <T>(value:T):T=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
function assert(value:unknown,message:string):asserts value {if(!value)throw new Error('Measured bat axis reference: '+message);}
const minimalTurn = (from:Vec3,to:Vec3,initial=false):Quaternion=>{
  const cosine=Math.max(-1,Math.min(1,dot(from,to))),axis=cross(from,to),sine=norm(axis);
  if(sine<=1e-12){
    if(cosine>=0)return {w:1,x:0,y:0,z:0};
    assert(initial,'antipodal source axes have no measured intermediate path');return {w:0,x:1,y:0,z:0};
  }
  // atan2 retains the tiny nonvertical component near pi; 1+dot loses it.
  const half=Math.atan2(sine,cosine)/2,vector=scale(axis,Math.sin(half)/sine);
  return normalizeQuaternion({w:Math.cos(half),...vector});
};

/** Bat-only research binding, not measured knob recovery or Native authority.
 * Sweet-spot keys stay measured. A declared rigid length/offset determines the
 * knob and tip; disagreement with the measured hand reference is reported and
 * bounded. Axial roll is unmeasured: minimum-rotation transport declares it.
 * Input points are never mirrored, resampled, filled or used to infer a body.
 */
export const createMeasuredBatAxisReferenceV1 = (raw:MeasuredBatAxisReferenceInputV1) => {
  const input=cloneInert(raw);
  assert(fields(input,['provenance','frames','batLengthM','sweetSpotFromTipM','handReferenceFromKnobM','maximumHandResidualM',
    'sourceTicksPerSecond','startTick','ticksPerSecond','playbackRate','transform'])
    &&Array.isArray(input.frames)&&input.frames.length>=2&&input.frames.length<=10_000,'invalid measured frames or fields');
  const length=input.batLengthM, radius=length-input.sweetSpotFromTipM;
  assert([length,input.sweetSpotFromTipM,input.handReferenceFromKnobM,input.maximumHandResidualM].every(Number.isFinite)
    &&length>0&&length<=2&&input.sweetSpotFromTipM>0&&radius>0
    &&input.handReferenceFromKnobM>=0&&input.handReferenceFromKnobM<radius
    &&input.maximumHandResidualM>=0&&input.maximumHandResidualM<=length,'invalid declared binding');
  let priorAxis:Vec3={x:0,y:1,z:0}, orientation:Quaternion={w:1,x:0,y:0,z:0};
  const residuals:number[]=[];
  const frames=input.frames.map((frame,index)=>{
    assert(fields(frame,['tick','handReference','sweetSpot'])&&vector(frame.handReference)&&vector(frame.sweetSpot),'missing measured point');
    const delta=sub(frame.sweetSpot,frame.handReference), distance=norm(delta);
    assert(Number.isFinite(distance)&&distance>1e-9,'zero measured bat axis');
    const axis=scale(delta,1/distance);
    orientation=normalizeQuaternion(multiplyQuaternions(minimalTurn(priorAxis,axis,index===0),orientation));priorAxis=axis;
    const grip=sub(frame.sweetSpot,scale(axis,radius));
    const residual=norm(sub(add(grip,scale(axis,input.handReferenceFromKnobM)),frame.handReference));
    assert(residual<=input.maximumHandResidualM,'hand reference residual exceeds the declared bound');residuals.push(residual);
    return {tick:frame.tick,grip,orientation};
  });
  const reference:ReferenceBatKinematicsInputV1={provenance:input.provenance,frames,batLengthM:length,sweetSpotT:radius/length,
    sourceTicksPerSecond:input.sourceTicksPerSecond,startTick:input.startTick,ticksPerSecond:input.ticksPerSecond,
    playbackRate:input.playbackRate,transform:input.transform};
  // Keep all original timeline, quaternion, transform and execution-rate gates.
  createReferenceBatKinematicsV1(reference);
  return freeze({reference,measurements:input.frames,handResidualsM:residuals,maximumHandResidualM:Math.max(...residuals),
    axialPhase:'DECLARED_MINIMUM_ROTATION_TRANSPORT' as const,nativeAdmission:false as const,officialResult:null});
};
