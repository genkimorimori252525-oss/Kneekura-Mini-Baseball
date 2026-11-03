import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { TeamCoveragePlan, TeamCoverageAssignment } from '../../core/sim/fielding/TeamCoveragePlan';
import type { DefensiveIntentCandidate } from '../../core/sim/fielding/DefensiveDecision';
import type { ActualFieldObservationReceipt } from './ActualFieldObservation';
import type { DefensiveCandidateCalculationV1 } from './DefensiveCandidateCalculationV1';
import type { SamePaDefensiveSupportGeometry } from './SamePlateAppearanceDefensiveSupportGeometry';
import type { deriveSamePaDefensiveSupportGeometry } from './SamePlateAppearanceDefensiveSupportGeometry';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaFields, samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { actorFreeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

type StepReference = SamePaReference<'pa_physical_v1_field_steps'>;
export type SamePaDefensiveCandidateActionV1 =
  | Readonly<{ kind: 'defender_candidate_set_v1'; originalDecisionReference: StepReference }>
  | Readonly<{ kind: 'defender_team_selection_v1'; candidateReferences: readonly StepReference[]; requireBallHandler: boolean }>
  | Readonly<{ kind: 'defender_actor_selection_v1'; teamSelectionReference: StepReference; member: SamePaDispatchMember }>;
/** These are metadata Sources, never a motor, possession or official result. */
export type SamePaDefensiveCandidateSetResultV1 = Readonly<{
  kind: 'defender_candidate_set_v1'; playerId: string; registeredPosition: TeamCoverageAssignment['registeredPosition'];
  member: SamePaDispatchMember; originalDecisionReference: StepReference; observationReference: StepReference;
  calibrationReference: SamePaReference<'pa_lifecycle_v1_execution_calibrations'>;
  calculation: DefensiveCandidateCalculationV1; availability: ActualFieldObservationReceipt['at'];
  fieldingModelHash: string; effectiveDecisionValuesHash: string;
  supportRequest: SamePaDefensiveSupportGeometry | null;
  supportGeometry: ReturnType<typeof deriveSamePaDefensiveSupportGeometry> | null;
  movementAdmission: false;
}>;
export type SamePaDefensiveTeamSelectionResultV1 = Readonly<{
  kind: 'defender_team_selection_v1'; candidateReferences: readonly StepReference[]; requireBallHandler: boolean;
  plan: TeamCoveragePlan; availability: ActualFieldObservationReceipt['at']; movementAdmission: false;
}>;
export type SamePaDefensiveActorSelectionResultV1 = Readonly<{
  kind: 'defender_actor_selection_v1'; playerId: string; member: SamePaDispatchMember;
  teamSelectionReference: StepReference; candidateReference: StepReference; originalDecisionReference: StepReference;
  observationReference: StepReference; assignment: TeamCoverageAssignment; candidate: DefensiveIntentCandidate; candidateIndex: number;
  scheduling: DefensiveCandidateCalculationV1['scheduling']; target: Readonly<{ x: number; z: number }> | null;
  availability: ActualFieldObservationReceipt['at']; fieldingModelHash: string; movementAdmission: false;
}>;
export type SamePaDefensiveCandidateActionResultV1 = SamePaDefensiveCandidateSetResultV1 | SamePaDefensiveTeamSelectionResultV1 | SamePaDefensiveActorSelectionResultV1;
export const samePaDefensiveCandidateSourceV1Input = (raw: unknown): SamePaDefensiveCandidateActionV1 => {
  const copied = cloneInert(raw); const fail = () => { throw new Error('invalid same-PA defensive candidate Source v1'); };
  if (!copied || typeof copied !== 'object' || !('kind' in copied)) return fail();
  const value = copied as Record<string, unknown>;
  if (value.kind === 'defender_candidate_set_v1') {
    if (!samePaFields(value, ['kind', 'originalDecisionReference']) || !samePaReferenceValid(value.originalDecisionReference, 'pa_physical_v1_field_steps')) return fail();
  } else if (value.kind === 'defender_team_selection_v1') {
    if (!samePaFields(value, ['kind', 'candidateReferences', 'requireBallHandler']) || !Array.isArray(value.candidateReferences)
      || value.candidateReferences.length !== 9 || value.candidateReferences.some((ref: unknown) => !samePaReferenceValid(ref, 'pa_physical_v1_field_steps'))
      || new Set(value.candidateReferences.map((ref: StepReference) => ref.sourceId)).size !== 9 || typeof value.requireBallHandler !== 'boolean') return fail();
  } else if (value.kind === 'defender_actor_selection_v1') {
    if (!samePaFields(value, ['kind', 'teamSelectionReference', 'member']) || !samePaReferenceValid(value.teamSelectionReference, 'pa_physical_v1_field_steps')
      || !samePaDispatchMemberValid(value.member)) return fail();
  } else return fail();
  return actorFreeze(value) as unknown as SamePaDefensiveCandidateActionV1;
};
