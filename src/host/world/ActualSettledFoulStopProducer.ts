import type { BattedVenueLegalEvidence, BattedVenueRawContactOrigin } from './BattedVenueLegalEvidenceFromSqlite';
import type { ActualLivePlayCut } from './ActualLivePlayScope';
import type { ActualLiveEventMoment, ActualLivePlayQueueEvidence, ActualLiveOwnedEvent, ActualLiveOwnedSuccessor } from './ActualLivePlayQueueEvidenceFromSqlite';

export type AcceptedOriginalSettledFoulRuntime = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'causal_original_settled_foul_runtime_v1'; physicalPitchSourceId: string;
}>;
export type AcceptedActualSettledFoulStopProduction = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_original_settled_foul_stop_producer_v1';
  physicalPitchSourceId: string; runtimeSourceId: string; policySourceId: string;
  baseFieldSourceId: string; executionSourceId: null;
}>;
export type DurableActualSettledFoulStopProduction = Readonly<{
  source: AcceptedActualSettledFoulStopProduction; revision: 1; history: readonly [AcceptedActualSettledFoulStopProduction];
  gameId: string; playId: number; physicalPitchSourceId: string; scopeId: string; ownershipKey: string; originalStopKey: string;
  runtimeReference: Readonly<{ owner: 'actual_live_play_runtimes'; sourceId: string; snapshotHash: string }>;
  basis: BattedVenueLegalEvidence;
  event: Readonly<{ eventKey: string; eventId: string; kind: 'settled_foul_stop'; originalStopKey: string;
    occurredAt: ActualLiveEventMoment; availableAt: ActualLiveEventMoment; stopOrigins: readonly BattedVenueRawContactOrigin[] }>;
  successor: Readonly<{ successorKey: string; localSourceId: string; basisEventKey: string;
    kind: 'foul_rule_evidence'; status: 'pending'; pendingReason: 'foul_rule_consumer_unowned' }>;
}>;
export type ActualSettledFoulStopCensusQuery = Readonly<{
  version: 'actual_settled_foul_stop_census_v1'; runtimeSourceId: string; cut: ActualLivePlayCut;
}>;
export type ActualSettledFoulStopCensus = Readonly<{
  version: 'actual_settled_foul_stop_census_v1'; base: ActualLivePlayQueueEvidence;
  producer: Readonly<{ producerId: string; domain: 'settled_foul_stop'; status: 'pending' | 'produced';
    sourceId: string | null; futureSourceIds: readonly string[] }>;
  events: readonly ActualLiveOwnedEvent[]; successors: readonly ActualLiveOwnedSuccessor[];
  coverage: 'original_foul_producer_claims_complete'; generation: 'event_generation_coverage_pending';
  closureFence: 'not_installed'; playEnd: null;
}>;
