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
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';

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
