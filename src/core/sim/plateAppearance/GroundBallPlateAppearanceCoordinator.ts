import type {
  BaseOccupancy,
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import type {
  PlayEndFact,
} from '../../rules/PhysicalRuleFacts';
import type {
  GroundBallFirstBaseRuleEngineResult,
} from '../../rules/RuleEngine';
import {
  recordLiveBallPlayEnd,
  type CanonicalPlateAppearanceTimeline,
} from './CanonicalPlateAppearanceTimeline';
import {
  createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule,
} from './GroundBallLiveBallResolution';
import {
  applyResolvedLiveBallPlateAppearanceToMatchState,
  type ResolvedLiveBallPlateAppearance,
} from './PlateAppearanceMatchState';

export type GroundBallFirstBasePlateAppearanceCompletionInput =
  Readonly<{
    match: CanonicalMatchState;
    timeline: CanonicalPlateAppearanceTimeline;
    rule: GroundBallFirstBaseRuleEngineResult;
    playEnd: PlayEndFact;
    basesAfter: BaseOccupancy;
  }>;

export type GroundBallFirstBasePlateAppearanceCompletionResult =
  Readonly<{
    timeline: CanonicalPlateAppearanceTimeline;
    resolution: ResolvedLiveBallPlateAppearance;
    nextMatchState: CanonicalMatchState;
  }>;

export const completeGroundBallFirstBasePlateAppearance = (
  input: GroundBallFirstBasePlateAppearanceCompletionInput,
): GroundBallFirstBasePlateAppearanceCompletionResult => {
  if (input.rule.physicalFacts.outsAtStart !== input.match.outs) {
    throw new Error(
      'ground-ball rule outsAtStart must match CanonicalMatchState.outs',
    );
  }

  const completedTimeline = recordLiveBallPlayEnd(
    input.timeline,
    input.playEnd,
  );
  const resolution =
    createResolvedLiveBallPlateAppearanceFromGroundBallFirstBaseRule({
      rule: input.rule,
      playEnd: input.playEnd,
      basesAfter: input.basesAfter,
    });
  const nextMatchState =
    applyResolvedLiveBallPlateAppearanceToMatchState(
      input.match,
      completedTimeline,
      resolution,
    );

  return {
    timeline: completedTimeline,
    resolution,
    nextMatchState,
  };
};
