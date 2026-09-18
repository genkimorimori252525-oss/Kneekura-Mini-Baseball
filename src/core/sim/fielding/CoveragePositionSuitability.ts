import type {
  DefensivePosition,
} from '../../model/CanonicalWorldSnapshot';
import type {
  DefensiveRatings,
} from '../../model/DefensiveRatings';
import type {
  DefensiveIntent,
  DefensiveIntentCandidate,
} from './DefensiveDecision';

export type CoverageRoleSensitivity = Readonly<{
  ball_handler: number;
  base_cover: number;
  relay: number;
  backup: number;
  deep_coverage: number;
  hold: number;
}>;

export type CoveragePositionSuitabilityCalibration = Readonly<{
  roleSensitivity: CoverageRoleSensitivity;
  minimumSuitabilityFactor: number;
}>;

const validateUnit = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      `${name} must be finite and within [0, 1]`,
    );
  }
};

const roleKey = (
  intent: DefensiveIntent,
): keyof CoverageRoleSensitivity => intent.kind;

export const applyPositionSuitabilityToCoverageCandidates = (
  candidates: readonly DefensiveIntentCandidate[],
  ratings: DefensiveRatings,
  registeredPosition: DefensivePosition,
  calibration: CoveragePositionSuitabilityCalibration,
): readonly DefensiveIntentCandidate[] => {
  validateUnit(
    'minimumSuitabilityFactor',
    calibration.minimumSuitabilityFactor,
  );

  for (const [
    key,
    sensitivity,
  ] of Object.entries(
    calibration.roleSensitivity,
  )) {
    validateUnit(
      `roleSensitivity.${key}`,
      sensitivity,
    );
  }

  const suitability =
    ratings.positionSuitability[registeredPosition];
  validateUnit(
    `positionSuitability.${registeredPosition}`,
    suitability,
  );

  return candidates.map((candidate) => {
    const sensitivity =
      calibration.roleSensitivity[
        roleKey(candidate.intent)
      ];
    const suitabilityFactor = (
      calibration.minimumSuitabilityFactor
      + (
        1 - calibration.minimumSuitabilityFactor
      ) * suitability
    );
    const roleFactor = (
      1 - sensitivity
      + sensitivity * suitabilityFactor
    );

    return {
      ...candidate,
      localPriority:
        candidate.localPriority * roleFactor,
    };
  });
};
