import { describe, expect, it } from 'vitest';
import {
  BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
} from '../sim/ball/BaseballPhysicsV1';
import {
  CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE,
  createCurrentBaseballPhysicsV1GateEvidence,
} from './CurrentBaseballPhysicsV1Closure';

describe('current baseball physics v1 closure ledger', () => {
  it('accounts for every production calibration gate exactly once', () => {
    expect(
      CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
        .map((entry) => entry.gateId),
    ).toEqual(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES,
    );

    expect(
      new Set(
        CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
          .map(
            (entry) =>
              entry.gateId,
          ),
      ).size,
    ).toBe(
      BASEBALL_PHYSICS_V1_CALIBRATION_GATES
        .length,
    );
  });

  it('closes every v1 calibration gate without converting scoped evidence gaps into fake coefficients', () => {
    const evidence =
      createCurrentBaseballPhysicsV1GateEvidence();
    const byId =
      new Map(
        evidence.map(
          (entry) => [
            entry.gateId,
            entry.state,
          ] as const,
        ),
      );

    expect(
      byId.get(
        'wood_bat_production_contact_parameters',
      ),
    ).toBe('satisfied');
    expect(
      byId.get(
        'pitching_coefficient_calibration',
      ),
    ).toBe('satisfied');
    expect(
      byId.get(
        'end_to_end_validation_corpus',
      ),
    ).toBe('satisfied');

    const scopedOut = evidence
      .filter(
        (entry) =>
          entry.state
          === 'explicitly_scoped_out',
      )
      .map((entry) => entry.gateId);

    expect(
      evidence.filter(
        (entry) => entry.state === 'open',
      ),
    ).toEqual([]);

    expect(scopedOut).toEqual([
      'infield_dirt_material_profile',
      'natural_grass_material_profile',
      'artificial_turf_material_profile',
      'warning_track_material_profile',
      'wall_padding_material_profile',
      'sliding_friction_calibration',
      'rolling_resistance_calibration',
    ]);
  });

  it('records both implemented coverage and the precise retained limitation for every gate', () => {
    for (
      const entry
      of CURRENT_BASEBALL_PHYSICS_V1_GATE_COVERAGE
    ) {
      expect(entry.coverage.length)
        .toBeGreaterThan(20);
      expect(entry.missing.length)
        .toBeGreaterThan(20);
      expect(entry.evidenceId.length)
        .toBeGreaterThan(5);
      expect(entry.evidenceVersion.length)
        .toBeGreaterThan(5);
    }
  });
});
