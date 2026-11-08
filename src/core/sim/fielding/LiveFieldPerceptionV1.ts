import type {Vec3} from '../../model/geometry';
import {quantizeEventTick} from '../ExactEventTime';
import {buildPlayerPerceivedWorldState,type PlayerPerceivedWorldState} from '../perception/PlayerPerceivedWorldState';
import type {RememberedPrediction,SpatialMotionEstimate} from '../perception/ObservationMemory';

export type LiveFieldObservedBallV1=Readonly<{position:Vec3;velocity:Vec3;spin:Vec3;
 possessedBy?:string|null;phase?:'free'|'held'|'throw'|'unknown';
 /** Perceived contact/catch cues, not a runner's private retouch obligation. */
 flyCaught?:boolean;firstTouchElapsedSeconds?:number}>;
export type LiveFieldObservedActorV1=Readonly<{playerId:string;position:Vec3;velocity:Vec3;
 glovePosition?:Vec3;gloveVelocity?:Vec3;
 /** An observed recovery estimate, never an undisclosed Source schedule. */
 recoveryUntilSeconds?:number}>;
export type LiveFieldObservedRunnerV1=Readonly<{runnerId:string;position:Vec3;velocity:Vec3;
 currentBase:0|1|2|3|4;retired:boolean;scored:boolean}>;
export type LiveFieldObservationSnapshotV1=Readonly<{elapsedSeconds:number;ball:LiveFieldObservedBallV1;
 actors:readonly LiveFieldObservedActorV1[];runners:readonly LiveFieldObservedRunnerV1[];outs?:number}>;
export type LiveFieldKnownContextV1=Readonly<{outs:number;occupiedBases:readonly (1|2|3)[]}>;
export type LiveFieldPerceivedActorV1=LiveFieldObservedActorV1&Readonly<{observedPosition:Vec3;observedVelocity:Vec3}>;
export type LiveFieldPerceivedRunnerV1=LiveFieldObservedRunnerV1&Readonly<{observedPosition:Vec3;observedVelocity:Vec3}>;
export type LiveFieldPerceivedStateV1=Readonly<{observerId:string;elapsedSeconds:number;
 observationElapsedSeconds:number|null;observationTick:number|null;ageSeconds:number|null;
 ball:LiveFieldObservedBallV1|null;actors:readonly LiveFieldPerceivedActorV1[];runners:readonly LiveFieldPerceivedRunnerV1[];
 world:PlayerPerceivedWorldState<LiveFieldKnownContextV1>}>;
export type LiveFieldPerceptionInputV1=Readonly<{observerId:string;elapsedSeconds:number;
 clock:Readonly<{originTick:number;ticksPerSecond:number}>;delaySeconds:number;cadenceSeconds:number;
 snapshots:readonly LiveFieldObservationSnapshotV1[];knownContext:LiveFieldKnownContextV1}>;

const fail=(label:string):never=>{throw Error('live field perception: '+label);};
const object=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return fail('plain data object required');
 return v as Record<string,unknown>;
};
const read=(v:Record<string,unknown>,key:string,optional=false):unknown=>{
 const d=Object.getOwnPropertyDescriptor(v,key);
 if(!d){if(optional)return undefined;return fail('missing '+key);}
 if(!d.enumerable||!('value'in d))return fail('inert data required: '+key);
 return d.value;
};
const number=(v:unknown):number=>typeof v==='number'&&Number.isFinite(v)?v:fail('finite number required');
const seconds=(v:unknown):number=>{const n=number(v);return n>=0?n:fail('non-negative seconds required');};
const id=(v:unknown):string=>typeof v==='string'&&v.length>0&&v.length<=256?v:fail('player/message identity required');
const integer=(v:unknown,lo:number,hi:number):number=>{const n=number(v);return Number.isSafeInteger(n)&&n>=lo&&n<=hi?n:fail('integer outside range');};
const bool=(v:unknown):boolean=>typeof v==='boolean'?v:fail('boolean required');
const vec=(v:unknown):Vec3=>{const r=object(v);return{x:number(read(r,'x')),y:number(read(r,'y')),z:number(read(r,'z'))};};
const list=(v:unknown,max:number):unknown[]=>{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>max)return fail('bounded dense array required');
 return Array.from({length:v.length},(_,i)=>read(v as unknown as Record<string,unknown>,String(i)));
};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const move=(p:Vec3,v:Vec3,dt:number):Vec3=>{const next={x:p.x+v.x*dt,y:p.y+v.y*dt,z:p.z+v.z*dt};
 if(!Object.values(next).every(Number.isFinite))return fail('prediction overflow');return next;};
const unique=(values:readonly string[])=>{if(new Set(values).size!==values.length)fail('duplicate actor/runner');};

/** Copy a deliberately small sensor surface. Unknown fields (including getters,
 * intent, motion, callbacks or world references) are never read or retained.
 * Allowed fields must be own enumerable inert data. This authenticates no truth. */
export function captureLiveFieldObservationSnapshotV1(raw:unknown):LiveFieldObservationSnapshotV1{
 const r=object(raw),b=object(read(r,'ball')),phase=read(b,'phase',true),possessedBy=read(b,'possessedBy',true),outs=read(r,'outs',true),
  flyCaught=read(b,'flyCaught',true),firstTouch=read(b,'firstTouchElapsedSeconds',true);
 if(phase!==undefined&&!['free','held','throw','unknown'].includes(phase as string))fail('invalid observed ball phase');
 const ball:LiveFieldObservedBallV1={position:vec(read(b,'position')),velocity:vec(read(b,'velocity')),spin:vec(read(b,'spin')),
  ...(phase===undefined?{}:{phase:phase as LiveFieldObservedBallV1['phase']}),
  ...(possessedBy===undefined?{}:{possessedBy:possessedBy===null?null:id(possessedBy)}),
  ...(flyCaught===undefined?{}:{flyCaught:bool(flyCaught)}),...(firstTouch===undefined?{}:{firstTouchElapsedSeconds:seconds(firstTouch)})};
 if(firstTouch!==undefined&&seconds(firstTouch)>seconds(read(r,'elapsedSeconds')))fail('future contact cue');
 const actors=list(read(r,'actors'),9).map(v=>{const a=object(v),gp=read(a,'glovePosition',true),gv=read(a,'gloveVelocity',true),recovery=read(a,'recoveryUntilSeconds',true);
  return{playerId:id(read(a,'playerId')),position:vec(read(a,'position')),velocity:vec(read(a,'velocity')),
   ...(gp===undefined?{}:{glovePosition:vec(gp)}),...(gv===undefined?{}:{gloveVelocity:vec(gv)}),
   ...(recovery===undefined?{}:{recoveryUntilSeconds:seconds(recovery)})};});
 const runners=list(read(r,'runners'),4).map(v=>{const a=object(v);return{runnerId:id(read(a,'runnerId')),position:vec(read(a,'position')),
  velocity:vec(read(a,'velocity')),currentBase:integer(read(a,'currentBase'),0,4) as 0|1|2|3|4,retired:bool(read(a,'retired')),scored:bool(read(a,'scored'))};});
 unique(actors.map(a=>a.playerId));unique(runners.map(a=>a.runnerId));
 return freeze({elapsedSeconds:seconds(read(r,'elapsedSeconds')),ball,actors,runners,...(outs===undefined?{}:{outs:integer(outs,0,3)})});
}

/** Read a delayed cadence prefix, then extrapolate observed motion only. No
 * acceleration, future intention, truth callback or success fact is consulted.
 * Confidence stays one: new error/forgetting calibration is intentionally absent. */
export function buildLiveFieldPerceivedStateV1(raw:LiveFieldPerceptionInputV1):LiveFieldPerceivedStateV1{
 const r=object(raw),observerId=id(read(r,'observerId')),now=seconds(read(r,'elapsedSeconds')),
  delay=seconds(read(r,'delaySeconds')),cadence=seconds(read(r,'cadenceSeconds')),clock=object(read(r,'clock')),
  originTick=integer(read(clock,'originTick'),0,Number.MAX_SAFE_INTEGER),ticksPerSecond=integer(read(clock,'ticksPerSecond'),1,Number.MAX_SAFE_INTEGER),
  nowTick=quantizeEventTick(originTick,now,ticksPerSecond),known=object(read(r,'knownContext')),
  occupiedBases=list(read(known,'occupiedBases'),3).map(b=>integer(b,1,3) as 1|2|3);
 if(cadence===0)fail('positive cadence required');unique(occupiedBases.map(String));
 const preplayOuts=integer(read(known,'outs'),0,3),available=now-delay,
  gate=Math.floor((available+1e-12)/cadence)*cadence;
 let selected:unknown=null,selectedSeconds=-Infinity,last=-Infinity;
 for(const value of list(read(r,'snapshots'),8192)){
  const s=seconds(read(object(value),'elapsedSeconds'));if(s<last)fail('snapshot times must be ordered');last=s;
  if(available>=-1e-12&&s<=available+1e-12&&s<=gate+1e-12&&s>=selectedSeconds){selected=value;selectedSeconds=s;}
 }
 const observed=selected===null?null:captureLiveFieldObservationSnapshotV1(selected),age=observed?Math.max(0,now-observed.elapsedSeconds):null,
  observedAt=observed?quantizeEventTick(originTick,observed.elapsedSeconds,ticksPerSecond):null,
  ball=observed?{...observed.ball,position:move(observed.ball.position,observed.ball.velocity,age!)}:null,
  actors:LiveFieldPerceivedActorV1[]=observed?observed.actors.map(a=>({...a,position:move(a.position,a.velocity,age!),
   observedPosition:{...a.position},observedVelocity:{...a.velocity},
   ...(a.glovePosition?{glovePosition:move(a.glovePosition,a.gloveVelocity??{x:0,y:0,z:0},age!)}:{})})):[],
  runners:LiveFieldPerceivedRunnerV1[]=observed?observed.runners.map(a=>({...a,position:move(a.position,a.velocity,age!),
   observedPosition:{...a.position},observedVelocity:{...a.velocity}})):[],
  memory:RememberedPrediction<SpatialMotionEstimate>|null=ball?{estimate:{position:ball.position,velocity:ball.velocity},
   sourceObservedAt:observedAt!,predictedAt:nowTick,confidence:1}:null,
  world=buildPlayerPerceivedWorldState({observerId,observationTime:nowTick,attention:{target:{kind:'ball'},focusedSinceTick:originTick},ball:memory,
   players:actors.map(a=>({playerId:a.playerId,memory:{estimate:{position:{x:a.position.x,z:a.position.z},velocity:{x:a.velocity.x,z:a.velocity.z}},
    sourceObservedAt:observedAt!,predictedAt:nowTick,confidence:1}})),communications:[],knownContext:{outs:observed?.outs??preplayOuts,occupiedBases}});
 return freeze({observerId,elapsedSeconds:now,observationElapsedSeconds:observed?.elapsedSeconds??null,observationTick:observedAt,ageSeconds:age,ball,actors,runners,world});
}
