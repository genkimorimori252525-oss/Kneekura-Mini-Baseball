import { expect, it } from 'vitest';
import { SeedRoot } from '../../rng/SeedRoot';
import { resolveCanonicalPitchDelivery } from './CanonicalPitchDelivery';

const base = {
  root: new SeedRoot(19), outingId: 'outing-a', playId: 7, pitchIndex: 0,
  readyAtUs: 0,
  timingProfile: {
    baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000,
    followThroughUs: 200_000, quickSpeedFactor: 1.8,
    cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8,
    quickRepeatability: 0.8, naturalVariationUs: 50_000,
    normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
    quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
  },
  body: {
    heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8,
    postureDropMeters: 0.1, throwingSide: 'RIGHT' as const,
    moundReference: { x: 0, y: 0, z: 18 },
  },
  releaseProfile: {
    armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const,
    releaseHeightRatio: 0.9, releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2,
    armSlotElevationDeg: 70, armSlotAzimuthDeg: 0,
  },
  physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
};

it('replays deterministic timing while 100 pitches keep the same release position and physics', () => {
  const deliveries = Array.from({ length: 100 }, (_, pitchIndex) =>
    resolveCanonicalPitchDelivery({
      ...base, pitchIndex,
      timingIntent: {
        deliveryMode: pitchIndex % 2 ? 'QUICK' as const : 'NORMAL' as const,
        cadenceIntent: pitchIndex % 3 ? 'STANDARD' as const : 'DELIBERATE' as const,
      },
    }));
  for (const delivery of deliveries) {
    expect(delivery.release.position).toEqual(deliveries[0].release.position);
    expect(delivery.release.velocity).toEqual(base.physics.velocity);
    expect(delivery.release.spin).toEqual(base.physics.spin);
    expect(delivery.release.releaseAtUs).toBe(delivery.timeline.releaseUs);
    expect(delivery.runnerTiming.pitcherReleaseLatencyUs)
      .toBe(delivery.timeline.motionToReleaseUs);
    expect(Math.abs(delivery.timeline.naturalDeviationUs)).toBeLessThanOrEqual(50_000);
  }
  expect(resolveCanonicalPitchDelivery({
    ...base, pitchIndex: 37,
    timingIntent: { deliveryMode: 'QUICK', cadenceIntent: 'STANDARD' },
  })).toEqual(deliveries[37]);
});
