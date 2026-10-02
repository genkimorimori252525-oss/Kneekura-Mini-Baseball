import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_V1_ACCEPTED_SCOPE_OUT_GATES,
  evaluateCurrentBaseballPhysicsV1Readiness,
} from './CurrentBaseballPhysicsV1Readiness';

describe('current baseball physics v1 readiness', () => {
  it('promotes only after zero open gates, the release corpus is green, and the exact scope-out set is acknowledged', () => {
    const result =
      evaluateCurrentBaseballPhysicsV1Readiness();

    expect(result.architectureFrozen)
      .toBe(true);
    expect(result.validationPassed)
      .toBe(true);
    expect(result.openGateIds)
      .toEqual([]);
    expect(
      result.explicitlyScopedOutGateIds,
    ).toEqual(
      BASEBALL_PHYSICS_V1_ACCEPTED_SCOPE_OUT_GATES,
    );
    expect(
      result.readyForDefaultPromotion,
    ).toBe(true);
  });
});
