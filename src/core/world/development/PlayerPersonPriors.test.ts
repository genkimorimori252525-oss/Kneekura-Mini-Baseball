import { expect, it } from 'vitest';
import { CATALYST_FAMILIES } from './DevelopmentCatalyst';
import { DEVELOPMENT_DOMAINS } from './DevelopmentTrajectory';
import { generatePlayerPersonPriors } from './PlayerPersonPriors';
import { STAR_GENESIS_POTENTIALS } from './StarGenesis';

const offsets = Object.fromEntries(DEVELOPMENT_DOMAINS.map((domain) =>
  [domain, { min: 0, max: 0 }])) as Record<
    typeof DEVELOPMENT_DOMAINS[number], { min: number; max: number }>;
const sensitivity = Object.fromEntries(CATALYST_FAMILIES.map((family) =>
  [family, { min: 0.2, max: 0.8 }])) as Record<
    typeof CATALYST_FAMILIES[number], { min: number; max: number }>;
const potentials = Object.fromEntries(STAR_GENESIS_POTENTIALS.map((axis) =>
  [axis, { min: 0.2, max: 0.8 }])) as Record<
    typeof STAR_GENESIS_POTENTIALS[number], { min: number; max: number }>;
const policies = {
  trajectory: { policyId: 'trajectory-policy-1',
    profileVersion: 'trajectory-v1', availableAtDay: 10,
    timingWeights: { VERY_EARLY: 1, EARLY: 1, NORMAL: 1,
      LATE: 1, VERY_LATE: 1 },
    shapeWeights: { SHARP_PEAK: 1, BROAD_PLATEAU: 1,
      STEPWISE_WAVES: 1 }, domainOffsetRanges: offsets },
  catalyst: { policyId: 'catalyst-policy-1',
    profileVersion: 'catalyst-v1', availableAtDay: 10,
    sensitivityRanges: sensitivity, signatureMotifs: [],
    signatureMotifCount: 0 },
  star: { policyId: 'star-policy-1', profileVersion: 'star-v1',
    availableAtDay: 10,
    tierWeights: { ORDINARY: 100, STAR_CANDIDATE: 1,
      SUPERSTAR_CANDIDATE: 0 },
    potentialRanges: { ORDINARY: potentials,
      STAR_CANDIDATE: potentials,
      SUPERSTAR_CANDIDATE: potentials } },
};
const input = { careerId: 'career-a', playerId: 'player-a',
  createdAtDay: 10, careerSeed: 12345, policies };

it('creates all hidden priors for one Person under one Career scope', () => {
  const profile = generatePlayerPersonPriors(input);
  expect(generatePlayerPersonPriors(input)).toEqual(profile);
  expect(profile).toMatchObject({ careerId: 'career-a',
    playerId: 'player-a', createdAtDay: 10,
    trajectory: { generation: { seed: 12345 } },
    catalyst: { generation: { seed: 12345 } },
    star: { generation: { seed: 12345 } } });
  expect(profile).not.toHaveProperty('ability');
  expect(profile).not.toHaveProperty('starStatus');
  expect(profile).not.toHaveProperty('matchModifier');
});

it('keeps the development priors unchanged by a star policy revision', () => {
  const first = generatePlayerPersonPriors(input);
  const revised = generatePlayerPersonPriors({ ...input,
    policies: { ...policies, star: { ...policies.star,
      policyId: 'star-policy-2',
      tierWeights: { ORDINARY: 0, STAR_CANDIDATE: 0,
        SUPERSTAR_CANDIDATE: 1 } } } });
  expect(revised.trajectory).toEqual(first.trajectory);
  expect(revised.catalyst).toEqual(first.catalyst);
  expect(revised.star.candidateTier).toBe('SUPERSTAR_CANDIDATE');
  expect(() => generatePlayerPersonPriors({ ...input,
    policies: { ...policies, star: {
      ...policies.star, availableAtDay: 11 } } }))
    .toThrow('policy');
});
