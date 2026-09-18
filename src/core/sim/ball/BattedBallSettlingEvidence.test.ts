import { describe, expect, it } from 'vitest';
import type {
  BattedBallFlightEvidence,
} from './BattedBallFlightEvidence';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from './BallFlight';
import {
  createFairTerritoryWedge,
} from './FairTerritoryGeometry';
import {
  findBattedBallSettlingEvidence,
} from './BattedBallSettlingEvidence';

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

const flight = (
  x: number,
  z: number,
  vx: number,
  vz: number,
): BattedBallFlightEvidence => ({
  contact: {
    tick: 1_000_000,
    ballCenter: { x, y: 0.0366, z },
    point: { x, y: 0.0366, z },
    batPoint: { x, y: 0.0366, z },
    normal: { x: 0, y: 0, z: 1 },
    segmentT: 0.5,
    exitVelocity: { x: vx, y: 0, z: vz },
    exitSpin: { x: 0, y: 0, z: 0 },
  },
  initialBall: {
    tick: 1_000_000,
    position: { x, y: 0.0366, z },
    velocity: { x: vx, y: 0, z: vz },
    spin: { x: 0, y: 0, z: 0 },
  },
  ballRadiusMeters: 0.0366,
  firstGroundContact: {
    tick: 1_000_000,
    state: {
      tick: 1_000_000,
      position: { x, y: 0.0366, z },
      velocity: { x: vx, y: 0, z: vz },
      spin: { x: 0, y: 0, z: 0 },
    },
  },
});

describe('BattedBallSettlingEvidence', () => {
  it('finds the first authoritative tick at which a rolling ball comes to rest', () => {
    const result = findBattedBallSettlingEvidence({
      flight: flight(0, 5, 3, 4),
      field,
      searchDurationTicks: 2_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.tick).toBe(2_250_000);
    expect(result?.state.velocity).toEqual({
      x: 0,
      y: 0,
      z: 0,
    });
    expect(result?.territory.kind).toBe('inside_fair_wedge');
  });

  it('classifies a settled ball fully outside the foul line as foul-territory evidence', () => {
    const result = findBattedBallSettlingEvidence({
      flight: flight(5, 0, 1, 0),
      field,
      searchDurationTicks: 2_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.territory.kind).toBe('outside_fair_wedge');
  });

  it('returns null when the ball has not stopped inside the search window', () => {
    expect(findBattedBallSettlingEvidence({
      flight: flight(0, 5, 3, 4),
      field,
      searchDurationTicks: 500_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
    })).toBeNull();
  });

  it('requires first-ground contact evidence', () => {
    expect(() => findBattedBallSettlingEvidence({
      flight: {
        ...flight(0, 5, 3, 4),
        firstGroundContact: null,
      },
      field,
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    })).toThrow(
      'settling search requires first-ground contact evidence',
    );
  });
});
