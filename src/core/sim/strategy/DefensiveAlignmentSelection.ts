import type {
  BattedBallDirectionBucket,
  DirectionDistribution,
} from '../../model/BatterTendency';
import type {
  Vec2,
} from '../../model/geometry';
import type {
  ScoutingEstimate,
} from './ScoutingEstimate';
import type {
  DefensiveAlignment,
} from './DefensiveAlignment';

export type DefensiveAlignmentCandidate = Readonly<{
  id: string;
  alignment: DefensiveAlignment;
}>;

export type DirectionAnchorMap = Readonly<
  Record<BattedBallDirectionBucket, Vec2>
>;

export type DirectionDistanceMap = Readonly<
  Record<BattedBallDirectionBucket, number>
>;

export type DefensiveAlignmentEvaluation = Readonly<{
  id: string;
  expectedNearestDistanceMeters: number;
  nearestDistanceByDirection: DirectionDistanceMap;
}>;

export type DefensiveAlignmentSelectionResult = Readonly<{
  selected: DefensiveAlignmentCandidate;
  evaluations: readonly DefensiveAlignmentEvaluation[];
  effectiveDirectionDistribution: DirectionDistribution;
}>;

export type DefensiveAlignmentSelectionInput = Readonly<{
  scoutingEstimate: ScoutingEstimate;
  candidates: readonly DefensiveAlignmentCandidate[];
  directionAnchors: DirectionAnchorMap;
  neutralDirectionDistribution: DirectionDistribution;
  coveragePlayerIds: readonly string[];
}>;

const DIRECTION_BUCKETS = [
  'pull',
  'middle',
  'opposite',
] as const satisfies readonly BattedBallDirectionBucket[];

const SUM_TOLERANCE = 1e-9;

const validateDistribution = (
  name: string,
  distribution: DirectionDistribution,
): void => {
  const values = DIRECTION_BUCKETS.map(
    (bucket) => distribution[bucket],
  );
  if (
    values.some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new Error(
      `${name} probabilities must be finite and non-negative`,
    );
  }
  const sum = values.reduce(
    (total, value) => total + value,
    0,
  );
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    throw new Error(
      `${name} probabilities must sum to 1`,
    );
  }
};

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(
      `${name} coordinates must be finite`,
    );
  }
};

const distance = (
  first: Vec2,
  second: Vec2,
): number => Math.hypot(
  second.x - first.x,
  second.z - first.z,
);

const blendDirectionDistribution = (
  estimate: DirectionDistribution,
  neutral: DirectionDistribution,
  uncertainty: number,
): DirectionDistribution => ({
  pull: (
    estimate.pull * (1 - uncertainty)
    + neutral.pull * uncertainty
  ),
  middle: (
    estimate.middle * (1 - uncertainty)
    + neutral.middle * uncertainty
  ),
  opposite: (
    estimate.opposite * (1 - uncertainty)
    + neutral.opposite * uncertainty
  ),
});

const validateInput = (
  input: DefensiveAlignmentSelectionInput,
): void => {
  if (input.candidates.length === 0) {
    throw new Error(
      'at least one defensive alignment candidate is required',
    );
  }
  if (
    !Number.isFinite(input.scoutingEstimate.uncertainty)
    || input.scoutingEstimate.uncertainty < 0
    || input.scoutingEstimate.uncertainty > 1
  ) {
    throw new Error(
      'scouting uncertainty must be finite and within [0, 1]',
    );
  }

  validateDistribution(
    'scouting directionDistribution',
    input.scoutingEstimate.directionDistribution,
  );
  validateDistribution(
    'neutralDirectionDistribution',
    input.neutralDirectionDistribution,
  );
  for (const bucket of DIRECTION_BUCKETS) {
    validateVec2(
      `directionAnchors.${bucket}`,
      input.directionAnchors[bucket],
    );
  }

  if (input.coveragePlayerIds.length === 0) {
    throw new Error(
      'coveragePlayerIds must not be empty',
    );
  }
  if (
    new Set(input.coveragePlayerIds).size
    !== input.coveragePlayerIds.length
  ) {
    throw new Error(
      'coveragePlayerIds must be unique',
    );
  }

  const candidateIds = new Set<string>();
  for (const candidate of input.candidates) {
    if (candidate.id.length === 0) {
      throw new Error(
        'defensive alignment candidate id must not be empty',
      );
    }
    if (candidateIds.has(candidate.id)) {
      throw new Error(
        'defensive alignment candidate ids must be unique',
      );
    }
    candidateIds.add(candidate.id);

    const playerIds = new Set(
      candidate.alignment.defenders.map(
        (defender) => defender.playerId,
      ),
    );
    if (
      input.coveragePlayerIds.some(
        (playerId) => !playerIds.has(playerId),
      )
    ) {
      throw new Error(
        'coveragePlayerIds must exist in every candidate alignment',
      );
    }
  }
};

export const selectDefensiveAlignmentCandidate = (
  input: DefensiveAlignmentSelectionInput,
): DefensiveAlignmentSelectionResult => {
  validateInput(input);

  const effectiveDirectionDistribution =
    blendDirectionDistribution(
      input.scoutingEstimate.directionDistribution,
      input.neutralDirectionDistribution,
      input.scoutingEstimate.uncertainty,
    );

  const evaluations =
    input.candidates.map((candidate) => {
      const eligible = candidate.alignment.defenders.filter(
        (defender) => (
          input.coveragePlayerIds.includes(
            defender.playerId,
          )
        ),
      );

      const nearestDistanceByDirection =
        Object.fromEntries(
          DIRECTION_BUCKETS.map((bucket) => {
            const anchor =
              input.directionAnchors[bucket];
            const nearest = Math.min(
              ...eligible.map((defender) => (
                distance(defender.start, anchor)
              )),
            );
            return [bucket, nearest];
          }),
        ) as Record<
          BattedBallDirectionBucket,
          number
        >;

      const expectedNearestDistanceMeters =
        DIRECTION_BUCKETS.reduce(
          (total, bucket) => (
            total
            + effectiveDirectionDistribution[bucket]
              * nearestDistanceByDirection[bucket]
          ),
          0,
        );

      return {
        id: candidate.id,
        expectedNearestDistanceMeters,
        nearestDistanceByDirection,
      };
    });

  const ranked = [...evaluations].sort(
    (first, second) => (
      first.expectedNearestDistanceMeters
      - second.expectedNearestDistanceMeters
      || first.id.localeCompare(second.id)
    ),
  );
  const selectedId = ranked[0].id;
  const selected = input.candidates.find(
    (candidate) => candidate.id === selectedId,
  );
  if (selected === undefined) {
    throw new Error(
      'selected defensive alignment candidate must exist',
    );
  }

  return {
    selected,
    evaluations,
    effectiveDirectionDistribution,
  };
};
