export type InfieldFlyBattedBallKind =
  | 'fly'
  | 'line_drive'
  | 'bunt';

export type InfieldFlyCatchState =
  | 'caught'
  | 'not_caught'
  | 'unresolved';

export type InfieldFlyRuleInput = Readonly<{
  outsAtStart: number;
  occupiedBases: readonly (1 | 2 | 3)[];
  battedBallKind: InfieldFlyBattedBallKind;
  fair: boolean;
  ordinaryEffortCatchableByInfielder: boolean;
  declarationTick: number;
  catchState: InfieldFlyCatchState;
}>;

export type InfieldFlyRuleResult =
  | Readonly<{
    kind: 'not_infield_fly';
    reason:
      | 'two_outs'
      | 'force_configuration_missing'
      | 'not_fair'
      | 'excluded_batted_ball_kind'
      | 'not_ordinary_effort_infield_catch';
  }>
  | Readonly<{
    kind: 'infield_fly';
    batterRunnerOut: true;
    batterRunnerOutTick: number;
    batterCreatedForceActive: false;
    ballRemainsLive: true;
    runnerState:
      | 'tag_up_required_if_advancing'
      | 'advance_at_risk_without_force'
      | 'pending_catch_resolution';
  }>;

const validateInput = (
  input: InfieldFlyRuleInput,
): void => {
  if (
    !Number.isInteger(input.outsAtStart)
    || input.outsAtStart < 0
    || input.outsAtStart > 2
  ) {
    throw new Error(
      'outsAtStart must be an integer from 0 through 2',
    );
  }
  if (
    !Number.isSafeInteger(input.declarationTick)
    || input.declarationTick < 0
  ) {
    throw new Error(
      'declarationTick must be a non-negative safe integer',
    );
  }

  const seen = new Set<number>();
  for (const base of input.occupiedBases) {
    if (base !== 1 && base !== 2 && base !== 3) {
      throw new Error(
        'occupiedBases must contain only bases 1 through 3',
      );
    }
    if (seen.has(base)) {
      throw new Error(
        'occupiedBases must not repeat a base',
      );
    }
    seen.add(base);
  }
};

export const resolveInfieldFlyRule = (
  input: InfieldFlyRuleInput,
): InfieldFlyRuleResult => {
  validateInput(input);

  if (input.outsAtStart >= 2) {
    return {
      kind: 'not_infield_fly',
      reason: 'two_outs',
    };
  }

  if (
    !input.occupiedBases.includes(1)
    || !input.occupiedBases.includes(2)
  ) {
    return {
      kind: 'not_infield_fly',
      reason: 'force_configuration_missing',
    };
  }

  if (!input.fair) {
    return {
      kind: 'not_infield_fly',
      reason: 'not_fair',
    };
  }

  if (input.battedBallKind !== 'fly') {
    return {
      kind: 'not_infield_fly',
      reason: 'excluded_batted_ball_kind',
    };
  }

  if (!input.ordinaryEffortCatchableByInfielder) {
    return {
      kind: 'not_infield_fly',
      reason: 'not_ordinary_effort_infield_catch',
    };
  }

  const runnerState = input.catchState === 'caught'
    ? 'tag_up_required_if_advancing'
    : input.catchState === 'not_caught'
      ? 'advance_at_risk_without_force'
      : 'pending_catch_resolution';

  return {
    kind: 'infield_fly',
    batterRunnerOut: true,
    batterRunnerOutTick: input.declarationTick,
    batterCreatedForceActive: false,
    ballRemainsLive: true,
    runnerState,
  };
};
