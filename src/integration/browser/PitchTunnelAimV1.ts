import type { Vec3 } from '../../core/model/geometry';
import { sampleAerodynamicPitchStateAtElapsedSeconds, type AerodynamicPitchTrajectoryParameters } from '../../core/sim/pitching/AerodynamicPitchTrajectory';

/** Pitch tunnel aim (opt-in, not wired into the match yet). A pitcher sends a pitch through the point where his fastball,
 * thrown from the same release at the same target, crosses a plane short of the plate (7.25 m by default, the batter's
 * decision point in Baseball Prospectus' tunnel work). share 0 keeps the pitch's own aim, 1 is a full tunnel. Only the
 * release velocity changes: spin, speed and the air are the pitch's own, and no force or timer is added. */
export type PitchTunnelAimInputV1 = Readonly<{
  release: Vec3; target: Vec3; air: AerodynamicPitchTrajectoryParameters; originTick: number;
  pitch: Readonly<{ speedMps: number; spinRadPerSecond: Vec3 }>;
  fastball: Readonly<{ speedMps: number; spinRadPerSecond: Vec3 }>;
  share: number; tunnelDistanceMeters?: number;
}>;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
function assert(value: unknown, message: string): asserts value { if (!value) throw Error('pitch tunnel aim v1: ' + message); }
/** Same inverse as the match's command solve (straight-line guess, then three corrections, horizontal share capped at .65),
 * against any plane z instead of only the plate. */
export function aimPitchThroughPointV1(release: Vec3, point: Vec3, speed: number, spin: Vec3, air: AerodynamicPitchTrajectoryParameters, originTick: number) {
  const guess = (release.z - point.z) / speed;
  let vx = (point.x - release.x) / guess, vy = (point.y - release.y - air.gravityY * guess * guess / 2) / guess,
    vz = -Math.sqrt(Math.max(speed * speed - vx * vx - vy * vy, speed * speed * .5)), flightTime = guess;
  let initial = { tick: originTick, position: release, velocity: { x: vx, y: vy, z: vz }, spin };
  for (let i = 0; i < 3; i++) {
    const at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, flightTime, air);
    flightTime = clamp(flightTime + (point.z - at.position.z) / at.velocity.z, .05, 1.6);
    vx += (point.x - at.position.x) / flightTime; vy += (point.y - at.position.y) / flightTime;
    const horizontal = Math.hypot(vx, vy); if (horizontal > speed * .65) { vx *= speed * .65 / horizontal; vy *= speed * .65 / horizontal; }
    vz = -Math.sqrt(speed * speed - vx * vx - vy * vy); initial = { ...initial, velocity: { x: vx, y: vy, z: vz } };
  }
  return { velocity: initial.velocity, flightTime };
}
function pointAtPlaneV1(release: Vec3, velocity: Vec3, spin: Vec3, z: number, air: AerodynamicPitchTrajectoryParameters, originTick: number, guess: number) {
  const initial = { tick: originTick, position: release, velocity, spin };
  let t = guess, at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air);
  for (let i = 0; i < 4; i++) { t = clamp(t + (z - at.position.z) / at.velocity.z, .02, 1.6); at = sampleAerodynamicPitchStateAtElapsedSeconds(initial, t, air); }
  return { position: { x: at.position.x, y: at.position.y, z }, elapsedSeconds: t };
}
export function solvePitchTunnelAimV1(input: PitchTunnelAimInputV1) {
  const { release, target, air, originTick, pitch, fastball, share } = input, distance = input.tunnelDistanceMeters ?? 7.25;
  assert(Number.isFinite(share) && share >= 0 && share <= 1, 'share must lie in [0, 1]');
  assert(Number.isFinite(distance) && distance > 0 && target.z + distance < release.z, 'tunnel plane must lie between release and target');
  const tunnelZ = target.z + distance,
    fast = aimPitchThroughPointV1(release, target, fastball.speedMps, fastball.spinRadPerSecond, air, originTick),
    fastTunnel = pointAtPlaneV1(release, fast.velocity, fastball.spinRadPerSecond, tunnelZ, air, originTick, fast.flightTime * (release.z - tunnelZ) / (release.z - target.z)),
    own = aimPitchThroughPointV1(release, target, pitch.speedMps, pitch.spinRadPerSecond, air, originTick),
    ownTunnel = pointAtPlaneV1(release, own.velocity, pitch.spinRadPerSecond, tunnelZ, air, originTick, own.flightTime * (release.z - tunnelZ) / (release.z - target.z));
  if (share === 0) return { velocity: own.velocity, tunnelZ, fastballTunnelPoint: fastTunnel.position, tunnelPoint: ownTunnel.position,
    plate: pointAtPlaneV1(release, own.velocity, pitch.spinRadPerSecond, target.z, air, originTick, own.flightTime).position };
  const tunnelPoint = { x: ownTunnel.position.x + share * (fastTunnel.position.x - ownTunnel.position.x),
      y: ownTunnel.position.y + share * (fastTunnel.position.y - ownTunnel.position.y), z: tunnelZ },
    aimed = aimPitchThroughPointV1(release, tunnelPoint, pitch.speedMps, pitch.spinRadPerSecond, air, originTick);
  return { velocity: aimed.velocity, tunnelZ, fastballTunnelPoint: fastTunnel.position, tunnelPoint,
    plate: pointAtPlaneV1(release, aimed.velocity, pitch.spinRadPerSecond, target.z, air, originTick, own.flightTime).position };
}
