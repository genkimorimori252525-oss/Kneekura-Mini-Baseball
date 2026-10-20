import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { multiplyQuaternions,type Quaternion } from '../pitching/BaseballOrientation';
import { createReferenceBatKinematicsV1,type ReferenceBatKinematicsInputV1 } from './ReferenceBatKinematicsV1';
import { validateInitialHeldBatV1,sampleInitialHeldBatV1,type InitialHeldBatV1,type InitialHeldBatBodyV1 } from './InitialHeldBatV1';
import { createMeasuredPelvisControlV1,type MeasuredPelvisControlV1 } from './MeasuredPelvisControlV1';

export type HeldToMeasuredBatControlV1=Readonly<{
  version:'held_to_measured_bat_control_v1';initial:InitialHeldBatV1;bridgeStartTick:number;throughTick:number;
  measured:ReferenceBatKinematicsInputV1;body:InitialHeldBatBodyV1;maximumSweetSpotSpeedMps:number;
}>;
export type CoupledHeldMeasuredBatBodyControlV1=Readonly<{
  version:'coupled_held_measured_bat_body_control_v1';bat:HeldToMeasuredBatControlV1;body:MeasuredPelvisControlV1;
  bodyObstacleIndex:number;footObstacleIndices:readonly [number,number];maximumLegReachM:number;
}>;
type MovingBody=Readonly<{motion:ReturnType<typeof createMeasuredPelvisControlV1>;index:number;
  feet:readonly [number,number];legReach:number}>;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('held to measured bat: '+message);}
const norm=(v:readonly number[])=>Math.hypot(...v),mix=(a:readonly number[],b:readonly number[],t:number)=>a.map((n,i)=>n*(1-t)+b[i]*t);
const subtract=(a:readonly number[],b:readonly number[])=>a.map((n,i)=>n-b[i]);
const scaled=(a:readonly number[],n:number)=>a.map(x=>x*n);
const vector=(v:Vec3)=>[v.x,v.y,v.z],quat=(q:Quaternion)=>[q.x,q.y,q.z,q.w];
const asVector=(v:readonly number[]):Vec3=>({x:v[0],y:v[1],z:v[2]}),asQuat=(v:readonly number[]):Quaternion=>({x:v[0],y:v[1],z:v[2],w:v[3]});
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const curve=(c:readonly (readonly number[])[],u:number)=>{
  const a=mix(c[0],c[1],u),b=mix(c[1],c[2],u),d=mix(c[2],c[3],u);return mix(mix(a,b,u),mix(b,d,u),u);
};
const derivative=(c:readonly (readonly number[])[],u:number,seconds:number)=>{
  const a=subtract(c[1],c[0]),b=subtract(c[2],c[1]),d=subtract(c[3],c[2]);return scaled(mix(mix(a,b,u),mix(b,d,u),u),3/seconds);
};
const speedBound=(c:readonly (readonly number[])[],seconds:number)=>Math.max(...c.slice(1).map((v,i)=>norm(subtract(v,c[i]))*3/seconds));
const split=(c:readonly (readonly number[])[])=>{
  const a=mix(c[0],c[1],.5),b=mix(c[1],c[2],.5),d=mix(c[2],c[3],.5),e=mix(a,b,.5),f=mix(b,d,.5),m=mix(e,f,.5);
  return [[c[0],a,e,m],[m,f,d,c[3]]];
};
/** A convex-hull lower norm bound, subdivided when the initial hull contains
 * zero. Failure to certify is a rejection, never quaternion/pose correction. */
const minimumNorm=(controls:readonly (readonly number[])[])=>{
  let budget=8192;
  const visit=(c:readonly (readonly number[])[],depth:number):number=>{
    assert(--budget>=0,'quaternion certificate work exhausted');
    const lower=Math.hypot(...c[0].map((_,i)=>Math.max(Math.min(...c.map(v=>v[i])),0,-Math.max(...c.map(v=>v[i])))));
    if(lower>0)return lower;
    assert(depth<20,'bridge quaternion may cross zero or is uncertified');const [a,b]=split(c);return Math.min(visit(a,depth+1),visit(b,depth+1));
  };return visit(controls,0);
};

/** One explicit kinematic approach into the ORIGINAL measured curve. Grip is
 * cubic Hermite; orientation is a normalized quaternion cubic with matching
 * endpoint angular velocities. No measured key, rate, scale or registration
 * is changed. The original inter-key model still has velocity jumps; no muscle
 * torque or exact measured continuous motion is claimed. Native adoption is
 * a separate owner obligation. */
export function createHeldToMeasuredBatControlV1(raw:HeldToMeasuredBatControlV1){
  return buildHeldToMeasuredBatControl(raw);
}

/** Replaces one explicitly identified stationary body sphere with its
 * continuous hip-proxy motion. Every original sphere/radius is retained;
 * feet keep their original commands. This is a geometric preparation, not
 * execution ownership, measured COM, force balance or torque calibration. */
export function createCoupledHeldMeasuredBatBodyControlV1(raw:CoupledHeldMeasuredBatBodyControlV1){
  const p=cloneInert(raw);
  assert(fields(p,['version','bat','body','bodyObstacleIndex','footObstacleIndices','maximumLegReachM'])
    &&p.version==='coupled_held_measured_bat_body_control_v1'&&Number.isSafeInteger(p.bodyObstacleIndex)
    &&Array.isArray(p.footObstacleIndices)&&p.footObstacleIndices.length===2&&p.footObstacleIndices.every(Number.isSafeInteger)
    &&new Set([p.bodyObstacleIndex,...p.footObstacleIndices]).size===3&&Number.isFinite(p.maximumLegReachM)&&p.maximumLegReachM>0,'invalid coupled control');
  const motion=createMeasuredPelvisControlV1(p.body),b=p.bat,m=p.body.reference;
  assert(p.body.startTick===b.initial.startTick&&p.body.bridgeStartTick===b.bridgeStartTick&&p.body.throughTick===b.throughTick
    &&m.startTick===b.measured.startTick&&m.ticksPerSecond===b.measured.ticksPerSecond&&m.sourceTicksPerSecond===b.measured.sourceTicksPerSecond
    &&m.playbackRate===b.measured.playbackRate&&m.provenance.clipId===b.measured.provenance.clipId
    &&m.provenance.batSourceSha256===b.measured.provenance.sourceSha256&&m.frames.length===b.measured.frames.length
    &&m.frames.every((f,i)=>f.tick===b.measured.frames[i].tick)
    &&norm(subtract(vector(m.transform.translation),vector(b.measured.transform.translation)))===0
    &&norm(subtract(quat(m.transform.rotation),quat(b.measured.transform.rotation)))===0
    &&norm(subtract(vector(p.body.initialCenter),vector(b.body.bodyOrigin)))===0,'original bat/body registration or clock differs');
  const obstacle=b.body.obstacles[p.bodyObstacleIndex];
  assert(obstacle&&norm(subtract(vector(obstacle.center),vector(b.body.bodyOrigin)))===0
    &&p.footObstacleIndices.every(i=>i>=0&&i<b.body.obstacles.length),'original body or foot obstacle missing');
  const result=buildHeldToMeasuredBatControl(b,{motion,index:p.bodyObstacleIndex,feet:p.footObstacleIndices,legReach:p.maximumLegReachM});
  return Object.freeze({...result,input:freeze(p),batInput:result.input,sampleBodyContinuous:motion.sampleContinuous,
    certificate:freeze({...result.certificate,bodyCenterPolicy:'HIP_MIDPOINT_PROXY_NOT_MEASURED_COM' as const,
      originalObstacleCount:b.body.obstacles.length,bodySphereReplacedInPlace:true as const,
      footCommandsRetained:true as const,bodySpeedUpperBoundMps:motion.maximumSpeedMps,forceBalanceCalibrated:false as const})});
}

function buildHeldToMeasuredBatControl(raw:HeldToMeasuredBatControlV1,moving?:MovingBody){
  const p=cloneInert(raw);
  assert(fields(p,['version','initial','bridgeStartTick','throughTick','measured','body','maximumSweetSpotSpeedMps'])&&p.version==='held_to_measured_bat_control_v1','invalid control fields');
  validateInitialHeldBatV1(p.initial,p.body);const measured=createReferenceBatKinematicsV1(p.measured);
  const last=p.measured.frames.at(-1)!,first=p.measured.frames[0];
  const measuredEnd=p.measured.startTick+(last.tick-first.tick)/p.measured.sourceTicksPerSecond/p.measured.playbackRate*p.measured.ticksPerSecond;
  assert(p.measured.transform.scale===1&&p.measured.batLengthM===p.initial.batLengthM&&p.measured.ticksPerSecond===1e6
    &&Number.isSafeInteger(p.bridgeStartTick)&&p.bridgeStartTick>=p.initial.startTick&&p.bridgeStartTick<p.measured.startTick
    &&Number.isSafeInteger(p.throughTick)&&p.throughTick>p.measured.startTick&&p.throughTick<=p.initial.throughTick&&p.throughTick<measuredEnd
    &&Number.isFinite(p.maximumSweetSpotSpeedMps)&&p.maximumSweetSpotSpeedMps>0,'clock, original geometry, speed or finite lease differs');
  // Retire strictly BEFORE the sampled terminal hold: the incoming final
  // velocity must be handed to the next actual command, not snapped to rest.
  const start=sampleInitialHeldBatV1(p.initial,p.bridgeStartTick),target=measured.sample(p.measured.startTick),seconds=(p.measured.startTick-p.bridgeStartTick)/1e6;
  const grip0=vector(start.state.pose.grip),grip1=vector(target.state.pose.grip),v1=vector(target.state.linearVelocity);
  const grips=[grip0,grip0,subtract(grip1,scaled(v1,seconds/3)),grip1];
  const q0=quat(start.orientation);let q1=quat(target.orientation);
  if(q0.reduce((n,x,i)=>n+x*q1[i],0)<0)q1=scaled(q1,-1);
  const w=target.state.angularVelocity,qdot=scaled(quat(multiplyQuaternions({...w,w:0},asQuat(q1))),.5);
  const rotations=[q0,q0,subtract(q1,scaled(qdot,seconds/3)),q1],minimumQuaternionNorm=minimumNorm(rotations);
  // de Casteljau subdivision preserves the exact cubic. Derivative control
  // hulls and a strictly positive quaternion norm bound certify every time,
  // rather than adding unrelated whole-interval extrema or sampling speeds.
  const bridgeBounds=(g:readonly (readonly number[])[],q:readonly (readonly number[])[],duration:number,depth:number):{point:number;sweet:number}=>{
    if(depth===0){
      const linear=speedBound(g,duration),angular=2*speedBound(q,duration)/minimumNorm(q);
      return {point:linear+angular*(p.initial.batLengthM+p.initial.maximumBatRadiusM),sweet:linear+angular*p.initial.batLengthM*p.measured.sweetSpotT};
    }
    const [ga,gb]=split(g),[qa,qb]=split(q),a=bridgeBounds(ga,qa,duration/2,depth-1),b=bridgeBounds(gb,qb,duration/2,depth-1);
    return {point:Math.max(a.point,b.point),sweet:Math.max(a.sweet,b.sweet)};
  };
  const bridgeSpeed=bridgeBounds(grips,rotations,seconds,6);
  const maximumPointSpeedMps=Math.max(bridgeSpeed.point,
    measured.maximumGripSpeedMps+measured.maximumAngularSpeedRadPerSecond*(p.initial.batLengthM+p.initial.maximumBatRadiusM));
  const sweetSpeedUpperBoundMps=Math.max(bridgeSpeed.sweet,measured.maximumSweetSpotSpeedMps);
  assert(Number.isFinite(maximumPointSpeedMps)&&sweetSpeedUpperBoundMps<=p.maximumSweetSpotSpeedMps,
    'bridge or measured speed bound '+sweetSpeedUpperBoundMps+' exceeds original envelope '+p.maximumSweetSpotSpeedMps);
  const bodyOrigin=vector(p.body.bodyOrigin);
  const gripReach=Math.max(...grips.map(g=>norm(subtract(g,bodyOrigin))),...p.measured.frames.map(f=>norm(subtract(vector(measured.sampleContinuous(p.measured.startTick+(f.tick-first.tick)/p.measured.sourceTicksPerSecond/p.measured.playbackRate*1e6).state.pose.grip),bodyOrigin))));
  let handReachUpperBoundM=gripReach+p.initial.handReferenceFromKnobM;
  if(!moving)assert(handReachUpperBoundM<=p.body.maximumHandReachM,'whole control hand reach bound '+handReachUpperBoundM+' exceeds original reach '+p.body.maximumHandReachM);
  const sampleContinuous=(atTick:number)=>{
    assert(Number.isFinite(atTick)&&atTick>=p.initial.startTick&&atTick<=p.throughTick,'sample outside finite bat control');
    if(atTick<=p.bridgeStartTick)return {...sampleInitialHeldBatV1(p.initial,atTick),phase:'held' as const};
    if(atTick>=p.measured.startTick)return {...measured.sampleContinuous(atTick),phase:'measured' as const};
    const u=(atTick-p.bridgeStartTick)/(p.measured.startTick-p.bridgeStartTick),r=curve(rotations,u),rdot=derivative(rotations,u,seconds),length=norm(r);
    const projection=r.reduce((n,x,i)=>n+x*rdot[i],0)/(length*length);
    const q=asQuat(scaled(r,1/length)),dq=asQuat(scaled(subtract(rdot,scaled(r,projection)),1/length));
    const angular=multiplyQuaternions(dq,{x:-q.x,y:-q.y,z:-q.z,w:q.w});
    const grip=asVector(curve(grips,u)),linearVelocity=asVector(derivative(grips,u,seconds));
    // Derive axis from q directly, using the same +Y convention as the
    // original reference sampler. No extra orientation interpolation occurs.
    const axis={x:2*(q.x*q.y-q.w*q.z),y:1-2*(q.x*q.x+q.z*q.z),z:2*(q.y*q.z+q.w*q.x)};
    const tip={x:grip.x+axis.x*p.initial.batLengthM,y:grip.y+axis.y*p.initial.batLengthM,z:grip.z+axis.z*p.initial.batLengthM};
    return {tick:atTick,phase:'bridge' as const,orientation:q,state:{pose:{grip,tip},linearVelocity,angularVelocity:{x:2*angular.x,y:2*angular.y,z:2*angular.z}}};
  };
  // Continuous conservative max-radius capsule clearance against all supplied
  // non-holder obstacles. Bound the moving surface by its derived speed.
  let clearanceBudget=100000;
  const certify=(lo:number,hi:number,obstacle:InitialHeldBatBodyV1['obstacles'][number],index:number,depth=0):void=>{
    assert(--clearanceBudget>=0,'body clearance work exhausted');const mid=(lo+hi)/2,s=sampleContinuous(mid).state.pose;
    const axis=vector({x:(s.tip.x-s.grip.x)/p.initial.batLengthM,y:(s.tip.y-s.grip.y)/p.initial.batLengthM,z:(s.tip.z-s.grip.z)/p.initial.batLengthM});
    const body=moving?.index===index?moving.motion.sampleContinuous(mid):null;
    const delta=subtract(vector(body?.position??obstacle.center),vector(s.grip)),along=Math.max(0,Math.min(p.initial.batLengthM,delta.reduce((n,x,i)=>n+x*axis[i],0)));
    const gap=norm(subtract(delta,scaled(axis,along)))-obstacle.radiusM-p.initial.maximumBatRadiusM;
    if(gap>(maximumPointSpeedMps+(body?moving!.motion.maximumSpeedMps:0))*(hi-lo)/2/1e6)return;
    assert(gap>0&&depth<40&&mid!==lo&&mid!==hi,'bat/body collision or uncertified clearance at tick '+mid+', gap '+gap
      +', obstacle '+JSON.stringify(obstacle));
    certify(lo,mid,obstacle,index,depth+1);certify(mid,hi,obstacle,index,depth+1);
  };
  p.body.obstacles.forEach((obstacle,index)=>certify(p.bridgeStartTick,p.throughTick,obstacle,index));
  if(moving){
    let budget=100000;
    const sphere=p.body.obstacles[moving.index],bodySpeed=moving.motion.maximumSpeedMps;
    const certifyGap=(at:(tick:number)=>number,speed:number,lo=p.bridgeStartTick,hi=p.throughTick,depth=0):number=>{
      assert(--budget>=0,'coupled reach/clearance work exhausted');const mid=(lo+hi)/2,gap=at(mid),pad=speed*(hi-lo)/2/1e6;
      if(gap>pad)return gap-pad;
      assert(gap>0&&depth<40&&mid!==lo&&mid!==hi,'coupled body reach, ground or primitive clearance failed at '+mid+', gap '+gap);
      return Math.min(certifyGap(at,speed,lo,mid,depth+1),certifyGap(at,speed,mid,hi,depth+1));
    };
    const center=(t:number)=>vector(moving.motion.sampleContinuous(t).position);
    const hand=(t:number)=>{const s=sampleContinuous(t).state.pose;return s.grip&&vector({
      x:s.grip.x+(s.tip.x-s.grip.x)*p.initial.handReferenceFromKnobM/p.initial.batLengthM,
      y:s.grip.y+(s.tip.y-s.grip.y)*p.initial.handReferenceFromKnobM/p.initial.batLengthM,
      z:s.grip.z+(s.tip.z-s.grip.z)*p.initial.handReferenceFromKnobM/p.initial.batLengthM});};
    const handDistance=(t:number)=>norm(subtract(hand(t),center(t)));
    handReachUpperBoundM=p.body.maximumHandReachM-certifyGap(t=>p.body.maximumHandReachM-handDistance(t),maximumPointSpeedMps+bodySpeed);
    certifyGap(t=>handDistance(t)-sphere.radiusM-p.body.handRadiusM,maximumPointSpeedMps+bodySpeed);
    certifyGap(t=>center(t)[1]-sphere.radiusM,bodySpeed);
    p.body.obstacles.forEach((other,i)=>{if(i!==moving.index)
      certifyGap(t=>norm(subtract(center(t),vector(other.center)))-sphere.radiusM-other.radiusM,bodySpeed);});
    for(const i of moving.feet)certifyGap(t=>moving.legReach-norm(subtract(center(t),vector(p.body.obstacles[i].center))),bodySpeed);
  }
  return Object.freeze({input:freeze(p),certificate:freeze({kind:'held_to_measured_bat_certificate_v1' as const,
    bridgeEntryContinuity:'C1_RIGID_POSE' as const,minimumQuaternionNorm,handReachUpperBoundM,sweetSpeedUpperBoundMps,maximumPointSpeedMps,
    originalInterKeyVelocityJumpsRetained:true as const,terminalRestInvented:false as const,measuredKeysChanged:false as const,
    nativeAdmission:false as const,muscleTorqueCalibrated:false as const}),sampleContinuous});
}
