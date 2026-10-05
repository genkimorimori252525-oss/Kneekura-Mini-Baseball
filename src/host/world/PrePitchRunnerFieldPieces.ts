import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BallWorldMotionActor } from '../../core/sim/ball/BallWorldContinuation';
import { composeDefenderPhysicalPrimitiveSegment, type DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';
import type { CanonicalRunnerKinematics, RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { sampleRunnerRoute } from '../../core/sim/running/RunnerRoute';
import { buildPrePitchRunnerController, type AcceptedPrePitchRunnerExecution } from './PrePitchRunnerExecution';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

export type PrePitchRunnerFieldPiecesInput = Readonly<{
  source: AcceptedPrePitchRunnerExecution; canonical: CanonicalRunnerKinematics; controller: RouteFollowingController;
  shapes: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole; radius: number; offset: Vec3 }>[];
  bodyOriginHeightMeters: number; originTick: number; startElapsedSeconds: number; throughElapsedSeconds: number;
}>;
export type PrePitchRunnerFieldPiece = Readonly<{ controllerSegmentIndex: number; startElapsedSeconds: number;
  coverageThroughElapsedSeconds: number; actors: readonly BallWorldMotionActor[] }>;
const vector = (f: (axis: keyof Vec3) => number): Vec3 => {
  const value = { x: f('x'), y: f('y'), z: f('z') };
  if (!Object.values(value).every(Number.isFinite)) throw new Error('retained runner piece arithmetic overflow');
  return value;
};

/** Exact analytic projection of the original controller, with no revision or coverage renewal. */
export const prePitchRunnerFieldPieces = (raw: PrePitchRunnerFieldPiecesInput): readonly PrePitchRunnerFieldPiece[] => {
  const input = cloneInert(raw), { source, canonical, controller, shapes, originTick, startElapsedSeconds, throughElapsedSeconds } = input;
  if (Object.keys(input).sort().join('|') !== ['source', 'canonical', 'controller', 'shapes', 'bodyOriginHeightMeters', 'originTick',
    'startElapsedSeconds', 'throughElapsedSeconds'].sort().join('|')
    || json(buildPrePitchRunnerController(source, canonical)) !== json(controller)
    || !Number.isSafeInteger(originTick) || originTick < canonical.tick
    || !Number.isFinite(startElapsedSeconds) || startElapsedSeconds < 0 || !Number.isFinite(throughElapsedSeconds)
    || throughElapsedSeconds <= startElapsedSeconds || throughElapsedSeconds > (source.coverageThroughTick - originTick) / source.parameters.ticksPerSecond
    || input.bodyOriginHeightMeters !== source.bodyPose.bodyOriginHeightMeters || !Array.isArray(shapes) || shapes.length !== 5
    || new Set(shapes.map(shape => shape.role)).size !== 5) throw new Error('retained runner original controller, clock or coverage differs');
  for (const shape of shapes) {
    const pose = source.bodyPose.primitiveMotions.find(part => part.role === shape.role);
    if (!pose || !(['x', 'y', 'z'] as const).every(axis => shape.offset[axis] === pose.startOffset[axis])) {
      throw new Error('retained runner original primitive pose differs');
    }
  }
  const ticksPerSecond = source.parameters.ticksPerSecond, worldOffset = (originTick - canonical.tick) / ticksPerSecond;
  const pieces: PrePitchRunnerFieldPiece[] = [];
  for (const [controllerSegmentIndex, segment] of controller.trajectory.segments.entries()) {
    const start = Math.max(startElapsedSeconds, segment.startElapsedSeconds - worldOffset);
    const end = Math.min(throughElapsedSeconds, segment.endElapsedSeconds - worldOffset);
    if (end <= start) continue;
    const elapsed = worldOffset + start, dt = elapsed - segment.startElapsedSeconds;
    const distance = segment.startRouteDistanceMeters + segment.startSpeedMps * dt + 0.5 * segment.accelerationMps2 * dt * dt;
    const route = sampleRunnerRoute(source.route, distance), speed = segment.startSpeedMps + segment.accelerationMps2 * dt;
    // Integer curve storage must cover the complete exact interval, including
    // a phase end just beyond an integer tick. Only the explicit bound executes.
    const enclosingTick = originTick + Math.ceil(end * ticksPerSecond);
    const endTick = end <= (enclosingTick - 1 - originTick) / ticksPerSecond ? enclosingTick - 1 : enclosingTick;
    const body = { startTick: originTick, endTick, ticksPerSecond,
      startPosition: { x: route.position.x, y: input.bodyOriginHeightMeters, z: route.position.z },
      startVelocity: { x: route.tangent.x * speed, y: 0, z: route.tangent.z * speed },
      acceleration: { x: route.tangent.x * segment.accelerationMps2, y: 0, z: route.tangent.z * segment.accelerationMps2 } };
    const actors = shapes.map(shape => {
      const pose = source.bodyPose.primitiveMotions.find(part => part.role === shape.role)!;
      return { playerId: source.playerId, startElapsedSeconds: start, primitive: composeDefenderPhysicalPrimitiveSegment(body, {
        role: shape.role, radius: shape.radius, startTick: originTick, endTick, ticksPerSecond,
        startOffset: vector(axis => pose.startOffset[axis] + pose.offsetVelocity[axis] * elapsed + 0.5 * pose.offsetAcceleration[axis] * elapsed * elapsed),
        offsetVelocity: vector(axis => pose.offsetVelocity[axis] + pose.offsetAcceleration[axis] * elapsed), offsetAcceleration: pose.offsetAcceleration }) };
    });
    if (start !== (pieces.at(-1)?.coverageThroughElapsedSeconds ?? startElapsedSeconds)) throw new Error('retained runner analytic coverage has a gap');
    pieces.push({ controllerSegmentIndex, startElapsedSeconds: start, coverageThroughElapsedSeconds: end, actors });
  }
  if (!pieces.length || pieces.at(-1)!.coverageThroughElapsedSeconds !== throughElapsedSeconds) throw new Error('retained runner analytic coverage is exhausted');
  return freeze(pieces);
};
