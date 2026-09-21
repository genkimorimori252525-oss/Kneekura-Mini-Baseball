export type Lyu2022LiftEvidence = Readonly<{
  spinFactor: number;
  twoSeamLiftCoefficient: number;
  fourSeamLiftCoefficient: number;
}>;

/**
 * Lyu et al. (2022), Table 1.
 *
 * These are direct published lift coefficients at Re ~= 140k. They are kept
 * separately from the seam-averaged v1 coefficient profile so the information
 * loss at low spin remains visible.
 */
export const LYU_2022_TABLE1_LIFT_EVIDENCE:
  readonly Lyu2022LiftEvidence[] =
  Object.freeze([
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

export const seamAveragedLiftCoefficient = (
  evidence: Lyu2022LiftEvidence,
): number => (
  (
    evidence.twoSeamLiftCoefficient
    + evidence.fourSeamLiftCoefficient
  ) / 2
);

export const SMITH_2022_FREE_FLIGHT_DRAG_EVIDENCE =
  Object.freeze({
    representativeReynoldsNumber:
      170_000,
    nonSpinningAverageDragCoefficient:
      0.348,
    spinningAverageDragCoefficient:
      0.358,
    spinningNominalRpm: 2500,
    spinningRpmTolerance: 250,
    source:
      'Smith et al. 2022, Baseball Drag Measurements in Free Flight, Applied Sciences 12(3):1416',
  } as const);

/**
 * The v1 seam-averaged aerodynamic model intentionally does not claim to
 * reproduce the two-/four-seam split at low spin. That split is a retained
 * calibration limitation, not hidden noise.
 */
export const LYU_2022_LOW_SPIN_SEAM_SPLIT_CUTOFF =
  0.15 as const;
