import type { BaseOccupancy } from '../model/CanonicalMatchState';

export type RunnerOriginBase = 0 | 1 | 2 | 3;

export type RunnerOrigin = Readonly<{
  runnerId: string;
  originBase: RunnerOriginBase;
}>;

export type RunnerPrecedence = Readonly<{
  runners: readonly RunnerOrigin[];
}>;

export type RunnerPrecedenceRelation =
  | 'preceding'
  | 'following'
  | 'same';

const origin = (
  runnerId: string,
  originBase: RunnerOriginBase,
): RunnerOrigin => ({
  runnerId,
  originBase,
});

export const createRunnerPrecedence = (
  bases: BaseOccupancy,
  batterRunnerId: string,
): RunnerPrecedence => {
  if (batterRunnerId.length === 0) {
    throw new Error('batterRunnerId must not be empty');
  }

  const runners: RunnerOrigin[] = [
    origin(batterRunnerId, 0),
  ];
  if (bases.first !== null) {
    runners.push(origin(bases.first, 1));
  }
  if (bases.second !== null) {
    runners.push(origin(bases.second, 2));
  }
  if (bases.third !== null) {
    runners.push(origin(bases.third, 3));
  }

  const ids = runners.map((runner) => runner.runnerId);
  if (new Set(ids).size !== ids.length) {
    throw new Error('runner precedence requires unique runner ids');
  }

  return { runners };
};

export const findRunnerOrigin = (
  precedence: RunnerPrecedence,
  runnerId: string,
): RunnerOrigin | null => (
  precedence.runners.find((runner) => runner.runnerId === runnerId)
  ?? null
);

export const compareRunnerPrecedence = (
  precedence: RunnerPrecedence,
  firstRunnerId: string,
  secondRunnerId: string,
): RunnerPrecedenceRelation => {
  const first = findRunnerOrigin(precedence, firstRunnerId);
  const second = findRunnerOrigin(precedence, secondRunnerId);

  if (first === null || second === null) {
    throw new Error('unknown runner in precedence comparison');
  }

  if (first.originBase > second.originBase) {
    return 'preceding';
  }
  if (first.originBase < second.originBase) {
    return 'following';
  }
  return 'same';
};
