import { createDevelopmentRandom, UINT32_RANGE } from './DevelopmentRandom';

/** Doc53 catalyst families. The family and motif labels never confer a bonus. */
export const CATALYST_FAMILIES = [
  'UNEXPECTED_SUCCESS', 'FAILURE_HUMILIATION',
  'COMPETITIVE_PROVOCATION', 'INJURY_REHAB',
  'TECHNICAL_DISCOVERY', 'COACH_MENTOR', 'ELITE_EXPOSURE',
  'ROLE_CHANGE', 'RESPONSIBILITY_TRUST', 'ROSTER_COMPETITION',
  'PROMOTION_DEMOTION', 'ENVIRONMENT_CHANGE', 'MAJOR_STAGE',
  'RELATIONSHIP_TRANSITION', 'CAREER_THREAT',
  'MILESTONE_RECOGNITION', 'TEACHING_LEADERSHIP',
  'OPPONENT_PUZZLE', 'DATA_INSIGHT',
] as const;
export type CatalystFamily = typeof CATALYST_FAMILIES[number];
export type DevelopmentCatalystPolicy = Readonly<{
  policyId: string;
  profileVersion: string;
  availableAtDay: number;
  sensitivityRanges: Readonly<Record<CatalystFamily,
    Readonly<{ min: number; max: number }>>>;
  signatureMotifs: readonly Readonly<{ motifId: string; weight: number }>[];
  signatureMotifCount: number;
}>;
export type DevelopmentCatalystGeneration = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  seed: number;
  policy: DevelopmentCatalystPolicy;
}>;
export type DevelopmentCatalystProfile = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  profileVersion: string;
  sensitivityByFamily: Readonly<Record<CatalystFamily, number>>;
  signatureMotifs: readonly string[];
  generation: Readonly<{
    rngVersion: 'development-xorshift32-v1';
    seed: number;
    policyId: string;
    drawCount: number;
  }>;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

/** Person-generation only. Consumers must not expose or use this for decisions. */
export const generateDevelopmentCatalystProfile = (
  input: DevelopmentCatalystGeneration,
): DevelopmentCatalystProfile => {
  if (!fields(input, ['careerId', 'playerId', 'createdAtDay',
    'seed', 'policy']) || !id(input.careerId) || !id(input.playerId)
    || !day(input.createdAtDay)) {
    throw new Error('invalid development catalyst generation scope');
  }
  // Domain separation prevents the same seed from coupling trajectory and motifs.
  const next = createDevelopmentRandom(input.seed, 0x6c8e9cf5);
  const source = input.policy;
  if (!fields(source, ['policyId', 'profileVersion', 'availableAtDay',
    'sensitivityRanges', 'signatureMotifs', 'signatureMotifCount'])
    || !id(source.policyId) || !id(source.profileVersion)
    || !day(source.availableAtDay)
    || source.availableAtDay > input.createdAtDay) {
    throw new Error('future or invalid development catalyst policy');
  }
  if (!fields(source.sensitivityRanges, CATALYST_FAMILIES)) {
    throw new Error('invalid catalyst sensitivity keys');
  }
  const sensitivityByFamily = Object.freeze(Object.fromEntries(
    CATALYST_FAMILIES.map((family) => {
      const range = source.sensitivityRanges[family];
      if (!fields(range, ['min', 'max'])
        || !Number.isFinite(range.min) || !Number.isFinite(range.max)
        || range.min < 0 || range.max > 1 || range.min > range.max) {
        throw new Error('invalid catalyst sensitivity range');
      }
      return [family, range.min + next() * (range.max - range.min)];
    }))) as Record<CatalystFamily, number>;
  if (!Array.isArray(source.signatureMotifs)
    || !Number.isSafeInteger(source.signatureMotifCount)
    || source.signatureMotifCount < 0
    || source.signatureMotifCount > source.signatureMotifs.length) {
    throw new Error('invalid catalyst motif count');
  }
  const motifs = source.signatureMotifs.map((motif) => {
    if (!fields(motif, ['motifId', 'weight']) || !id(motif.motifId)
      || !Number.isSafeInteger(motif.weight)
      || motif.weight <= 0 || motif.weight > UINT32_RANGE) {
      throw new Error('invalid catalyst motif');
    }
    return { motifId: motif.motifId, weight: motif.weight };
  });
  if (new Set(motifs.map((motif) => motif.motifId)).size
    !== motifs.length
    || motifs.reduce((sum, motif) => sum + motif.weight, 0)
      > UINT32_RANGE) {
    throw new Error('duplicate or oversized catalyst motif distribution');
  }
  const remaining = [...motifs];
  const signatureMotifs: string[] = [];
  for (let draw = 0; draw < source.signatureMotifCount; draw += 1) {
    const total = remaining.reduce((sum, motif) => sum + motif.weight, 0);
    let slot = Math.floor(next() * total);
    const index = remaining.findIndex((motif) => {
      slot -= motif.weight;
      return slot < 0;
    });
    signatureMotifs.push(remaining.splice(index, 1)[0]!.motifId);
  }
  return Object.freeze({ careerId: input.careerId,
    playerId: input.playerId, createdAtDay: input.createdAtDay,
    profileVersion: source.profileVersion, sensitivityByFamily,
    signatureMotifs: Object.freeze(signatureMotifs),
    generation: Object.freeze({
      rngVersion: 'development-xorshift32-v1' as const,
      seed: input.seed, policyId: source.policyId,
      drawCount: CATALYST_FAMILIES.length + source.signatureMotifCount,
    }) });
};
