import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {observeBattedBallSpinV123} from '../../core/sim/contact/BattedBallSpinObservationV123';
import {createLiveBatPlaybackV88} from './LiveBatPlaybackV88';
import {simulateLivePitchV1,type LivePitchInputV1} from './LivePitchV1';
import {cloneValidatedMeasuredCatalogV81} from './MeasuredClipValidationCacheV81';
import {liveSpinRepertoireClipsV124} from './LiveSpinControlV123';

/** Two executions of the ordinary engine with identical Source/seed. This
 * read-only trial neither certifies mastery nor changes equipment or ability.
 * Returned spin is the actual rigid contact, including the wrong sign/misses. */
export function simulateSpinControlWorkbenchV124(input:LivePitchInputV1){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))throw Error('inert spin trial input required');
 const descriptor=Object.getOwnPropertyDescriptor(input,'measuredClips'),other={};
 if(!descriptor||!descriptor.enumerable||!('value'in descriptor))throw Error('inert measured catalog required');
 for(const key of Reflect.ownKeys(input))if(key!=='measuredClips')Object.defineProperty(other,key,Object.getOwnPropertyDescriptor(input,key)!);
 const safe={...cloneInert(other) as Omit<LivePitchInputV1,'measuredClips'>,measuredClips:cloneValidatedMeasuredCatalogV81(descriptor.value)};
 const {spinControlV123:_profile,...ordinaryBatter}=safe.batter;
 const ordinary=simulateLivePitchV1({...safe,batter:ordinaryBatter,measuredClips:liveSpinRepertoireClipsV124(ordinaryBatter,safe.measuredClips)}),
  requested=simulateLivePitchV1({...safe,measuredClips:liveSpinRepertoireClipsV124(safe.batter,safe.measuredClips)});
 const summarize=(result:ReturnType<typeof simulateLivePitchV1>)=>{
  const descriptor=result.diagnostics.batPlaybackV88,clip=safe.measuredClips.find(c=>c.id===result.clipId)!;
  const playback=descriptor?createLiveBatPlaybackV88({descriptor,measuredClip:clip}):null;
  const batPath=[];
  if(playback)for(let index=0;index<=128;index++){
   const tick=Math.round(safe.originTick+(playback.throughTick-safe.originTick)*index/128),bat=playback.sampleAtTick(tick);
   if(bat)batPath.push({tick,...bat});
  }
  return {clipId:result.clipId,call:result.call,endedAtTick:result.endedAtTick,batPath,
   contact:result.contact?{exitVelocity:result.contact.exitVelocity,exitSpin:result.contact.exitSpin}:null,
   spin:result.contact?observeBattedBallSpinV123({velocityMps:result.contact.exitVelocity,spinRadPerSecond:result.contact.exitSpin,bats:safe.batter.bats}):null};
 };
 return cloneInert({version:'spin_control_workbench_v124' as const,boundary:'LOCAL_AUTHORING_PREVIEW' as const,nativeAdmission:false as const,
  seed:safe.seed,originTick:safe.originTick,ordinary:summarize(ordinary),requested:{...summarize(requested),intent:requested.diagnostics.spinIntentV123??null}});
}
