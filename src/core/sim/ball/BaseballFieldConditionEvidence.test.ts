import { describe, expect, it } from 'vitest';
import {
  BASEBALL_FIELD_CONDITION_QUALITATIVE_CONSTRAINTS,
  BROSNAN_2011_SKINNED_INFIELD_BULK_DENSITY,
  BROSNAN_2011_SKINNED_INFIELD_COMPACTION_PACE,
  BROSNAN_2011_SYNTHETIC_TURF_PACE,
  findSurfacePaceObservation,
} from './BaseballFieldConditionEvidence';

describe('baseball field condition evidence', () => {
  it('preserves the measured skinned-infield compaction ordering at both sample times', () => {
    for (const time of ['time_1', 'time_2'] as const) {
      const byCondition = Object.fromEntries(
        BROSNAN_2011_SKINNED_INFIELD_COMPACTION_PACE
          .filter(
            (row) =>
              row.measurementContextId
              === time,
          )
          .map(
            (row) => [
              row.conditionId,
              row.paceRatio,
            ],
          ),
      );

      expect(byCondition.high_compaction)
        .toBeGreaterThan(
          byCondition.medium_compaction!,
        );
      expect(byCondition.medium_compaction)
        .toBeGreaterThan(
          byCondition.low_compaction!,
        );
    }
  });

  it('keeps construction state separate from the collision coefficient layer', () => {
    expect(
      BROSNAN_2011_SKINNED_INFIELD_BULK_DENSITY
        .high_compaction
        .bulkDensityMgM3,
    ).toBeCloseTo(1.63, 12);
    expect(
      BROSNAN_2011_SKINNED_INFIELD_BULK_DENSITY
        .low_compaction
        .bulkDensityMgM3,
    ).toBeCloseTo(1.46, 12);
  });

  it('preserves published synthetic-turf system differences rather than collapsing them into one generic artificial surface', () => {
    const pre = Object.fromEntries(
      BROSNAN_2011_SYNTHETIC_TURF_PACE
        .filter(
          (row) =>
            row.measurementContextId
            === 'pre_grooming',
        )
        .map(
          (row) => [
            row.conditionId,
            row.paceRatio,
          ],
        ),
    );

    expect(pre.astroturf)
      .toBeCloseTo(0.599, 12);
    expect(pre.fieldturf)
      .toBeCloseTo(0.514, 12);
    expect(pre.astroturf)
      .toBeGreaterThan(
        pre.fieldturf!,
      );
  });

  it('retains wet-grass evidence only as a directional constraint when no numeric v1 coefficient is supported', () => {
    const wet =
      BASEBALL_FIELD_CONDITION_QUALITATIVE_CONSTRAINTS
        .find(
          (constraint) =>
            constraint.evidenceId
            === 'park-2020-wet-grass-boundary-angle',
        );

    expect(wet).toMatchObject({
      relation: 'greater_than',
      leftConditionId:
        'wet_grass_friction_boundary_angle',
      rightConditionId:
        'dry_grass_friction_boundary_angle',
    });
  });

  it('looks up observations by stable evidence id', () => {
    expect(
      findSurfacePaceObservation(
        'brosnan-2011-fieldturf-post-grooming',
      )?.paceRatio,
    ).toBeCloseTo(0.533, 12);
  });
});
