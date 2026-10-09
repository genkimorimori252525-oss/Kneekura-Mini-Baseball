import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaDispatchMemberValid, type SamePaDispatchMember } from './SamePlateAppearanceDispatchRoles';
import { samePaFields as fields, samePaText as text, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';

export type BattingScoreAssessmentBasis = Readonly<{
  predictionReference: SamePaReference<'batting_prediction_v1_predictions'>;
  modelReference: SamePaReference<'world_player_batting_models'>;
  observationCutReference: SamePaReference<'batting_observation_v1_observations'>;
  member: SamePaDispatchMember;
  viewReference: SamePaReference<'reserved_pa_execution_views'>;
}>;
export type AcceptedBattingScoreAssessment = BattingScoreAssessmentBasis & Readonly<{
  sourceId: string;
  sourceVersion: string;
  capability: 'owned_batting_score_assessment_v1';
  score: number;
  provenance: Readonly<{ assessmentSourceId: string; assessmentVersion: string; calibrationSourceId: string; calibrationVersion: string }>;
}>;
const basisKeys = ['predictionReference', 'modelReference', 'observationCutReference', 'member', 'viewReference'] as const;
const fail = (): never => { throw new Error('invalid batting score assessment Source or original basis'); };
const inert = (raw: unknown): unknown => {
  try { return cloneInert(raw); } catch (cause) { throw new Error('invalid batting score assessment inert data', { cause }); }
};
const referencesValid = (value: Record<string, unknown>): boolean => ref(value.predictionReference, 'batting_prediction_v1_predictions')
  && ref(value.modelReference, 'world_player_batting_models') && ref(value.observationCutReference, 'batting_observation_v1_observations')
  && samePaDispatchMemberValid(value.member) && ref(value.viewReference, 'reserved_pa_execution_views');

/** An explicit independently accepted primitive input, never a score formula or
 * a substitute for an owned prediction/model/observation. No Native authority is
 * conferred by this pure shape check; durable owners must replay the references.
 */
export const battingScoreAssessmentInput = (raw: unknown, expectedSourceId?: string): AcceptedBattingScoreAssessment => {
  const source = inert(raw);
  if (!fields(source, ['sourceId', 'sourceVersion', 'capability', ...basisKeys, 'score', 'provenance'])
    || !text(source.sourceId) || !text(source.sourceVersion) || expectedSourceId !== undefined && source.sourceId !== expectedSourceId
    || source.capability !== 'owned_batting_score_assessment_v1' || !referencesValid(source)
    || typeof source.score !== 'number' || !Number.isFinite(source.score) || source.score < 0 || source.score > 1
    || !fields(source.provenance, ['assessmentSourceId', 'assessmentVersion', 'calibrationSourceId', 'calibrationVersion'])
    || !Object.values(source.provenance).every(text)) fail();
  return freeze(source as AcceptedBattingScoreAssessment);
};

/** Pure exact original-reference consistency. The caller must independently
 * authenticate the private connection-bound basis before any owner acceptance.
 */
export const assertBattingScoreAssessmentBasis = (rawSource: unknown, rawBasis: BattingScoreAssessmentBasis): void => {
  const source = battingScoreAssessmentInput(rawSource), basis = inert(rawBasis);
  if (!fields(basis, basisKeys) || !referencesValid(basis)) return fail();
  for (const key of basisKeys) if (json(source[key]) !== json(basis[key])) fail();
};
