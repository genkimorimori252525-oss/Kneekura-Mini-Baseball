import type {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  selectDefensiveAlignmentCandidate,
  type DefensiveAlignmentCandidate,
  type DefensiveAlignmentEvaluation,
  type DefensiveAlignmentSelectionInput,
  type DefensiveAlignmentSelectionResult,
} from './DefensiveAlignmentSelection';
import type {
  ManagerDefensiveStrategyRatings,
} from './ManagerDefensiveStrategy';

export type ManagerAlignmentComparisonCalibration = Readonly<{
  minimumComparisonErrorMeters: number;
  maximumComparisonErrorMeters: number;
}>;

export type ManagerAlignmentCandidateEvaluation =
  DefensiveAlignmentEvaluation & Readonly<{
    comparisonErrorMeters: number;
    managerEvaluatedDistanceMeters: number;
  }>;

export type ManagerAlignmentSelectionResult = Readonly<{
  selected: DefensiveAlignmentCandidate;
  evaluations:
    readonly ManagerAlignmentCandidateEvaluation[];
  objectiveSelection: DefensiveAlignmentSelectionResult;
  comparisonErrorScaleMeters: number;
}>;

export type ManagerAlignmentSelectionInput =
  DefensiveAlignmentSelectionInput & Readonly<{
    alignmentComparison: number;
    rng: DeterministicRng;
    calibration:
      ManagerAlignmentComparisonCalibration;
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

const sampleSymmetricTriangular = (
  rng: DeterministicRng,
  scale: number,
): number => (
  (rng.nextFloat() - rng.nextFloat()) * scale
);

export const selectDefensiveAlignmentCandidateForManager = (
  input: ManagerAlignmentSelectionInput,
): ManagerAlignmentSelectionResult => {
  validateUnit(
    'alignmentComparison',
    input.alignmentComparison,
  );
  validateNonNegative(
    'minimumComparisonErrorMeters',
    input.calibration.minimumComparisonErrorMeters,
  );
  validateNonNegative(
    'maximumComparisonErrorMeters',
    input.calibration.maximumComparisonErrorMeters,
  );
  if (
    input.calibration.maximumComparisonErrorMeters
    < input.calibration.minimumComparisonErrorMeters
  ) {
    throw new Error(
      'maximumComparisonErrorMeters must be at least minimumComparisonErrorMeters',
    );
  }

  const objectiveSelection =
    selectDefensiveAlignmentCandidate(input);

  const comparisonErrorScaleMeters = (
    input.calibration.maximumComparisonErrorMeters
    + (
      input.calibration.minimumComparisonErrorMeters
      - input.calibration.maximumComparisonErrorMeters
    ) * input.alignmentComparison
  );

  const evaluations =
    objectiveSelection.evaluations.map((evaluation) => {
      const comparisonErrorMeters =
        sampleSymmetricTriangular(
          input.rng,
          comparisonErrorScaleMeters,
        );

      return {
        ...evaluation,
        comparisonErrorMeters,
        managerEvaluatedDistanceMeters: (
          evaluation.expectedNearestDistanceMeters
          + comparisonErrorMeters
        ),
      };
    });

  const ranked = [...evaluations].sort(
    (first, second) => (
      first.managerEvaluatedDistanceMeters
      - second.managerEvaluatedDistanceMeters
      || first.id.localeCompare(second.id)
    ),
  );
  const selected = input.candidates.find(
    (candidate) => candidate.id === ranked[0].id,
  );
  if (selected === undefined) {
    throw new Error(
      'selected defensive alignment candidate must exist',
    );
  }

  return {
    selected,
    evaluations,
    objectiveSelection,
    comparisonErrorScaleMeters,
  };
};


export const selectRatedDefensiveAlignmentCandidateForManager = (
  input: Omit<
    ManagerAlignmentSelectionInput,
    'alignmentComparison'
  > & Readonly<{
    managerRatings: ManagerDefensiveStrategyRatings;
  }>,
): ManagerAlignmentSelectionResult => (
  selectDefensiveAlignmentCandidateForManager({
    ...input,
    alignmentComparison:
      input.managerRatings.alignmentComparison,
  })
);
