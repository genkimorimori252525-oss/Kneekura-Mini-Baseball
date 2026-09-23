import { expect, it } from 'vitest';
import { derivePitchRunnerTimingFacts } from './PitchRunnerTimingFacts';

it('exposes actual motion-to-release latency to the runner side', () => {
  expect(derivePitchRunnerTimingFacts({ motionStartUs: 100, releaseUs: 350 }))
    .toEqual({ motionStartUs: 100, releaseUs: 350, pitcherReleaseLatencyUs: 250 });
  expect(() => derivePitchRunnerTimingFacts({ motionStartUs: 400, releaseUs: 350 }))
    .toThrow('release');
});
