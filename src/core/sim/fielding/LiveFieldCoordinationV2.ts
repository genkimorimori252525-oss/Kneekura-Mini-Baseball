import {cloneInert} from '../../adjudication/OfficialWindowPolicy';
import {createLiveFieldCoordinationV1,type LiveFieldCoordinationMessageV1,type LiveFieldCoordinationReceptionV1} from './LiveFieldCoordinationV1';
import {readLiveFieldCommitmentV1,type LiveFieldCommitmentV1} from './LiveFieldCommitmentV1';

export type LiveFieldCoordinationEnvelopeV2=Readonly<{schemaVersion:2;message:LiveFieldCoordinationMessageV1;commitment?:LiveFieldCommitmentV1}>;
/** The v1 delivery owner remains the only queue and clock law. Optional inert
 * path data shares the exact reception lifetime through a weak attachment;
 * eviction/withdrawal never leaves an independently live path registry. */
export function createLiveFieldCoordinationV2(options:Parameters<typeof createLiveFieldCoordinationV1>[0]){
 const legacy=createLiveFieldCoordinationV1(options),paths=new WeakMap<object,LiveFieldCommitmentV1>(),
  originalClock=Object.getOwnPropertyDescriptor(options,'clock')!.value,
  clock=Object.freeze({originTick:Object.getOwnPropertyDescriptor(originalClock,'originTick')!.value as number,
   ticksPerSecond:Object.getOwnPropertyDescriptor(originalClock,'ticksPerSecond')!.value as number});
 const issue=(raw:LiveFieldCoordinationMessageV1|LiveFieldCoordinationEnvelopeV2):LiveFieldCoordinationReceptionV1=>{
  const descriptor=raw&&typeof raw==='object'?Object.getOwnPropertyDescriptor(raw,'schemaVersion'):undefined;
  if(!descriptor)return legacy.issue(raw as LiveFieldCoordinationMessageV1);
  const e=cloneInert(raw) as LiveFieldCoordinationEnvelopeV2;
  if(e.schemaVersion!==2||!e.message||Object.keys(e).some(k=>!['schemaVersion','message','commitment'].includes(k)))throw Error('unsupported live coordination envelope');
  const c=e.commitment===undefined?undefined:readLiveFieldCommitmentV1(e.commitment),m=e.message;
  if(c&&(c.actorId!==m.sourceId||c.revision!==m.revision||c.clock.originTick!==clock.originTick||c.clock.ticksPerSecond!==clock.ticksPerSecond
   ||m.issuedAtElapsedSeconds<c.fromSeconds||m.expiresAtElapsedSeconds>c.throughSeconds||m.payload.kind!=='intent'))throw Error('inconsistent coordination commitment scope');
  const reception=legacy.issue(m);if(c)paths.set(reception,c);return reception;
 };
 const receiveWithCommitments=(query:Parameters<typeof legacy.receive>[0])=>Object.freeze(legacy.receive(query).map(reception=>{
  const commitment=paths.get(reception);
  return Object.freeze({reception,...(commitment?{commitment}: {})});
 }));
 return Object.freeze({issue,receive:legacy.receive,receiveWithCommitments,inspect:legacy.inspect});
}
