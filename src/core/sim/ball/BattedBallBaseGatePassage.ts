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
  classifyPointBeyondFirstThirdBaseGates,
  type FairFoulBaseGateGeometry,
  type FirstThirdBaseGateClassification,
} from './FairFoulBaseGateGeometry';
import {
  classifyBallAgainstFairTerritory,
  type FairTerritoryPointClassification,
  type FairTerritoryWedge,
} from './FairTerritoryGeometry';
import type {
  BattedBallInitialState,
} from '../contact/BatBallContact';

export type BattedBallBaseGatePassage = Readonly<{
  tick: number;
  state: BattedBallInitialState;
  beyond: FirstThirdBaseGateClassification;
  territory: FairTerritoryPointClassification;
}>;

export type BattedBallBaseGatePassageInput = Readonly<{
  flight: BattedBallFlightEvidence;
  field: FairTerritoryWedge;
  bases: FairFoulBaseGateGeometry;
  searchDurationTicks: number;
  parameters: BallFlightParameters;
}>;

export const findFirstBaseGatePassageAfterGroundContact = (
  input: BattedBallBaseGatePassageInput,
): BattedBallBaseGatePassage | null => {
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
      'base-gate passage search requires first ground contact evidence',
    );
  }

  const firstGround = input.flight.firstGroundContact;
  const firstGroundPoint = {
    x: firstGround.state.position.x,
    z: firstGround.state.position.z,
  };
  const firstGroundBeyond =
    classifyPointBeyondFirstThirdBaseGates(
      input.bases,
      firstGroundPoint,
    );

  if (
    firstGroundBeyond.firstBase
    || firstGroundBeyond.thirdBase
  ) {
    throw new Error(
      'base-gate passage search requires first ground contact before both gates',
    );
  }

  const endTick = (
    firstGround.tick
    + input.searchDurationTicks
  );
  if (!Number.isSafeInteger(endTick)) {
    throw new Error(
      'base-gate passage search end tick must be a safe integer',
    );
  }

  const stateAt = (
    tick: number,
  ): BattedBallInitialState => advanceBallState(
    input.flight.initialBall,
    tick - input.flight.initialBall.tick,
    input.parameters,
  );

  const passageTick = findFirstTrueTick(
    firstGround.tick,
    endTick,
    (tick) => {
      const state = stateAt(tick);
      const beyond =
        classifyPointBeyondFirstThirdBaseGates(
          input.bases,
          {
            x: state.position.x,
            z: state.position.z,
          },
        );
      return beyond.firstBase || beyond.thirdBase;
    },
  );

  if (passageTick === null) {
    return null;
  }

  const state = stateAt(passageTick);
  const beyond = classifyPointBeyondFirstThirdBaseGates(
    input.bases,
    {
      x: state.position.x,
      z: state.position.z,
    },
  );
  const territory = classifyBallAgainstFairTerritory(
    input.field,
    {
      x: state.position.x,
      z: state.position.z,
    },
    input.flight.ballRadiusMeters,
  );

  return {
    tick: passageTick,
    state,
    beyond,
    territory,
  };
};
