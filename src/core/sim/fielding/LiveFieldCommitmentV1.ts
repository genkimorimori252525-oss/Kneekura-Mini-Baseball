import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import type {Vec3} from '../../model/geometry';
import {quantizeEventTick} from '../ExactEventTime';
import {validateLiveFielderBodyModelV105,type LiveFielderBodyModelV105} from './LiveFielderBodyGeometryV105';

export type LiveBodyBezierSegmentV1=Readonly<{fromSeconds:number;throughSeconds:number;controls:readonly [Vec3,Vec3,Vec3,Vec3]}>;
/** A source-owner command or an explicitly labelled braking continuation.
 * Receiving a copy is information only; it never grants actuation authority. */
export type LiveFieldCommitmentV1=Readonly<{schemaVersion:1;actorId:string;commandId:string;revision:number;
 clock:Readonly<{originTick:number;ticksPerSecond:number}>;worldRevision:number;fromSeconds:number;throughSeconds:number;fromTick:number;throughTick:number;
 kind:'athletic'|'motor';bodyModel:LiveFielderBodyModelV105;bodyRadiusMeters:number;gloveRadiusMeters:number;extraFootReachMeters:number;
 segments:readonly LiveBodyBezierSegmentV1[]}>;
const freeze=<T>(o:T):T=>{if(o&&typeof o==='object'){Object.values(o).forEach(freeze);Object.freeze(o);}return o;};
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const nonnegative=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const integer=(n:unknown):n is number=>Number.isSafeInteger(n)&&Number(n)>=0;
const id=(s:unknown)=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=256;
const vec=(p:Vec3)=>p&&Object.keys(p).length===3&&[p.x,p.y,p.z].every(Number.isFinite);
const fields=(o:object,keys:readonly string[])=>Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const norm=(p:Vec3)=>Math.hypot(p.x,p.y,p.z);
const ownedCommands=new WeakSet<object>();
const commandKeys=new WeakMap<object,string>();

export function readLiveFieldCommitmentV1(raw:unknown):LiveFieldCommitmentV1{
 if(raw&&typeof raw==='object'&&ownedCommands.has(raw))return raw as LiveFieldCommitmentV1;
 const c=cloneInert(raw) as LiveFieldCommitmentV1;
 if(!c||typeof c!=='object'||!fields(c,['schemaVersion','actorId','commandId','revision','clock','worldRevision','fromSeconds','throughSeconds','fromTick','throughTick','kind','bodyModel','bodyRadiusMeters','gloveRadiusMeters','extraFootReachMeters','segments'])
  ||c.schemaVersion!==1||!id(c.actorId)||!id(c.commandId)||!integer(c.revision)||c.revision<1||!integer(c.worldRevision)
  ||!c.clock||!fields(c.clock,['originTick','ticksPerSecond'])||!integer(c.clock.originTick)||!integer(c.clock.ticksPerSecond)||c.clock.ticksPerSecond<1
  ||!nonnegative(c.fromSeconds)||!positive(c.throughSeconds-c.fromSeconds)||!integer(c.fromTick)||!integer(c.throughTick)
  ||c.fromTick!==quantizeEventTick(c.clock.originTick,c.fromSeconds,c.clock.ticksPerSecond)
  ||c.throughTick!==quantizeEventTick(c.clock.originTick,c.throughSeconds,c.clock.ticksPerSecond)
  ||!['athletic','motor'].includes(c.kind)||!validateLiveFielderBodyModelV105(c.bodyModel)
  ||!fields(c.bodyModel,['heightMeters','hipHeightMeters','shoulderHeightMeters','eyeHeightMeters','armReachMeters','maximumCrouchMeters','postureSpeedMps','turnSpeedRadiansPerSecond','rearReachFraction'])
  ||!positive(c.bodyRadiusMeters)||!positive(c.gloveRadiusMeters)||!nonnegative(c.extraFootReachMeters)
  ||!Array.isArray(c.segments)||c.segments.length<1||c.segments.length>128)throw Error('invalid live field commitment');
 let previous:LiveBodyBezierSegmentV1|undefined;
 for(const s of c.segments){
  if(!s||!fields(s,['fromSeconds','throughSeconds','controls'])||!nonnegative(s.fromSeconds)||!positive(s.throughSeconds-s.fromSeconds)
   ||!Array.isArray(s.controls)||s.controls.length!==4||!s.controls.every(vec)
   ||(previous?previous.throughSeconds!==s.fromSeconds:s.fromSeconds!==c.fromSeconds))throw Error('invalid committed body interval');
  if(previous){const a=previous.controls[3],b=s.controls[0],gap=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z),rounding=1024*Number.EPSILON*Math.max(1,norm(a),norm(b));
   if(gap>rounding)throw Error('discontinuous committed body position');}
  previous=s;
 }
 if(previous!.throughSeconds!==c.throughSeconds||!Number.isFinite(liveFieldBodyEnvelopeRadiusV1(c)))throw Error('incomplete committed body coverage');
 ownedCommands.add(c);return freeze(c);
}

/** Circumscribes all canonical foot/hip/shoulder/head positions and the full
 * shoulder-relative arm/glove reach, including prone/standing interpolation.
 * Unknown limb orientation is bounded by full reach, not sampled poses. A
 * jumping source supplies its extra takeoff foot-to-hip separation explicitly. */
export function liveFieldBodyEnvelopeRadiusV1(c:Pick<LiveFieldCommitmentV1,'bodyModel'|'bodyRadiusMeters'|'gloveRadiusMeters'|'extraFootReachMeters'>):number{
 const m=c.bodyModel,h=m.heightMeters,shoulder=m.shoulderHeightMeters-m.hipHeightMeters,
  shoulderBound=Math.max(Math.abs(shoulder),Math.abs(shoulder-m.maximumCrouchMeters),Math.hypot(h*.30,h*.04)),
  headBound=Math.max(h-m.hipHeightMeters,Math.abs(h-m.hipHeightMeters-m.maximumCrouchMeters),Math.hypot(h*.48,h*.07)),
  footBound=Math.max(m.hipHeightMeters+c.extraFootReachMeters,h*.44+c.extraFootReachMeters);
 return Math.max(footBound,headBound,shoulderBound+m.armReachMeters)+Math.max(c.bodyRadiusMeters,c.gloveRadiusMeters);
}

export const liveFieldCommitmentKeyV1=(command:LiveFieldCommitmentV1)=>{
 const old=ownedCommands.has(command)?commandKeys.get(command):undefined;if(old!==undefined)return old;
 const key=JSON.stringify(command,(_key,value)=>value&&typeof value==='object'&&!Array.isArray(value)
  ?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)):value);
 // Only the reader's recursively frozen ownership is cacheable. A caller's
 // mutable descriptor must be re-read/re-keyed after every content change.
 if(ownedCommands.has(command))commandKeys.set(command,key);return key;
};
