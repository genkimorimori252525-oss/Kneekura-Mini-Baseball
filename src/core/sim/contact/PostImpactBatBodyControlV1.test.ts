import { expect,it } from 'vitest';
import { controlledBatBodyPitchFixture } from '../pitch/ControlledBatBodyPitchWorldFixtures.test-support';
import { createRigidBatStateFromBatterSwingState } from './RigidBatBallContact';
import { createPostImpactBatBodyControlV1 } from './PostImpactBatBodyControlV1';
const fixture=()=>({version:'post_impact_bat_body_control_v1' as const,world:controlledBatBodyPitchFixture(),recoveryEndTick:1299999,maximumSweetSpotSpeedMps:20,maximumBodySpeedMps:5});
const near=(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number})=>{for(const k of ['x','y','z']as const)expect(a[k]).toBeCloseTo(b[k],10);};
it('begins at the exact original fractional impact pose with actual recoil CM/angular velocities',()=>{
  const p=fixture(),before=JSON.stringify(p),c=createPostImpactBatBodyControlV1(p),s=c.sample(c.fromElapsedSeconds),impact=c.impact;
  expect(s.bat.state.pose).toEqual(impact.actorsAtContact.bat.state.pose);expect(s.body.position).toEqual(impact.actorsAtContact.body.position);expect(s.hand.position).toEqual(impact.actorsAtContact.hand.position);
  const rigid=createRigidBatStateFromBatterSwingState(s.bat.state,p.world.batPhysical);
  near(rigid.centerOfMassVelocity,impact.contact.batExitCenterOfMassVelocity);near(rigid.angularVelocity,impact.contact.batExitAngularVelocity);
  expect(s.bat.state.linearVelocity).not.toEqual(impact.actorsAtContact.bat.state.linearVelocity);
  expect(impact.moment.elapsedSeconds).not.toBe((impact.moment.ball.tick-impact.moment.originTick)/1e6);expect(JSON.stringify(p)).toBe(before);
});
it('reaches a real finite rest through continuous recovery, without extending original leases',()=>{
  const c=createPostImpactBatBodyControlV1(fixture()),s=c.sample(c.throughElapsedSeconds),zero={x:0,y:0,z:0};
  near(s.bat.state.linearVelocity,zero);near(s.bat.state.angularVelocity,zero);near(s.body.velocity,zero);near(s.hand.velocity,zero);
  const dt=1e-7,one=c.sample(c.fromElapsedSeconds),two=c.sample(c.fromElapsedSeconds+dt);
  const estimated={x:(two.bat.state.pose.grip.x-one.bat.state.pose.grip.x)/dt,y:(two.bat.state.pose.grip.y-one.bat.state.pose.grip.y)/dt,z:(two.bat.state.pose.grip.z-one.bat.state.pose.grip.z)/dt};
  const error=Math.hypot(...(['x','y','z']as const).map(k=>estimated[k]-one.bat.state.linearVelocity[k]));
  const rounding=64*Number.EPSILON*(1+Math.hypot(...Object.values(one.bat.state.pose.grip)))/dt;
  expect(error).toBeLessThanOrEqual(c.certificate.maximumGripAccelerationMps2*dt/2+rounding);
  expect(c.certificate.nativeAdmission).toBe(false);expect(c.certificate.muscleTorqueCalibrated).toBe(false);
  expect(()=>c.sample(c.throughElapsedSeconds+1e-6)).toThrow(/outside finite/);
});
it('refuses caller impulse injection, expired recovery, and a speed limit the actual recoil cannot meet',()=>{
  const p=fixture();expect(()=>createPostImpactBatBodyControlV1({...p,impact:{}}as never)).toThrow(/invalid input/);
  expect(()=>createPostImpactBatBodyControlV1({...p,recoveryEndTick:p.recoveryEndTick+1})).toThrow(/lease/);
  expect(()=>createPostImpactBatBodyControlV1({...p,maximumSweetSpotSpeedMps:1e-6})).toThrow(/speed/);
});
it('returns detached samples so a caller cannot alter subsequent physical poses',()=>{
  const c=createPostImpactBatBodyControlV1(fixture()),t=(c.fromElapsedSeconds+c.throughElapsedSeconds)/2,one=c.sample(t),before=JSON.stringify(one);
  Object.assign(one.bat.state.pose.grip,{x:100});Object.assign(one.body.position,{y:100});Object.assign(one.hand.position,{z:100});expect(JSON.stringify(c.sample(t))).toBe(before);
});
