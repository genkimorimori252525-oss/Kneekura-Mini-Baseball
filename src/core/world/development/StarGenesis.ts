import { createDevelopmentRandom, UINT32_RANGE } from './DevelopmentRandom';

/** Hidden Person-generation prior. A candidate tier is never a Career status or Match input. */
export const STAR_CANDIDATE_TIERS = [
  'ORDINARY', 'STAR_CANDIDATE', 'SUPERSTAR_CANDIDATE',
] as const;
export const STAR_GENESIS_POTENTIALS = [
  'spotlightPotential', 'pressureStabilityPotential',
  'pressureConversionPotential', 'iconicPotential',
  'publicMagnetismPotential',
] as const;
export type StarCandidateTier = typeof STAR_CANDIDATE_TIERS[number];
export type StarGenesisPotential = typeof STAR_GENESIS_POTENTIALS[number];
export type StarGenesisPolicy = Readonly<{
  policyId: string;
  profileVersion: string;
  availableAtDay: number;
  tierWeights: Readonly<Record<StarCandidateTier, number>>;
  potentialRanges: Readonly<Record<StarCandidateTier,
    Readonly<Record<StarGenesisPotential,
      Readonly<{ min: number; max: number }>>>>>;
}>;
export type StarGenesisGeneration = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  seed: number;
  policy: StarGenesisPolicy;
}>;
export type StarGenesisProfile = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  profileVersion: string;
  candidateTier: StarCandidateTier;
  spotlightPotential: number;
  pressureStabilityPotential: number;
  pressureConversionPotential: number;
  iconicPotential: number;
  publicMagnetismPotential: number;
  generation: Readonly<{
    rngVersion: 'star-genesis-xorshift32-v1';
    seed: number;
    drawCount: 6;
    policyId: string;
  }>;
}>;

const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value.trim() === value;
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;

/** Uses its own salted Career stream and never emits a status or ability modifier. */
export const generateStarGenesis = (
  input: StarGenesisGeneration,
): StarGenesisProfile => {
  if (!fields(input, ['careerId', 'playerId',
    'createdAtDay', 'seed', 'policy'])
    || !id(input.careerId) || !id(input.playerId)
    || !day(input.createdAtDay)) {
    throw new Error('invalid star genesis scope');
  }
  const policy = input.policy;
  if (!fields(policy, ['policyId', 'profileVersion',
    'availableAtDay', 'tierWeights', 'potentialRanges'])
    || !id(policy.policyId) || !id(policy.profileVersion)
    || !day(policy.availableAtDay)
    || policy.availableAtDay > input.createdAtDay) {
    throw new Error('future or invalid star genesis policy');
  }
  if (!fields(policy.tierWeights, STAR_CANDIDATE_TIERS)) {
    throw new Error('invalid star genesis weight keys');
  }
  const weights = STAR_CANDIDATE_TIERS.map((tier) =>
    policy.tierWeights[tier]);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (weights.some((weight) =>
    !Number.isSafeInteger(weight) || weight < 0)
    || total <= 0 || total > UINT32_RANGE) {
    throw new Error('invalid star genesis weight distribution');
  }
  if (!fields(policy.potentialRanges, STAR_CANDIDATE_TIERS)) {
    throw new Error('invalid star genesis potential range keys');
  }
  for (const tier of STAR_CANDIDATE_TIERS) {
    const ranges = policy.potentialRanges[tier];
    if (!fields(ranges, STAR_GENESIS_POTENTIALS)) {
      throw new Error('invalid star genesis potential range keys');
    }
    for (const axis of STAR_GENESIS_POTENTIALS) {
      const range = ranges[axis];
      if (!fields(range, ['min', 'max'])
        || !Number.isFinite(range.min)
        || !Number.isFinite(range.max)
        || range.min < 0 || range.max > 1
        || range.min > range.max) {
        throw new Error('invalid star genesis potential range');
      }
    }
  }
  const next = createDevelopmentRandom(input.seed, 0x7e3b92c1);
  let slot = Math.floor(next() * total);
  let chosen: StarCandidateTier = 'ORDINARY';
  for (const tier of STAR_CANDIDATE_TIERS) {
    slot -= policy.tierWeights[tier];
    if (slot < 0) {
      chosen = tier;
      break;
    }
  }
  const values = Object.fromEntries(STAR_GENESIS_POTENTIALS
    .map((axis) => {
      const { min, max } = policy.potentialRanges[chosen][axis];
      return [axis, min + next() * (max - min)];
    })) as Record<StarGenesisPotential, number>;
  return Object.freeze({ careerId: input.careerId,
    playerId: input.playerId, createdAtDay: input.createdAtDay,
    profileVersion: policy.profileVersion, candidateTier: chosen,
    ...values, generation: Object.freeze({
      rngVersion: 'star-genesis-xorshift32-v1' as const,
      seed: input.seed, drawCount: 6 as const,
      policyId: policy.policyId,
    }) });
};
