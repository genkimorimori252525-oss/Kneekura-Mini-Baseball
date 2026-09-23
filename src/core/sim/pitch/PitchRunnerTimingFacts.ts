import type { PitchMotionTimeline } from './PitchMotionTimeline';

export type PitchRunnerTimingFacts = Readonly<{
  motionStartUs: number;
  releaseUs: number;
  pitcherReleaseLatencyUs: number;
}>;

export const derivePitchRunnerTimingFacts = (
  timeline: Pick<PitchMotionTimeline, 'motionStartUs' | 'releaseUs'>,
): PitchRunnerTimingFacts => {
  if (
    !Number.isSafeInteger(timeline.motionStartUs) || timeline.motionStartUs < 0
    || !Number.isSafeInteger(timeline.releaseUs)
    || timeline.releaseUs <= timeline.motionStartUs
  ) throw new Error('release must occur after motion start in microseconds');
  return Object.freeze({
    motionStartUs: timeline.motionStartUs,
    releaseUs: timeline.releaseUs,
    pitcherReleaseLatencyUs: timeline.releaseUs - timeline.motionStartUs,
  });
};
