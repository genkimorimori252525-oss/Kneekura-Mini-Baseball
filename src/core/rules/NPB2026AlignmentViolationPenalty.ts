import type {
  BaseOccupancy,
} from '../model/CanonicalMatchState';
import type {
  BaseballBase,
} from './PhysicalRuleFacts';
import type {
  FirstPostPitchInfielderTouchFact,
} from './AlignmentPenaltyFacts';
import type {
  DefensiveAlignmentViolation,
} from './DefensiveAlignmentViolation';
import {
  satisfiesAlignmentPenaltyAdvanceException,
  type NaturalPlayAdvancementResult,
} from './OffenseAdvancementResult';

export type AlignmentPenaltyRunnerAward = Readonly<{
  runnerId: string;
  fromBase: 1 | 2 | 3;
  targetBase: 2 | 3 | 4;
}>;

export type AlignmentPenaltyAward = Readonly<{
  batterRunner: Readonly<{
    runnerId: string;
    targetBase: 1;
  }>;
  runners: readonly AlignmentPenaltyRunnerAward[];
}>;

export type NPB2026AlignmentViolationPenaltyInput = Readonly<{
  violation: DefensiveAlignmentViolation;
  firstInfielderTouch: FirstPostPitchInfielderTouchFact | null;
  prePitchBases: BaseOccupancy;
  naturalPlay: NaturalPlayAdvancementResult;
  batterRunnerId?: string;
}>;

export type NPB2026AlignmentViolationPenaltyResult =
  | Readonly<{
    kind: 'no_violation';
  }>
  | Readonly<{
    kind: 'play_stands';
    violatingFirstToucherId: string;
    naturalPlay: NaturalPlayAdvancementResult;
  }>
  | Readonly<{
    kind: 'offense_choice_required';
    violatingFirstToucherId: string;
    naturalPlay: NaturalPlayAdvancementResult;
    penaltyAward: AlignmentPenaltyAward;
  }>
  | Readonly<{
    kind: 'ball_and_dead_ball';
    firstInfielderToucherId: string | null;
  }>;

const runnerAward = (
  runnerId: string,
  fromBase: 1 | 2 | 3,
): AlignmentPenaltyRunnerAward => ({
  runnerId,
  fromBase,
  targetBase: (fromBase + 1) as BaseballBase as 2 | 3 | 4,
});

export const createNPB2026AlignmentPenaltyAward = (
  prePitchBases: BaseOccupancy,
  batterRunnerId: string,
): AlignmentPenaltyAward => {
  if (batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  const runners: AlignmentPenaltyRunnerAward[] = [];
  if (prePitchBases.first !== null) {
    runners.push(runnerAward(prePitchBases.first, 1));
  }
  if (prePitchBases.second !== null) {
    runners.push(runnerAward(prePitchBases.second, 2));
  }
  if (prePitchBases.third !== null) {
    runners.push(runnerAward(prePitchBases.third, 3));
  }

  return {
    batterRunner: {
      runnerId: batterRunnerId,
      targetBase: 1,
    },
    runners,
  };
};

export const resolveNPB2026AlignmentViolationPenalty = (
  input: NPB2026AlignmentViolationPenaltyInput,
): NPB2026AlignmentViolationPenaltyResult => {
  if (input.violation.kind === 'no_violation') {
    return { kind: 'no_violation' };
  }

  if (input.violation.identity !== 'concrete_players') {
    throw new Error(
      'alignment penalty requires concrete violating-player identity',
    );
  }
  if (input.violation.violatingPlayerIds.length === 0) {
    throw new Error(
      'concrete alignment violation requires at least one violating player',
    );
  }

  if (
    input.batterRunnerId !== undefined
    && input.batterRunnerId !== input.naturalPlay.batterRunnerId
  ) {
    throw new Error(
      'natural play batterRunnerId does not match the evaluated batter-runner',
    );
  }

  const firstToucherId = input.firstInfielderTouch?.playerId ?? null;
  if (
    firstToucherId === null
    || !input.violation.violatingPlayerIds.includes(firstToucherId)
  ) {
    return {
      kind: 'ball_and_dead_ball',
      firstInfielderToucherId: firstToucherId,
    };
  }

  if (
    satisfiesAlignmentPenaltyAdvanceException(
      input.prePitchBases,
      input.naturalPlay,
    )
  ) {
    return {
      kind: 'play_stands',
      violatingFirstToucherId: firstToucherId,
      naturalPlay: input.naturalPlay,
    };
  }

  return {
    kind: 'offense_choice_required',
    violatingFirstToucherId: firstToucherId,
    naturalPlay: input.naturalPlay,
    penaltyAward: createNPB2026AlignmentPenaltyAward(
      input.prePitchBases,
      input.naturalPlay.batterRunnerId,
    ),
  };
};
