import type {
  PitcherAttackZone,
  PitcherVerticalPlan,
} from '../plateAppearance/PlateAppearanceCommand';
import type {
  CatcherPitchCall,
} from './CatcherLead';

export type BatterPitchAnticipation = Readonly<{
  /**
   * A batter/scouting belief, not authoritative knowledge.
   * Any field may be omitted when the batter is not committing to it.
   */
  anticipatedPitchSkillId?: string;
  anticipatedAttackZone?: PitcherAttackZone;
  anticipatedVerticalPlan?: PitcherVerticalPlan;
  confidence: number;
}>;

export type BatterPitchAnticipationResolution = Readonly<{
  confidence: number;
  comparedDimensions: number;
  mismatchedDimensions: number;
  mismatchFraction: number;
  confidenceWeightedSurprise: number;
  pitchSkillMatched: boolean | null;
  attackZoneMatched: boolean | null;
  verticalPlanMatched: boolean | null;
}>;

const validateConfidence = (
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      'batter anticipation confidence must be finite within [0, 1]',
    );
  }
};

export const resolveBatterPitchAnticipation = (
  anticipation: BatterPitchAnticipation,
  finalCall: CatcherPitchCall,
): BatterPitchAnticipationResolution => {
  validateConfidence(
    anticipation.confidence,
  );

  const checks: Array<
    boolean | null
  > = [];

  const pitchSkillMatched =
    anticipation.anticipatedPitchSkillId
      === undefined
      ? null
      : (
          anticipation
            .anticipatedPitchSkillId
          === finalCall.pitchSkillId
        );
  checks.push(pitchSkillMatched);

  const attackZoneMatched =
    anticipation.anticipatedAttackZone
      === undefined
      ? null
      : (
          anticipation
            .anticipatedAttackZone
          === finalCall.attackZone
        );
  checks.push(attackZoneMatched);

  const verticalPlanMatched =
    anticipation.anticipatedVerticalPlan
      === undefined
      ? null
      : (
          anticipation
            .anticipatedVerticalPlan
          === finalCall.verticalPlan
        );
  checks.push(verticalPlanMatched);

  const compared = checks.filter(
    (value): value is boolean =>
      value !== null,
  );
  const mismatchedDimensions =
    compared.filter(
      (matched) => !matched,
    ).length;
  const comparedDimensions =
    compared.length;
  const mismatchFraction =
    comparedDimensions === 0
      ? 0
      : (
          mismatchedDimensions
          / comparedDimensions
        );

  return {
    confidence:
      anticipation.confidence,
    comparedDimensions,
    mismatchedDimensions,
    mismatchFraction,
    confidenceWeightedSurprise:
      anticipation.confidence
      * mismatchFraction,
    pitchSkillMatched,
    attackZoneMatched,
    verticalPlanMatched,
  };
};
