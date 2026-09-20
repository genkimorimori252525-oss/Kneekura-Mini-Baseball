import {
  findAerodynamicPitchPlateCrossing,
  type AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  decomposePitchSpin,
} from './PitchSpinPhysics';

export type PitchMovementDirectionFamily =
  | 'neutral'
  | 'up'
  | 'down'
  | 'x_positive'
  | 'x_negative'
  | 'up_x_positive'
  | 'up_x_negative'
  | 'down_x_positive'
  | 'down_x_negative';

export type PitchMovementDirectionDisplay =
  | 'neutral'
  | 'up'
  | 'down'
  | 'right'
  | 'left'
  | 'up_right'
  | 'up_left'
  | 'down_right'
  | 'down_left';

export type PitchMovementDisplayConvention =
  | 'positive_x_is_right'
  | 'positive_x_is_left';

export type PitchMovementSignature = Readonly<{
  /**
   * Spin-induced plate movement relative to the same release with zero spin.
   * Gravity, drag, release point, release velocity, air density and wind are
   * therefore retained in both paths and cancel as shared causes.
   */
  inducedHorizontalM: number;
  inducedVerticalM: number;
  inducedMagnitudeM: number;
  directionFamily: PitchMovementDirectionFamily;
  releaseSpeedMps: number;
  plateSpeedMps: number;
  totalSpinRadPerSecond: number;
  activeSpinFractionAtRelease: number;
  activeSpinFractionAtPlate: number;
}>;

export type PitchMovementMeasurementInput = Readonly<{
  trajectory: AerodynamicPitchTrajectory;
  plateZ: number;
  neutralThresholdM?: number;
}>;

const DEFAULT_NEUTRAL_THRESHOLD_M = 0.01;

const magnitude3 = (
  value: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
): number => Math.hypot(
  value.x,
  value.y,
  value.z,
);

const validateFiniteNonNegative = (
  name: string,
  value: number,
): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `${name} must be finite and non-negative`,
    );
  }
};

export const classifyPitchMovementDirection = (
  horizontalM: number,
  verticalM: number,
  neutralThresholdM: number =
    DEFAULT_NEUTRAL_THRESHOLD_M,
): PitchMovementDirectionFamily => {
  if (
    !Number.isFinite(horizontalM)
    || !Number.isFinite(verticalM)
  ) {
    throw new Error(
      'pitch movement components must be finite',
    );
  }
  validateFiniteNonNegative(
    'neutralThresholdM',
    neutralThresholdM,
  );

  const magnitude = Math.hypot(
    horizontalM,
    verticalM,
  );
  if (magnitude <= neutralThresholdM) {
    return 'neutral';
  }

  const angle = Math.atan2(
    verticalM,
    horizontalM,
  );
  const octant = (
    Math.round(
      angle / (Math.PI / 4),
    ) + 8
  ) % 8;

  switch (octant) {
    case 0:
      return 'x_positive';
    case 1:
      return 'up_x_positive';
    case 2:
      return 'up';
    case 3:
      return 'up_x_negative';
    case 4:
      return 'x_negative';
    case 5:
      return 'down_x_negative';
    case 6:
      return 'down';
    case 7:
      return 'down_x_positive';
    default:
      throw new Error(
        'unreachable pitch movement octant',
      );
  }
};

export const displayPitchMovementDirection = (
  family: PitchMovementDirectionFamily,
  convention: PitchMovementDisplayConvention,
): PitchMovementDirectionDisplay => {
  if (family === 'neutral') {
    return 'neutral';
  }
  if (family === 'up' || family === 'down') {
    return family;
  }

  const positiveIsRight =
    convention === 'positive_x_is_right';
  const positiveSide = positiveIsRight
    ? 'right'
    : 'left';
  const negativeSide = positiveIsRight
    ? 'left'
    : 'right';

  switch (family) {
    case 'x_positive':
      return positiveSide;
    case 'x_negative':
      return negativeSide;
    case 'up_x_positive':
      return positiveIsRight
        ? 'up_right'
        : 'up_left';
    case 'up_x_negative':
      return positiveIsRight
        ? 'up_left'
        : 'up_right';
    case 'down_x_positive':
      return positiveIsRight
        ? 'down_right'
        : 'down_left';
    case 'down_x_negative':
      return positiveIsRight
        ? 'down_left'
        : 'down_right';
    default:
      throw new Error(
        'unreachable pitch movement display family',
      );
  }
};

export const measurePitchMovementSignature = (
  input: PitchMovementMeasurementInput,
): PitchMovementSignature => {
  const neutralThresholdM =
    input.neutralThresholdM
    ?? DEFAULT_NEUTRAL_THRESHOLD_M;
  validateFiniteNonNegative(
    'neutralThresholdM',
    neutralThresholdM,
  );

  const actualCrossing =
    findAerodynamicPitchPlateCrossing(
      input.trajectory,
      input.plateZ,
    );
  if (actualCrossing === null) {
    throw new Error(
      'pitch movement measurement requires the pitch to reach the plate',
    );
  }

  const zeroSpinTrajectory: AerodynamicPitchTrajectory = {
    ...input.trajectory,
    start: {
      ...input.trajectory.start,
      spin: {
        x: 0,
        y: 0,
        z: 0,
      },
    },
    // Seam orientation remains material state, but the current aerodynamic
    // model intentionally has no seam force. When a validated seam model is
    // added, the movement reference must be versioned explicitly.
  };
  const zeroSpinCrossing =
    findAerodynamicPitchPlateCrossing(
      zeroSpinTrajectory,
      input.plateZ,
    );
  if (zeroSpinCrossing === null) {
    throw new Error(
      'zero-spin reference pitch must reach the plate',
    );
  }

  const inducedHorizontalM =
    actualCrossing.position.x
    - zeroSpinCrossing.position.x;
  const inducedVerticalM =
    actualCrossing.position.y
    - zeroSpinCrossing.position.y;
  const inducedMagnitudeM = Math.hypot(
    inducedHorizontalM,
    inducedVerticalM,
  );

  const releaseSpin = decomposePitchSpin(
    input.trajectory.start.velocity,
    input.trajectory.start.spin,
  );

  return {
    inducedHorizontalM,
    inducedVerticalM,
    inducedMagnitudeM,
    directionFamily:
      classifyPitchMovementDirection(
        inducedHorizontalM,
        inducedVerticalM,
        neutralThresholdM,
      ),
    releaseSpeedMps: magnitude3(
      input.trajectory.start.velocity,
    ),
    plateSpeedMps: magnitude3(
      actualCrossing.velocity,
    ),
    totalSpinRadPerSecond:
      releaseSpin.totalSpinRadPerSecond,
    activeSpinFractionAtRelease:
      releaseSpin.activeSpinFraction,
    activeSpinFractionAtPlate:
      actualCrossing.spinDecomposition
        .activeSpinFraction,
  };
};
