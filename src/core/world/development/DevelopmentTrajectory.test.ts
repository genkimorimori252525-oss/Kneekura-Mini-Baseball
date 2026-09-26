import { expect, it } from 'vitest';
import { generateDevelopmentTrajectory } from './DevelopmentTrajectory';

const policy = () => ({ policyId: 'synthetic-development',
  profileVersion: 'trajectory-v1', availableAtDay: 10,
  timingWeights: { VERY_EARLY: 1, EARLY: 1, NORMAL: 1,
    LATE: 1, VERY_LATE: 1 },
  shapeWeights: { SHARP_PEAK: 1, BROAD_PLATEAU: 1,
    STEPWISE_WAVES: 1 },
  domainOffsetRanges: {
    PHYSICAL: { min: -2, max: 0 },
    TECHNICAL: { min: -1, max: 2 },
    RECOGNITION: { min: 0, max: 3 },
    ROLE: { min: -1, max: 2 },
    BEHAVIOR: { min: -1, max: 1 },
    RECOVERY: { min: -2, max: 2 },
  },
});
const request = (seed = 123) => ({ careerId: 'career-1',
  playerId: 'player-1', createdAtDay: 10, seed, policy: policy() });

it('generates a reproducible hidden trajectory with separate career RNG provenance', () => {
  const a = generateDevelopmentTrajectory(request());
  const b = generateDevelopmentTrajectory(request());
  expect(a).toEqual(b);
  expect(a).toMatchObject({ careerId: 'career-1', playerId: 'player-1',
    profileVersion: 'trajectory-v1', generation: {
      rngVersion: 'development-xorshift32-v1', seed: 123,
      drawCount: 8, policyId: 'synthetic-development',
    } });
  expect(Object.isFrozen(a.domainOffsets)).toBe(true);
  expect(Object.isFrozen(a.generation)).toBe(true);
  expect(a).not.toHaveProperty('ability');
});

it('can generate all fifteen timing and shape templates without age gates', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 500; seed += 1) {
    const generated = generateDevelopmentTrajectory(request(seed));
    seen.add(`${generated.maturityTiming}/${generated.curveShape}`);
  }
  expect(seen.size).toBe(15);
});

it('rejects invalid calibration and never mutates the source policy', () => {
  const input = request();
  const before = structuredClone(input);
  generateDevelopmentTrajectory(input);
  expect(input).toEqual(before);
  expect(() => generateDevelopmentTrajectory(request(0))).toThrow('seed');
  expect(() => generateDevelopmentTrajectory({ ...input, createdAtDay: 9 }))
    .toThrow('future');
  expect(() => generateDevelopmentTrajectory({ ...input,
    policy: { ...policy(), timingWeights: { ...policy().timingWeights,
      NORMAL: -1 } } })).toThrow('weight');
  expect(() => generateDevelopmentTrajectory({ ...input,
    policy: { ...policy(), domainOffsetRanges: {
      ...policy().domainOffsetRanges, PHYSICAL: { min: 2, max: 1 },
    } } })).toThrow('offset');
});
