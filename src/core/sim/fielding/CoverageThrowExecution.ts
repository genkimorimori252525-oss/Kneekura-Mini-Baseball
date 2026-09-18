import type {
  Vec3,
} from '../../model/geometry';
import type {
  DefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  createDefensiveRatedThrowLaunch,
} from './DefensiveRatingAdapters';
import type {
  ThrowLaunch,
  ThrowLaunchCalibration,
} from './ThrowLaunch';
import type {
  CoverageThrowPlanSelection,
} from './CoverageThrowPlan';

export type CoverageThrowReceiverTarget = Readonly<{
  playerId: string;
  position: Vec3;
}>;

export type CoverageThrowExecutionInput = Readonly<{
  selection: CoverageThrowPlanSelection;
  releaseTick: number;
  origin: Vec3;
  receiverTarget: CoverageThrowReceiverTarget;
  throwerRatings: DefensiveRatings;
  rng: DeterministicRng;
  calibration: ThrowLaunchCalibration;
}>;

export type CoverageThrowExecution = Readonly<{
  throwerId: string;
  receiverId: string;
  targetBase: 1 | 2 | 3 | 4;
  launch: ThrowLaunch;
}>;

export const createCoverageThrowLaunch = (
  input: CoverageThrowExecutionInput,
): CoverageThrowExecution => {
  const selected = input.selection.selection.selected;

  if (
    input.receiverTarget.playerId
    !== selected.receiverId
  ) {
    throw new Error(
      'receiver target must match selected throw-plan receiver',
    );
  }

  const launch = createDefensiveRatedThrowLaunch({
    releaseTick: input.releaseTick,
    origin: input.origin,
    intendedTarget: input.receiverTarget.position,
    ratings: input.throwerRatings,
    rng: input.rng,
    calibration: input.calibration,
  });

  return {
    throwerId: input.selection.throwerId,
    receiverId: selected.receiverId,
    targetBase: selected.targetBase,
    launch,
  };
};
