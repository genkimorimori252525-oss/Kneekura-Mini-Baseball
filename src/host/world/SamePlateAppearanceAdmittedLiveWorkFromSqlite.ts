import type { DatabaseSync } from 'node:sqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { readSamePaLiveWorkFromSqlite } from './SamePlateAppearanceLiveWorkFromSqlite';
import { readSamePaFieldRuleEvidenceWithInputsFromSqlite } from './SamePlateAppearanceFieldRuleEvidenceFromSqlite';
import { readSamePaLifecycleRecordFromSqlite, withSamePaLifecycleReadPhase } from './SamePlateAppearanceLifecycleFromSqlite';
import { readSamePaCatchWorkFromSqlite } from './SamePlateAppearanceCatchWorkFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { readBatterRunPlanFromSqlite } from './SqliteBatterRunPlanStore';

/** Complete current prefix ownership includes the accepted original call,
 * exact reception and actual sensory consumers. A sensory consumer alone is
 * not an issued controller response or an empty causal frontier. */
export const readSamePaAdmittedLiveWorkFromSqlite = (db: DatabaseSync, viewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>,
  mode: 'current' | 'historical') => withSamePaLifecycleReadPhase(db, () => {
  const live = readSamePaLiveWorkFromSqlite(db, viewReference, mode);
  if (live.kind !== 'same_pa_live_work_read_v1') return live;
  const pair = readSamePaFieldRuleEvidenceWithInputsFromSqlite(db, viewReference, mode);
  if (pair.kind !== 'same_pa_field_rule_read_pair_v1') throw new Error('same-PA live field pairing changed');
  const prefix = readSamePaLifecycleRecordFromSqlite(db, 'prefix', pair.view.source.prefixReference.sourceId);
  if (!prefix || prefix.kind !== 'same_pa_lifecycle_prefix') throw new Error('same-PA admitted work prefix missing');
  const calls = prefix.source.eventReferences.filter(r => r.owner === 'pa_catch_v1_work')
    .map(r => readSamePaCatchWorkFromSqlite(db, { ...r, owner: 'pa_catch_v1_work' }))
    .filter(w => json(w.physicalPitchReference) === json(live.physical.physicalPitchReference));
  const latest = calls.at(-1) ?? null;
  const at = live.census.originalFieldPrefix.at, ticksPerSecond = live.physical.evidence.physical.field.evidence.ticksPerSecond;
  const runnerPlans = prefix.source.eventReferences.filter(r => r.owner === 'world_batter_run_plans')
    .map(r => readBatterRunPlanFromSqlite(db, { ...r, owner: 'world_batter_run_plans' }))
    .filter(p => json(p.physicalPitchReference) === json(live.physical.physicalPitchReference)).map(plan => {
      const planReference = reference('world_batter_run_plans', plan);
      const executions = pair.fields.flatMap(f => f.kind === 'same_pa_physical_field_step_v1' && f.actionResult?.kind === 'batter_run_motion_v1'
        && json(f.actionResult.planReference) === json(planReference) ? [{ reference: reference('pa_physical_v1_field_steps', f),
          at: { originTick: f.field.motion.world.moment.originTick, elapsedSeconds: f.field.motion.world.moment.elapsedSeconds, tick: f.evaluationTick } }] : []);
      const superseded = live.census.batterCatchResponses.adopted.find(r => r.response.motionBasis.kind === 'runner_plan'
        && json(r.response.motionBasis.planReference) === json(planReference));
      const endElapsedSeconds = (plan.plan.timeline.endTick - at.originTick) / ticksPerSecond;
      const last = executions.at(-1);
      return { planReference, playerId: plan.playerId, personId: plan.personId, plannedThroughTick: plan.plan.timeline.endTick, executions,
        supersededBy: superseded ? { responseReference: superseded.responseReference, adoptionReference: superseded.consumerReference } : null,
        status: superseded ? 'superseded_by_received_response' as const : last && last.at.elapsedSeconds >= endElapsedSeconds ? 'executed_through_planned_end' as const : 'pending_motion' as const,
        due: at.elapsedSeconds >= endElapsedSeconds ? 'due' as const : 'future' as const };
    });
  const observations = pair.fields.flatMap(f => {
    if (f.kind !== 'same_pa_physical_field_step_v1' || f.actionResult?.kind !== 'defender_observation_v1' || !f.actionResult.catchCommunication) return [];
    const r = f.actionResult, c = r.catchCommunication!, owner = calls.find(w => json(reference('pa_catch_v1_work', w)) === json(c.workReference));
    if (!owner) throw new Error('same-PA received catch observation omitted its admitted original call');
    return c.result.kind === 'received' ? [{ playerId: r.playerId, observationReference: reference('pa_physical_v1_field_steps', f),
      workReference: c.workReference, actionSourceId: owner.originalInputs.action!.sourceId, receivedAt: c.result.receivedAt }] : [];
  });
  const recipients = latest?.communication.recipients.map(r => {
    const observed = observations.filter(o => o.playerId === r.playerId && o.actionSourceId === latest.originalInputs.action!.sourceId);
    const adopted = live.census.batterCatchResponses.adopted.find(a => a.response.playerId === r.playerId && a.response.callSourceId === latest.originalInputs.action!.sourceId)
      ?? live.census.catchResponses.adopted.find(a => a.response.playerId === r.playerId && a.response.replan.cause?.callSourceId === latest.originalInputs.action!.sourceId);
    const response = live.census.batterCatchResponses.pending.find(a => a.response.playerId === r.playerId && a.response.callSourceId === latest.originalInputs.action!.sourceId)
      ?? live.census.catchResponses.pending.find(a => a.response.playerId === r.playerId && a.response.replan.cause?.callSourceId === latest.originalInputs.action!.sourceId);
    return { playerId: r.playerId, reception: r, observations: observed,
      controllerResponse: adopted ? { kind: 'adopted' as const, evidence: adopted } : response ? { kind: 'pending' as const, evidence: response }
        : r.kind === 'dropped' ? { kind: 'not_triggered' as const, reason: 'call_not_recognized' }
        : { kind: 'pending' as const, reason: r.kind === 'received' ? 'received_catch_controller_response_required' : 'catch_information_not_received' } };
  }) ?? [];
  return freeze({ ...live, census: { ...live.census, runnerPlans,
    unownedDomains: latest ? ['controller_responses', 'producer_completeness', 'live_play_end'] as const : live.census.unownedDomains },
    communication: latest ? { kind: 'owned_same_pa_catch_communication_v1' as const,
    workReferences: calls.map(w => reference('pa_catch_v1_work', w)), latestReference: reference('pa_catch_v1_work', latest),
    emitted: latest.communication.emitted, operative: latest.operative, recipients, observations } : live.communication,
    closure: { kind: 'pending' as const, reasons: [...(!latest ? ['accepted_original_catch_action_missing'] : []),
      'original_controller_response_and_producer_frontier_required'], physicalEnd: null } });
});
