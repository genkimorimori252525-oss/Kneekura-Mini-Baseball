import type {
  BatterSwingState,
  BatBallContactResult,
  ContactParameters,
} from '../contact/BatBallContact';
import {
  DEFAULT_CONTACT_PARAMETERS,
  measureBatBallContactSeparation,
  resolveBatBallContact,
  sampleBatterSwingState,
} from '../contact/BatBallContact';
import {
  samplePitchTrajectorySegment,
  type PitchTrajectorySegment,
} from './PitchTrajectory';

export type BatterSwingWindow = Readonly<{
  startTick: number;
  endTick: number;
  ticksPerSecond: number;
  stateAtStart: BatterSwingState;
}>;

export type SwingingPitchPhysicalResult =
  | Readonly<{
      kind: 'contact';
      contact: BatBallContactResult;
    }>
  | Readonly<{
      kind: 'swinging_miss';
      adjudicationTick: number;
    }>;

export type SwingingPitchPhysicalInput = Readonly<{
  trajectory: PitchTrajectorySegment;
  swing: BatterSwingWindow;
  contactParameters?: ContactParameters;
}>;

const EPSILON = 1e-12;

const magnitude3 = (
  value: Readonly<{ x: number; y: number; z: number }>,
): number => Math.hypot(
  value.x,
  value.y,
  value.z,
);

const subtract3 = (
  first: Readonly<{ x: number; y: number; z: number }>,
  second: Readonly<{ x: number; y: number; z: number }>,
) => ({
  x: first.x - second.x,
  y: first.y - second.y,
  z: first.z - second.z,
});

const cross3 = (
  first: Readonly<{ x: number; y: number; z: number }>,
  second: Readonly<{ x: number; y: number; z: number }>,
) => ({
  x: first.y * second.z - first.z * second.y,
  y: first.z * second.x - first.x * second.z,
  z: first.x * second.y - first.y * second.x,
});

const add3 = (
  first: Readonly<{ x: number; y: number; z: number }>,
  second: Readonly<{ x: number; y: number; z: number }>,
) => ({
  x: first.x + second.x,
  y: first.y + second.y,
  z: first.z + second.z,
});

const validateSwingWindow = (
  input: SwingingPitchPhysicalInput,
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
      'swing window must lie inside the pitch trajectory interval',
    );
  }
  if (
    !Number.isSafeInteger(swing.ticksPerSecond)
    || swing.ticksPerSecond <= 0
    || swing.ticksPerSecond !== trajectory.ticksPerSecond
  ) {
    throw new Error(
      'pitch trajectory and swing window must share ticksPerSecond',
    );
  }
};

const maximumGeometricClosingSpeed = (
  input: SwingingPitchPhysicalInput,
): number => {
  const pitchAtSwingStart = samplePitchTrajectorySegment(
    input.trajectory,
    input.swing.startTick,
  );
  const durationSeconds = (
    input.swing.endTick - input.swing.startTick
  ) / input.swing.ticksPerSecond;

  const maximumPitchSpeed = (
    magnitude3(pitchAtSwingStart.velocity)
    + magnitude3(input.trajectory.acceleration)
      * durationSeconds
  );

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

  return maximumPitchSpeed + Math.max(
    gripSpeed,
    tipSpeed,
  );
};

export const resolveSwingingPitchPhysicalResult = (
  input: SwingingPitchPhysicalInput,
): SwingingPitchPhysicalResult => {
  validateSwingWindow(input);

  const parameters = (
    input.contactParameters
    ?? DEFAULT_CONTACT_PARAMETERS
  );
  const maxClosingSpeed =
    maximumGeometricClosingSpeed(input);

  let tick = input.swing.startTick;
  while (tick <= input.swing.endTick) {
    const pitch = samplePitchTrajectorySegment(
      input.trajectory,
      tick,
    );
    const swing = sampleBatterSwingState(
      input.swing.stateAtStart,
      tick - input.swing.startTick,
      input.swing.ticksPerSecond,
    );
    const separation = measureBatBallContactSeparation(
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
      && maxClosingSpeed > EPSILON
    )
      ? (
          Math.floor(
            (
              separation
              / maxClosingSpeed
            ) * input.swing.ticksPerSecond,
          ) - 1
        )
      : 1;

    tick = Math.min(
      input.swing.endTick,
      tick + Math.max(1, safeAdvanceTicks),
    );
  }

  return {
    kind: 'swinging_miss',
    adjudicationTick: input.swing.endTick,
  };
};
