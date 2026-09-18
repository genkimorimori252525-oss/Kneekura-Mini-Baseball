export type RunnerDecisionTimingParameters = Readonly<{
  minimumDecisionDelayTicks: number;
  maximumDecisionDelayTicks: number;
  fixedRecognitionOffsetTicks: number;
}>;

export type RunnerDecisionTiming = Readonly<{
  evidenceAvailableAt: number;
  decisionDelayTicks: number;
  decisionTick: number;
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

export const resolveRunnerDecisionTiming = (
  evidenceAvailableAt: number,
  decisionAbility: number,
  parameters: RunnerDecisionTimingParameters,
): RunnerDecisionTiming => {
  validateTick(
    'evidenceAvailableAt',
    evidenceAvailableAt,
  );
  validateTick(
    'minimumDecisionDelayTicks',
    parameters.minimumDecisionDelayTicks,
  );
  validateTick(
    'maximumDecisionDelayTicks',
    parameters.maximumDecisionDelayTicks,
  );
  validateTick(
    'fixedRecognitionOffsetTicks',
    parameters.fixedRecognitionOffsetTicks,
  );

  if (
    parameters.minimumDecisionDelayTicks
    > parameters.maximumDecisionDelayTicks
  ) {
    throw new Error(
      'minimumDecisionDelayTicks must be <= maximumDecisionDelayTicks',
    );
  }
  if (
    !Number.isFinite(decisionAbility)
    || decisionAbility < 0
    || decisionAbility > 1
  ) {
    throw new Error(
      'decisionAbility must be finite and within [0, 1]',
    );
  }

  const abilityDelay = Math.round(
    parameters.maximumDecisionDelayTicks
    - decisionAbility * (
      parameters.maximumDecisionDelayTicks
      - parameters.minimumDecisionDelayTicks
    ),
  );

  const decisionDelayTicks = (
    abilityDelay
    + parameters.fixedRecognitionOffsetTicks
  );
  const decisionTick = (
    evidenceAvailableAt
    + decisionDelayTicks
  );

  if (!Number.isSafeInteger(decisionTick)) {
    throw new Error(
      'decisionTick must be a safe integer',
    );
  }

  return {
    evidenceAvailableAt,
    decisionDelayTicks,
    decisionTick,
  };
};
