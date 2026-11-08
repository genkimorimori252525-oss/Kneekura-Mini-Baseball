import {describe,it,expect} from 'vitest';
import {fitCausalForecastV245,positionAtCausalForecastV245} from './causal-forecast-pilot-v245';
const observations=Array.from({length:7},(_,i)=>{const t=(i+1)*.02;return {observationId:String(i),observedTick:(i+1)*20000,availableTick:(i+1)*20000,position:{x:1+2*t+3*t*t,y:2-t,z:10-20*t+t*t}}});
const input={originTick:0,ticksPerSecond:1000000,cutoffTick:140000,planeZ:0,maximumAfterReleaseSeconds:2,observations};
describe('causal forecast pilot',()=>{
 it('recovers a quadratic from delivered samples and returns a forward crossing',()=>{const result=fitCausalForecastV245(input,2);expect(result.status).toBe('PREDICTED');if(result.status==='PREDICTED'){const t=.3,p=positionAtCausalForecastV245(result,t*1e6);expect(p.x).toBeCloseTo(1+2*t+3*t*t,10);expect(p.z).toBeCloseTo(10-20*t+t*t,10);expect(result.arrivalTick).toBeGreaterThan(input.cutoffTick);}});
 it('ignores points not delivered at cutoff and rejects insufficient rank',()=>{const extra={observationId:'future',observedTick:160000,availableTick:160000,position:{x:999,y:999,z:999}};expect(fitCausalForecastV245({...input,observations:[...observations,extra]},2)).toEqual(fitCausalForecastV245(input,2));expect(fitCausalForecastV245({...input,observations:observations.slice(0,3)},3)).toMatchObject({status:'UNASSESSED',reason:'INSUFFICIENT_OBSERVATIONS'});});
 it('rejects no forward crossing instead of inventing a target',()=>{const away=observations.map(o=>({...o,position:{...o.position,z:10+o.observedTick/1e6}}));expect(fitCausalForecastV245({...input,observations:away},2)).toMatchObject({status:'UNASSESSED',reason:'NO_FORWARD_CROSSING'});});
});
it('recovers cubic curvature on unequal observation times and rejects delivery after cutoff',()=>{
 const ticks=[10000,33000,51000,79000,100000,123000,140000],obs=ticks.map((tick,i)=>{const t=tick/1e6;return {observationId:'c'+i,observedTick:tick,availableTick:tick,position:{x:1+t*t*t,y:2+t,z:10-20*t+2*t*t+.2*t*t*t}}});
 const base={...input,observations:obs},result=fitCausalForecastV245(base,3);expect(result.status).toBe('PREDICTED');if(result.status==='PREDICTED'){const p=positionAtCausalForecastV245(result,300000);expect(p.x).toBeCloseTo(1+.3**3,9);expect(p.z).toBeCloseTo(10-20*.3+2*.3**2+.2*.3**3,9);}
 const late={...obs.at(-1)!,availableTick:160000};expect(fitCausalForecastV245({...base,observations:[...obs.slice(0,-1),late]},3).usedObservationIds).not.toContain(late.observationId);
});
