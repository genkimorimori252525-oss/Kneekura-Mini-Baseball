import { SeedRoot } from '../../rng/SeedRoot';
import type {
  PitcherAggression,
  PitcherAttackZone,
  PitcherVerticalPlan,
} from '../plateAppearance/PlateAppearanceCommand';
import type {
  CatcherPitchCall,
} from './CatcherLead';

export type PitcherSignBehaviorProfile = Readonly<{
  pitcherId: string;

  /**
   * Behavioral tendency to reject the catcher's requested pitch/location.
   * 0 = always accept; 1 = always use the pitcher's own plan.
   *
   * This is a personality/decision trait only. It never changes trajectory
   * quality or outcome directly.
   */
  signAutonomy: number;

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
   * When overriding, this multiplier can preserve some attraction toward the
   * catcher's requested choice. Values below 1 model a stronger desire to do
   * something different; above 1 model "I chose it myself, but agree".
   */
  catcherCallRetentionMultiplier: number;
}>;

export type PitcherSignDecision =
  | Readonly<{
      kind: 'accepted_catcher_call';
      autonomyRoll: number;
      catcherCall: CatcherPitchCall;
      finalCall: CatcherPitchCall;
    }>
  | Readonly<{
      kind: 'pitcher_override';
      autonomyRoll: number;
      catcherCall: CatcherPitchCall;
      finalCall: CatcherPitchCall;
    }>;

export type PitcherSignDecisionInput = Readonly<{
  matchSeed: number;
  playId: number;
  availablePitchSkillIds: readonly string[];
  catcherCall: CatcherPitchCall;
  behavior: PitcherSignBehaviorProfile;
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

const validateProbability = (
  name: string,
  value: number,
): void => {
  if (
    !Number.isFinite(value)
    || value < 0
    || value > 1
  ) {
    throw new Error(
      `${name} must be finite within [0, 1]`,
    );
  }
};

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

const validatePositive = (
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
      'pitcher sign decision requires positive total choice weight',
    );
  }

  let cursor = roll * total;
  for (
    let index = 0;
    index < values.length;
    index += 1
  ) {
    const weight = weights[index]!;
    if (cursor < weight) {
      return values[index]!;
    }
    cursor -= weight;
  }
  return values[values.length - 1]!;
};

const validateBehavior = (
  behavior: PitcherSignBehaviorProfile,
): void => {
  if (behavior.pitcherId.length === 0) {
    throw new Error(
      'pitcher sign behavior pitcherId must not be empty',
    );
  }
  validateProbability(
    'signAutonomy',
    behavior.signAutonomy,
  );
  validateWeight(
    'defaultPitchSkillWeight',
    behavior.defaultPitchSkillWeight,
  );
  validatePositive(
    'catcherCallRetentionMultiplier',
    behavior.catcherCallRetentionMultiplier,
  );

  for (const value of Object.values(
    behavior.pitchSkillWeights,
  )) {
    validateWeight(
      'pitchSkillWeight',
      value,
    );
  }
  for (const zone of ATTACK_ZONES) {
    validateWeight(
      `attackZoneWeights.${zone}`,
      behavior.attackZoneWeights[zone],
    );
  }
  for (const plan of VERTICAL_PLANS) {
    validateWeight(
      `verticalPlanWeights.${plan}`,
      behavior.verticalPlanWeights[plan],
    );
  }
  for (const aggression of AGGRESSIONS) {
    validateWeight(
      `aggressionWeights.${aggression}`,
      behavior.aggressionWeights[
        aggression
      ],
    );
  }
};

export const resolvePitcherSignDecision = (
  input: PitcherSignDecisionInput,
): PitcherSignDecision => {
  validateBehavior(input.behavior);

  if (
    input.behavior.pitcherId
    !== input.catcherCall.pitcherId
  ) {
    throw new Error(
      'pitcher sign behavior pitcherId must match catcher call pitcherId',
    );
  }
  const available = [
    ...new Set(
      input.availablePitchSkillIds,
    ),
  ];
  if (
    available.length === 0
    || available.some((id) => id.length === 0)
  ) {
    throw new Error(
      'pitcher sign decision requires non-empty available pitchSkillIds',
    );
  }
  if (
    !available.includes(
      input.catcherCall.pitchSkillId,
    )
  ) {
    throw new Error(
      'catcher-selected pitchSkillId must be available to pitcher',
    );
  }

  const rng = new SeedRoot(
    input.matchSeed,
  ).streamRng(
    input.playId,
    'pitch',
    `pitcher-sign:${input.behavior.pitcherId}:ordinal:${input.catcherCall.pitchOrdinal}`,
  );
  const autonomyRoll = rng.nextFloat();

  if (
    autonomyRoll
    >= input.behavior.signAutonomy
  ) {
    return {
      kind: 'accepted_catcher_call',
      autonomyRoll,
      catcherCall: input.catcherCall,
      finalCall: input.catcherCall,
    };
  }

  const pitchWeights = Object.fromEntries(
    available.map((id) => [
      id,
      input.behavior.pitchSkillWeights[id]
        ?? input.behavior.defaultPitchSkillWeight,
    ]),
  ) as Record<string, number>;
  const attackWeights = {
    ...input.behavior.attackZoneWeights,
  };
  const verticalWeights = {
    ...input.behavior.verticalPlanWeights,
  };
  const aggressionWeights = {
    ...input.behavior.aggressionWeights,
  };

  pitchWeights[
    input.catcherCall.pitchSkillId
  ] *= input.behavior
    .catcherCallRetentionMultiplier;
  attackWeights[
    input.catcherCall.attackZone
  ] *= input.behavior
    .catcherCallRetentionMultiplier;
  verticalWeights[
    input.catcherCall.verticalPlan
  ] *= input.behavior
    .catcherCallRetentionMultiplier;
  aggressionWeights[
    input.catcherCall.aggression
  ] *= input.behavior
    .catcherCallRetentionMultiplier;

  const finalCall: CatcherPitchCall = {
    ...input.catcherCall,
    pitchSkillId: weightedChoice(
      available,
      (id) => pitchWeights[id] ?? 0,
      rng.nextFloat(),
    ),
    attackZone: weightedChoice(
      ATTACK_ZONES,
      (zone) => attackWeights[zone],
      rng.nextFloat(),
    ),
    verticalPlan: weightedChoice(
      VERTICAL_PLANS,
      (plan) => verticalWeights[plan],
      rng.nextFloat(),
    ),
    aggression: weightedChoice(
      AGGRESSIONS,
      (value) =>
        aggressionWeights[value],
      rng.nextFloat(),
    ),
  };

  return {
    kind: 'pitcher_override',
    autonomyRoll,
    catcherCall: input.catcherCall,
    finalCall,
  };
};
