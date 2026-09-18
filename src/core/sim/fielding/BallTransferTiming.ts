export type BallTransferTimingParameters = Readonly<{
  minimumTransferDelayTicks: number;
  maximumTransferDelayTicks: number;
  fixedGripOffsetTicks: number;
}>;

export type BallTransferTiming = Readonly<{
  securedPossessionTick: number;
  transferDelayTicks: number;
  throwReadyTick: number;
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

export const resolveBallTransferTiming = (
  securedPossessionTick: number,
  transferAbility: number,
  parameters: BallTransferTimingParameters,
): BallTransferTiming => {
  validateTick(
    'securedPossessionTick',
    securedPossessionTick,
  );
  validateTick(
    'minimumTransferDelayTicks',
    parameters.minimumTransferDelayTicks,
  );
  validateTick(
    'maximumTransferDelayTicks',
    parameters.maximumTransferDelayTicks,
  );
  validateTick(
    'fixedGripOffsetTicks',
    parameters.fixedGripOffsetTicks,
  );

  if (
    parameters.minimumTransferDelayTicks
    > parameters.maximumTransferDelayTicks
  ) {
    throw new Error(
      'minimumTransferDelayTicks must be <= maximumTransferDelayTicks',
    );
  }
  if (
    !Number.isFinite(transferAbility)
    || transferAbility < 0
    || transferAbility > 1
  ) {
    throw new Error(
      'transferAbility must be finite and within [0, 1]',
    );
  }

  const abilityDelay = Math.round(
    parameters.maximumTransferDelayTicks
    - transferAbility * (
      parameters.maximumTransferDelayTicks
      - parameters.minimumTransferDelayTicks
    ),
  );
  const transferDelayTicks = (
    abilityDelay + parameters.fixedGripOffsetTicks
  );
  const throwReadyTick = (
    securedPossessionTick + transferDelayTicks
  );

  if (!Number.isSafeInteger(throwReadyTick)) {
    throw new Error(
      'throwReadyTick must be a safe integer',
    );
  }

  return {
    securedPossessionTick,
    transferDelayTicks,
    throwReadyTick,
  };
};
