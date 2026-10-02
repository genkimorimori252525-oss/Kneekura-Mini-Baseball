import type {
  AerodynamicPitchPlateCrossing,
  AerodynamicPitchTrajectory,
  AerodynamicPitchTrajectoryParameters,
} from './AerodynamicPitchTrajectory';
import {
  findAerodynamicPitchPlateCrossing,
} from './AerodynamicPitchTrajectory';
import {
  resolvePitchReleaseMechanics,
  type PitchReleaseMechanicsInput,
  type PitchReleaseMechanicsResult,
} from './PitchReleaseMechanics';

export type PitchReleaseFlightSliceInput = Readonly<{
  release: PitchReleaseMechanicsInput;
  trajectoryParameters: AerodynamicPitchTrajectoryParameters;
  endTick: number;
  plateZ?: number;
}>;

export type PitchReleaseFlightSliceResult = Readonly<{
  release: PitchReleaseMechanicsResult;
  trajectory: AerodynamicPitchTrajectory;
  plateCrossing: AerodynamicPitchPlateCrossing | null;
}>;

const validateConsistency = (
  input: PitchReleaseFlightSliceInput,
): void => {
  if (
    !Number.isSafeInteger(input.endTick)
    || input.endTick < input.release.tick
  ) {
    throw new Error(
      'pitch release flight endTick must be a safe integer at or after release',
    );
  }

  const aerodynamic =
    input.trajectoryParameters.aerodynamics;
  if (
    Math.abs(
      aerodynamic.ballMassKg
      - input.release.ball.massKg,
    ) > 1e-9
  ) {
    throw new Error(
      'pitch release ball mass must match aerodynamic ball mass',
    );
  }
  if (
    Math.abs(
      aerodynamic.ballRadiusM
      - input.release.ball.radiusM,
    ) > 1e-9
  ) {
    throw new Error(
      'pitch release ball radius must match aerodynamic ball radius',
    );
  }
  if (
    input.plateZ !== undefined
    && !Number.isFinite(input.plateZ)
  ) {
    throw new Error(
      'pitch release flight plateZ must be finite',
    );
  }
};

/**
 * Authoritative reduced-order chain:
 *
 * finger/grip impulses
 *   -> release velocity + 3D spin + seam orientation
 *   -> drag/Magnus/gravity/wind flight
 *   -> optional plate crossing
 */
export const simulatePitchReleaseFlightSlice = (
  input: PitchReleaseFlightSliceInput,
): PitchReleaseFlightSliceResult => {
  validateConsistency(input);

  const release = resolvePitchReleaseMechanics(
    input.release,
  );
  const trajectory: AerodynamicPitchTrajectory = {
    start: release.state,
    endTick: input.endTick,
    parameters: input.trajectoryParameters,
    releaseOrientation: release.orientation,
  };

  const plateCrossing =
    input.plateZ === undefined
      ? null
      : findAerodynamicPitchPlateCrossing(
          trajectory,
          input.plateZ,
        );

  return {
    release,
    trajectory,
    plateCrossing,
  };
};
