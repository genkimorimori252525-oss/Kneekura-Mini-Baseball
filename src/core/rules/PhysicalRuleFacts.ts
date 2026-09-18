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

export type ControlledRunnerTagFact = Readonly<{
  kind: 'controlled_runner_tag';
  defenderId: string;
  runnerId: string;
  tick: number;
}>;

export type PlayEndReason = 'live_action_complete' | 'dead_ball';

export type PlayEndFact = Readonly<{
  kind: 'play_end';
  tick: number;
  reason: PlayEndReason;
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


export const createControlledRunnerTagFact = (
  defenderId: string,
  runnerId: string,
  tick: number,
): ControlledRunnerTagFact => {
  validateId('defenderId', defenderId);
  validateId('runnerId', runnerId);
  validateTick(tick);
  return {
    kind: 'controlled_runner_tag',
    defenderId,
    runnerId,
    tick,
  };
};


export const createPlayEndFact = (
  tick: number,
  reason: PlayEndReason,
): PlayEndFact => {
  validateTick(tick);
  return {
    kind: 'play_end',
    tick,
    reason,
  };
};
