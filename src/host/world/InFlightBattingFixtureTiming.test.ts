import { expect, it } from 'vitest';
import { SeedRoot } from '../../core/rng/SeedRoot';
import { applyPitchFatigueToExecution } from '../../core/sim/pitch/PitchFatigueExecution';
import { resolveMotorStart } from '../../core/world/psychology/batting/BattingTiming';
import { request as emotionFixture } from '../../core/world/psychology/execution/ExecutionFixtures.test-support';
import { dispatchCalibrationValues } from './SamePlateAppearanceDispatchCalibration.test-support';
import { inFlightBattingFixtureTiming } from './InFlightBattingFixtureTiming.test-support';

// Exact original ContinuousPitchFixtures timing/release/response declarations,
// with the retained IFN pitch3 ready time and reserved cumulative fatigue0.4.
// This replays only Core timing; it constructs no Native ownership receipt.
const deliveryInput = () => {
  const timing = { baseStartIntervalUs: 10_000_000, normalMotionToReleaseUs: 600_000, followThroughUs: 200_000,
    quickSpeedFactor: 1.8, cadenceExecutionControl: 0.8, cadenceTimingKnowledge: 0.8, quickRepeatability: 0.8,
    naturalVariationUs: 50_000, normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } };
  const effective = applyPitchFatigueToExecution(timing, { velocity: { x: 0, y: 3.5, z: -40 }, spin: { x: 0, y: 0, z: 0 } }, 0.4,
    { policyId: 'response', version: 'v1', availableAtDay: 1, motionDurationScaleAtFullFatigue: 1.5,
      velocityRetentionAtFullFatigue: 0.5, spinRetentionAtFullFatigue: 0.75 }, 10);
  return { root: new SeedRoot(19), outingId: 'outing-1', playId: 7, pitchIndex: 2, readyAtUs: 22_765_369,
    timingProfile: effective.timingProfile, timingIntent: { deliveryMode: 'NORMAL' as const, cadenceIntent: 'STANDARD' as const },
    body: { heightMeters: 1.8, shoulderHeightMeters: 1.5, armReachMeters: 0.8, postureDropMeters: 0.1,
      throwingSide: 'RIGHT' as const, moundReference: { x: 0, y: 0, z: 18 } },
    releaseProfile: { armSlotClass: 'OVERHAND' as const, releaseHeightTier: 'HIGH' as const, releaseHeightRatio: 0.9,
      releaseLateralRatio: 0.1, releaseExtensionRatio: 0.2, armSlotElevationDeg: 70, armSlotAzimuthDeg: 0 }, physics: effective.physics };
};
it('IFT01 declared motor window covers the real cadence-delayed release and original IFN decision schedule', () => {
  const input = deliveryInput(), result = inFlightBattingFixtureTiming(input, input.readyAtUs + 20_000_000);
  expect(result.delivery.release.releaseAtUs).toBe(33_475_140);
  const declared = emotionFixture(), response = dispatchCalibrationValues();
  const decisionTick = result.delivery.release.releaseAtUs + 50_000 + response.batter_observation.deliveryLatencyTicks
    + declared.baseline.swingDecision.tick - declared.baseline.frame.time.tick;
  expect(decisionTick).toBe(33_535_160);
  const earliestMotor = resolveMotorStart(decisionTick, decisionTick, result.geometry.bodyReadyTick, response.batter_motor.motorLatencyTicks);
  expect(input.readyAtUs + 1_000_000).toBeLessThan(decisionTick);
  expect(result.geometry.latestMotorStartTick).toBeGreaterThanOrEqual(earliestMotor);
  expect(result.geometry.latestMotorStartTick).toBeLessThanOrEqual(result.geometry.validUntilTick);
});
it('IFT02 an insufficient original body horizon rejects without extending its declaration', () => {
  const input = deliveryInput();
  expect(() => inFlightBattingFixtureTiming(input, input.readyAtUs)).toThrow('declared stationary-body horizon');
});
