import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { SeedRoot } from '../../rng/SeedRoot';

/** Explicit angular motor error, not a hit/out probability. Each independent
 * yaw/pitch is uniform ±sqrt(3)*sigma: zero mean and standard deviation sigma.
 * Only the velocity relative to the throwing body is rotated. Spin is retained
 * exactly; spin error/coupled hand torque has not been calibrated. */
export function applyLiveThrowDirectionV1(raw: Readonly<{ velocity: Vec3; bodyVelocity: Vec3; spin: Vec3;
  standardDeviationRadians: number; seed: number; releaseOrdinal: number }>) {
  const input = cloneInert(raw), finite = (p: Vec3) => p && [p.x, p.y, p.z].every(Number.isFinite), sigma = input.standardDeviationRadians;
  if (![input.velocity, input.bodyVelocity, input.spin].every(finite) || !Number.isFinite(sigma) || sigma < 0 || sigma > .12
    || !Number.isSafeInteger(input.seed) || input.seed < 0 || input.seed > 0xffffffff
    || !Number.isSafeInteger(input.releaseOrdinal) || input.releaseOrdinal < 0 || input.releaseOrdinal > 0xffffffff)
    throw new Error('invalid live throw direction SI/seed/ordinal');
  let yawRadians = 0, pitchRadians = 0, velocity = input.velocity;
  if (sigma !== 0) {
    const rng = new SeedRoot(input.seed).streamRng(0, 'fielding', 'throw-direction-v1:' + input.releaseOrdinal), bound = Math.sqrt(3) * sigma;
    yawRadians = (2 * rng.nextFloat() - 1) * bound; pitchRadians = (2 * rng.nextFloat() - 1) * bound;
    const x = input.velocity.x - input.bodyVelocity.x, y = input.velocity.y - input.bodyVelocity.y, z = input.velocity.z - input.bodyVelocity.z,
      cy = Math.cos(yawRadians), sy = Math.sin(yawRadians), horizontal = { x: cy * x + sy * z, y, z: -sy * x + cy * z },
      length = Math.hypot(horizontal.x, horizontal.z), axis = length === 0 ? { x: 1, z: 0 } : { x: -horizontal.z / length, z: horizontal.x / length },
      cp = Math.cos(pitchRadians), sp = Math.sin(pitchRadians), dot = axis.x * horizontal.x + axis.z * horizontal.z;
    velocity = {
      x: input.bodyVelocity.x + horizontal.x * cp - axis.z * horizontal.y * sp + axis.x * dot * (1 - cp),
      y: input.bodyVelocity.y + horizontal.y * cp + (axis.z * horizontal.x - axis.x * horizontal.z) * sp,
      z: input.bodyVelocity.z + horizontal.z * cp + axis.x * horizontal.y * sp + axis.z * dot * (1 - cp),
    };
  }
  return Object.freeze({ velocity: Object.freeze(velocity), spin: Object.freeze(input.spin), yawRadians, pitchRadians,
    standardDeviationRadians: sigma, seed: input.seed, releaseOrdinal: input.releaseOrdinal,
    distribution: 'INDEPENDENT_ZERO_MEAN_BOUNDED_UNIFORM_YAW_PITCH_V1' as const,
    speedBasis: 'THROWER_BODY_RELATIVE' as const });
}
