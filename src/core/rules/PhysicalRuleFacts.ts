export type BaseballBase = 1 | 2 | 3 | 4;

export type RunnerBaseTouchFact = Readonly<{
  kind: 'runner_base_touch';
  runnerId: string;
  base: BaseballBase;
  tick: number;
}>;

export type ControlledBaseContactFact = Readonly<{
  kind: 'controlled_base_contact';
  defenderId: string;
  base: BaseballBase;
  tick: number;
}>;

const validateTick = (tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error('physical rule fact tick must be a non-negative safe integer');
  }
};

const validateId = (name: string, value: string): void => {
  if (value.length === 0) {
    throw new Error(`${name} must not be empty`);
  }
};

export const createRunnerBaseTouchFact = (
  runnerId: string,
  base: BaseballBase,
  tick: number,
): RunnerBaseTouchFact => {
  validateId('runnerId', runnerId);
  validateTick(tick);
  return {
    kind: 'runner_base_touch',
    runnerId,
    base,
    tick,
  };
};

export const createControlledBaseContactFact = (
  defenderId: string,
  base: BaseballBase,
  tick: number,
): ControlledBaseContactFact => {
  validateId('defenderId', defenderId);
  validateTick(tick);
  return {
    kind: 'controlled_base_contact',
    defenderId,
    base,
    tick,
  };
};
