import { expect,it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { planLiveThrowActionV103,type LiveThrowActionInputV103 } from './LiveThrowActionV103';
const input=(distance=20,capacityMps=34):LiveThrowActionInputV103=>({releasePosition:{x:0,y:1,z:0},bodyVelocity:{x:0,y:0,z:0},capacityMps,
  spin:{x:120,y:0,z:0},target:{x:0,y:1,z:distance},remainingTransferSeconds:.2,handPreparationSeconds:.1,
  physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
      material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}});
it('separates unbounded raw capacity from bounded command output and has no minimum effort fraction',()=>{
  const raw=input(20,300_000),before=JSON.stringify(raw),r=planLiveThrowActionV103(raw);
  expect(r.kind).toBe('planned');if(r.kind!=='planned')throw new Error(r.reason);
  expect(r.commandSpeedMps).toBeLessThanOrEqual(120);expect(r.commandSpeedMps).toBeGreaterThan(5);
  expect(r.outputSearchLimitApplied).toBe(true);expect(r.capacityMps).toBe(300_000);
  expect(r.effort).toBeCloseTo((r.commandSpeedMps/raw.capacityMps)**2,15);expect(r.effort).toBeLessThan(1e-7);
  expect(r.chargeSeconds).toBeCloseTo(.6*r.effort,15);expect(r.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
  expect(r.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);expect(JSON.stringify(raw)).toBe(before);
});
it('labels bounded-search failure without claiming that an extreme arm lacks capacity and rejects malformed action data',()=>{
  const raw=input(2_000,300_000),r=planLiveThrowActionV103(raw);
  expect(r.kind).toBe('unreachable');if(r.kind!=='unreachable')throw new Error('expected bounded-search failure');
  expect(r.reason).toBe('NO_SOLUTION_WITHIN_BOUNDED_COMMAND_SEARCH_V103');expect(r.capacityMps).toBe(300_000);
  expect(r.maximumCommandSpeedMps).toBe(120);expect(r.outputSearchLimitApplied).toBe(true);
  expect(()=>planLiveThrowActionV103({...input(),throwEffortBuildSecondsV103:5.1})).toThrow(/effort timing/);
  expect(()=>planLiveThrowActionV103({...input(),capacityMps:0})).toThrow(/capacity/);
  expect(()=>planLiveThrowActionV103({...input(),futureActualSource:{}} as LiveThrowActionInputV103)).toThrow(/finite throw command/);
});
it('charges after transfer with hand preparation in parallel and retains elapsed issued charge',()=>{
  const r=planLiveThrowActionV103({...input(40),deadlineSeconds:0});
  expect(r.kind).toBe('planned');if(r.kind!=='planned')throw new Error(r.reason);
  expect(r.releaseDelaySeconds).toBeCloseTo(.2+Math.max(.1,r.chargeSeconds),12);
  const progressed=planLiveThrowActionV103({...input(40),deadlineSeconds:0,chargeElapsedSeconds:r.chargeSeconds,
    preferredFlightSecondsV103:r.flightSeconds});
  expect(progressed.kind).toBe('planned');if(progressed.kind!=='planned')throw new Error(progressed.reason);
  expect(progressed.remainingChargeSeconds).toBe(0);expect(progressed.releaseDelaySeconds).toBeCloseTo(.3,12);
});
it('uses a deadline to select less force when time permits and earliest control when it cannot meet it',()=>{
  const raw=input(),fast=planLiveThrowActionV103({...raw,deadlineSeconds:0}),routine=planLiveThrowActionV103(raw),
    late=planLiveThrowActionV103({...raw,deadlineSeconds:.01}),ample=planLiveThrowActionV103({...raw,deadlineSeconds:10});
  if(fast.kind!=='planned'||routine.kind!=='planned'||late.kind!=='planned'||ample.kind!=='planned')throw new Error('expected physical commands');
  expect(routine.effort).toBeLessThan(fast.effort);expect(ample.effort).toBe(routine.effort);
  expect(ample.meetsDeadline).toBe(true);expect(late.meetsDeadline).toBe(false);expect(late.controlSeconds).toBeCloseTo(fast.controlSeconds,12);
  expect(late.selectionReason).toBe('EARLIEST_CONTROL_DEADLINE_UNREACHABLE');
});
it('allows a home-plate contest to use near-full output while an ample routine return remains gentle',()=>{
  const raw=input(40,44),routine=planLiveThrowActionV103({...raw,deadlineSeconds:8}),
    competitive=planLiveThrowActionV103({...raw,deadlineSeconds:8,preferStrongestFeasibleV103:true});
  if(routine.kind!=='planned'||competitive.kind!=='planned')throw new Error('expected commands');
  expect(competitive.commandSpeedMps).toBeGreaterThan(.95*44);expect(competitive.commandSpeedMps).toBeLessThanOrEqual(44);
  expect(competitive.commandSpeedMps).toBeGreaterThan(routine.commandSpeedMps*1.5);
  expect(competitive.selectionReason).toBe('STRONGEST_FEASIBLE_COMPETITIVE_THROW');expect(competitive.meetsDeadline).toBe(true);
  expect(competitive.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
  expect(competitive.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);
  console.info(JSON.stringify({benchmark:'V103_COMPETITIVE_CAPACITY_BOUNDARY',capacity:44,routineSpeed:routine.commandSpeedMps,
    competitiveSpeed:competitive.commandSpeedMps,effort:competitive.effort,flightSeconds:competitive.flightSeconds,...competitive.forecast.readPerformance()}));
  const noDeadline=planLiveThrowActionV103({...raw,preferStrongestFeasibleV103:true});
  expect(noDeadline.kind).toBe('planned');if(noDeadline.kind!=='planned')throw new Error(noDeadline.reason);
  expect(noDeadline.commandSpeedMps).toBe(routine.commandSpeedMps);
});
it('does not force maximum charge when a narrow deadline requires earlier control',()=>{
  const raw={...input(5,44),handPreparationSeconds:0,remainingTransferSeconds:0,throwEffortBuildSecondsV103:2},
    earliest=planLiveThrowActionV103({...raw,deadlineSeconds:0}),
    competitive=planLiveThrowActionV103({...raw,deadlineSeconds:.7,preferStrongestFeasibleV103:true});
  if(earliest.kind!=='planned'||competitive.kind!=='planned')throw new Error('expected commands');
  expect(competitive.commandSpeedMps).toBeLessThan(.8*44);expect(competitive.controlSeconds).toBeLessThanOrEqual(.7);
  expect(competitive.controlSeconds).toBeGreaterThanOrEqual(earliest.controlSeconds);
  const missed=planLiveThrowActionV103({...raw,deadlineSeconds:.01,preferStrongestFeasibleV103:true});
  expect(missed.kind).toBe('planned');if(missed.kind!=='planned')throw new Error(missed.reason);
  expect(missed.meetsDeadline).toBe(false);expect(missed.controlSeconds).toBeCloseTo(earliest.controlSeconds,12);
  expect(missed.selectionReason).toBe('EARLIEST_CONTROL_DEADLINE_UNREACHABLE');
});
it('refines competitive deadline output between a late strong command and a timely weaker command',()=>{
  const r=planLiveThrowActionV103({...input(5,44),deadlineSeconds:.7,preferStrongestFeasibleV103:true});
  expect(r.kind).toBe('planned');if(r.kind!=='planned')throw new Error(r.reason);
  expect(r.meetsDeadline).toBe(true);expect(r.commandSpeedMps).toBeGreaterThanOrEqual(31.7);
  expect(r.controlSeconds).toBeLessThanOrEqual(.7);expect(r.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
  expect(r.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);
});
it('retains the known .16-second timely contest command when full charge would miss a 1.2-second deadline',()=>{
  const raw={...input(5,44),throwEffortBuildSecondsV103:2,remainingTransferSeconds:0,handPreparationSeconds:0,deadlineSeconds:1.2,preferStrongestFeasibleV103:true},
    witness=planLiveThrowActionV103({...raw,preferredFlightSecondsV103:.16}),chosen=planLiveThrowActionV103(raw);
  if(witness.kind!=='planned'||chosen.kind!=='planned')throw new Error('expected physical commands');
  expect(witness.meetsDeadline).toBe(true);expect(chosen.meetsDeadline).toBe(true);
  expect(chosen.commandSpeedMps).toBeGreaterThanOrEqual(witness.commandSpeedMps);
  expect(chosen.controlSeconds).toBeLessThanOrEqual(1.2);expect(chosen.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
  expect(chosen.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);
});
it('keeps the competitive refinement inside finite solver/output limits at short and long distances',()=>{
  for(const distance of [5,20,40,70,90])for(const capacity of [16,34,44,300_000]){
    const r=planLiveThrowActionV103({...input(distance,capacity),deadlineSeconds:8,preferStrongestFeasibleV103:true});
    expect(r.forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
    expect(r.forecast.diagnostics.verificationKernelBuilds).toBeLessThanOrEqual(4);
    if(r.kind==='planned'){
      expect(r.commandSpeedMps).toBeLessThanOrEqual(Math.min(120,capacity));expect(r.outputSearchLimitApplied).toBe(capacity>120);
      expect(r.forecast.arrivalErrorMeters).toBeLessThanOrEqual(.02);
      if(capacity===44)expect(r.commandSpeedMps).toBeGreaterThan(.95*capacity);
    }
  }
});
it('uses the same ordinary output for equal geometry at enormous capacities and preserves receiver readiness',()=>{
  const one=planLiveThrowActionV103(input(20,300_000)),two=planLiveThrowActionV103(input(20,600_000));
  if(one.kind!=='planned'||two.kind!=='planned')throw new Error('expected commands');
  expect(two.commandSpeedMps).toBe(one.commandSpeedMps);expect(two.effort).toBeCloseTo(one.effort/4,15);
  const waiting=planLiveThrowActionV103({...input(),receiverReadySeconds:8});
  expect(waiting.kind).toBe('planned');if(waiting.kind!=='planned')throw new Error(waiting.reason);expect(waiting.controlSeconds).toBe(8);
});
it('bounds selected flights and solver work across distances, ordinary arms and an extreme arm',()=>{
  const summary:{distance:number;capacity:number;deadline:number|null;speed:number|null;effort:number|null;release:number|null;flight:number|null;evaluations:number}[]=[];
  for(const distance of [5,20,40,70,90])for(const capacity of [16,34,45,300_000])for(const deadline of [0,2,Infinity]){
    const r=planLiveThrowActionV103({...input(distance,capacity),deadlineSeconds:deadline}),forecast=r.forecast;
    expect(forecast.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
    expect(forecast.diagnostics.candidateCount).toBeLessThanOrEqual(21);
    if(r.kind==='planned'){
      expect(r.commandSpeedMps).toBeLessThanOrEqual(Math.min(120,capacity));expect(r.effort).toBeGreaterThanOrEqual(0);expect(r.effort).toBeLessThanOrEqual(1);
      expect(r.forecast.arrivalErrorMeters).toBeLessThanOrEqual(.02);expect(r.controlSeconds).toBeGreaterThanOrEqual(r.releaseDelaySeconds+r.flightSeconds);
      summary.push({distance,capacity,deadline:Number.isFinite(deadline)?deadline:null,speed:r.commandSpeedMps,effort:r.effort,release:r.releaseDelaySeconds,flight:r.flightSeconds,evaluations:forecast.diagnostics.solverEvaluationCount});
    }else summary.push({distance,capacity,deadline:Number.isFinite(deadline)?deadline:null,speed:null,effort:null,release:null,flight:null,evaluations:forecast.diagnostics.solverEvaluationCount});
  }
  console.info(JSON.stringify({benchmark:'V103_BOUNDED_OUTPUT_DISTANCE_CAPACITY_DEADLINE_GRID',cases:summary}));
});
