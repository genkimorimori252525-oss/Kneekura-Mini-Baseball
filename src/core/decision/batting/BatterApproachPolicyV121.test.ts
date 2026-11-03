import {expect,it} from 'vitest';
import {resolveBatterApproachV121,validateSwingPolicyV121,lateEvidenceHeadroomV121,planSwingClockV121} from './BatterApproachPolicyV121';
const profile=()=>({version:'swing_policy_v121' as const,sourceId:'authored-test-not-measured',effort:.8,compactness:.3,controlPriority:.5,
 effortVariation:.05,twoStrikeEffortDelta:-.2,twoStrikeCompactnessDelta:.4,maximumClockAccelerationPerSecond:30});
it('keeps slow policy intact while combining count and one-pitch instructions',()=>{
 const p=profile(),before=JSON.stringify(p),base={policy:p,mode:'power' as const,strikes:0,draw:.5};
 const first=resolveBatterApproachV121(base),two=resolveBatterApproachV121({...base,strikes:2});
 expect(two.compactness).toBeGreaterThan(first.compactness);expect(two.effort).toBeLessThan(first.effort);
 expect(JSON.stringify(p)).toBe(before);
 const stubborn=resolveBatterApproachV121({...base,strikes:2,policy:{...p,twoStrikeEffortDelta:0,twoStrikeCompactnessDelta:0}});
 expect(stubborn.effort).toBe(first.effort);expect(stubborn.compactness).toBe(first.compactness);
 const directed=resolveBatterApproachV121({...base,instruction:{authority:'hard',effort:.4,compactness:.9}});
 expect(directed.effort).toBe(.4);expect(directed.compactness).toBe(.9);expect(JSON.stringify(p)).toBe(before);
});
it('uses effort for finite acceleration and personal speed bounds rather than a fixed mode speed',()=>{
 const base={requestedRate:1,referenceMaximumSpeedMps:30,maximumSpeedMps:45,maximumClockAccelerationPerSecond:30,sourceContactPhaseSeconds:.2,effort:1};
 const full=planSwingClockV121(base),soft=planSwingClockV121({...base,effort:.25});
 expect(full.rampSeconds).toBeLessThan(soft.rampSeconds);
 expect(full.rate).toBeLessThanOrEqual(1.5);
 const strongContact=planSwingClockV121({...base,requestedRate:2,maximumSpeedMps:70,effort:.7});
 const weakPower=planSwingClockV121({...base,requestedRate:2,maximumSpeedMps:20,effort:1});
 expect(strongContact.rate*30).toBeGreaterThan(weakPower.rate*30);
 expect(weakPower.rate*30).toBeLessThanOrEqual(20);
});
it('has continuous absolute 75+ headroom, never a timing or outcome bonus',()=>{
 for(const v of [1,45,74,75])expect(lateEvidenceHeadroomV121(v)).toBe(0);
 expect(lateEvidenceHeadroomV121(76)).toBeGreaterThan(0);expect(lateEvidenceHeadroomV121(76)).toBeLessThan(.01);
 expect(lateEvidenceHeadroomV121(100)).toBe(1);
 for(const v of [0,101,NaN,Infinity])expect(()=>lateEvidenceHeadroomV121(v)).toThrow();
});
it('rejects unknown policy fields and non-finite controls',()=>{
 expect(()=>validateSwingPolicyV121({...profile(),publicPower:100})).toThrow();
 expect(()=>validateSwingPolicyV121({...profile(),effort:NaN})).toThrow();
 expect(validateSwingPolicyV121(profile())).toEqual(profile());
});
