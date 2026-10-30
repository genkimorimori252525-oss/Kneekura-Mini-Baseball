import { expect,it } from 'vitest';
import { encodeLiveSpinPracticeProofV239,hashLiveSpinPracticeProofV239 } from './LiveSpinPracticeProofV239';
it('V239 proof encoding sorts keys and preserves types, arrays and signed zero',async()=>{
 expect(encodeLiveSpinPracticeProofV239({b:1,a:-0})).toBe(encodeLiveSpinPracticeProofV239({a:-0,b:1}));
 expect(await hashLiveSpinPracticeProofV239({a:-0})).not.toBe(await hashLiveSpinPracticeProofV239({a:0}));
 expect(await hashLiveSpinPracticeProofV239([1,'1'])).not.toBe(await hashLiveSpinPracticeProofV239(['1',1]));
 expect(await hashLiveSpinPracticeProofV239({a:undefined})).not.toBe(await hashLiveSpinPracticeProofV239({}));
});
it('V239 proof preserves nonfinite bits and rejects cycles and non-inert values',async()=>{
 expect(await hashLiveSpinPracticeProofV239(Infinity)).not.toBe(await hashLiveSpinPracticeProofV239(-Infinity));expect(await hashLiveSpinPracticeProofV239(NaN)).not.toBe(await hashLiveSpinPracticeProofV239(Infinity));
 const cycle:any={};cycle.self=cycle;for(const x of [cycle,new Date(),()=>1])expect(()=>encodeLiveSpinPracticeProofV239(x)).toThrow();
});
