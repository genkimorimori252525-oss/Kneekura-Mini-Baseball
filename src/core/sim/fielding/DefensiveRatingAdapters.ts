import type {
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type {
  DefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  applyCatchExecutionTargetError,
  type CatchExecutionErrorCalibration,
  type CatchExecutionTargetAssessment,
} from './CatchExecutionSkill';
import {
  deriveCatchRetentionParameters,
  type CatchRetentionSkillCalibration,
} from './CatchRetentionSkill';
import type {
  CatchRetentionParameters,
} from './CatchRetention';
import {
  resolveDefensiveDecisionTiming,
  type DefensiveDecisionTiming,
  type DefensiveDecisionTimingParameters,
} from './DefensiveDecisionTiming';
import type {
  DefenderMotionParameters,
} from './DefenderMotion';
import {
  resolveDefenderFirstStepTiming,
  type DefenderFirstStepTiming,
  type DefenderFirstStepTimingParameters,
} from './DefenderFirstStepTiming';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';
import {
  resolveBallTransferTiming,
  type BallTransferTiming,
  type BallTransferTimingParameters,
} from './BallTransferTiming';
import {
  createRatedThrowLaunch,
  type ThrowLaunch,
  type ThrowLaunchCalibration,
} from './ThrowLaunch';
import {
  resolveTagActionTiming,
  type TagActionTiming,
  type TagActionTimingParameters,
} from './TagActionTiming';
import type {
  Vec2,
  Vec3,
} from '../../model/geometry';
import {
  applyBattedBallReadPredictionError,
  type BattedBallReadCalibration,
  type BattedBallReadPredictionAssessment,
} from './BattedBallReadSkill';
import {
  planDefenderRoute,
  type DefenderRoutePlan,
  type DefenderRoutePlanCalibration,
} from './DefenderRoutePlan';
import type {
  RememberedPrediction,
  SpatialMotionEstimate,
} from '../perception/ObservationMemory';

export type DefenderAccelerationRatingCalibration = Readonly<{
  lowestAbilityAccelerationMps2: number;
  highestAbilityAccelerationMps2: number;
}>;

const validatePositive = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(
      `${name} must be finite and positive`,
    );
  }
};

export const deriveRatedDefenderMotionParameters = (
  base: DefenderMotionParameters,
  ratings: DefensiveRatings,
  calibration: DefenderAccelerationRatingCalibration,
): DefenderMotionParameters => {
  validatePositive(
    'lowestAbilityAccelerationMps2',
    calibration.lowestAbilityAccelerationMps2,
  );
  validatePositive(
    'highestAbilityAccelerationMps2',
    calibration.highestAbilityAccelerationMps2,
  );
  if (
    calibration.highestAbilityAccelerationMps2
    < calibration.lowestAbilityAccelerationMps2
  ) {
    throw new Error(
      'highestAbilityAccelerationMps2 must be at least lowestAbilityAccelerationMps2',
    );
  }

  const accelerationMps2 = (
    calibration.lowestAbilityAccelerationMps2
    + (
      calibration.highestAbilityAccelerationMps2
      - calibration.lowestAbilityAccelerationMps2
    ) * ratings.acceleration
  );

  return {
    ...base,
    accelerationMps2,
  };
};

export const resolveRatedCatchExecutionTarget = (
  target: PerceivedGloveTargetAssessment,
  ratings: DefensiveRatings,
  rng: DeterministicRng,
  calibration: CatchExecutionErrorCalibration,
): CatchExecutionTargetAssessment => (
  applyCatchExecutionTargetError(
    target,
    ratings.catching,
    rng,
    calibration,
  )
);

export const deriveRatedCatchRetentionParameters = (
  base: CatchRetentionParameters,
  ratings: DefensiveRatings,
  calibration: CatchRetentionSkillCalibration,
): CatchRetentionParameters => (
  deriveCatchRetentionParameters(
    base,
    ratings.catching,
    calibration,
  )
);

export const resolveRatedDefensiveDecisionTiming = (
  evidenceAvailableAt: number,
  ratings: DefensiveRatings,
  parameters: DefensiveDecisionTimingParameters,
): DefensiveDecisionTiming => (
  resolveDefensiveDecisionTiming(
    evidenceAvailableAt,
    ratings.situationalAwareness,
    parameters,
  )
);

export const getRatedPositionSuitability = (
  ratings: DefensiveRatings,
  position: DefensivePosition,
): number => (
  ratings.positionSuitability[position]
);


export const resolveRatedDefenderFirstStepTiming = (
  recognitionTick: number,
  ratings: DefensiveRatings,
  parameters: DefenderFirstStepTimingParameters,
): DefenderFirstStepTiming => (
  resolveDefenderFirstStepTiming(
    recognitionTick,
    ratings.firstStep,
    parameters,
  )
);


export const resolveRatedBallTransferTiming = (
  securedPossessionTick: number,
  ratings: DefensiveRatings,
  parameters: BallTransferTimingParameters,
): BallTransferTiming => (
  resolveBallTransferTiming(
    securedPossessionTick,
    ratings.transfer,
    parameters,
  )
);

export const createDefensiveRatedThrowLaunch = (
  input: Readonly<{
    releaseTick: number;
    origin: Vec3;
    intendedTarget: Vec3;
    ratings: DefensiveRatings;
    rng: DeterministicRng;
    calibration: ThrowLaunchCalibration;
  }>,
): ThrowLaunch => (
  createRatedThrowLaunch({
    releaseTick: input.releaseTick,
    origin: input.origin,
    intendedTarget: input.intendedTarget,
    armStrength: input.ratings.armStrength,
    throwingAccuracy:
      input.ratings.throwingAccuracy,
    rng: input.rng,
    calibration: input.calibration,
  })
);

export const resolveRatedTagActionTiming = (
  possessionReadyTick: number,
  ratings: DefensiveRatings,
  parameters: TagActionTimingParameters,
): TagActionTiming => (
  resolveTagActionTiming(
    possessionReadyTick,
    ratings.tagSkill,
    parameters,
  )
);


export const applyRatedBattedBallRead = (
  perceivedBall:
    RememberedPrediction<SpatialMotionEstimate>,
  ratings: DefensiveRatings,
  rng: DeterministicRng,
  calibration: BattedBallReadCalibration,
): BattedBallReadPredictionAssessment => (
  applyBattedBallReadPredictionError(
    perceivedBall,
    ratings.battedBallRead,
    rng,
    calibration,
  )
);

export const planRatedDefenderRoute = (
  input: Readonly<{
    start: Vec2;
    target: Vec2;
    ratings: DefensiveRatings;
    preferredSide: -1 | 1;
    calibration: DefenderRoutePlanCalibration;
  }>,
): DefenderRoutePlan => (
  planDefenderRoute({
    start: input.start,
    target: input.target,
    routeEfficiency:
      input.ratings.routeEfficiency,
    preferredSide: input.preferredSide,
    calibration: input.calibration,
  })
);
