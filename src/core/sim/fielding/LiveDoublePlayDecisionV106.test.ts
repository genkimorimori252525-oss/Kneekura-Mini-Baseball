import {expect,it} from 'vitest';
import {decideLiveDoublePlayV106} from './LiveDoublePlayDecisionV106';
const route={firstRunnerId:'lead',firstBase:2,secondRunnerId:'batter',secondBase:1,firstMarginSeconds:1,secondMarginSeconds:-.35,controlSeconds:4};
const input={outs:0,seed:2,opportunityId:'one-held-ball',pursuitCostWeight:1,routes:[route]};
it('attempts a close double play while cautious defense and two-out defense may take the single out',()=>{
 expect(decideLiveDoublePlayV106(input).selected).toEqual(route);
 expect(decideLiveDoublePlayV106({...input,pursuitCostWeight:1.5}).selected).toBeNull();
 expect(decideLiveDoublePlayV106({...input,outs:2}).selected).toBeNull();
 expect(decideLiveDoublePlayV106({...input,routes:[{...route,secondMarginSeconds:-2}]}).selected).toBeNull();
 expect(decideLiveDoublePlayV106({...input,routes:[{...route,firstMarginSeconds:-2}]}).selected).toBeNull();
});
it('allows an optimistic double-play attempt even when both races may become safe',()=>{
 const close={...route,firstMarginSeconds:-.15,secondMarginSeconds:-.25};
 expect(decideLiveDoublePlayV106({...input,routes:[close]}).selected).toEqual(close);
 expect(decideLiveDoublePlayV106({...input,pursuitCostWeight:1.5,routes:[close]}).selected).toBeNull();
});
it('keeps opportunity judgement deterministic, with seed-dependent variation only near the decision boundary',()=>{
 expect(decideLiveDoublePlayV106(input)).toEqual(decideLiveDoublePlayV106(input));
 const choices=Array.from({length:20},(_,seed)=>decideLiveDoublePlayV106({...input,seed,routes:[{...route,secondMarginSeconds:-.65}]}).selected!==null);
 expect(choices.some(Boolean)).toBe(true);expect(choices.some(c=>!c)).toBe(true);
});
