import { expect, it } from 'vitest';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { resolvePlayerPitchDeliveryFromWorld } from
  './PlayerPitchDeliveryRuntime';

const timingProfile = {
  baseStartIntervalUs: 10_000_000,
  normalMotionToReleaseUs: 600_000,
  followThroughUs: 200_000, quickSpeedFactor: 1.8,
  cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8,
  quickRepeatability: 0.8, naturalVariationUs: 50_000,
  normalPhaseWeights: { gather: 2, transition: 3, stride: 5 },
  quickPhaseWeights: { gather: 1, transition: 2, stride: 3 },
};
const body = { heightMeters: 1.8, shoulderHeightMeters: 1.5,
  armReachMeters: 0.8, postureDropMeters: 0.1,
  throwingSide: 'RIGHT' as const };
const profile = { armSlotClass: 'OVERHAND' as const,
  releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
  releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2,
  armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 };
const input = { careerId: 'career-a', playerId: 'player-a', gameDay: 10,
  moundReference: { x: 0, y: 0, z: 18 },
  root: new SeedRoot(19), outingId: 'outing-a', playId: 7,
  pitchIndex: 0, readyAtUs: 0,
  timingIntent: { deliveryMode: 'NORMAL' as const,
    cadenceIntent: 'STANDARD' as const },
  physics: { velocity: { x: 0, y: 0, z: -30 },
    spin: { x: 0, y: 100, z: 0 } },
};

it('uses one fixed release geometry through varied pitches and a later accepted change', () => {
  const stores = { timing: { selectProfileAtDay: (_careerId: string,
    _playerId: string, atDay: number) => atDay < 20 ? timingProfile
      : { ...timingProfile, normalMotionToReleaseUs: 700_000 } },
    release: { selectAtDay: (_careerId: string, _playerId: string,
      atDay: number) => ({ sourceId: atDay < 20 ? 'baseline' : 'change',
      sourceVersion: 'v1', effectiveDay: atDay < 20 ? 1 : 20,
      body, profile: atDay < 20 ? profile : {
        ...profile, releaseHeightRatio: 0.8,
        releaseHeightTier: 'HIGH_MID' as const },
    }) } };
  const early = Array.from({ length: 12 }, (_, pitchIndex) =>
    resolvePlayerPitchDeliveryFromWorld(stores,
      { ...input, pitchIndex }));
  expect(early.every((delivery) =>
    delivery.release.position.y === early[0].release.position.y))
    .toBe(true);
  expect(new Set(early.map((delivery) =>
    delivery.timeline.releaseUs)).size).toBeGreaterThan(1);
  const later = resolvePlayerPitchDeliveryFromWorld(stores,
    { ...input, gameDay: 20 });
  expect(later.release.position.y).toBeLessThan(early[0].release.position.y);
  expect(later.timeline.motionToReleaseUs)
    .toBeGreaterThan(early[0].timeline.motionToReleaseUs);
  expect(later.release.velocity).toEqual(input.physics.velocity);
});
