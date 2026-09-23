import type { SeedRoot } from '../../rng/SeedRoot';
import type { Vec3 } from '../../model/geometry';
import { createCanonicalPitchRelease, type CanonicalPitchRelease } from './CanonicalPitchRelease';
import { resolveDeliberateExtraHoldUs } from './PitchCadenceIntent';
import { resolvePitchMotionTimeline, type PitchMotionTimeline } from './PitchMotionTimeline';
import { derivePitchRunnerTimingFacts, type PitchRunnerTimingFacts } from './PitchRunnerTimingFacts';
import { samplePitchTimingVariation } from './PitchTimingVariation';
import type { PitchTimingIntent, PitchTimingProfile } from './PitchTimingModel';
import {
  resolvePitcherReleasePosition,
  type PitcherBodyReleaseModel,
  type PitcherReleaseGeometryProfile,
} from './PitcherReleaseGeometry';

export type CanonicalPitchDeliveryInput = Readonly<{
  root: SeedRoot;
  outingId: string;
  playId: number;
  pitchIndex: number;
  readyAtUs: number;
  timingProfile: PitchTimingProfile;
  timingIntent: PitchTimingIntent;
  body: PitcherBodyReleaseModel;
  releaseProfile: PitcherReleaseGeometryProfile;
  physics: Readonly<{ velocity: Vec3; spin: Vec3 }>;
}>;

export type CanonicalPitchDelivery = Readonly<{
  timeline: PitchMotionTimeline;
  release: CanonicalPitchRelease;
  runnerTiming: PitchRunnerTimingFacts;
}>;

export const resolveCanonicalPitchDelivery = (
  input: CanonicalPitchDeliveryInput,
): CanonicalPitchDelivery => {
  const variation = samplePitchTimingVariation({
    root: input.root, outingId: input.outingId,
    playId: input.playId, pitchIndex: input.pitchIndex,
    naturalVariationUs: input.timingProfile.naturalVariationUs,
  });
  const deliberateExtraHoldUs = resolveDeliberateExtraHoldUs({
    root: input.root, outingId: input.outingId,
    playId: input.playId, pitchIndex: input.pitchIndex,
    timingIntent: input.timingIntent,
  });
  const timeline = resolvePitchMotionTimeline({
    readyAtUs: input.readyAtUs,
    profile: input.timingProfile,
    timingIntent: input.timingIntent,
    variation, deliberateExtraHoldUs,
  });
  const position = resolvePitcherReleasePosition(input.body, input.releaseProfile);
  const release = createCanonicalPitchRelease(timeline, position, input.physics);
  return Object.freeze({
    timeline, release,
    runnerTiming: derivePitchRunnerTimingFacts(timeline),
  });
};
