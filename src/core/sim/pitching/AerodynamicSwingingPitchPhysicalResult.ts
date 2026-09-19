import type {
  ContactParameters,
} from '../contact/BatBallContact';
import {
  DEFAULT_CONTACT_PARAMETERS,
  measureBatBallContactSeparation,
  resolveBatBallContact,
  sampleBatterSwingState,
  type BatBallContactResult,
} from '../contact/BatBallContact';
import {
  advanceAerodynamicPitchState,
  sampleAerodynamicPitchTrajectory,
  type AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import type {
  BatterSwingWindow,
} from './SwingingPitchPhysicalResult';

export type AerodynamicSwingingPitchPhysicalResult =
  | Readonly<{
      kind: 'contact';
      contact: BatBallContactResult;
    }>
  | Readonly<{
      kind: 'swinging_miss';
      adjudicationTick: number;
    }>;

export type AerodynamicSwingingPitchPhysicalInput = Readonly<{
  trajectory: AerodynamicPitchTrajectory;
  swing: BatterSwingWindow;
  contactParameters?: ContactParameters;
}>;

const EPSILON = 1e-12;

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

const subtract3 = (
  first: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  second: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: first.x - second.x,
  y: first.y - second.y,
  z: first.z - second.z,
});

const cross3 = (
  first: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  second: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: first.y * second.z - first.z * second.y,
  y: first.z * second.x - first.x * second.z,
  z: first.x * second.y - first.y * second.x,
});

const add3 = (
  first: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  second: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: first.x + second.x,
  y: first.y + second.y,
  z: first.z + second.z,
});

const validateInput = (
  input: AerodynamicSwingingPitchPhysicalInput,
): void => {
  const { trajectory, swing } = input;

  if (
    !Number.isSafeInteger(swing.startTick)
    || !Number.isSafeInteger(swing.endTick)
    || swing.endTick < swing.startTick
    || swing.startTick < trajectory.start.tick
    || swing.endTick > trajectory.endTick
  ) {
    throw new Error(
      'aerodynamic swing window must lie inside the pitch trajectory interval',
    );
  }
  if (
    !Number.isSafeInteger(swing.ticksPerSecond)
    || swing.ticksPerSecond <= 0
    || swing.ticksPerSecond
      !== trajectory.parameters.ticksPerSecond
  ) {
    throw new Error(
      'aerodynamic pitch trajectory and swing window must share ticksPerSecond',
    );
  }
};

const maximumGeometricClosingSpeed = (
  input: AerodynamicSwingingPitchPhysicalInput,
): number => {
  const durationSeconds = (
    input.swing.endTick
    - input.trajectory.start.tick
  ) / input.swing.ticksPerSecond;

  const wind =
    input.trajectory.parameters.aerodynamics
      .windVelocityMps;
  const releaseAirRelative = subtract3(
    input.trajectory.start.velocity,
    wind,
  );
  const maximumAirRelativeSpeed =
    magnitude3(releaseAirRelative)
    + Math.abs(
      input.trajectory.parameters.gravityY,
    ) * durationSeconds;
  const maximumPitchGroundSpeed =
    maximumAirRelativeSpeed
    + magnitude3(wind);

  const batAxis = subtract3(
    input.swing.stateAtStart.pose.tip,
    input.swing.stateAtStart.pose.grip,
  );
  const gripSpeed = magnitude3(
    input.swing.stateAtStart.linearVelocity,
  );
  const tipSpeed = magnitude3(add3(
    input.swing.stateAtStart.linearVelocity,
    cross3(
      input.swing.stateAtStart.angularVelocity,
      batAxis,
    ),
  ));

  return maximumPitchGroundSpeed + Math.max(
    gripSpeed,
    tipSpeed,
  );
};

/**
 * Finds bat/ball contact against the continuously integrated aerodynamic
 * pitch path. Conservative advancement uses a physical upper bound on
 * relative geometric closing speed, so curved pitches cannot tunnel through
 * the bat between samples merely because the renderer or UI samples slowly.
 *
 * This path intentionally reuses the frozen legacy contact response for now.
 * It upgrades pitch flight/contact timing without prematurely declaring the
 * new reduced-order bat collision calibrated.
 */
export const resolveAerodynamicSwingingPitchPhysicalResult = (
  input: AerodynamicSwingingPitchPhysicalInput,
): AerodynamicSwingingPitchPhysicalResult => {
  validateInput(input);

  const parameters =
    input.contactParameters
    ?? DEFAULT_CONTACT_PARAMETERS;
  const maximumClosingSpeed =
    maximumGeometricClosingSpeed(input);

  let tick = input.swing.startTick;
  let pitch = sampleAerodynamicPitchTrajectory(
    input.trajectory,
    tick,
  );

  while (tick <= input.swing.endTick) {
    const swing = sampleBatterSwingState(
      input.swing.stateAtStart,
      tick - input.swing.startTick,
      input.swing.ticksPerSecond,
    );
    const separation =
      measureBatBallContactSeparation(
        pitch,
        swing,
        parameters,
      );

    if (separation <= 0) {
      const contact = resolveBatBallContact(
        pitch,
        swing,
        parameters,
      );
      if (contact !== null) {
        return {
          kind: 'contact',
          contact,
        };
      }
    }

    if (tick === input.swing.endTick) {
      break;
    }

    const safeAdvanceTicks = (
      separation > 0
      && maximumClosingSpeed > EPSILON
    )
      ? (
          Math.floor(
            (
              separation
              / maximumClosingSpeed
            ) * input.swing.ticksPerSecond,
          ) - 1
        )
      : 1;

    const advanceTicks = Math.min(
      input.swing.endTick - tick,
      Math.max(1, safeAdvanceTicks),
    );

    pitch = advanceAerodynamicPitchState(
      pitch,
      advanceTicks,
      input.trajectory.parameters,
    );
    tick += advanceTicks;
  }

  return {
    kind: 'swinging_miss',
    adjudicationTick: input.swing.endTick,
  };
};
