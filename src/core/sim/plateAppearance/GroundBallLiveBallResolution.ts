import type {
  BaseOccupancy,
} from '../../model/CanonicalMatchState';
import type {
  PlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import {
  finalizeRulePendingRuns,
  type GroundBallFirstBaseRuleEngineResult,
} from '../../rules/RuleEngine';
import type {
  ResolvedLiveBallPlateAppearance,
} from './PlateAppearanceMatchState';

export type GroundBallFirstBaseLiveBallResolutionInput = Readonly<{
  rule: GroundBallFirstBaseRuleEngineResult;
  playEnd: PlayEndFact;
  basesAfter: BaseOccupancy;
}>;

export const createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule = (
  input: GroundBallFirstBaseLiveBallResolutionInput,
): ResolvedLiveBallPlateAppearance => {
  const correct = input.rule.correctRuleResult;

  if (correct.kind !== 'resolved') {
    throw new Error(
      'ground-ball first-base rule must be resolved before match-state application',
    );
  }

  const scoredRunnerIds = correct.thirdOut
    ? correct.runsScored.map((touch) => touch.runnerId)
    : finalizeRulePendingRuns(
        correct,
        input.playEnd,
      ).scored.map((touch) => touch.runnerId);

  return {
    playEnd: input.playEnd,
    outsAfter: correct.outsAfter,
    basesAfter: input.basesAfter,
    scoredRunnerIds,
  };
};
