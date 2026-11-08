import type { Vec3 } from '../../model/geometry';
import { multiplyQuaternions, normalizeQuaternion, rotateVectorByQuaternion, type Quaternion } from '../pitching/BaseballOrientation';
import { certifyReferenceQuaternionCubicV122 } from './ReferenceBatC1V122';
import { referenceWorldTickAtSourceV121 } from './ReferenceBatMotorV121';
import type { ReferenceBatKinematicsInputV1, ReferenceBatKinematicsMotionV1 } from './ReferenceBatKinematicsV1';

/** Resolved world-field SI boundary poses. They deliberately do NOT inherit
 * the reference's current-pitch registration/aim transform. Live resolves only
 * its known author/body frame before passing this Source. Durations use the
 * execution clock. No human pose or ability is inferred from a public grade. */
export type ReferenceBatEnvelopeV133 = Readonly<{
  version: 'reference_bat_envelope_v133'; sourceId: string;
  preparation: Readonly<{ durationSeconds: number; grip: Vec3; orientation: Quaternion }>;
  recovery: Readonly<{ durationSeconds: number; grip: Vec3; orientation: Quaternion }>;
}>;
export type ReferenceBatEnvelopeIntervalCertificateV154 = Readonly<{
  fromTick:number;throughTick:number;
  startPose:Readonly<{grip:Vec3;orientation:Quaternion}>;endPose:Readonly<{grip:Vec3;orientation:Quaternion}>;
  minimumQuaternionNorm:number;maximumGripSpeedMps:number;maximumAngularSpeedRadPerSecond:number;maximumSweetSpotSpeedMps:number;
  maximumGripAccelerationMps2:number;maximumAngularAccelerationRadPerSecond2:number;maximumSweetSpotAccelerationMps2:number;
}>;
export type ReferenceBatEnvelopeMetadataV133 = Readonly<{
  motionStartTickV133: number; motionThroughTickV133: number; executionEnvelopeSourceIdV133: string;
  intervalCertificatesV154?:Readonly<{preparation:ReferenceBatEnvelopeIntervalCertificateV154;
    measuredArc:ReferenceBatEnvelopeIntervalCertificateV154;recovery:ReferenceBatEnvelopeIntervalCertificateV154}>;
}>;
const fields = (v: unknown, keys: string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === keys.sort().join('|');
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw Error('reference bat envelope: ' + message); }
export function assertReferenceBatEnvelopeV133(raw: unknown): asserts raw is ReferenceBatEnvelopeV133 {
  const p = raw as ReferenceBatEnvelopeV133;
  assert(fields(p, ['version','sourceId','preparation','recovery']) && p.version === 'reference_bat_envelope_v133'
    && typeof p.sourceId === 'string' && p.sourceId.trim() && p.sourceId.length <= 200, 'invalid Source');
  for (const v of [p.preparation,p.recovery]) assert(fields(v, ['durationSeconds','grip','orientation'])
    && Number.isFinite(v.durationSeconds) && v.durationSeconds > 0 && v.durationSeconds <= 10
    && fields(v.grip, ['x','y','z']) && Object.values(v.grip).every(n => Number.isFinite(n) && Math.abs(n) <= 1e6)
    && fields(v.orientation, ['x','y','z','w']) && Object.values(v.orientation).every(Number.isFinite)
    && Math.abs(Math.hypot(v.orientation.x,v.orientation.y,v.orientation.z,v.orientation.w)-1) < 1e-6, 'invalid boundary pose or duration');
}

type Point = readonly number[];
type Cubic = readonly [Point,Point,Point,Point];
type Sample = ReturnType<ReferenceBatKinematicsMotionV1['sampleContinuous']>;
const vec = (v: Vec3) => [v.x,v.y,v.z], quat = (q: Quaternion) => [q.x,q.y,q.z,q.w];
const v3 = (p: Point): Vec3 => ({ x:p[0],y:p[1],z:p[2] }), q4 = (p: Point): Quaternion => ({ x:p[0],y:p[1],z:p[2],w:p[3] });
const add = (a: Point,b: Point) => a.map((n,i)=>n+b[i]), sub = (a: Point,b: Point) => a.map((n,i)=>n-b[i]);
const mul = (a: Point,s: number) => a.map(n=>n*s), dot = (a: Point,b: Point) => a.reduce((s,n,i)=>s+n*b[i],0);
const norm = (p: Point) => Math.hypot(...p), mix = (a: Point,b: Point,u: number) => a.map((n,i)=>n*(1-u)+b[i]*u);
const cross = (a: Vec3,b: Vec3): Vec3 => ({ x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x });
const copySample = (s: Sample,tick=s.tick): Sample => ({...s,tick,orientation:{...s.orientation},
  state:{pose:{grip:{...s.state.pose.grip},tip:{...s.state.pose.tip}},linearVelocity:{...s.state.linearVelocity},angularVelocity:{...s.state.angularVelocity}},
  sweetSpot:{...s.sweetSpot},sweetSpotVelocity:{...s.sweetSpotVelocity}});
/** A held, caller-validated author pose, independent of a pitch/forecast or a
 * future SWING/TAKE decision. This is also the Live non-executing stance. */
export function sampleAuthoredBatEnvelopePoseV133(pose: ReferenceBatEnvelopeV133['preparation'],length:number,sweetSpotT:number,tick:number,sourceTick:number): Sample {
  const zero=():Vec3=>({x:0,y:0,z:0}),grip={...pose.grip},orientation=normalizeQuaternion(pose.orientation),
    axis=rotateVectorByQuaternion({x:0,y:1,z:0},orientation);
  return {tick,sourceTick,orientation,state:{pose:{grip,tip:v3(add(vec(grip),mul(vec(axis),length)))},linearVelocity:zero(),angularVelocity:zero()},
    sweetSpot:v3(add(vec(grip),mul(vec(axis),length*sweetSpotT))),sweetSpotVelocity:zero()};
}
const curve = (c: Cubic,u: number) => mix(mix(mix(c[0],c[1],u),mix(c[1],c[2],u),u),mix(mix(c[1],c[2],u),mix(c[2],c[3],u),u),u);
const dc = (c: Cubic,s: number) => c.slice(1).map((p,i)=>mul(sub(p,c[i]),3/s));
const derivative = (c: Cubic,u: number,s: number) => { const d=dc(c,s);return mix(mix(d[0],d[1],u),mix(d[1],d[2],u),u); };
const speed = (c: Cubic,s: number) => Math.max(...dc(c,s).map(norm));
const acceleration = (c: Cubic,s: number) => { const d=dc(c,s);return Math.max(...d.slice(1).map((p,i)=>norm(mul(sub(p,d[i]),2/s)))); };
const controls = (a: Point,b: Point,va: Point,vb: Point,s: number): Cubic => [a,add(a,mul(va,s/3)),sub(b,mul(vb,s/3)),b];
const split = (c: Cubic): readonly [Cubic,Cubic] => {
  const a=mix(c[0],c[1],.5),b=mix(c[1],c[2],.5),d=mix(c[2],c[3],.5),e=mix(a,b,.5),f=mix(b,d,.5),m=mix(e,f,.5);
  return [[c[0],a,e,m],[m,f,d,c[3]]];
};
type Bounds = { gripSpeed:number; gripAcceleration:number; angularSpeed:number; angularAcceleration:number };
function bounds(g: Cubic,q: Cubic,s: number,depth: number): Bounds {
  if (depth) {
    const [ga,gb]=split(g),[qa,qb]=split(q),a=bounds(ga,qa,s/2,depth-1),b=bounds(gb,qb,s/2,depth-1);
    return { gripSpeed:Math.max(a.gripSpeed,b.gripSpeed),gripAcceleration:Math.max(a.gripAcceleration,b.gripAcceleration),
      angularSpeed:Math.max(a.angularSpeed,b.angularSpeed),angularAcceleration:Math.max(a.angularAcceleration,b.angularAcceleration) };
  }
  const n=certifyReferenceQuaternionCubicV122(q),d=speed(q,s);
  return { gripSpeed:speed(g,s),gripAcceleration:acceleration(g,s),angularSpeed:2*d/n,
    angularAcceleration:2*acceleration(q,s)/n+6*d*d/(n*n) };
}

/** The fully composed measured motor is the joint authority. These two finite
 * curves match its actual endpoint velocities; they are not impact recoil or
 * an anthropometric/reach certificate. Existing physics uses this sampler. */
export function withReferenceBatEnvelopeV133(input: ReferenceBatKinematicsInputV1,base: ReferenceBatKinematicsMotionV1): ReferenceBatKinematicsMotionV1 {
  if (!Object.hasOwn(input,'executionEnvelopeV133')) return base;
  const p=input.executionEnvelopeV133!;
  const first=input.frames[0],last=input.frames.at(-1)!,start=input.startTick,end=referenceWorldTickAtSourceV121(input,last.tick),
    from=start-p.preparation.durationSeconds*input.ticksPerSecond,through=end+p.recovery.durationSeconds*input.ticksPerSecond;
  assert(Number.isFinite(from) && from >= 0 && from < start && Number.isFinite(through) && through > end
    && through <= Number.MAX_SAFE_INTEGER && end > start, 'invalid finite execution clock');
  const length=base.batLengthM,radius=length*base.sweetSpotT;
  const hold=(pose:ReferenceBatEnvelopeV133['preparation'],tick:number,sourceTick:number)=>sampleAuthoredBatEnvelopePoseV133(pose,length,base.sweetSpotT,tick,sourceTick);
  const measuredStart=base.sampleAtSourceTick(first.tick,'outgoing'),measuredEnd=base.sampleAtSourceTick(last.tick,'incoming');
  const make=(a:Sample,b:Sample,seconds:number,preserveEnd:boolean)=>{
    let qa=quat(a.orientation),qb=quat(b.orientation);
    if(dot(qa,qb)<0){if(preserveEnd)qa=mul(qa,-1);else qb=mul(qb,-1);}
    const qdot=(s:Sample,q:Point)=>mul(quat(multiplyQuaternions({...s.state.angularVelocity,w:0},q4(q))),.5),
      g=controls(vec(a.state.pose.grip),vec(b.state.pose.grip),vec(a.state.linearVelocity),vec(b.state.linearVelocity),seconds),
      q=controls(qa,qb,qdot(a,qa),qdot(b,qb),seconds),minimumNorm=certifyReferenceQuaternionCubicV122(q),certificate=bounds(g,q,seconds,3);
    const beginning={...a,orientation:q4(qa)},ending={...b,orientation:q4(qb)};
    const sample=(tick:number):Sample=>{
      if(tick<=a.tick)return copySample(beginning,tick);if(tick>=b.tick)return copySample(ending,tick);
      const u=(tick-a.tick)/(b.tick-a.tick),r=curve(q,u),rd=derivative(q,u,seconds),n=norm(r),orientation=q4(mul(r,1/n)),
        dq=q4(mul(sub(rd,mul(r,dot(r,rd)/(n*n))),1/n)),w=multiplyQuaternions(dq,{x:-orientation.x,y:-orientation.y,z:-orientation.z,w:orientation.w}),
        angularVelocity={x:2*w.x,y:2*w.y,z:2*w.z},grip=v3(curve(g,u)),linearVelocity=v3(derivative(g,u,seconds)),axis=rotateVectorByQuaternion({x:0,y:1,z:0},orientation);
      return {tick,sourceTick:a.sourceTick,orientation,state:{pose:{grip,tip:v3(add(vec(grip),mul(vec(axis),length)))},linearVelocity,angularVelocity},
        sweetSpot:v3(add(vec(grip),mul(vec(axis),radius))),sweetSpotVelocity:v3(add(vec(linearVelocity),vec(cross(angularVelocity,v3(mul(vec(axis),radius))))))};
    };
    return {sample,minimumNorm,certificate,beginning,ending};
  };
  // The represented tick endpoints, not the requested duration, define this
  // curve's clock. At large ticks subtraction/addition can round a positive
  // duration to a different span. Controls, derivatives and certificates must
  // all use the same actual seconds as the sampler's normalized coordinate.
  const pre=make(hold(p.preparation,from,first.tick),measuredStart,(start-from)/input.ticksPerSecond,true),
    post=make(measuredEnd,hold(p.recovery,through,last.tick),(through-end)/input.ticksPerSecond,false),all=[pre.certificate,post.certificate];
  const sampleContinuous=(tick:number):Sample=>{
    assert(Number.isFinite(tick)&&tick>=0,'invalid observation tick');
    if(tick<start)return pre.sample(tick);if(tick===start)return copySample(measuredStart,tick);
    if(tick<end)return base.sampleContinuous(tick);if(tick===end)return copySample(measuredEnd,tick);return post.sample(tick);
  };
  const maxima={maximumGripSpeedMps:Math.max(base.maximumGripSpeedMps,...all.map(b=>b.gripSpeed)),
    maximumAngularSpeedRadPerSecond:Math.max(base.maximumAngularSpeedRadPerSecond,...all.map(b=>b.angularSpeed)),
    maximumSweetSpotSpeedMps:Math.max(base.maximumSweetSpotSpeedMps,...all.map(b=>b.gripSpeed+b.angularSpeed*radius)),
    maximumSweetSpotSpeedUpperBoundMps:Math.max(base.maximumSweetSpotSpeedUpperBoundMps,...all.map(b=>b.gripSpeed+b.angularSpeed*radius)),
    maximumGripAccelerationMps2:Math.max(base.maximumGripAccelerationMps2!,...all.map(b=>b.gripAcceleration)),
    maximumAngularAccelerationRadPerSecond2:Math.max(base.maximumAngularAccelerationRadPerSecond2!,...all.map(b=>b.angularAcceleration)),
    maximumSweetSpotAccelerationMps2:Math.max(base.maximumSweetSpotAccelerationMps2!,...all.map(b=>b.gripAcceleration+(b.angularAcceleration+b.angularSpeed**2)*radius))};
  assert(Object.values(maxima).every(Number.isFinite),'nonfinite continuous certificate');
  const pose=(s:Sample)=>Object.freeze({grip:Object.freeze({...s.state.pose.grip}),orientation:Object.freeze({...s.orientation})}),
    interval=(fromTick:number,throughTick:number,a:Sample,b:Sample,minimumQuaternionNorm:number,c:Bounds):ReferenceBatEnvelopeIntervalCertificateV154=>
      Object.freeze({fromTick,throughTick,startPose:pose(a),endPose:pose(b),minimumQuaternionNorm,
        maximumGripSpeedMps:c.gripSpeed,maximumAngularSpeedRadPerSecond:c.angularSpeed,
        maximumSweetSpotSpeedMps:c.gripSpeed+c.angularSpeed*radius,maximumGripAccelerationMps2:c.gripAcceleration,
        maximumAngularAccelerationRadPerSecond2:c.angularAcceleration,
        maximumSweetSpotAccelerationMps2:c.gripAcceleration+(c.angularAcceleration+c.angularSpeed**2)*radius}),
    // Read-only views of already computed certificates and endpoint poses.
    // This adds no sampling, curve fitting or change to the composite maxima.
    intervalCertificatesV154=Object.freeze({preparation:interval(from,start,pre.beginning,pre.ending,pre.minimumNorm,pre.certificate),
      measuredArc:Object.freeze({fromTick:start,throughTick:end,startPose:pose(measuredStart),endPose:pose(measuredEnd),
        minimumQuaternionNorm:base.minimumQuaternionNormV122!,maximumGripSpeedMps:base.maximumGripSpeedMps,
        maximumAngularSpeedRadPerSecond:base.maximumAngularSpeedRadPerSecond,maximumSweetSpotSpeedMps:base.maximumSweetSpotSpeedMps,
        maximumGripAccelerationMps2:base.maximumGripAccelerationMps2!,maximumAngularAccelerationRadPerSecond2:base.maximumAngularAccelerationRadPerSecond2!,
        maximumSweetSpotAccelerationMps2:base.maximumSweetSpotAccelerationMps2!}),
      recovery:interval(end,through,post.beginning,post.ending,post.minimumNorm,post.certificate)});
  return Object.freeze({...base,...maxima,minimumQuaternionNormV122:Math.min(base.minimumQuaternionNormV122!,pre.minimumNorm,post.minimumNorm),
    motionStartTickV133:from,motionThroughTickV133:through,executionEnvelopeSourceIdV133:p.sourceId,intervalCertificatesV154,sampleContinuous,
    sample:(tick:number)=>{assert(Number.isSafeInteger(tick),'invalid observation tick');return sampleContinuous(tick);},
    sampleAtSourceTick:(sourceTick:number,side:'incoming'|'outgoing'='outgoing')=>{
      assert(Number.isFinite(sourceTick)&&sourceTick>=first.tick&&sourceTick<=last.tick&&['incoming','outgoing'].includes(side),'invalid original source tick');
      return sourceTick===first.tick?copySample(measuredStart):sourceTick===last.tick?copySample(measuredEnd):base.sampleAtSourceTick(sourceTick,side);
    }});
}
