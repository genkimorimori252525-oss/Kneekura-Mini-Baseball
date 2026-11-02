import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { forecastObservedPitchV151, type ObservedPitchPositionV151 } from '../../core/decision/batting/ObservedPitchForecastV151';
import {forecastObservedPitchV246,type ObservedPitchForecastPolicyV246} from '../../core/decision/batting/ObservedPitchForecastV246';
import { validateBatterObservedMemoryPolicyV151, type BatterObservedMemoryPolicyV151 } from '../../core/decision/batting/BatterObservedMemoryV151';

/** An explicit operational model, never a measured human/Native calibration. */
export type LiveBatterObservationPolicyV151 = Readonly<{
  version:'live_batter_observation_v151';sourceId:string;ticksPerSecond:number;
  decisionAfterReleaseTicks:number;positionSampleIntervalTicks:number;deliveryLatencyTicks:number;
  maximumForecastAfterReleaseSeconds:number;memoryPolicy:BatterObservedMemoryPolicyV151;
  /** Omitted: decide at the fixed tick. Present: keep watching until the swing
   * must start, so a slower pitch gives a later and better look. */
  commitSwingSeconds?:number;
  /** Share of swings a batter keeps by count, [balls][strikes]. A hitter takes
   * hittable strikes early in a count, then protects the plate with two strikes. */
  countReadinessV1?:readonly (readonly number[])[];
  /** How far outside the zone a batter will expand with two strikes, as swing score. */
  twoStrikeExpansionV1?:number;
  /** Reads the player's speed ceiling at contact instead of over the whole motion. */
  contactSpeedCeilingV1?:boolean;
  /** Share of the follow-through allowance kept: late contact meets a faster bat, so 1 lets the top exit speeds run away. */
  contactSpeedCeilingShareV1?:number;
  /** League-wide bat speed level. A slower target keeps the swing on time, where a tighter ceiling would delay it. */
  targetSpeedScaleV1?:number;
}>;
export const AUTHORED_LIVE_BATTER_OBSERVATION_V151:LiveBatterObservationPolicyV151 = Object.freeze({
  version:'live_batter_observation_v151',sourceId:'authored-position-observer-v151',ticksPerSecond:1_000_000,
  decisionAfterReleaseTicks:140_000,positionSampleIntervalTicks:20_000,deliveryLatencyTicks:0,
  maximumForecastAfterReleaseSeconds:2.5,
  memoryPolicy:Object.freeze({version:'batter_observed_memory_policy_v151',sourceId:'authored-recent-forecast-memory-v151',
    maximumEntriesPerPair:3,unprofiledPriorWeight:.25}),
});
/** The match default from 2026-11-02. Values are provisional until the league calibration. */
export const LIVE_MATCH_BATTER_OBSERVATION_V2:LiveBatterObservationPolicyV151 = Object.freeze({...AUTHORED_LIVE_BATTER_OBSERVATION_V151,
  commitSwingSeconds:.26,contactSpeedCeilingV1:true,targetSpeedScaleV1:.9,twoStrikeExpansionV1:.22,
  countReadinessV1:Object.freeze([[.62,.85,1],[.72,.9,1],[.72,.95,1],[.12,.85,1]].map(row=>Object.freeze(row)))});
function assert(value:unknown,message:string):asserts value {if(!value)throw Error('live batter observation v151: '+message);}
export function validateLiveBatterObservationPolicyV151(raw:unknown):LiveBatterObservationPolicyV151 {
  const p=cloneInert(raw) as LiveBatterObservationPolicyV151,keys=['version','sourceId','ticksPerSecond','decisionAfterReleaseTicks',
    'positionSampleIntervalTicks','deliveryLatencyTicks','maximumForecastAfterReleaseSeconds','memoryPolicy'];
  if(Object.hasOwn(p,'commitSwingSeconds')){keys.push('commitSwingSeconds');assert(Number.isFinite(p.commitSwingSeconds)&&p.commitSwingSeconds!>0&&p.commitSwingSeconds!<=1,'invalid commit swing seconds');}
  if(Object.hasOwn(p,'countReadinessV1')){keys.push('countReadinessV1');assert(Array.isArray(p.countReadinessV1)&&p.countReadinessV1.length===4&&p.countReadinessV1.every(row=>Array.isArray(row)&&row.length===3&&row.every(v=>Number.isFinite(v)&&v>=0&&v<=1)),'invalid count readiness');}
  if(Object.hasOwn(p,'targetSpeedScaleV1')){keys.push('targetSpeedScaleV1');assert(Number.isFinite(p.targetSpeedScaleV1)&&p.targetSpeedScaleV1!>=.5&&p.targetSpeedScaleV1!<=1.5,'invalid target speed scale');}
  if(Object.hasOwn(p,'contactSpeedCeilingShareV1')){keys.push('contactSpeedCeilingShareV1');assert(Number.isFinite(p.contactSpeedCeilingShareV1)&&p.contactSpeedCeilingShareV1!>=0&&p.contactSpeedCeilingShareV1!<=1,'invalid contact speed share');}
  if(Object.hasOwn(p,'contactSpeedCeilingV1')){keys.push('contactSpeedCeilingV1');assert(typeof p.contactSpeedCeilingV1==='boolean','invalid contact speed ceiling');}
  if(Object.hasOwn(p,'twoStrikeExpansionV1')){keys.push('twoStrikeExpansionV1');assert(Number.isFinite(p.twoStrikeExpansionV1)&&p.twoStrikeExpansionV1!>=0&&p.twoStrikeExpansionV1!<=1,'invalid two strike expansion');}
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
export function createLiveBatterPositionObserverV151(input:Readonly<{policy:LiveBatterObservationPolicyV151;originTick:number;planeZ:number;forecastPolicyV246?:ObservedPitchForecastPolicyV246;motorLatencySeconds?:number}>,
  positionAtSeconds:(seconds:number)=>Readonly<{tick:number;position:Vec3}>|null, captureSnapshotV222=false) {
  const p=validateLiveBatterObservationPolicyV151(input.policy),origin=input.originTick,planeZ=input.planeZ;
  assert(Number.isSafeInteger(origin)&&origin>=0&&Number.isFinite(planeZ)
    &&Number.isSafeInteger(origin+Math.ceil(p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond)+p.deliveryLatencyTicks),'invalid origin or observation plane');
  const deepFreeze=<T>(value:T):T=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.values(value).forEach(deepFreeze);Object.freeze(value)}return value};
  const policyDescriptor=Object.getOwnPropertyDescriptor(input,'forecastPolicyV246');
  assert(policyDescriptor===undefined||'value' in policyDescriptor,'V246 policy must be inert data');
  const policyV246=policyDescriptor===undefined?undefined:deepFreeze(cloneInert(policyDescriptor.value as ObservedPitchForecastPolicyV246));
  if(policyDescriptor!==undefined)forecastObservedPitchV246({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick:origin,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations:[]},policyV246!);
  const observationsV246=new Map<number,readonly ObservedPitchPositionV151[]>(),resultsV246=new Map<number,ReturnType<typeof forecastObservedPitchV246>>();
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
    if(policyV246)observationsV246.set(cutoffTick,deepFreeze(cloneInert(observations.filter(o=>o.observedTick<=cutoffTick&&o.availableTick<=cutoffTick).sort((a,b)=>a.observedTick-b.observedTick).slice(-7))));
    const result=forecastObservedPitchV151({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,
      maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations});cache.set(cutoffTick,result);
    if(captureSnapshotV222){const selected=result.usedObservationIds.map(id=>observations.find(o=>o.observationId===id)!);
      snapshots.set(cutoffTick,deepFreeze(cloneInert({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations:selected,forecast:result})));}
    return result;
  }
  function forecastAtV246(cutoffTick:number) {
    assert(policyV246,'V246 policy not supplied');forecastAt(cutoffTick);const cached=resultsV246.get(cutoffTick);if(cached)return cached;
    const observations=observationsV246.get(cutoffTick)!;const result=deepFreeze(forecastObservedPitchV246({originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,observations},policyV246));resultsV246.set(cutoffTick,result);return result;
  }
  /** Each step reads only what was observed by that tick, so the commitment
   * time comes from the batter's own forecast and never from the true arrival. */
  function commitTick() {
    let tick=origin+p.decisionAfterReleaseTicks;
    if(p.commitSwingSeconds===undefined)return tick;
    const lead=p.commitSwingSeconds+(input.motorLatencySeconds??0);
    for(;;){
      const seen=forecastAt(tick).prediction;
      if(!seen||(tick-origin)/p.ticksPerSecond+lead>=seen.arrivalAfterReleaseSeconds)return tick;
      const next=tick+p.positionSampleIntervalTicks;
      if(next-origin>p.maximumForecastAfterReleaseSeconds*p.ticksPerSecond||forecastAt(next).status!=='PREDICTED')return tick;
      tick=next;
    }
  }
  return Object.freeze({policy:p,decisionTick:commitTick(),forecastAt,
    ...(captureSnapshotV222?{snapshotAt:(cutoffTick:number)=>{forecastAt(cutoffTick);return snapshots.get(cutoffTick)}}:{}),
    ...(policyV246?{forecastAtV246,snapshotAtV246:(cutoffTick:number)=>{const result=forecastAtV246(cutoffTick);return deepFreeze({version:'live_observed_forecast_snapshot_v246' as const,originTick:origin,ticksPerSecond:p.ticksPerSecond,cutoffTick,planeZ,maximumAfterReleaseSeconds:p.maximumForecastAfterReleaseSeconds,policy:policyV246,observations:observationsV246.get(cutoffTick)!,result});}}:{})});
}
