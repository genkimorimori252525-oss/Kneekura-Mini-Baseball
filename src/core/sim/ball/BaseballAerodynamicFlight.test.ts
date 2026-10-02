import { describe, expect, it } from 'vitest';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import {
  REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
  advanceBallState,
} from './BallFlight';
import { REFERENCE_BASEBALL_AERODYNAMICS } from './BaseballAerodynamics';

const initial = (
  overrides: Partial<BattedBallInitialState> = {},
): BattedBallInitialState => ({
  tick: 1_000_000,
  position: { x: 0, y: 1, z: 0 },
  velocity: { x: 0, y: 20, z: 45 },
  spin: { x: 0, y: 0, z: 0 },
  ...overrides,
});

describe('realistic baseball flight', () => {
  it('loses forward speed and range to aerodynamic drag', () => {
    const state = initial();

    const vacuumLike = advanceBallState(
      state,
      500_000,
      {
        ...REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
        aerodynamics: null,
      },
    );
    const withAir = advanceBallState(
      state,
      500_000,
      REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
    );

    expect(withAir.velocity.z).toBeLessThan(vacuumLike.velocity.z);
    expect(withAir.position.z).toBeLessThan(vacuumLike.position.z);
  });

  it('lets backspin support the ball through Magnus lift', () => {
    const noSpin = advanceBallState(
      initial(),
      750_000,
      REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
    );
    const backspin = advanceBallState(
      initial({
        spin: { x: -200, y: 0, z: 0 },
      }),
      750_000,
      REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
    );

    expect(backspin.position.y).toBeGreaterThan(noSpin.position.y);
    expect(backspin.velocity.y).toBeGreaterThan(noSpin.velocity.y);
  });

  it('makes a tailwind reduce relative drag', () => {
    const state = initial();
    const calm = advanceBallState(
      state,
      500_000,
      REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
    );
    const tailWind = advanceBallState(
      state,
      500_000,
      {
        ...REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
        aerodynamics: {
          ...REFERENCE_BASEBALL_AERODYNAMICS,
          windVelocityMps: { x: 0, y: 0, z: 10 },
        },
      },
    );

    expect(tailWind.velocity.z).toBeGreaterThan(calm.velocity.z);
  });

  it('is deterministic for identical physical inputs', () => {
    const state = initial({
      velocity: { x: 8, y: 18, z: 42 },
      spin: { x: -180, y: 35, z: 20 },
    });

    const a = advanceBallState(
      state,
      900_000,
      REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
    );
    const b = advanceBallState(
      state,
      900_000,
      REALISTIC_BASEBALL_FLIGHT_PARAMETERS,
    );

    expect(a).toEqual(b);
  });
});
