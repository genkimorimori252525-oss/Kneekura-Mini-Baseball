import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { OfficialStateApplicationReceipt } from '../../core/adjudication/NextPlayActivation';
import type { PlayerWorkloadActivity, PlayerWorkloadRecoveryState } from '../../core/world/development/PlayerWorkloadRecovery';
import type { SamePaExecutionLineage, SamePaReference } from './SamePlateAppearanceWorkPrefix';

/** Immutable final basis. Its Native proof stops before settlement/transition;
 * later completion cannot change this endpoint's Source or snapshot identity. */
export type AcceptedSamePaTerminalEndpoint = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'same_pa_terminal_endpoint_v1';
  enrollmentReference: SamePaReference<'same_pa_enrollments'>;
  finalViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  outcomeReference: SamePaReference<'pa_lifecycle_v1_outcomes'>;
}>;
export type SamePaTerminalParticipant = Readonly<{
  playerId: string; totalReference: SamePaReference<'pa_lifecycle_v1_total_assessments'>;
  reservedState: PlayerWorkloadRecoveryState; activity: PlayerWorkloadActivity;
  projectedState: PlayerWorkloadRecoveryState; projectedStateHash: string;
}>;
export type SamePaTerminalEndpoint = Readonly<{
  kind: 'same_pa_terminal_endpoint_v1'; source: AcceptedSamePaTerminalEndpoint;
  lineage: SamePaExecutionLineage; enrollmentReference: SamePaReference<'same_pa_enrollments'>;
  finalViewReference: SamePaReference<'pa_lifecycle_v1_execution_views'>;
  outcomeReference: SamePaReference<'pa_lifecycle_v1_outcomes'>;
  gameDay: number; coverageHash: string; timeline: CanonicalPlateAppearanceTimeline;
  participants: readonly SamePaTerminalParticipant[];
  actor: import('./PhysicalPlateAppearanceActorEvidenceFromSqlite').DurablePhysicalPlateAppearanceActor;
  officialLedger: import('../../core/adjudication/PlayAdjudicationLedger').PlayAdjudicationLedger;
  context: import('../../core/adjudication/NonLiveOfficialApplication').NonLiveOfficialContext;
  physicalCompletedAtTick: number;
  controllerRetirementBasis: import('./SamePlateAppearanceLifecycleOutcome').SamePaControllerRetirementBasis;
  baseCenters: import('../../core/adjudication/BetweenPlayWorldReset').BetweenPlayWorldSetup['baseCenters'];
}>;

/** Native proof view, separately authenticated after ten settled effects. The
 * transition reader consumes only the settlement proof, never the release. */
export type SamePaTerminalTransitionProof = Readonly<{
  kind: 'completed'; reference: SamePaReference<'pa_terminal_v1_transitions'>;
  terminalReference: SamePaReference<'pa_terminal_v1_endpoints'>;
  settlementReference: SamePaReference<'pa_settlement_v1_plans'>;
  gameId: string; playId: number; durableRevision: number;
  resultingMatch: CanonicalMatchState; officialReceipt: OfficialStateApplicationReceipt;
  completion: 'next_play' | 'half_inning' | 'game_final';
}>;
export type SamePaTerminalTransitionRead = SamePaTerminalTransitionProof | Readonly<{
  kind: 'pending'; reason: 'terminal_transition_missing'; terminalReference: SamePaReference<'pa_terminal_v1_endpoints'>;
}>;
export type SamePaTerminalProofMode = 'current' | 'historical';
