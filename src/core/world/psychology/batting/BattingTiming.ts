import { fail, integer, text } from '../EmotionValidation';
import { safeTickSum } from '../execution/ExecutionValidation';
export type AvailablePrediction = Readonly<{ predictionId: string; observedTick: number; availableTick: number }>;
/** Select only information delivered before commitment; late delivery of an old observation cannot replace newer knowledge. */
export function selectPredictionAt<T extends AvailablePrediction>(items: readonly T[], cutoff: number): T | null {
 integer(cutoff,'batting.cutoff');
 const ids=new Set<string>(),instants=new Set<number>();let chosen:T|null=null;
 for(const item of items){
  text(item.predictionId,'batting.predictionId');integer(item.observedTick,'batting.observedTick');integer(item.availableTick,'batting.availableTick');
  if(item.availableTick<item.observedTick || ids.has(item.predictionId) || instants.has(item.observedTick))fail('INVALID_INPUT','batting.predictionChronology');
  ids.add(item.predictionId);instants.add(item.observedTick);
  if(item.availableTick<=cutoff && (chosen===null || item.observedTick>chosen.observedTick))chosen=item;
 }
 return chosen;
}
/** Decision readiness gates, but does not pre-empt, a source-owned preferred motor onset. */
export function resolveMotorStart(preferred:number,commit:number,ready:number,latency:number):number {
 for(const value of [preferred,commit,ready,latency])integer(value,'batting.motorTiming');
 return Math.max(preferred,ready,safeTickSum(commit,latency,'batting.motorLatency'));
}
