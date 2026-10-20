import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldMoment } from '../ball/BallWorldContinuation';
import type { SourceFreeBallKernel, SourceFreeBallEvaluation } from '../ball/SourceFreeBallKernel';
import type { AeroGroundBallPhysicsV1 } from '../ball/VersionedBattedBallPhysics';
import { sampleBaseballGroundMotionAtElapsedSeconds } from '../ball/BaseballGroundDynamics';
import { advanceBaseballOrientation, IDENTITY_QUATERNION } from '../pitching/BaseballOrientation';
import { quantizeEventTick } from '../ExactEventTime';

const freeze = <T>(value: T): T => { if (value && typeof value === 'object') {
  Object.values(value).forEach(freeze); Object.freeze(value);
} return value; };

/** A distinct constrained source, never labelled as an unimpeded free Source.
 * Ground slip/rolling dissipation owns the tangential arc coordinate. The
 * compliant wall owns the radial support reaction. Its reduced-order spin frame
 * is transported around that arc; three-dimensional pad deformation is not a
 * measured model. Observations do not restart either integration lattice. */
export function createGroundWallRollingCurveV1(raw: Readonly<{ initial: BallWorldMoment; throughElapsedSeconds: number;
  profile: AeroGroundBallPhysicsV1; fenceCenter: Vec3; nominalContactRadiusMeters: number; maximumCompressionMeters: number }>) {
  const p = freeze(cloneInert(raw)), initial = p.initial, b = initial.ball, tps = p.profile.ground.ticksPerSecond;
  const rx = b.position.x - p.fenceCenter.x, rz = b.position.z - p.fenceCenter.z, radius = Math.hypot(rx, rz);
  const gap = p.nominalContactRadiusMeters - radius, tangent = { x: rz / radius, y: 0, z: -rx / radius };
  const radialVelocity = (rx * b.velocity.x + rz * b.velocity.z) / radius;
  if (!(radius > 0 && Number.isFinite(radius) && gap <= 0 && gap >= -p.maximumCompressionMeters
    && p.maximumCompressionMeters >= 0 && p.maximumCompressionMeters < p.profile.ground.radiusM
    && b.position.y === p.profile.ground.radiusM && b.velocity.y === 0
    && Math.abs(radialVelocity) <= 256 * Number.EPSILON * Math.max(1, Math.hypot(b.velocity.x,b.velocity.z))
    && p.throughElapsedSeconds > initial.elapsedSeconds && p.throughElapsedSeconds - initial.elapsedSeconds <= 120))
    throw new Error('ground wall rolling: actual supported floor/wall impulse basis required');
  const total = p.throughElapsedSeconds - initial.elapsedSeconds;
  const groundThrough = sampleBaseballGroundMotionAtElapsedSeconds(b, total, p.profile.ground);
  const boundaries: SourceFreeBallKernel['boundaries'] = groundThrough.transitions.map(t => ({
    kind: t.kind === 'rolling_started' ? 'rolling_started' : 'rolling_stop', elapsedSeconds: initial.elapsedSeconds + t.elapsedSeconds }));
  const rotate = (v: Vec3, angle: number): Vec3 => ({ x: v.x * Math.cos(angle) + v.z * Math.sin(angle), y: v.y,
    z: -v.x * Math.sin(angle) + v.z * Math.cos(angle) });
  const stateAt = (time: number) => {
    const ground = sampleBaseballGroundMotionAtElapsedSeconds(b, time - initial.elapsedSeconds, p.profile.ground);
    const dx = ground.ball.position.x - b.position.x, dz = ground.ball.position.z - b.position.z;
    const angle = (dx * tangent.x + dz * tangent.z) / radius, radial = rotate({ x: rx, y: 0, z: rz }, angle);
    const speed = ground.ball.velocity.x * tangent.x + ground.ball.velocity.z * tangent.z;
    const velocity = rotate({ x: tangent.x * speed, y: 0, z: tangent.z * speed }, angle);
    return { phase: ground.phase, moment: { originTick: initial.originTick, elapsedSeconds: time,
      ball: { ...ground.ball, tick: quantizeEventTick(initial.originTick, time, tps),
        position: { x: p.fenceCenter.x + radial.x, y: b.position.y, z: p.fenceCenter.z + radial.z }, velocity,
        spin: rotate(ground.ball.spin, angle) } } };
  };
  const knots = new Set<number>([initial.elapsedSeconds, p.throughElapsedSeconds, ...boundaries.map(x => x.elapsedSeconds)]);
  const step = p.profile.air.integrationStepTicks / tps;
  for (let n = 1; initial.elapsedSeconds + n * step < p.throughElapsedSeconds; n++) knots.add(initial.elapsedSeconds + n * step);
  const times = [...knots].sort((a, b) => a - b), samples: SourceFreeBallEvaluation[] = [{ moment: initial,
    phase: sampleBaseballGroundMotionAtElapsedSeconds(b, 0, p.profile.ground).phase, orientation: IDENTITY_QUATERNION }];
  for (let i = 1; i < times.length; i++) {
    const previous = samples[i - 1], next = stateAt(times[i]), a = previous.moment.ball.spin, w = next.moment.ball.spin;
    samples.push({ ...next, orientation: advanceBaseballOrientation(previous.orientation,
      { x: (a.x + w.x) / 2, y: (a.y + w.y) / 2, z: (a.z + w.z) / 2 }, times[i] - times[i - 1]) });
  }
  const norm = (x: Vec3) => Math.hypot(x.x, x.y, x.z);
  const cells: SourceFreeBallKernel['cells'] = samples.slice(0, -1).map((s, i) => ({ fromElapsedSeconds: s.moment.elapsedSeconds,
    throughElapsedSeconds: times[i + 1], maximumPositionSpeedMps: Math.max(norm(s.moment.ball.velocity), norm(samples[i + 1].moment.ball.velocity))
      + p.profile.ground.material.slidingFriction * p.profile.ground.gravityMps2 * (times[i + 1] - times[i]),
    positionRoundingBoundMeters: 256 * Number.EPSILON * Math.max(1, norm(s.moment.ball.position), norm(samples[i + 1].moment.ball.position)) }));
  freeze(samples); freeze(cells); freeze(boundaries);
  const evaluateAt = (time: number): SourceFreeBallEvaluation => {
    if (!Number.isFinite(time) || time < initial.elapsedSeconds || time > p.throughElapsedSeconds) throw new Error('ground wall rolling: finite source horizon exceeded');
    let lo = 0, hi = samples.length - 1;
    while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (times[mid] <= time) lo = mid; else hi = mid - 1; }
    if (times[lo] === time) return samples[lo];
    const a = samples[lo], next = stateAt(time), w = a.moment.ball.spin, z = next.moment.ball.spin;
    return freeze({ ...next, orientation: advanceBaseballOrientation(a.orientation,
      { x: (w.x + z.x) / 2, y: (w.y + z.y) / 2, z: (w.z + z.z) / 2 }, time - times[lo]) });
  };
  return Object.freeze({ kind: 'compliant_ground_wall_arc_source_v1' as const, initial, boundaries, cells, evaluateAt,
    support: Object.freeze({ signedGapMeters: gap, maximumCompressionMeters: p.maximumCompressionMeters,
      representedRadialVelocityMps: radialVelocity, radialVelocityArithmeticBoundMps: 256 * Number.EPSILON * Math.max(1, Math.hypot(b.velocity.x,b.velocity.z)),
      radialCoordinateCorrected: false, radialReactionOwnedByWall: true, groundModel: 'existing_analytic_sliding_rolling_v1' as const }) });
}
