import { expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import type { ActualObservationMoment } from './ActualFieldObservation';
import type { DurableActualFoulRuleConsumption } from './ActualFoulRuleConsumption';
import type { CanonicalWholePlayHistory } from '../../core/sim/plateAppearance/CanonicalWholePlayHistory';
import type { QuantizerClosedGenerationBoundary } from '../../core/sim/liveAction/QuantizerClosedGenerationBoundary';
import type { LivePlayRegistryResolution } from '../../core/sim/liveAction/LivePlayRegistry';
import type { PlayEndFact } from '../../core/rules/PhysicalRuleFacts';

/** Proposed test-only API. The existing production namespace must acquire real
 * exports; this seam neither supplies a missing stub nor derives end evidence. */
export type FoulEndSource = Readonly<{ sourceId: string; sourceVersion: string;
  capability: 'actual_original_settled_foul_play_end_v1'; ruleConsumptionSourceId: string;
  baseFieldSourceId: string; executionSourceId: string }>;
export type FoulOwnerReference = Readonly<{ owner: string; sourceId: string; sourceHash: string; snapshotHash: string }>;
/** Canonical original-scope evidence. An absent owner and an installed owner
 * without scoped claims have the same semantic census; schema checks stay separate. */
export type FoulOwnerCensusEntry = Readonly<{ owner: string; references: readonly FoulOwnerReference[];
  heads: readonly Readonly<{ owner: string; rows: readonly Readonly<Record<string, unknown>>[] }>[] }>;
type PhysicalScope = Readonly<{ kind: 'physical_live_episode'; gameId: string; playId: number;
  physicalPitchSourceId: string; runtimeSourceId: string; scopeId: string }>;
type OfficialScope = Readonly<{ kind: 'post_play_official_disposition'; gameId: string; playId: number;
  physicalPitchSourceId: string; runtimeSourceId: string; scopeId: string; firstPhysicalPitchSourceId: string;
  consumptionReference: FoulOwnerReference }>;
export type FoulDispositionObligations = Readonly<{ version: 'actual_foul_disposition_obligations_v1';
  consumptionReference: FoulOwnerReference; original: DurableActualFoulRuleConsumption['successor'];
  physical: Readonly<{ obligationKey: string; originalSuccessorKey: string; scope: PhysicalScope;
    causedAt: ActualObservationMoment; throughTick: number }>;
  official: Readonly<{ obligationKey: string; originalSuccessorKey: string; scope: OfficialScope;
    status: 'pending'; consumer: null; pendingReason: 'official_continuation_unowned' | 'terminal_official_closure_unowned' | 'original_batting_intent_missing';
    causedAt: ActualObservationMoment; eligibleAfterPhysicalEndAt: ActualObservationMoment }> }>;
export type FoulPhysicalAcknowledgement = Readonly<{ version: 'actual_foul_physical_end_acknowledgement_v1';
  acknowledgementId: string; originalSuccessorKey: string; obligationKey: string; scope: PhysicalScope; status: 'consumed';
  consumer: Readonly<{ owner: 'actual_foul_play_ends'; sourceId: string; sourceVersion: string; sourceHash: string }>;
  basisReceiptId: string; physicalProofHash: string; causedAt: ActualObservationMoment; consumedAt: ActualObservationMoment }>;
export type FoulPreCorePhysicalProof = Readonly<{ version: 'actual_foul_pre_core_physical_proof_v1';
  runtimeReference: FoulOwnerReference; policyReference: DurableActualFoulRuleConsumption['countEvidence']['basis']['policyReference'];
  stopReference: FoulOwnerReference; consumptionReference: FoulOwnerReference;
  physicalCut: Readonly<{ baseFieldSourceId: string; executionSourceId: string }>;
  boundary: QuantizerClosedGenerationBoundary; admissionJournalHash: string;
  ownerCensus: readonly FoulOwnerCensusEntry[]; ownerCensusHash: string;
  domainProofs: readonly Readonly<{ producerId: string; domain: string; playerId: string | null;
    status: 'physical_dependencies_proved'; through: ActualObservationMoment; premises: Readonly<Record<string, unknown>>;
    consumed: readonly Readonly<{ cause: string; consumer: string }>[]; futureWorkKeys: readonly string[] }>[];
  bodyBaseHistoryHashes: readonly Readonly<{ playerId: string; base: string; hash: string }>[] }>;
export type FoulEndedEvidence = Readonly<{ source: FoulEndSource; kind: 'ended'; revision: 1; history: readonly [FoulEndSource];
  gameId: string; playId: number; physicalPitchSourceId: string; firstPhysicalPitchSourceId: string; scopeId: string;
  exactEnd: ActualObservationMoment; playEnd: PlayEndFact; wholeHistory: CanonicalWholePlayHistory; wholeHistoryHash: string;
  wholeHistoryHashConvention: 'owned_scheduled_whole_history_manifest_v1';
  preCorePhysicalProof: FoulPreCorePhysicalProof; physicalProofHash: string;
  dispositionObligations: FoulDispositionObligations; physicalAcknowledgement: FoulPhysicalAcknowledgement;
  registry: LivePlayRegistryResolution;
  generation: Readonly<{ producerIds: readonly string[]; admissionJournalHash: string;
    consumed: readonly Readonly<{ cause: string; consumer: string }>[];
    physicalRuleProjection: Readonly<{ producerId: string; physicalObligationKey: string;
      acknowledgementId: string; remainingOfficialObligationKey: string }> }>;
  futureWork: Readonly<{ controllers: readonly Readonly<{ playerId: string; sourceId: string; dueTick: number }>[] }>;
  pending: Readonly<{ officialDisposition: FoulDispositionObligations['official'];
    controllerRetirement: 'unowned'; workloadSettlement: 'unowned'; reset: 'unowned'; samePaResume: 'unowned' }> }>;
export type FoulEndEvaluation = FoulEndedEvidence | Readonly<{ source: FoulEndSource; kind: 'pending';
  playEnd: null; pendingReasons: readonly string[] }>;
export type FoulEndStore = Readonly<{ evaluate(sourceId: string): FoulEndEvaluation;
  accept(sourceId: string): FoulEndedEvidence; read(sourceId: string): FoulEndedEvidence | null; close(): void }>;
export type FoulEndModule = Readonly<{
  openSqliteActualFoulPlayEndStore(path: string, authority?: Readonly<{
    readAcceptedEnd(sourceId: string): FoulEndSource | null;
  }>): FoulEndStore;
  actualFoulClosedEvidenceFromSqlite(db: DatabaseSync): Readonly<{ read(sourceId: string): FoulEndedEvidence | null }>;
  actualFoulEndArchiveEncoding(value: FoulEndedEvidence): Readonly<{ json: string; hash: string }>;
}>;
export const requireFoulEndOpener = (namespace: unknown): FoulEndModule['openSqliteActualFoulPlayEndStore'] => {
  const open = (namespace as Partial<FoulEndModule>).openSqliteActualFoulPlayEndStore;
  expect(typeof open).toBe('function');
  return open!;
};
export const requireFoulClosedReader = (namespace: unknown): FoulEndModule['actualFoulClosedEvidenceFromSqlite'] => {
  const read = (namespace as Partial<FoulEndModule>).actualFoulClosedEvidenceFromSqlite;
  expect(typeof read).toBe('function'); return read!;
};
export const requireFoulEndEncoding = (namespace: unknown): FoulEndModule['actualFoulEndArchiveEncoding'] => {
  const encode = (namespace as Partial<FoulEndModule>).actualFoulEndArchiveEncoding;
  expect(typeof encode).toBe('function'); return encode!;
};
