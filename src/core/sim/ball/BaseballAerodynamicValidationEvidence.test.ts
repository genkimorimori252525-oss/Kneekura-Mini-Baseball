import { describe, expect, it } from 'vitest';
import {
  LYU_2022_LOW_SPIN_SEAM_SPLIT_CUTOFF,
  LYU_2022_TABLE1_LIFT_EVIDENCE,
  SMITH_2022_FREE_FLIGHT_DRAG_EVIDENCE,
  seamAveragedLiftCoefficient,
} from './BaseballAerodynamicValidationEvidence';
import {
  LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
  resolveBaseballAerodynamicCoefficients,
} from './BaseballAerodynamicCoefficientProfile';

describe('baseball aerodynamic validation evidence', () => {
  it('preserves the exact Lyu Table 1 low-spin seam split', () => {
    expect(
      LYU_2022_TABLE1_LIFT_EVIDENCE,
    ).toEqual([
      {
        spinFactor: 0.05,
        twoSeamLiftCoefficient: 0.05,
        fourSeamLiftCoefficient: 0.15,
      },
      {
        spinFactor: 0.10,
        twoSeamLiftCoefficient: 0.07,
        fourSeamLiftCoefficient: 0.16,
      },
      {
        spinFactor: 0.15,
        twoSeamLiftCoefficient: 0.17,
        fourSeamLiftCoefficient: 0.17,
      },
      {
        spinFactor: 0.20,
        twoSeamLiftCoefficient: 0.18,
        fourSeamLiftCoefficient: 0.21,
      },
    ]);
  });

  it('makes the seam-averaged v1 lift profile agree with the published Table 1 average anchors', () => {
    for (
      const evidence
      of LYU_2022_TABLE1_LIFT_EVIDENCE
    ) {
      const coefficients =
        resolveBaseballAerodynamicCoefficients(
          LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
          140_000,
          evidence.spinFactor,
        );

      expect(
        coefficients.liftCoefficient,
      ).toBeCloseTo(
        seamAveragedLiftCoefficient(
          evidence,
        ),
        12,
      );
    }
  });

  it('keeps the low-spin seam-orientation limitation explicit', () => {
    expect(
      LYU_2022_LOW_SPIN_SEAM_SPLIT_CUTOFF,
    ).toBe(0.15);

    const low =
      LYU_2022_TABLE1_LIFT_EVIDENCE[0]!;
    expect(
      low.fourSeamLiftCoefficient
      / low.twoSeamLiftCoefficient,
    ).toBeCloseTo(3, 12);
  });

  it('preserves free-flight average drag evidence rather than replacing it with a tuned league outcome', () => {
    expect(
      SMITH_2022_FREE_FLIGHT_DRAG_EVIDENCE
        .nonSpinningAverageDragCoefficient,
    ).toBeCloseTo(0.348, 12);
    expect(
      SMITH_2022_FREE_FLIGHT_DRAG_EVIDENCE
        .spinningAverageDragCoefficient,
    ).toBeCloseTo(0.358, 12);
  });
});
