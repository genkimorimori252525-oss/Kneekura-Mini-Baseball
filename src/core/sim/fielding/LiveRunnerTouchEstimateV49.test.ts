import { expect, it } from 'vitest';
import { createLiveRunnerMotionV1 } from '../running/LiveRunnerMotionV1';
import { decideLiveRunnerAdvanceV1, estimateLiveRunnerLegSecondsV1 } from './LiveRunnerAdvancePolicyV1';

it('compares the runner race at the actual bag-disk entry rather than at the later motor stop', () => {
  for (const [distance, radius] of [[27.432, .28], [1, .8], [20, .01], [12, .1], [12, .5]]) {
    const motion = createLiveRunnerMotionV1({ position: { x: 0, z: 0 }, bases: [{ base: 1, position: { x: distance, z: 0 } }],
      topSpeedMps: 8, accelerationMps2: 5, baseTouchRadiusMeters: radius })!;
    expect(estimateLiveRunnerLegSecondsV1(distance, 8, 5, radius)).toBeCloseTo(motion.touches[0].elapsedSeconds, 9);
    const decision = decideLiveRunnerAdvanceV1({ nowSeconds: 3, playStartedAtSeconds: 0, currentBase: 2,
      distanceToNextBaseMeters: distance, baseTouchRadiusMeters: radius, targetOccupied: false,
      runner: { topSpeedMps: 8, accelerationMps2: 5, reactionSeconds: .2 }, forced: false,
      firstGroundContactElapsedSeconds: 1, firstFielderTouchElapsedSeconds: null, defenderControlSeconds: 6 });
    expect(decision.runnerTravelSeconds).toBeCloseTo(motion.touches[0].elapsedSeconds, 9);
  }
});

it('rejects an invalid touch geometry and keeps an omitted radius at the physical center stop', () => {
  const actual = createLiveRunnerMotionV1({ position: { x: 0, z: 0 }, bases: [{ base: 1, position: { x: 27.432, z: 0 } }],
    topSpeedMps: 8, accelerationMps2: 5 })!;
  expect(estimateLiveRunnerLegSecondsV1(27.432, 8, 5)).toBeCloseTo(actual.durationSeconds, 12);
  expect(() => estimateLiveRunnerLegSecondsV1(20, 8, 5, -1)).toThrow(/runner/);
});

it('matches actual touch time across speed abilities, propulsion bands and short braking legs', () => {
  for (const topSpeedMps of [4, 8, 11]) for (const accelerationMps2 of [2, 5, 8])
    for (const distance of [.05, 1, 5, 27.432, 100]) for (const radius of [.01, .28, .8 * distance, distance + 1]) {
      const motion = createLiveRunnerMotionV1({ position: { x: 0, z: 0 }, bases: [{ base: 1, position: { x: distance, z: 0 } }],
        topSpeedMps, accelerationMps2, baseTouchRadiusMeters: radius })!;
      expect(estimateLiveRunnerLegSecondsV1(distance, topSpeedMps, accelerationMps2, radius)).toBeCloseTo(motion.touches[0].elapsedSeconds, 8);
    }
});
