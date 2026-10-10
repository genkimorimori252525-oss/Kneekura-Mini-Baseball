import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type AcceptedActualFirstBasePlayEnd = Readonly<{ sourceId: string; sourceVersion: string; runtimeSourceId: string;
  baseFieldSourceId: string; executionSourceId: string; ruleConsumptionSourceId: string; umpireCallSourceId: string;
  communicationSourceId: string }>;
export const actualFirstBasePlayEndInput = (raw: AcceptedActualFirstBasePlayEnd, sourceId: string): AcceptedActualFirstBasePlayEnd => {
  const value = cloneInert(raw);
  if (!fields(value, ['sourceId', 'sourceVersion', 'runtimeSourceId', 'baseFieldSourceId', 'executionSourceId',
    'ruleConsumptionSourceId', 'umpireCallSourceId', 'communicationSourceId']) || value.sourceId !== sourceId
    || !Object.values(value).every(id)) throw new Error('invalid actual first-base PlayEnd Source');
  return freeze(value);
};
export type ActualFirstBaseEndedEvidence = Readonly<{
  source: AcceptedActualFirstBasePlayEnd; kind: 'ended'; gameId: string; playId: number; physicalPitchSourceId: string;
  scopeId: string; exactEnd: import('./ActualFieldObservation').ActualObservationMoment;
  playEnd: import('../../core/rules/PhysicalRuleFacts').PlayEndFact;
  wholeHistory: import('../../core/sim/plateAppearance/CanonicalWholePlayHistory').CanonicalWholePlayHistory;
  wholeHistoryHash: string; wholeHistoryHashConvention: 'owned_scheduled_whole_history_manifest_v1';
  physicalPrefixReference: ReturnType<typeof import('./ActualObservationPhysicalPrefixHash').actualObservationPhysicalPrefixEvidence>;
  finalRuleReference: Readonly<{ owner: 'batted_world_field_executions'; sourceId: string; snapshotHash: string }>;
  operativeCallReferences: NonNullable<ReturnType<ReturnType<typeof import('./SqliteActualFirstBaseUmpireStore').actualFirstBaseUmpireEvidenceFromSqlite>['importReferences']>>;
  operativeRetirement: Extract<import('./ActualFirstBaseUmpire').ActualFirstBaseOffensiveDisposition, { kind: 'retired' }>;
  firstBaseEvidenceApplicability: Readonly<{
    version: 'owned_first_base_evidence_applicability_v1'; ownerSourceId: string;
    rule: import('../../core/adjudication/PlayAdjudicationLedger').OwnedLiveCallSourceReference;
    call: import('../../core/adjudication/PlayAdjudicationLedger').OwnedLiveCallSourceReference;
    perception: import('../../core/adjudication/PlayAdjudicationLedger').OwnedLiveCallSourceReference;
    ruleEvidenceRevision: number; from: import('./ActualFieldObservation').ActualObservationMoment;
    through: import('./ActualFieldObservation').ActualObservationMoment;
    physicalCut: Readonly<{ baseFieldSourceId: string; executionSourceId: string }>;
    physicalPrefixReference: ReturnType<typeof import('./ActualObservationPhysicalPrefixHash').actualObservationPhysicalPrefixEvidence>;
    physicalSuffix: readonly import('../../core/adjudication/PlayAdjudicationLedger').OwnedLiveCallSourceReference[];
    bodyBaseHistoryHashes: readonly Readonly<{ playerId: string; base: string; hash: string }>[];
    coverage: 'no_new_rule_relevant_physical_or_base_facts';
    fence: Readonly<{ owner: 'actual_first_base_play_ends'; sourceId: string }>;
  }>;

  receivedControllerExtension?: import('./ActualReceivedUmpireTerminalCoverage').ReceivedControllerExtension;
  registry: import('../../core/sim/liveAction/LivePlayRegistry').LivePlayRegistryResolution;
  generation: Readonly<{ boundary: import('../../core/sim/liveAction/QuantizerClosedGenerationBoundary').QuantizerClosedGenerationBoundary;
    admissionJournalHash: string; producerIds: readonly string[]; consumed: readonly Readonly<{ cause: string; consumer: string }>[];
    bodyBaseHistoryHashes: readonly Readonly<{ playerId: string; base: string; hash: string }>[] }>;
  futureWork: import('./ActualLiveFutureControllerWork').ActualLiveFutureControllerWork & Readonly<{ observations: readonly Readonly<{ playerId: string; sourceId: string; dueTick: number }>[];
    controllers: readonly Readonly<{ playerId: string; sourceId: string; dueTick: number }>[];
    communication: readonly Readonly<{ playerId: string; dueTick: number; dueElapsedSeconds: number }>[] }>;
}>;
export type ActualFirstBasePlayEndEvidence = ActualFirstBaseEndedEvidence
  | Readonly<{ source: AcceptedActualFirstBasePlayEnd; kind: 'pending'; playEnd: null; pendingReasons: readonly string[] }>;
