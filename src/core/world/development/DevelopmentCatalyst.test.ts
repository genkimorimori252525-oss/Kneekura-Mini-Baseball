import { expect, it } from 'vitest';
import { CATALYST_FAMILIES,
  generateDevelopmentCatalystProfile } from './DevelopmentCatalyst';

const policy = () => ({ policyId: 'synthetic-catalyst',
  profileVersion: 'catalyst-v1', availableAtDay: 10,
  sensitivityRanges: Object.fromEntries(CATALYST_FAMILIES.map((family) =>
    [family, { min: 0.1, max: 0.9 }])) as Record<
      typeof CATALYST_FAMILIES[number], { min: number; max: number }>,
  signatureMotifs: [
    { motifId: 'mentor-bond', weight: 1 },
    { motifId: 'role-change', weight: 1 },
    { motifId: 'elite-exposure', weight: 1 },
  ],
  signatureMotifCount: 2,
});
const request = (seed = 321) => ({ careerId: 'career-1',
  playerId: 'player-1', createdAtDay: 10, seed, policy: policy() });

it('generates repeatable hidden catalyst affinities and distinct motifs', () => {
  const a = generateDevelopmentCatalystProfile(request());
  expect(a).toEqual(generateDevelopmentCatalystProfile(request()));
  expect(a).toMatchObject({ careerId: 'career-1', playerId: 'player-1',
    profileVersion: 'catalyst-v1', generation: {
      rngVersion: 'development-xorshift32-v1', seed: 321,
      policyId: 'synthetic-catalyst',
      drawCount: CATALYST_FAMILIES.length + 2,
    } });
  expect(Object.keys(a.sensitivityByFamily)).toHaveLength(
    CATALYST_FAMILIES.length);
  expect(a.signatureMotifs).toHaveLength(2);
  expect(new Set(a.signatureMotifs).size).toBe(2);
  expect(Object.isFrozen(a.sensitivityByFamily)).toBe(true);
  expect(Object.isFrozen(a.signatureMotifs)).toBe(true);
  expect(a).not.toHaveProperty('ability');
});

it('keeps catalyst affinity probabilistic rather than guaranteed by a motif', () => {
  const generated = Array.from({ length: 30 }, (_, index) =>
    generateDevelopmentCatalystProfile(request(index + 1)));
  expect(new Set(generated.map((item) =>
    item.sensitivityByFamily.UNEXPECTED_SUCCESS)).size).toBeGreaterThan(1);
  expect(generated.every((item) =>
    item.sensitivityByFamily.UNEXPECTED_SUCCESS > 0
      && item.sensitivityByFamily.UNEXPECTED_SUCCESS < 1)).toBe(true);
});

it('rejects invalid or future calibration without modifying caller data', () => {
  const input = request();
  const before = structuredClone(input);
  generateDevelopmentCatalystProfile(input);
  expect(input).toEqual(before);
  expect(() => generateDevelopmentCatalystProfile(request(0)))
    .toThrow('seed');
  expect(() => generateDevelopmentCatalystProfile({ ...input,
    policy: { ...policy(), availableAtDay: 11 } })).toThrow('future');
  expect(() => generateDevelopmentCatalystProfile({ ...input,
    policy: { ...policy(), sensitivityRanges: {
      ...policy().sensitivityRanges,
      UNEXPECTED_SUCCESS: { min: 0.9, max: 1.1 },
    } } })).toThrow('sensitivity');
  expect(() => generateDevelopmentCatalystProfile({ ...input,
    policy: { ...policy(), signatureMotifs: [
      { motifId: 'same', weight: 1 }, { motifId: 'same', weight: 1 },
    ] } })).toThrow('motif');
});
