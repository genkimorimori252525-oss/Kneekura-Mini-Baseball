import type { PitchMotionTimeline } from './PitchMotionTimeline';

export type PitchSequencingEvidence = Readonly<{
  deliveryMode: PitchMotionTimeline['deliveryMode'];
  cadenceIntent: PitchMotionTimeline['cadenceIntent'];
  intendedHoldChangeUs: number;
  realizedHoldChangeUs: number;
  cadenceSurpriseUs: number | null;
}>;

export const derivePitchSequencingEvidence = (input: Readonly<{
  timeline: Pick<PitchMotionTimeline,
    'deliveryMode' | 'cadenceIntent' | 'deliberateExtraHoldUs' | 'startIntervalUs'>;
  baseStartIntervalUs: number;
  cadenceSurpriseUs: number | null;
}>): PitchSequencingEvidence => {
  if (
    !Number.isSafeInteger(input.baseStartIntervalUs) || input.baseStartIntervalUs <= 0
    || !Number.isSafeInteger(input.timeline.startIntervalUs)
    || input.timeline.startIntervalUs <= 0
    || !Number.isSafeInteger(input.timeline.deliberateExtraHoldUs)
    || (input.cadenceSurpriseUs !== null && !Number.isSafeInteger(input.cadenceSurpriseUs))
  ) throw new Error('sequencing evidence requires integer microsecond timing');
  return Object.freeze({
    deliveryMode: input.timeline.deliveryMode,
    cadenceIntent: input.timeline.cadenceIntent,
    intendedHoldChangeUs: input.timeline.deliberateExtraHoldUs,
    realizedHoldChangeUs: input.timeline.startIntervalUs - input.baseStartIntervalUs,
    cadenceSurpriseUs: input.cadenceSurpriseUs,
  });
};
