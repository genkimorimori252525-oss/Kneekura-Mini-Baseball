import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import { normalizeQuaternion,rotateVectorByQuaternion,type Quaternion } from '../pitching/BaseballOrientation';

export type InitialHeldBatV1=Readonly<{
  version:'initial_held_bat_v1';startTick:number;throughTick:number;
  grip:Vec3;orientation:Quaternion;batLengthM:number;maximumBatRadiusM:number;handReferenceFromKnobM:number;
}>;
export type InitialHeldBatBodyV1=Readonly<{
  bodyOrigin:Vec3;maximumHandReachM:number;handCenter:Vec3;handRadiusM:number;
  obstacles:readonly Readonly<{center:Vec3;radiusM:number}>[];
}>;
const fields=(v:unknown,keys:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...keys].sort().join('|');
const vec=(v:Vec3)=>fields(v,['x','y','z'])&&Object.values(v).every(n=>Number.isFinite(n)&&Math.abs(n)<=1e6);
const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const scale=(a:Vec3,n:number):Vec3=>({x:a.x*n,y:a.y*n,z:a.z*n});
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const norm=(a:Vec3)=>Math.hypot(a.x,a.y,a.z);
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('initial held bat: '+message);}

/** A finite stationary equipment control. Secure grasp is an explicit initial
 * authority's state; this geometric certificate does NOT infer possession.
 * The maximum-radius capsule is conservative for the original tapered bat.
 * It never changes a pose or removes an obstacle to obtain clearance. */
export function validateInitialHeldBatV1(raw:InitialHeldBatV1,rawBody:InitialHeldBatBodyV1){
  const p=cloneInert(raw),b=cloneInert(rawBody);
  assert(fields(p,['version','startTick','throughTick','grip','orientation','batLengthM','maximumBatRadiusM','handReferenceFromKnobM'])
    &&p.version==='initial_held_bat_v1'&&Number.isSafeInteger(p.startTick)&&p.startTick>=0&&Number.isSafeInteger(p.throughTick)&&p.throughTick>p.startTick
    &&vec(p.grip)&&fields(p.orientation,['x','y','z','w'])&&Object.values(p.orientation).every(Number.isFinite)
    &&Math.abs(Math.hypot(...Object.values(p.orientation))-1)<1e-6,'invalid finite pose');
  assert([p.batLengthM,p.maximumBatRadiusM].every(n=>Number.isFinite(n)&&n>0)&&p.batLengthM<=2
    &&Number.isFinite(p.handReferenceFromKnobM)&&p.handReferenceFromKnobM>=0&&p.handReferenceFromKnobM<p.batLengthM,'invalid original bat geometry');
  assert(fields(b,['bodyOrigin','maximumHandReachM','handCenter','handRadiusM','obstacles'])&&vec(b.bodyOrigin)&&vec(b.handCenter)
    &&[b.maximumHandReachM,b.handRadiusM].every(n=>Number.isFinite(n)&&n>0)
    &&Array.isArray(b.obstacles)&&b.obstacles.every(o=>fields(o,['center','radiusM'])&&vec(o.center)&&Number.isFinite(o.radiusM)&&o.radiusM>0),'invalid original body');
  const orientation=normalizeQuaternion(p.orientation),axis=rotateVectorByQuaternion({x:0,y:1,z:0},orientation);
  const tip=add(p.grip,scale(axis,p.batLengthM)),handReference=add(p.grip,scale(axis,p.handReferenceFromKnobM));
  const handResidualM=norm(sub(handReference,b.handCenter)),handReachM=norm(sub(handReference,b.bodyOrigin));
  assert(handResidualM<=b.handRadiusM,'declared grasp is outside the original hand');
  assert(handReachM<=b.maximumHandReachM,'declared grasp exceeds original reach');
  const clearances=b.obstacles.map(o=>{
    const t=Math.max(0,Math.min(p.batLengthM,dot(sub(o.center,p.grip),axis)));
    return norm(sub(o.center,add(p.grip,scale(axis,t))))-o.radiusM-p.maximumBatRadiusM;
  });
  assert(clearances.every(n=>n>0),'bat intersects an original non-holder obstacle or clearance is uncertified');
  return freeze({kind:'initial_held_bat_binding_v1' as const,control:p,orientation,axis,tip,handReference,handResidualM,handReachM,
    obstacleClearancesM:clearances,boundingSphere:{center:add(p.grip,scale(axis,p.batLengthM/2)),radiusM:p.batLengthM/2+p.maximumBatRadiusM},
    custodyInferred:false as const,measuredStance:false as const,muscleTorqueCalibrated:false as const});
}

export function sampleInitialHeldBatV1(control:InitialHeldBatV1,atTick:number){
  assert(Number.isFinite(atTick)&&atTick>=control.startTick&&atTick<=control.throughTick,'observation outside owned bat control');
  const orientation=normalizeQuaternion(control.orientation),axis=rotateVectorByQuaternion({x:0,y:1,z:0},orientation);
  return freeze({tick:atTick,orientation,state:{pose:{grip:control.grip,tip:add(control.grip,scale(axis,control.batLengthM))},
    linearVelocity:{x:0,y:0,z:0},angularVelocity:{x:0,y:0,z:0}}});
}

/** Conservative clearance from a point to the original maximum-radius bat
 * capsule. A nonpositive bound requires the actual interaction solver; it is
 * never itself a contact or possession event. */
export function initialHeldBatPointClearanceV1(control:InitialHeldBatV1,point:Vec3){
  assert(vec(point),'invalid clearance point');
  const axis=rotateVectorByQuaternion({x:0,y:1,z:0},normalizeQuaternion(control.orientation));
  const t=Math.max(0,Math.min(control.batLengthM,dot(sub(point,control.grip),axis)));
  return norm(sub(point,add(control.grip,scale(axis,t))))-control.maximumBatRadiusM;
}
