import { readSamePaOriginalParticipants } from './SamePlateAppearanceOriginalParticipants';
import type { DatabaseSync } from 'node:sqlite';
import { createLivePlayRegistry, resolveLivePlayRegistry, type LivePlaySource } from '../../core/sim/liveAction/LivePlayRegistry';
import { deriveQuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import { deriveBallWorldPlayerBaseContactHistory } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';
import { projectActualFairFieldTimeline } from '../../core/sim/plateAppearance/ActualFairFieldTimeline';
import { readSamePaAdmittedLiveWorkFromSqlite } from './SamePlateAppearanceAdmittedLiveWorkFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { readSamePaLifecycleRecordFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import type { SamePaCatchWorkReference } from './SamePlateAppearanceCatchWork';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze as freeze, actorHash as hash, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

const pending = (reason: string) => freeze({ kind: 'pending' as const, reason });
/** The original reserved prefix is the admission journal. Its complete Native
 * census, exact physical seal and each due consumer are checked before the
 * existing all-offense-terminal finalizer is allowed to ignore future work.
 * This value is persisted by the lifecycle outcome owner, never caller input. */
export const deriveSamePaFairCatchEndFromSqlite = (db: DatabaseSync,
  viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>, catchWorkReference: SamePaCatchWorkReference,
  mode: 'current' | 'historical') => withSamePaLifecycleReadPhase(db, () => {
  const live = readSamePaAdmittedLiveWorkFromSqlite(db, viewReference, mode);
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, viewReference, mode);
  if (live.kind !== 'same_pa_live_work_read_v1' || pair.kind !== 'same_pa_field_rule_read_pair_v1') return pending('owned_active_field_cut_required');
  const { value, fields, actor, view } = pair, census = live.census, root = fields[0], last = fields.at(-1)!;
  if (root.kind !== 'same_pa_physical_field_root_v1') throw new Error('fair catch end original root missing');
  const occupied = actor.world.runners.length > 0;
  if (census.liveAppeals?.pending.length) return pending('original_live_appeal_execution_required');
  if (census.liveAppeals?.executed.length) return pending('original_live_appeal_rule_and_rights_consumer_required');
  if (census.defenderDepartures?.purposes.some(p => p.status === 'active'))
    return pending('original_defender_departure_execution_required');
  if (root.source.liveProducerProfile !== (occupied ? 'same_pa_stationary_occupied_catch_v1' : 'same_pa_empty_base_catch_v1'))
    return pending('original_live_producer_profile_required');
  // An adopted advance can remain physically stationary during reaction. It
  // still owns motion and cannot use the stationary occupied end profile.
  if (census.occupiedRunnerMotions?.length) return pending('occupied_runner_moving_controller_end_owner_required');
  const occupiedRunners = value.occupiedRunners;
  if (occupied && occupiedRunners?.kind !== 'same_pa_stationary_occupied_runners_v1')
    return pending('occupied_runner_original_base_contact_history_required');
  const work = readSamePaCatchWorkFromSqlite(db, catchWorkReference), communication = live.communication;
  if (communication.kind !== 'owned_same_pa_catch_communication_v1') return pending('owned_catch_communication_required');
  if (json(communication.latestReference) !== json(catchWorkReference) || json(work.physicalOperationReference) !== json(view.cut.physicalOperationReference)
    || json(work.lineage) !== json(view.lineage) || json(work.physicalPitchReference) !== json(view.cut.physicalPitchReference))
    throw new Error('fair catch end original current call cut differs');
  const at = census.originalFieldPrefix.at, p = root.response.world.parameters;
  if (json(work.communication.evaluatedThrough) !== json(at)) throw new Error('fair catch end reception generation cut differs');
  if (work.operative.kind !== 'retired' || work.operative.runnerId !== actor.binding.playerId) return pending('operative_batter_retirement_required');
  if (value.fairCatch.kind !== 'same_pa_fair_catch_rule_basis_v1') return pending('actual_fair_catch_required');
  const originalRule = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, work.originalInputs.action!.viewReference, 'historical');
  if (originalRule.kind !== 'same_pa_field_rule_read_pair_v1' || originalRule.value.fairCatch.kind !== 'same_pa_fair_catch_rule_basis_v1')
    return pending('original_call_fair_catch_rule_applicability_required');
  const originalCatch = originalRule.value.fairCatch, finalCatch = value.fairCatch;
  if (json(originalCatch.catchMoment) !== json(finalCatch.catchMoment) || json(originalCatch.territoryMoment) !== json(finalCatch.territoryMoment)
    || json(originalCatch.correctRuling) !== json(finalCatch.correctRuling) || originalCatch.batterRunnerId !== finalCatch.batterRunnerId
    || json(originalRule.value.evidence.physical.field.evidence.contacts) !== json(value.evidence.physical.field.evidence.contacts)
    || json(originalRule.value.evidence.physical.field.evidence.acquisitions) !== json(value.evidence.physical.field.evidence.acquisitions)
    || json(originalRule.value.evidence.physical.field.baseContacts) !== json(value.evidence.physical.field.baseContacts))
    return pending('later_rule_relevant_physical_consumer_required');
  if (value.fairCatch.pendingContacts.length || value.fairCatch.pendingPossession.length || census.pendingPhysical.captures.length
    || census.pendingPhysical.throw || !last.field.motion.cursor || !last.field.motion.carrierPlayerId)
    return pending('live_contact_or_possession_consumer_required');
  const seal = [...fields].reverse().find(f => f.kind === 'same_pa_physical_field_step_v1'
    && f.actionResult?.kind !== 'defender_observation_v1' && f.actionResult?.kind !== 'defender_decision_v1'
    && f.actionResult?.kind !== 'defender_catch_response_v1' && f.actionResult?.kind !== 'batter_catch_response_v1'
    && f.actionResult?.kind !== 'occupied_runner_catch_response_v1'
    && f.actionResult?.kind !== 'defender_departure_purpose_v1');
  const boundary = deriveQuantizerClosedGenerationBoundary({ originTick: at.originTick, throughTick: at.tick, ticksPerSecond: p.ticksPerSecond });
  if (seal?.kind !== 'same_pa_physical_field_step_v1' || seal.source.action?.kind !== 'retained_quantizer_checkpoint_v1'
    || seal.actionResult?.kind !== 'retained_quantizer_checkpoint_v1' || seal.actionResult.status !== 'checkpoint_reached'
    || json(seal.actionResult.boundary) !== json(boundary) || at.elapsedSeconds !== boundary.lastIncludedElapsedSeconds
    || json(seal.field) !== json(last.field)) return pending('original_retained_quantizer_generation_required');
  if (census.participantCurves.some(c => c.roles.length !== 5 || c.coverageThroughTick <= at.tick)) return pending('actual_controller_coverage_required');
  if (census.observationRefresh.pending.some(w => w.due === 'due')) return pending('due_observation_refresh_consumer_required');
  if (census.defenderDecisions.pending.some(w => w.decisionDue === 'due' || w.movementDue === 'due')) return pending('due_defender_decision_or_adoption_required');
  if (census.catchResponses.pending.some(w => w.work.some(d => d.due === 'due') || w.response.replan.semantic !== 'ready'))
    return pending('received_controller_work_required');
  if ([...census.batterCatchResponses.pending, ...census.batterCatchResponses.adopted].some(r => r.work.some(w => w.due === 'due')))
    return pending('due_received_batter_controller_work_required');
  if ([...(census.occupiedRunnerCatchResponses?.pending ?? []), ...(census.occupiedRunnerCatchResponses?.adopted ?? [])].some(r => r.work.some(w => w.due === 'due')))
    return pending('due_received_occupied_runner_controller_work_required');
  if (census.runnerPlans.some(w => w.due === 'due' && w.status !== 'executed_through_planned_end' && w.status !== 'superseded_by_received_response')) return pending('due_original_runner_motion_required');
  // Every actual latest observation needs its own ordinary decision or a
  // response that consumed this exact observation. Merely reading it is not a
  // controller completion, including when a different actor already adopted.
  const latestObservations = new Map<string, typeof fields[number]>();
  for (const f of fields) if (f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'defender_observation_v1')
    latestObservations.set(f.actionResult.playerId, f);
  for (const [playerId, f] of latestObservations) {
    const ref = reference('pa_physical_v1_field_steps', f);
    if (![...census.defenderDecisions.pending, ...census.defenderDecisions.consumed].some(w => w.playerId === playerId && json(w.observationReference) === json(ref))
      && ![...census.catchResponses.pending, ...census.catchResponses.adopted].some(w => w.response.playerId === playerId
        && json(w.response.observationReference) === json(ref))) return pending('observed_actor_controller_consumer_required');
  }
  const ids = readSamePaOriginalParticipants(db, actor).map(p => p.binding.playerId), runnerIds = actor.world.runners.map(r => r.playerId);
  if (json(communication.recipients.map(r => r.playerId).sort()) !== json([...ids].sort())) throw new Error('fair catch end original recipient membership differs');
  if (!communication.emitted || communication.recipients.some(r => r.reception.kind === 'pending')) return pending('original_call_information_generation_required');
  for (const r of communication.recipients) {
    if (r.reception.kind === 'received' && r.controllerResponse.kind !== 'adopted')
      return pending(r.playerId === actor.binding.playerId ? 'received_batter_response_and_adoption_required'
        : runnerIds.includes(r.playerId) ? 'received_occupied_runner_response_and_adoption_required' : 'due_received_defender_adoption_required');
    if (r.reception.kind === 'scheduled' && r.reception.reception.receivedAtElapsedSeconds <= at.elapsedSeconds)
      return pending('due_received_information_consumer_required');
  }
  // Every original participant contributes real body/base history. Occupied
  // runners additionally require uninterrupted original-base history above.
  const bodyBaseHistories = ids.flatMap(playerId => (['home', 'first', 'second', 'third'] as const).map(base => {
    const bag = root.geometry.baseGeometry.bases[base], history = deriveBallWorldPlayerBaseContactHistory({
      segments: value.evidence.physical.segments, playerId, base: bag.region, baseSurfaceHeightMeters: bag.surfaceHeightMeters });
    if (history.endElapsedSeconds !== at.elapsedSeconds) throw new Error('fair catch end body/base generation coverage differs');
    return { playerId, base, history };
  }));
  if (bodyBaseHistories.some(h => h.playerId === actor.binding.playerId && h.history.events.some(e => e.elapsedSeconds > finalCatch.catchMoment.elapsedSeconds)))
    return pending('later_runner_base_rule_consumer_required');
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('fair catch end original admission prefix missing');
  const sources: LivePlaySource[] = [...(census.defenderDepartures?.sources ?? [])];
  const producer = (domain: string, playerId: string | null, futureTicks: readonly number[], extra: Partial<LivePlaySource> = {}) => {
    const sourceId = json([view.lineage.enrollmentReference.sourceId, view.cut.physicalPitchReference.sourceId, domain, playerId]);
    if (futureTicks.some(t => t <= at.tick)) throw new Error('fair catch end producer retains due work');
    sources.push({ sourceId, revision: 1, queue: { sourceId, settledThroughTick: at.tick, nextPendingTick: futureTicks.length ? Math.min(...futureTicks) : null },
      physical: [], intents: [], information: [], decisions: [], ruleWindows: [], ...extra });
  };
  for (const playerId of ids) {
    const curves = census.participantCurves.find(c => c.playerId === playerId)!;
    producer('body_motion', playerId, [curves.coverageThroughTick], { physical: [{ workId: json(['body', playerId]),
      kind: playerId === actor.binding.playerId || runnerIds.includes(playerId) ? 'runner_motion' : 'defender_motion', actorId: playerId,
      throughTick: curves.coverageThroughTick, actionKey: json(curves.roles.map(r => r.curveReference)) }] });
    const refresh = census.observationRefresh.pending.filter(w => w.playerId === playerId);
    producer('observation_scheduling', playerId, refresh.map(w => w.dueTick), { information: refresh.map(w => ({ workId: json(['refresh', playerId, w.causeSourceId]),
      kind: 'in_flight_information', actorId: playerId, dueTick: w.dueTick, causeEventId: w.causeSourceId })) });
    const decisions = census.defenderDecisions.pending.filter(w => w.playerId === playerId).flatMap(w => [w.decisionTick, w.movementStartTick]);
    const responses = census.catchResponses.pending.filter(w => w.response.playerId === playerId).flatMap(w => w.work.map(d => d.dueTick));
    const batterResponses = [...census.batterCatchResponses.pending, ...census.batterCatchResponses.adopted]
      .filter(w => w.response.playerId === playerId).flatMap(w => w.work.map(d => d.dueTick));
    const occupiedResponses = [...(census.occupiedRunnerCatchResponses?.pending ?? []), ...(census.occupiedRunnerCatchResponses?.adopted ?? [])]
      .filter(w => w.response.playerId === playerId).flatMap(w => w.work.map(d => d.dueTick));
    const plans = census.runnerPlans.filter(w => w.playerId === playerId && w.status === 'pending_motion').map(w => w.plannedThroughTick);
    producer('controller_renewal', playerId, [...decisions, ...responses, ...batterResponses, ...occupiedResponses, ...plans], { decisions: [...decisions, ...responses, ...batterResponses, ...occupiedResponses, ...plans].map((dueTick, index) => ({
      workId: json(['controller', playerId, index]), kind: 'actor_decision', actorId: playerId, dueTick })) });
  }
  producer('ball_and_contact_generation', null, []);
  producer('canonical_fair_catch_rule_consumption', null, []);
  producer('original_umpire_action', null, []);
  const scheduled = communication.recipients.flatMap(r => r.reception.kind === 'scheduled' ? [{ playerId: r.playerId, dueTick: r.reception.reception.received.receivedAt }] : []);
  producer('communication_ingress', null, scheduled.map(r => r.dueTick), { information: scheduled.map(r => ({ workId: json(['call', r.playerId]),
    kind: 'in_flight_information', actorId: r.playerId, dueTick: r.dueTick, causeEventId: work.originalInputs.action!.sourceId })) });
  if (occupied) {
    if (!live.sourceLocalPhases) throw new Error('fair catch end original phase ownership missing');
    if (json(live.sourceLocalPhases.originalFieldPrefix) !== json(census.originalFieldPrefix))
      throw new Error('fair catch end original phase prefix differs');
    // Local receipt completion never retires reusable producer domains. Every
    // declared successor must still have its independent source in this registry.
    for (const phase of live.sourceLocalPhases.phases) for (const successor of phase.successors) {
      const id = json([view.lineage.enrollmentReference.sourceId, view.cut.physicalPitchReference.sourceId, successor.domain, successor.playerId]);
      if (!sources.some(s => s.sourceId === id && s.completion === undefined)) throw new Error('fair catch end phase successor omitted');
    }
  }
  const request = { tick: at.tick, terminal: !occupied || work.operative.onFieldCall.ruling.outsAfter === 3 ? 'all_offense_terminal' as const : 'none' as const,
    actors: ids.map(actorId => ({ actorId, kind: 'acting' as const })) };
  // The additive read sidecar checks operation-local work without rewriting
  // existing v1 outcome archives. Their domain registry still retains every
  // successor and remains the persisted generation/watermark proof.
  if (occupied && resolveLivePlayRegistry(createLivePlayRegistry({ playId: view.lineage.playId, revision: 1,
    sources: [...sources, ...live.sourceLocalPhases!.sources] }), request).resolution.kind !== 'ended')
    return pending('occupied_live_producer_completion_required');
  const registry = resolveLivePlayRegistry(createLivePlayRegistry({ playId: view.lineage.playId, revision: 1, sources }), request);
  // A hold horizon is still an admitted finite command. For a non-third-out
  // occupied play, retain all future producers in the ordinary frontier until
  // their real completion owners exist; never manufacture cancellation here.
  if (registry.resolution.kind !== 'ended') return pending('occupied_live_producer_completion_required');
  const scoringEvidence = { originalTimeline: value.originalTimeline, field: value.evidence.physical.field, playEnd: registry.resolution.playEnd,
    ...(occupiedRunners?.kind === 'same_pa_stationary_occupied_runners_v1' ? { occupiedRunners } : {}) };
  const projected = projectActualFairFieldTimeline({ originalTimeline: scoringEvidence.originalTimeline, field: scoringEvidence.field, playEnd: scoringEvidence.playEnd });
  if (projected.kind !== 'projected') return pending('physical_catch_timeline_projection:' + projected.reason);
  return freeze({ kind: 'same_pa_fair_catch_physical_end_v1' as const, playEnd: registry.resolution.playEnd, exactEnd: at,
    physicalPitchReference: value.physicalPitchReference, physicalOperationReference: value.physicalOperationReference,
    catchWorkReference, originalMatch: value.originalMatch, operative: work.operative, registry,
    generation: { boundary, producerProfile: root.source.liveProducerProfile, producerRegistrationReference: reference('pa_physical_v1_field_roots', root),
      admissionPrefixReference: view.source.prefixReference, admissionJournalHash: hash(prefix.source.eventReferences),
      completeCoverageHash: view.coverageHash, censusHash: hash(census), producerIds: sources.map(s => s.sourceId),
      bodyBaseHistoryHashes: bodyBaseHistories.map(({ playerId, base, history }) => ({ playerId, base, hash: hash(history) })),
      ruleConsumption: { kind: 'owned_same_pa_fair_catch_rule_consumption_v1' as const, fieldReferences: value.fieldReferences,
        ruleEvidenceHash: value.evidenceHash, originalCallRuleViewReference: originalRule.value.viewReference,
        originalCallRuleEvidenceHash: originalRule.value.evidenceHash, applicability:'unchanged_original_fair_catch_no_new_contact_or_base_fact' as const,
        consumedAt: at, batterRunnerId: actor.binding.playerId },
      receivedControllerHandoffs: communication.recipients.flatMap(r => r.controllerResponse.kind === 'adopted'
        ? [{ playerId: r.playerId, responseReference: r.controllerResponse.evidence.responseReference,
          adoptionReference: r.controllerResponse.evidence.consumerReference, sealReference: reference('pa_physical_v1_field_steps', seal) }] : []) },
    ...(occupiedRunners?.kind === 'same_pa_stationary_occupied_runners_v1' ? { occupiedRunners } : {}), scoringEvidence, timeline: projected.timeline });
});
export type SamePaFairCatchPhysicalEnd = Extract<ReturnType<typeof deriveSamePaFairCatchEndFromSqlite>, { kind: 'same_pa_fair_catch_physical_end_v1' }>;
