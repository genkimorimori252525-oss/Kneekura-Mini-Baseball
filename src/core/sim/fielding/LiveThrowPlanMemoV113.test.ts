import {expect,it} from 'vitest';
import {REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS} from '../ball/BaseballAerodynamics';
import {planLiveThrowV1,type LiveThrowPlanInputV1} from './LiveThrowPlanV1';
import {exactLiveThrowPhysicalKeyV113,getLiveThrowPhysicalMemoStatsV113,internLiveThrowPhysicalNamespaceV113,memoizeLiveThrowPhysicalV113,withLiveThrowPhysicalMemoV113} from './LiveThrowPhysicalMemoV113';
import {createAeroGroundBallPhysicsProfile} from '../ball/VersionedBattedBallPhysics';
import type {SourceFreeBallBoundary,SourceFreeBallEvaluation} from '../ball/SourceFreeBallKernel';
const source=():LiveThrowPlanInputV1=>({releasePosition:{x:0,y:1.7,z:0},bodyVelocity:{x:0,y:0,z:0},maximumThrowSpeedMps:34,
 spin:{x:120,y:0,z:0},target:{x:0,y:.95,z:20},physics:{kind:'aero_ground_v1',
 air:{ticksPerSecond:1e6,integrationStepTicks:5000,gravityY:-9.81,aerodynamics:REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS},
 ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.2,
 material:{restitution:.48,slidingFriction:.24,rollingDecelerationMps2:.36,normalSpinDecayPerSecond:.18}}},
 effortSelectionV103:{capacityMps:34,remainingTransferSeconds:.2,handPreparationSeconds:.1,chargeElapsedSeconds:0,
 buildSeconds:.6,receiverReadySeconds:.9,deadlineSeconds:2,preferStrongestFeasibleV103:true}});
const values=(r:ReturnType<typeof planLiveThrowV1>)=>JSON.parse(JSON.stringify(r));

it('retains every issued value and logical bound while reusing exact physical work across timing requests',()=>{
 const a=source(),b={...a,effortSelectionV103:{...a.effortSelectionV103!,deadlineSeconds:0}},inputs=[a,b,a],before=JSON.stringify(inputs),
  uncached=inputs.map(i=>values(planLiveThrowV1(i)));
 withLiveThrowPhysicalMemoV113(()=>{
  expect(inputs.map(i=>values(planLiveThrowV1(i)))).toEqual(uncached);
  const s=getLiveThrowPhysicalMemoStatsV113()!;expect(s.shootingHits).toBeGreaterThan(0);expect(s.verificationHits).toBeGreaterThan(0);
  expect(s.entries).toBeLessThanOrEqual(s.maximumEntries);expect(s.verificationEntries).toBeLessThanOrEqual(s.maximumVerificationEntries);
 });
 expect(JSON.stringify(inputs)).toBe(before);expect(getLiveThrowPhysicalMemoStatsV113()).toBeNull();
});

it('keeps wind, spin, target, material and unreachable contrasts identical to no-memo execution',()=>{
 const a=source(),changed=[a,{...a,spin:{x:-80,y:15,z:2}}, {...a,target:{...a.target,x:1}},
  {...a,materialOrientationAtRelease:{w:1,x:0,y:0,z:0}},
  {...a,physics:{...a.physics,air:{...a.physics.air,aerodynamics:{...a.physics.air.aerodynamics,windVelocityMps:{x:2,y:0,z:0}}}}},
  {...a,maximumThrowSpeedMps:5,effortSelectionV103:{...a.effortSelectionV103!,capacityMps:5}}],
  expected=changed.map(i=>values(planLiveThrowV1(i)));
 withLiveThrowPhysicalMemoV113(()=>{expect(changed.map(i=>values(planLiveThrowV1(i)))).toEqual(expected);});
});

it('retains exact incoming verification and boundaries without caching a complete Source kernel',()=>{
 const input=source();
 withLiveThrowPhysicalMemoV113(()=>{
  const plan=planLiveThrowV1(input);expect(plan.kind).toBe('planned');if(plan.kind!=='planned')return;
  const physics=createAeroGroundBallPhysicsProfile(input.physics),namespace=internLiveThrowPhysicalNamespaceV113(()=>exactLiveThrowPhysicalKeyV113(physics)),
   cached=memoizeLiveThrowPhysicalV113<Readonly<{boundaries:readonly SourceFreeBallBoundary[];verified:SourceFreeBallEvaluation}>>('verification',
    ()=>exactLiveThrowPhysicalKeyV113([{tick:0,position:input.releasePosition,velocity:plan.initialVelocity,spin:input.spin},plan.flightSeconds,input.materialOrientationAtRelease]),
    ()=>{throw Error('expected the physically verified candidate to be cached');},namespace);
  expect(Object.keys(cached).sort()).toEqual(['boundaries','verified']);
  expect(cached.verified.moment.ball.position).toBe(plan.predictedArrivalPosition);
  expect(cached.verified.moment.ball.velocity).toBe(plan.predictedArrivalVelocity);
  expect(Object.isFrozen(cached)).toBe(true);expect(Object.isFrozen(cached.boundaries)).toBe(true);
  expect(Object.isFrozen(cached.verified)).toBe(true);
 });
});
