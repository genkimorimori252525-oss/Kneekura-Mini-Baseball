import type {
  BaseOccupancy,
} from '../model/CanonicalMatchState';

export type WalkForcedAdvancementInput = Readonly<{
  batterRunnerId: string;
  bases: BaseOccupancy;
}>;

export type WalkForcedAdvancementResult = Readonly<{
  bases: BaseOccupancy;
  scoredRunnerIds: readonly string[];
}>;

const validateRunnerIds = (
  input: WalkForcedAdvancementInput,
): void => {
  if (input.batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  const occupied = [
    input.bases.first,
    input.bases.second,
    input.bases.third,
  ].filter((value): value is string => value !== null);

  if (
    occupied.some((runnerId) => runnerId.length === 0)
    || new Set(occupied).size !== occupied.length
  ) {
    throw new Error(
      'walk advancement requires unique occupied runner ids',
    );
  }
  if (occupied.includes(input.batterRunnerId)) {
    throw new Error(
      'batterRunnerId must not already occupy a base',
    );
  }
};

export const resolveWalkForcedAdvancement = (
  input: WalkForcedAdvancementInput,
): WalkForcedAdvancementResult => {
  validateRunnerIds(input);

  const first = input.bases.first;
  const second = input.bases.second;
  const third = input.bases.third;

  if (first === null) {
    return {
      bases: {
        first: input.batterRunnerId,
        second,
        third,
      },
      scoredRunnerIds: [],
    };
  }

  if (second === null) {
    return {
      bases: {
        first: input.batterRunnerId,
        second: first,
        third,
      },
      scoredRunnerIds: [],
    };
  }

  if (third === null) {
    return {
      bases: {
        first: input.batterRunnerId,
        second: first,
        third: second,
      },
      scoredRunnerIds: [],
    };
  }

  return {
    bases: {
      first: input.batterRunnerId,
      second: first,
      third: second,
    },
    scoredRunnerIds: [third],
  };
};
