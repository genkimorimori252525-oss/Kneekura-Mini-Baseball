import type {
  RunnerMotionIntent,
} from './RunnerMotion';
import {
  resolveRunnerDecisionTiming,
  type RunnerDecisionTimingParameters,
} from './RunnerDecisionTiming';

export type RundownDirection = -1 | 0 | 1;

export type RundownBaseRaceEstimate = Readonly<{
  runnerArrivalTick: number;
  defenderTagTick: number | null;
}>;

export type RundownDecisionInput = Readonly<{
  observationTick: number;
  currentDirection: RundownDirection;
  towardAdvance: RundownBaseRaceEstimate;
  towardRetreat: RundownBaseRaceEstimate;
  switchHysteresisTicks: number;
  decisionAbility: number;
  timingParameters: RunnerDecisionTimingParameters;
}>;

export type RundownMotionDecision = Readonly<{
  motionIntent: RunnerMotionIntent;
  decisionTick: number;
  advanceSafetyMarginTicks: number;
  retreatSafetyMarginTicks: number;
  switchedDirection: boolean;
}>;

const validateTick = (
  name: string,
  tick: number,
): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(
      `${name} must be a non-negative safe integer tick`,
    );
  }
};

const validateRace = (
  name: string,
  race: RundownBaseRaceEstimate,
  observationTick: number,
): void => {
  validateTick(
    `${name}.runnerArrivalTick`,
    race.runnerArrivalTick,
  );
  if (race.runnerArrivalTick < observationTick) {
    throw new Error(
      `${name}.runnerArrivalTick must not precede observationTick`,
    );
  }

  if (race.defenderTagTick !== null) {
    validateTick(
      `${name}.defenderTagTick`,
      race.defenderTagTick,
    );
    if (race.defenderTagTick < observationTick) {
      throw new Error(
        `${name}.defenderTagTick must not precede observationTick`,
      );
    }
  }
};

const safetyMargin = (
  race: RundownBaseRaceEstimate,
): number => (
  race.defenderTagTick === null
    ? Number.POSITIVE_INFINITY
    : (
        race.defenderTagTick
        - race.runnerArrivalTick
      )
);

const materiallySafer = (
  candidateMargin: number,
  currentMargin: number,
  hysteresisTicks: number,
): boolean => {
  if (
    candidateMargin === Number.POSITIVE_INFINITY
    && currentMargin !== Number.POSITIVE_INFINITY
  ) {
    return true;
  }
  if (
    candidateMargin === Number.POSITIVE_INFINITY
    && currentMargin === Number.POSITIVE_INFINITY
  ) {
    return false;
  }
  if (
    currentMargin === Number.POSITIVE_INFINITY
  ) {
    return false;
  }

  return (
    candidateMargin
    > currentMargin + hysteresisTicks
  );
};

const chooseDirection = (
  currentDirection: RundownDirection,
  advanceMargin: number,
  retreatMargin: number,
  hysteresisTicks: number,
): RundownDirection => {
  if (currentDirection === 1) {
    return materiallySafer(
      retreatMargin,
      advanceMargin,
      hysteresisTicks,
    )
      ? -1
      : 1;
  }

  if (currentDirection === -1) {
    return materiallySafer(
      advanceMargin,
      retreatMargin,
      hysteresisTicks,
    )
      ? 1
      : -1;
  }

  if (
    advanceMargin === Number.POSITIVE_INFINITY
    && retreatMargin === Number.POSITIVE_INFINITY
  ) {
    return 0;
  }

  if (
    materiallySafer(
      advanceMargin,
      retreatMargin,
      hysteresisTicks,
    )
  ) {
    return 1;
  }

  if (
    materiallySafer(
      retreatMargin,
      advanceMargin,
      hysteresisTicks,
    )
  ) {
    return -1;
  }

  return 0;
};

const motionKindForDirection = (
  direction: RundownDirection,
): RunnerMotionIntent['kind'] => {
  if (direction > 0) {
    return 'advance';
  }
  if (direction < 0) {
    return 'retreat';
  }
  return 'hold';
};

export const decideRundownMotionIntent = (
  input: RundownDecisionInput,
): RundownMotionDecision => {
  validateTick(
    'observationTick',
    input.observationTick,
  );
  if (
    input.currentDirection !== -1
    && input.currentDirection !== 0
    && input.currentDirection !== 1
  ) {
    throw new Error(
      'currentDirection must be -1, 0, or 1',
    );
  }
  if (
    !Number.isSafeInteger(
      input.switchHysteresisTicks,
    )
    || input.switchHysteresisTicks < 0
  ) {
    throw new Error(
      'switchHysteresisTicks must be a non-negative safe integer tick',
    );
  }
  if (
    !Number.isFinite(input.decisionAbility)
    || input.decisionAbility < 0
    || input.decisionAbility > 1
  ) {
    throw new Error(
      'decisionAbility must be finite and within [0, 1]',
    );
  }

  validateRace(
    'towardAdvance',
    input.towardAdvance,
    input.observationTick,
  );
  validateRace(
    'towardRetreat',
    input.towardRetreat,
    input.observationTick,
  );

  const advanceSafetyMarginTicks =
    safetyMargin(input.towardAdvance);
  const retreatSafetyMarginTicks =
    safetyMargin(input.towardRetreat);

  const direction = chooseDirection(
    input.currentDirection,
    advanceSafetyMarginTicks,
    retreatSafetyMarginTicks,
    input.switchHysteresisTicks,
  );

  const timing = resolveRunnerDecisionTiming(
    input.observationTick,
    input.decisionAbility,
    input.timingParameters,
  );

  return {
    motionIntent: {
      kind: motionKindForDirection(direction),
      issuedTick: timing.decisionTick,
    },
    decisionTick: timing.decisionTick,
    advanceSafetyMarginTicks,
    retreatSafetyMarginTicks,
    switchedDirection: (
      input.currentDirection !== 0
      && direction !== input.currentDirection
    ),
  };
};
