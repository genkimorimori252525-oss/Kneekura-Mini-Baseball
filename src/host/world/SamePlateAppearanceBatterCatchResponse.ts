import type { DatabaseSync } from 'node:sqlite';
import { buildRouteFollowingController, createCanonicalRunnerKinematicsFromRouteMotion, type RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import { sampleRunnerMotionTrajectory, type RunnerMotionParameters } from '../../core/sim/running/RunnerMotion';
import { getRunnerRouteLength, type RunnerRoute } from '../../core/sim/running/RunnerRoute';
import { samplePiecewiseFieldActor } from '../../core/sim/ball/BattedWorldPiecewiseFieldMotion';
import { prepareBatterCatchHoldPlan } from './BatterRunPlan';
import { readBatterRunPlanFromSqlite } from './SqliteBatterRunPlanStore';
import { batterSwingExitStateEvidenceFromSqlite, type DurableBatterSwingExitState } from './SqliteBatterSwingExitStateStore';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { samePaCatchCommunicationObservationAt } from './SamePlateAppearanceCatchCommunication';
import { samePaCaughtOutReception } from './SamePlateAppearanceCatchOperativeRuling';
import { readSamePaLifecycleRecordFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaPhysicalOperationFromSqlite } from './SamePlateAppearancePhysicalEpisodeFromSqlite';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaDispatchMemberValid } from './SamePlateAppearanceDispatchRoles';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaBatterRunForeignCoverage } from './SamePlateAppearanceBatterRunCoverage';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
export type SamePaBatterCatchMotionBasis =
  | Readonly<{ kind: 'runner_plan'; planReference: SamePaReference<'world_batter_run_plans'> }>
  | Readonly<{ kind: 'swing_exit'; exitStateReference: SamePaReference<'world_batter_swing_exit_states'>; route: RunnerRoute }>;
export type SamePaBatterCatchResponseRequest = Readonly<{ kind: 'batter_catch_response_v1'; member: SamePaDispatchMember;
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>; motionBasis: SamePaBatterCatchMotionBasis;
  intent: Readonly<{ kind: 'hold'; issuedTick: number }>; endTick: number;
  provenance: Readonly<{ sourceRecordId: string; sourceVersion: string }> }>;
export type SamePaBatterCatchResponse = Readonly<{ kind: 'batter_catch_response_v1'; playerId: string; personId: string;
  catchWorkReference: SamePaReference<'pa_catch_v1_work'>; callSourceId: string;
  reception: NonNullable<ReturnType<typeof samePaCaughtOutReception>>; motionBasis: SamePaBatterCatchMotionBasis;
  intent: SamePaBatterCatchResponseRequest['intent']; controller: RouteFollowingController; parameters: RunnerMotionParameters;
  body: DurableBatterSwingExitState['body']; rootHeightMeters: number; reactionTick: number;
  runnerModelReference: SamePaReference<'world_player_runner_decision_motion_models'> }>;
const tick = (v: number) => Number.isSafeInteger(v) && v >= 0;
export const samePaBatterCatchResponseInput = (a: SamePaBatterCatchResponseRequest): void => {
  const b = a.motionBasis;
  if (!fields(a, ['kind', 'member', 'catchWorkReference', 'motionBasis', 'intent', 'endTick', 'provenance']) || a.kind !== 'batter_catch_response_v1'
    || !samePaDispatchMemberValid(a.member) || !ref(a.catchWorkReference, 'pa_catch_v1_work')
    || !fields(a.intent, ['kind', 'issuedTick']) || a.intent.kind !== 'hold' || !tick(a.intent.issuedTick) || !tick(a.endTick) || a.endTick <= a.intent.issuedTick
    || !fields(a.provenance, ['sourceRecordId', 'sourceVersion']) || !Object.values(a.provenance).every(text)
    || !(b?.kind === 'runner_plan' && fields(b, ['kind', 'planReference']) && ref(b.planReference, 'world_batter_run_plans')
      || b?.kind === 'swing_exit' && fields(b, ['kind', 'exitStateReference', 'route']) && ref(b.exitStateReference, 'world_batter_swing_exit_states')
        && fields(b.route, ['segments']) && Array.isArray(b.route.segments) && b.route.segments.length === 1
        && b.route.segments.every(s => s.kind === 'line' && fields(s, ['kind', 'start', 'end']) && [s.start, s.end].every(v => fields(v, ['x', 'z']) && Object.values(v).every(Number.isFinite)))))
    throw new Error('invalid original received batter hold Source');
};
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('received batter hold original binding differs'); };
const fieldRef = (f: Field) => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
/** The accepted Source owns the choice to hold. Receipt and body state come
 * from their original owners; neither the legal OUT nor correct truth selects
 * an automatic response or changes physical history. */
export const deriveSamePaBatterCatchResponse = (db: DatabaseSync, source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, basis: SamePaLifecycleViewBasis, prefix: readonly Field[]): SamePaBatterCatchResponse => {
  const a = source.action, actor = basis.actor, moment = previous.field.motion.world.moment, p = root.response.world.parameters;
  if (a?.kind !== 'batter_catch_response_v1') throw new Error('received batter hold Source missing');
  samePaBatterCatchResponseInput(a);
  same(a.member, basis.members.find(m => m.playerId === actor.binding.playerId));
  if (source.throughTick !== previous.evaluationTick || a.intent.issuedTick !== previous.evaluationTick || !previous.field.motion.cursor
    || moment.elapsedSeconds !== (a.intent.issuedTick - moment.originTick) / p.ticksPerSecond)
    throw new Error('received batter hold requires an exact original body cut');
  if (prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_catch_response_v1'))
    throw new Error('original batter caught response already owns this field');
  if (samePaBatterRunForeignCoverage(root, previous, prefix, actor.binding.playerId, undefined) <= previous.evaluationTick)
    throw new Error('received batter hold requires current foreign command coverage for adoption');
  const journal = readSamePaLifecycleRecordFromSqlite(db, 'prefix', basis.view.source.prefixReference.sourceId);
  if (!journal || journal.kind !== 'same_pa_lifecycle_prefix' || !journal.source.eventReferences.some(r => json(r) === json(a.catchWorkReference)))
    throw new Error('received batter hold requires an admitted original catch work');
  const work = readSamePaCatchWorkFromSqlite(db, a.catchWorkReference);
  same(work.lineage, root.lineage); same(work.physicalPitchReference, basis.view.cut.physicalPitchReference);
  same(work.communication.evaluatedThrough, { originTick: moment.originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick });
  const physical = work.physicalOperationReference;
  if (physical.owner !== 'pa_physical_v1_field_roots' && physical.owner !== 'pa_physical_v1_field_steps') throw new Error('received batter hold requires owned field reception');
  const receivedField = readSamePaPhysicalOperationFromSqlite(db, { ...physical, owner: physical.owner }).record;
  if (receivedField.kind !== 'same_pa_physical_field_root_v1' && receivedField.kind !== 'same_pa_physical_field_step_v1') throw new Error('received batter hold field missing');
  same(receivedField.field, previous.field);
  const reception = samePaCaughtOutReception(work.operative, samePaCatchCommunicationObservationAt(work.communication, actor.binding.playerId, work.communication.evaluatedThrough));
  if (!reception || work.operative.kind !== 'retired' || work.operative.runnerId !== actor.binding.playerId)
    throw new Error('received batter hold requires an actually received original caught OUT');
  let controller: RouteFollowingController, parameters: RunnerMotionParameters, exit: DurableBatterSwingExitState;
  if (a.motionBasis.kind === 'runner_plan') {
    const plan = readBatterRunPlanFromSqlite(db, a.motionBasis.planReference);
    same(plan.lineage, root.lineage); same(plan.physicalPitchReference, basis.view.cut.physicalPitchReference);
    if (!journal.source.eventReferences.some(r => json(r) === json(a.motionBasis.kind === 'runner_plan' ? a.motionBasis.planReference : null))
      || !prefix.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_run_motion_v1'
        && json(f.actionResult.planReference) === json(a.motionBasis.kind === 'runner_plan' ? a.motionBasis.planReference : null))
      || plan.plan.physicalBinding !== 'owned_static_pose_straight_motion') throw new Error('received batter hold requires its actually executed original run plan');
    exit = plan.exitState; parameters = plan.plan.timeline.runnerMotionParameters;
    const startMotion = sampleRunnerMotionTrajectory(plan.plan.timeline.postLaunchTrajectory, a.intent.issuedTick);
    controller = buildRouteFollowingController({ canonical: createCanonicalRunnerKinematicsFromRouteMotion(plan.playerId, startMotion, plan.plan.timeline.route, plan.plan.timeline.postLaunchController.basis.motionRevision + 1),
      startMotion, route: plan.plan.timeline.route, intent: a.intent, parameters, endTick: a.endTick });
  } else {
    const value = batterSwingExitStateEvidenceFromSqlite(db).read(a.motionBasis.exitStateReference.sourceId);
    if (!value) throw new Error('received batter hold original swing-exit state missing');
    exit = value; same(reference('world_batter_swing_exit_states', exit), a.motionBasis.exitStateReference);
    same(exit.source.fieldReference, fieldRef(previous)); same(exit.lineage, root.lineage);
    if (journal.source.eventReferences.some(r => r.owner === 'world_batter_run_plans'
      && json(readBatterRunPlanFromSqlite(db, { ...r, owner: 'world_batter_run_plans' }).physicalPitchReference) === json(basis.view.cut.physicalPitchReference)))
      throw new Error('received batter hold must preserve its incumbent run controller');
    const prepared = prepareBatterCatchHoldPlan(exit, { playerId: actor.binding.playerId, personId: actor.binding.personId,
      route: a.motionBasis.route, intent: a.intent, endTick: a.endTick });
    if (prepared.kind !== 'prepared' || prepared.physicalBinding !== 'owned_static_pose_straight_motion') throw new Error('received batter hold recovery pose binding is unavailable');
    controller = prepared.timeline.postLaunchController; parameters = prepared.timeline.runnerMotionParameters;
  }
  if (exit.playerId !== actor.binding.playerId || exit.personId !== actor.binding.personId || parameters.ticksPerSecond !== p.ticksPerSecond)
    throw new Error('received batter hold original Player, Person or clock differs');
  const routeLength = getRunnerRouteLength(controller.route);
  for (const s of controller.trajectory.segments) {
    const dt = s.endElapsedSeconds-s.startElapsedSeconds, end = s.startRouteDistanceMeters+s.startSpeedMps*dt+0.5*s.accelerationMps2*dt*dt;
    if (s.bodyMode !== 'upright' || s.startRouteDistanceMeters < 0 || end < 0 || end > routeLength)
      throw new Error('received batter hold exceeds its original finite upright route');
  }
  const firstPiece = controller.trajectory.segments[0];
  if (!firstPiece || Math.floor(controller.trajectory.startTick + firstPiece.endElapsedSeconds * parameters.ticksPerSecond) <= a.intent.issuedTick)
    throw new Error('received batter hold first analytic piece has no supported whole-tick adoption');
  const body = previous.field.motion.actors.find(a => a.playerId === actor.binding.playerId && a.primitive.role === 'body');
  const shape = exit.body.primitives.find(s => s.role === 'body');
  if (!body || !shape) throw new Error('received batter hold actual body missing');
  const actual = samplePiecewiseFieldActor(body, moment), expected = controller.basis, close = (x: number, y: number) => Math.abs(x-y) <= Number.EPSILON * Math.max(1,Math.abs(x),Math.abs(y))*32;
  if (!close(actual.center.x-shape.offset.x, expected.position.x) || !close(actual.center.z-shape.offset.z, expected.position.z)
    || !close(actual.velocity.x, expected.velocity.x) || !close(actual.velocity.z, expected.velocity.z)
    || actual.velocity.y !== 0 || body.primitive.acceleration.y !== 0 || !close(actual.center.y-shape.offset.y, exit.root.position.y))
    throw new Error('received batter hold controller does not match actual body kinematics');
  const reactionTick = a.intent.issuedTick + parameters.reactionDelayTicks;
  if (!tick(reactionTick)) throw new Error('received batter hold reaction time overflow');
  return freeze({ kind: a.kind, playerId: actor.binding.playerId, personId: actor.binding.personId, catchWorkReference: a.catchWorkReference,
    callSourceId: work.originalInputs.action!.sourceId, reception, motionBasis: a.motionBasis, intent: a.intent,
    controller, parameters, body: exit.body, rootHeightMeters: exit.root.position.y, reactionTick,
    runnerModelReference: reference('world_player_runner_decision_motion_models', exit.model.runnerModel) });
};
