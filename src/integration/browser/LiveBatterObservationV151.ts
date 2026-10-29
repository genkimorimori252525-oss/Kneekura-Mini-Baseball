import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import { validateBatterObservedMemoryPolicyV151, type BatterObservedMemoryPolicyV151 } from '../../core/decision/batting/BatterObservedMemoryV151';

/** An explicit operational model, never a measured human/Native calibration. */
export type LiveBatterObservationPolicyV151 = Readonly<{
  version:'live_batter_observation_v151';sourceId:string;ticksPerSecond:number;
  decisionAfterReleaseTicks:number;positionSampleIntervalTicks:number;deliveryLatencyTicks:number;
  maximumForecastAfterReleaseSeconds:number;memoryPolicy:BatterObservedMemoryPolicyV151;
}>;
export const AUTHORED_LIVE_BATTER_OBSERVATION_V151:LiveBatterObservationPolicyV151 = Object.freeze({
  version:'live_batter_observation_v151',sourceId:'authored-position-observer-v151',ticksPerSecond:1_000_000,
  decisionAfterReleaseTicks:140_000,positionSampleIntervalTicks:20_000,deliveryLatencyTicks:0,
  maximumForecastAfterReleaseSeconds:2.5,
  memoryPolicy:Object.freeze({version:'batter_observed_memory_policy_v151',sourceId:'authored-recent-forecast-memory-v151',
    maximumEntriesPerPair:3,unprofiledPriorWeight:.25}),
});
function assert(value:unknown,message:string):asserts value {if(!value)throw Error('live batter observation v151: '+message);}
export function validateLiveBatterObservationPolicyV151(raw:unknown):LiveBatterObservationPolicyV151 {
  const p=cloneInert(raw) as LiveBatterObservationPolicyV151,keys=['version','sourceId','ticksPerSecond','decisionAfterReleaseTicks',
    'positionSampleIntervalTicks','deliveryLatencyTicks','maximumForecastAfterReleaseSeconds','memoryPolicy'];
  assert(p&&typeof p==='object'&&!Array.isArray(p)&&Object.keys(p).length===keys.length&&keys.every(key=>Object.hasOwn(p,key))
    &&p.version==='live_batter_observation_v151'&&typeof p.sourceId==='string'&&p.sourceId.trim()===p.sourceId&&p.sourceId.length>0&&p.sourceId.length<=150,
  'invalid explicit position observation policy');
  assert([p.ticksPerSecond,p.decisionAfterReleaseTicks,p.positionSampleIntervalTicks].every(value=>Number.isSafeInteger(value)&&value>0)
    &&Number.isSafeInteger(p.deliveryLatencyTicks)&&p.deliveryLatencyTicks>=0
    &&Number.isFinite(p.maximumForecastAfterReleaseSeconds)&&p.maximumForecastAfterReleaseSeconds>0&&p.maximumForecastAfterReleaseSeconds<=2.5
    &&p.decisionAfterReleaseTicks<=p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond
    &&Math.ceil(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond/p.positionSampleIntervalTicks)<=512,
  'invalid observation clock or bounded sampling window');
  return Object.freeze({...p,memoryPolicy:validateBatterObservedMemoryPolicyV151(p.memoryPolicy)});
}

/** The physical owner exposes only a position and its canonical event tick.
 * Missing finite Source windows stop capture; no window extension is inferred. */
export function createLiveBatterPositionObserverV151(input:Readonly<{policy:LiveBatterObservationPolicyV151;originTick:number;planeZ:number}>,
  positionAtSeconds:(seconds:number)=>Readonly<{tick:number;position:Vec3}>|null, captureSnapshotV222=false) {
  const p=validateLiveBatterObservationPolicyV151(input.policy),origin=input.originTick,planeZ=input.planeZ;
  assert(Number.isSafeInteger(origin)&&origin>=0&&Number.isFinite(planeZ)
    &&Number.isSafeInteger(origin+Math.ceil(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond)+p.deliveryLatencyTicks),'invalid origin or observation plane');
  const deepFreeze=<T>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value)}return value};
  const cache=new Map<number,ReturnType<typeof forecastObservedPitchV151>>(), snapshots=new Map<number,Readonly<{originTick:number;ticksPerSecond:number;cutoffTick:number;planeZ:number;maximumAfterReleaseSeconds:number;observations:readonly ObservedPitchPositionV151[];forecast:ReturnType<typeof forecastObservedPitchV151>}>>();
  function forecastAt(cutoffTick:number) {
    assert(Number.isSafeInteger(cutoffTick)&&cutoffTick>=origin,'invalid observation cutoff');
    const previous=cache.get(cutoffTick);if(previous)return previous;
    const observations:ObservedPitchPositionV151[]=[],through=Math.min(cutoffTick-origin-p.deliveryLatencyTicks,
      Math.floor(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond));
    for(let offset=p.positionSampleIntervalTicks;offset<=through;offset+=p.positionSampleIntervalTicks){
      const sampled=positionAtSeconds(offset/p.ticksPerSecond);if(sampled===null)break;
      assert(Number.isSafeInteger(sampled.tick)&&sampled.tick>=origin&&Number.isFinite(sampled.position.x)
        &&Number.isFinite(sampled.position.y)&&Number.isFinite(sampled.position.z),'invalid Source position sample');
      if(observations.at(-1)?.observedTick===sampled.tick)continue;
      observations.push({observationId:p.sourceId+':'+sampled.tick,observedTick:sampled.tick,
        availableTick:sampled.tick+p.deliveryLatencyTicks,position:{...sampled.position}});
      if(sampled.position.z<=planeZ)break;
    }
    const result=forecastObservedPitchV151({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,
      maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations});cache.set(cutoffTick,result);
    if(captureSnapshotV222){const selected=result.usedObservationIds.map(id=>observations.find(o=>o.observationId===id)!);
      snapshots.set(cutoffTick,deepFreeze(cloneInert({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations:selected,forecast:result})));}
    return result;
  }
  return Object.freeze({policy:p,decisionTick:origin+p.decisionAfterReleaseTicks,forecastAt,
    ...(captureSnapshotV222?{snapshotAt:(cutoffTick:number)=>{forecastAt(cutoffTick);return snapshots.get(cutoffTick)}}:{})});
}
