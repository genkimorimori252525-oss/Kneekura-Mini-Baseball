export type BattedBallDirectionBucket =
  | 'pull'
  | 'middle'
  | 'opposite';

export type BattedBallTrajectoryBucket =
  | 'ground'
  | 'line'
  | 'fly'
  | 'popup';

export type DirectionDistribution = Readonly<
  Record<BattedBallDirectionBucket, number>
>;

export type TrajectoryDistribution = Readonly<
  Record<BattedBallTrajectoryBucket, number>
>;

export type BatterTendencyContextAdjustment = Readonly<{
  contextKey: string;
  directionDistribution: DirectionDistribution;
  trajectoryDistribution: TrajectoryDistribution;
}>;

export type BatterTrueTendency = Readonly<{
  directionDistribution: DirectionDistribution;
  trajectoryDistribution: TrajectoryDistribution;
  contextAdjustments:
    readonly BatterTendencyContextAdjustment[];
}>;

export type BatterTrueTendencyInput = Readonly<{
  directionDistribution: DirectionDistribution;
  trajectoryDistribution: TrajectoryDistribution;
  contextAdjustments:
    readonly BatterTendencyContextAdjustment[];
}>;

const SUM_TOLERANCE = 1e-9;

const validateDistribution = (
  name: string,
  values: Readonly<Record<string, number>>,
): void => {
  const probabilities = Object.values(values);
  if (
    probabilities.some(
      (value) => !Number.isFinite(value) || value < 0,
    )
  ) {
    throw new Error(
      `${name} probabilities must be finite and non-negative`,
    );
  }

  const sum = probabilities.reduce(
    (total, value) => total + value,
    0,
  );
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    throw new Error(
      `${name} probabilities must sum to 1`,
    );
  }
};

export const createBatterTrueTendency = (
  input: BatterTrueTendencyInput,
): BatterTrueTendency => {
  validateDistribution(
    'directionDistribution',
    input.directionDistribution,
  );
  validateDistribution(
    'trajectoryDistribution',
    input.trajectoryDistribution,
  );

  for (const adjustment of input.contextAdjustments) {
    if (adjustment.contextKey.length === 0) {
      throw new Error(
        'contextKey must not be empty',
      );
    }
    validateDistribution(
      'context directionDistribution',
      adjustment.directionDistribution,
    );
    validateDistribution(
      'context trajectoryDistribution',
      adjustment.trajectoryDistribution,
    );
  }

  return {
    directionDistribution: {
      ...input.directionDistribution,
    },
    trajectoryDistribution: {
      ...input.trajectoryDistribution,
    },
    contextAdjustments:
      input.contextAdjustments.map((adjustment) => ({
        contextKey: adjustment.contextKey,
        directionDistribution: {
          ...adjustment.directionDistribution,
        },
        trajectoryDistribution: {
          ...adjustment.trajectoryDistribution,
        },
      })),
  };
};
