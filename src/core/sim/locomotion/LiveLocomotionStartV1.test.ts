import { describe, expect, it } from 'vitest';
import { buildLiveSpeedPlanV84, createLiveLocomotionProfileV84, liveReachableSpeedV84, withLivePropulsionShapeV84 } from './LiveLocomotionV84';
import { LIVE_FIELD_KINEMATICS_CALIBRATION_V1, LIVE_FIELD_RANGE_CALIBRATION_V1, LIVE_LOCOMOTION_START_CALIBRATION_V1,
  LIVE_LOCOMOTION_START_POLICY_V1, validateLiveLocomotionStartPolicyV1 } from '../fielding/LiveFieldRangeV1';

const FT = .3048, top = 27.39 * FT, shape = LIVE_LOCOMOTION_START_CALIBRATION_V1.shape;
/** Seconds from rest to this distance, running through it. */
const split = (feet: number, accelerationMps2: number, topSpeedMps = top) => {
  const profile = createLiveLocomotionProfileV84({ topSpeedMps, accelerationMps2 }), meters = feet * FT;
  return buildLiveSpeedPlanV84({ profile, distanceMeters: meters, initialSpeedMps: 0, finalSpeedMps: liveReachableSpeedV84(profile, 0, meters) })!.durationSeconds;
};
const runner = 5.4 * LIVE_FIELD_KINEMATICS_CALIBRATION_V1.runnerAccelerationScale;

describe('locomotion start V1', () => {
  it('accepts only the exact policy', () => {
    expect(validateLiveLocomotionStartPolicyV1(LIVE_LOCOMOTION_START_POLICY_V1)).toBe(LIVE_LOCOMOTION_START_POLICY_V1);
    expect(() => validateLiveLocomotionStartPolicyV1({ ...LIVE_LOCOMOTION_START_POLICY_V1, extra: 1 } as never)).toThrow();
  });

  it('keeps the authored bands exact when no shape is given', () => {
    const p = createLiveLocomotionProfileV84({ topSpeedMps: 8.1, accelerationMps2: 5.4 });
    expect(p.propulsionBands.map(b => b.accelerationMps2)).toEqual([5.4, 5.4 * .7, 5.4 * .35]);
    expect('propulsionShape' in p).toBe(false);
    expect(split(5, runner)).toBeCloseTo(.64, 2);
  });

  it('runs the 2025 Statcast splits from first movement inside the fitted shape', () => {
    withLivePropulsionShapeV84(shape, () => {
      for (const [feet, seconds] of [[5, .55], [10, .87], [30, 1.80], [60, 2.94], [90, 4.03]] as const)
        expect(Math.abs(split(feet, runner) - seconds)).toBeLessThan(.02);
    });
  });

  it('leaves the infield ten yards and the outfield break where they were, and the shape ends with its scope', () => {
    const tenYards = (a: number) => split(30, a, 27.3 * FT);
    const before = tenYards(5.4 * LIVE_FIELD_RANGE_CALIBRATION_V1.readyAccelerationScale);
    const after = withLivePropulsionShapeV84(shape, () => tenYards(5.4 * LIVE_FIELD_RANGE_CALIBRATION_V1.readyAccelerationScale));
    expect(Math.abs(after - before)).toBeLessThan(.02);
    expect(after).toBeCloseTo(1.75, 1);
    expect(createLiveLocomotionProfileV84({ topSpeedMps: 8.1, accelerationMps2: 5.4 }).propulsionShape).toBeUndefined();
  });

  it('rejects a shape whose bands do not rise to top speed', () => {
    expect(() => withLivePropulsionShapeV84({ through: [.8, .5, 1], share: [1, 1, 1] }, () => 0)).toThrow();
  });
});
