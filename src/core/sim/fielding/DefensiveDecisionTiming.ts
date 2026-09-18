export type DefensiveDecisionTimingParameters = Readonly<{
  minimumDecisionDelayTicks: number;
  maximumDecisionDelayTicks: number;
  fixedProcessingOffsetTicks: number;
}>;

export type DefensiveDecisionTiming = Readonly<{
  evidenceAvailableAt: number;
  decisionDelayTicks: number;
  decisionTick: number;
}>;

const validateTick = (name: string, tick: number): void => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error(`${name} must be a non-negative safe integer tick`);
  }
};

const validateParameters = (
  parameters: DefensiveDecisionTimingParameters,
): void => {
  validateTick('minimumDecisionDelayTicks', parameters.minimumDecisionDelayTicks);
  validateTick('maximumDecisionDelayTicks', parameters.maximumDecisionDelayTicks);
  validateTick('fixedProcessingOffsetTicks', parameters.fixedProcessingOffsetTicks);

  if (parameters.minimumDecisionDelayTicks > parameters.maximumDecisionDelayTicks) {
    throw new Error(
      'minimumDecisionDelayTicks must be <= maximumDecisionDelayTicks',
    );
  }
};

export const resolveDefensiveDecisionTiming = (
  evidenceAvailableAt: number,
  situationalAwareness: number,
  parameters: DefensiveDecisionTimingParameters,
): DefensiveDecisionTiming => {
  validateTick('evidenceAvailableAt', evidenceAvailableAt);
  validateParameters(parameters);

  if (
    !Number.isFinite(situationalAwareness)
    || situationalAwareness < 0
    || situationalAwareness > 1
  ) {
    throw new Error('situationalAwareness must be finite and within [0, 1]');
  }

  const awarenessDelay = Math.round(
    parameters.maximumDecisionDelayTicks
    - situationalAwareness * (
      parameters.maximumDecisionDelayTicks
      - parameters.minimumDecisionDelayTicks
    ),
  );

  const decisionDelayTicks = (
    awarenessDelay + parameters.fixedProcessingOffsetTicks
  );
  const decisionTick = evidenceAvailableAt + decisionDelayTicks;

  if (!Number.isSafeInteger(decisionTick)) {
    throw new Error('decisionTick must be a safe integer');
  }

  return {
    evidenceAvailableAt,
    decisionDelayTicks,
    decisionTick,
  };
};
