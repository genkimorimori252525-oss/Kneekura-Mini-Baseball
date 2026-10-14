import { expect } from 'vitest';
import type { PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import type { ActualLiveOfficialPolicy } from './ActualLiveAdjudicationSource';
import type { FoulEndedEvidence, FoulOwnerReference } from './ActualFoulPlayEnd';
import type { DurableActualFoulRuleConsumption } from './ActualFoulRuleConsumption';

export type FoulOfficialEndReference = FoulOwnerReference & Readonly<{ owner: 'actual_foul_play_ends'; sourceVersion: string }>;
export type AcceptedFoulOfficialSession = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_foul_official_session_v1';
  physicalEndReference: FoulOfficialEndReference;
  assignment: Readonly<{ sourceId: string; sourceVersion: string; gameId: string; playId: number;
    physicalPitchSourceId: string; officialIds: readonly string[]; schedulerId: string;
    clock: 'post_play_discrete_tick_v1'; openingTrigger: 'sealed_foul_physical_end' }>;
  officialPolicy: ActualLiveOfficialPolicy | null;
}>;
export type AcceptedFoulOfficialIntent = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_foul_official_intent_v1';
  sessionSourceId: string; gameId: string; playId: number; physicalPitchSourceId: string;
  assignmentSourceId: string; officialId: string; judgment: 'foul' | 'fair';
}>;
export type AcceptedFoulOfficialEvent = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_post_play_foul_official_event_v1';
  sessionSourceId: string; expectedRevision: number; parent: Readonly<{ sourceId: string; snapshotHash: string }>;
  action: Readonly<{ kind: 'record_call'; intentSourceId: string }>
    | Readonly<{ kind: 'advance_tick' | 'next_pitch_fence'; schedulerId: string }>;
}>;
export type FoulOfficialHandoff = Readonly<{
  version: 'actual_foul_official_count_handoff_v1'; acknowledgementId: string;
  obligationKey: string; originalSuccessorKey: string;
  scope: FoulEndedEvidence['dispositionObligations']['official']['scope']; status: 'consumed';
  consumer: Readonly<{ owner: 'actual_foul_official_handoffs'; sourceId: string; sourceHash: string }>;
  physicalEndReference: FoulOfficialEndReference; consumptionReference: FoulOwnerReference;
  assignmentSourceHash: string; intentSourceHash: string; officialLedgerHash: string;
  composedTimelineHash: string; acceptedAtTick: number;
}>;
export type FoulOfficialProjection = Readonly<{
  source: AcceptedFoulOfficialSession; revision: number; headSourceId: string; headHash: string;
  gameId: string; playId: number; firstPhysicalPitchSourceId: string; physicalPitchSourceId: string;
  consumptionReference: FoulOwnerReference; officialObligation: FoulEndedEvidence['dispositionObligations']['official'];
  cursor: Readonly<{ originTick: number; ticksPerSecond: number; openingTick: number;
    openingElapsedSeconds: number; tick: number; offsetTicks: number }>;
  ledger: PlayAdjudicationLedger; callIntent: AcceptedFoulOfficialIntent | null;
  officialCount: DurableActualFoulRuleConsumption['disposition'] | null;
  kind: 'official_pending' | 'ordinary_foul_handoff_ready' | 'terminal_foul_application_pending';
  pendingReasons: readonly string[]; handoff: FoulOfficialHandoff | null;
}>;
export type FoulOfficialStore = Readonly<{
  acceptSession(sourceId: string): FoulOfficialProjection | Readonly<{
    kind: 'intake_pending'; sourceId: string; pendingReasons: readonly string[];
  }>;
  acceptEvent(sourceId: string): FoulOfficialProjection;
  readCurrent(sessionSourceId: string): FoulOfficialProjection | null;
  readAt(sessionSourceId: string, revision: number): FoulOfficialProjection | null;
  close(): void;
}>;
export type FoulOfficialModule = Readonly<{
  deriveFoulOfficialOpeningClock(input: Readonly<{ originTick: number; throughTick: number; ticksPerSecond: number }>): FoulOfficialProjection['cursor'];
  openSqliteActualFoulOfficialStore(path: string, authority?: Readonly<{
    readAcceptedSession(sourceId: string): unknown;
    readAcceptedEvent(sourceId: string): unknown;
    readAcceptedIntent(sourceId: string): unknown;
  }>): FoulOfficialStore;
}>;
export const requireFoulOfficialOpener = (namespace: unknown): FoulOfficialModule['openSqliteActualFoulOfficialStore'] => {
  const opener = (namespace as Partial<FoulOfficialModule>).openSqliteActualFoulOfficialStore;
  expect(typeof opener).toBe('function');
  return opener!;
};
