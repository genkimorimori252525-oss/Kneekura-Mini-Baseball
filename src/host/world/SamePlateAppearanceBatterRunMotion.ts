import { samePaBatterRunForeignCoverage } from './SamePlateAppearanceBatterRunCoverage';
import { deriveBattedWorldFieldMotionCheckpoint } from '../../core/sim/ball/BattedWorldFieldMotion';
import { sampleBatterRunnerWorldTimeline } from '../../core/sim/running/BatterRunnerWorldTimeline';
import { sampleRunnerRoute } from '../../core/sim/running/RunnerRoute';
import type { Vec3 } from '../../core/model/geometry';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldActionResult } from './SamePlateAppearancePhysicalFieldAction';
import type { DurableBatterRunPlan } from './SqliteBatterRunPlanStore';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalTimelineAtField } from './SamePlateAppearancePhysicalFieldCalculation';
import { samePaPhysicalHasThrowRelease } from './SamePlateAppearancePhysicalFieldThrow';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('physical batter-run original binding differs'); };
const close = (a: number, b: number) => Number.isFinite(a) && Number.isFinite(b)
  && Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 32;
const axes = ['x', 'y', 'z'] as const;
const vector = (f: (axis: keyof Vec3) => number): Vec3 => ({ x: f('x'), y: f('y'), z: f('z') });
const fieldRef = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
/** Adopt one existing analytic runner piece into the actual five-part world.
 * This supported binding translates an unchanged pose; recovery rotation and
 * articulated foot motion require their own original physical evidence. */
export const deriveSamePaBatterRunMotion = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, plan: DurableBatterRunPlan, prefix: readonly Field[]) => {
  const request = source.action, motion = previous.field.motion, moment = motion.world.moment;
  if (request?.kind !== 'batter_run_motion_v1' || !motion.cursor || source.throughTick <= previous.evaluationTick
    || plan.plan.physicalBinding !== 'owned_static_pose_straight_motion') throw new Error('physical batter-run requires a supported resolved moving cut');
  same(request.planReference, reference('world_batter_run_plans', plan)); same(plan.lineage, root.lineage);
  if (plan.source.physicalPitchReference.sourceId !== root.physicalPitchSourceId || root.physicalPitchSourceId !== previous.physicalPitchSourceId
    || !prefix.some(f => json(fieldRef(f)) === json(plan.exitState.source.fieldReference))) throw new Error('physical batter-run original exit is outside the prefix');
  const timeline = plan.plan.timeline, p = timeline.runnerMotionParameters, tick = moment.ball.tick;
  if (!Number.isSafeInteger(tick) || tick !== previous.evaluationTick || (tick - moment.originTick) / p.ticksPerSecond !== moment.elapsedSeconds
    || root.response.world.parameters.ticksPerSecond !== p.ticksPerSecond) throw new Error('physical batter-run requires an exact owned clock cut');
  const prior = prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_run_motion_v1'
    && json(f.actionResult.planReference) === json(request.planReference));
  if (!prior && tick !== timeline.startTick) throw new Error('physical batter-run cannot treat an unexecuted plan as prior motion');
  const expected = sampleBatterRunnerWorldTimeline(timeline, tick).world, elapsed = (tick - timeline.launchState.tick) / p.ticksPerSecond;
  const index = timeline.postLaunchTrajectory.segments.findIndex(s => elapsed >= s.startElapsedSeconds && elapsed < s.endElapsedSeconds);
  if (index < 0) throw new Error('physical batter-run analytic segment exhausted');
  const segment = timeline.postLaunchTrajectory.segments[index], body = plan.exitState.body;
  if (body.playerId !== plan.playerId || body.personId !== plan.personId) throw new Error('physical batter-run original body identity differs');
  const actors = motion.actors.filter(a => a.playerId === plan.playerId), shape = body.primitives.find(s => s.role === 'body');
  if (actors.length !== 5 || new Set(actors.map(a => a.primitive.role)).size !== 5 || body.primitives.length !== 5 || !shape)
    throw new Error('physical batter-run original five-part body missing');
  const sample = (a: typeof actors[number]) => {
    const s = a.primitive, dt = (tick - s.startTick) / p.ticksPerSecond - (a.startElapsedSeconds ?? 0);
    if (dt < 0 || tick > s.endTick || s.ticksPerSecond !== p.ticksPerSecond) throw new Error('physical batter-run body curve is exhausted');
    return { position: vector(k => s.startCenter[k] + s.startVelocity[k] * dt + 0.5 * s.acceleration[k] * dt * dt),
      velocity: vector(k => s.startVelocity[k] + s.acceleration[k] * dt), acceleration: s.acceleration };
  };
  const b = sample(actors.find(a => a.primitive.role === 'body')!), position = vector(k => b.position[k] - shape.offset[k]);
  if (!close(position.x, expected.position.x) || !close(position.z, expected.position.z) || !close(position.y, plan.exitState.root.position.y)
    || !close(b.velocity.x, expected.velocity.x) || !close(b.velocity.z, expected.velocity.z) || b.velocity.y !== 0 || b.acceleration.y !== 0)
    throw new Error('physical batter-run plan does not match the executed body');
  for (const a of actors) {
    const s = body.primitives.find(s => s.role === a.primitive.role), state = sample(a);
    if (!s || s.radius !== a.primitive.radius || axes.some(k => !close(state.position[k], position[k] + s.offset[k])
      || !close(state.velocity[k], b.velocity[k]) || state.acceleration[k] !== b.acceleration[k])) throw new Error('physical batter-run retained part pose differs');
  }
  const foreignCoverage = samePaBatterRunForeignCoverage(root, previous, prefix, plan.playerId, request.stationaryHoldContinuations);
  const coverageThroughTick = Math.min(foreignCoverage, timeline.endTick,
    Math.floor(timeline.launchState.tick + segment.endElapsedSeconds * p.ticksPerSecond));
  if (source.throughTick > coverageThroughTick) throw new Error('physical batter-run exceeds its original analytic coverage');
  const tangent = sampleRunnerRoute(timeline.route, segment.startRouteDistanceMeters).tangent;
  const acceleration = { x: tangent.x * segment.accelerationMps2, y: 0, z: tangent.z * segment.accelerationMps2 };
  const commands = motion.actors.map(a => ({ playerId: a.playerId, role: a.primitive.role,
    acceleration: a.playerId === plan.playerId ? acceleration : a.primitive.acceleration }));
  const field = deriveBattedWorldFieldMotionCheckpoint({ response: root.response, geometry: root.geometry, actors: motion.actors, cursor: motion.cursor,
    carrierPlayerId: motion.carrierPlayerId, availableAtTick: tick, coverageThroughTick, checkpointThroughTick: source.throughTick, commands });
  const actionResult: SamePaPhysicalFieldActionResult = { kind: request.kind, planReference: request.planReference, playerId: plan.playerId,
    controllerSegmentIndex: index, coverageThroughTick, planThroughTick: timeline.endTick };
  return freeze({ field, evaluationTick: field.motion.world.moment.ball.tick,
    timeline: samePaPhysicalHasThrowRelease(prefix) ? previous.timeline : samePaPhysicalTimelineAtField(previous.timeline, field, root.response, root.geometry), actionResult });
};
