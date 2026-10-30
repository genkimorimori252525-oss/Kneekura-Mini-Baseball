import {describe,it,expect} from 'vitest';
import {forecastObservedPitchV151,type ObservedPitchPositionV151} from './ObservedPitchForecastV151';
import {forecastObservedPitchV246} from './ObservedPitchForecastV246';
const policy={version:'observed_pitch_forecast_policy_v246' as const,maximumExtrapolationRatio:10,minimumQrDiagonalRatio:1e-10,minimumForwardSpeedMps:1e-6,maximumRootBracketTicks:.01,maximumPlaneResidualMeters:1e-7};
function input(originTick=0,kind:'linear'|'quadratic'|'cubic'='cubic'){
 const times=[.02,.043,.061,.079,.10,.123,.14],coeff=kind==='linear'?0:kind==='quadratic'?1:.2;
 const observations:ObservedPitchPositionV151[]=times.map((t,i)=>({observationId:'p'+i,observedTick:originTick+Math.round(t*1e6),availableTick:originTick+Math.round(t*1e6),position:{x:1+2*t+(kind==='linear'?0:3*t*t)+(kind==='cubic'?.5*t*t*t:0),y:2-t,z:10-20*t+(kind==='linear'?0:t*t)+(kind==='cubic'?coeff*t*t*t:0)}}));
 return {originTick,ticksPerSecond:1000000,cutoffTick:originTick+140000,planeZ:0,maximumAfterReleaseSeconds:2,observations};
}
describe('explicit causal cubic forecast',()=>{
 it.each(['linear','quadratic','cubic'] as const)('preserves p/v/a at one arrival anchor for %s',kind=>{
  const source=input(1_000_000_000_000,kind),out=forecastObservedPitchV246(source,policy);expect(out.diagnostics.effectiveModel).toBe('CUBIC_QR_V246');expect(out.forecast.status).toBe('PREDICTED');if(out.forecast.status!=='PREDICTED'||!out.forecast.prediction)throw Error('prediction missing');
  const t=(out.diagnostics.anchorTick!-source.originTick)/source.ticksPerSecond,p=out.forecast.prediction,quad=kind!=='linear',cubic=kind==='cubic';
  expect(p.position.x).toBeCloseTo(1+2*t+(quad?3*t*t:0)+(cubic?.5*t**3:0),8);expect(p.estimatedVelocity.x).toBeCloseTo(2+(quad?6*t:0)+(cubic?1.5*t*t:0),8);expect(p.estimatedAcceleration.x).toBeCloseTo((quad?6:0)+(cubic?3*t:0),8);expect(p.position.z).toBeCloseTo(0,7);expect(p.estimatedVelocity.z).toBeLessThan(0);
 });
 it('ignores finite future and undelivered changes and is deterministic',()=>{
  const source=input(),a=forecastObservedPitchV246(source,policy),future={observationId:'future',observedTick:160000,availableTick:180000,position:{x:100,y:-100,z:100}};
  expect(forecastObservedPitchV246({...source,observations:[...source.observations,future]},policy)).toEqual(a);expect(forecastObservedPitchV246(source,policy)).toEqual(a);
 });
 it('calls V151 exactly for insufficient points, QR conditioning, extrapolation bound and uncertain crossing',()=>{
  const source=input(),cases=[{source:{...source,observations:source.observations.slice(0,3)},policy,reason:'INSUFFICIENT_OBSERVATIONS'}, {source,policy:{...policy,minimumQrDiagonalRatio:.99},reason:'QR_CONDITION'}, {source,policy:{...policy,maximumExtrapolationRatio:.1},reason:'EXTRAPOLATION_LIMIT'}, {source,policy:{...policy,minimumForwardSpeedMps:1000},reason:'UNCERTAIN_CROSSING'}];
  for(const c of cases){const out=forecastObservedPitchV246(c.source,c.policy);expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:c.reason});expect(out.forecast).toEqual(forecastObservedPitchV151(c.source));}
 });
 it('preserves V151 errors for duplicate and nonfinite observations',()=>{
  const source=input(),duplicate={...source,observations:[...source.observations,source.observations[0]]},bad={...source,observations:source.observations.map((v,i)=>i===0?{...v,position:{...v.position,x:NaN}}:v)};
  for(const value of [duplicate,bad]){let legacy:unknown;try{forecastObservedPitchV151(value)}catch(e){legacy=e}expect(legacy).toBeInstanceOf(Error);expect(()=>forecastObservedPitchV246(value,policy)).toThrow((legacy as Error).message);}
 });
 it('rejects invalid experimental policy without inventing defaults',()=>{expect(()=>forecastObservedPitchV246(input(),{...policy,maximumExtrapolationRatio:0})).toThrow(/policy/);});
});
it('falls back rather than skipping an uncertain tangent before a later crossing',()=>{
 const source=input(),observations=source.observations.map(o=>{const t=o.observedTick/1e6;return {...o,position:{...o.position,z:(t-.3)**2*(1-t)}}});
 const raw={...source,observations},out=forecastObservedPitchV246(raw,policy);expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'UNCERTAIN_CROSSING'});expect(out.forecast).toEqual(forecastObservedPitchV151(raw));
});
it('records nonfinite cubic fitting separately while preserving the V151 result',()=>{
 const source=input(),raw={...source,observations:source.observations.map(o=>({...o,position:{...o.position,x:1e308}}))},out=forecastObservedPitchV246(raw,policy);
 expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'NONFINITE_COEFFICIENT'});expect(out.forecast).toEqual(forecastObservedPitchV151(raw));
});
it('ignores undelivered values even when their position is nonfinite or their ID repeats',()=>{
 const source=input(),expected=forecastObservedPitchV246(source,policy),future={observationId:source.observations[0].observationId,observedTick:160000,availableTick:180000,position:{x:NaN,y:Infinity,z:-Infinity}};
 expect(forecastObservedPitchV246({...source,observations:[...source.observations,future]},policy)).toEqual(expected);
});
it('chooses the earliest decreasing crossing of a three-root cubic',()=>{
 const source=input(),observations=source.observations.map(o=>{const t=o.observedTick/1e6;return {...o,position:{...o.position,z:(.3-t)*(.6-t)*(.9-t)}}});
 const out=forecastObservedPitchV246({...source,observations},policy);expect(out.diagnostics.effectiveModel).toBe('CUBIC_QR_V246');expect(out.diagnostics.anchorTick!/1e6).toBeCloseTo(.3,6);
});
it('preserves the old empty-window status under fallback',()=>{
 const source={...input(),observations:[]};const out=forecastObservedPitchV246(source,policy);expect(out.forecast).toEqual(forecastObservedPitchV151(source));expect(out.forecast.status).toBe('NO_DELIVERED_OBSERVATIONS');
});
it('ignores payloads older than the latest seven delivered times',()=>{
 const source=input(),older=[{observationId:'old-1',observedTick:1000,availableTick:1000,position:{x:1,y:2,z:3}},{observationId:'old-2',observedTick:2000,availableTick:2000,position:{x:1,y:2,z:3}}],all={...source,observations:[...older,...source.observations]},expected=forecastObservedPitchV246(all,policy);
 const changed={...all,observations:[{...older[0],observationId:'p0',position:{x:NaN,y:Infinity,z:-Infinity}},older[1],...source.observations]};expect(forecastObservedPitchV246(changed,policy)).toEqual(expected);
});
it('does not select a later crossing when no forward crossing exists',()=>{
 const source=input(),raw={...source,observations:source.observations.map(o=>({...o,position:{...o.position,z:10+o.observedTick/1e6}}))},out=forecastObservedPitchV246(raw,policy);expect(out.diagnostics.effectiveModel).toBe('V151');expect(out.forecast).toEqual(forecastObservedPitchV151(raw));expect(out.forecast.status).toBe('NO_FORWARD_CROSSING');
});
it('reports the effective V151 anchor and its own observation width during successful fallback',()=>{
 const source={...input(),observations:input().observations.slice(0,3)},legacy=forecastObservedPitchV151(source),out=forecastObservedPitchV246(source,policy);expect(legacy.status).toBe('PREDICTED');if(!legacy.prediction)throw Error('legacy prediction unavailable');
 expect(out.diagnostics.anchorTick).toBe(source.originTick+legacy.prediction.arrivalAfterReleaseSeconds*source.ticksPerSecond);expect(out.diagnostics.observationWindowTicks).toBe(source.observations[2].observedTick-source.observations[0].observedTick);expect(out.diagnostics.usedObservationIds).toEqual(legacy.usedObservationIds);expect(out.forecast).toEqual(legacy);
});
it('never skips a first crossing before cutoff to use a later decreasing root',()=>{
 const base=input(),observations=base.observations.map(o=>{const t=o.observedTick/1e6;return {...o,position:{...o.position,z:(.3-t)*(.6-t)*(.9-t)}}}),raw={...base,cutoffTick:700000,observations},out=forecastObservedPitchV246(raw,policy);
 expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'FIRST_CROSSING_BEFORE_CUTOFF'});expect(out.forecast).toEqual(forecastObservedPitchV151(raw));
 const undelivered={observationId:'unavailable',observedTick:500000,availableTick:800000,position:{x:999,y:999,z:-999}};expect(forecastObservedPitchV246({...raw,observations:[...observations,undelivered]},policy)).toEqual(out);
});
it('distinguishes a first crossing before, at and after the decision cutoff',()=>{
 const base=input(),observations=base.observations.map(o=>{const t=o.observedTick/1e6;return {...o,position:{...o.position,z:.3-t}}});
 const before={...base,observations,cutoffTick:299000},at={...base,observations,cutoffTick:300000},after={...base,observations,cutoffTick:301000};
 const r1=forecastObservedPitchV246(before,policy),r2=forecastObservedPitchV246(at,policy),r3=forecastObservedPitchV246(after,policy);
 expect(r1.diagnostics.effectiveModel).toBe('CUBIC_QR_V246');expect(r2.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'UNCERTAIN_CROSSING_AT_CUTOFF'});expect(r2.forecast).toEqual(forecastObservedPitchV151(at));
 expect(r3.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'FIRST_CROSSING_BEFORE_CUTOFF'});expect(r3.forecast).toEqual(forecastObservedPitchV151(after));
});
it('falls back when a mathematical cutoff crossing is numerically just before cutoff',()=>{
 const base=input(),observations=base.observations.map(o=>{const t=o.observedTick/1e6;return {...o,position:{...o.position,z:(.3-t)*(.6-t)*(.9-t)}}}),raw={...base,cutoffTick:300000,observations},out=forecastObservedPitchV246(raw,policy);
 expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'UNCERTAIN_CROSSING_AT_CUTOFF'});expect(out.forecast).toEqual(forecastObservedPitchV151(raw));
});
it.each([-0.025,0.025])('does not claim exact cutoff equality when large-clock root is offset by %s tick',offset=>{
 const origin=1_000_000_000_000_000,base=input(origin),cutoff=origin+300000,rootSeconds=(300000+offset)/1e6,observations=base.observations.map(o=>{const t=(o.observedTick-origin)/1e6;return {...o,position:{...o.position,z:rootSeconds-t}}}),raw={...base,cutoffTick:cutoff,observations},out=forecastObservedPitchV246(raw,policy);
 expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'UNCERTAIN_CROSSING_AT_CUTOFF'});expect(out.forecast).toEqual(forecastObservedPitchV151(raw));
});
it('preserves V151 when even a linear cutoff equality is not certified by the fit',()=>{
 const observations=Array.from({length:7},(_,i)=>({observationId:'exact-'+i,observedTick:i+1,availableTick:i+1,position:{x:1,y:1,z:(7-i)/8}}));
 const raw={originTick:0,ticksPerSecond:8,cutoffTick:8,planeZ:0,maximumAfterReleaseSeconds:2,observations},out=forecastObservedPitchV246(raw,policy);
 expect(out.diagnostics).toMatchObject({effectiveModel:'V151',fallbackReason:'UNCERTAIN_CROSSING_AT_CUTOFF'});expect(out.forecast).toEqual(forecastObservedPitchV151(raw));expect(out.diagnostics.anchorTick).toBe(8);
});
