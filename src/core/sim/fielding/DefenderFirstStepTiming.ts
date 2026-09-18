export type DefenderFirstStepTimingParameters = Readonly<{
  minimumFirstStepDelayTicks: number;
  maximumFirstStepDelayTicks: number;
  fixedMotorOffsetTicks: number;
}>;

export type DefenderFirstStepTiming = Readonly<{
  recognitionTick: number;
  firstStepDelayTicks: number;
  movementStartTick: number;
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

export const resolveDefenderFirstStepTiming = (
  recognitionTick: number,
  firstStepAbility: number,
  parameters: DefenderFirstStepTimingParameters,
): DefenderFirstStepTiming => {
  validateTick('recognitionTick', recognitionTick);
  validateTick(
    'minimumFirstStepDelayTicks',
    parameters.minimumFirstStepDelayTicks,
  );
  validateTick(
    'maximumFirstStepDelayTicks',
    parameters.maximumFirstStepDelayTicks,
  );
  validateTick(
    'fixedMotorOffsetTicks',
    parameters.fixedMotorOffsetTicks,
  );

  if (
    parameters.minimumFirstStepDelayTicks
    > parameters.maximumFirstStepDelayTicks
  ) {
    throw new Error(
      'minimumFirstStepDelayTicks must be <= maximumFirstStepDelayTicks',
    );
  }
  if (
    !Number.isFinite(firstStepAbility)
    || firstStepAbility < 0
    || firstStepAbility > 1
  ) {
    throw new Error(
      'firstStepAbility must be finite and within [0, 1]',
    );
  }

  const abilityDelay = Math.round(
    parameters.maximumFirstStepDelayTicks
    - firstStepAbility * (
      parameters.maximumFirstStepDelayTicks
      - parameters.minimumFirstStepDelayTicks
    ),
  );
  const firstStepDelayTicks = (
    abilityDelay + parameters.fixedMotorOffsetTicks
  );
  const movementStartTick = (
    recognitionTick + firstStepDelayTicks
  );

  if (!Number.isSafeInteger(movementStartTick)) {
    throw new Error(
      'movementStartTick must be a safe integer',
    );
  }

  return {
    recognitionTick,
    firstStepDelayTicks,
    movementStartTick,
  };
};
