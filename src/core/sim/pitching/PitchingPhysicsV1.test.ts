import { describe, expect, it } from 'vitest';
import {
  PITCHING_PHYSICS_ARCHITECTURE_VERSION,
  PITCHING_PHYSICS_V1_CALIBRATION_REMAINS_VERSIONED,
  PITCHING_PHYSICS_V1_EXPLICITLY_DEFERRED,
  PITCHING_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
} from './PitchingPhysicsV1';

describe('pitching physics architecture v1 contract', () => {
  it('freezes the causal architecture while leaving coefficients versionable', () => {
    expect(
      PITCHING_PHYSICS_ARCHITECTURE_VERSION,
    ).toBe(
      'pitching-physics-architecture-v1',
    );
    expect(
      PITCHING_PHYSICS_V1_CALIBRATION_REMAINS_VERSIONED,
    ).toBe(true);
  });

  it('includes decision layers only as upstream causes, not result bonuses', () => {
    expect(
      PITCHING_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain('pitcher_sign_autonomy');
    expect(
      PITCHING_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain('batter_anticipation');
    expect(
      PITCHING_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain('aerodynamic_spin_decay');
    expect(
      PITCHING_PHYSICS_V1_EXPLICITLY_DEFERRED,
    ).not.toContain('calibrated_spin_decay');
    expect(
      PITCHING_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).not.toContain('pitch_type_outcome_bonus');
  });

  it('makes seam-wake and knuckleball force explicit v1 exclusions rather than hidden approximations', () => {
    expect(
      PITCHING_PHYSICS_V1_EXPLICITLY_DEFERRED,
    ).toContain('seam_shifted_wake_force');
    expect(
      PITCHING_PHYSICS_V1_EXPLICITLY_DEFERRED,
    ).toContain(
      'knuckleball_unsteady_seam_force',
    );
  });
});
