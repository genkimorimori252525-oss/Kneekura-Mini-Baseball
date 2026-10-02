export const PITCHING_PHYSICS_ARCHITECTURE_VERSION =
  'pitching-physics-architecture-v1' as const;

export type PitchingPhysicsArchitectureVersion =
  typeof PITCHING_PHYSICS_ARCHITECTURE_VERSION;

export const PITCHING_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS =
  Object.freeze([
    'pitch_skill_identity',
    'release_repeatability',
    'finger_impulse_release',
    'active_gyro_spin_decomposition',
    'aerodynamic_drag_magnus_wind_gravity',
    'aerodynamic_spin_decay',
    'seam_material_orientation_state',
    'catcher_lead',
    'pitcher_sign_autonomy',
    'batter_anticipation',
    'aerodynamic_batter_interaction',
    'canonical_pitch_adjudication',
  ] as const);

export const PITCHING_PHYSICS_V1_EXPLICITLY_DEFERRED =
  Object.freeze([
    'seam_shifted_wake_force',
    'knuckleball_unsteady_seam_force',
    'full_arm_hand_biomechanics',
  ] as const);

/**
 * Architecture-v1 means the causal dependency graph is frozen.
 *
 * It does NOT freeze coefficients. Aerodynamic coefficients, release-response
 * calibration, anticipation timing, and validation datasets may continue to
 * improve as explicit versioned calibration inputs.
 */
export const PITCHING_PHYSICS_V1_CALIBRATION_REMAINS_VERSIONED =
  true as const;
