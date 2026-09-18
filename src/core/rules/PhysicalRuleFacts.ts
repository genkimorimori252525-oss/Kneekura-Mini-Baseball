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

export type FlyBallFirstFielderTouchFact = Readonly<{
  kind: 'fly_ball_first_fielder_touch';
  fielderId: string;
  tick: number;
}>;

export type RunnerBaseDepartureFact = Readonly<{
  kind: 'runner_base_departure';
  runnerId: string;
  base: BaseballBase;
  tick: number;
}>;

export type DefensiveAppealReason = 'tag_up_early_departure';

export type DefensiveAppealAttemptFact = Readonly<{
  kind: 'defensive_appeal_attempt';
  defenderId: string;
  runnerId: string;
  base: BaseballBase;
  reason: DefensiveAppealReason;
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


export const createFlyBallFirstFielderTouchFact = (
  fielderId: string,
  tick: number,
): FlyBallFirstFielderTouchFact => {
  validateId('fielderId', fielderId);
  validateTick(tick);
  return {
    kind: 'fly_ball_first_fielder_touch',
    fielderId,
    tick,
  };
};

export const createRunnerBaseDepartureFact = (
  runnerId: string,
  base: BaseballBase,
  tick: number,
): RunnerBaseDepartureFact => {
  validateId('runnerId', runnerId);
  validateTick(tick);
  return {
    kind: 'runner_base_departure',
    runnerId,
    base,
    tick,
  };
};


export const createDefensiveAppealAttemptFact = (
  defenderId: string,
  runnerId: string,
  base: BaseballBase,
  reason: DefensiveAppealReason,
  tick: number,
): DefensiveAppealAttemptFact => {
  validateId('defenderId', defenderId);
  validateId('runnerId', runnerId);
  validateTick(tick);
  return {
    kind: 'defensive_appeal_attempt',
    defenderId,
    runnerId,
    base,
    reason,
    tick,
  };
};
