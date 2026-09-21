import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
} from '../sim/ball/BaseballPhysicsV1';
import {
  evaluateCurrentBaseballPhysicsV1Readiness,
} from './CurrentBaseballPhysicsV1Readiness';

describe('current baseball physics v1 readiness', () => {
  it('keeps architecture freeze separate from empirical production readiness', () => {
    const result =
      evaluateCurrentBaseballPhysicsV1Readiness();

    expect(result.architectureFrozen)
      .toBe(true);
    expect(result.validationPassed)
      .toBe(true);
    expect(result.openGateIds)
      .toEqual(
        BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
      );
    expect(
      result.readyForDefaultPromotion,
    ).toBe(false);
  });
});
