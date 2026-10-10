import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AcceptedBattingScoreAssessment, BattingScoreAssessmentBasis } from './NativeBattingScoreAssessment';
import { samePaFields, samePaReferenceValid, samePaText } from './SamePlateAppearanceWorkPrefix';
import { samePaDispatchMemberValid } from './SamePlateAppearanceDispatchRoles';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { SamePaCurrentExecutionViewReference } from './SamePlateAppearanceInvocationView';

export type CurrentBattingScoreAssessmentBasis = Omit<BattingScoreAssessmentBasis, 'viewReference'> & Readonly<{ viewReference: SamePaCurrentExecutionViewReference }>;
export type AcceptedCurrentBattingScoreAssessment = Omit<AcceptedBattingScoreAssessment, 'capability' | 'viewReference'> & Readonly<{
  capability: 'owned_batting_current_score_assessment_v1'; viewReference: SamePaCurrentExecutionViewReference;
}>;
/** Separate discriminated current-view Source arm. The original shape/parser
 * and its reserved empty-view semantics remain unchanged. */
export const currentBattingScoreAssessmentInput = (raw: unknown, id?: string): AcceptedCurrentBattingScoreAssessment => {
  const source = cloneInert(raw) as AcceptedCurrentBattingScoreAssessment;
  if (!samePaFields(source, ['sourceId', 'sourceVersion', 'capability', 'predictionReference', 'modelReference', 'observationCutReference', 'member', 'viewReference', 'score', 'provenance'])
    || source.capability !== 'owned_batting_current_score_assessment_v1' || !samePaReferenceValid(source.viewReference, 'pa_continuation_v1_execution_views')
    || !samePaText(source.sourceId) || !samePaText(source.sourceVersion) || id !== undefined && source.sourceId !== id
    || !samePaReferenceValid(source.predictionReference, 'batting_prediction_v1_predictions') || !samePaReferenceValid(source.modelReference, 'world_player_batting_models')
    || !samePaReferenceValid(source.observationCutReference, 'batting_observation_v1_observations') || !samePaDispatchMemberValid(source.member)
    || typeof source.score !== 'number' || !Number.isFinite(source.score) || source.score < 0 || source.score > 1
    || !samePaFields(source.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(source.provenance).every(samePaText)) throw new Error('invalid current batting score Source');
  return freeze(source);
};
export const assertCurrentBattingScoreAssessmentBasis = (raw: unknown, basis: CurrentBattingScoreAssessmentBasis) => {
  const source = currentBattingScoreAssessmentInput(raw);
  for (const key of ['predictionReference', 'modelReference', 'observationCutReference', 'member', 'viewReference'] as const) {
    if (json(source[key]) !== json(basis[key])) throw new Error('current batting score original basis differs');
  }
};
