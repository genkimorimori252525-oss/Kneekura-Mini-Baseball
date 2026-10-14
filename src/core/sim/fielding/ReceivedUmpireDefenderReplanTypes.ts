import type { OfficialGameplayRuling } from '../../adjudication/PlayAdjudicationLedger';
import type { Vec2 } from '../../model/geometry';
import type { ReceivedCommunication } from '../perception/Communication';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import type { DefensiveIntentCandidate, PrePlayDefensivePlan } from './DefensiveDecision';
import type { DefensiveDecisionTimingParameters } from './DefensiveDecisionTiming';
import type { DefenderFirstStepTimingParameters } from './DefenderFirstStepTiming';

export type ReceivedUmpireCallMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
export type ReceivedUmpireCallOrder = Readonly<{ sequenceOwnerSourceId: string; sequence: number }> | null;
export type LocalUmpireCallPriorities = Readonly<{ ballPursuitPriority: number; holdPriority: number }>;
export type ReceivedUmpireCallCause = Readonly<{
  physicalPitchSourceId: string; callSourceId: string; originCommunicationSourceId: string; playerId: string;
}>;
/** The existing first-base call payload is retained as information, never interpreted as physical truth. */
export type ReceivedUmpireCallContent = Readonly<{
  callSourceId: string; call: 'out' | 'safe'; calledAt: ReceivedUmpireCallMoment;
  onFieldCall: Readonly<{ callId: string; tick: number; basisSnapshotId: string; basisEvidenceRevision: number;
    ruling: Readonly<{ outsAfter: number; basesAfter: Readonly<{ first: string | null; second: null; third: null }>;
      scoredRunnerIds: readonly [] }> }>;
}>;
/** A caught batter OUT carries its original occupied bases. This is distinct
 * from the legacy first-base payload, whose second/third-base limits remain. */
export type ReceivedUmpireCaughtOutContent = Readonly<{
  callSourceId: string; call: 'out'; calledAt: ReceivedUmpireCallMoment;
  onFieldCall: Readonly<Omit<ReceivedUmpireCallContent['onFieldCall'], 'ruling'> & {
    ruling: OfficialGameplayRuling & Readonly<{ scoredRunnerIds: readonly [] }>;
  }>;
}>;
export type ReceivedUmpireCallReception<Content = ReceivedUmpireCallContent> = Readonly<{ kind: 'scheduled'; dueAt: ReceivedUmpireCallMoment }>
  | Readonly<{ kind: 'received'; receivedAt: ReceivedUmpireCallMoment; order: ReceivedUmpireCallOrder;
    received: ReceivedCommunication<Content> }>;
export type ReceivedUmpireCaughtOutReception = Extract<ReceivedUmpireCallReception<ReceivedUmpireCaughtOutContent>, { kind: 'received' }>;

/**
 * Internal rederived dependencies only. This is not a caller-accepted Source or proof
 * of Native ownership, physical execution, monotonic scheduler progress or persistence.
 */
export type ReceivedUmpireDefenderReplanInput<Content extends ReceivedUmpireCallContent | ReceivedUmpireCaughtOutContent = ReceivedUmpireCallContent> = Readonly<{
  processSourceId: string; physicalPitchSourceId: string; playerId: string; receiverRole: 'defender' | 'batter';
  ticksPerSecond: number; currentCut: ReceivedUmpireCallMoment;
  communication: Readonly<{ sourceId: string; hash: string; originCommunicationSourceId: string; callSourceId: string }>;
  observation: Readonly<{ sourceId: string; hash: string; at: ReceivedUmpireCallMoment;
    perceived: PlayerPerceivedWorldState<null>; reception: ReceivedUmpireCallReception<Content> }>;
  predecessor: Readonly<{
    originDecisionSourceId: string; originObservationSourceId: string; originObservationHash: string;
    availability: ReceivedUmpireCallMoment; informationOrder: ReceivedUmpireCallOrder;
    observationSourceId: string; observationHash: string; observedThrough: ReceivedUmpireCallMoment;
    decisionTick: number; issuedAt: ReceivedUmpireCallMoment;
    command: Readonly<{ sourceId: string; hash: string; selected: DefensiveIntentCandidate; target: Vec2 | null }>;
    motor: Readonly<{ sourceId: string; hash: string; adoptionSourceId: string | null; adoptedAt: ReceivedUmpireCallMoment | null }>;
  }>;
  model: Readonly<{ sourceId: string; hash: string; situationalAwareness: number; firstStepAbility: number;
    minimumCueConfidence: number; communicationTrust: number;
    decisionTimingParameters: DefensiveDecisionTimingParameters; firstStepTimingParameters: DefenderFirstStepTimingParameters }>;
  contextualPlan: Readonly<{ sourceId: string; hash: string; priorities: PrePlayDefensivePlan }>;
  policy: Readonly<{ sourceId: string; hash: string; availableAt: ReceivedUmpireCallMoment;
    profiles: Readonly<{ out: LocalUmpireCallPriorities | null; safe: LocalUmpireCallPriorities | null }> }> | null;
  previous: ReceivedUmpireDefenderReplan<Content> | null;
}>;
export type ReceivedUmpireDefenderOriginEvidence<Content extends ReceivedUmpireCallContent | ReceivedUmpireCaughtOutContent = ReceivedUmpireCallContent> = Readonly<Pick<ReceivedUmpireDefenderReplanInput<Content>,
  'physicalPitchSourceId' | 'playerId' | 'receiverRole' | 'ticksPerSecond' | 'communication' | 'observation' | 'model' | 'contextualPlan'> & {
  predecessor: Pick<ReceivedUmpireDefenderReplanInput['predecessor'],
    'originDecisionSourceId' | 'originObservationSourceId' | 'originObservationHash' | 'availability' | 'informationOrder' | 'command' | 'motor'>;
}>;
export type ReceivedUmpireDefenderPolicyBinding = Readonly<{
  policy: NonNullable<ReceivedUmpireDefenderReplanInput['policy']>; boundAt: ReceivedUmpireCallMoment;
}>;
export type ReceivedUmpireDefenderReplan<Content extends ReceivedUmpireCallContent | ReceivedUmpireCaughtOutContent = ReceivedUmpireCallContent> = Readonly<{
  processSourceId: string; cause: ReceivedUmpireCallCause | null;
  originEvidence: ReceivedUmpireDefenderOriginEvidence<Content> | null; policyBinding: ReceivedUmpireDefenderPolicyBinding | null;
  trigger: 'no_new_trigger' | 'communication_received';
  semantic: 'ready' | 'call_profile_unavailable' | 'receiver_role_unavailable' | 'intent_adapter_unavailable'
    | 'predecessor_work_pending' | 'same_moment_order_unavailable';
  phase: 'pending_decision' | 'semantic_pending' | 'pending_first_step' | 'renewal_due' | 'missed_commitment' | null;
  originObservationSourceId: string | null; receivedAt: ReceivedUmpireCallMoment | null; availableAt: ReceivedUmpireCallMoment | null;
  scheduling: Readonly<{ startedAtTick: number; decisionDelayTicks: number; decisionTick: number;
    firstStepDelayTicks: number | null; movementStartTick: number | null }> | null;
  candidates: readonly DefensiveIntentCandidate[];
  /** A proposal is not an issued decision until selectedAt records the exact cognition boundary. */
  selected: DefensiveIntentCandidate | null; selectedAt: ReceivedUmpireCallMoment | null; target: Vec2 | null;
  retainedCommand: ReceivedUmpireDefenderReplanInput['predecessor']['command'];
  work: readonly Readonly<{ kind: 'decision' | 'intent' | 'renewal_adoption'; sourceId: string; cause: ReceivedUmpireCallCause; dueTick: number }>[];
}>;
