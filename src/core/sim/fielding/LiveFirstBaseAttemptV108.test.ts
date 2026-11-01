import { expect, it } from 'vitest';
import { decideLiveFirstBaseAttemptV108 } from './LiveFirstBaseAttemptV108';
const input={seed:20261021,opportunityId:'one-reception',pursuitCostWeight:1,
  runnerSeconds:1.7267,receivingSeconds:2.0408,distanceMeters:52.75,capacityMps:45,runnerSpeedMps:9.8};
it('tries the measured close right-field race while declining a plainly late weak-arm route',()=>{
 expect(decideLiveFirstBaseAttemptV108(input).attempt).toBe(true);
 expect(decideLiveFirstBaseAttemptV108({...input,capacityMps:20,receivingSeconds:4}).attempt).toBe(false);
 expect(decideLiveFirstBaseAttemptV108({...input,runnerSpeedMps:6,runnerSeconds:3}).attempt).toBe(true);
});
it('gives aggressive defense more willingness without changing the physical race',()=>{
 const standard=decideLiveFirstBaseAttemptV108(input),aggressive=decideLiveFirstBaseAttemptV108({...input,pursuitCostWeight:.65}),
  cautious=decideLiveFirstBaseAttemptV108({...input,pursuitCostWeight:1/.65});
 expect(aggressive.toleranceSeconds).toBeGreaterThan(standard.toleranceSeconds);
 expect(cautious.attempt).toBe(false);
 expect(aggressive.marginSeconds).toBe(standard.marginSeconds);
});
it('uses stable opportunity judgement with variation only near the decision boundary',()=>{
 expect(decideLiveFirstBaseAttemptV108(input)).toEqual(decideLiveFirstBaseAttemptV108(input));
 const choices=Array.from({length:32},(_,seed)=>decideLiveFirstBaseAttemptV108({...input,seed,receivingSeconds:input.runnerSeconds+.45}).attempt);
 expect(choices.some(Boolean)).toBe(true);expect(choices.some(x=>!x)).toBe(true);
});
