import type {
  BattedBallInitialState,
} from '../contact/BatBallContact';
import type {
  RigidBaseballProperties,
  RigidBatBallContactParameterResolver,
  RigidBatBallContactResult,
} from '../contact/RigidBatBallContact';
import {
  sampleBallFlight,
  type BallFlightParameters,
} from '../ball/BallFlight';
import {
  resolveAerodynamicRigidBatSwing,
  type RigidBatSwingWindow,
} from '../pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import type {
  AerodynamicPitchTrajectory,
} from '../pitching/AerodynamicPitchTrajectory';

export type AerodynamicRigidContactFlightSliceInput = Readonly<{
  trajectory: AerodynamicPitchTrajectory;
  swing: RigidBatSwingWindow;
  ball: RigidBaseballProperties;
  parameterResolver:
    RigidBatBallContactParameterResolver;
  flightParameters: BallFlightParameters;
  durationTicks: number;
  cadenceTicks: number;
}>;

export type AerodynamicRigidContactFlightSliceResult = Readonly<{
  contact: RigidBatBallContactResult;
  initialBall: BattedBallInitialState;
  samples: readonly BattedBallInitialState[];
}>;

const validate = (
  input: AerodynamicRigidContactFlightSliceInput,
): void => {
  if (
    input.flightParameters.ballRadius
    !== input.ball.radiusM
  ) {
    throw new Error(
      'rigid contact-flight ball radius must match flight ballRadius',
    );
  }
  const aero =
    input.flightParameters.aerodynamics;
  if (aero !== null && aero !== undefined) {
    if (
      Math.abs(
        aero.ballMassKg
        - input.ball.massKg,
      ) > 1e-9
    ) {
      throw new Error(
        'rigid contact-flight ball mass must match aerodynamic ball mass',
      );
    }
    if (
      Math.abs(
        aero.ballRadiusM
        - input.ball.radiusM,
      ) > 1e-9
    ) {
      throw new Error(
        'rigid contact-flight ball radius must match aerodynamic ball radius',
      );
    }
  }
};

export const simulateAerodynamicRigidContactFlightSlice = (
  input: AerodynamicRigidContactFlightSliceInput,
): AerodynamicRigidContactFlightSliceResult => {
  validate(input);

  const swingResult =
    resolveAerodynamicRigidBatSwing({
      trajectory: input.trajectory,
      swing: input.swing,
      ball: input.ball,
      parameterResolver:
        input.parameterResolver,
    });

  if (swingResult.kind !== 'contact') {
    throw new Error(
      'rigid contact-flight slice requires physical bat-ball contact',
    );
  }

  const contact = swingResult.contact;
  const initialBall: BattedBallInitialState = {
    tick: contact.tick,
    position: contact.ballCenter,
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
