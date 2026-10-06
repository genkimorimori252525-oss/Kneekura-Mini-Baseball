import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { BattedVenueFoulCountEvidence } from './BattedVenueFoulCountEvidenceFromSqlite';
import type { ActualLiveEventMoment, ActualLiveEventReference } from './ActualLivePlayQueueEvidenceFromSqlite';
import type { ActualSettledFoulStopCensus, ActualSettledFoulStopCensusQuery } from './ActualSettledFoulStopProducer';

/** Contract only. This new runtime policy must be accepted before field work;
 * an existing producer-only registration cannot be upgraded in place. */
export type AcceptedOriginalFoulRuleRuntime = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'causal_original_settled_foul_count_runtime_v1'; physicalPitchSourceId: string;
}>;
export type AcceptedActualFoulRuleConsumption = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_original_settled_foul_rule_consumption_v1';
  runtimeSourceId: string; stopProductionSourceId: string;
}>;
export type ActualFoulDisposition = Readonly<{ kind: 'pending_original_intent'; timeline: null }>
  | Readonly<{ kind: 'continue_same_pa' | 'terminal_strikeout'; timeline: CanonicalPlateAppearanceTimeline }>;
export type DurableActualFoulRuleConsumption = Readonly<{
  source: AcceptedActualFoulRuleConsumption; revision: 1; history: readonly [AcceptedActualFoulRuleConsumption];
  gameId: string; playId: number; physicalPitchSourceId: string; firstPhysicalPitchSourceId: string;
  scopeId: string; ownershipKey: string; runtimeReference: ActualLiveEventReference; producerReference: ActualLiveEventReference;
  countEvidence: BattedVenueFoulCountEvidence; disposition: ActualFoulDisposition;
  consumption: Readonly<{ kind: 'settled_foul_rule_consumption'; status: 'consumed'; receiptId: string;
    eventKey: string; successorKey: string; occurredAt: ActualLiveEventMoment;
    eventAvailableAt: ActualLiveEventMoment; availableAt: ActualLiveEventMoment;
    proofScope: 'one_original_untouched_foul_rule_consumer' }>;
  successor: Readonly<{ kind: 'settled_foul_disposition'; status: 'pending'; successorKey: string; basisReceiptId: string;
    pendingReason: 'original_batting_intent_missing' | 'physical_end_and_official_continuation_unowned'
      | 'physical_end_and_terminal_official_closure_unowned' }>;
}>;
export type ActualFoulRuleConsumerQuery = Readonly<{
  version: 'actual_foul_rule_consumers_v1'; runtimeSourceId: string; cut: ActualSettledFoulStopCensusQuery['cut'];
}>;
export type ActualFoulRuleConsumers = Readonly<{
  version: 'actual_foul_rule_consumers_v1'; producer: ActualSettledFoulStopCensus;
  acceptedConsumptions: readonly DurableActualFoulRuleConsumption[];
  successors: readonly Readonly<{ original: ActualSettledFoulStopCensus['successors'][number];
    consumption: DurableActualFoulRuleConsumption['consumption'] | null }>[];
  dispositionSuccessors: readonly DurableActualFoulRuleConsumption['successor'][];
  consumerCoverage: 'original_foul_consumer_claims_complete'; futureConsumptionSourceIds: readonly string[];
  generation: 'event_generation_coverage_pending'; physicalEnd: null; officialClosure: null; samePaResume: null;
}>;
