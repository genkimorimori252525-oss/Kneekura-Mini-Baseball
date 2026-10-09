import { buildRouteFollowingController, type RouteFollowingController } from '../../core/sim/running/RunnerLocomotionController';
import type { RunnerRoute } from '../../core/sim/running/RunnerRoute';
import { deriveSamePaRunnerControllerMotion } from './SamePlateAppearanceRunnerControllerMotion';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep, SamePaPhysicalFieldStepSource } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaLifecycleViewBasis } from './SamePlateAppearanceLifecycle';
import type { DurableSamePaOccupiedRunnerHold } from './SqliteSamePlateAppearanceOccupiedRunnerHoldStore';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaReferenceValid as ref, samePaText as text, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaOccupiedRunnerMotionRequest = Readonly<{
  kind: 'occupied_runner_motion_v1'; member: SamePaDispatchMember;
  holdReference: SamePaReference<'world_same_pa_occupied_runner_holds'>;
  predecessorMotionReference: StepReference | null;
  route: RunnerRoute; intent: Readonly<{ kind: 'advance'; issuedTick: number }>; endTick: number;
  provenance: Readonly<{ sourceRecordId: string; sourceVersion: string }>;
}>;
export type SamePaOccupiedRunnerMotionResult = Readonly<{
  kind: 'occupied_runner_motion_v1'; playerId: string; personId: string;
  holdReference: SamePaOccupiedRunnerMotionRequest['holdReference']; controller: RouteFollowingController;
  reactionTick: number; controllerSegmentIndex: number; coverageThroughTick: number; planThroughTick: number;
}>;
const tick = (n: number) => Number.isSafeInteger(n) && n >= 0;
const same = (a: unknown, b: unknown) => { if (json(a) !== json(b)) throw new Error('occupied runner motion original binding differs'); };
const command = ({ predecessorMotionReference: _, member, ...a }: SamePaOccupiedRunnerMotionRequest) => {
  // Each cut authenticates its current workload projection separately. The
  // immutable issued command keeps the original reserved participant identity.
  const { projectedStateHash: _projected, ...reservedMember } = member;
  return { ...a, member: reservedMember };
};
export const samePaOccupiedRunnerMotionInput = (a: SamePaOccupiedRunnerMotionRequest) => {
  if (!fields(a, ['kind', 'member', 'holdReference', 'predecessorMotionReference', 'route', 'intent', 'endTick', 'provenance'])
    || a.kind !== 'occupied_runner_motion_v1' || !samePaDispatchMemberValid(a.member)
    || !ref(a.holdReference, 'world_same_pa_occupied_runner_holds')
    || a.predecessorMotionReference !== null && !ref(a.predecessorMotionReference, 'pa_physical_v1_field_steps')
    || !fields(a.intent, ['kind', 'issuedTick']) || a.intent.kind !== 'advance' || !tick(a.intent.issuedTick)
    || !tick(a.endTick) || a.endTick <= a.intent.issuedTick
    || !fields(a.route, ['segments']) || !Array.isArray(a.route.segments) || a.route.segments.length !== 1
    || a.route.segments.some(s => s.kind !== 'line' || !fields(s, ['kind', 'start', 'end'])
      || [s.start, s.end].some(v => !fields(v, ['x', 'z']) || !Object.values(v).every(Number.isFinite)))
    || !fields(a.provenance, ['sourceRecordId', 'sourceVersion']) || !Object.values(a.provenance).every(text))
    throw new Error('invalid original occupied runner motion Source');
};
/** One explicitly issued finite advance, beginning at the original held body.
 * Native supplies the original hold/model and prefix. Continuations retain the
 * same command and exact controller; they cannot replace it with another route,
 * reaction schedule or an implicit post-call policy. No endpoint is a ruling. */
export const deriveSamePaOccupiedRunnerMotion = (source: SamePaPhysicalFieldStepSource, root: SamePaPhysicalFieldRoot,
  previous: Field, hold: DurableSamePaOccupiedRunnerHold, basis: SamePaLifecycleViewBasis, prefix: readonly Field[]) => {
  const a = source.action;
  if (a?.kind !== 'occupied_runner_motion_v1') throw new Error('occupied runner motion Source missing');
  samePaOccupiedRunnerMotionInput(a);
  same(a.member, basis.members.find(m => m.playerId === a.member.playerId));
  same(a.holdReference, reference('world_same_pa_occupied_runner_holds', hold));
  same(hold.source.enrollmentReference, root.lineage.enrollmentReference);
  const playerId = a.member.playerId, runner = basis.actor.world.runners.find(r => r.playerId === playerId);
  if (!runner || playerId === basis.actor.binding.playerId || hold.source.playerId !== playerId
    || hold.body.actor.playerId !== playerId || hold.body.actor.personId !== hold.source.personId
    || hold.source.intent.issuedTick > a.intent.issuedTick || a.endTick > hold.source.coverageThroughTick)
    throw new Error('occupied runner motion original identity or finite coverage differs');
  same(runner.position, hold.setup.position);
  if (prefix.some(f => f.kind === 'same_pa_physical_field_step_v1'
    && f.actionResult?.kind === 'occupied_runner_catch_response_v1' && f.actionResult.playerId === playerId))
    throw new Error('received occupied runner response supersedes its original advance');
  const prior = [...prefix].reverse().find(f => f.kind === 'same_pa_physical_field_step_v1'
    && f.actionResult?.kind === a.kind && f.actionResult.playerId === playerId);
  let controller: RouteFollowingController;
  const parameters = hold.model.source.motion;
  if (prior?.kind === 'same_pa_physical_field_step_v1' && prior.actionResult?.kind === a.kind) {
    same(a.predecessorMotionReference, reference('pa_physical_v1_field_steps', prior));
    if (prior.source.action?.kind !== a.kind) throw new Error('occupied runner motion original command missing');
    same(command(a), command(prior.source.action));
    controller = prior.actionResult.controller;
  } else {
    if (a.predecessorMotionReference !== null || a.intent.issuedTick !== previous.evaluationTick
      || hold.setup.velocity.x !== 0 || hold.setup.velocity.z !== 0)
      throw new Error('occupied runner motion cannot adopt behind actual history');
    const startMotion = { tick: a.intent.issuedTick, routeDistanceMeters: 0, speedMps: 0, driveDirection: 0 as const, bodyMode: 'upright' as const };
    controller = buildRouteFollowingController({ canonical: { playerId, tick: a.intent.issuedTick,
      position: hold.setup.position, velocity: hold.setup.velocity, bodyMode: 'upright', motionRevision: 0 },
      startMotion, route: a.route, intent: a.intent, parameters, endTick: a.endTick });
  }
  const reactionTick = a.intent.issuedTick + parameters.reactionDelayTicks;
  if (!tick(reactionTick) || reactionTick >= a.endTick) throw new Error('occupied runner motion requires finite post-reaction coverage');
  const value = deriveSamePaRunnerControllerMotion({ root, previous, prefix, throughTick: source.throughTick,
    controller, runnerMotionParameters: parameters, body: hold.body.actor, rootHeightMeters: hold.body.actor.bodyOriginHeightMeters });
  const actionResult: SamePaOccupiedRunnerMotionResult = { kind: a.kind, playerId, personId: hold.source.personId,
    holdReference: a.holdReference, controller, reactionTick, controllerSegmentIndex: value.controllerSegmentIndex,
    coverageThroughTick: value.coverageThroughTick, planThroughTick: value.planThroughTick };
  return freeze({ field: value.field, evaluationTick: value.evaluationTick, timeline: value.timeline, actionResult });
};

/** Original explicit runner commands retain their future reaction, analytic
 * piece and finite end obligations, even while actual displacement is zero. */
export const deriveSamePaOccupiedRunnerMotionCensus = (prefix: readonly Field[]) => {
  const root = prefix[0], last = prefix.at(-1);
  if (!root || root.kind !== 'same_pa_physical_field_root_v1' || !last) throw new Error('occupied runner motion census original prefix missing');
  const at = last.field.motion.world.moment, p = root.response.world.parameters;
  const due = (t: number): 'due' | 'future' => (t-at.originTick)/p.ticksPerSecond <= at.elapsedSeconds ? 'due' : 'future';
  const commands = new Map<string, { first: SamePaPhysicalFieldStep; latest: SamePaPhysicalFieldStep; adopted: boolean }>();
  for (const field of prefix) {
    if (field.kind !== 'same_pa_physical_field_step_v1' || field.actionResult?.kind !== 'occupied_runner_motion_v1') continue;
    const a = field.source.action, r = field.actionResult, prior = commands.get(r.playerId);
    if (a?.kind !== r.kind) throw new Error('occupied runner motion census Source missing');
    samePaOccupiedRunnerMotionInput(a);
    same(a.predecessorMotionReference, prior ? reference('pa_physical_v1_field_steps', prior.latest) : null);
    same(a.holdReference, r.holdReference);
    if (a.member.playerId !== r.playerId || r.controller.basis.playerId !== r.playerId
      || r.controller.basis.tick !== a.intent.issuedTick || r.planThroughTick !== a.endTick
      || r.coverageThroughTick > a.endTick || field.evaluationTick > r.coverageThroughTick
      || !tick(r.reactionTick) || r.reactionTick < a.intent.issuedTick || r.reactionTick >= a.endTick)
      throw new Error('occupied runner motion census original controller differs');
    if (prior) {
      const old = prior.latest.actionResult, original = prior.first.source.action;
      if (old?.kind !== r.kind || original?.kind !== a.kind) throw new Error('occupied runner motion census predecessor differs');
      same(command(a), command(original)); same(r.controller, old.controller); same(r.reactionTick, old.reactionTick);
    }
    commands.set(r.playerId, { first: prior?.first ?? field, latest: field,
      adopted: (prior?.adopted ?? false) || field.field.motion.world.moment.elapsedSeconds > (a.intent.issuedTick-at.originTick)/p.ticksPerSecond });
  }
  return freeze([...commands].map(([playerId, { first, latest, adopted }]) => {
    const r = latest.actionResult;
    if (r?.kind !== 'occupied_runner_motion_v1') throw new Error('occupied runner motion census latest controller missing');
    return { playerId, commandReference: reference('pa_physical_v1_field_steps', first), latestMotionReference: reference('pa_physical_v1_field_steps', latest),
      adopted, work: [
        ...(!adopted ? [{ kind: 'adoption' as const, dueTick: r.controller.basis.tick, due: due(r.controller.basis.tick) }] : []),
        ...(due(r.reactionTick) === 'future' ? [{ kind: 'reaction' as const, dueTick: r.reactionTick, due: 'future' as const }] : []),
        { kind: 'controller_piece' as const, dueTick: r.coverageThroughTick, due: due(r.coverageThroughTick) },
        { kind: 'controller_end' as const, dueTick: r.planThroughTick, due: due(r.planThroughTick) },
      ] };
  }));
};
