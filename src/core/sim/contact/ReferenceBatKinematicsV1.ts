import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { BatterSwingState } from './BatBallContact';
import { multiplyQuaternions, normalizeQuaternion, quaternionFromAxisAngle,
  rotateVectorByQuaternion, type Quaternion } from '../pitching/BaseballOrientation';
import { createImpactAdjustedReferenceMotionV1, type ReferenceImpactTrajectoryV1 } from './ReferenceBatImpactTrajectoryV1';

export type ReferenceBatKinematicsInputV1 = Readonly<{
  provenance: Readonly<{ clipId: string; sourceSha256: string }>;
  frames: readonly Readonly<{ tick: number; grip: Vec3; orientation: Quaternion }>[];
  batLengthM: number; sweetSpotT: number; sourceTicksPerSecond: number;
  startTick: number; ticksPerSecond: number; playbackRate: number;
  transform: Readonly<{ rotation: Quaternion; translation: Vec3; scale: number }>;
  impactTrajectory?: ReferenceImpactTrajectoryV1;
}>;
const add = (a: Vec3, b: Vec3): Vec3 => ({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub = (a: Vec3, b: Vec3): Vec3 => ({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale = (a: Vec3, n: number): Vec3 => ({x:a.x*n,y:a.y*n,z:a.z*n});
const cross = (a: Vec3, b: Vec3): Vec3 => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const magnitude = (a: Vec3) => Math.hypot(a.x,a.y,a.z);
const dot = (a: Vec3, b: Vec3) => a.x*b.x+a.y*b.y+a.z*b.z;
const fields = (a: unknown, names: string[]) => !!a && typeof a === 'object' && !Array.isArray(a)
  && Object.keys(a).sort().join('|') === names.sort().join('|');
const vec = (a: Vec3) => fields(a,['x','y','z']) && Object.values(a).every(v=>Number.isFinite(v)&&Math.abs(v)<=1_000_000);
const quat = (a: Quaternion) => fields(a,['x','y','z','w']) && Object.values(a).every(Number.isFinite)
  && Math.abs(Math.hypot(a.x,a.y,a.z,a.w)-1) < 1e-6;
const tick = (a: number) => Number.isSafeInteger(a) && a >= 0;
const zero = (): Vec3 => ({x:0,y:0,z:0});

/** Research-only sampled rigid path. It does not infer original performer rig,
 * contact timing, body reach, muscle torque, recoil, or Native Source ownership.
 * Grip is piecewise linear and orientation follows shortest constant-rate SO(3)
 * segments; velocity can jump at keys/endpoints. The importer retains measured
 * keys separately: interpolation between them is a declared mathematical model,
 * not an additional measurement or an exact continuous reconstruction. */
export const createReferenceBatKinematicsV1 = (raw: ReferenceBatKinematicsInputV1) => {
  const input = cloneInert(raw);
  if (!fields(input,['provenance','frames','batLengthM','sweetSpotT','sourceTicksPerSecond','startTick','ticksPerSecond','playbackRate','transform',
      ...(Object.hasOwn(input, 'impactTrajectory') ? ['impactTrajectory'] : [])])
    || !fields(input.provenance,['clipId','sourceSha256']) || !input.provenance.clipId?.trim()
    || !/^[0-9a-f]{64}$/.test(input.provenance.sourceSha256)
    || !Array.isArray(input.frames) || input.frames.length < 2 || input.frames.length > 10_000
    || ![input.batLengthM,input.sweetSpotT,input.sourceTicksPerSecond,input.ticksPerSecond,input.playbackRate].every(Number.isFinite)
    || input.batLengthM <= 0 || input.batLengthM > 2 || input.sweetSpotT < .65 || input.sweetSpotT > .9
    || !Number.isSafeInteger(input.sourceTicksPerSecond) || input.sourceTicksPerSecond <= 0 || input.sourceTicksPerSecond > 1_000_000_000
    || !Number.isSafeInteger(input.ticksPerSecond) || input.ticksPerSecond <= 0 || input.ticksPerSecond > 1_000_000_000
    || input.playbackRate < .01 || input.playbackRate > 20
    || !tick(input.startTick) || !fields(input.transform,['rotation','translation','scale'])
    || !quat(input.transform.rotation) || !vec(input.transform.translation)
    || !Number.isFinite(input.transform.scale) || input.transform.scale <= 0 || input.transform.scale > 10
    || input.frames.some((f,i) => !fields(f,['tick','grip','orientation']) || !tick(f.tick) || !vec(f.grip) || !quat(f.orientation)
      || i > 0 && f.tick <= input.frames[i-1].tick)) throw new Error('invalid sampled reference bat trajectory');
  const rotation = normalizeQuaternion(input.transform.rotation), length = input.batLengthM * input.transform.scale;
  const radius = length * input.sweetSpotT, speedScale = input.transform.scale * input.playbackRate;
  const frames = input.frames.map(f=>({...f,orientation:normalizeQuaternion(f.orientation)}));
  const segments = frames.slice(0,-1).map((one,i)=>{
    const two=frames[i+1], dt=(two.tick-one.tick)/input.sourceTicksPerSecond;
    let next=two.orientation;
    if (Object.keys(one.orientation).reduce((v,k)=>v+one.orientation[k as keyof Quaternion]*next[k as keyof Quaternion],0)<0)
      next={x:-next.x,y:-next.y,z:-next.z,w:-next.w};
    const q=normalizeQuaternion(multiplyQuaternions(next,{x:-one.orientation.x,y:-one.orientation.y,z:-one.orientation.z,w:one.orientation.w}));
    const sine=Math.hypot(q.x,q.y,q.z), angle=2*Math.atan2(sine,Math.max(0,q.w));
    const omega=sine<1e-12?zero():scale({x:q.x,y:q.y,z:q.z},angle/(sine*dt));
    const velocity=scale(sub(two.grip,one.grip),1/dt);
    const axis=rotateVectorByQuaternion({x:0,y:1,z:0},one.orientation);
    // Triangle inequality gives a continuous segment upper bound, including
    // translation/rotation interference; it is not a measured player ability.
    const speedBound=magnitude(velocity)*speedScale + magnitude(cross(omega,axis))*radius*input.playbackRate;
    const linear=scale(velocity,speedScale), rotational=scale(cross(omega,axis),radius*input.playbackRate);
    const omegaNorm=magnitude(omega), turnAxis=omegaNorm?scale(omega,1/omegaNorm):zero();
    const a=dot(linear,rotational), b=dot(linear,cross(turnAxis,rotational));
    const candidates=[0,angle], maximumPhase=Math.atan2(b,a);
    for(const phase of [maximumPhase,maximumPhase+2*Math.PI,maximumPhase-2*Math.PI])
      if(phase>=0&&phase<=angle)candidates.push(phase);
    const peak=Math.max(...candidates.map(phase=>a*Math.cos(phase)+b*Math.sin(phase)));
    const maximumSweetSpeed=Math.sqrt(Math.max(0,dot(linear,linear)+dot(rotational,rotational)+2*peak));
    return {one,two,dt,omega,velocity,speedBound,maximumSweetSpeed};
  });
  const first=frames[0], last=frames[frames.length-1];
  const sampleCoordinate = (sourceTick: number, atTick: number, side: 'incoming' | 'outgoing') => {
    let grip: Vec3, orientation: Quaternion, linear=zero(), angular=zero();
    if (sourceTick < first.tick || sourceTick > last.tick || sourceTick === first.tick && side === 'incoming' || sourceTick === last.tick && side === 'outgoing') {
      const frame=sourceTick <= first.tick?first:last; grip=frame.grip; orientation=frame.orientation;
    } else {
      let lo=0,hi=segments.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2); if(side==='incoming'?segments[mid].one.tick<sourceTick:segments[mid].one.tick<=sourceTick)lo=mid;else hi=mid-1;}
      const s=segments[lo], u=(sourceTick-s.one.tick)/(s.two.tick-s.one.tick);
      grip=add(s.one.grip,scale(sub(s.two.grip,s.one.grip),u));
      orientation=normalizeQuaternion(multiplyQuaternions(quaternionFromAxisAngle(s.omega,magnitude(s.omega)*s.dt*u),s.one.orientation));
      linear=scale(rotateVectorByQuaternion(s.velocity,rotation),speedScale);
      angular=scale(rotateVectorByQuaternion(s.omega,rotation),input.playbackRate);
    }
    const worldGrip=add(input.transform.translation,scale(rotateVectorByQuaternion(grip,rotation),input.transform.scale));
    const worldOrientation=normalizeQuaternion(multiplyQuaternions(rotation,orientation));
    const axis=rotateVectorByQuaternion({x:0,y:1,z:0},worldOrientation);
    const state: BatterSwingState={pose:{grip:worldGrip,tip:add(worldGrip,scale(axis,length))},linearVelocity:linear,angularVelocity:angular};
    return {tick:atTick,sourceTick:Math.max(first.tick,Math.min(last.tick,sourceTick)),orientation:worldOrientation,state,
      sweetSpot:add(worldGrip,scale(axis,radius)),sweetSpotVelocity:add(linear,cross(angular,scale(axis,radius)))};
  };
  const sampleContinuous = (atTick: number) => {
    if (!Number.isFinite(atTick)||atTick<0) throw new Error('invalid reference bat observation tick');
    const sourceTick=first.tick+(atTick-input.startTick)/input.ticksPerSecond*input.sourceTicksPerSecond*input.playbackRate;
    return sampleCoordinate(sourceTick,atTick,'outgoing');
  };
  /** Evaluate the original coordinate directly, without world/source floating
   * round trips or tolerance snapping. At a key, outgoing uses [key,next),
   * incoming uses (previous,key]; endpoint holds have zero velocity. Position
   * is continuous but these two explicitly chosen derivatives can differ. */
  const sampleAtSourceTick = (sourceTick: number, side: 'incoming' | 'outgoing' = 'outgoing') => {
    if (!Number.isFinite(sourceTick)||sourceTick<0||!['incoming','outgoing'].includes(side))throw new Error('invalid original reference source tick');
    const atTick=input.startTick+(sourceTick-first.tick)/input.sourceTicksPerSecond/input.playbackRate*input.ticksPerSecond;
    return sampleCoordinate(sourceTick,atTick,side);
  };
  const sample=(atTick:number)=>{if(!tick(atTick))throw new Error('invalid reference bat observation tick');return sampleContinuous(atTick);};
  return createImpactAdjustedReferenceMotionV1(input, Object.freeze({authority:'SAMPLED_RIGID_REFERENCE_RESEARCH' as const,nativeAdmission:false as const,officialResult:null,
    provenance:Object.freeze({...input.provenance}),batLengthM:length,sweetSpotT:input.sweetSpotT,
    maximumSweetSpotSpeedUpperBoundMps:Math.max(...segments.map(s=>s.speedBound)),
    maximumSweetSpotSpeedMps:Math.max(...segments.map(s=>s.maximumSweetSpeed)),
    maximumGripSpeedMps:Math.max(...segments.map(s=>magnitude(s.velocity)*speedScale)),
    maximumAngularSpeedRadPerSecond:Math.max(...segments.map(s=>magnitude(s.omega)*input.playbackRate)),sample,sampleContinuous,sampleAtSourceTick}));
};
