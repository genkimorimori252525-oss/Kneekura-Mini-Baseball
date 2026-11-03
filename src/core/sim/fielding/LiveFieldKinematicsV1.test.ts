import { describe, expect, it } from 'vitest';
import { LIVE_FIELD_KINEMATICS_CALIBRATION_V1, LIVE_FIELD_KINEMATICS_POLICY_V1, LIVE_FIELD_RANGE_CALIBRATION_V1, liveFieldRangeSpecV1,
  liveFieldRunnerAccelerationScaleV1, liveFieldRunnerRangeSpecV1, validateLiveFieldKinematicsPolicyV1 } from './LiveFieldRangeV1';

describe('field kinematics V1', () => {
  it('accepts only the exact policy', () => {
    expect(validateLiveFieldKinematicsPolicyV1(LIVE_FIELD_KINEMATICS_POLICY_V1)).toBe(LIVE_FIELD_KINEMATICS_POLICY_V1);
    expect(() => validateLiveFieldKinematicsPolicyV1({ ...LIVE_FIELD_KINEMATICS_POLICY_V1, extra: 1 } as never)).toThrow();
  });
  it('without the policy keeps the authored outfield break and runner start exactly', () => {
    expect(liveFieldRangeSpecV1({ accelerationMps2: 5, defensivePosition: 'CF' }).accelerationMps2).toBe(5 * LIVE_FIELD_RANGE_CALIBRATION_V1.readOutfieldAccelerationScale);
    expect(liveFieldRunnerRangeSpecV1({ accelerationMps2: 5 }).accelerationMps2).toBe(5 * LIVE_FIELD_RANGE_CALIBRATION_V1.runnerAccelerationScale);
    expect(liveFieldRunnerAccelerationScaleV1()).toBe(LIVE_FIELD_RANGE_CALIBRATION_V1.runnerAccelerationScale);
  });
  it('with the policy uses the Statcast fit for outfielders and runners and leaves infielders alone', () => {
    const k = LIVE_FIELD_KINEMATICS_POLICY_V1;
    expect(liveFieldRangeSpecV1({ accelerationMps2: 5, defensivePosition: 'LF' }, k).accelerationMps2).toBe(5 * LIVE_FIELD_KINEMATICS_CALIBRATION_V1.readOutfieldAccelerationScale);
    expect(liveFieldRangeSpecV1({ accelerationMps2: 5, defensivePosition: 'SS' }, k).accelerationMps2).toBe(5 * LIVE_FIELD_RANGE_CALIBRATION_V1.readyAccelerationScale);
    expect(liveFieldRunnerRangeSpecV1({ accelerationMps2: 5 }, k).accelerationMps2).toBe(5 * LIVE_FIELD_KINEMATICS_CALIBRATION_V1.runnerAccelerationScale);
  });
});
