import { describe, expect, it } from 'vitest';
import {
  NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
} from '../ball/BaseballSpinDecay';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  advanceAerodynamicPitchState,
} from './AerodynamicPitchTrajectory';

describe('aerodynamic pitch spin decay', () => {
  it('reduces spin magnitude slightly over an ordinary pitch without rotating the axis', () => {
    const initial = {
      tick: 0,
      position: {
        x: 0,
        y: 1.8,
        z: 18.44,
      },
      velocity: {
        x: 0,
        y: 0,
        z: -44.704,
      },
      spin: {
        x: 200,
        y: -100,
        z: 50,
      },
    };

    const result =
      advanceAerodynamicPitchState(
        initial,
        400_000,
        {
          ticksPerSecond: 1_000_000,
          integrationStepTicks: 1_000,
          gravityY: 0,
          aerodynamics: {
            ...REFERENCE_BASEBALL_AERODYNAMICS,
            airDensityKgM3: 0,
            spinDecay:
              NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
          },
        },
      );

    expect(result.spin.x)
      .toBeLessThan(initial.spin.x);
    expect(result.spin.y)
      .toBeGreaterThan(initial.spin.y);
    expect(result.spin.z)
      .toBeLessThan(initial.spin.z);

    expect(
      result.spin.x
      / initial.spin.x,
    ).toBeCloseTo(
      result.spin.y
      / initial.spin.y,
      10,
    );
    expect(
      result.spin.x
      / initial.spin.x,
    ).toBeCloseTo(
      result.spin.z
      / initial.spin.z,
      10,
    );
  });

  it('preserves the frozen constant-spin path when spin decay is absent', () => {
    const initial = {
      tick: 0,
      position: {
        x: 0,
        y: 1.8,
        z: 18.44,
      },
      velocity: {
        x: 0,
        y: 0,
        z: -40,
      },
      spin: {
        x: 180,
        y: 20,
        z: -30,
      },
    };

    const result =
      advanceAerodynamicPitchState(
        initial,
        500_000,
        {
          ticksPerSecond: 1_000_000,
          integrationStepTicks: 1_000,
          gravityY: -9.81,
          aerodynamics:
            REFERENCE_BASEBALL_AERODYNAMICS,
        },
      );

    expect(result.spin)
      .toEqual(initial.spin);
  });
});
