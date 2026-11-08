import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldMotionActor } from '../ball/BallWorldContinuation';
import type { SourceBallWorldMotionInputV1 } from '../ball/SourceBallWorldMotionV1';
import { measureRigidBatBallSurfaceSeparation } from '../contact/RigidBatBallContact';

type Input = Readonly<{ actors: readonly BallWorldMotionActor[]; root: SourceBallWorldMotionInputV1; durationSeconds: number;
  footGroundSupport: Readonly<{ kind: 'compliant_stationary_sole_v1'; maximumCompressionMeters: number }> }>;
const axes = ['x', 'y', 'z'] as const, norm = (p: Vec3) => Math.hypot(p.x, p.y, p.z);
const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
function assert(p: unknown, message: string): asserts p { if (!p) throw new Error('finite field actor clearance: ' + message); }

/** Conservative continuous nonintersection proof for the accepted horizontal
 * rigid-actor proxy. Different players and retained equipment remain solid.
 * Same-player spheres are anatomical proxies, not independent solid objects;
 * the holder's tag hand is the already reconstructed grasp constraint. */
export function proveFiniteFieldActorClearanceV1(raw: Input) {
  const p = cloneInert(raw), start = p.root.cursor.moment, duration = p.durationSeconds;
  assert(Number.isFinite(duration) && duration > 0 && Array.isArray(p.actors) && p.actors.length > 0, 'invalid finite interval');
  assert(p.footGroundSupport?.kind === 'compliant_stationary_sole_v1' && Number.isFinite(p.footGroundSupport.maximumCompressionMeters)
    && p.footGroundSupport.maximumCompressionMeters >= 0, 'explicit foot support model required');
  const tps = p.root.response.world.parameters.ticksPerSecond;
  const supportedFeet: { playerId: string; role: string; signedGroundGapMeters: number; maximumCompressionMeters: number }[] = [];
  const actors = p.actors.map(a => {
    const s = a.primitive;
    assert(a.startElapsedSeconds === start.elapsedSeconds && s.startTick === start.originTick
      && s.ticksPerSecond === tps && s.startVelocity.y === 0 && s.acceleration.y === 0
      && start.elapsedSeconds + duration <= (s.endTick - start.originTick) / tps, 'unsupported actor basis/ground coverage');
    const groundGap = s.startCenter.y - s.radius;
    if (s.role === 'left_foot' || s.role === 'right_foot') {
      const original = p.root.response.world.actors.find(x => x.playerId === a.playerId && x.primitive.role === s.role);
      assert(original && original.primitive.startCenter.y === s.startCenter.y && original.primitive.startVelocity.y === 0 && original.primitive.acceleration.y === 0
        && p.footGroundSupport.maximumCompressionMeters < s.radius && groundGap >= -p.footGroundSupport.maximumCompressionMeters, 'unsupported original sole/ground coverage');
      supportedFeet.push({ playerId: a.playerId, role: s.role, signedGroundGapMeters: groundGap, maximumCompressionMeters: p.footGroundSupport.maximumCompressionMeters });
    } else assert(groundGap >= 0, 'unsupported actor basis/ground coverage');
    const at = (t: number): Vec3 => Object.fromEntries(axes.map(k => [k, s.startCenter[k] + s.startVelocity[k] * t + .5 * s.acceleration[k] * t * t])) as Vec3;
    const endVelocity = Object.fromEntries(axes.map(k => [k, s.startVelocity[k] + s.acceleration[k] * duration])) as Vec3;
    return { a, at, speed: Math.max(norm(s.startVelocity), norm(endVelocity)) };
  });
  let budget = 200000, proofs = 0;
  const prove = (gap: (t: number) => number, speed: number, scale: number, lo = 0, hi = duration, depth = 0): void => {
    assert(--budget >= 0, 'continuous proof budget exhausted');
    const mid = (lo + hi) / 2, g = gap(mid), arithmetic = 256 * Number.EPSILON * Math.max(1, scale);
    assert(Number.isFinite(g), 'nonfinite separation');
    if (g > speed * (hi - lo) / 2 + arithmetic) { proofs++; return; }
    assert(g > arithmetic && depth < 40 && mid !== lo && mid !== hi, 'uncertified continuous actor/obstacle clearance');
    prove(gap, speed, scale, lo, mid, depth + 1); prove(gap, speed, scale, mid, hi, depth + 1);
  };
  for (const [i, one] of actors.entries()) {
    const radius = one.a.primitive.radius, scale = norm(one.at(0)) + norm(one.at(duration)) + radius;
    for (const two of actors.slice(i + 1)) if (one.a.playerId !== two.a.playerId)
      prove(t => distance(one.at(t), two.at(t)) - radius - two.a.primitive.radius, one.speed + two.speed,
        scale + norm(two.at(0)) + norm(two.at(duration)) + two.a.primitive.radius);
    for (const item of p.root.heldBats) if (!(item.holderPlayerId === one.a.playerId && one.a.primitive.role === 'tag_hand')) {
      assert(norm(item.bat.centerOfMassVelocity) === 0 && norm(item.bat.angularVelocity) === 0, 'moving equipment controller required');
      // Geometry-only sphere query; no baseball mass/impulse is assigned to a body.
      prove(t => measureRigidBatBallSurfaceSeparation({ tick: start.ball.tick, position: one.at(t), velocity: { x: 0, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } },
        item.bat, { ...item.ball, radiusM: radius }), one.speed, scale + norm(item.bat.pose.grip) + norm(item.bat.pose.tip));
    }
    for (const wall of p.root.response.world.surfaces) {
      const dx = wall.end.x - wall.start.x, dz = wall.end.z - wall.start.z, square = dx * dx + dz * dz;
      assert(square > 0, 'degenerate wall');
      prove(t => { const point = one.at(t), u = Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.z - wall.start.z) * dz) / square));
        return distance(point, { x: wall.start.x + u * dx, y: Math.max(wall.minimumHeight, Math.min(wall.maximumHeight, point.y)), z: wall.start.z + u * dz }) - radius;
      }, one.speed, scale + Math.hypot(wall.start.x, wall.start.z, wall.end.x, wall.end.z, wall.maximumHeight));
    }
    if (p.root.baseGeometry) for (const base of Object.values(p.root.baseGeometry.bases)) {
      const r = base.region, c = Math.cos(r.rotationRadians), s = Math.sin(r.rotationRadians);
      prove(t => { const point = one.at(t), dx = point.x - r.center.x, dz = point.z - r.center.z;
        const x = Math.max(-r.halfSize.x, Math.min(r.halfSize.x, dx * c + dz * s)), z = Math.max(-r.halfSize.z, Math.min(r.halfSize.z, -dx * s + dz * c));
        return distance(point, { x: r.center.x + x * c - z * s, y: Math.max(base.bottomY, Math.min(base.topY, point.y)), z: r.center.z + x * s + z * c }) - radius;
      }, one.speed, scale + Math.hypot(r.center.x, r.center.z, base.topY));
    }
  }
  // V1 supports retained equipment against actor+ground scenes only. A supplied
  // venue needs an equipment/venue sweep before it can become executable.
  assert(p.root.heldBats.length === 0 || p.root.response.world.surfaces.length === 0 && p.root.baseGeometry === null,
    'equipment/venue clearance controller required');
  return Object.freeze({ kind: 'finite_field_actor_clearance_v1' as const, durationSeconds: duration, actorCount: actors.length,
    heldBatCount: p.root.heldBats.length, continuousClearanceProven: true, proofIntervals: proofs,
    footGroundSupport: Object.freeze(p.footGroundSupport), supportedFeet: Object.freeze(supportedFeet.map(foot => Object.freeze(foot))), positionsOrClockCorrected: false });
}
