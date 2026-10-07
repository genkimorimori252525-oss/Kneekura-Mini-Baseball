import type { CanonicalPresentationSample } from '../model';
import type { TimedMatchEvent } from '../../../core/model/TimedMatchEvent';
import { buildMiniPresentationTimeline } from '../MiniPresentationTimeline';
import type { CompiledPixelAsset } from './PixelPlayerModel';
import { createPixelReviewCamera, type PixelCameraMode } from './PixelPlayerCamera';
import { selectPitchFrame, type ObservedPitchMotionTimeline } from './PixelPlayerPitching';
import { buildPixelPlayerScene, type PixelActorObservation, type PixelScene } from './PixelPlayerScene';
export type PixelReplayFrame=Readonly<{tick:number;cameraMode:PixelCameraMode;cutReason?:'live_batted_ball_contact';scene:PixelScene}>;
export function buildPixelPlayerReplay(samples:readonly CanonicalPresentationSample[],events:readonly TimedMatchEvent[],actors:ReadonlyMap<number,readonly PixelActorObservation[]>,asset:CompiledPixelAsset,initialCamera:PixelCameraMode='BATTER_POV',pitch:ReadonlyMap<string,ObservedPitchMotionTimeline>=new Map()):readonly PixelReplayFrame[]{
 const ticks=new Set(samples.map(s=>s.world.tick));
 if(samples.length){
  const first=samples[0].world.tick,last=samples[samples.length-1].world.tick;
  for(const t of pitch.values())if(t.releaseUs>=first&&t.releaseUs<=last&&!ticks.has(t.releaseUs))throw new Error(`Missing exact release sample at ${t.releaseUs}`);
 }
 return buildMiniPresentationTimeline(samples,events).map(frame=>{
  const input=actors.get(frame.tick);
  if(!input)throw new Error(`Missing actor observations at ${frame.tick}`);
  const context=input.map(actor=>{
   const t=pitch.get(actor.playerId);
   if(t&&actor.role==='pitcher')return {...actor,facts:{...actor.facts,action:'pitching' as const,phase:selectPitchFrame(frame.tick,t)}};
   if(actor.role==='batter'){
    const batter=frame.sample.batter;
    if(actor.facts.hand!==batter.handedness)throw new Error('Batter context handedness contradicts canonical observation');
    return {...actor,batterState:batter,facts:{...actor.facts,action:batter.action==='normal_swing'?'batting' as const:batter.action,phase:batter.action==='idle'?0 as const:actor.facts.phase}};
   }
   return actor;
  });
  const cameraMode=frame.cameraMode==='FIELD_OVERHEAD'?'FIELD_OVERHEAD':initialCamera;
  const scene=buildPixelPlayerScene(frame.sample.world,context,asset,createPixelReviewCamera(cameraMode,frame.sample.batter.handedness),frame.events);
  return {tick:frame.tick,cameraMode,cutReason:frame.cutReason,scene};
 });
}
