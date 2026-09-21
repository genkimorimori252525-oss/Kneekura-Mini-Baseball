import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
  BASEBALL_PHYSICS_V1_ARCHITECTURE_FROZEN,
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
  BASEBALL_PHYSICS_V1_EXPLICITLY_DEFERRED,
  BASEBALL_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
  BASEBALL_PHYSICS_V1_PRODUCTION_DEFAULT_PROMOTED,
} from './BaseballPhysicsV1';

describe('baseball physics architecture v1 contract', () => {
  it('freezes the causal architecture and records the evidence-gated production promotion', () => {
    expect(
      BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
    ).toBe(
      'baseball-physics-architecture-v1',
    );
    expect(
      BASEBALL_PHYSICS_V1_ARCHITECTURE_FROZEN,
    ).toBe(true);
    expect(
      BASEBALL_PHYSICS_V1_PRODUCTION_DEFAULT_PROMOTED,
    ).toBe(true);
  });

  it('includes one causal chain from pitch through contact, flight, ground and wall response', () => {
    expect(
      BASEBALL_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain(
      'rigid_reduced_order_bat_ball_contact',
    );
    expect(
      BASEBALL_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain(
      'aerodynamic_batted_ball_flight',
    );
    expect(
      BASEBALL_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain(
      'finite_skid_to_roll_transition',
    );
    expect(
      BASEBALL_PHYSICS_V1_INCLUDED_CAUSAL_LAYERS,
    ).toContain(
      'planar_wall_surface_impact',
    );
  });

  it('keeps explicit deformation outside canonical v1 physics', () => {
    expect(
      BASEBALL_PHYSICS_V1_EXPLICITLY_DEFERRED,
    ).toContain(
      'explicit_bat_ball_deformation_state',
    );
    expect(
      BASEBALL_PHYSICS_V1_EXPLICITLY_DEFERRED,
    ).toContain(
      'finite_element_contact_state',
    );
  });

  it('keeps calibration gate identities stable after closure so future evidence changes reopen the same contract', () => {
    expect(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
    ).toContain(
      'wood_bat_production_contact_parameters',
    );
    expect(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
    ).toContain(
      'natural_grass_material_profile',
    );
    expect(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
    ).toContain(
      'end_to_end_validation_corpus',
    );
  });
});
