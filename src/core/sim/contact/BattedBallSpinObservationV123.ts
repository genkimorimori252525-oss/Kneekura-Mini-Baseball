import type {Vec3} from '../../model/geometry';
import {cloneInert} from '../../adjudication/OfficialWindowPolicy';

export type BattedSpinObservationInputV123=Readonly<{velocityMps:Vec3;spinRadPerSecond:Vec3;bats:'R'|'L'}>;
type Components=Readonly<{gyroRadPerSecond:number;rightCurvingSpinRadPerSecond:number;backspinSignedRadPerSecond:number;
 sliceRadPerSecond:number;hookRadPerSecond:number;backspinRadPerSecond:number;topspinRadPerSecond:number}>;
export type BattedSpinObservationV123=Readonly<{version:'batted_spin_observation_v123';boundary:'READ_ONLY_OBSERVATION';
 velocityMps:Vec3;spinRadPerSecond:Vec3;bats:'R'|'L';basisPolicy:'GROUND_FLIGHT_FRAME_NOT_A_FORCE_OR_SKILL_MEASUREMENT'}>&(
 Readonly<{basisStatus:'DEFINED';basis:Readonly<{forward:Vec3;right:Vec3;up:Vec3}>}>&Components
 |Readonly<{basisStatus:'UNCLASSIFIED';basis:null;gyroRadPerSecond:null;rightCurvingSpinRadPerSecond:null;backspinSignedRadPerSecond:null;
 sliceRadPerSecond:null;hookRadPerSecond:null;backspinRadPerSecond:null;topspinRadPerSecond:null}>);
const fields=(v:unknown,n:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===n.length&&n.every(k=>Object.hasOwn(v,k));
const vector=(v:Vec3)=>fields(v,['x','y','z'])&&Object.values(v).every(Number.isFinite)&&Number.isFinite(Math.hypot(v.x,v.y,v.z));
const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
function freeze<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}

/** Y-up. Labels refer to the handed side of a flight frame: slice is toward
 * the opposite-field side, hook toward the pull side. This is a kinematic
 * decomposition, not a mastery classifier or an aerodynamic force model.
 * The full angular-velocity vector remains the only physical spin Source. */
export function observeBattedBallSpinV123(raw:BattedSpinObservationInputV123):BattedSpinObservationV123{
 const input=cloneInert(raw);
 if(!fields(input,['velocityMps','spinRadPerSecond','bats'])||!vector(input.velocityMps)||!vector(input.spinRadPerSecond)||!['R','L'].includes(input.bats))
  throw Error('invalid batted spin observation vectors or batting side');
 const {velocityMps:v,spinRadPerSecond:s}=input,speed=Math.hypot(v.x,v.y,v.z),horizontal=Math.hypot(v.x,v.z),base={...input,
  version:'batted_spin_observation_v123' as const,boundary:'READ_ONLY_OBSERVATION' as const,basisPolicy:'GROUND_FLIGHT_FRAME_NOT_A_FORCE_OR_SKILL_MEASUREMENT' as const};
 // This numerical conditioning threshold supplies no human ability or
 // gameplay probability. A vertical/stationary path has no field-side basis.
 if(speed===0||horizontal/speed<=1e-12)return freeze({...base,basisStatus:'UNCLASSIFIED',basis:null,gyroRadPerSecond:null,rightCurvingSpinRadPerSecond:null,
  backspinSignedRadPerSecond:null,sliceRadPerSecond:null,hookRadPerSecond:null,backspinRadPerSecond:null,topspinRadPerSecond:null});
 const forward={x:v.x/speed,y:v.y/speed,z:v.z/speed},right={x:v.z/horizontal,y:0,z:-v.x/horizontal},up=cross(forward,right),
  gyroRadPerSecond=dot(s,forward),rightCurvingSpinRadPerSecond=dot(s,up),backspinSignedRadPerSecond=-dot(s,right),
  sliceSigned=rightCurvingSpinRadPerSecond*(input.bats==='R'?1:-1);
 return freeze({...base,basisStatus:'DEFINED',basis:{forward,right,up},gyroRadPerSecond,rightCurvingSpinRadPerSecond,backspinSignedRadPerSecond,
  sliceRadPerSecond:Math.max(0,sliceSigned),hookRadPerSecond:Math.max(0,-sliceSigned),
  backspinRadPerSecond:Math.max(0,backspinSignedRadPerSecond),topspinRadPerSecond:Math.max(0,-backspinSignedRadPerSecond)});
}
