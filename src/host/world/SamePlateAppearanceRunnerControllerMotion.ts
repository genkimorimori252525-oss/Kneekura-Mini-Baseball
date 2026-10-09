import { samePaBatterRunForeignCoverage } from './SamePlateAppearanceBatterRunCoverage';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { sampleRouteFollowingController, type RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import type { RunnerMotionParameters } from '../../core/sim/running/RunnerMotion';
import { getRunnerRouteLength, sampleRunnerRoute } from '../../core/sim/running/RunnerRoute';
import type { Vec3 } from '../../core/model/geometry';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { DurableBatterSwingExitState } from './SqliteBatterSwingExitStateStore';
import { samePaPhysicalTimelineAtField } from './SamePlateAppearancePhysicalFieldCalculation';
import { samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
export type SamePaRunnerControllerMotionInput = Readonly<{
  root: SamePaPhysicalFieldRoot;
  previous: Field;
  prefix: readonly Field[];
  throughTick: number;
  controller: RouteFollowingController;
  runnerMotionParameters: RunnerMotionParameters;
  body: DurableBatterSwingExitState['body'];
  rootHeightMeters: number;
  stationaryHoldContinuations?: Parameters<typeof samePaBatterRunForeignCoverage>[4];
}>;
const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
const axes = ['x', 'y', 'z'] as const;
const vector = (f: (axis: keyof Vec3) => number): Vec3 => ({ x: f('x'), y: f('y'), z: f('z') });

/** Execute one piece of an accepted controller in the actual five-part world.
 * The caller owns acceptance and controller lineage. This binding translates
 * an unchanged pose along one finite line; it never supplies body rotation. */
export const deriveSamePaRunnerControllerMotion = (input: SamePaRunnerControllerMotionInput) => {
  const { root, previous, prefix, throughTick, controller, runnerMotionParameters: p, body, rootHeightMeters } = input;
  const motion = previous.field.motion, moment = motion.world.moment, tick = moment.ball.tick;
  if (!motion.cursor || throughTick <= previous.evaluationTick || root.physicalPitchSourceId !== previous.physicalPitchSourceId)
    throw new Error('physical batter-run requires a supported resolved moving cut');
  const trajectory = controller.trajectory, playerId = controller.basis.playerId;
  if (!Number.isSafeInteger(tick) || tick !== previous.evaluationTick || (tick - moment.originTick) / p.ticksPerSecond !== moment.elapsedSeconds
    || root.response.world.parameters.ticksPerSecond !== p.ticksPerSecond || trajectory.ticksPerSecond !== p.ticksPerSecond
    || controller.basis.tick !== trajectory.startTick) throw new Error('physical batter-run requires an exact owned clock cut');
  if (controller.kind !== 'route_following' || body.playerId !== playerId)
    throw new Error('physical batter-run original body identity differs');
  if (controller.route.segments.length !== 1 || controller.route.segments[0].kind !== 'line')
    throw new Error('physical batter-run requires an original straight route');
  const length = getRunnerRouteLength(controller.route);
  for (const segment of trajectory.segments) {
    const duration = segment.endElapsedSeconds - segment.startElapsedSeconds;
    const end = segment.startRouteDistanceMeters + segment.startSpeedMps * duration + 0.5 * segment.accelerationMps2 * duration * duration;
    if (!Number.isFinite(length) || !Number.isFinite(end) || segment.bodyMode !== 'upright'
      || segment.startRouteDistanceMeters < 0 || segment.startRouteDistanceMeters > length || end < 0 || end > length)
      throw new Error('physical batter-run finite upright route coverage exhausted');
  }
  const expected = sampleRouteFollowingController(controller, { ...controller.basis, bodyMode: 'upright' }, tick);
  const elapsed = (tick - trajectory.startTick) / p.ticksPerSecond;
  const index = trajectory.segments.findIndex(s => elapsed >= s.startElapsedSeconds && elapsed < s.endElapsedSeconds);
  if (index < 0) throw new Error('physical batter-run analytic segment exhausted');
  const segment = trajectory.segments[index];
  const actors = motion.actors.filter(a => a.playerId === playerId), shape = body.primitives.find(s => s.role === 'body');
  if (actors.length !== 5 || new Set(actors.map(a => a.primitive.role)).size !== 5 || body.primitives.length !== 5 || !shape)
    throw new Error('physical batter-run original five-part body missing');
  const sample = (a: typeof actors[number]) => {
    const s = a.primitive, dt = (tick - s.startTick) / p.ticksPerSecond - (a.startElapsedSeconds ?? 0);
    if (dt < 0 || tick > s.endTick || s.ticksPerSecond !== p.ticksPerSecond) throw new Error('physical batter-run body curve is exhausted');
    return { position: vector(k => s.startCenter[k] + s.startVelocity[k] * dt + 0.5 * s.acceleration[k] * dt * dt),
      velocity: vector(k => s.startVelocity[k] + s.acceleration[k] * dt), acceleration: s.acceleration };
  };
  const b = sample(actors.find(a => a.primitive.role === 'body')!), position = vector(k => b.position[k] - shape.offset[k]);
  if (!close(position.x, expected.position.x) || !close(position.z, expected.position.z) || !close(position.y, rootHeightMeters)
    || !close(b.velocity.x, expected.velocity.x) || !close(b.velocity.z, expected.velocity.z) || b.velocity.y !== 0 || b.acceleration.y !== 0)
    throw new Error('physical batter-run plan does not match the executed body');
  for (const a of actors) {
    const s = body.primitives.find(s => s.role === a.primitive.role), state = sample(a);
    if (!s || s.radius !== a.primitive.radius || axes.some(k => !close(state.position[k], position[k] + s.offset[k])
      || !close(state.velocity[k], b.velocity[k]) || state.acceleration[k] !== b.acceleration[k])) throw new Error('physical batter-run retained part pose differs');
  }
  const foreignCoverage = samePaBatterRunForeignCoverage(root, previous, prefix, playerId, input.stationaryHoldContinuations);
  const planThroughTick = trajectory.endState.tick;
  const coverageThroughTick = Math.min(foreignCoverage, planThroughTick,
    Math.floor(trajectory.startTick + segment.endElapsedSeconds * p.ticksPerSecond));
  if (throughTick > coverageThroughTick) throw new Error('physical batter-run exceeds its original analytic coverage');
  const tangent = sampleRunnerRoute(controller.route, segment.startRouteDistanceMeters).tangent;
  const acceleration = { x: tangent.x * segment.accelerationMps2, y: 0, z: tangent.z * segment.accelerationMps2 };
  const commands = motion.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role,
    acceleration: a.playerId === playerId ? acceleration : a.primitive.acceleration }));
  const field = deriveBattedWorldFieldMotionCheckpoint({ response: root.response, geometry: root.geometry, actors: motion.actors, cursor: motion.cursor,
    carrierPlayerId: motion.carrierPlayerId, availableAtTick: tick, coverageThroughTick, checkpointThroughTick: throughTick, commands });
  return freeze({ field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: samePaPhysicalHasThrowRelease(prefix) ? previous.timeline : samePaPhysicalTimelineAtField(previous.timeline, field, root.response, root.geometry),
    controllerSegmentIndex: index, coverageThroughTick, planThroughTick });
};
