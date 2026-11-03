import { expect, it } from 'vitest';
import { estimateLiveReceiverArrivalV106 } from './LiveReceiverArrivalV106';
import { createLiveLocomotionProfileV84, stepLiveDefenderMotionV84 } from '../locomotion/LiveLocomotionV84';
const v=(x=0,y=0,z=0)=>({x,y,z});
const actor={position:v(),velocity:v(7,0,0),topSpeedMps:9.8,accelerationMps2:6,remainingReactionSeconds:0};
it('keeps incoming momentum and includes the live braking approach to the bag',()=>{
  const target=v(3.6,0,0),estimate=estimateLiveReceiverArrivalV106(actor,target),rest=estimateLiveReceiverArrivalV106({...actor,velocity:v()},target),
    profile=createLiveLocomotionProfileV84(actor);let p={x:0,z:0},velocity={x:7,z:0},elapsed=0;
  while(Math.hypot(p.x-target.x,p.z-target.z)>.28&&elapsed<5){const dt=.004,c=stepLiveDefenderMotionV84({position:p,velocity},target,dt,profile),used=Math.min(dt,c.stopAfter??dt);
    p={x:p.x+velocity.x*used+.5*c.acceleration.x*used**2,z:p.z+velocity.z*used+.5*c.acceleration.z*used**2};
    velocity=c.stopAfter!==undefined?{x:0,z:0}:{x:velocity.x+c.acceleration.x*dt,z:velocity.z+c.acceleration.z*dt};elapsed+=dt;}
  expect(estimate).toBeLessThan(rest);expect(Math.abs(estimate-elapsed)).toBeLessThan(.06);
});
it('preserves dormant reaction and reversal instead of inventing an available receiver',()=>{
  expect(estimateLiveReceiverArrivalV106({...actor,velocity:v(),remainingReactionSeconds:60},v(4,0,0))).toBeGreaterThan(60);
  expect(estimateLiveReceiverArrivalV106({...actor,velocity:v(-7,0,0)},v(4,0,0))).toBeGreaterThan(estimateLiveReceiverArrivalV106({...actor,velocity:v()},v(4,0,0)));
  expect(estimateLiveReceiverArrivalV106({...actor,remainingReactionSeconds:60},v(.1,0,0))).toBe(0);
  expect(Number.isFinite(estimateLiveReceiverArrivalV106({...actor,velocity:v()},v(4,0,0),.01))).toBe(true);
});
