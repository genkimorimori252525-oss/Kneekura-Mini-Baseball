import { describe, expect, it } from 'vitest';
import {
  evaluateCurrentBaseballPhysicsV1Readiness,
} from './CurrentBaseballPhysicsV1Readiness';

describe('current baseball physics v1 readiness', () => {
  it('keeps default promotion closed until the final end-to-end corpus exists and scope-outs are accepted', () => {
    const result =
      evaluateCurrentBaseballPhysicsV1Readiness();

    expect(result.architectureFrozen)
      .toBe(true);
    expect(result.validationPassed)
      .toBe(true);
    expect(result.openGateIds)
      .toEqual([
        'end_to_end_validation_corpus',
      ]);
    expect(
      result.explicitlyScopedOutGateIds,
    ).toEqual([
      'infield_dirt_material_profile',
      'natural_grass_material_profile',
      'artificial_turf_material_profile',
      'warning_track_material_profile',
      'wall_padding_material_profile',
      'sliding_friction_calibration',
      'rolling_resistance_calibration',
    ]);
    expect(
      result.readyForDefaultPromotion,
    ).toBe(false);
  });
});
