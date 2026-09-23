import { expect, it } from 'vitest';
import { observePitchMotion } from './PitchMotionObserver';

it('exports canonical markers without assigning Presentation frame durations', () => {
  const observed = observePitchMotion({
    motionStartUs: 100, gatherEndUs: 200, strideStartUs: 300,
    releaseUs: 400, followThroughEndUs: 500,
  });
  expect(observed.markers).toEqual({
    motionStartUs: 100, gatherEndUs: 200, strideStartUs: 300,
    releaseUs: 400, followThroughEndUs: 500,
  });
  expect(Object.keys(observed)).toEqual(['markers']);
  expect(Object.isFrozen(observed.markers)).toBe(true);
});
