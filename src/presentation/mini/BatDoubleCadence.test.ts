import { describe, expect, it } from 'vitest';
import type { CanonicalPresentationSample } from './model';
import { buildDoubleRateBatVisualSamples, MINI_BAT_DOUBLE_CADENCE_MICROS } from './BatDoubleCadence';

const sample = (tick: number, gripX: number, action: 'normal_swing' | 'idle'='normal_swing'): CanonicalPresentationSample => ({
  world: {tick, ball:null, defenders:[], runners:[]},
  batter: { handedness:'R',action,bat: {grip:{x:gripX,y:1,z:0},tip:{x:gripX+1,y:1,z:0}} },
});

describe('Bat-double-cadence presentation only', () => {
  it('creates an intermediate bat pose every 27.5ms without mutating canonical samples', () => {
    const data=[sample(0,0),sample(55_000,4),sample(110_000,8)];
    const before=JSON.stringify(data);
    const visual=buildDoubleRateBatVisualSamples(data,[]);
    expect(MINI_BAT_DOUBLE_CADENCE_MICROS).toBe(27_500);
    expect(visual.map(x=>x.atMicros)).toEqual([0,27_500,55_000,82_500,110_000]);
    expect(visual[1].pose?.grip.x).toBe(2);
    expect(visual[1].pose?.tip.x).toBe(3);
    expect(JSON.stringify(data)).toBe(before);
  });
  it('does not hallucinate motion through actual contact or action changes',()=>{
    const data=[sample(0,0),sample(55_000,4),sample(110_000,8,'idle')];
    const visual=buildDoubleRateBatVisualSamples(data,[{
      tick:55_000,sequence:0,kind:'BatBallContact',payload:{liveBattedBall:true},
    }]);
    expect(visual.map(x=>x.atMicros)).toEqual([0,55_000,110_000]);
  });
  it('refuses to interpolate absent bat or invalid ordering',()=>{
    const a=sample(0,0),b=sample(55_000,4);
    const missing={...b,batter:{...b.batter,bat:null}};
    expect(buildDoubleRateBatVisualSamples([a,missing],[]).every(x=>!x.interpolated)).toBe(true);
    expect(()=>buildDoubleRateBatVisualSamples([a,a],[])).toThrow('strictly increasing');
  });
});
