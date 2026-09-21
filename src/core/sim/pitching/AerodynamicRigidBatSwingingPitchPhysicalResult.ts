import type {
  BatterSwingState,
} from '../contact/BatBallContact';
import {
  createRigidBatStateFromBatterSwingState,
  measureRigidBatBallSurfaceSeparation,
  resolveRigidBatBallContactWithParameterResolver,
  type RigidBaseballProperties,
  type RigidBatBallContactParameterResolver,
  type RigidBatBallContactResult,
  type RigidBatPhysicalProperties,
} from '../contact/RigidBatBallContact';
import {
  sampleBatterSwingState,
} from '../contact/BatBallContact';
import {
  advanceAerodynamicPitchState,
  sampleAerodynamicPitchTrajectory,
  type AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';

export type RigidBatSwingWindow = Readonly<{
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  stateAtStart: BatterSwingState;
  physical: RigidBatPhysicalProperties;
}>;

export type AerodynamicRigidBatSwingResult =
  | Readonly<{
      kind: 'contact';
      contact: RigidBatBallContactResult;
    }>
  | Readonly<{
      kind: 'swinging_miss';
      adjudicationTick: number;
    }>;

export type AerodynamicRigidBatSwingInput = Readonly<{
  trajectory: AerodynamicPitchTrajectory;
  swing: RigidBatSwingWindow;
  ball: RigidBaseballProperties;
  parameterResolver:
    RigidBatBallContactParameterResolver;
}>;

const EPSILON = 1e-12;

const magnitude = (
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

const subtract = (
  a: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  b: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const cross = (
  a: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  b: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const add = (
  a: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
  b: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
) => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const validate = (
  input: AerodynamicRigidBatSwingInput,
): void => {
  const { trajectory, swing } = input;

  if (
    !Number.isSafeInteger(
      swing.startTick,
    )
    || !Number.isSafeInteger(
      swing.endTick,
    )
    || swing.endTick
      < swing.startTick
    || swing.startTick
      < trajectory.start.tick
    || swing.endTick
      > trajectory.endTick
  ) {
    throw new Error(
      'rigid bat swing window must lie inside the aerodynamic pitch trajectory',
    );
  }
  if (
    !Number.isSafeInteger(
      swing.ticksPerSecond,
    )
    || swing.ticksPerSecond <= 0
    || swing.ticksPerSecond
      !== trajectory.parameters
        .ticksPerSecond
  ) {
    throw new Error(
      'rigid bat swing and aerodynamic pitch must share ticksPerSecond',
    );
  }
};

const maximumClosingSpeed = (
  input: AerodynamicRigidBatSwingInput,
): number => {
  const durationSeconds =
    (
      input.swing.endTick
      - input.trajectory.start.tick
    )
    / input.swing.ticksPerSecond;

  const wind =
    input.trajectory.parameters
      .aerodynamics.windVelocityMps;
  const releaseAirRelative =
    subtract(
      input.trajectory.start.velocity,
      wind,
    );
  const conservativePitchSpeed =
    magnitude(releaseAirRelative)
    + Math.abs(
      input.trajectory.parameters
        .gravityY,
    ) * durationSeconds
    + magnitude(wind);

  const batAxis = subtract(
    input.swing.stateAtStart
      .pose.tip,
    input.swing.stateAtStart
      .pose.grip,
  );
  const gripSpeed = magnitude(
    input.swing.stateAtStart
      .linearVelocity,
  );
  const tipSpeed = magnitude(
    add(
      input.swing.stateAtStart
        .linearVelocity,
      cross(
        input.swing.stateAtStart
          .angularVelocity,
        batAxis,
      ),
    ),
  );

  return conservativePitchSpeed
    + Math.max(
      gripSpeed,
      tipSpeed,
    );
};

/**
 * Contact search for the calibrated rigid/reduced-order bat model on the
 * continuously integrated aerodynamic pitch path.
 *
 * This is the replacement path for the temporary legacy capsule response:
 * tapered bat geometry determines separation/contact, and collision
 * coefficients are resolved from the actual local pre-impact kinematics.
 */
export const resolveAerodynamicRigidBatSwing = (
  input: AerodynamicRigidBatSwingInput,
): AerodynamicRigidBatSwingResult => {
  validate(input);

  const closingSpeed =
    maximumClosingSpeed(input);
  let tick =
    input.swing.startTick;
  let pitch =
    sampleAerodynamicPitchTrajectory(
      input.trajectory,
      tick,
    );

  while (
    tick <= input.swing.endTick
  ) {
    const sampledSwing =
      sampleBatterSwingState(
        input.swing.stateAtStart,
        tick
          - input.swing.startTick,
        input.swing.ticksPerSecond,
      );
    const rigidBat =
      createRigidBatStateFromBatterSwingState(
        sampledSwing,
        input.swing.physical,
      );
    const separation =
      measureRigidBatBallSurfaceSeparation(
        pitch,
        rigidBat,
        input.ball,
      );

    if (separation <= 0) {
      const contact =
        resolveRigidBatBallContactWithParameterResolver(
          pitch,
          rigidBat,
          input.ball,
          input.parameterResolver,
        );
      if (contact !== null) {
        return {
          kind: 'contact',
          contact,
        };
      }
    }

    if (
      tick === input.swing.endTick
    ) {
      break;
    }

    const safeAdvanceTicks =
      (
        separation > 0
        && closingSpeed > EPSILON
      )
        ? (
            Math.floor(
              (
                separation
                / closingSpeed
              )
              * input.swing
                .ticksPerSecond,
            ) - 1
          )
        : 1;

    const advanceTicks =
      Math.min(
        input.swing.endTick - tick,
        Math.max(
          1,
          safeAdvanceTicks,
        ),
      );

    pitch =
      advanceAerodynamicPitchState(
        pitch,
        advanceTicks,
        input.trajectory.parameters,
      );
    tick += advanceTicks;
  }

  return {
    kind: 'swinging_miss',
    adjudicationTick:
      input.swing.endTick,
  };
};
