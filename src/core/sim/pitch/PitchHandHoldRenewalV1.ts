import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { validateControlledHeldPitchV1,sampleControlledPitchHandV1,type ControlledHeldPitchV1,type ControlledHeldPitchAnchorsV1 } from './ControlledHeldPitchV1';

export type PitchHandHoldRenewalV1=Readonly<{
  version:'pitch_hand_hold_renewal_v1';fromTick:number;throughTick:number;sceneThroughTick:number;
}>;
const fields=(v:unknown,k:readonly string[])=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join('|')===[...k].sort().join('|');
const tick=(v:number)=>Number.isSafeInteger(v)&&v>=0;
const freeze=<T>(v:T):T=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
function assert(v:unknown,message:string):asserts v {if(!v)throw new Error('pitch hand hold renewal: '+message);}

/** An EXPLICIT successor command at an already stationary endpoint. This
 * never extends the predecessor, infers possession, invents rest or accepts
 * a caller's replacement hand position. A moving endpoint needs a different
 * continuous recovery law. The physical owner must authenticate scene lifetime. */
export function createPitchHandHoldRenewalV1(originalMotion:ControlledHeldPitchV1,originalAnchors:ControlledHeldPitchAnchorsV1,raw:PitchHandHoldRenewalV1){
  const motion=cloneInert(originalMotion),anchors=cloneInert(originalAnchors),request=cloneInert(raw);
  assert(fields(request,['version','fromTick','throughTick','sceneThroughTick'])&&request.version==='pitch_hand_hold_renewal_v1'
    &&[request.fromTick,request.throughTick,request.sceneThroughTick].every(tick)
    &&request.fromTick===anchors.followThroughEndTick&&request.throughTick>request.fromTick&&request.throughTick<=request.sceneThroughTick,'invalid original deadline or finite scene');
  const originalBinding=validateControlledHeldPitchV1(motion,anchors),endpoint=sampleControlledPitchHandV1(motion,request.fromTick);
  assert(Object.values(endpoint.velocity).every(v=>v===0),'hold requires the exact resting endpoint; recovery cannot be invented');
  const sampleContinuous=(atTick:number)=>{
    assert(Number.isFinite(atTick)&&atTick>=request.fromTick&&atTick<=request.throughTick,'sample outside successor hand command');
    return {tick:atTick,position:{...endpoint.position},velocity:{...endpoint.velocity}};
  };
  return Object.freeze({request:freeze(request),initialHand:freeze(endpoint),sampleContinuous,
    predecessorChanged:false as const,maximumHandSpeedMps:0 as const,positionCorrected:false as const,
    nativeAdmission:false as const,requiresOriginalSceneOwnership:true as const,originalBinding:freeze(originalBinding)});
}
