import type {
  ScoutingEstimateParameters,
} from './ScoutingEstimate';

export type ManagerDefensiveStrategyRatings = Readonly<{
  informationUpdate: number;
  sampleEvaluation: number;
  alignmentComparison: number;
}>;

export type ManagerScoutingCalibration = Readonly<{
  lowInformationUpdateRecencyDecay: number;
  highInformationUpdateRecencyDecay: number;
  lowSampleEvaluationPriorWeight: number;
  highSampleEvaluationPriorWeight: number;
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

const validateNonNegative = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be finite and non-negative`,
    );
  }
};

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

export const createManagerDefensiveStrategyRatings = (
  input: ManagerDefensiveStrategyRatings,
): ManagerDefensiveStrategyRatings => {
  validateUnit(
    'informationUpdate',
    input.informationUpdate,
  );
  validateUnit(
    'sampleEvaluation',
    input.sampleEvaluation,
  );
  validateUnit(
    'alignmentComparison',
    input.alignmentComparison,
  );

  return {
    informationUpdate: input.informationUpdate,
    sampleEvaluation: input.sampleEvaluation,
    alignmentComparison: input.alignmentComparison,
  };
};

export const deriveManagerScoutingParameters = (
  ratings: ManagerDefensiveStrategyRatings,
  calibration: ManagerScoutingCalibration,
): ScoutingEstimateParameters => {
  validateNonNegative(
    'lowInformationUpdateRecencyDecay',
    calibration.lowInformationUpdateRecencyDecay,
  );
  validateNonNegative(
    'highInformationUpdateRecencyDecay',
    calibration.highInformationUpdateRecencyDecay,
  );
  if (
    calibration.highInformationUpdateRecencyDecay
    < calibration.lowInformationUpdateRecencyDecay
  ) {
    throw new Error(
      'highInformationUpdateRecencyDecay must be at least lowInformationUpdateRecencyDecay',
    );
  }

  validatePositive(
    'lowSampleEvaluationPriorWeight',
    calibration.lowSampleEvaluationPriorWeight,
  );
  validatePositive(
    'highSampleEvaluationPriorWeight',
    calibration.highSampleEvaluationPriorWeight,
  );
  if (
    calibration.highSampleEvaluationPriorWeight
    < calibration.lowSampleEvaluationPriorWeight
  ) {
    throw new Error(
      'highSampleEvaluationPriorWeight must be at least lowSampleEvaluationPriorWeight',
    );
  }

  return {
    priorWeight: (
      calibration.lowSampleEvaluationPriorWeight
      + (
        calibration.highSampleEvaluationPriorWeight
        - calibration.lowSampleEvaluationPriorWeight
      ) * ratings.sampleEvaluation
    ),
    recencyDecayPerObservation: (
      calibration.lowInformationUpdateRecencyDecay
      + (
        calibration.highInformationUpdateRecencyDecay
        - calibration.lowInformationUpdateRecencyDecay
      ) * ratings.informationUpdate
    ),
  };
};
