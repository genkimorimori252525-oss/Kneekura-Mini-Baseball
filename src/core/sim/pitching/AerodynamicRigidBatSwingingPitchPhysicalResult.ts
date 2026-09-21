import type {
  BatterSwingState,
} from '../contact/BatBallContact';
import {
  sampleCompatibilityBatterSwingState,
} from '../contact/BatBallContact';
import {
  sampleSwingStateV1,
  type SwingKinematicsTrajectoryV1,
} from '../contact/SwingKinematicsV1';
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
  advanceAerodynamicPitchState,
  sampleAerodynamicPitchTrajectory,
  type AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';

export const SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS =
  200 as const;

export type RigidBatSwingWindow = Readonly<{
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  /**
   * Compatibility seed. When kinematicsV1 is present this is derived from the
   * v1 trajectory by createRigidBatSwingWindowFromKinematicsV1().
   */
  stateAtStart: BatterSwingState;
  physical: RigidBatPhysicalProperties;
  /**
   * Production swing path. When absent the frozen first-order compatibility
   * sampler is used.
   */
  kinematicsV1?:
    SwingKinematicsTrajectoryV1;
}>;

export const createRigidBatSwingWindowFromKinematicsV1 = (
  kinematicsV1:
    SwingKinematicsTrajectoryV1,
  physical:
    RigidBatPhysicalProperties,
): RigidBatSwingWindow => ({
  startTick:
    kinematicsV1.startTick,
  endTick:
    kinematicsV1.endTick,
  ticksPerSecond:
    kinematicsV1.ticksPerSecond,
  stateAtStart:
    sampleSwingStateV1(
      kinematicsV1,
      kinematicsV1.startTick,
    ),
  physical,
  kinematicsV1,
});

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

  const kinematics =
    swing.kinematicsV1;
  if (
    kinematics !== undefined
    && (
      kinematics.startTick
        !== swing.startTick
      || kinematics.endTick
        !== swing.endTick
      || kinematics.ticksPerSecond
        !== swing.ticksPerSecond
    )
  ) {
    throw new Error(
      'swing kinematics v1 interval must exactly match rigid bat swing window',
    );
  }
};

const sampleSwing = (
  swing: RigidBatSwingWindow,
  tick: number,
): BatterSwingState => (
  swing.kinematicsV1
  !== undefined
    ? sampleSwingStateV1(
        swing.kinematicsV1,
        tick,
      )
    : sampleCompatibilityBatterSwingState(
        swing.stateAtStart,
        tick
          - swing.startTick,
        swing.ticksPerSecond,
      )
);

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

  if (
    input.swing.kinematicsV1
    !== undefined
  ) {
    /**
     * Numerical safety bound, not a player-performance coefficient.
     * It intentionally exceeds plausible human bat-point speeds so
     * conservative advancement cannot skip a v1 bat crossing.
     */
    return (
      conservativePitchSpeed
      + SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS
    );
  }

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

const validateV1PointSpeed = (
  swing: RigidBatSwingWindow,
  sampledSwing: BatterSwingState,
): void => {
  if (
    swing.kinematicsV1
    === undefined
  ) {
    return;
  }

  const batAxis =
    subtract(
      sampledSwing.pose.tip,
      sampledSwing.pose.grip,
    );
  const gripSpeed =
    magnitude(
      sampledSwing.linearVelocity,
    );
  const tipSpeed =
    magnitude(
      add(
        sampledSwing.linearVelocity,
        cross(
          sampledSwing.angularVelocity,
          batAxis,
        ),
      ),
    );

  if (
    Math.max(
      gripSpeed,
      tipSpeed,
    )
    > SWING_KINEMATICS_V1_CONSERVATIVE_MAX_BAT_POINT_SPEED_MPS
  ) {
    throw new Error(
      'swing kinematics v1 exceeded conservative bat-point speed safety bound',
    );
  }
};

/**
 * Contact search for the calibrated rigid/reduced-order bat model on the
 * continuously integrated aerodynamic pitch path.
 *
 * Production swing windows carry Swing Kinematics v1. The old first-order
 * state sampler remains only as an explicit compatibility fallback.
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
      sampleSwing(
        input.swing,
        tick,
      );
    validateV1PointSpeed(
      input.swing,
      sampledSwing,
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