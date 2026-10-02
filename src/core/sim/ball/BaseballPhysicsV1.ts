import {
  PITCHING_PHYSICS_ARCHITECTURE_VERSION,
} from '../pitching/PitchingPhysicsV1';

export const BASEBALL_PHYSICS_ARCHITECTURE_VERSION =
  'baseball-physics-architecture-v1' as const;

export type BaseballPhysicsArchitectureVersion =
  typeof BASEBALL_PHYSICS_ARCHITECTURE_VERSION;

export const BASEBALL_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS =
  Object.freeze([
    PITCHING_PHYSICS_ARCHITECTURE_VERSION,
    'rigid_reduced_order_bat_ball_contact',
    'speed_dependent_contact_calibration',
    'aerodynamic_batted_ball_flight',
    'unified_surface_material_response',
    'angle_speed_surface_response',
    'spin_coupled_surface_impulse',
    'finite_skid_to_roll_transition',
    'rolling_resistance',
    'planar_wall_surface_impact',
    'canonical_contact_adjudication',
  ] as const);

export const BASEBALL_PHYSICS_V1_EXPLICITLY_DEFERRED =
  Object.freeze([
    'explicit_bat_ball_deformation_state',
    'finite_element_contact_state',
    'seam_shifted_wake_force',
    'knuckleball_unsteady_seam_force',
    'full_arm_hand_biomechanics',
  ] as const);

export const BASEBALL_PHYSICS_V1_CALIBRATION_GATES =
  Object.freeze([
    'wood_bat_production_contact_parameters',
    'infield_dirt_material_profile',
    'natural_grass_material_profile',
    'artificial_turf_material_profile',
    'warning_track_material_profile',
    'wall_padding_material_profile',
    'sliding_friction_calibration',
    'rolling_resistance_calibration',
    'pitching_coefficient_calibration',
    'end_to_end_validation_corpus',
  ] as const);

/**
 * Architecture freeze means new realism work should enter through versioned
 * calibration/material/profile inputs or a deliberately versioned extension.
 * It does not mean the opt-in realistic paths are ready to replace frozen
 * compatibility defaults before the calibration gates are satisfied.
 */
export const BASEBALL_PHYSICS_V1_ARCHITECTURE_FROZEN =
  true as const;

export const BASEBALL_PHYSICS_V1_PRODUCTION_DEFAULT_PROMOTED =
  true as const;

export const BASEBALL_PHYSICS_V1_PRODUCTION_PROFILE_ID =
  'baseball-reality-profile-v1' as const;
