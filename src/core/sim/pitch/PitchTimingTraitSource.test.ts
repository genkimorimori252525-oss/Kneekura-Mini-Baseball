import { expect, it } from 'vitest';
import { projectPitchTimingTraitSource } from './PitchTimingTraitSource';

it('projects observed timing evidence without importing pitch speed or physics', () => {
  const result = projectPitchTimingTraitSource({
    quickMotionDurationsUs: [300_000, 310_000, 290_000],
    quickRepeatability: 0.8,
    deliberatePitchCount: 2,
    observedSurprisesUs: [200_000, 0, -100_000],
    cadenceExecutionErrorsUs: [10_000, -20_000],
  });
  expect(result.quick.sampleCount).toBe(3);
  expect(result.quick.medianMotionToReleaseUs).toBe(300_000);
  expect(result.cadence.deliberatePitchCount).toBe(2);
  expect(result.cadence.meanAbsoluteObservedSurpriseUs).toBe(100_000);
  expect(result.cadence.meanAbsoluteExecutionErrorUs).toBe(15_000);
  expect(Object.keys(result)).toEqual(['quick', 'cadence']);
});
