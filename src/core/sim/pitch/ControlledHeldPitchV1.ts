import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { advanceBaseballOrientation, normalizeQuaternion, type Quaternion } from '../pitching/BaseballOrientation';

type HandKnot=Readonly<{tick:number;handCenter:Vec3;handVelocity:Vec3}>;
export type ControlledHeldPitchV1=Readonly<{
  version:'controlled_held_pitch_v1';ticksPerSecond:1_000_000;initialOrientation:Quaternion;
  held:readonly (HandKnot&Readonly<{ballOffset:Vec3;ballOffsetVelocity:Vec3;spin:Vec3}>)[];
  followThrough:readonly HandKnot[];
}>;
export type ControlledHeldPitchAnchorsV1=Readonly<{
  initialBall:Readonly<{tick:number;position:Vec3;velocity:Vec3;spin:Vec3}>;
  initialHand:Readonly<{position:Vec3;velocity:Vec3}>;shoulder:Vec3;armReachM:number;
  handRadiusM:number;ballRadiusM:number;
  release:Readonly<{releaseAtUs:number;position:Vec3;velocity:Vec3;spin:Vec3}>;
  releaseAcceleration:Vec3;followThroughEndTick:number;
  obstacles:readonly Readonly<{center:Vec3;radiusM:number}>[];
}>;
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a:Vec3,n:number):Vec3=>({x:a.x*n,y:a.y*n,z:a.z*n});
const norm=(v:Vec3)=>Math.hypot(v.x,v.y,v.z);
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const vec=(v:Vec3)=>!!v&&Object.keys(v).sort().join('|')==='x|y|z'&&Object.values(v).every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6);
const fields=(v:unknown,keys:string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===keys.sort().join('|');
const equal=(a:Vec3,b:Vec3)=>a.x===b.x&&a.y===b.y&&a.z===b.z;
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('controlled held pitch: '+message);}
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const controls=(p:Vec3,v:Vec3,q:Vec3,w:Vec3,dt:number)=>[p,add(p,scale(v,dt/3)),sub(q,scale(w,dt/3)),q];
const midpoint=(a:Vec3,b:Vec3)=>scale(add(a,b),.5);
const interpolate=(p:Vec3,v:Vec3,q:Vec3,w:Vec3,seconds:number,u:number)=>{
  const c=controls(p,v,q,w,seconds),r=1-u;
  const position=add(add(scale(c[0],r*r*r),scale(c[1],3*r*r*u)),add(scale(c[2],3*r*u*u),scale(c[3],u*u*u)));
  const velocity=scale(add(add(scale(sub(c[1],c[0]),r*r),scale(sub(c[2],c[1]),2*r*u)),scale(sub(c[3],c[2]),u*u)),3/seconds);
  return {position:u===0?p:u===1?q:position,velocity:u===0?v:u===1?w:velocity};
};
/** Sample the same explicitly declared Hermite controls used by admission. */
export function sampleControlledHeldPitchV1(p:ControlledHeldPitchV1,atTick:number){
  assert(Number.isSafeInteger(atTick)&&atTick>=p.held[0].tick&&atTick<=p.followThrough.at(-1)!.tick,'observation outside motion');
  const released=atTick>=p.held.at(-1)!.tick,knots=released?p.followThrough:p.held;
  const i=Math.max(1,knots.findIndex(k=>k.tick>=atTick)),one=knots[i-1],two=knots[i],dt=(two.tick-one.tick)/1e6,u=(atTick-one.tick)/(two.tick-one.tick);
  const hand=interpolate(one.handCenter,one.handVelocity,two.handCenter,two.handVelocity,dt,u);
  if(released)return {tick:atTick,hand,ball:null};
  const a=one as ControlledHeldPitchV1['held'][number],b=two as ControlledHeldPitchV1['held'][number];
  const offset=interpolate(a.ballOffset,a.ballOffsetVelocity,b.ballOffset,b.ballOffsetVelocity,dt,u);
  return {tick:atTick,hand,ball:{position:add(hand.position,offset.position),velocity:add(hand.velocity,offset.velocity),spin:add(scale(a.spin,1-u),scale(b.spin,u))}};
}
/** Continuous hand evaluation for CCD; integer observation cuts use the public
 * held-ball sampler above. Both evaluate the same declared Hermite controls. */
export function sampleControlledPitchHandV1(p:ControlledHeldPitchV1,atTick:number){
  assert(Number.isFinite(atTick)&&atTick>=p.followThrough[0].tick&&atTick<=p.followThrough.at(-1)!.tick,'continuous hand outside motion');
  const knots=p.followThrough,i=Math.max(1,knots.findIndex(k=>k.tick>=atTick)),a=knots[i-1],b=knots[i];
  return interpolate(a.handCenter,a.handVelocity,b.handCenter,b.handVelocity,(b.tick-a.tick)/1e6,(atTick-a.tick)/(b.tick-a.tick));
}
function split(c:Vec3[]):[Vec3[],Vec3[]]{const a=midpoint(c[0],c[1]),b=midpoint(c[1],c[2]),d=midpoint(c[2],c[3]),e=midpoint(a,b),f=midpoint(b,d),m=midpoint(e,f);return [[c[0],a,e,m],[m,f,d,c[3]]];}
function certifyClear(c:Vec3[],obstacle:ControlledHeldPitchAnchorsV1['obstacles'][number],ballRadius:number,budget:{left:number},depth=0):void{
  assert(--budget.left>=0,'collision proof budget exhausted');
  const axes=['x','y','z'] as const;
  const distance=Math.hypot(...axes.map(k=>Math.max(Math.min(...c.map(p=>p[k]))-obstacle.center[k],0,obstacle.center[k]-Math.max(...c.map(p=>p[k])))));
  if(distance>obstacle.radiusM+ballRadius)return;
  assert(depth<24,'held ball collision or uncertified clearance');
  const [left,right]=split(c);certifyClear(left,obstacle,ballRadius,budget,depth+1);certifyClear(right,obstacle,ballRadius,budget,depth+1);
}

/** Kinematic control and exact endpoint/convex-hull certificates. These are
 * explicit motor commands, not measured anatomy or muscle/torque calibration.
 * The holder is a custody constraint while held; all other supplied collision
 * shapes remain active. No ball position, clock, or collider is nudged. */
export function validateControlledHeldPitchV1(raw:ControlledHeldPitchV1,rawAnchors:ControlledHeldPitchAnchorsV1){
  const p=cloneInert(raw),a=cloneInert(rawAnchors);
  assert(fields(p,['version','ticksPerSecond','initialOrientation','held','followThrough'])&&p.version==='controlled_held_pitch_v1'&&p.ticksPerSecond===1e6,'unsupported motion');
  assert(fields(p.initialOrientation,['x','y','z','w'])&&Object.values(p.initialOrientation).every(Number.isFinite)
    &&Math.abs(Math.hypot(...Object.values(p.initialOrientation))-1)<1e-6,'invalid initial orientation');
  assert([a.armReachM,a.handRadiusM,a.ballRadiusM].every(n=>Number.isFinite(n)&&n>0)&&vec(a.shoulder)&&vec(a.releaseAcceleration),'invalid anchors');
  assert(Array.isArray(a.obstacles)&&a.obstacles.every(o=>vec(o.center)&&Number.isFinite(o.radiusM)&&o.radiusM>0),'invalid obstacles');
  for(const [held,knots]of [[true,p.held],[false,p.followThrough]] as const){
    assert(Array.isArray(knots)&&knots.length>=2&&knots.length<=64,'missing finite control knots');
    knots.forEach((k,i)=>{
      assert(fields(k,['tick','handCenter','handVelocity',...(held?['ballOffset','ballOffsetVelocity','spin']:[])])
        &&Number.isSafeInteger(k.tick)&&k.tick>=0&&(!i||k.tick>knots[i-1].tick)&&vec(k.handCenter)&&vec(k.handVelocity),'invalid hand knot');
      if(held){const h=k as ControlledHeldPitchV1['held'][number];assert([h.ballOffset,h.ballOffsetVelocity,h.spin].every(vec),'invalid held knot');}
    });
  }
  const first=p.held[0],last=p.held.at(-1)!,after=p.followThrough[0],finish=p.followThrough.at(-1)!;
  assert(first.tick===a.initialBall.tick&&equal(first.handCenter,a.initialHand.position)&&equal(first.handVelocity,a.initialHand.velocity)
    &&equal(add(first.handCenter,first.ballOffset),a.initialBall.position)&&equal(add(first.handVelocity,first.ballOffsetVelocity),a.initialBall.velocity)
    &&equal(first.spin,a.initialBall.spin),'initial owned hand or ball differs');
  assert(last.tick===a.release.releaseAtUs&&equal(add(last.handCenter,last.ballOffset),a.release.position)
    &&equal(add(last.handVelocity,last.ballOffsetVelocity),a.release.velocity)&&equal(last.spin,a.release.spin),'canonical release differs');
  assert(after.tick===last.tick&&equal(after.handCenter,last.handCenter)&&equal(after.handVelocity,last.handVelocity)
    &&finish.tick===a.followThroughEndTick,'follow-through is discontinuous or incomplete');
  const contactRadius=a.handRadiusM+a.ballRadiusM;
  assert(norm(last.ballOffset)===contactRadius,'release requires the current holder surface constraint');
  const normal=scale(last.ballOffset,1/contactRadius),normalVelocity=dot(last.ballOffsetVelocity,normal);
  const b=p.followThrough[1],dt=(b.tick-after.tick)/1e6;
  const handAcceleration=sub(scale(sub(b.handCenter,after.handCenter),6/(dt*dt)),scale(add(scale(after.handVelocity,4),scale(b.handVelocity,2)),1/dt));
  const normalAcceleration=dot(sub(a.releaseAcceleration,handAcceleration),normal);
  assert(normalVelocity>0||normalVelocity===0&&normalAcceleration>0,'release does not separate from the current hand');
  let orientation=normalizeQuaternion(p.initialOrientation),maximumHandReachControlDistanceM=0;
  const budget={left:100_000};
  for(const knots of [p.held,p.followThrough])for(let i=1;i<knots.length;i++){
    const one=knots[i-1],two=knots[i],seconds=(two.tick-one.tick)/1e6;
    const hand=controls(one.handCenter,one.handVelocity,two.handCenter,two.handVelocity,seconds);
    const reach=Math.max(...hand.map(c=>norm(sub(c,a.shoulder))));maximumHandReachControlDistanceM=Math.max(maximumHandReachControlDistanceM,reach);
    assert(reach<=a.armReachM,'hand control hull exceeds original arm reach');
    for(const obstacle of a.obstacles)certifyClear(hand,obstacle,a.handRadiusM,budget);
    if('ballOffset'in one&&'ballOffset'in two){
      const o=one as ControlledHeldPitchV1['held'][number],t=two as ControlledHeldPitchV1['held'][number];
      const offsets=controls(o.ballOffset,o.ballOffsetVelocity,t.ballOffset,t.ballOffsetVelocity,seconds);
      assert(offsets.every(v=>norm(v)<=contactRadius),'ball leaves its holder before release');
      const ball=hand.map((c,j)=>add(c,offsets[j]));for(const obstacle of a.obstacles)certifyClear(ball,obstacle,a.ballRadiusM,budget);
      assert(norm(cross(o.spin,t.spin))===0,'changing spin axis within a segment is unsupported');
      orientation=advanceBaseballOrientation(orientation,scale(add(o.spin,t.spin),.5),seconds);
    }
  }
  return freeze({kind:'controlled_held_pitch_binding_v1' as const,motion:p,maximumHandReachControlDistanceM,
    releaseOrientation:orientation,releaseHand:{position:last.handCenter,velocity:last.handVelocity,acceleration:handAcceleration},
    releaseContact:{normal,normalVelocityMps:normalVelocity,normalAccelerationMps2:normalAcceleration,
      authority:'CURRENT_OWNED_HOLDER_CONSTRAINT' as const},muscleTorqueCalibrated:false as const,measuredMotion:false as const});
}
