import { expect,it } from 'vitest';
import * as recovery from './BatterSwingExitRecoveryTrajectory';
const route={segments:[{kind:'line' as const,start:{x:0,z:0},end:{x:30,z:0}}]};
const parameters={ticksPerSecond:1_000_000,maximumBodyTurnRateRadiansPerSecond:Math.PI,lateralRealignmentAccelerationMps2:3,backwardRecoveryAccelerationMps2:4};
const build=(velocity={x:0,z:0},facing={x:0,z:1})=>recovery.buildBatterSwingExitRecoveryTrajectory({tick:0,planarVelocity:velocity,bodyForwardUnit:facing},route,parameters);
const piece=(t:ReturnType<typeof build>,seconds:number)=>{
  const fn=(recovery as unknown as {batterSwingExitRecoveryMotionPieceAt?:Function}).batterSwingExitRecoveryMotionPieceAt;
  expect(fn,'exact recovery root pieces are missing').toBeTypeOf('function');return fn!(t,seconds);
};
it('BRR01 keeps turn-only recovery root stationary while facing remains an independent existing sample',()=>{
  const t=build(),p=piece(t,0);expect(p.endElapsedSeconds).toBe(0.5);expect(p.position).toEqual({x:0,z:0});expect(p.velocity).toEqual({x:0,z:0});expect(p.acceleration).toEqual({x:0,z:0});
  expect(recovery.sampleBatterSwingExitRecoveryTrajectory(t,250_000).bodyForwardUnit).not.toEqual({x:0,z:1});
});
it('BRR02 exposes exact adverse-component knots and reproduces existing root samples in each piece',()=>{
  const t=build({x:-1,z:1},{x:1,z:0});let at=0,n=0;
  while(at<t.transition.recoverySeconds){const p=piece(t,at);expect(p.endElapsedSeconds).toBeGreaterThan(at);
    const tick=Math.ceil((at+(p.endElapsedSeconds-at)/2)*t.ticksPerSecond);
    if(tick/t.ticksPerSecond<p.endElapsedSeconds){const expected=recovery.sampleBatterSwingExitRecoveryTrajectory(t,tick),dt=tick/t.ticksPerSecond-at;
      for(const k of ['x','z'] as const){expect(p.position[k]+p.velocity[k]*dt+0.5*p.acceleration[k]*dt*dt).toBeCloseTo(expected.position[k],12);expect(p.velocity[k]+p.acceleration[k]*dt).toBeCloseTo(expected.velocity[k],12);}}
    at=p.endElapsedSeconds;expect(++n).toBeLessThan(8);
  }
  expect(n).toBeGreaterThan(2);
});
it('BRR03 keeps positive-forward fractional recovery continuous to its exact physical launch',()=>{
  const t=recovery.buildBatterSwingExitRecoveryTrajectory({tick:0,planarVelocity:{x:1,z:0},bodyForwardUnit:{x:0,z:1}},route,{...parameters,maximumBodyTurnRateRadiansPerSecond:1});
  const p=piece(t,0);expect(p.endElapsedSeconds).toBe(t.transition.recoverySeconds);expect(p.endElapsedSeconds).toBeLessThan(t.endTick/t.ticksPerSecond);
  expect(p.position.x+p.velocity.x*p.endElapsedSeconds).toBe(t.transition.launchRouteDistanceMeters);expect(p.velocity.x).toBe(1);
});
it('BRR04 permits positive forward motion when the existing recovery duration is an exact launch tick',()=>{
  const p=piece(build({x:1,z:0}),0);expect(p.velocity).toEqual({x:1,z:0});expect(p.endElapsedSeconds).toBe(0.5);
});
it.each([-1,NaN,Infinity,0.5])('BRR05 rejects exhausted or invalid elapsed cut %s',seconds=>expect(()=>piece(build(),seconds)).toThrow());
