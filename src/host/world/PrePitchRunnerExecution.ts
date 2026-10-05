import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import { buildRouteFollowingController, sampleRouteFollowingController, type CanonicalRunnerKinematics,
  type RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import type { RunnerMotionIntent, RunnerMotionParameters, RunnerMotionState } from '../../core/sim/running/RunnerMotion';
import { getRunnerRouteLength, sampleRunnerRoute, type RunnerRoute } from '../../core/sim/running/RunnerRoute';
import { composeDefenderPhysicalPrimitiveSegment, type DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import type { BattedWorldActorPrimitive } from '../../core/sim/ball/BattedBallWorldContacts';
export { prePitchRunnerFieldPieces } from './PrePitchRunnerFieldPieces';

/** Accepted before pitch consumption. Positions/velocities of the root are never caller inputs. */
export type AcceptedPrePitchRunnerExecution = Readonly<{
  kind: 'pre_pitch_upright_runner_v1'; sourceId: string; sourceVersion: string; gameId: string;
  physicalActorSourceId: string; playerId: string; motionRevision: number;
  route: RunnerRoute; startMotion: RunnerMotionState; intent: RunnerMotionIntent; parameters: RunnerMotionParameters;
  coverageThroughTick: number;
  bodyPose: Readonly<{ bodyOriginHeightMeters: number; primitiveMotions: readonly Readonly<{
    role: DefenderPhysicalPrimitiveRole; startOffset: Vec3; offsetVelocity: Vec3; offsetAcceleration: Vec3;
  }>[] }>;
}>;
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v === v.trim();
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const fields = (v: unknown, names: readonly string[]): boolean => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).sort().join('|') === [...names].sort().join('|');
const vector = (v: Vec3): boolean => fields(v, ['x', 'y', 'z']) && [v.x, v.y, v.z].every(finite);
const vector2 = (v: { x: number; z: number }): boolean => fields(v, ['x', 'z']) && [v.x, v.z].every(finite);
const vec = (f: (axis: keyof Vec3) => number): Vec3 => {
  const v = { x: f('x'), y: f('y'), z: f('z') };
  if (!vector(v)) throw new Error('pre-pitch runner arithmetic overflow');
  return v;
};
export const prePitchRunnerExecutionInput = (raw: AcceptedPrePitchRunnerExecution): AcceptedPrePitchRunnerExecution => {
  const s = cloneInert(raw);
  if (!fields(s, ['kind', 'sourceId', 'sourceVersion', 'gameId', 'physicalActorSourceId', 'playerId', 'motionRevision', 'route',
    'startMotion', 'intent', 'parameters', 'coverageThroughTick', 'bodyPose']) || s.kind !== 'pre_pitch_upright_runner_v1'
    || ![s.sourceId, s.sourceVersion, s.gameId, s.physicalActorSourceId, s.playerId].every(id) || !integer(s.motionRevision)
    || !integer(s.coverageThroughTick) || !fields(s.route, ['segments']) || !Array.isArray(s.route.segments) || s.route.segments.length !== 1
    || s.route.segments.some(r => r.kind !== 'line' || !fields(r, ['kind', 'start', 'end']) || !vector2(r.start) || !vector2(r.end))
    || !fields(s.startMotion, ['tick', 'routeDistanceMeters', 'speedMps', 'driveDirection', 'bodyMode']) || s.startMotion.bodyMode !== 'upright'
    || !fields(s.intent, ['kind', 'issuedTick']) || !['advance', 'retreat', 'hold'].includes(s.intent.kind)
    || !integer(s.intent.issuedTick) || s.intent.issuedTick > s.startMotion.tick
    || !fields(s.parameters, ['ticksPerSecond', 'reactionDelayTicks', 'accelerationMps2', 'brakingMps2', 'slideDecelerationMps2', 'topSpeedMps'])
    || s.parameters.ticksPerSecond !== 1_000_000
    || !fields(s.bodyPose, ['bodyOriginHeightMeters', 'primitiveMotions']) || !finite(s.bodyPose.bodyOriginHeightMeters) || s.bodyPose.bodyOriginHeightMeters < 0
    || !Array.isArray(s.bodyPose.primitiveMotions) || s.bodyPose.primitiveMotions.length !== 5
    || new Set(s.bodyPose.primitiveMotions.map(p => p?.role)).size !== 5
    || s.bodyPose.primitiveMotions.some(p => !fields(p, ['role', 'startOffset', 'offsetVelocity', 'offsetAcceleration'])
      || !roles.includes(p.role) || !vector(p.startOffset) || !vector(p.offsetVelocity) || !vector(p.offsetAcceleration))) {
    throw new Error('invalid or unsupported pre-pitch runner execution Source');
  }
  return s;
};

/** Reuses the established route-following authority and its reaction/braking/speed segmentation. */
export const buildPrePitchRunnerController = (raw: AcceptedPrePitchRunnerExecution, canonical: CanonicalRunnerKinematics): RouteFollowingController => {
  const s = prePitchRunnerExecutionInput(raw);
  if (s.playerId !== canonical.playerId || s.motionRevision !== canonical.motionRevision || canonical.bodyMode !== 'upright'
    || s.coverageThroughTick <= canonical.tick) throw new Error('pre-pitch runner canonical scope or coverage differs');
  const controller = buildRouteFollowingController({ canonical, startMotion: s.startMotion, route: s.route,
    intent: s.intent, parameters: s.parameters, endTick: s.coverageThroughTick });
  const original = sampleRouteFollowingController(controller, canonical, canonical.tick);
  if (original.position.x !== canonical.position.x || original.position.z !== canonical.position.z
    || original.velocity.x !== canonical.velocity.x || original.velocity.z !== canonical.velocity.z) throw new Error('pre-pitch runner exact canonical basis differs');
  const length = getRunnerRouteLength(s.route);
  for (const segment of controller.trajectory.segments) {
    const duration = segment.endElapsedSeconds - segment.startElapsedSeconds;
    const times = [0, duration];
    if (segment.accelerationMps2 !== 0) {
      const extremum = -segment.startSpeedMps / segment.accelerationMps2;
      if (extremum > 0 && extremum < duration) times.push(extremum);
    }
    if (segment.bodyMode !== 'upright' || times.some(t => {
      const d = segment.startRouteDistanceMeters + segment.startSpeedMps * t + 0.5 * segment.accelerationMps2 * t * t;
      return !finite(d) || d < 0 || d > length;
    })) throw new Error('pre-pitch runner route exhaustion or body transition is unsupported');
  }
  return controller;
};

/** Only a single analytic contact interval is emitted; any later controller boundary needs a new physical producer. */
export const prePitchRunnerContactPrimitives = (source: AcceptedPrePitchRunnerExecution, canonical: CanonicalRunnerKinematics,
  controller: RouteFollowingController, shapes: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole; radius: number; offset: Vec3 }>[],
  bodyOriginHeightMeters: number, contactTick: number, throughTick: number, ticksPerSecond: number): readonly BattedWorldActorPrimitive[] => {
  if (!integer(contactTick) || !integer(throughTick) || contactTick < canonical.tick || throughTick < contactTick
    || throughTick > source.coverageThroughTick || ticksPerSecond !== source.parameters.ticksPerSecond
    || bodyOriginHeightMeters !== source.bodyPose.bodyOriginHeightMeters || shapes.length !== 5
    || new Set(shapes.map(p => p.role)).size !== 5) throw new Error('pre-pitch runner contact coverage, clock or model differs');
  const elapsed = (contactTick - canonical.tick) / ticksPerSecond, end = (throughTick - canonical.tick) / ticksPerSecond;
  const segment = [...controller.trajectory.segments].reverse().find(s => s.startElapsedSeconds <= elapsed && elapsed <= s.endElapsedSeconds);
  if (!segment || segment.bodyMode !== 'upright' || end > segment.endElapsedSeconds) throw new Error('pre-pitch runner contact crosses an analytic boundary');
  const root = sampleRouteFollowingController(controller, canonical, contactTick);
  const tangent = sampleRunnerRoute(source.route, source.startMotion.routeDistanceMeters).tangent;
  const body = { startTick: contactTick, endTick: throughTick, ticksPerSecond,
    startPosition: { x: root.position.x, y: bodyOriginHeightMeters, z: root.position.z },
    startVelocity: { x: root.velocity.x, y: 0, z: root.velocity.z },
    acceleration: { x: tangent.x * segment.accelerationMps2, y: 0, z: tangent.z * segment.accelerationMps2 } };
  return shapes.map(p => {
    const motion = source.bodyPose.primitiveMotions.find(m => m.role === p.role);
    if (!motion || !(['x', 'y', 'z'] as const).every(axis => p.offset[axis] === motion.startOffset[axis])) throw new Error('pre-pitch runner original primitive pose differs');
    return { playerId: source.playerId, primitive: composeDefenderPhysicalPrimitiveSegment(body, {
      role: p.role, radius: p.radius, startTick: contactTick, endTick: throughTick, ticksPerSecond,
      startOffset: vec(axis => motion.startOffset[axis] + motion.offsetVelocity[axis] * elapsed + 0.5 * motion.offsetAcceleration[axis] * elapsed * elapsed),
      offsetVelocity: vec(axis => motion.offsetVelocity[axis] + motion.offsetAcceleration[axis] * elapsed), offsetAcceleration: motion.offsetAcceleration }) };
  });
};
