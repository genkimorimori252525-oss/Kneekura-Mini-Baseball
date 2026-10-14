import { expect,it } from 'vitest';
import * as cut from './ActualReceivedUmpireRenewal';
const exact={originTick:11180360,elapsedSeconds:0.849942,tick:12030302,ticksPerSecond:1000000};
it('RC01 accepts the exact qualified selected current self and adoption tuple',()=>{
  expect(typeof cut.renewalExactCut,'RENEWAL_EXACT_CUT_IMPLEMENTATION_MISSING').toBe('function');
  expect(cut.renewalExactCut(exact,exact.ticksPerSecond)).toEqual(exact);expect(()=>cut.assertRenewalCut(exact,{...exact})).not.toThrow();
});
it('RC02 rejects equal quantized ticks with different elapsed values',()=>{
  expect(typeof cut.assertRenewalCut,'RENEWAL_EXACT_CUT_IMPLEMENTATION_MISSING').toBe('function');
  expect(()=>cut.assertRenewalCut(exact,{...exact,elapsedSeconds:exact.elapsedSeconds-0.0000001})).toThrow(/integer cut|tuple/);
});
it('RC03 rejects a changed origin or rate even when each tick is an integer boundary',()=>{
  expect(typeof cut.assertRenewalCut,'RENEWAL_EXACT_CUT_IMPLEMENTATION_MISSING').toBe('function');
  for(const changed of [{...exact,originTick:11180361,elapsedSeconds:0.849941},{...exact,ticksPerSecond:2000000,elapsedSeconds:0.424971}])expect(()=>cut.assertRenewalCut(exact,changed)).toThrow(/tuple/);
});
it('RC04 rejects an inexact locomotion boundary instead of rounding it up',()=>{
  expect(typeof cut.renewalExactCut,'RENEWAL_EXACT_CUT_IMPLEMENTATION_MISSING').toBe('function');
  expect(()=>cut.renewalExactCut({...exact,elapsedSeconds:0.8499419},exact.ticksPerSecond)).toThrow(/integer cut/);
});
