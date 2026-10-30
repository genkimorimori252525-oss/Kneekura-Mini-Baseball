import { expect,it } from 'vitest';
import { REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { planLiveThrowV1,type LiveThrowPlanInputV1 } from './LiveThrowPlanV1';
const input=(distance=20):LiveThrowPlanInputV1=>({releasePosition:{x:0,y:1,z:0},bodyVelocity:{x:0,y:0,z:0},maximumThrowSpeedMps:34,spin:{x:120,y:0,z:0},target:{x:0,y:1,z:distance},
  physics:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
    ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
      material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}}});
function verify(i:LiveThrowPlanInputV1){
  const result=planLiveThrowV1(i);expect(result.kind).toBe('planned');if(result.kind!=='planned')throw new Error(result.reason);
  expect(result.relativeReleaseSpeedMps).toBeLessThanOrEqual(i.maximumThrowSpeedMps);
  const predicted=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,
    ball:{tick:0,position:i.releasePosition,velocity:result.initialVelocity,spin:i.spin}},throughElapsedSeconds:result.flightSeconds,profile:i.physics}),
    arrival=predicted.evaluateAt(result.flightSeconds,'incoming').moment.ball.position;
  expect(Math.hypot(arrival.x-i.target.x,arrival.y-i.target.y,arrival.z-i.target.z)).toBeLessThanOrEqual(.02);
  expect(predicted.boundaries.some(b=>b.kind==='ground'&&b.elapsedSeconds<result.flightSeconds)).toBe(false);return result;
}
it('commands a short infield throw through the same Aero model without moving its target',()=>{
  const i=input(),before=JSON.stringify(i),r=verify(i);expect(r.flightSeconds).toBeLessThan(1);expect(r.diagnostics.actualSourceRead).toBe(false);expect(JSON.stringify(i)).toBe(before);
});
it('reaches seventy metres with an airborne speed-bounded arc when the physical command permits it',()=>{
  const r=verify(input(70));expect(r.flightSeconds).toBeGreaterThan(2);expect(r.flightSeconds).toBeLessThanOrEqual(4);expect(r.arrivalErrorMeters).toBeLessThanOrEqual(.02);
});
it('refuses an unreachable long throw rather than lowering the target or editing an actual ball',()=>{
  const i={...input(140),maximumThrowSpeedMps:16},before=JSON.stringify(i),r=planLiveThrowV1(i);
  expect(r.kind).toBe('unreachable');expect(JSON.stringify(i)).toBe(before);expect(r.diagnostics.solverEvaluationCount).toBeLessThanOrEqual(100);
});
it('bounds arm release speed relative to body motion and retains actual spin/wind in its prediction',()=>{
  const i=input(35),r=verify({...i,bodyVelocity:{x:3,y:0,z:4},spin:{x:-80,y:35,z:10},
    physics:{...i.physics,air:{...i.physics.air,aerodynamics:{...i.physics.air.aerodynamics,windVelocityMps:{x:4,y:0,z:-2}}}}});
  expect(Math.hypot(r.initialVelocity.x-3,r.initialVelocity.y,r.initialVelocity.z-4)).toBeLessThanOrEqual(34);
});
it('remains deterministic and reports performance outside the issued command',()=>{
  const one=verify(input(70)),two=verify(input(70));expect(one.initialVelocity).toEqual(two.initialVelocity);expect(one.flightSeconds).toBe(two.flightSeconds);
  expect(one.diagnostics).toEqual(two.diagnostics);
  const cpu=process.cpuUsage(),measured=planLiveThrowV1(input(70)),used=process.cpuUsage(cpu);
  expect(measured.kind).toBe('planned');const perf=measured.readPerformance();expect(perf).toEqual(measured.readPerformance());
  console.info(JSON.stringify({benchmark:'70M_AERO_THROW_COMMAND',...perf,processCpuUserMilliseconds:used.user/1000,processCpuSystemMilliseconds:used.system/1000}));
});
it('rejects hidden future-world input, invalid speed and below-ground endpoints',()=>{
  const i=input();expect(()=>planLiveThrowV1({...i,futureActualSource:{}} as unknown as LiveThrowPlanInputV1)).toThrow(/finite throw command/);
  expect(()=>planLiveThrowV1({...i,maximumThrowSpeedMps:0})).toThrow();expect(()=>planLiveThrowV1({...i,target:{...i.target,y:-1}})).toThrow(/floor/);
});
it('retains held seam orientation when planning and verifying a new physical throw',()=>{
  const base=input(),phase={w:Math.cos(.4),x:Math.sin(.4),y:0,z:0},raw={...base,spin:{x:8,y:0,z:3},materialOrientationAtRelease:phase,
    physics:{...base.physics,air:{...base.physics.air,aerodynamics:{...base.physics.air.aerodynamics,
      seamForce:{version:'baseball_seam_force_v1' as const,coefficientScale:1}}}}},before=JSON.stringify(raw),result=planLiveThrowV1(raw);
  expect(result.kind).toBe('planned');if(result.kind!=='planned')throw new Error(result.reason);
  const source=createSourceFreeBallKernel({kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,
    ball:{tick:0,position:raw.releasePosition,velocity:result.initialVelocity,spin:raw.spin}},throughElapsedSeconds:result.flightSeconds,
    profile:raw.physics,materialOrientationAtStart:phase}),arrival=source.evaluateAt(result.flightSeconds,'incoming');
  expect(result.predictedArrivalPosition).toEqual(arrival.moment.ball.position);expect(result.predictedMaterialOrientation).toEqual(arrival.materialOrientation);
  expect(result.predictedMaterialOrientation).not.toEqual(phase);expect(result.arrivalErrorMeters).toBeLessThanOrEqual(.02);
  expect(JSON.stringify(raw)).toBe(before);const {materialOrientationAtRelease:_omitted,...withoutPhase}=raw;
  expect(()=>planLiveThrowV1(withoutPhase)).toThrow(/orientation|material|phase/i);
});
