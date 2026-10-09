import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { samePaExactRunnerControllerPieces, type SamePaExactRunnerControllerPiece } from './SamePlateAppearanceExactRunnerControllerPiece';
import { samePaBatterRunForeignCoverage } from './SamePlateAppearanceBatterRunCoverage';
import { deriveBattedWorldFieldMotionCheckpoint, deriveBattedWorldFieldMotionExactCheckpointV1 } from '../../core/sim/ball/BattedWorldFieldMotion';
import { sampleRouteFollowingController, type RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { sampleRunnerMotionTrajectoryExact, type RunnerMotionParameters, type ExactRunnerMotionTrajectory } from '../../core/sim/running/RunnerMotion';
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
  exactTrajectory?: ExactRunnerMotionTrajectory;
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
  if (!motion.cursor || throughTick < previous.evaluationTick || root.physicalPitchSourceId !== previous.physicalPitchSourceId)
    throw new Error('physical batter-run requires a supported resolved moving cut');
  const trajectory = input.exactTrajectory ?? controller.trajectory, playerId = controller.basis.playerId;
  if (!Number.isSafeInteger(tick) || tick !== previous.evaluationTick || quantizeEventTick(moment.originTick,moment.elapsedSeconds,p.ticksPerSecond) !== tick
    || root.response.world.parameters.ticksPerSecond !== p.ticksPerSecond || trajectory.ticksPerSecond !== p.ticksPerSecond
    || controller.basis.tick !== controller.trajectory.startTick) throw new Error('physical batter-run requires an exact owned clock cut');
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
  const origin=input.exactTrajectory?.origin;
  if(origin&&(origin.originTick!==moment.originTick||origin.tick!==controller.basis.tick
    ||trajectory.endState.tick!==controller.trajectory.endState.tick
    ||quantizeEventTick(origin.originTick,origin.elapsedSeconds,p.ticksPerSecond)!==origin.tick))throw new Error('runner exact controller origin differs');
  const offset = origin?.elapsedSeconds ?? (controller.trajectory.startTick-moment.originTick)/p.ticksPerSecond;
  const integerCut = (tick-moment.originTick)/p.ticksPerSecond === moment.elapsedSeconds;
  const elapsed=(tick-controller.trajectory.startTick)/p.ticksPerSecond;
  const index = integerCut&&!origin
    ? trajectory.segments.findIndex(s=>elapsed>=s.startElapsedSeconds&&elapsed<s.endElapsedSeconds)
    : trajectory.segments.findIndex(s => moment.elapsedSeconds >= offset+s.startElapsedSeconds && moment.elapsedSeconds < offset+s.endElapsedSeconds);
  if (index < 0) throw new Error('physical batter-run analytic segment exhausted');
  const segment = trajectory.segments[index];
  // Revalidate the original controller at its exact admitted basis before sampling
  // the same analytic law inside a fractional physical piece.
  sampleRouteFollowingController(controller, { ...controller.basis, bodyMode: 'upright' }, controller.basis.tick);
  const expected = integerCut&&!origin ? sampleRouteFollowingController(controller, { ...controller.basis, bodyMode: 'upright' }, tick) : (()=>{
    const state=sampleRunnerMotionTrajectoryExact(trajectory,moment.elapsedSeconds-offset);
    const route=sampleRunnerRoute(controller.route,state.routeDistanceMeters);
    return {position:route.position,velocity:{x:route.tangent.x*state.speedMps,z:route.tangent.z*state.speedMps}};
  })();
  const actors = motion.actors.filter(a => a.playerId === playerId), shape = body.primitives.find(s => s.role === 'body');
  if (actors.length !== 5 || new Set(actors.map(a => a.primitive.role)).size !== 5 || body.primitives.length !== 5 || !shape)
    throw new Error('physical batter-run original five-part body missing');
  const sample = (a: typeof actors[number]) => {
    const s = a.primitive, dt = (moment.originTick-s.startTick)/p.ticksPerSecond+moment.elapsedSeconds-(a.startElapsedSeconds ?? 0);
    if (dt < 0 || moment.elapsedSeconds > (s.endTick-moment.originTick)/p.ticksPerSecond || s.ticksPerSecond !== p.ticksPerSecond) throw new Error('physical batter-run body curve is exhausted');
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
  const foreignExact = samePaExactRunnerControllerPieces(prefix).filter(w=>w.playerId!==playerId).map(w=>w.piece.coverageThroughElapsedSeconds);
  const foreignEnd = Math.min(...foreignExact,(foreignCoverage-moment.originTick)/p.ticksPerSecond);
  const ownEnd = Math.min((planThroughTick-moment.originTick)/p.ticksPerSecond, offset+segment.endElapsedSeconds);
  const requested=(throughTick-moment.originTick)/p.ticksPerSecond;
  // Independent owners can renew at a shared knot without executing beyond the
  // still-due foreign piece. Only this player's future command is replaced.
  const sameCut = requested===moment.elapsedSeconds || foreignEnd===moment.elapsedSeconds && foreignExact.includes(moment.elapsedSeconds);
  const exactEnd = sameCut ? ownEnd : Math.min(foreignEnd,ownEnd);
  const legacyCoverage = Math.min(foreignCoverage, planThroughTick,
    Math.floor(controller.trajectory.startTick+segment.endElapsedSeconds*p.ticksPerSecond));
  const exact = sameCut || origin!==undefined || !integerCut || foreignExact.some(t=>t<(legacyCoverage-moment.originTick)/p.ticksPerSecond)
    || throughTick > legacyCoverage && exactEnd !== (legacyCoverage-moment.originTick)/p.ticksPerSecond;
  const coverageThroughTick = exact ? moment.originTick+Math.ceil(exactEnd*p.ticksPerSecond) : legacyCoverage;
  if (throughTick > coverageThroughTick || exactEnd <= moment.elapsedSeconds || foreignEnd < moment.elapsedSeconds
    || requested < moment.elapsedSeconds)
    throw new Error('physical batter-run exceeds its original analytic coverage');
  const tangent = sampleRunnerRoute(controller.route, segment.startRouteDistanceMeters).tangent;
  const acceleration = { x: tangent.x * segment.accelerationMps2, y: 0, z: tangent.z * segment.accelerationMps2 };
  const commands = motion.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role,
    acceleration: a.playerId === playerId ? acceleration : a.primitive.acceleration }));
  const basis = { response: root.response, geometry: root.geometry, actors: motion.actors, cursor: motion.cursor,
    carrierPlayerId: motion.carrierPlayerId, availableAtTick: exact ? controller.basis.tick : tick, coverageThroughTick, commands };
  const derived = exact ? deriveBattedWorldFieldMotionExactCheckpointV1({ ...basis,
    ...(origin ? {availableAtElapsedSeconds:origin.elapsedSeconds} : {}), checkpointThroughElapsedSeconds: sameCut ? moment.elapsedSeconds : Math.min(requested,exactEnd) })
    : deriveBattedWorldFieldMotionCheckpoint({ ...basis, checkpointThroughTick: throughTick });
  const field = sameCut ? { ...derived, motion:{...derived.motion,actors:derived.motion.actors.map(a=>a.playerId===playerId?a:
    motion.actors.find(old=>old.playerId===a.playerId&&old.primitive.role===a.primitive.role)!)} } : derived;
  const exactControllerPiece: SamePaExactRunnerControllerPiece | undefined = exact ? {
    kind: 'same_pa_exact_runner_controller_piece_v1', originTick: moment.originTick,
    startedAtElapsedSeconds: moment.elapsedSeconds, coverageThroughElapsedSeconds: exactEnd } : undefined;
  return freeze({ field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: samePaPhysicalHasThrowRelease(prefix) ? previous.timeline : samePaPhysicalTimelineAtField(previous.timeline, field, root.response, root.geometry),
    controllerSegmentIndex: index, coverageThroughTick, planThroughTick,
    ...(exactControllerPiece === undefined ? {} : { exactControllerPiece }) });
};
