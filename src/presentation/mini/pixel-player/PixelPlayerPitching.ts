import { MINI_PRESENTATION_CADENCE_MICROS } from '../model';
// Structural read-only consumer of the approved Core timeline, not a timing resolver.
export type ObservedPitchMotionTimeline=Readonly<{readyAtUs:number;motionStartUs:number;gatherEndUs:number;strideStartUs:number;releaseUs:number;followThroughEndUs:number}>;
export function selectPitchFrame(tick:number,t:ObservedPitchMotionTimeline):0|1|2|3 {
  const times=[t.readyAtUs,t.motionStartUs,t.gatherEndUs,t.strideStartUs,t.releaseUs,t.followThroughEndUs];
  if(!Number.isSafeInteger(tick)||!times.every(v=>Number.isSafeInteger(v)&&v>=0)||times.some((v,i)=>i>0&&v<times[i-1])||t.gatherEndUs<t.motionStartUs+MINI_PRESENTATION_CADENCE_MICROS) throw new Error('Invalid canonical pitch timeline; fixed first frame needs 55ms');
  if(tick<t.motionStartUs+MINI_PRESENTATION_CADENCE_MICROS) return 0;
  if(tick<t.strideStartUs) return 1;
  if(tick<t.releaseUs) return 2;
  return 3;
}
