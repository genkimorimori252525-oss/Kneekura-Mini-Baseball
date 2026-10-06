import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayFields as fields, actualLivePlayId as id, type ActualLivePlayScope } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type AcceptedActualLivePlayRuntime = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'causal_original_live_play_runtime_v1' | 'causal_original_settled_foul_runtime_v1'
    | 'causal_original_settled_foul_count_runtime_v1' | 'causal_original_settled_foul_end_runtime_v1'; physicalPitchSourceId: string }>;
export const actualLivePlayRuntimeInput = (raw: AcceptedActualLivePlayRuntime, sourceId: string): AcceptedActualLivePlayRuntime => {
  const s = cloneInert(raw);
  if (!fields(s, ['sourceId', 'sourceVersion', 'capability', 'physicalPitchSourceId']) || s.sourceId !== sourceId
    || !['causal_original_live_play_runtime_v1', 'causal_original_settled_foul_runtime_v1',
      'causal_original_settled_foul_count_runtime_v1', 'causal_original_settled_foul_end_runtime_v1'].includes(s.capability)
    || ![s.sourceId, s.sourceVersion, s.physicalPitchSourceId].every(id)) {
    throw new Error('invalid causal actual live-play runtime Source');
  }
  return freeze(s);
};
/** Membership is the original capability manifest, never a set of discovered rows.
 * Observation is instantaneous unless an actual causal sample owner has initiated
 * refresh work; command exhaustion is a real trigger, not a periodic policy. */
export const deriveActualLiveRuntimeMembership = (scope: ActualLivePlayScope) => freeze({
  scopeId: scope.scopeId, participants: scope.participants.map(p => ({ playerId: p.playerId, personId: p.personId, role: p.role })),
  producers: scope.producers.map(p => ({ producerId: p.producerId, domain: p.domain, playerId: p.playerId })),
  admissionPolicy: 'same_transaction_original_source_ingress_v1' as const,
  observationPolicy: 'causally_initiated_samples_only_v1' as const,
  controllerPolicy: 'real_command_exhaustion_and_owned_decision_triggers_v1' as const,
  liveRulePolicy: 'supported_empty_base_ground_first_base_v1' as const,
});
/** Explicitly enrolled before field work. The added producer owns only the
 * original untouched settled-foul stop; count application and play closure
 * remain separate consumers. The legacy membership retains its exact shape. */
export const deriveOriginalSettledFoulRuntimeMembership = (scope: ActualLivePlayScope) => {
  const original = deriveActualLiveRuntimeMembership(scope);
  return freeze({ ...original, version: 'original_settled_foul_membership_v1' as const,
    liveRulePolicy: 'untouched_settled_foul_producer_only_v1' as const,
    producers: [...original.producers, {
      producerId: JSON.stringify(['actual_settled_foul_stop_producer_v1', original.scopeId]),
      domain: 'settled_foul_stop' as const, playerId: null,
    }],
  });
};
/** Pre-work opt-in to the existing declared rule-consumption domain. This keeps
 * every original producer identity and does not certify an implemented consumer,
 * complete generation, physical end, official consequence or same-PA admission. */
export const deriveOriginalSettledFoulCountRuntimeMembership = (scope: ActualLivePlayScope) => freeze({
  ...deriveOriginalSettledFoulRuntimeMembership(scope), version: 'original_settled_foul_count_membership_v1' as const,
  liveRulePolicy: 'untouched_settled_foul_count_consumption_v1' as const,
});
/** Separate pre-work enrollment for the bounded original dead-ball terminal
 * proof. Registration retains all 71 producer identities; it does not itself
 * establish complete generation, a physical end, official closure or resume. */
export const deriveOriginalSettledFoulEndRuntimeMembership = (scope: ActualLivePlayScope) => freeze({
  ...deriveOriginalSettledFoulCountRuntimeMembership(scope), version: 'original_settled_foul_end_membership_v1' as const,
  liveRulePolicy: 'untouched_settled_foul_end_v1' as const,
});
export type DurableActualLivePlayRuntime = Readonly<{ source: AcceptedActualLivePlayRuntime;
  gameId: string; playId: number; originalPitchHash: string;
  membership: ReturnType<typeof deriveActualLiveRuntimeMembership> | ReturnType<typeof deriveOriginalSettledFoulRuntimeMembership>
    | ReturnType<typeof deriveOriginalSettledFoulCountRuntimeMembership> | ReturnType<typeof deriveOriginalSettledFoulEndRuntimeMembership> }>;
