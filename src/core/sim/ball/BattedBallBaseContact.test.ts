import { describe, expect, it } from 'vitest';
import type {
  BattedBallFlightEvidence,
} from './BattedBallFlightEvidence';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from './BallFlight';
import {
  findFirstRollingBattedBallBaseContact,
  type BattedBallBasePrism,
} from './BattedBallBaseContact';

const base = (
  centerX = 3,
  centerZ = 0,
): BattedBallBasePrism => ({
  region: {
    center: { x: centerX, z: centerZ },
    halfSize: { x: 0.2, z: 0.2 },
    rotationRadians: 0,
  },
  bottomY: 0,
  topY: 0.05,
});

const flight = (
  startX: number,
  startZ: number,
  velocityX: number,
  velocityZ: number,
): BattedBallFlightEvidence => {
  const ballRadius = 0.0366;
  const state = {
    tick: 1_000_000,
    position: {
      x: startX,
      y: ballRadius,
      z: startZ,
    },
    velocity: {
      x: velocityX,
      y: 0,
      z: velocityZ,
    },
    spin: { x: 0, y: 0, z: 0 },
  };

  return {
    contact: {
      tick: state.tick,
      ballCenter: state.position,
      point: state.position,
      batPoint: state.position,
      normal: { x: 1, y: 0, z: 0 },
      segmentT: 0.5,
      exitVelocity: state.velocity,
      exitSpin: state.spin,
    },
    initialBall: state,
    ballRadiusMeters: ballRadius,
    firstGroundContact: {
      tick: state.tick,
      state,
    },
  };
};

describe('BattedBallBaseContact', () => {
  it('finds exact rolling sphere contact with the front face of a base prism', () => {
    const result = findFirstRollingBattedBallBaseContact({
      flight: flight(0, 0, 4, 0),
      base: 1,
      basePrism: base(),
      searchDurationTicks: 1_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 0,
      },
    });

    expect(result).not.toBeNull();
    expect(result?.base).toBe(1);
    expect(result?.tick).toBe(1_690_850);
    expect(result?.continuousContactCenter.x)
      .toBeCloseTo(3 - 0.2 - 0.0366, 12);
    expect(result?.continuousContactCenter.z)
      .toBeCloseTo(0, 12);
  });

  it('uses the spherical radius at a rounded base corner instead of rectangular inflation', () => {
    const result = findFirstRollingBattedBallBaseContact({
      flight: flight(0, 0.45, 4, 0),
      base: 1,
      basePrism: base(),
      searchDurationTicks: 1_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 0,
      },
    });

    expect(result).toBeNull();

    const grazing = findFirstRollingBattedBallBaseContact({
      flight: flight(0, 0.225, 4, 0),
      base: 1,
      basePrism: base(),
      searchDurationTicks: 1_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 0,
      },
    });

    expect(grazing).not.toBeNull();
    expect(grazing?.continuousContactCenter.z)
      .toBeCloseTo(0.225, 12);
  });

  it('accounts for rolling deceleration when converting contact distance to authoritative time', () => {
    const result = findFirstRollingBattedBallBaseContact({
      flight: flight(0, 0, 4, 0),
      base: 1,
      basePrism: base(1.5, 0),
      searchDurationTicks: 1_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 2,
      },
    });

    expect(result).not.toBeNull();
    const distance = 1.5 - 0.2 - 0.0366;
    const seconds = (
      4 - Math.sqrt(16 - 4 * distance)
    ) / 2;
    expect(result?.tick).toBe(
      1_000_000 + Math.ceil(seconds * 1_000_000),
    );
  });

  it('returns null when vertical sphere/base-prism ranges do not overlap', () => {
    expect(findFirstRollingBattedBallBaseContact({
      flight: flight(0, 0, 4, 0),
      base: 1,
      basePrism: {
        ...base(),
        bottomY: 0.2,
        topY: 0.25,
      },
      searchDurationTicks: 1_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 0,
      },
    })).toBeNull();
  });

  it('returns null when the ball stops before reaching the base', () => {
    expect(findFirstRollingBattedBallBaseContact({
      flight: flight(0, 0, 1, 0),
      base: 3,
      basePrism: base(3, 0),
      searchDurationTicks: 3_000_000,
      parameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
    })).toBeNull();
  });
});
