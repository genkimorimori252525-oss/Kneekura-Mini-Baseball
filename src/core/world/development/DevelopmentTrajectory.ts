/** Hidden person-generation priors. These do not add to ability or unlock traits. */
export const MATURITY_TIMINGS = [
  'VERY_EARLY', 'EARLY', 'NORMAL', 'LATE', 'VERY_LATE',
] as const;
export const CURVE_SHAPES = [
  'SHARP_PEAK', 'BROAD_PLATEAU', 'STEPWISE_WAVES',
] as const;
export const DEVELOPMENT_DOMAINS = [
  'PHYSICAL', 'TECHNICAL', 'RECOGNITION', 'ROLE',
  'BEHAVIOR', 'RECOVERY',
] as const;
export type MaturityTiming = typeof MATURITY_TIMINGS[number];
export type CurveShape = typeof CURVE_SHAPES[number];
export type DevelopmentDomain = typeof DEVELOPMENT_DOMAINS[number];
export type DevelopmentTrajectoryPolicy = Readonly<{
  policyId: string;
  profileVersion: string;
  availableAtDay: number;
  timingWeights: Readonly<Record<MaturityTiming, number>>;
  shapeWeights: Readonly<Record<CurveShape, number>>;
  domainOffsetRanges: Readonly<Record<DevelopmentDomain,
    Readonly<{ min: number; max: number }>>>;
}>;
export type DevelopmentTrajectoryGeneration = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  seed: number;
  policy: DevelopmentTrajectoryPolicy;
}>;
export type DevelopmentTrajectoryProfile = Readonly<{
  careerId: string;
  playerId: string;
  createdAtDay: number;
  profileVersion: string;
  maturityTiming: MaturityTiming;
  curveShape: CurveShape;
  domainOffsets: Readonly<Record<DevelopmentDomain, number>>;
  generation: Readonly<{
    rngVersion: 'development-xorshift32-v1';
    seed: number;
    drawCount: 8;
    policyId: string;
  }>;
}>;

const UINT32_RANGE = 0x1_0000_0000;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

const weights = <T extends string>(value: unknown,
  names: readonly T[]): Readonly<Record<T, number>> => {
  if (!fields(value, names)) throw new Error('invalid development weight keys');
  const source = value as Record<T, number>;
  const values = names.map((name) => source[name]);
  if (values.some((weight) => !Number.isSafeInteger(weight) || weight < 0)
    || values.reduce((sum, weight) => sum + weight, 0) === 0
    || values.reduce((sum, weight) => sum + weight, 0) > UINT32_RANGE) {
    throw new Error('invalid development weight distribution');
  }
  return Object.freeze(Object.fromEntries(names.map((name) =>
    [name, source[name]])) as Record<T, number>);
};

const ranges = (value: unknown): DevelopmentTrajectoryPolicy['domainOffsetRanges'] => {
  if (!fields(value, DEVELOPMENT_DOMAINS)) {
    throw new Error('invalid development offset keys');
  }
  const source = value as Record<DevelopmentDomain,
    { min: number; max: number }>;
  return Object.freeze(Object.fromEntries(DEVELOPMENT_DOMAINS.map((domain) => {
    const range = source[domain];
    if (!fields(range, ['min', 'max'])
      || !Number.isSafeInteger(range.min)
      || !Number.isSafeInteger(range.max)
      || range.max < range.min
      || range.max - range.min + 1 > UINT32_RANGE) {
      throw new Error('invalid development offset range');
    }
    return [domain, Object.freeze({ min: range.min, max: range.max })];
  })) as Record<DevelopmentDomain, Readonly<{ min: number; max: number }>>);
};

const mixedSeed = (seed: number): number => {
  let value = seed ^ (seed >>> 16);
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0 || 0x9e3779b9;
};

/** Uses an explicit career-development seed, never match physics RNG. */
export const generateDevelopmentTrajectory = (
  input: DevelopmentTrajectoryGeneration,
): DevelopmentTrajectoryProfile => {
  if (!fields(input, ['careerId', 'playerId', 'createdAtDay',
    'seed', 'policy']) || !id(input.careerId) || !id(input.playerId)
    || !day(input.createdAtDay)) {
    throw new Error('invalid development generation scope');
  }
  if (!Number.isSafeInteger(input.seed) || input.seed <= 0
    || input.seed >= UINT32_RANGE) {
    throw new Error('invalid development seed');
  }
  const source = input.policy;
  if (!fields(source, ['policyId', 'profileVersion', 'availableAtDay',
    'timingWeights', 'shapeWeights', 'domainOffsetRanges'])
    || !id(source.policyId) || !id(source.profileVersion)
    || !day(source.availableAtDay)
    || source.availableAtDay > input.createdAtDay) {
    throw new Error('future or invalid development policy');
  }
  const timingWeights = weights(source.timingWeights, MATURITY_TIMINGS);
  const shapeWeights = weights(source.shapeWeights, CURVE_SHAPES);
  const domainOffsetRanges = ranges(source.domainOffsetRanges);
  let rngState = mixedSeed(input.seed);
  const next = (): number => {
    rngState ^= rngState << 13;
    rngState ^= rngState >>> 17;
    rngState ^= rngState << 5;
    rngState >>>= 0;
    return rngState;
  };
  const choose = <T extends string>(names: readonly T[],
    distribution: Readonly<Record<T, number>>): T => {
    const total = names.reduce((sum, name) => sum + distribution[name], 0);
    let slot = Math.floor((next() / UINT32_RANGE) * total);
    for (const name of names) {
      slot -= distribution[name];
      if (slot < 0) return name;
    }
    throw new Error('development weight selection failed');
  };
  const maturityTiming = choose(MATURITY_TIMINGS, timingWeights);
  const curveShape = choose(CURVE_SHAPES, shapeWeights);
  const domainOffsets = Object.freeze(Object.fromEntries(
    DEVELOPMENT_DOMAINS.map((domain) => {
      const { min, max } = domainOffsetRanges[domain];
      return [domain, min + Math.floor((next() / UINT32_RANGE)
        * (max - min + 1))];
    }))) as Record<DevelopmentDomain, number>;
  return Object.freeze({ careerId: input.careerId,
    playerId: input.playerId, createdAtDay: input.createdAtDay,
    profileVersion: source.profileVersion, maturityTiming,
    curveShape, domainOffsets, generation: Object.freeze({
      rngVersion: 'development-xorshift32-v1' as const,
      seed: input.seed, drawCount: 8 as const,
      policyId: source.policyId,
    }) });
};
