import type { PitchMotionTimeline } from './PitchMotionTimeline';

export type PitchMotionMarkers = Pick<PitchMotionTimeline,
  'motionStartUs' | 'gatherEndUs' | 'strideStartUs' | 'releaseUs' | 'followThroughEndUs'>;

export type PitchMotionObservation = Readonly<{
  markers: PitchMotionMarkers;
}>;

export const observePitchMotion = (
  timeline: PitchMotionMarkers,
): PitchMotionObservation => {
  const values = [
    timeline.motionStartUs, timeline.gatherEndUs, timeline.strideStartUs,
    timeline.releaseUs, timeline.followThroughEndUs,
  ];
  if (values.some((value, index) => !Number.isSafeInteger(value)
    || value < 0 || (index > 0 && value <= values[index - 1]))) {
    throw new Error('canonical pitch motion markers must strictly increase');
  }
  return Object.freeze({
    markers: Object.freeze({
      motionStartUs: timeline.motionStartUs,
      gatherEndUs: timeline.gatherEndUs,
      strideStartUs: timeline.strideStartUs,
      releaseUs: timeline.releaseUs,
      followThroughEndUs: timeline.followThroughEndUs,
    }),
  });
};
