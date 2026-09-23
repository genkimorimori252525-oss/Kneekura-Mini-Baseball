import { expect, it } from 'vitest';
import { observePitchCadence } from './PitchCadenceHistory';

it('uses the median of the last three observed intervals before the current pitch', () => {
  let history: readonly number[] = [];
  for (const interval of [10_000_000, 10_100_000, 9_900_000]) {
    const result = observePitchCadence(history, {
      observedReadyUs: 0, observedMotionStartUs: interval,
    });
    history = result.history;
    expect(result.surprise.surpriseUs).toBeNull();
  }
  const delayed = observePitchCadence(history, {
    observedReadyUs: 20_000_000, observedMotionStartUs: 30_300_000,
  });
  expect(delayed.surprise).toEqual({
    expectedIntervalUs: 10_000_000, observedIntervalUs: 10_300_000,
    surpriseUs: 300_000,
  });
  expect(history).toHaveLength(3);
  expect(delayed.history).toHaveLength(3);
});
