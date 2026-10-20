import type { Vec3 } from '../../model/geometry';
import { createLiveLocomotionProfileV84, liveAccelerationDistanceV84, liveAccelerationTimeV84,
  liveReachableSpeedV84 } from '../locomotion/LiveLocomotionV84';

/** Bounded-cost first-entry estimate for tactical ranking, not an arrival fact.
 * Uses the motor's speed bands and planting strength without re-simulating each
 * candidate. Actual continuous body/glove contact alone establishes arrival. */
export function estimateLiveFieldArrivalV84(actor: Readonly<{ position: Vec3; velocity: Vec3;
  accelerationMps2: number; topSpeedMps: number; remainingReactionSeconds: number }>, target: Vec3, radius = .28): number {
  const finite = (p: Vec3) => p && [p.x, p.y, p.z].every(Number.isFinite);
  if (!finite(actor.position) || !finite(actor.velocity) || !finite(target)
    || !Number.isFinite(radius) || radius < 0 || !Number.isFinite(actor.remainingReactionSeconds) || actor.remainingReactionSeconds < 0)
    throw new Error('invalid live field arrival estimate');
  const profile = createLiveLocomotionProfileV84(actor), speed = Math.hypot(actor.velocity.x, actor.velocity.z);
  let dx = target.x - actor.position.x, dz = target.z - actor.position.z, distance = Math.hypot(dx, dz);
  if (distance <= radius) return 0;
  let delay = actor.remainingReactionSeconds, along = (actor.velocity.x * dx + actor.velocity.z * dz) / distance;
  // A full plant is the same condition as the live motor. Include the actual
  // drift while dissipating momentum before estimating the new direction.
  if (speed > 0 && (along < 0 || speed >= .25 * profile.topSpeedMps && along / speed < .5)) {
    const stopSeconds = speed / profile.brakingMps2;
    delay += stopSeconds;
    dx -= actor.velocity.x * stopSeconds / 2; dz -= actor.velocity.z * stopSeconds / 2;
    distance = Math.hypot(dx, dz); along = 0;
  } else delay += Math.abs(actor.velocity.x * dz - actor.velocity.z * dx) / distance / profile.lateralAccelerationMps2;
  const initial = Math.max(0, Math.min(profile.topSpeedMps, along)), run = Math.max(0, distance - radius),
    acceleratingDistance = liveAccelerationDistanceV84(profile, initial, profile.topSpeedMps);
  if (run >= acceleratingDistance) return delay + liveAccelerationTimeV84(profile, initial, profile.topSpeedMps)
    + (run - acceleratingDistance) / profile.topSpeedMps;
  return delay + liveAccelerationTimeV84(profile, initial, liveReachableSpeedV84(profile, initial, run));
}
