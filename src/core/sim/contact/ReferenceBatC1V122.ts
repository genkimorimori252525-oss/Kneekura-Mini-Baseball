import type { Vec3 } from '../../model/geometry';
import { multiplyQuaternions, normalizeQuaternion, rotateVectorByQuaternion, type Quaternion } from '../pitching/BaseballOrientation';
import type { ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';

export type ReferenceBatAccelerationBoundsV122 = Readonly<{
  executionInterpolationV122: 'cubic-c1'; minimumQuaternionNormV122: number;
  maximumGripAccelerationMps2: number; maximumAngularAccelerationRadPerSecond2: number;
  maximumSweetSpotAccelerationMps2: number;
}>;
type Coordinates = readonly number[];
type Cubic = readonly [Coordinates, Coordinates, Coordinates, Coordinates];
const norm = (v: Coordinates) => Math.hypot(...v);
const add = (a: Coordinates, b: Coordinates) => a.map((v,i) => v+b[i]);
const sub = (a: Coordinates, b: Coordinates) => a.map((v,i) => v-b[i]);
const scale = (v: Coordinates, factor: number) => v.map(n => n*factor);
const mix = (a: Coordinates, b: Coordinates, u: number) => a.map((v,i) => v*(1-u)+b[i]*u);
const dot = (a: Coordinates, b: Coordinates) => a.reduce((sum,v,i) => sum+v*b[i],0);
const vector = (p: Vec3) => [p.x,p.y,p.z];
const asVector = (p: Coordinates): Vec3 => ({x:p[0],y:p[1],z:p[2]});
const quaternion = (q: Quaternion) => [q.x,q.y,q.z,q.w];
const asQuaternion = (q: Coordinates): Quaternion => ({x:q[0],y:q[1],z:q[2],w:q[3]});
const cross = (a: Vec3,b: Vec3): Vec3 => ({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const curve = (c: Cubic,u: number) => mix(mix(mix(c[0],c[1],u),mix(c[1],c[2],u),u),mix(mix(c[1],c[2],u),mix(c[2],c[3],u),u),u);
const derivativeControls = (c: Cubic,seconds: number) => c.slice(1).map((v,i) => scale(sub(v,c[i]),3/seconds));
const derivative = (c: Cubic,u: number,seconds: number) => {
  const d=derivativeControls(c,seconds);return mix(mix(d[0],d[1],u),mix(d[1],d[2],u),u);
};
const split = (c: Cubic): readonly [Cubic,Cubic] => {
  const a=mix(c[0],c[1],.5),b=mix(c[1],c[2],.5),d=mix(c[2],c[3],.5),e=mix(a,b,.5),f=mix(b,d,.5),m=mix(e,f,.5);
  return [[c[0],a,e,m],[m,f,d,c[3]]];
};
function assert(ok: unknown,message: string): asserts ok { if(!ok)throw Error('reference C1 execution: '+message); }

/** Convex-hull coordinate boxes enclose the ENTIRE Bezier polynomial. Exact
 * de Casteljau subdivision tightens the enclosure; no sampled minimum is used.
 * As in Held/PostImpact, an uncertified zero crossing rejects the command. */
export function certifyReferenceQuaternionCubicV122(controls: readonly (readonly number[])[]): number {
  assert(controls.length===4&&controls.every(v=>v.length===4&&v.every(Number.isFinite)),'invalid quaternion cubic');
  let budget=8192;
  const visit=(c:Cubic,depth:number):number=>{
    assert(--budget>=0,'quaternion norm proof work exhausted');
    const lower=norm(c[0].map((_,i)=>Math.max(Math.min(...c.map(v=>v[i])),0,-Math.max(...c.map(v=>v[i])))));
    const rounding=128*Number.EPSILON*(depth+1)*Math.max(1,...c.map(norm));
    if(lower>rounding)return lower-rounding;
    assert(depth<24,'quaternion norm may cross zero or cannot be certified');
    const [a,b]=split(c);return Math.min(visit(a,depth+1),visit(b,depth+1));
  };
  return visit(controls as Cubic,0);
}
const tangent = (values: readonly Coordinates[], ticks: readonly number[],ticksPerSecond:number,i:number,finiteEnvelope=false) => {
  if(i===0||i===values.length-1){
    if(!finiteEnvelope)return values[i].map(()=>0);
    const a=i===0?0:i-1,b=i===0?1:i;
    return scale(sub(values[b],values[a]),ticksPerSecond/(ticks[b]-ticks[a]));
  }
  return scale(sub(values[i+1],values[i-1]),ticksPerSecond/(ticks[i+1]-ticks[i-1]));
};
const controls = (a:Coordinates,b:Coordinates,va:Coordinates,vb:Coordinates,seconds:number):Cubic =>
  [a,add(a,scale(va,seconds/3)),sub(b,scale(vb,seconds/3)),b];
const accelerationBound = (c:Cubic,seconds:number) => {
  const d=derivativeControls(c,seconds);return Math.max(...d.slice(1).map((v,i)=>norm(scale(sub(v,d[i]),2/seconds))));
};

/** Author-declared execution interpolation, NOT a measured continuous
 * reconstruction. The caller validated the immutable source input. Positions
 * use shared central Hermite tangents, hemisphere-aligned quaternion cubics use
 * shared tangent-space derivatives, and endpoints join stationary holds in C1.
 * This supplies mathematical bounds, never an athlete's ability or authority. */
export function createReferenceBatC1V122(input: ReferenceBatKinematicsInputV1) {
  const frames=input.frames,first=frames[0],last=frames.at(-1)!,ticks=frames.map(f=>f.tick);
  const positions=frames.map(f=>vector(f.grip)),rotations:number[][]=[];
  frames.forEach(f=>{
    let q=quaternion(normalizeQuaternion(f.orientation));
    if(rotations.length&&dot(q,rotations.at(-1)!)<0)q=scale(q,-1);
    rotations.push(q);
  });
  const finiteEnvelope=Object.hasOwn(input,'executionEnvelopeV133');
  const positionTangents=positions.map((_,i)=>tangent(positions,ticks,input.sourceTicksPerSecond,i,finiteEnvelope));
  const rotationTangents=rotations.map((q,i)=>{
    const d=tangent(rotations,ticks,input.sourceTicksPerSecond,i,finiteEnvelope);return sub(d,scale(q,dot(q,d)));
  });
  const rotation=normalizeQuaternion(input.transform.rotation),length=input.batLengthM*input.transform.scale,radius=length*input.sweetSpotT;
  const segments=frames.slice(1).map((_,i)=>{
    const seconds=(ticks[i+1]-ticks[i])/input.sourceTicksPerSecond;assert(Number.isFinite(seconds)&&seconds>0,'invalid finite interval');
    const grip=controls(positions[i],positions[i+1],positionTangents[i],positionTangents[i+1],seconds);
    const orientation=controls(rotations[i],rotations[i+1],rotationTangents[i],rotationTangents[i+1],seconds);
    const minimumNorm=certifyReferenceQuaternionCubicV122(orientation);
    // Same polynomial derivative hull/norm inequalities as PostImpact. The
    // subdivision changes only certificates, never the execution curve.
    const bound=(g:Cubic,q:Cubic,duration:number,depth:number):{gripSpeed:number;gripAcceleration:number;angularSpeed:number;angularAcceleration:number}=>{
      if(depth){const [ga,gb]=split(g),[qa,qb]=split(q),a=bound(ga,qa,duration/2,depth-1),b=bound(gb,qb,duration/2,depth-1);
        return {gripSpeed:Math.max(a.gripSpeed,b.gripSpeed),gripAcceleration:Math.max(a.gripAcceleration,b.gripAcceleration),
          angularSpeed:Math.max(a.angularSpeed,b.angularSpeed),angularAcceleration:Math.max(a.angularAcceleration,b.angularAcceleration)};}
      const n=certifyReferenceQuaternionCubicV122(q),d=Math.max(...derivativeControls(q,duration).map(norm)),dd=accelerationBound(q,duration);
      return {gripSpeed:Math.max(...derivativeControls(g,duration).map(norm))*input.transform.scale*input.playbackRate,
        gripAcceleration:accelerationBound(g,duration)*input.transform.scale*input.playbackRate**2,
        angularSpeed:2*d/n*input.playbackRate,
        angularAcceleration:(2*dd/n+6*d*d/(n*n))*input.playbackRate**2};
    };
    return {grip,orientation,seconds,minimumNorm,bounds:bound(grip,orientation,seconds,3)};
  });
  const maximumGripSpeedMps=Math.max(...segments.map(s=>s.bounds.gripSpeed));
  const maximumAngularSpeedRadPerSecond=Math.max(...segments.map(s=>s.bounds.angularSpeed));
  const maximumGripAccelerationMps2=Math.max(...segments.map(s=>s.bounds.gripAcceleration));
  const maximumAngularAccelerationRadPerSecond2=Math.max(...segments.map(s=>s.bounds.angularAcceleration));
  const maximumSweetSpotSpeedMps=Math.max(...segments.map(s=>s.bounds.gripSpeed+s.bounds.angularSpeed*radius));
  const maximumSweetSpotAccelerationMps2=Math.max(...segments.map(s=>s.bounds.gripAcceleration
    +(s.bounds.angularAcceleration+s.bounds.angularSpeed**2)*radius));
  assert([maximumGripSpeedMps,maximumAngularSpeedRadPerSecond,maximumGripAccelerationMps2,maximumAngularAccelerationRadPerSecond2,
    maximumSweetSpotSpeedMps,maximumSweetSpotAccelerationMps2].every(Number.isFinite),'nonfinite continuous certificate');
  const sampleCoordinate=(sourceTick:number,atTick:number)=>{
    let grip:Coordinates,orientation:Coordinates,linear:Vec3={x:0,y:0,z:0},angular:Vec3={x:0,y:0,z:0};
    if(finiteEnvelope?sourceTick<first.tick||sourceTick>last.tick:sourceTick<=first.tick||sourceTick>=last.tick){const i=sourceTick<=first.tick?0:frames.length-1;grip=positions[i];orientation=rotations[i];}
    else {
      let lo=0,hi=segments.length-1;
      while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(frames[mid].tick<=sourceTick)lo=mid;else hi=mid-1;}
      const segment=segments[lo],u=(sourceTick-frames[lo].tick)/(frames[lo+1].tick-frames[lo].tick),r=curve(segment.orientation,u),rd=derivative(segment.orientation,u,segment.seconds),n=norm(r);
      grip=curve(segment.grip,u);orientation=scale(r,1/n);
      const qdot=scale(sub(rd,scale(r,dot(r,rd)/(n*n))),1/n),q=asQuaternion(orientation);
      const w=multiplyQuaternions(asQuaternion(qdot),{x:-q.x,y:-q.y,z:-q.z,w:q.w});
      linear=asVector(scale(vector(rotateVectorByQuaternion(asVector(derivative(segment.grip,u,segment.seconds)),rotation)),input.transform.scale*input.playbackRate));
      angular=asVector(scale(vector(rotateVectorByQuaternion({x:2*w.x,y:2*w.y,z:2*w.z},rotation)),input.playbackRate));
    }
    const worldGrip=asVector(add(vector(input.transform.translation),scale(vector(rotateVectorByQuaternion(asVector(grip),rotation)),input.transform.scale)));
    const worldOrientation=normalizeQuaternion(multiplyQuaternions(rotation,asQuaternion(orientation))),axis=rotateVectorByQuaternion({x:0,y:1,z:0},worldOrientation);
    return {tick:atTick,sourceTick:Math.max(first.tick,Math.min(last.tick,sourceTick)),orientation:worldOrientation,
      state:{pose:{grip:worldGrip,tip:asVector(add(vector(worldGrip),scale(vector(axis),length)))},linearVelocity:linear,angularVelocity:angular},
      sweetSpot:asVector(add(vector(worldGrip),scale(vector(axis),radius))),
      sweetSpotVelocity:asVector(add(vector(linear),vector(cross(angular,asVector(scale(vector(axis),radius))))))};
  };
  const sampleContinuous=(tick:number)=>{
    assert(Number.isFinite(tick)&&tick>=0,'invalid observation tick');
    return sampleCoordinate(first.tick+(tick-input.startTick)/input.ticksPerSecond*input.sourceTicksPerSecond*input.playbackRate,tick);
  };
  return Object.freeze({authority:'SAMPLED_RIGID_REFERENCE_RESEARCH' as const,nativeAdmission:false as const,officialResult:null,
    provenance:Object.freeze({...input.provenance}),batLengthM:length,sweetSpotT:input.sweetSpotT,executionInterpolationV122:'cubic-c1' as const,
    minimumQuaternionNormV122:Math.min(...segments.map(s=>s.minimumNorm)),maximumGripSpeedMps,maximumAngularSpeedRadPerSecond,
    maximumSweetSpotSpeedMps,maximumSweetSpotSpeedUpperBoundMps:maximumSweetSpotSpeedMps,
    maximumGripAccelerationMps2,maximumAngularAccelerationRadPerSecond2,maximumSweetSpotAccelerationMps2,sampleContinuous,
    sample:(tick:number)=>{assert(Number.isSafeInteger(tick),'invalid observation tick');return sampleContinuous(tick);},
    sampleAtSourceTick:(sourceTick:number,side:'incoming'|'outgoing'='outgoing')=>{
      assert(Number.isFinite(sourceTick)&&sourceTick>=0&&['incoming','outgoing'].includes(side),'invalid source tick');
      return sampleCoordinate(sourceTick,input.startTick+(sourceTick-first.tick)/input.sourceTicksPerSecond/input.playbackRate*input.ticksPerSecond);
    }});
}
