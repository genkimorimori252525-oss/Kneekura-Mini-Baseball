export type PitcherAttackZone =
  | 'inside'
  | 'middle'
  | 'outside';

export type PitcherVerticalPlan =
  | 'low'
  | 'middle'
  | 'high';

export type PitcherAggression =
  | 'challenge'
  | 'balanced'
  | 'waste';

export type BatterApproach =
  | 'take'
  | 'balanced'
  | 'aggressive';

export type BatterSwingBias =
  | 'early'
  | 'neutral'
  | 'late';

export type RunnerPosture =
  | 'conservative'
  | 'balanced'
  | 'aggressive';

export type PlateAppearanceCommand = Readonly<{
  pitcher: Readonly<{
    attackZone: PitcherAttackZone;
    verticalPlan: PitcherVerticalPlan;
    aggression: PitcherAggression;
  }>;
  batter: Readonly<{
    approach: BatterApproach;
    swingBias: BatterSwingBias;
  }>;
  runners: Readonly<{
    posture: RunnerPosture;
  }>;
}>;

const assertOneOf = (
  name: string,
  value: string,
  allowed: readonly string[],
  description: string,
): void => {
  if (!allowed.includes(value)) {
    throw new Error(
      `${name} must be ${description}`,
    );
  }
};

export const createPlateAppearanceCommand = (
  input: PlateAppearanceCommand,
): PlateAppearanceCommand => {
  assertOneOf(
    'pitcher.attackZone',
    input.pitcher.attackZone,
    ['inside', 'middle', 'outside'],
    'inside, middle, or outside',
  );
  assertOneOf(
    'pitcher.verticalPlan',
    input.pitcher.verticalPlan,
    ['low', 'middle', 'high'],
    'low, middle, or high',
  );
  assertOneOf(
    'pitcher.aggression',
    input.pitcher.aggression,
    ['challenge', 'balanced', 'waste'],
    'challenge, balanced, or waste',
  );
  assertOneOf(
    'batter.approach',
    input.batter.approach,
    ['take', 'balanced', 'aggressive'],
    'take, balanced, or aggressive',
  );
  assertOneOf(
    'batter.swingBias',
    input.batter.swingBias,
    ['early', 'neutral', 'late'],
    'early, neutral, or late',
  );
  assertOneOf(
    'runners.posture',
    input.runners.posture,
    ['conservative', 'balanced', 'aggressive'],
    'conservative, balanced, or aggressive',
  );

  return {
    pitcher: { ...input.pitcher },
    batter: { ...input.batter },
    runners: { ...input.runners },
  };
};
