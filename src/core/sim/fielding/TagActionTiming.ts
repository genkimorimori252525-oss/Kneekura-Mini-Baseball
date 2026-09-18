export type TagActionTimingParameters = Readonly<{
  minimumTagActionDelayTicks: number;
  maximumTagActionDelayTicks: number;
  fixedPossessionOffsetTicks: number;
}>;

export type TagActionTiming = Readonly<{
  possessionReadyTick: number;
  tagActionDelayTicks: number;
  tagActionStartTick: number;
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

export const resolveTagActionTiming = (
  possessionReadyTick: number,
  tagSkill: number,
  parameters: TagActionTimingParameters,
): TagActionTiming => {
  validateTick(
    'possessionReadyTick',
    possessionReadyTick,
  );
  validateTick(
    'minimumTagActionDelayTicks',
    parameters.minimumTagActionDelayTicks,
  );
  validateTick(
    'maximumTagActionDelayTicks',
    parameters.maximumTagActionDelayTicks,
  );
  validateTick(
    'fixedPossessionOffsetTicks',
    parameters.fixedPossessionOffsetTicks,
  );

  if (
    parameters.minimumTagActionDelayTicks
    > parameters.maximumTagActionDelayTicks
  ) {
    throw new Error(
      'minimumTagActionDelayTicks must be <= maximumTagActionDelayTicks',
    );
  }
  if (
    !Number.isFinite(tagSkill)
    || tagSkill < 0
    || tagSkill > 1
  ) {
    throw new Error(
      'tagSkill must be finite and within [0, 1]',
    );
  }

  const abilityDelay = Math.round(
    parameters.maximumTagActionDelayTicks
    - tagSkill * (
      parameters.maximumTagActionDelayTicks
      - parameters.minimumTagActionDelayTicks
    ),
  );
  const tagActionDelayTicks = (
    abilityDelay + parameters.fixedPossessionOffsetTicks
  );
  const tagActionStartTick = (
    possessionReadyTick + tagActionDelayTicks
  );

  if (!Number.isSafeInteger(tagActionStartTick)) {
    throw new Error(
      'tagActionStartTick must be a safe integer',
    );
  }

  return {
    possessionReadyTick,
    tagActionDelayTicks,
    tagActionStartTick,
  };
};
