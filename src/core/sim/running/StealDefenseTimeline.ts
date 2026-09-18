import type {
  DefensiveRatings,
} from '../../model/DefensiveRatings';
import {
  resolveRatedBallTransferTiming,
  resolveRatedTagActionTiming,
} from '../fielding/DefensiveRatingAdapters';
import type {
  BallTransferTimingParameters,
} from '../fielding/BallTransferTiming';
import type {
  TagActionTimingParameters,
} from '../fielding/TagActionTiming';

export type StealDefenseTimelineInput = Readonly<{
  pitchCommitmentTick: number;
  catcherSecuredPossessionTick: number;
  catcherRatings: DefensiveRatings;
  receiverSecuredPossessionTick: number;
  receiverRatings: DefensiveRatings;
  transferParameters: BallTransferTimingParameters;
  tagParameters: TagActionTimingParameters;
}>;

export type StealDefenseTimeline = Readonly<{
  pitchCommitmentTick: number;
  catcherSecuredPossessionTick: number;
  pitchToCatcherTicks: number;
  catcherThrowReadyTick: number;
  catcherTransferDelayTicks: number;
  receiverSecuredPossessionTick: number;
  throwReceptionElapsedTicks: number;
  tagActionStartTick: number;
  tagActionDelayTicks: number;
}>;

const validateTick = (
  name: string,
  tick: number,
): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

export const buildStealDefenseTimeline = (
  input: StealDefenseTimelineInput,
): StealDefenseTimeline => {
  validateTick(
    'pitchCommitmentTick',
    input.pitchCommitmentTick,
  );
  validateTick(
    'catcherSecuredPossessionTick',
    input.catcherSecuredPossessionTick,
  );
  validateTick(
    'receiverSecuredPossessionTick',
    input.receiverSecuredPossessionTick,
  );

  if (
    input.catcherSecuredPossessionTick
    < input.pitchCommitmentTick
  ) {
    throw new Error(
      'catcherSecuredPossessionTick must be at or after pitchCommitmentTick',
    );
  }

  const transfer = resolveRatedBallTransferTiming(
    input.catcherSecuredPossessionTick,
    input.catcherRatings,
    input.transferParameters,
  );

  if (
    input.receiverSecuredPossessionTick
    < transfer.throwReadyTick
  ) {
    throw new Error(
      'receiverSecuredPossessionTick must be at or after catcherThrowReadyTick',
    );
  }

  const tag = resolveRatedTagActionTiming(
    input.receiverSecuredPossessionTick,
    input.receiverRatings,
    input.tagParameters,
  );

  return {
    pitchCommitmentTick:
      input.pitchCommitmentTick,
    catcherSecuredPossessionTick:
      input.catcherSecuredPossessionTick,
    pitchToCatcherTicks: (
      input.catcherSecuredPossessionTick
      - input.pitchCommitmentTick
    ),
    catcherThrowReadyTick:
      transfer.throwReadyTick,
    catcherTransferDelayTicks:
      transfer.transferDelayTicks,
    receiverSecuredPossessionTick:
      input.receiverSecuredPossessionTick,
    throwReceptionElapsedTicks: (
      input.receiverSecuredPossessionTick
      - transfer.throwReadyTick
    ),
    tagActionStartTick:
      tag.tagActionStartTick,
    tagActionDelayTicks:
      tag.tagActionDelayTicks,
  };
};
