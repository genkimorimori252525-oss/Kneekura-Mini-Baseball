import {
  findFirstTrueTick,
} from '../ExactEventTime';
import {
  advanceBallState,
  type BallFlightParameters,
} from './BallFlight';
import type {
  BattedBallFlightEvidence,
} from './BattedBallFlightEvidence';
import {
  classifyBallAgainstFairTerritory,
  type FairTerritoryPointClassification,
  type FairTerritoryWedge,
} from './FairTerritoryGeometry';
import type {
  BattedBallInitialState,
} from '../contact/BatBallContact';

export type BattedBallSettlingEvidence = Readonly<{
  tick: number;
  state: BattedBallInitialState;
  territory: FairTerritoryPointClassification;
}>;

export type BattedBallSettlingEvidenceInput = Readonly<{
  flight: BattedBallFlightEvidence;
  field: FairTerritoryWedge;
  searchDurationTicks: number;
  parameters: BallFlightParameters;
}>;

const SPEED_EPSILON = 1e-12;

export const findBattedBallSettlingEvidence = (
  input: BattedBallSettlingEvidenceInput,
): BattedBallSettlingEvidence | null => {
  if (
    !Number.isInteger(input.searchDurationTicks)
    || input.searchDurationTicks < 0
  ) {
    throw new Error(
      'searchDurationTicks must be a non-negative integer',
    );
  }
  if (input.flight.firstGroundContact === null) {
    throw new Error(
      'settling search requires first-ground contact evidence',
    );
  }

  const startTick = input.flight.firstGroundContact.tick;
  const endTick = startTick + input.searchDurationTicks;
  if (!Number.isSafeInteger(endTick)) {
    throw new Error(
      'settling search end tick must be a safe integer',
    );
  }

  const stateAt = (
    tick: number,
  ): BattedBallInitialState => advanceBallState(
    input.flight.initialBall,
    tick - input.flight.initialBall.tick,
    input.parameters,
  );

  const settlingTick = findFirstTrueTick(
    startTick,
    endTick,
    (tick) => {
      const state = stateAt(tick);
      return (
        state.position.y
          <= input.parameters.ballRadius + SPEED_EPSILON
        && Math.abs(state.velocity.y) <= SPEED_EPSILON
        && Math.hypot(
          state.velocity.x,
          state.velocity.z,
        ) <= SPEED_EPSILON
      );
    },
  );

  if (settlingTick === null) {
    return null;
  }

  const state = stateAt(settlingTick);
  const territory = classifyBallAgainstFairTerritory(
    input.field,
    {
      x: state.position.x,
      z: state.position.z,
    },
    input.flight.ballRadiusMeters,
  );

  return {
    tick: settlingTick,
    state,
    territory,
  };
};
