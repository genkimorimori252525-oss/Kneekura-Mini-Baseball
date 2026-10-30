import {expect,it} from 'vitest';
import {forecastObservedPitchV246,type ObservedPitchForecastPolicyV246} from '../../core/decision/batting/ObservedPitchForecastV246';
import {AUTHORED_LIVE_BATTER_OBSERVATION_V151,createLiveBatterPositionObserverV151} from './LiveBatterObservationV151';
const originTick=1000000,policy:ObservedPitchForecastPolicyV246={version:'observed_pitch_forecast_policy_v246',maximumExtrapolationRatio:10,minimumQrDiagonalRatio:1e-10,minimumForwardSpeedMps:1e-6,maximumRootBracketTicks:.01,maximumPlaneResidualMeters:1e-7};
const observationPolicy={...AUTHORED_LIVE_BATTER_OBSERVATION_V151,sourceId:'v246-test'};
const sample=(seconds:number)=>({tick:originTick+Math.round(seconds*1e6),position:{x:1+seconds**3,y:2-seconds,z:10-20*seconds+seconds**2+.2*seconds**3}});
it('keeps the old surface unchanged when no V246 policy is supplied',()=>{
 let calls=0;const old=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0},s=>{calls++;return sample(s)});
 expect(Object.keys(old)).toEqual(['policy','decisionTick','forecastAt']);old.forecastAt(originTick+140000);expect(calls).toBe(7);old.forecastAt(originTick+140000);expect(calls).toBe(7);
});
it('captures one delivered seven-point source while preserving the legacy three-point snapshot',()=>{
 let calls=0;const observer=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:policy},s=>{calls++;return sample(s)},true),cutoff=originTick+140000;
 const result=observer.forecastAtV246!(cutoff),legacy=observer.forecastAt(cutoff),oldSnapshot=observer.snapshotAt!(cutoff)!,snapshot=observer.snapshotAtV246!(cutoff)!;
 expect(calls).toBe(7);expect(oldSnapshot.observations).toHaveLength(3);expect(snapshot.observations).toHaveLength(7);expect(oldSnapshot.forecast).toEqual(legacy);
 expect(snapshot.result).toEqual(result);expect(result).toEqual(forecastObservedPitchV246({originTick,ticksPerSecond:observationPolicy.ticksPerSecond,cutoffTick:cutoff,planeZ:0,maximumAfterReleaseSeconds:observationPolicy.maximumForecastAfterReleaseSeconds,observations:snapshot.observations},snapshot.policy));
 const separate=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0},sample,true);expect(legacy).toEqual(separate.forecastAt(cutoff));expect(oldSnapshot).toEqual(separate.snapshotAt!(cutoff));expect(observer.snapshotAtV246!(cutoff)).toEqual(snapshot);expect(calls).toBe(7);
});
it('retains exact V151 fallback when delivered observations are insufficient or absent',()=>{
 const observer=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:policy},sample,true);
 for(const cutoff of [originTick,originTick+40000]){const result=observer.forecastAtV246!(cutoff);expect(result.diagnostics.fallbackReason).toBe('INSUFFICIENT_OBSERVATIONS');expect(result.forecast).toEqual(observer.forecastAt(cutoff));expect(observer.snapshotAtV246!(cutoff)!.observations.length).toBeLessThan(4);}
});
it('never reads after delivery cutoff and ignores changed future Source values',()=>{
 const p={...observationPolicy,deliveryLatencyTicks:20000},make=(changed:boolean)=>{const seen:number[]=[];const o=createLiveBatterPositionObserverV151({policy:p,originTick,planeZ:0,forecastPolicyV246:policy},s=>{seen.push(s);if(s>.12)return changed?{...sample(s),position:{x:999,y:999,z:999}}:sample(s);return sample(s)});return {o,seen}};
 const a=make(false),b=make(true),cutoff=originTick+140000;expect(a.o.forecastAtV246!(cutoff)).toEqual(b.o.forecastAtV246!(cutoff));expect(a.o.snapshotAtV246!(cutoff)!.observations.every(x=>x.availableTick<=cutoff)).toBe(true);expect(Math.max(...a.seen)).toBeLessThanOrEqual(.12);expect(a.seen).toEqual(b.seen);
});
it('rejects invalid explicit V246 policy before observing Source',()=>{
 let calls=0;expect(()=>createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:{...policy,maximumExtrapolationRatio:0}},()=>{calls++;return null})).toThrow(/policy/);expect(calls).toBe(0);
});
it('rejects null, undefined and accessor V246 policies without reading Source',()=>{
 let calls=0,reads=0;const source=()=>{calls++;return null};
 for(const value of [null,undefined])expect(()=>createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:value as never},source)).toThrow();
 const input={policy:observationPolicy,originTick,planeZ:0};Object.defineProperty(input,'forecastPolicyV246',{enumerable:true,get(){reads++;return policy}});expect(()=>createLiveBatterPositionObserverV151(input,source)).toThrow();expect(reads).toBe(0);expect(calls).toBe(0);
});
it('retains at most seven most recent delivered positions at a later cutoff',()=>{
 let calls=0;const observer=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:policy},s=>{calls++;return sample(s)},true),cutoff=originTick+200000;
 const snapshot=observer.snapshotAtV246!(cutoff)!;expect(calls).toBe(10);expect(snapshot.observations).toHaveLength(7);expect(snapshot.observations[0].observedTick).toBe(originTick+80000);expect(observer.snapshotAt!(cutoff)!.observations).toHaveLength(3);
});
it('stops at a missing Source sample and preserves exact fallback',()=>{
 const seen:number[]=[],observer=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:policy},s=>{seen.push(s);return s>.04?null:sample(s)},true),cutoff=originTick+140000;
 const result=observer.forecastAtV246!(cutoff);expect(result.diagnostics.fallbackReason).toBe('INSUFFICIENT_OBSERVATIONS');expect(result.forecast).toEqual(observer.forecastAt(cutoff));expect(observer.snapshotAtV246!(cutoff)!.observations).toHaveLength(2);expect(seen).toEqual([.02,.04,.06]);
});
it('selects the latest seven by observed tick even when Source returns them out of order',()=>{
 const ticks=[180000,20000,160000,40000,140000,60000,120000,80000,100000,200000];let index=0;
 const observer=createLiveBatterPositionObserverV151({policy:observationPolicy,originTick,planeZ:0,forecastPolicyV246:policy},()=>sample(ticks[index++]/1e6),true),snapshot=observer.snapshotAtV246!(originTick+200000)!;
 expect(snapshot.observations.map(x=>x.observedTick)).toEqual([1080000,1100000,1120000,1140000,1160000,1180000,1200000]);
});
