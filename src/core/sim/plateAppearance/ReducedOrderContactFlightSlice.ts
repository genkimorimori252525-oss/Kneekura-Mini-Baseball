import type {
  BattedBallInitialState,
  PitchWorldState,
} from '../contact/BatBallContact';
import {
  resolveRigidBatBallContact,
  type RigidBaseballProperties,
  type RigidBatBallContactParameters,
  type RigidBatBallContactResult,
  type RigidBatState,
} from '../contact/RigidBatBallContact';
import {
  sampleBallFlight,
  type BallFlightParameters,
} from '../ball/BallFlight';

export type ReducedOrderContactFlightSliceInput = Readonly<{
  pitch: PitchWorldState;
  bat: RigidBatState;
  ball: RigidBaseballProperties;
  contactParameters: RigidBatBallContactParameters;
  flightParameters: BallFlightParameters;
  durationTicks: number;
  cadenceTicks: number;
}>;

export type ReducedOrderContactFlightSliceResult = Readonly<{
  contact: RigidBatBallContactResult;
  initialBall: BattedBallInitialState;
  samples: readonly BattedBallInitialState[];
}>;

const validatePhysicalConsistency = (
  input: ReducedOrderContactFlightSliceInput,
): void => {
  if (
    Math.abs(
      input.flightParameters.ballRadius
      - input.ball.radiusM,
    ) > 1e-9
  ) {
    throw new Error(
      'flight ballRadius must match rigid contact ball radius',
    );
  }

  const aerodynamics =
    input.flightParameters.aerodynamics;
  if (aerodynamics !== null && aerodynamics !== undefined) {
    if (
      Math.abs(
        aerodynamics.ballRadiusM
        - input.ball.radiusM,
      ) > 1e-9
    ) {
      throw new Error(
        'aerodynamic ball radius must match rigid contact ball radius',
      );
    }
    if (
      Math.abs(
        aerodynamics.ballMassKg
        - input.ball.massKg,
      ) > 1e-9
    ) {
      throw new Error(
        'aerodynamic ball mass must match rigid contact ball mass',
      );
    }
  }
};

export const simulateReducedOrderContactFlightSlice = (
  input: ReducedOrderContactFlightSliceInput,
): ReducedOrderContactFlightSliceResult => {
  validatePhysicalConsistency(input);

  const contact = resolveRigidBatBallContact(
    input.pitch,
    input.bat,
    input.ball,
    input.contactParameters,
  );

  if (contact === null) {
    throw new Error(
      'reduced-order contact flight slice requires physical contact',
    );
  }

  const initialBall: BattedBallInitialState = {
    tick: contact.tick,
    position: input.pitch.position,
    velocity: contact.exitVelocity,
    spin: contact.exitSpin,
  };

  const samples = sampleBallFlight(
    initialBall,
    input.durationTicks,
    input.cadenceTicks,
    input.flightParameters,
  );

  return {
    contact,
    initialBall,
    samples,
  };
};
