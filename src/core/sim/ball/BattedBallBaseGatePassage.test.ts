import { describe, expect, it } from 'vitest';
import type {
  BattedBallFlightEvidence,
} from './BattedBallFlightEvidence';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from './BallFlight';
import {
  createFairFoulBaseGateGeometry,
} from './FairFoulBaseGateGeometry';
import {
  createFairTerritoryWedge,
} from './FairTerritoryGeometry';
import {
  findFirstBaseGatePassageAfterGroundContact,
} from './BattedBallBaseGatePassage';

const bases = createFairFoulBaseGateGeometry({
  homePlate: { x: 0, z: 0 },
  firstBase: { x: 27.432, z: 27.432 },
  secondBase: { x: 0, z: 54.864 },
  thirdBase: { x: -27.432, z: 27.432 },
});

const field = createFairTerritoryWedge({
  homePlate: { x: 0, z: 0 },
  firstBaseLineUnit: {
    x: Math.SQRT1_2,
    z: Math.SQRT1_2,
  },
  thirdBaseLineUnit: {
    x: -Math.SQRT1_2,
    z: Math.SQRT1_2,
  },
});

const evidence = (
  velocityX: number,
  velocityZ: number,
): BattedBallFlightEvidence => ({
  contact: {
    tick: 1_000_000,
    ballCenter: { x: 0, y: 0.0366, z: 10 },
    point: { x: 0, y: 0.0366, z: 10 },
    batPoint: { x: 0, y: 0.0366, z: 10 },
    normal: { x: 0, y: 0, z: 1 },
    segmentT: 0.5,
    exitVelocity: {
      x: velocityX,
      y: 0,
      z: velocityZ,
    },
    exitSpin: { x: 0, y: 0, z: 0 },
  },
  initialBall: {
    tick: 1_000_000,
    position: { x: 0, y: 0.0366, z: 10 },
    velocity: {
      x: velocityX,
      y: 0,
      z: velocityZ,
    },
    spin: { x: 0, y: 0, z: 0 },
  },
  ballRadiusMeters: 0.0366,
  firstGroundContact: {
    tick: 1_000_000,
    state: {
      tick: 1_000_000,
      position: { x: 0, y: 0.0366, z: 10 },
      velocity: {
        x: velocityX,
        y: 0,
        z: velocityZ,
      },
      spin: { x: 0, y: 0, z: 0 },
    },
  },
});

describe('BattedBallBaseGatePassage', () => {
  it('finds the first authoritative tick a fair rolling ball passes a base gate', () => {
    const result = findFirstBaseGatePassageAfterGroundContact({
      flight: evidence(20, 30),
      field,
      bases,
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(result).not.toBeNull();
    expect(result?.tick).toBeGreaterThan(1_000_000);
    expect(result?.beyond.firstBase).toBe(true);
    expect(result?.beyond.thirdBase).toBe(false);
    expect(result?.territory.kind).toBe('inside_fair_wedge');

    const prior = findFirstBaseGatePassageAfterGroundContact({
      flight: evidence(20, 30),
      field,
      bases,
      searchDurationTicks:
        (result?.tick ?? 1_000_000) - 1_000_001,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });
    expect(prior).toBeNull();
  });

  it('records foul territory when the ball passes the first-base gate outside the foul line', () => {
    const result = findFirstBaseGatePassageAfterGroundContact({
      flight: evidence(40, 15),
      field,
      bases,
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(result).not.toBeNull();
    expect(result?.beyond.firstBase).toBe(true);
    expect(result?.territory.kind).toBe('outside_fair_wedge');
  });

  it('returns null when the rolling ball never reaches either gate in the search window', () => {
    expect(findFirstBaseGatePassageAfterGroundContact({
      flight: evidence(1, 1),
      field,
      bases,
      searchDurationTicks: 100_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    })).toBeNull();
  });

  it('rejects evidence whose first ground contact is already beyond a base gate', () => {
    const alreadyBeyond: BattedBallFlightEvidence = {
      ...evidence(1, 1),
      initialBall: {
        ...evidence(1, 1).initialBall,
        position: { x: 20, y: 0.0366, z: 40 },
      },
      firstGroundContact: {
        tick: 1_000_000,
        state: {
          ...evidence(1, 1).initialBall,
          position: { x: 20, y: 0.0366, z: 40 },
        },
      },
    };

    expect(() => findFirstBaseGatePassageAfterGroundContact({
      flight: alreadyBeyond,
      field,
      bases,
      searchDurationTicks: 1_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    })).toThrow(
      'base-gate passage search requires first ground contact before both gates',
    );
  });
});
