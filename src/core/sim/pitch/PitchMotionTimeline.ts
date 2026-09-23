import {
  normalizePitchMotionPhaseWeights,
  validatePitchTimingProfile,
  type PitchTimingIntent,
  type PitchTimingProfile,
} from './PitchTimingModel';
import type { PitchTimingVariation } from './PitchTimingVariation';

export type PitchMotionTimelineInput = Readonly<{
  readyAtUs: number;
  profile: PitchTimingProfile;
  timingIntent: PitchTimingIntent;
  variation: PitchTimingVariation;
  deliberateExtraHoldUs: number;
}>;

export type PitchMotionTimeline = Readonly<{
  readyAtUs: number;
  motionStartUs: number;
  gatherEndUs: number;
  strideStartUs: number;
  releaseUs: number;
  followThroughEndUs: number;
  deliveryMode: PitchTimingIntent['deliveryMode'];
  cadenceIntent: PitchTimingIntent['cadenceIntent'];
  startIntervalUs: number;
  motionToReleaseUs: number;
  deliberateExtraHoldUs: number;
  naturalDeviationUs: number;
}>;

const checkedTime = (name: string, value: number): number => {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative safe integer microsecond time`);
  }
  return value;
};

export const resolvePitchMotionTimeline = (
  input: PitchMotionTimelineInput,
): PitchMotionTimeline => {
  const profile = validatePitchTimingProfile(input.profile);
  const readyAtUs = checkedTime('readyAtUs', input.readyAtUs);
  const { variation, timingIntent } = input;
  const halfBudget = Math.floor(profile.naturalVariationUs / 2);
  if (
    !Number.isSafeInteger(variation.outingBiasUs)
    || !Number.isSafeInteger(variation.pitchJitterUs)
    || !Number.isSafeInteger(variation.naturalDeviationUs)
    || variation.outingBiasUs + variation.pitchJitterUs !== variation.naturalDeviationUs
    || Math.abs(variation.outingBiasUs) > halfBudget
    || Math.abs(variation.pitchJitterUs) > halfBudget
    || Math.abs(variation.naturalDeviationUs) > 50_000
  ) {
    throw new Error('natural timing deviation exceeds the approved source budget');
  }
  const hold = input.deliberateExtraHoldUs;
  if (timingIntent.cadenceIntent === 'STANDARD') {
    if (hold !== 0) throw new Error('STANDARD cadence cannot add deliberate hold');
  } else if (timingIntent.cadenceIntent === 'DELIBERATE') {
    if (!Number.isSafeInteger(hold) || hold < 100_000 || hold > 400_000) {
      throw new Error('DELIBERATE hold must be +100..400ms');
    }
  } else {
    throw new Error('unknown cadence intent');
  }
  if (timingIntent.deliveryMode !== 'NORMAL' && timingIntent.deliveryMode !== 'QUICK') {
    throw new Error('unknown delivery mode');
  }
  // One natural deviation budget is shared across start and motion. Applying
  // the same jitter twice would move release time by up to 100ms.
  const startDeviationUs = timingIntent.deliveryMode === 'QUICK'
    ? Math.trunc(variation.naturalDeviationUs / 2)
    : variation.naturalDeviationUs;
  const motionDeviationUs = variation.naturalDeviationUs - startDeviationUs;
  const baseMotionUs = timingIntent.deliveryMode === 'QUICK'
    ? Math.round(profile.normalMotionToReleaseUs / profile.quickSpeedFactor)
    : profile.normalMotionToReleaseUs;
  const startIntervalUs = profile.baseStartIntervalUs + startDeviationUs + hold;
  const motionToReleaseUs = baseMotionUs + motionDeviationUs;
  if (!Number.isSafeInteger(startIntervalUs) || startIntervalUs <= 0) {
    throw new Error('start interval must be a positive safe integer');
  }
  if (!Number.isSafeInteger(motionToReleaseUs) || motionToReleaseUs < 3) {
    throw new Error('motion-to-release must fit three positive phases');
  }
  const motionStartUs = checkedTime('motionStartUs', readyAtUs + startIntervalUs);
  const weights = normalizePitchMotionPhaseWeights(
    timingIntent.deliveryMode === 'QUICK'
      ? profile.quickPhaseWeights : profile.normalPhaseWeights,
  );
  const remaining = motionToReleaseUs - 3;
  const gatherUs = 1 + Math.floor(remaining * weights.gather);
  const transitionUs = 1 + Math.floor(remaining * weights.transition);
  const gatherEndUs = checkedTime('gatherEndUs', motionStartUs + gatherUs);
  const strideStartUs = checkedTime('strideStartUs', gatherEndUs + transitionUs);
  const releaseUs = checkedTime('releaseUs', motionStartUs + motionToReleaseUs);
  const followThroughEndUs = checkedTime(
    'followThroughEndUs', releaseUs + profile.followThroughUs,
  );
  return Object.freeze({
    readyAtUs, motionStartUs, gatherEndUs, strideStartUs, releaseUs, followThroughEndUs,
    deliveryMode: timingIntent.deliveryMode,
    cadenceIntent: timingIntent.cadenceIntent,
    startIntervalUs, motionToReleaseUs,
    deliberateExtraHoldUs: hold,
    naturalDeviationUs: variation.naturalDeviationUs,
  });
};
