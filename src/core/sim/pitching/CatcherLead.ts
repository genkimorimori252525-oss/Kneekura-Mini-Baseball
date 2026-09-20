import { SeedRoot } from '../../rng/SeedRoot';
import type {
  PitcherAggression,
  PitcherAttackZone,
  PitcherVerticalPlan,
} from '../plateAppearance/PlateAppearanceCommand';
import type {
  PlateAppearanceCommandSession,
} from '../plateAppearance/PlateAppearanceCommandSession';

export type CatcherLeadCount = Readonly<{
  balls: 0 | 1 | 2 | 3;
  strikes: 0 | 1 | 2;
}>;

export type CatcherLeadCountAdjustment = Readonly<{
  balls?: CatcherLeadCount['balls'];
  strikes?: CatcherLeadCount['strikes'];
  pitchSkillMultipliers?: Readonly<
    Record<string, number>
  >;
  attackZoneMultipliers?: Partial<
    Record<PitcherAttackZone, number>
  >;
  verticalPlanMultipliers?: Partial<
    Record<PitcherVerticalPlan, number>
  >;
  aggressionMultipliers?: Partial<
    Record<PitcherAggression, number>
  >;
}>;

export type CatcherLeadProfile = Readonly<{
  catcherId: string;
  pitcherId: string;

  /**
   * Learned battery preference. A pitch name is intentionally absent:
   * choices are made by stable pitcher-owned pitchSkillId.
   */
  pitchSkillWeights: Readonly<
    Record<string, number>
  >;
  defaultPitchSkillWeight: number;

  attackZoneWeights: Readonly<
    Record<PitcherAttackZone, number>
  >;
  verticalPlanWeights: Readonly<
    Record<PitcherVerticalPlan, number>
  >;
  aggressionWeights: Readonly<
    Record<PitcherAggression, number>
  >;

  /**
   * Multiplier applied to the manager's broad PA-level directive.
   * 1 = catcher ignores it; >1 = catcher biases calls toward it.
   * The manager still does not choose an exact pitch.
   */
  managerDirectiveMultiplier: number;

  /**
   * Sequence memory. 1 means neutral; below 1 discourages immediate repeats;
   * above 1 allows a battery to intentionally double up.
   */
  repeatPitchSkillMultiplier: number;
  repeatAttackZoneMultiplier: number;
  repeatVerticalPlanMultiplier: number;

  countAdjustments:
    readonly CatcherLeadCountAdjustment[];
}>;

export type CatcherPitchCall = Readonly<{
  catcherId: string;
  pitcherId: string;
  pitchOrdinal: number;
  pitchSkillId: string;
  attackZone: PitcherAttackZone;
  verticalPlan: PitcherVerticalPlan;
  aggression: PitcherAggression;
  count: CatcherLeadCount;
  managerDirective: Readonly<{
    attackZone: PitcherAttackZone;
    verticalPlan: PitcherVerticalPlan;
    aggression: PitcherAggression;
  }>;
}>;

export type CatcherLeadInput = Readonly<{
  session: PlateAppearanceCommandSession;
  profile: CatcherLeadProfile;
  count: CatcherLeadCount;
  pitchOrdinal: number;
  availablePitchSkillIds: readonly string[];
  previousCall?: CatcherPitchCall;
}>;

const ATTACK_ZONES:
  readonly PitcherAttackZone[] = [
    'inside',
    'middle',
    'outside',
  ];

const VERTICAL_PLANS:
  readonly PitcherVerticalPlan[] = [
    'low',
    'middle',
    'high',
  ];

const AGGRESSIONS:
  readonly PitcherAggression[] = [
    'challenge',
    'balanced',
    'waste',
  ];

const validateWeight = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
  ) {
    throw new Error(
      `${name} must be finite and non-negative`,
    );
  }
};

const validatePositiveMultiplier = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value <= 0
  ) {
    throw new Error(
      `${name} must be finite and positive`,
    );
  }
};

const validateProfile = (
  profile: CatcherLeadProfile,
): void => {
  if (profile.catcherId.length === 0) {
    throw new Error(
      'catcherId must not be empty',
    );
  }
  if (profile.pitcherId.length === 0) {
    throw new Error(
      'pitcherId must not be empty',
    );
  }

  validateWeight(
    'defaultPitchSkillWeight',
    profile.defaultPitchSkillWeight,
  );
  for (
    const [pitchSkillId, weight]
    of Object.entries(
      profile.pitchSkillWeights,
    )
  ) {
    if (pitchSkillId.length === 0) {
      throw new Error(
        'pitchSkillWeights keys must not be empty',
      );
    }
    validateWeight(
      'pitchSkillWeight',
      weight,
    );
  }

  for (const zone of ATTACK_ZONES) {
    validateWeight(
      `attackZoneWeights.${zone}`,
      profile.attackZoneWeights[zone],
    );
  }
  for (const plan of VERTICAL_PLANS) {
    validateWeight(
      `verticalPlanWeights.${plan}`,
      profile.verticalPlanWeights[plan],
    );
  }
  for (const aggression of AGGRESSIONS) {
    validateWeight(
      `aggressionWeights.${aggression}`,
      profile.aggressionWeights[
        aggression
      ],
    );
  }

  validatePositiveMultiplier(
    'managerDirectiveMultiplier',
    profile.managerDirectiveMultiplier,
  );
  validatePositiveMultiplier(
    'repeatPitchSkillMultiplier',
    profile.repeatPitchSkillMultiplier,
  );
  validatePositiveMultiplier(
    'repeatAttackZoneMultiplier',
    profile.repeatAttackZoneMultiplier,
  );
  validatePositiveMultiplier(
    'repeatVerticalPlanMultiplier',
    profile.repeatVerticalPlanMultiplier,
  );

  for (const adjustment of profile.countAdjustments) {
    if (
      adjustment.balls !== undefined
      && (
        adjustment.balls < 0
        || adjustment.balls > 3
      )
    ) {
      throw new Error(
        'catcher lead count adjustment balls must be within [0, 3]',
      );
    }
    if (
      adjustment.strikes !== undefined
      && (
        adjustment.strikes < 0
        || adjustment.strikes > 2
      )
    ) {
      throw new Error(
        'catcher lead count adjustment strikes must be within [0, 2]',
      );
    }

    for (const value of Object.values(
      adjustment.pitchSkillMultipliers ?? {},
    )) {
      validatePositiveMultiplier(
        'count pitchSkill multiplier',
        value,
      );
    }
    for (const value of Object.values(
      adjustment.attackZoneMultipliers ?? {},
    )) {
      if (value !== undefined) {
        validatePositiveMultiplier(
          'count attackZone multiplier',
          value,
        );
      }
    }
    for (const value of Object.values(
      adjustment.verticalPlanMultipliers ?? {},
    )) {
      if (value !== undefined) {
        validatePositiveMultiplier(
          'count verticalPlan multiplier',
          value,
        );
      }
    }
    for (const value of Object.values(
      adjustment.aggressionMultipliers ?? {},
    )) {
      if (value !== undefined) {
        validatePositiveMultiplier(
          'count aggression multiplier',
          value,
        );
      }
    }
  }
};

const matchesCount = (
  adjustment: CatcherLeadCountAdjustment,
  count: CatcherLeadCount,
): boolean => (
  (
    adjustment.balls === undefined
    || adjustment.balls === count.balls
  )
  && (
    adjustment.strikes === undefined
    || adjustment.strikes
      === count.strikes
  )
);

const multiply = <
  T extends string,
>(
  weights: Record<T, number>,
  multipliers: Partial<Record<T, number>>,
): void => {
  for (
    const [key, multiplier]
    of Object.entries(multipliers)
  ) {
    if (
      multiplier === undefined
      || weights[key as T] === undefined
    ) {
      continue;
    }
    weights[key as T] *= multiplier;
  }
};

const weightedChoice = <T>(
  values: readonly T[],
  weightOf: (value: T) => number,
  roll: number,
): T => {
  const weights = values.map(weightOf);
  const total = weights.reduce(
    (sum, weight) => sum + weight,
    0,
  );
  if (!(total > 0)) {
    throw new Error(
      'catcher lead weighted choice requires positive total weight',
    );
  }

  let cursor = roll * total;
  for (let index = 0; index < values.length; index += 1) {
    const weight = weights[index]!;
    if (cursor < weight) {
      return values[index]!;
    }
    cursor -= weight;
  }
  return values[values.length - 1]!;
};

export const createCatcherPitchCall = (
  input: CatcherLeadInput,
): CatcherPitchCall => {
  validateProfile(input.profile);

  if (
    !Number.isSafeInteger(input.pitchOrdinal)
    || input.pitchOrdinal < 0
  ) {
    throw new Error(
      'catcher lead pitchOrdinal must be a non-negative safe integer',
    );
  }
  if (
    input.profile.pitcherId.length === 0
    || input.profile.catcherId.length === 0
  ) {
    throw new Error(
      'catcher lead pitcher/catcher ids must not be empty',
    );
  }

  const available = [
    ...new Set(
      input.availablePitchSkillIds,
    ),
  ];
  if (
    available.length === 0
    || available.some(
      (pitchSkillId) =>
        pitchSkillId.length === 0,
    )
  ) {
    throw new Error(
      'catcher lead requires non-empty available pitchSkillIds',
    );
  }

  const pitchWeights = Object.fromEntries(
    available.map(
      (pitchSkillId) => [
        pitchSkillId,
        input.profile.pitchSkillWeights[
          pitchSkillId
        ] ?? input.profile.defaultPitchSkillWeight,
      ],
    ),
  ) as Record<string, number>;

  const attackWeights:
    Record<PitcherAttackZone, number> = {
      ...input.profile.attackZoneWeights,
    };
  const verticalWeights:
    Record<PitcherVerticalPlan, number> = {
      ...input.profile.verticalPlanWeights,
    };
  const aggressionWeights:
    Record<PitcherAggression, number> = {
      ...input.profile.aggressionWeights,
    };

  for (
    const adjustment
    of input.profile.countAdjustments
  ) {
    if (!matchesCount(
      adjustment,
      input.count,
    )) {
      continue;
    }

    for (
      const [
        pitchSkillId,
        multiplier,
      ] of Object.entries(
        adjustment.pitchSkillMultipliers
          ?? {},
      )
    ) {
      if (
        multiplier !== undefined
        && pitchWeights[
          pitchSkillId
        ] !== undefined
      ) {
        pitchWeights[
          pitchSkillId
        ] *= multiplier;
      }
    }
    multiply(
      attackWeights,
      adjustment.attackZoneMultipliers
        ?? {},
    );
    multiply(
      verticalWeights,
      adjustment.verticalPlanMultipliers
        ?? {},
    );
    multiply(
      aggressionWeights,
      adjustment.aggressionMultipliers
        ?? {},
    );
  }

  const manager =
    input.session.command.pitcher;
  attackWeights[
    manager.attackZone
  ] *= input.profile
    .managerDirectiveMultiplier;
  verticalWeights[
    manager.verticalPlan
  ] *= input.profile
    .managerDirectiveMultiplier;
  aggressionWeights[
    manager.aggression
  ] *= input.profile
    .managerDirectiveMultiplier;

  if (
    input.previousCall !== undefined
  ) {
    const previous =
      input.previousCall;

    if (
      pitchWeights[
        previous.pitchSkillId
      ] !== undefined
    ) {
      pitchWeights[
        previous.pitchSkillId
      ] *= input.profile
        .repeatPitchSkillMultiplier;
    }
    attackWeights[
      previous.attackZone
    ] *= input.profile
      .repeatAttackZoneMultiplier;
    verticalWeights[
      previous.verticalPlan
    ] *= input.profile
      .repeatVerticalPlanMultiplier;
  }

  const rng = new SeedRoot(
    input.session.matchSeed,
  ).streamRng(
    input.session.playId,
    'pitch',
    `catcher-lead:${input.profile.catcherId}:${input.profile.pitcherId}:ordinal:${input.pitchOrdinal}`,
  );

  const pitchSkillId =
    weightedChoice(
      available,
      (id) => pitchWeights[id] ?? 0,
      rng.nextFloat(),
    );
  const attackZone =
    weightedChoice(
      ATTACK_ZONES,
      (zone) => attackWeights[zone],
      rng.nextFloat(),
    );
  const verticalPlan =
    weightedChoice(
      VERTICAL_PLANS,
      (plan) => verticalWeights[plan],
      rng.nextFloat(),
    );
  const aggression =
    weightedChoice(
      AGGRESSIONS,
      (value) =>
        aggressionWeights[value],
      rng.nextFloat(),
    );

  return {
    catcherId: input.profile.catcherId,
    pitcherId: input.profile.pitcherId,
    pitchOrdinal: input.pitchOrdinal,
    pitchSkillId,
    attackZone,
    verticalPlan,
    aggression,
    count: input.count,
    managerDirective: {
      ...manager,
    },
  };
};
