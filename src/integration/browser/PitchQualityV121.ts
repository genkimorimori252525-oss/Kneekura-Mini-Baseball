import type { Vec3 } from '../../core/model/geometry';
import { decomposePitchSpin } from '../../core/sim/pitching/PitchSpinPhysics';

type Observation = Readonly<{ position: Vec3; velocity: Vec3; spin: Vec3 }>;
const magnitude = (v: Vec3) => Math.hypot(v.x, v.y, v.z);
const finiteVector = (v: Vec3) => !!v && [v.x, v.y, v.z].every(Number.isFinite);
/** Observations only. No capability, command, random draw or stored spin is changed. */
export function observePitchQualityV121(input: Readonly<{ release: Observation; plate: Observation;
  windVelocityMps: Vec3; gravityY: number; measurementPlaneZ: number }>) {
  const { release, plate, windVelocityMps: wind, gravityY, measurementPlaneZ } = input;
  if (![release?.position, release?.velocity, release?.spin, plate?.position, plate?.velocity, plate?.spin, wind].every(finiteVector)
    || !Number.isFinite(gravityY) || !Number.isFinite(measurementPlaneZ) || release.velocity.z === 0)
    throw Error('pitch quality: finite observed states and a plane-crossing release required');
  const spinAt = (state: Observation) => {
    const airVelocity = { x: state.velocity.x - wind.x, y: state.velocity.y - wind.y, z: state.velocity.z - wind.z },
      spin = decomposePitchSpin(airVelocity, state.spin);
    return Object.freeze({ totalSpinRpm: spin.totalSpinRadPerSecond * 60 / (2 * Math.PI),
      activeSpinRpm: spin.activeSpinRadPerSecond * 60 / (2 * Math.PI), activeSpinFraction: spin.activeSpinFraction });
  };
  const seconds = (measurementPlaneZ - release.position.z) / release.velocity.z;
  if (!Number.isFinite(seconds) || seconds < 0) throw Error('pitch quality: gravity-only trajectory must reach the measurement plane');
  // This counterfactual has no air: neither drag, Magnus nor seam forces. It
  // keeps the actual release velocity, rather than aiming again at the plate.
  const position = Object.freeze({ x: release.position.x + release.velocity.x * seconds,
    y: release.position.y + release.velocity.y * seconds + gravityY * seconds * seconds / 2, z: measurementPlaneZ });
  return Object.freeze({ version: 'pitch_quality_v121' as const, spinBasis: 'INSTANTANEOUS_AIR_RELATIVE_VELOCITY' as const,
    release: spinAt(release), plate: spinAt(plate),
    releaseToPlateSpeedLossKmh: (magnitude(release.velocity) - magnitude(plate.velocity)) * 3.6,
    gravityOnly: Object.freeze({ basis: 'SAME_RELEASE_AIRLESS_GRAVITY_ONLY_SAME_PLANE' as const, flightSeconds: seconds,
      platePosition: position, horizontalDifferenceCm: (plate.position.x - position.x) * 100,
      verticalDifferenceCm: (plate.position.y - position.y) * 100 }),
    legacyBreakBasis: 'ZERO_SPIN_WITH_ORIGINAL_AIR_AND_SEAM_SETTINGS_SAME_PLANE' as const });
}
