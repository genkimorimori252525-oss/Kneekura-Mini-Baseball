import type { Vec3 } from '../../model/geometry';
import { buildLiveSpeedPlanV84, createLiveLocomotionProfileV84 } from '../locomotion/LiveLocomotionV84';

/** Arrival while approaching the receiving point and braking toward its motor
 * stop. Unlike a fastest first-entry estimate, this does not assume continued
 * acceleration through the bag. Unlike a rest restart, it keeps momentum.
 * This is a bounded tactical estimate; actual ball/glove contact is mandatory. */
export function estimateLiveReceiverArrivalV106(actor: Readonly<{ position: Vec3; velocity: Vec3;
  accelerationMps2: number; topSpeedMps: number; remainingReactionSeconds: number }>, target: Vec3, radius = .28): number {
  const finite = (p: Vec3) => p && [p.x,p.y,p.z].every(Number.isFinite);
  if (!finite(actor.position) || !finite(actor.velocity) || !finite(target) || !Number.isFinite(radius) || radius < 0
    || !Number.isFinite(actor.remainingReactionSeconds) || actor.remainingReactionSeconds < 0)
    throw new Error('invalid live receiver arrival');
  const profile = createLiveLocomotionProfileV84(actor);
  let x=actor.position.x,z=actor.position.z,vx=actor.velocity.x,vz=actor.velocity.z,delay=0;
  const driftBrake = (seconds:number) => {
    const speed=Math.hypot(vx,vz),used=Math.min(seconds,speed/profile.brakingMps2),factor=speed?used-.5*profile.brakingMps2*used*used/speed:0,
      ratio=speed?Math.max(0,1-profile.brakingMps2*used/speed):0;
    x+=vx*factor;z+=vz*factor;vx*=ratio;vz*=ratio;delay+=seconds;
  };
  if(Math.hypot(target.x-x,target.z-z)<=radius)return 0;
  // Before the reaction cue the same live motor brakes, rather than granting
  // a dormant receiver an immediate acceleration command.
  if(actor.remainingReactionSeconds>0)driftBrake(actor.remainingReactionSeconds);
  let dx=target.x-x,dz=target.z-z,distance=Math.hypot(dx,dz),speed=Math.hypot(vx,vz),along=distance?(vx*dx+vz*dz)/distance:0;
  if(distance<=radius)return delay;
  const lateral=distance?Math.abs(vx*dz-vz*dx)/distance:0;
  const stopRadius=Math.min(.02,radius);
  if(along<0 || lateral>1e-8 || speed*speed/(2*profile.brakingMps2)>Math.max(0,distance-stopRadius)){
    driftBrake(speed/profile.brakingMps2);dx=target.x-x;dz=target.z-z;distance=Math.hypot(dx,dz);along=0;
  }
  if(distance<=radius)return delay;
  // Small authored touch radii remain accepted; the estimate then approaches
  // that stricter point. Only actual contact can establish a retirement.
  const plan=buildLiveSpeedPlanV84({profile,distanceMeters:Math.max(0,distance-stopRadius),initialSpeedMps:Math.max(0,Math.min(profile.topSpeedMps,along)),finalSpeedMps:0});
  if(!plan)throw new Error('live receiver arrival: no finite stopping plan');
  const travelled=distance-radius,segment=plan.segments.find(s=>travelled<=s.endDistanceMeters)??plan.segments.at(-1)!;
  const local=Math.max(0,travelled-segment.startDistanceMeters),atSpeed=Math.sqrt(Math.max(0,segment.startSpeedMps**2+2*segment.accelerationMps2*local));
  return delay+segment.startElapsedSeconds+(local===0?0:2*local/(segment.startSpeedMps+atSpeed));
}
