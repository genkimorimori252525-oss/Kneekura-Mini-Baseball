import { expect,it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { planLiveThrowActionV103,type LiveThrowActionInputV103 } from './LiveThrowActionV103';
const input=(capacityMps=40):LiveThrowActionInputV103=>({releasePosition:{x:0,y:1,z:0},bodyVelocity:{x:0,y:0,z:0},capacityMps,
 spin:{x:0,y:0,z:0},target:{x:0,y:1,z:10},remainingTransferSeconds:0,handPreparationSeconds:.08,
 receiverReadySeconds:1.2,deadlineSeconds:1.6,preferStrongestFeasibleV103:true,
 physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
 ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
 material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}});
it('releases a softer solved throw early to meet a moving cover receiver, without extending its flight in the world',()=>{
 const raw=input(),before=JSON.stringify(raw),r=planLiveThrowActionV103(raw);
 expect(r.kind).toBe('planned');if(r.kind!=='planned')throw new Error(r.reason);
 expect(r.commandSpeedMps).toBeLessThan(20);expect(r.releaseDelaySeconds).toBeLessThan(.2);
 expect(r.flightSeconds).toBeGreaterThan(.9);expect(r.controlSeconds).toBeLessThan(1.3);
 expect(r.meetsDeadline).toBe(true);expect(r.selectionReason).toBe('RECEIVER_TIMED_EARLY_RELEASE');
 expect(r.forecast.arrivalErrorMeters).toBeLessThanOrEqual(.02);
 expect(r.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);
 expect(r.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
 expect(JSON.stringify(raw)).toBe(before);
 console.info(JSON.stringify({benchmark:'V109_MOVING_RECEIVER',speed:r.commandSpeedMps,release:r.releaseDelaySeconds,flight:r.flightSeconds,control:r.controlSeconds,reason:r.selectionReason}));
});
it('keeps strong competitive throws when the receiver is ready, and cannot turn an impossible deadline into an out',()=>{
 const ready=planLiveThrowActionV103({...input(),receiverReadySeconds:0}),late=planLiveThrowActionV103({...input(),deadlineSeconds:.3});
 if(ready.kind!=='planned'||late.kind!=='planned')throw new Error('expected physical commands');
 expect(ready.commandSpeedMps).toBeGreaterThan(38);expect(ready.selectionReason).toBe('STRONGEST_FEASIBLE_COMPETITIVE_THROW');
 expect(late.meetsDeadline).toBe(false);expect(late.controlSeconds).toBeGreaterThanOrEqual(1.2);
});
it('retains arm capacity, transfer preparation, already elapsed charge and finite search limits',()=>{
 for(const capacity of [12,40,300_000]){
  const raw={...input(capacity),remainingTransferSeconds:.25,chargeElapsedSeconds:.3},r=planLiveThrowActionV103(raw);
  expect(r.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
  expect(r.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);
  if(r.kind!=='planned')continue;
  expect(r.capacityMps).toBe(capacity);expect(r.commandSpeedMps).toBeLessThanOrEqual(Math.min(120,capacity));
  expect(r.releaseDelaySeconds).toBeGreaterThanOrEqual(.33-1e-12);
  expect(r.releaseDelaySeconds).toBeCloseTo(.25+Math.max(.08,r.remainingChargeSeconds),12);
 }
});
