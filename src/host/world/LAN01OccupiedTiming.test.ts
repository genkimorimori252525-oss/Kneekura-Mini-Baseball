import { expect, it } from 'vitest';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { liveAppealSceneFixture } from './SamePlateAppearanceLiveAppealScene.test-support';
import { inFlightBattingFixtureTiming } from './InFlightBattingFixtureTiming.test-support';
import { checkSamePaOccupiedPhysicalTiming } from './SamePlateAppearanceOccupiedTiming.test-support';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';

// The accepted LAN inputs, replayed through Core only. No Native row or physical
// result is supplied to an owner, and no accepted fixture policy is replaced.
const original = {
  root: new SeedRoot(19), outingId: 'outing-1', playId: 8, pitchIndex: 0, readyAtUs: 68_602_725,
  timingProfile: { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
    quickSpeedFactor: 1.8, cadenceExecutionControl: .8, cadenceTimingKnowledge: .8, quickRepeatability: .8,
    naturalVariationUs: 50_000, normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } },
  timingIntent: { deliveryMode: 'NORMAL' as const, cadenceIntent: 'STANDARD' as const },
  body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: .8, postureDropMeters: .1,
    throwingSide: 'RIGHT' as const, moundReference: { x: 0, y: 0, z: 18 } },
  releaseProfile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: .9,
    releaseLateralRatio: .1, releaseExtensionRatio: .2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 },
  physics: { velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
};
const policy = { policyId: 'response', version: 'v1', availableAtDay: 1, motionDurationScaleAtFullFatigue: 1.5,
  velocityRetentionAtFullFatigue: .5, spinRetentionAtFullFatigue: .75 };

const nominal = { delivery: { readyAtUs: original.readyAtUs, matchSeed: 19, outingId: original.outingId,
  moundReference: original.body.moundReference, timingIntent: original.timingIntent, physics: original.physics },
  flight: { acceleration: { x: 0, y: 0, z: 0 }, durationUs: 1_500_000 },
  batter: { action: { kind: 'take' as const }, plateZ: 0, ballRadiusMeters: .0366,
    strikeZone: { centerX: 0, halfWidth: .2, lowerY: 1.4, upperY: 1.8 } } };
const check = (duration: number) => checkSamePaOccupiedPhysicalTiming(original, nominal, .4, .6000000000000001,
  policy, 10, original.readyAtUs + duration);

it('LAN timing declaration covers both real TAKEs and the later swing and field search', () => {
  const result = check(liveAppealSceneFixture().occupiedHoldDurationUs);
  expect(result.takes.map(p => p.completedAtTick)).toEqual([80_056_482, 91_694_321]);
  expect(result.takes.every(p => p.completedAtTick <= p.validUntilTick)).toBe(true);
  expect(result.swing.geometry.latestMotorStartTick).toBeLessThanOrEqual(result.swing.geometry.validUntilTick);
  expect(result.fieldSearchThroughTick).toBeLessThan(result.swing.geometry.validUntilTick);
  expect(result.swing.geometry.validUntilTick).toBeLessThanOrEqual(result.holdThroughTick);
});
it('rejects the old twenty-second command before accepting any hold or dependent action', () => {
  expect(() => check(20_000_000)).toThrow('TAKE exceeds declared hold horizon');
});
it('a new swing needs its own posture interval rather than the preceding TAKE interval', () => {
  const result = check(liveAppealSceneFixture().occupiedHoldDurationUs), ready = result.takes[1].completedAtTick;
  const effective = applyPitchFatigueToExecution(original.timingProfile,
    { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } }, .6000000000000001, policy, 10);
  const input = { ...original, ...effective, readyAtUs: ready, pitchIndex: 2 };
  expect(() => inFlightBattingFixtureTiming(input, result.takes[1].validUntilTick)).toThrow('declared stationary-body horizon');
  expect(inFlightBattingFixtureTiming(input, result.swing.geometry.validUntilTick)).toEqual(result.swing);
});
it('rejects a hold that covers both TAKEs but ends before the later field search', () => {
  const result = check(liveAppealSceneFixture().occupiedHoldDurationUs);
  expect(() => check(result.fieldSearchThroughTick - original.readyAtUs - 1)).toThrow('field search exceeds declared hold horizon');
});
