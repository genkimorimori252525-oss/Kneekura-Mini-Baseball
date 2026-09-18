import type {
  BattedBallDirectionBucket,
  BattedBallTrajectoryBucket,
  DirectionDistribution,
  TrajectoryDistribution,
} from '../../model/BatterTendency';

export type ScoutedBattedBallObservation = Readonly<{
  direction: BattedBallDirectionBucket;
  trajectory: BattedBallTrajectoryBucket;
  observedAtSequence: number;
}>;

export type ScoutingEstimatePrior = Readonly<{
  directionDistribution: DirectionDistribution;
  trajectoryDistribution: TrajectoryDistribution;
}>;

export type ScoutingEstimateParameters = Readonly<{
  priorWeight: number;
  recencyDecayPerObservation: number;
}>;

export type ScoutingEstimate = Readonly<{
  directionDistribution: DirectionDistribution;
  trajectoryDistribution: TrajectoryDistribution;
  uncertainty: number;
  effectiveSampleSize: number;
  sampleAgeObservations: number | null;
  observationCount: number;
}>;

export type BuildScoutingEstimateInput = Readonly<{
  observations: readonly ScoutedBattedBallObservation[];
  currentSequence: number;
  prior: ScoutingEstimatePrior;
  parameters: ScoutingEstimateParameters;
}>;

const DIRECTION_BUCKETS = [
  'pull',
  'middle',
  'opposite',
] as const satisfies readonly BattedBallDirectionBucket[];

const TRAJECTORY_BUCKETS = [
  'ground',
  'line',
  'fly',
  'popup',
] as const satisfies readonly BattedBallTrajectoryBucket[];

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

const validateInput = (
  input: BuildScoutingEstimateInput,
): void => {
  if (
    !Number.isSafeInteger(input.currentSequence)
    || input.currentSequence < 0
  ) {
    throw new Error(
      'currentSequence must be a non-negative safe integer',
    );
  }
  if (
    !Number.isFinite(input.parameters.priorWeight)
    || input.parameters.priorWeight <= 0
  ) {
    throw new Error(
      'priorWeight must be finite and positive',
    );
  }
  if (
    !Number.isFinite(
      input.parameters.recencyDecayPerObservation,
    )
    || input.parameters.recencyDecayPerObservation < 0
  ) {
    throw new Error(
      'recencyDecayPerObservation must be finite and non-negative',
    );
  }

  validateDistribution(
    'prior directionDistribution',
    input.prior.directionDistribution,
  );
  validateDistribution(
    'prior trajectoryDistribution',
    input.prior.trajectoryDistribution,
  );

  for (const observation of input.observations) {
    if (
      !Number.isSafeInteger(
        observation.observedAtSequence,
      )
      || observation.observedAtSequence < 0
    ) {
      throw new Error(
        'observedAtSequence must be a non-negative safe integer',
      );
    }
    if (
      observation.observedAtSequence
      > input.currentSequence
    ) {
      throw new Error(
        'observedAtSequence must not exceed currentSequence',
      );
    }
  }
};

const observationWeight = (
  age: number,
  decay: number,
): number => Math.exp(-decay * age);

export const buildScoutingEstimate = (
  input: BuildScoutingEstimateInput,
): ScoutingEstimate => {
  validateInput(input);

  const directionMass: Record<
    BattedBallDirectionBucket,
    number
  > = {
    pull: (
      input.prior.directionDistribution.pull
      * input.parameters.priorWeight
    ),
    middle: (
      input.prior.directionDistribution.middle
      * input.parameters.priorWeight
    ),
    opposite: (
      input.prior.directionDistribution.opposite
      * input.parameters.priorWeight
    ),
  };
  const trajectoryMass: Record<
    BattedBallTrajectoryBucket,
    number
  > = {
    ground: (
      input.prior.trajectoryDistribution.ground
      * input.parameters.priorWeight
    ),
    line: (
      input.prior.trajectoryDistribution.line
      * input.parameters.priorWeight
    ),
    fly: (
      input.prior.trajectoryDistribution.fly
      * input.parameters.priorWeight
    ),
    popup: (
      input.prior.trajectoryDistribution.popup
      * input.parameters.priorWeight
    ),
  };

  let effectiveSampleSize = 0;
  let weightedAgeTotal = 0;

  for (const observation of input.observations) {
    const age = (
      input.currentSequence
      - observation.observedAtSequence
    );
    const weight = observationWeight(
      age,
      input.parameters.recencyDecayPerObservation,
    );

    directionMass[observation.direction] += weight;
    trajectoryMass[observation.trajectory] += weight;
    effectiveSampleSize += weight;
    weightedAgeTotal += age * weight;
  }

  const totalMass = (
    input.parameters.priorWeight
    + effectiveSampleSize
  );

  const directionDistribution =
    Object.fromEntries(
      DIRECTION_BUCKETS.map((bucket) => [
        bucket,
        directionMass[bucket] / totalMass,
      ]),
    ) as Record<
      BattedBallDirectionBucket,
      number
    >;

  const trajectoryDistribution =
    Object.fromEntries(
      TRAJECTORY_BUCKETS.map((bucket) => [
        bucket,
        trajectoryMass[bucket] / totalMass,
      ]),
    ) as Record<
      BattedBallTrajectoryBucket,
      number
    >;

  return {
    directionDistribution,
    trajectoryDistribution,
    uncertainty: effectiveSampleSize <= 0
      ? 1
      : (
          input.parameters.priorWeight
          / totalMass
        ),
    effectiveSampleSize,
    sampleAgeObservations:
      effectiveSampleSize <= 0
        ? null
        : weightedAgeTotal / effectiveSampleSize,
    observationCount: input.observations.length,
  };
};
