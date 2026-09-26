import { expect, it } from 'vitest';
import { generateStarGenesis } from './StarGenesis';

const potentials = [
  'spotlightPotential', 'pressureStabilityPotential',
  'pressureConversionPotential', 'iconicPotential',
  'publicMagnetismPotential',
] as const;
const ranges = (min: number, max: number) =>
  Object.fromEntries(potentials.map((axis) =>
    [axis, { min, max }])) as Record<typeof potentials[number],
      { min: number; max: number }>;
const policy = {
  policyId: 'star-genesis-1', profileVersion: 'v1',
  availableAtDay: 10,
  tierWeights: { ORDINARY: 100, STAR_CANDIDATE: 1,
    SUPERSTAR_CANDIDATE: 0 },
  potentialRanges: {
    ORDINARY: ranges(0, 0.5),
    STAR_CANDIDATE: ranges(0.4, 0.85),
    SUPERSTAR_CANDIDATE: ranges(0.75, 1),
  },
};
const input = { careerId: 'career-a', playerId: 'player-a',
  createdAtDay: 10, seed: 12345, policy };

it('generates reproducible hidden predisposition with pinned career provenance', () => {
  const first = generateStarGenesis(input);
  expect(generateStarGenesis(input)).toEqual(first);
  expect(first).toMatchObject({ careerId: 'career-a',
    playerId: 'player-a', profileVersion: 'v1',
    generation: { seed: 12345, policyId: 'star-genesis-1' } });
  expect(potentials.every((axis) => first[axis] >= 0
    && first[axis] <= 1)).toBe(true);
  expect(first).not.toHaveProperty('starStatus');
  expect(first).not.toHaveProperty('ability');
  expect(first).not.toHaveProperty('clutchBonus');
});

it('permits generations without candidates and does not force a career outcome', () => {
  const ordinaryOnly = { ...policy, tierWeights: {
    ORDINARY: 1, STAR_CANDIDATE: 0,
    SUPERSTAR_CANDIDATE: 0,
  } };
  const generated = Array.from({ length: 100 }, (_, index) =>
    generateStarGenesis({ ...input, seed: index + 1,
      policy: ordinaryOnly }));
  expect(generated.every((profile) =>
    profile.candidateTier === 'ORDINARY')).toBe(true);
  const extremeOnly = { ...policy, tierWeights: {
    ORDINARY: 0, STAR_CANDIDATE: 0,
    SUPERSTAR_CANDIDATE: 1,
  } };
  const extreme = generateStarGenesis({ ...input,
    policy: extremeOnly });
  expect(extreme.candidateTier).toBe('SUPERSTAR_CANDIDATE');
  expect(extreme).not.toHaveProperty('superstarStatus');
  expect(() => generateStarGenesis({ ...input,
    policy: { ...policy, tierWeights: {
      ORDINARY: 0, STAR_CANDIDATE: 0,
      SUPERSTAR_CANDIDATE: 0 } } })).toThrow('weight');
});

it('rejects future policies and malformed potential ranges', () => {
  expect(() => generateStarGenesis({ ...input,
    policy: { ...policy, availableAtDay: 11 } }))
    .toThrow('policy');
  expect(() => generateStarGenesis({ ...input,
    policy: { ...policy, potentialRanges: {
      ...policy.potentialRanges,
      ORDINARY: { ...ranges(0, 0.5),
        iconicPotential: { min: -1, max: 0.5 } },
    } } })).toThrow('range');
});
