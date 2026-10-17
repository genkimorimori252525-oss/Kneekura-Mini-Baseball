import { expect,it } from 'vitest';
import { REFERENCE_BASEBALL_AERODYNAMICS } from '../ball/BaseballAerodynamics';
import { createSourceFreeBallKernel } from '../ball/SourceFreeBallKernel';
import { controlledHeldPitchFixture } from './ControlledHeldPitchFixtures.test-support';
import { queryControlledPitchWorldV1,queryControlledPitchWorldWithHoldRenewalV1,type ControlledPitchWorldInputV1 } from './ControlledPitchWorldV1';
import type { ControlledHeldPitchAnchorsV1 } from './ControlledHeldPitchV1';
const fixture=():ControlledPitchWorldInputV1=>{
  const zero={x:0,y:0,z:0},a:ControlledHeldPitchAnchorsV1={initialBall:{tick:0,position:{x:-.3,y:1.05,z:18.1},velocity:zero,spin:zero},
    initialHand:{position:{x:-.3,y:1.05,z:18.1},velocity:zero},shoulder:{x:0,y:1.4,z:18},armReachM:.8,handRadiusM:.06,ballRadiusM:.0366,
    release:{releaseAtUs:600000,position:{x:.08,y:1.52,z:17.84},velocity:{x:0,y:0,z:-27},spin:{x:0,y:75,z:0}},releaseAcceleration:{x:0,y:-9.81,z:3},
    followThroughEndTick:800000,obstacles:[]};
  return {anchors:a,motion:controlledHeldPitchFixture(a),pitcherPlayerId:'p',throughTick:620000,otherActors:[],
    descriptor:{kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:600000,elapsedSeconds:0,ball:{tick:600000,...{position:a.release.position,velocity:a.release.velocity,spin:a.release.spin}}},
      throughElapsedSeconds:.2,profile:{kind:'aero_ground_v1',air:{ticksPerSecond:1e6,integrationStepTicks:2000,gravityY:-9.81,aerodynamics:REFERENCE_BASEBALL_AERODYNAMICS},
        ground:{ticksPerSecond:1e6,gravityMps2:9.81,radiusM:.0366,inertiaRatio:.378,restingVerticalSpeedMps:.15,
          material:{restitution:.4,slidingFriction:.25,rollingDecelerationMps2:1,normalSpinDecayPerSecond:.5}}}}};
};
it('retains the exact original ball root and a real hand collider after an explicit successor command',()=>{
  const f=structuredClone(fixture()),r=f.anchors.release;
  Object.assign(r.velocity,{z:-.5});Object.assign(r.spin,{y:0});Object.assign(f.anchors.releaseAcceleration,{x:0,y:-9.81,z:0});
  Object.assign(f.descriptor.profile.air,{aerodynamics:{...REFERENCE_BASEBALL_AERODYNAMICS,airDensityKgM3:0}});
  // Authored collision fixture under the SAME nonzero air/ground gravity.
  // This analytical test placement is not a production planning input.
  const next={x:r.position.x,y:r.position.y-9.81*.3*.3/2,z:r.position.z-.5*.3};
  const first=f.motion.followThrough[0];
  Object.assign(f.motion,{followThrough:[first,
    {tick:650000,handCenter:{x:.38,y:r.position.y,z:r.position.z+.1},handVelocity:{x:0,y:0,z:0}},
    {tick:700000,handCenter:{...next,x:.38},handVelocity:{x:0,y:0,z:0}},
    {tick:800000,handCenter:next,handVelocity:{x:0,y:0,z:0}}]});
  Object.assign(f,{throughTick:900000});Object.assign(f.descriptor,{throughElapsedSeconds:.3});
  const before=JSON.stringify(f);
  expect(()=>queryControlledPitchWorldV1(f)).toThrow(/finite control/);
  const old=queryControlledPitchWorldV1({...f,throughTick:800000,descriptor:{...f.descriptor,throughElapsedSeconds:.2}});
  expect(old.kind).toBe('moving');
  const result=queryControlledPitchWorldWithHoldRenewalV1(f,{version:'pitch_hand_hold_renewal_v1',fromTick:800000,throughTick:950000,sceneThroughTick:1200000});
  expect(result.kind).toBe('boundary');if(result.kind!=='boundary')throw new Error('successor hand collider missing');
  expect(result.moment.ball.tick).toBeGreaterThan(800000);
  expect(result.contacts).toContainEqual(expect.objectContaining({kind:'actor',playerId:'p',role:'tag_hand'}));
  expect(result.moment.ball).toEqual(createSourceFreeBallKernel(f.descriptor).evaluateAt(result.moment.elapsedSeconds,'incoming').moment.ball);
  expect(JSON.stringify(f)).toBe(before);
});
it('advances the original free Source from its current separating hand constraint, without a clock or point correction',()=>{
  const f=fixture(),before=JSON.stringify(f),r=queryControlledPitchWorldV1(f);
  if(r.kind==='unresolved')throw new Error(r.reason);
  expect(r.kind).toBe('moving');expect(r.contacts).toEqual([]);expect(r.moment.ball).toEqual(createSourceFreeBallKernel(f.descriptor).evaluateAt(.02).moment.ball);
  expect(r.departure.outwardVelocityMps).toBe(0);expect(r.departure.quadraticLowerCoefficient).toBeGreaterThan(0);
  expect(r.departure.positionOrClockCorrected).toBe(false);expect(JSON.stringify(f)).toBe(before);
  queryControlledPitchWorldV1({...f,throughTick:610000});expect(queryControlledPitchWorldV1(f)).toEqual(r);
});
it('keeps the other original body colliders active and stops at actual contact',()=>{
  const f=fixture(),point=createSourceFreeBallKernel(f.descriptor).evaluateAt(.01).moment.ball.position;
  const r=queryControlledPitchWorldV1({...f,otherActors:[{playerId:'another',primitive:{role:'body',radius:.02,
    startTick:600000,endTick:800000,ticksPerSecond:1e6,startCenter:point,startVelocity:{x:0,y:0,z:0},acceleration:{x:0,y:0,z:0}}}]});
  expect(r.kind).toBe('boundary');if(r.kind!=='boundary')throw new Error('body contact missing');
  expect(r.moment.ball.tick).toBeLessThan(610000);expect(r.contacts[0]).toMatchObject({kind:'actor',playerId:'another',role:'body'});
});
it('does not omit the moving hand after its initial departure interval',()=>{
  const f=structuredClone(fixture()) as any;
  f.anchors.release.velocity.z=-.5;f.descriptor.initial.ball.velocity.z=-.5;f.motion.held.at(-1).handVelocity.z=-.5;f.motion.followThrough[0].handVelocity.z=-.5;
  f.motion.followThrough[1].handCenter={...f.motion.followThrough[0].handCenter,z:f.motion.followThrough[0].handCenter.z-.01};
  f.motion.followThrough[2].handCenter=createSourceFreeBallKernel(f.descriptor).evaluateAt(.2).moment.ball.position;f.throughTick=800000;
  const r=queryControlledPitchWorldV1(f);expect(r.kind).toBe('boundary');
  if(r.kind!=='boundary')throw new Error('moving hand contact missing');expect(r.contacts[0]).toMatchObject({kind:'actor',playerId:'p',role:'tag_hand'});
});
it.each(['expiry','release','duplicate-hand'] as const)('refuses %s instead of extending control or replacing original state',fault=>{
  const f=structuredClone(fixture()) as any;
  if(fault==='expiry')f.throughTick=800001;
  if(fault==='release')f.descriptor.initial.ball.position.z+=.01;
  if(fault==='duplicate-hand')f.otherActors=[{playerId:'p',primitive:{role:'tag_hand'}}];
  expect(()=>queryControlledPitchWorldV1(f)).toThrow();
});
