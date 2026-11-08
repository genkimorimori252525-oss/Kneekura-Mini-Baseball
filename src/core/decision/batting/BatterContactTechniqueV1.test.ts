import {expect,it} from 'vitest';
import {selectBatterContactTechniqueV1,validateBatterTechniquePolicyV1,type BatterTechniqueInputV1} from './BatterContactTechniqueV1';
const base:BatterTechniqueInputV1={bats:'R',perceived:{x:0,y:.8},zone:{halfWidth:.25,lowerY:.5,upperY:1.1},balls:1,strikes:1,outs:0,bases:{first:false,second:false,third:false},swingMode:'balanced',plateAggression:.5,approach:null,draw:0};
const pick=(over:Partial<BatterTechniqueInputV1>)=>selectBatterContactTechniqueV1({...base,...over});
it('sends the outside pitch the other way and pulls the inside one, for either hand',()=>{
 expect(pick({perceived:{x:.2,y:.8}})).toMatchObject({technique:'SLICE',reason:'OUTSIDE_OPPOSITE_FIELD'});expect(pick({perceived:{x:-.2,y:.8}})).toMatchObject({technique:'HOOK',reason:'INSIDE_PULL'});
 expect(pick({bats:'L',perceived:{x:-.2,y:.8}})).toMatchObject({technique:'SLICE'});expect(pick({bats:'L',perceived:{x:.2,y:.8}})).toMatchObject({technique:'HOOK'});
});
it('lifts with a runner on third under two outs, but not with two out or on a pitch at the knees',()=>{
 const third={first:false,second:false,third:true};expect(pick({bases:third})).toMatchObject({technique:'BACKSPIN',reason:'RUNNER_THIRD_LIFT'});
 expect(pick({bases:third,outs:2})).toMatchObject({technique:null,reason:'NO_REASON'});expect(pick({bases:third,perceived:{x:0,y:.55}}).technique).toBe('TOPSPIN');
});
it('plays for a ground ball with a runner on first unless he is up there to drive it, and tops the low pitch',()=>{
 const first={first:true,second:false,third:false};expect(pick({bases:first,swingMode:'contact'})).toMatchObject({technique:'TOPSPIN',reason:'RUNNER_FIRST_GROUND_BALL'});
 expect(pick({bases:first,swingMode:'power'}).technique).toBe(null);expect(pick({bases:first,outs:2}).technique).toBe(null);expect(pick({perceived:{x:0,y:.52}})).toMatchObject({technique:'TOPSPIN',reason:'LOW_PITCH'});
});
it('leaves a middle pitch alone and is never certain, so plenty of swings carry nothing',()=>{
 expect(pick({})).toMatchObject({technique:null,reason:'NO_REASON',willingness:0});
 const worst=pick({perceived:{x:.4,y:.8},plateAggression:0,swingMode:'contact'});expect(worst.willingness).toBeLessThanOrEqual(.85);
 expect(pick({perceived:{x:.2,y:.8},draw:.999})).toMatchObject({technique:null,reason:'NOT_THIS_SWING'});
 const total=Array.from({length:200},(_,n)=>pick({perceived:{x:-.3+n*.003,y:.6+(n%7)*.08},draw:(n*.618)%1})).filter(s=>s.technique).length;expect(total).toBeGreaterThan(0);expect(total).toBeLessThan(120);
});
it('reads the player, not a global setting: approach, swing mode, aggression and count all move willingness',()=>{
 const outside={perceived:{x:.2,y:.8}},approach=(opposite:number,pull:number)=>({directionCommitment:1,twoStrikeCommitmentDelta:0,preferredWhenCommitted:{pull,center:1-pull-opposite,opposite}});
 expect(pick({...outside,approach:approach(1,0)}).willingness).toBeGreaterThan(pick({...outside,approach:approach(0,1)}).willingness);
 expect(pick({...outside,swingMode:'contact'}).willingness).toBeGreaterThan(pick({...outside,swingMode:'power'}).willingness);
 expect(pick({...outside,plateAggression:0}).willingness).toBeGreaterThan(pick({...outside,plateAggression:1}).willingness);
 expect(pick({perceived:{x:-.2,y:.8},strikes:2}).willingness).toBeLessThan(pick({perceived:{x:-.2,y:.8},strikes:1}).willingness);
});
it('accepts no result or actual-source field, and answers none instead of throwing on bad input',()=>{
 expect(Object.keys(base).sort()).toEqual(['approach','balls','bases','bats','draw','outs','perceived','plateAggression','strikes','swingMode','zone']);
 for(const bad of [{perceived:{x:NaN,y:.8}},{strikes:3},{outs:3},{draw:2},{plateAggression:-1},{zone:{halfWidth:0,lowerY:.5,upperY:1.1}}])expect(pick(bad as Partial<BatterTechniqueInputV1>)).toMatchObject({technique:null,reason:'INVALID_INPUT'});
 expect(selectBatterContactTechniqueV1(null as unknown as BatterTechniqueInputV1).technique).toBe(null);
});
it('validates the policy strictly and in one key order',()=>{
 const good={version:'batter_technique_policy_v1' as const,sourceId:'x',thresholds:{minimumComponent:1,minimumImprovement:2}};
 expect(JSON.stringify(validateBatterTechniquePolicyV1({thresholds:{minimumImprovement:2,minimumComponent:1},sourceId:'x',version:'batter_technique_policy_v1'}))).toBe(JSON.stringify(good));
 for(const bad of [null,{},{...good,extra:1},{...good,sourceId:' x'},{...good,version:'v2'},{...good,thresholds:{minimumComponent:0,minimumImprovement:1}}])expect(()=>validateBatterTechniquePolicyV1(bad)).toThrow(/invalid policy/);
});
