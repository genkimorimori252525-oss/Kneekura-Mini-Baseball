import {
  createBattedBallInitialStateFromContact,
  type BatBallContactResult,
  type BattedBallInitialState,
} from '../contact/BatBallContact';
import {
  advanceBallState,
  findGroundContactTick,
  type BallFlightParameters,
} from './BallFlight';

export type FirstGroundContactEvidence = Readonly<{
  tick: number;
  state: BattedBallInitialState;
}>;

export type BattedBallFlightEvidence = Readonly<{
  contact: BatBallContactResult;
  initialBall: BattedBallInitialState;
  firstGroundContact: FirstGroundContactEvidence | null;
}>;

export type BattedBallFlightEvidenceInput = Readonly<{
  contact: BatBallContactResult;
  searchDurationTicks: number;
  parameters: BallFlightParameters;
}>;

export const createBattedBallFlightEvidence = (
  input: BattedBallFlightEvidenceInput,
): BattedBallFlightEvidence => {
  if (
    !Number.isInteger(input.searchDurationTicks)
    || input.searchDurationTicks < 0
  ) {
    throw new Error(
      'searchDurationTicks must be a non-negative integer',
    );
  }

  const initialBall =
    createBattedBallInitialStateFromContact(input.contact);

  const firstGroundContactTick = findGroundContactTick(
    initialBall,
    input.searchDurationTicks,
    input.parameters,
  );

  const firstGroundContact = firstGroundContactTick === null
    ? null
    : {
        tick: firstGroundContactTick,
        state: advanceBallState(
          initialBall,
          firstGroundContactTick - initialBall.tick,
          input.parameters,
        ),
      };

  return {
    contact: input.contact,
    initialBall,
    firstGroundContact,
  };
};
