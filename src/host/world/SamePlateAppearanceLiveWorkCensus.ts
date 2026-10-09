import { samePaExactRunnerControllerCensus } from './SamePlateAppearanceExactRunnerControllerPiece';
import { deriveSamePaLiveAppealCensus } from './SamePlateAppearanceLiveAppeal';
import { deriveSamePaDefenderDepartureCensus } from './SamePlateAppearanceDefenderDeparture';
import { deriveSamePaOccupiedRunnerMotionCensus } from './SamePlateAppearanceOccupiedRunnerMotion';
import { deriveSamePaOccupiedRunnerCatchCensus } from './SamePlateAppearanceOccupiedRunnerCatchCensus';
import { deriveSamePaBatterCatchCensus } from './SamePlateAppearanceBatterCatchCensus';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../../core/sim/ExactEventTime';
import { prepareBattedWorldScheduledFieldAcquisition } from '../../core/sim/ball/BattedWorldScheduledFieldAcquisition';
import type { BattedWorldPossessionEvidence } from '../../core/rules/BallWorldFieldFirstBaseRaceWithPossessionEvidence';
import type { ObservationRefreshPolicy } from '../../core/sim/perception/Observation';
import type { SamePaPhysicalFieldRoot, SamePaPhysicalFieldStep } from './SamePlateAppearancePhysicalEpisode';
import type { SamePaPhysicalFieldReference } from './SamePlateAppearancePhysicalFieldAction';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { samePaPhysicalPendingThrow } from './SamePlateAppearancePhysicalFieldThrow';
import { deriveActualLiveObservationSchedule } from './ActualLiveObservationSchedule';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaCatchDefenderResponse } from './SamePlateAppearanceCatchDefenderResponse';

type Field = SamePaPhysicalFieldRoot | SamePaPhysicalFieldStep;
type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaLiveWorkCensusInput = Readonly<{
  fields: readonly Field[];
  participantIds: readonly string[];
  observationPolicies: readonly Readonly<{ observationReference: StepReference; refreshPolicy: ObservationRefreshPolicy }>[];
  /** The paired Native reader supplies the already derived rule projection. */
  possessionEvidence: BattedWorldPossessionEvidence;
}>;
type Decision = Readonly<{ playerId: string; decisionReference: StepReference; observationReference: StepReference;
  decisionTick: number; movementStartTick: number; decisionDue: 'due' | 'future'; movementDue: 'due' | 'future' }>;
const roles = ['body', 'glove', 'tag_hand', 'left_foot', 'right_foot'] as const;
const fieldReference = (f: Field): SamePaPhysicalFieldReference => reference(f.kind === 'same_pa_physical_field_root_v1' ? 'pa_physical_v1_field_roots' : 'pa_physical_v1_field_steps', f);
const result = (f: Field) => f.kind === 'same_pa_physical_field_step_v1' ? f.actionResult : undefined;
const tick = (n: number) => Number.isSafeInteger(n) && n >= 0;
const same = (a: unknown, b: unknown, reason: string) => { if (json(a) !== json(b)) throw new Error('same-PA live-work ' + reason); };

/** Inventory only of original records already executed in the reserved field
 * prefix. Native authenticates the prefix and per-observation effective policy
 * together. This neither predicts new producers nor certifies a live-play end. */
export const deriveSamePaLiveWorkCensus = (raw: SamePaLiveWorkCensusInput) => {
  const input = cloneInert(raw), root = input.fields[0], last = input.fields.at(-1);
  if (!root || root.kind !== 'same_pa_physical_field_root_v1' || !last || !input.participantIds.length
    || input.participantIds.some(id => typeof id !== 'string' || !id || id !== id.trim())
    || new Set(input.participantIds).size !== input.participantIds.length) throw new Error('same-PA live-work original root or participant membership missing');
  const p = root.response.world.parameters, originTick = root.response.world.flight.initialBall.tick;
  const horizon = last.field.motion.world.moment, at = { originTick, elapsedSeconds: horizon.elapsedSeconds, tick: horizon.ball.tick };
  const due = (deadline: number): 'due' | 'future' => (deadline - originTick) / p.ticksPerSecond <= at.elapsedSeconds ? 'due' : 'future';
  const fieldReferences = input.fields.map(fieldReference), original = new Map<string, { field: Field; reference: SamePaPhysicalFieldReference }>();
  const curves = new Map<string, { actor: Field['field']['motion']['actors'][number]; curveReference: SamePaPhysicalFieldReference }>();
  const policies = new Map<string, ObservationRefreshPolicy>();
  for (const policy of input.observationPolicies) {
    const key = json(policy.observationReference);
    if (policies.has(key)) throw new Error('same-PA live-work duplicate observation policy');
    policies.set(key, policy.refreshPolicy);
  }
  type Observation = Parameters<typeof deriveActualLiveObservationSchedule>[0][number];
  const observations = new Map<string, Observation[]>(), observationReferences = new Map<string, StepReference>();
  const decisions = new Map<string, Decision>();
  const consumers = new Map<string, { consumerReference: StepReference; at: typeof at }>();
  const responses = new Map<string, { responseReference: StepReference; response: SamePaCatchDefenderResponse }>();
  const responseReferences = new Map<string, { responseReference: StepReference; response: SamePaCatchDefenderResponse }>();
  const responseConsumers = new Map<string, { consumerReference: StepReference; at: typeof at }>();
  let previous: Field | undefined, physical: Field = root;
  for (let index = 0; index < input.fields.length; index++) {
    const field = input.fields[index], ref = fieldReferences[index], motion = field.field.motion, moment = motion.world.moment;
    if (!field.source.sourceId || original.has(field.source.sourceId) || field.physicalPitchSourceId !== root.physicalPitchSourceId
      || field.pitchOrdinal !== root.pitchOrdinal || json(field.lineage) !== json(root.lineage)
      || field.evaluationTick !== moment.ball.tick || moment.originTick !== originTick
      || !tick(field.operationOrdinal) || !Number.isFinite(moment.elapsedSeconds) || moment.elapsedSeconds < 0
      || quantizeEventTick(originTick, moment.elapsedSeconds, p.ticksPerSecond) !== moment.ball.tick
      || previous && moment.elapsedSeconds < previous.field.motion.world.moment.elapsedSeconds)
      throw new Error('same-PA live-work original prefix identity or chronology differs');
    if (previous) {
      if (field.kind !== 'same_pa_physical_field_step_v1' || field.operationOrdinal !== previous.operationOrdinal + 1)
        throw new Error('same-PA live-work prefix is not consecutive');
      same(field.source.previousFieldReference, fieldReferences[index - 1], 'previous field reference differs');
      same(field.source.previousOperationReference, fieldReferences[index - 1], 'previous operation reference differs');
      same(field.source.fieldRootReference, fieldReferences[0], 'root reference differs');
    }
    if (motion.actors.length !== input.participantIds.length * roles.length
      || input.participantIds.some(id => roles.some(role => motion.actors.filter(a => a.playerId === id && a.primitive.role === role).length !== 1)))
      throw new Error('same-PA live-work physical role or participant membership differs');
    for (const actor of motion.actors) {
      const s = actor.primitive;
      if (!tick(s.startTick) || !tick(s.endTick) || s.startTick > s.endTick || s.ticksPerSecond !== p.ticksPerSecond
        || actor.startElapsedSeconds !== undefined && (!Number.isFinite(actor.startElapsedSeconds) || actor.startElapsedSeconds < 0)
        || (originTick - s.startTick) / p.ticksPerSecond + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0) < 0
        || moment.elapsedSeconds > (s.endTick - originTick) / p.ticksPerSecond)
        throw new Error('same-PA live-work physical role coverage differs');
      const key = json([actor.playerId, s.role]);
      if (json(curves.get(key)?.actor ?? null) !== json(actor)) curves.set(key, { actor, curveReference: ref });
    }
    const r = result(field), source = field.kind === 'same_pa_physical_field_step_v1' ? field.source.action : undefined;
    if (source && source.kind !== r?.kind) throw new Error('same-PA live-work original action result missing or different');
    if (r?.kind === 'defender_observation_v1' || r?.kind === 'defender_decision_v1' || r?.kind === 'defender_catch_response_v1' || r?.kind === 'batter_catch_response_v1' || r?.kind === 'occupied_runner_catch_response_v1') {
      if (!previous || !source || !('member' in source) || source.kind !== r.kind || source.member.playerId !== r.playerId || !input.participantIds.includes(r.playerId))
        throw new Error('same-PA live-work sensory action identity differs');
      same(field.field, previous.field, 'sensory action changed physical state');
    } else if (r?.kind === 'appeal_indication_v1' || r?.kind === 'appeal_contact_v1' || r?.kind === 'defender_departure_purpose_v1') {
      if (!previous || source?.kind !== r.kind) throw new Error('same-PA live-work appeal action identity differs');
      same(field.field, previous.field, 'appeal action changed physical state');
    } else physical = field;
    if (r?.kind === 'defender_observation_v1') {
      const policy = policies.get(json(ref));
      if (!policy) throw new Error('same-PA live-work original observation policy missing');
      policies.delete(json(ref));
      same(r.receipt.at, { originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick }, 'observation moment differs');
      if (r.samplingRequest.sourceId !== field.source.sourceId || r.samplingRequest.playerId !== r.playerId)
        throw new Error('same-PA live-work original observation request differs');
      if (source?.kind !== 'defender_observation_v1') throw new Error('same-PA live-work observation Source missing');
      same(r.samplingRequest.view.attentionTarget, source.view.attentionTarget, 'observation attention differs');
      const records = observations.get(r.playerId) ?? [];
      records.push({ sourceId: field.source.sourceId, at: r.receipt.at, attentionTarget: r.samplingRequest.view.attentionTarget,
        results: r.receipt.results, refreshPolicy: policy });
      observations.set(r.playerId, records); observationReferences.set(field.source.sourceId, ref as StepReference);
    } else if (r?.kind === 'defender_decision_v1') {
      const observed = original.get(r.observationReference.sourceId), observation = observed && result(observed.field);
      if (!observed || observation?.kind !== 'defender_observation_v1' || observation.playerId !== r.playerId
        || source?.kind !== 'defender_decision_v1') throw new Error('same-PA live-work decision original observation missing');
      same(observed.reference, r.observationReference, 'decision observation reference differs');
      same(source.observationReference, r.observationReference, 'decision Source observation differs');
      const schedule = r.calculation.scheduling;
      if (![schedule.startedAtTick, schedule.decisionTick, schedule.movementStartTick, schedule.decisionDelayTicks, schedule.firstStepDelayTicks].every(tick)
        || schedule.startedAtTick + schedule.decisionDelayTicks !== schedule.decisionTick
        || schedule.decisionTick + schedule.firstStepDelayTicks !== schedule.movementStartTick)
        throw new Error('same-PA live-work original decision schedule differs');
      decisions.set(json(ref), { playerId: r.playerId, decisionReference: ref as StepReference, observationReference: r.observationReference,
        decisionTick: schedule.decisionTick, movementStartTick: schedule.movementStartTick,
        decisionDue: due(schedule.decisionTick), movementDue: due(schedule.movementStartTick) });
    } else if (r?.kind === 'defender_catch_response_v1') {
      const observed = original.get(r.observationReference.sourceId), observation = observed && result(observed.field), replan = r.replan;
      if (!observed || observation?.kind !== 'defender_observation_v1' || observation.playerId !== r.playerId
        || source?.kind !== 'defender_catch_response_v1' || replan.trigger !== 'communication_received' || !replan.cause
        || replan.cause.playerId !== r.playerId || replan.cause.physicalPitchSourceId !== root.physicalPitchSourceId
        || replan.originObservationSourceId !== r.observationReference.sourceId || !replan.scheduling)
        throw new Error('same-PA live-work received response cause or observation differs');
      same(observed.reference, r.observationReference, 'response observation reference differs');
      same(source.observationReference, r.observationReference, 'response Source observation differs');
      same(source.previousResponseReference, responses.get(replan.processSourceId)?.responseReference ?? null, 'response predecessor differs');
      if ((replan.selectedAt === null) !== (r.issuedBySourceId === null) || replan.selectedAt && (!replan.selected
        || replan.selectedAt.originTick !== originTick || replan.selectedAt.elapsedSeconds !== (replan.scheduling.decisionTick - originTick) / p.ticksPerSecond
        || replan.selectedAt.elapsedSeconds > moment.elapsedSeconds) || replan.work.some(w => !tick(w.dueTick)))
        throw new Error('same-PA live-work response commitment differs');
      const value = { responseReference: ref as StepReference, response: r };
      responses.set(replan.processSourceId, value); responseReferences.set(json(ref), value);
    } else if (r?.kind === 'defender_motion_v1') {
      if (source?.kind !== 'defender_motion_v1' || !source.selections.length || source.selections.length !== r.motors.length
        || new Set(source.selections.map(s => s.member.playerId)).size !== source.selections.length
        || new Set(r.motors.map(m => m.self.playerId)).size !== r.motors.length)
        throw new Error('same-PA live-work motor original selections differ');
      for (const selection of source.selections) {
        const key = json(selection.decisionReference), decision = decisions.get(key);
        const motor = r.motors.find(m => m.self.playerId === selection.member.playerId && m.command.playerId === selection.member.playerId);
        const response = responseReferences.get(key);
        if (response) {
          const q = response.response.replan, schedule = q.scheduling;
          same(responses.get(q.processSourceId)?.responseReference, selection.decisionReference, 'motor response is stale');
          if (response.response.playerId !== selection.member.playerId || !motor || q.semantic !== 'ready' || q.phase !== 'renewal_due'
            || !q.selectedAt || !response.response.issuedBySourceId || !schedule || schedule.movementStartTick === null
            || !motor.startAt || motor.startAt.originTick !== originTick || motor.startAt.elapsedSeconds > moment.elapsedSeconds
            || motor.startAt.elapsedSeconds < (schedule.movementStartTick - originTick) / p.ticksPerSecond)
            throw new Error('same-PA live-work motor received response is not issued or due');
          same(motor.issuedAt, q.selectedAt, 'received motor original issuance differs');
          if (!responseConsumers.has(q.processSourceId)) responseConsumers.set(q.processSourceId, { consumerReference: ref as StepReference,
            at: motor.startAt });
          continue;
        }
        if (!decision || decision.playerId !== selection.member.playerId || !motor || moment.elapsedSeconds < (decision.movementStartTick - originTick) / p.ticksPerSecond)
          throw new Error('same-PA live-work motor original decision or player differs');
        if (!consumers.has(key)) consumers.set(key, { consumerReference: ref as StepReference,
          at: { originTick, elapsedSeconds: moment.elapsedSeconds, tick: moment.ball.tick } });
      }
    }
    original.set(field.source.sourceId, { field, reference: ref }); previous = field;
  }
  if (policies.size) throw new Error('same-PA live-work observation policy is outside original prefix');
  const schedules = [...observations].map(([playerId, records]) => ({ playerId, schedule: deriveActualLiveObservationSchedule(records) }));
  const observationRefresh = {
    pending: schedules.flatMap(({ playerId, schedule }) => schedule.pending.map(work => ({ ...work, playerId,
      causeReference: observationReferences.get(work.causeSourceId)!, due: due(work.dueTick) }))),
    consumed: schedules.flatMap(({ playerId, schedule }) => schedule.consumed.map(work => ({ ...work, playerId,
      causeReference: observationReferences.get(work.causeSourceId)!, consumerReference: observationReferences.get(work.consumerSourceId)! }))),
  };
  const defenderDecisions = {
    pending: [...decisions].filter(([key]) => !consumers.has(key)).map(([, decision]) => decision),
    consumed: [...decisions].flatMap(([key, decision]) => { const consumed = consumers.get(key); return consumed ? [{ ...decision, ...consumed }] : []; }),
  };
  const catchResponses = {
    pending: [...responses].filter(([id]) => !responseConsumers.has(id)).map(([, value]) => ({ ...value,
      work: value.response.replan.work.map(w => ({ ...w, due: due(w.dueTick) })) })),
    adopted: [...responses].flatMap(([id, value]) => { const consumed = responseConsumers.get(id); return consumed ? [{ ...value, ...consumed }] : []; }),
  };
  const participantCurves = input.participantIds.map(playerId => {
    const ownedRoles = roles.map(role => {
      const { actor, curveReference } = curves.get(json([playerId, role]))!, s = actor.primitive;
      return { role, curveReference, startTick: s.startTick, endTick: s.endTick, startElapsedSeconds: actor.startElapsedSeconds ?? 0,
        endDue: due(s.endTick) };
    });
    return { playerId, roles: ownedRoles, coverageThroughTick: Math.min(...ownedRoles.map(r => r.endTick)) };
  });
  const possession = input.possessionEvidence;
  if (possession.policy !== 'scheduled_capture_confirmation_v1' || possession.originTick !== originTick
    || possession.ticksPerSecond !== p.ticksPerSecond || possession.throughElapsedSeconds !== at.elapsedSeconds)
    throw new Error('same-PA live-work paired possession clock differs');
  const physicalResult = result(physical), captureResult = physicalResult?.kind === 'capture_checkpoint_v1' ? physicalResult : null;
  const candidateReference = captureResult && captureResult.progress.kind !== 'secured' ? captureResult.candidateReference
    : physical.field.motion.response.kind === 'capture_candidate' ? fieldReference(physical) : null;
  // Initial glove contacts still need the rule owner's defender admission. A
  // non-defender contact is not a scheduled capture merely because the field
  // response offers a physical candidate. Recorded checkpoints already own it.
  if (possession.pending.length > 1 || !candidateReference && possession.pending.length !== 0
    || captureResult && possession.pending.length !== (captureResult.progress.kind === 'secured' ? 0 : 1))
    throw new Error('same-PA live-work paired pending capture coverage differs');
  const captures = possession.pending.map(pending => {
    const candidate = original.get(pending.planSourceId);
    if (!candidate || !input.participantIds.includes(pending.playerId)) throw new Error('same-PA live-work original capture candidate missing');
    same(candidate.reference, candidateReference, 'pending capture reference differs');
    const plan = prepareBattedWorldScheduledFieldAcquisition({ response: root.response, geometry: root.geometry, field: candidate.field.field });
    const phase = captureResult?.progress.kind === 'interrupted' ? 'contact_policy_pending'
      : captureResult?.progress.kind === 'fence_pending' ? 'fence_pending' : 'capturing';
    const earliest = captureResult?.progress.kind === 'interrupted' ? Math.min(plan.secureElapsedSeconds, at.elapsedSeconds) : plan.secureElapsedSeconds;
    same(pending, { planSourceId: candidate.field.source.sourceId, playerId: plan.acquirerPlayerId,
      contactElapsedSeconds: plan.contactMoment.elapsedSeconds, phase, earliestPotentialControlElapsedSeconds: earliest }, 'paired pending capture differs');
    return { ...pending, candidateReference: candidate.reference, secureTick: plan.candidateSecureTick,
      fenceElapsedSeconds: plan.fenceElapsedSeconds, coverageThroughTick: plan.coverageThroughTick, due: due(plan.candidateSecureTick) };
  });
  const pendingThrow = samePaPhysicalPendingThrow(input.fields);
  const throwing = pendingThrow ? { planReference: reference('pa_physical_v1_field_steps', pendingThrow.step),
    playerId: pendingThrow.plan.input.carrierPlayerId, receiverPlayerId: pendingThrow.plan.input.receiverPlayerId,
    releaseTick: pendingThrow.plan.transfer.throwReadyTick, releaseElapsedSeconds: pendingThrow.plan.releaseElapsedSeconds,
    coverageThroughTick: pendingThrow.plan.input.throughTick, due: due(pendingThrow.plan.transfer.throwReadyTick),
    phase: 'transfer' as const } : null;
  const exactRunnerControllerPieces=samePaExactRunnerControllerCensus(input.fields);
  const recoveryFields=input.fields.filter((f):f is SamePaPhysicalFieldStep=>f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='batter_recovery_motion_v1');
  const lastRecovery=recoveryFields.at(-1),recovery=lastRecovery?.actionResult;
  const batterRecovery=lastRecovery&&recovery?.kind==='batter_recovery_motion_v1'?{
    recoveryReference:fieldReference(lastRecovery),playerId:recovery.playerId,bindingHash:recovery.recoveryBindingHash,
    startTick:recovery.recoveryStartTick,launchTick:recovery.recoveryLaunchTick,
    actualThroughElapsedSeconds:lastRecovery.field.motion.world.moment.elapsedSeconds,phaseComplete:recovery.recoveryComplete,
    postLaunchConsumer:input.fields.flatMap(f=>f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='batter_run_motion_v1'
      &&json(f.actionResult.completedRecoveryReference)===json(fieldReference(lastRecovery))
      &&f.field.motion.world.moment.elapsedSeconds>lastRecovery.field.motion.world.moment.elapsedSeconds?[fieldReference(f)]:[])[0]??null,
  }:null;
  return freeze({ kind: 'same_pa_live_work_census_v1' as const,
    ...(exactRunnerControllerPieces.length ? {exactRunnerControllerPieces} : {}),
    ...(batterRecovery ? {batterRecovery} : {}),
    ...(input.fields.some(f=>f.kind==='same_pa_physical_field_step_v1'&&f.actionResult?.kind==='defender_departure_purpose_v1')
      ? {defenderDepartures:deriveSamePaDefenderDepartureCensus(input.fields)} : {}),
    originalFieldPrefix: { kind: 'original_field_prefix_only' as const, physicalPitchSourceId: root.physicalPitchSourceId,
      participantIds: input.participantIds, fieldReferences, rootReference: fieldReferences[0], endpointReference: fieldReferences.at(-1)!, at },
    ...(input.fields.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_motion_v1')
      ? { occupiedRunnerMotions: deriveSamePaOccupiedRunnerMotionCensus(input.fields) } : {}),
    ...(input.fields.some(f => f.kind === 'same_pa_physical_field_step_v1'
      && (f.actionResult?.kind === 'appeal_indication_v1' || f.actionResult?.kind === 'appeal_contact_v1'))
      ? { liveAppeals: deriveSamePaLiveAppealCensus(input.fields) } : {}),
    observationRefresh, defenderDecisions, catchResponses, batterCatchResponses: deriveSamePaBatterCatchCensus(input.fields),
    ...(root.source.liveProducerProfile === 'same_pa_stationary_occupied_catch_v1'
      || input.fields.some(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'occupied_runner_catch_response_v1')
      ? { occupiedRunnerCatchResponses: deriveSamePaOccupiedRunnerCatchCensus(input.fields) } : {}), participantCurves, pendingPhysical: { captures, throw: throwing },
    unownedDomains: ['calls', 'receptions', 'producer_completeness', 'live_play_end'] as const });
};
export type SamePaLiveWorkCensus = ReturnType<typeof deriveSamePaLiveWorkCensus>;
