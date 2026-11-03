import type {Vec3} from '../../model/geometry';
import {DeterministicRng} from '../../rng/DeterministicRng';
import {quantizeEventTick} from '../ExactEventTime';
import {resolveExactCommunicationReception,isExactCommunicationAvailable,type ExactCommunicationClock,type ExactCommunicationReception} from '../perception/ExactCommunication';
import type {CommunicationEvent} from '../perception/Communication';
import type {DefensiveIntent} from './DefensiveDecision';

export type LiveFieldCoordinationPayloadV1=Readonly<{kind:'intent'|'withdraw';intent?:DefensiveIntent;
 targetPlayerId?:string;base?:1|2|3|4;point?:Vec3;estimatedArrivalSeconds?:number}>;
export type LiveFieldCoordinationContentV1=Readonly<{messageId:string;revision:number;expiresAtElapsedSeconds:number;payload:LiveFieldCoordinationPayloadV1}>;
export type LiveFieldCoordinationMessageV1=Readonly<{messageId:string;revision:number;sourceId:string;recipientId:string;
 issuedAtElapsedSeconds:number;expiresAtElapsedSeconds:number;propagationDelaySeconds:number;payload:LiveFieldCoordinationPayloadV1}>;
export type LiveFieldCoordinationReceptionV1=ExactCommunicationReception<LiveFieldCoordinationContentV1>;
const fail=(s:string):never=>{throw Error('live field coordination: '+s);};
const object=(v:unknown):Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||![Object.prototype,null].includes(Object.getPrototypeOf(v)))return fail('plain data object required');return v as Record<string,unknown>;
};
const read=(r:Record<string,unknown>,k:string,optional=false):unknown=>{
 const d=Object.getOwnPropertyDescriptor(r,k);if(!d){if(optional)return undefined;return fail('missing '+k);}
 if(!d.enumerable||!('value'in d))return fail('own inert data required: '+k);return d.value;
};
const seconds=(v:unknown):number=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:fail('finite non-negative seconds required');
const finite=(v:unknown):number=>typeof v==='number'&&Number.isFinite(v)?v:fail('finite coordinate required');
const id=(v:unknown):string=>typeof v==='string'&&v.length>0&&v.length<=256?v:fail('identity required');
const integer=(v:unknown,lo:number,hi:number):number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi?v:fail('integer outside range');
const base=(v:unknown)=>integer(v,1,4) as 1|2|3|4;
const vec=(v:unknown):Vec3=>{const r=object(v);return{x:finite(read(r,'x')),y:finite(read(r,'y')),z:finite(read(r,'z'))};};
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
const intent=(v:unknown):DefensiveIntent=>{
 const r=object(v),kind=read(r,'kind');if(kind==='hold'||kind==='ball_handler')return{kind};
 if(kind==='base_cover')return{kind,base:base(read(r,'base'))};
 if(kind==='relay'||kind==='backup'||kind==='deep_coverage'){
  const t=object(read(r,'target'));return{kind,target:{x:finite(read(t,'x')),z:finite(read(t,'z'))}};
 }return fail('unknown defensive intent');
};
const payload=(v:unknown):LiveFieldCoordinationPayloadV1=>{
 const r=object(v),kind=read(r,'kind');if(kind!=='intent'&&kind!=='withdraw')return fail('unknown payload kind');
 const targetPlayerId=read(r,'targetPlayerId',true),b=read(r,'base',true),point=read(r,'point',true),arrival=read(r,'estimatedArrivalSeconds',true);
 return{kind,...(kind==='intent'?{intent:intent(read(r,'intent'))}:{}),...(targetPlayerId===undefined?{}:{targetPlayerId:id(targetPlayerId)}),
  ...(b===undefined?{}:{base:base(b)}),...(point===undefined?{}:{point:vec(point)}),...(arrival===undefined?{}:{estimatedArrivalSeconds:seconds(arrival)})};
};

/** Per-play private delivery only. The caller supplies one total communication
 * delay (not an additional second recognition delay). No tactical assignment,
 * shared world, acceptance or guaranteed catch is produced here. */
export function createLiveFieldCoordinationV1(raw:Readonly<{clock:ExactCommunicationClock;maximumMessages?:number}>){
 const options=object(raw),c=object(read(options,'clock')),clock={originTick:integer(read(c,'originTick'),0,Number.MAX_SAFE_INTEGER),
  ticksPerSecond:integer(read(c,'ticksPerSecond'),1,Number.MAX_SAFE_INTEGER)},maximumMessages=integer(read(options,'maximumMessages',true)??64,1,256);
 const queue:LiveFieldCoordinationReceptionV1[]=[];let evictions=0,issued=0;
 // The shared law calls nextFloat even when its jitter amplitude is zero.
 // Supply a private constant source so this adapter consumes no RNG stream.
 const fixedDelaySource=new DeterministicRng(0);fixedDelaySource.nextFloat=()=>0;
 const issue=(rawMessage:LiveFieldCoordinationMessageV1):LiveFieldCoordinationReceptionV1=>{
  const m=object(rawMessage),messageId=id(read(m,'messageId')),revision=integer(read(m,'revision'),1,Number.MAX_SAFE_INTEGER),
   sourceId=id(read(m,'sourceId')),recipientId=id(read(m,'recipientId')),sent=seconds(read(m,'issuedAtElapsedSeconds')),
   expires=seconds(read(m,'expiresAtElapsedSeconds')),delay=seconds(read(m,'propagationDelaySeconds'));
  if(expires<=sent)fail('expiry must follow issue');
  const previous=queue.filter(v=>v.received.event.sourceId===sourceId&&v.received.event.content.messageId===messageId
   &&v.received.event.targetScope.kind==='player'&&v.received.event.targetScope.playerId===recipientId);
  if(previous.some(v=>v.received.event.content.revision>=revision||v.sentAtElapsedSeconds>sent))fail('stale revision or issue time');
  const content={messageId,revision,expiresAtElapsedSeconds:expires,payload:payload(read(m,'payload'))},
   event:CommunicationEvent<LiveFieldCoordinationContentV1>={sourceId,targetScope:{kind:'player',playerId:recipientId},kind:'callout',
    issuedAt:quantizeEventTick(clock.originTick,sent,clock.ticksPerSecond),content},
   reception=resolveExactCommunicationReception(event,sent,clock,{propagationDelayTicks:quantizeEventTick(0,delay,clock.ticksPerSecond),
    recognitionBaseDelayTicks:0,maxAdditionalRecognitionDelayTicks:0,audibility:1,recognition:1,attention:1,minimumRecognizableQuality:1},fixedDelaySource);
  if(!reception)return fail('deterministic communication was not delivered');
  const owned=freeze(reception);if(queue.length===maximumMessages){queue.shift();evictions++;}queue.push(owned);issued++;return owned;
 };
 const receive=(rawQuery:Readonly<{observerId:string;elapsedSeconds:number}>):readonly LiveFieldCoordinationReceptionV1[]=>{
  const q=object(rawQuery),observer=id(read(q,'observerId')),now=seconds(read(q,'elapsedSeconds')),latest=new Map<string,LiveFieldCoordinationReceptionV1>();
  for(const item of queue){const e=item.received.event,content=e.content;
   if(e.targetScope.kind!=='player'||e.targetScope.playerId!==observer||!isExactCommunicationAvailable(item,now))continue;
   const key=JSON.stringify([e.sourceId,content.messageId]),old=latest.get(key);
   if(!old||old.received.event.content.revision<content.revision)latest.set(key,item);
  }
  // First select the latest delivered revision, then expire it. An expired
  // replacement/withdrawal must never expose the obsolete earlier intention.
  return Object.freeze([...latest.values()].filter(v=>now<v.received.event.content.expiresAtElapsedSeconds).sort((a,b)=>a.receivedAtElapsedSeconds-b.receivedAtElapsedSeconds
   ||a.received.event.sourceId.localeCompare(b.received.event.sourceId)||a.received.event.content.messageId.localeCompare(b.received.event.content.messageId)));
 };
 return Object.freeze({issue,receive,inspect:()=>Object.freeze({entries:queue.length,maximumMessages,evictions,issued})});
}
