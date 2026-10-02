import { describe, expect, it } from 'vitest';
import {
  NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
  advanceBaseballSpinDecay,
  calculateBaseballSpinDecayDerivative,
  calculateBaseballSpinDecayTimeConstantSeconds,
} from './BaseballSpinDecay';

describe('baseball spin decay', () => {
  it('uses about a 20 second 1/e time at 100 mph reference speed', () => {
    expect(
      calculateBaseballSpinDecayTimeConstantSeconds(
        44.704,
      ),
    ).toBeCloseTo(20, 12);

    const after =
      advanceBaseballSpinDecay(
        {
          x: 200,
          y: 0,
          z: 0,
        },
        44.704,
        20,
      );

    expect(after.x)
      .toBeCloseTo(
        200 / Math.E,
        10,
      );
  });

  it('makes decay time inversely proportional to air-relative speed', () => {
    expect(
      calculateBaseballSpinDecayTimeConstantSeconds(
        22.352,
      ),
    ).toBeCloseTo(40, 12);
  });

  it('preserves spin direction while reducing magnitude', () => {
    const derivative =
      calculateBaseballSpinDecayDerivative(
        {
          x: 100,
          y: -50,
          z: 20,
        },
        {
          x: 0,
          y: 0,
          z: 44.704,
        },
        NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
      );

    expect(derivative.x)
      .toBeCloseTo(-5, 12);
    expect(derivative.y)
      .toBeCloseTo(2.5, 12);
    expect(derivative.z)
      .toBeCloseTo(-1, 12);
  });

  it('has no aerodynamic spin decay at zero air-relative speed', () => {
    const after =
      advanceBaseballSpinDecay(
        {
          x: 100,
          y: 20,
          z: -30,
        },
        0,
        5,
      );

    expect(after).toEqual({
      x: 100,
      y: 20,
      z: -30,
    });
  });
});
