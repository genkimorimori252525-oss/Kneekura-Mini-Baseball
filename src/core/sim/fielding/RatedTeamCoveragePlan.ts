import type {
  DefensiveRatings,
} from '../../model/DefensiveRatings';
import {
  generateDefensiveIntentCandidates,
  type DefensiveDecisionInput,
} from './DefensiveDecision';
import {
  applyPositionSuitabilityToCoverageCandidates,
  type CoveragePositionSuitabilityCalibration,
} from './CoveragePositionSuitability';
import {
  createTeamCoveragePlan,
  type DefenderCoverageCandidateSet,
  type TeamCoveragePlan,
} from './TeamCoveragePlan';

export type RatedDefenderCoverageInput = Readonly<{
  decisionInput: DefensiveDecisionInput;
  ratings: DefensiveRatings;
}>;

export type RatedTeamCoveragePlanInput = Readonly<{
  defenders: readonly RatedDefenderCoverageInput[];
  requireBallHandler: boolean;
  positionSuitabilityCalibration:
    CoveragePositionSuitabilityCalibration;
}>;

export const createRatedTeamCoveragePlan = (
  input: RatedTeamCoveragePlanInput,
): TeamCoveragePlan => {
  const candidateSets:
    readonly DefenderCoverageCandidateSet[] =
    input.defenders.map((defender) => {
      const {
        decisionInput,
        ratings,
      } = defender;

      const candidates =
        generateDefensiveIntentCandidates(
          decisionInput,
        );

      const ratedCandidates =
        applyPositionSuitabilityToCoverageCandidates(
          candidates,
          ratings,
          decisionInput.self.registeredPosition,
          input.positionSuitabilityCalibration,
        );

      return {
        playerId: decisionInput.self.playerId,
        registeredPosition:
          decisionInput.self.registeredPosition,
        candidates: ratedCandidates,
      };
    });

  return createTeamCoveragePlan({
    defenders: candidateSets,
    requireBallHandler: input.requireBallHandler,
  });
};
