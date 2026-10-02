import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from './BaseballAerodynamics';
import {
  NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
} from './BaseballSpinDecay';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  advanceBallState,
} from './BallFlight';

describe('batted-ball spin decay integration', () => {
  it('uses the same small aerodynamic spin-down model in free flight', () => {
    const initial = {
      tick: 0,
      position: {
        x: 0,
        y: 1,
        z: 0,
      },
      velocity: {
        x: 0,
        y: 10,
        z: 44.704,
      },
      spin: {
        x: -200,
        y: 0,
        z: 0,
      },
    };

    const result = advanceBallState(
      initial,
      1_000_000,
      {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        aerodynamics: {
          ...REFERENCE_BASEBALL_AERODYNAMICS,
          airDensityKgM3: 0,
          spinDecay:
            NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
        },
      },
    );

    expect(
      Math.abs(result.spin.x),
    ).toBeLessThan(
      Math.abs(initial.spin.x),
    );
    expect(result.spin.y).toBe(0);
    expect(result.spin.z).toBe(0);
  });

  it('keeps legacy no-decay aerodynamic flight spin exactly constant', () => {
    const initial = {
      tick: 0,
      position: {
        x: 0,
        y: 1,
        z: 0,
      },
      velocity: {
        x: 0,
        y: 10,
        z: 40,
      },
      spin: {
        x: -150,
        y: 10,
        z: 20,
      },
    };

    const result = advanceBallState(
      initial,
      300_000,
      {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        aerodynamics:
          REFERENCE_BASEBALL_AERODYNAMICS,
      },
    );

    expect(result.spin)
      .toEqual(initial.spin);
  });
});
