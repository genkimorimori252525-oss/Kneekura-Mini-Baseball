import { describe, expect, it } from 'vitest';
import {
  evaluatePhysicsValidationCase,
  evaluatePhysicsValidationCorpus,
} from './PhysicsObservableValidation';

describe('physics observable validation', () => {
  it('requires explicit empirical tolerance instead of inventing one', () => {
    expect(() =>
      evaluatePhysicsValidationCase({
        caseId: 'missing-tolerance',
        targets: [
          {
            observableId:
              'exit_speed_mps',
            sourceId: 'lab',
            sourceVersion: 'v1',
            targetValue: 40,
          },
        ],
        measurements: [
          {
            observableId:
              'exit_speed_mps',
            observedValue: 40,
          },
        ],
      }),
    ).toThrow(
      'physics observable target requires an explicit tolerance',
    );
  });

  it('supports absolute and relative source-defined tolerances', () => {
    const result =
      evaluatePhysicsValidationCase({
        caseId: 'fixture',
        targets: [
          {
            observableId:
              'exit_speed_mps',
            sourceId: 'lab-a',
            sourceVersion: 'v1',
            targetValue: 50,
            absoluteTolerance: 1,
          },
          {
            observableId:
              'ground_transit_seconds',
            sourceId: 'field-a',
            sourceVersion: 'v2',
            targetValue: 2,
            relativeTolerance: 0.05,
          },
        ],
        measurements: [
          {
            observableId:
              'exit_speed_mps',
            observedValue: 50.5,
          },
          {
            observableId:
              'ground_transit_seconds',
            observedValue: 2.08,
          },
        ],
      });

    expect(result.passed).toBe(true);
    expect(
      result.evaluations[1]!
        .allowedAbsoluteResidual,
    ).toBeCloseTo(0.1, 12);
  });

  it('fails only through physical observable residuals, not baseball outcome labels', () => {
    const result =
      evaluatePhysicsValidationCase({
        caseId: 'bad-physics',
        targets: [
          {
            observableId:
              'wall_rebound_speed_mps',
            sourceId: 'wall-lab',
            sourceVersion: 'v1',
            targetValue: 20,
            absoluteTolerance: 0.5,
          },
        ],
        measurements: [
          {
            observableId:
              'wall_rebound_speed_mps',
            observedValue: 22,
          },
        ],
      });

    expect(result.passed).toBe(false);
    expect(
      result.evaluations[0]!
        .absoluteResidual,
    ).toBe(2);
  });

  it('preserves one-sided experimental lower bounds without treating them as symmetric means', () => {
    const passing =
      evaluatePhysicsValidationCase({
        caseId: 'friction-lower-bound',
        targets: [
          {
            observableId:
              'friction_coefficient',
            sourceId:
              'floor-experiment',
            sourceVersion: 'v1',
            targetValue: 0.31,
            constraint: 'minimum',
            absoluteTolerance: 0.02,
          },
        ],
        measurements: [
          {
            observableId:
              'friction_coefficient',
            observedValue: 0.30,
          },
        ],
      });

    const failing =
      evaluatePhysicsValidationCase({
        caseId: 'friction-below-bound',
        targets: [
          {
            observableId:
              'friction_coefficient',
            sourceId:
              'floor-experiment',
            sourceVersion: 'v1',
            targetValue: 0.31,
            constraint: 'minimum',
            absoluteTolerance: 0.02,
          },
        ],
        measurements: [
          {
            observableId:
              'friction_coefficient',
            observedValue: 0.28,
          },
        ],
      });

    expect(passing.passed).toBe(true);
    expect(
      passing.evaluations[0]!
        .constraint,
    ).toBe('minimum');
    expect(failing.passed).toBe(false);
  });

  it('produces deterministic fingerprints for a final multi-case validation corpus', () => {
    const cases = [
      {
        caseId: 'pitch',
        targets: [
          {
            observableId:
              'pitch_plate_x_m' as const,
            sourceId: 'pitch-lab',
            sourceVersion: 'v1',
            targetValue: 0.1,
            absoluteTolerance: 0.01,
          },
        ],
        measurements: [
          {
            observableId:
              'pitch_plate_x_m' as const,
            observedValue: 0.105,
          },
        ],
      },
      {
        caseId: 'ground',
        targets: [
          {
            observableId:
              'ground_transit_seconds' as const,
            sourceId: 'field-lab',
            sourceVersion: 'v1',
            targetValue: 1.8,
            absoluteTolerance: 0.1,
          },
        ],
        measurements: [
          {
            observableId:
              'ground_transit_seconds' as const,
            observedValue: 1.82,
          },
        ],
      },
    ];

    const a =
      evaluatePhysicsValidationCorpus(
        'physics-corpus-v1',
        cases,
      );
    const b =
      evaluatePhysicsValidationCorpus(
        'physics-corpus-v1',
        cases,
      );

    expect(a).toEqual(b);
    expect(a.passed).toBe(true);
    expect(a.fingerprint)
      .toMatch(/^[0-9a-f]{16}$/);
  });
});
