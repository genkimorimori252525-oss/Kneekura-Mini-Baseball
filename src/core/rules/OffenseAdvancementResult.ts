import type {
  BaseOccupancy,
} from '../model/CanonicalMatchState';

export type NaturalRunnerAdvancement =
  | Readonly<{
    runnerId: string;
    outcome: 'safe_advance';
    safelyAdvancedBases: number;
  }>
  | Readonly<{
    runnerId: string;
    outcome: 'retired';
  }>;

export type NaturalPlayAdvancementResult = Readonly<{
  batterRunnerId: string;
  batterReachedFirstSafely: boolean;
  runners: readonly NaturalRunnerAdvancement[];
}>;

const prePitchRunnerIds = (
  bases: BaseOccupancy,
): readonly string[] => [
  bases.first,
  bases.second,
  bases.third,
].filter((runnerId): runnerId is string => runnerId !== null);

const sameRunnerSet = (
  expected: readonly string[],
  actual: readonly string[],
): boolean => (
  expected.length === actual.length
  && expected.every((runnerId) => actual.includes(runnerId))
);

export const createNaturalPlayAdvancementResult = (
  prePitchBases: BaseOccupancy,
  batterRunnerId: string,
  batterReachedFirstSafely: boolean,
  runners: readonly NaturalRunnerAdvancement[],
): NaturalPlayAdvancementResult => {
  if (batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  const runnerIds = runners.map((runner) => runner.runnerId);
  if (new Set(runnerIds).size !== runnerIds.length) {
    throw new Error('natural advancement runner ids must be unique');
  }

  for (const runner of runners) {
    if (runner.runnerId.length === 0) {
      throw new Error('natural advancement runner id must not be empty');
    }
    if (
      runner.outcome === 'safe_advance'
      && (
        !Number.isInteger(runner.safelyAdvancedBases)
        || runner.safelyAdvancedBases < 0
      )
    ) {
      throw new Error(
        'safelyAdvancedBases must be a non-negative integer',
      );
    }
  }

  const expectedIds = prePitchRunnerIds(prePitchBases);
  if (!sameRunnerSet(expectedIds, runnerIds)) {
    throw new Error(
      'natural advancement must include exactly every pre-pitch runner',
    );
  }

  return {
    batterRunnerId,
    batterReachedFirstSafely,
    runners: [...runners],
  };
};

export const satisfiesAlignmentPenaltyAdvanceException = (
  prePitchBases: BaseOccupancy,
  result: NaturalPlayAdvancementResult,
): boolean => {
  const expectedIds = prePitchRunnerIds(prePitchBases);
  const runnerIds = result.runners.map((runner) => runner.runnerId);

  if (!sameRunnerSet(expectedIds, runnerIds)) {
    throw new Error(
      'natural advancement must include exactly every pre-pitch runner',
    );
  }

  if (!result.batterReachedFirstSafely) {
    return false;
  }

  return result.runners.every(
    (runner) => (
      runner.outcome === 'safe_advance'
      && runner.safelyAdvancedBases >= 1
    ),
  );
};
