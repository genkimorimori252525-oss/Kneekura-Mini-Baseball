import {describe,expect,it} from 'vitest';
import {leadMetersV1,pitchHitsBatterV1,resolvePickoffV1,resolveStealV1,runnerLeadMetersV1,runnerReturnSecondsV1} from './LiveBaseRunningV1';

const v=(x:number,z:number)=>({x,y:0,z});
const runner={topSpeedMps:8,accelerationMps2:5.2,reactionSeconds:.18};
const fast={topSpeedMps:9.6,accelerationMps2:6.4,reactionSeconds:.14};
const slow={topSpeedMps:6.6,accelerationMps2:4,reactionSeconds:.35};
const pitcher={throwSpeedMps:39};
const pitcherToFirstMeters=19.42,base='first' as const,instruction='balanced' as const;
const lead=(r:typeof runner&{baserunningSafetyMarginSeconds?:number},p:Parameters<typeof runnerLeadMetersV1>[0]['pitcher']=pitcher,extra={})=>runnerLeadMetersV1({runner:r,pitcher:p,base,instruction,pitcherToFirstMeters,...extra});

describe('runner lead',()=>{
  it('stays in the range of real leads',()=>{
    expect(lead(slow)).toBeGreaterThan(1.5);
    expect(lead(runner)).toBeGreaterThan(2.5);
    expect(lead({...fast,baserunningSafetyMarginSeconds:.1})).toBeLessThan(5.2);
  });
  it('answers the runner',()=>{
    expect(lead(fast)).toBeGreaterThan(lead(runner));
    expect(lead(runner)).toBeGreaterThan(lead(slow));
  });
  it('answers the pitcher, not only foot speed',()=>{
    expect(lead(runner,{...pitcher,pickoffTechniqueV1:1})).toBeLessThan(lead(runner));
    expect(lead(runner,{...pitcher,throws:'L'})).toBeLessThan(lead(runner));
    expect(lead(runner,{...pitcher,throwSpeedMps:46})).toBeLessThan(lead(runner));
    expect(lead(runner,{...pitcher,deliverySecondsV1:.61})).toBeLessThan(lead(runner));
  });
  it('a lower running margin, which 積極走塁 resolves to, takes more ground',()=>{
    expect(lead({...runner,baserunningSafetyMarginSeconds:.1})-lead(runner)).toBeGreaterThan(.4);
  });
  it('the manager replaces the runner\'s own margin',()=>{
    const own={...runner,baserunningSafetyMarginSeconds:.1};
    expect(lead(own,pitcher,{instruction:'conservative'})).toBeCloseTo(lead(runner,pitcher,{instruction:'conservative'}));
    expect(lead(runner,pitcher,{instruction:'aggressive'})).toBeCloseTo(lead(own));
  });
  it('a return is slower from further out',()=>{
    expect(runnerReturnSecondsV1(4,runner)).toBeGreaterThan(runnerReturnSecondsV1(2.5,runner));
    expect(runnerReturnSecondsV1(1,runner)).toBeCloseTo(runner.reactionSeconds+.12);
  });
  it('the old lead is untouched',()=>{
    expect(leadMetersV1(8,'balanced')).toBeCloseTo(2.2+1.8*(.8/2.1));
  });
  it('a longer lead is the one that gets picked off',()=>{
    const rate=(margin:number)=>{
      const r={...runner,baserunningSafetyMarginSeconds:margin},meters=lead(r),from=v(19.4,19.4);let out=0;
      for(let seed=0;seed<4000;seed++)if(!resolvePickoffV1({seed,pitchOrdinal:1,lead:v(from.x-meters*.7,from.z+meters*.7),base:from,pitcher:v(0,18.44),pitcherTechnique:0,throwSpeedMps:pitcher.throwSpeedMps,runner:r,receiverGloveSpeedMps:11,leadRaceV1:{}}).safe)out++;
      return out/4000;
    };
    expect(rate(.35)).toBeLessThan(.05);
    expect(rate(.1)).toBeGreaterThan(rate(.35));
    expect(rate(.1)).toBeLessThan(.25);
  });
});

describe('catcher exchange',()=>{
  const steal=(transferSeconds:number,throwSpeedMps:number,policy=true,seed=5)=>resolveStealV1({seed,pitchOrdinal:1,from:v(16.8,22.1),to:v(0,38.8),catcher:v(0,-1.5),catchSeconds:.45,runner,transferSeconds,throwSpeedMps,...(policy?{catcherThrowV1:true as const}:{})});
  const meanPop=(transfer:number,speed:number)=>{let s=0;for(let i=0;i<500;i++){const r=steal(transfer,speed,true,i);s+=r.arrivalSeconds-.45-.08;}return s/500;};
  it('takes human time from mitt to release',()=>{
    for(let i=0;i<50;i++){const r=steal(.32,39.5,true,i);expect(r.exchangeSeconds).toBeGreaterThan(.6);expect(r.exchangeSeconds).toBeLessThan(.8);}
    expect(steal(.46,34,false).exchangeSeconds).toBe(.46);
  });
  it('pop time sits in the range of real catchers',()=>{
    expect(meanPop(.46,34)).toBeGreaterThan(1.95);expect(meanPop(.46,34)).toBeLessThan(2.15);
    expect(meanPop(.32,39.5)).toBeGreaterThan(1.75);expect(meanPop(.32,39.5)).toBeLessThan(1.95);
  });
  it('answers both the arm and the hands',()=>{
    expect(meanPop(.32,34)).toBeLessThan(meanPop(.46,34));
    expect(meanPop(.46,42)).toBeLessThan(meanPop(.46,34));
  });
});

describe('steal race',()=>{
  const first=v(19.397,19.397),second=v(0,38.79),lead=(m:number)=>v(first.x-m*.7071,first.z+m*.7071);
  const rate=(r:typeof runner,transferSeconds=.38,throwSpeedMps=39,race=true)=>{let safe=0;for(let seed=0;seed<600;seed++)if(resolveStealV1({seed,pitchOrdinal:1,from:lead(3.5),to:second,catcher:v(0,-1.5),catchSeconds:.45,runner:r,
    transferSeconds,throwSpeedMps,catcherThrowV1:true,...(race?{stealRaceV1:true as const}:{})}).safe)safe++;return safe/600;};
  it('the old race never lets a standard runner in',()=>{expect(rate(runner,.38,39,false)).toBe(0);});
  it('a standard runner against a standard battery is safe most of the time, not always',()=>{expect(rate(runner)).toBeGreaterThan(.65);expect(rate(runner)).toBeLessThan(.95);});
  it('answers the runner, the catcher and the pitcher',()=>{
    expect(rate(fast)).toBeGreaterThan(rate(runner));expect(rate(slow)).toBeLessThan(rate(runner));
    expect(rate(runner,.5,34)).toBeGreaterThan(rate(runner));
  });
  it('reaches second about 3.5 s after the first move',()=>{
    const r=resolveStealV1({seed:1,pitchOrdinal:1,from:lead(3.5),to:second,catcher:v(0,-1.5),catchSeconds:.45,runner,transferSeconds:.38,throwSpeedMps:39,catcherThrowV1:true,stealRaceV1:true});
    expect(r.runnerSeconds+1.1).toBeGreaterThan(3.2);expect(r.runnerSeconds+1.1).toBeLessThan(3.8);
  });
});

describe('hit by pitch',()=>{
  const pass=(x:number,speed=40)=>Array.from({length:100},(_,i)=>({tick:i*10000,ball:{position:{x,y:1,z:18.4-i*.01*speed}}}));
  it('the old column is unchanged',()=>{expect(pitchHitsBatterV1(pass(-.65),v(-.85,0),1.8)).toBe(true);});
  it('a side-on batter is thin toward the plate',()=>{
    expect(pitchHitsBatterV1(pass(-.65),v(-.85,0),1.8,{ticksPerSecond:1e6})).toBe(false);
    expect(pitchHitsBatterV1(pass(-.8),v(-.85,0),1.8,{ticksPerSecond:1e6})).toBe(true);
  });
  it('a slow pitch inside gives him time to get out of the way',()=>{
    expect(pitchHitsBatterV1(pass(-.722,40),v(-.85,0),1.8,{ticksPerSecond:1e6})).toBe(true);
    expect(pitchHitsBatterV1(pass(-.722,25),v(-.85,0),1.8,{ticksPerSecond:1e6})).toBe(false);
  });
});
