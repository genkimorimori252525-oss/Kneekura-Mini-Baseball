import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import {
  findBaseTouchTick,
  type BaseTouchParameters,
  type BaseTouchRegion,
  type RunnerTouchPointState,
} from './BaseTouch';

const v = (x: number, z: number): Vec2 => ({ x, z });

const parameters: BaseTouchParameters = {
  ticksPerSecond: 1_000_000,
};

const base: BaseTouchRegion = {
  center: v(0, 0),
  halfSize: v(0.01, 0.1),
  rotationRadians: 0,
};

const runnerPoint = (
  overrides: Partial<RunnerTouchPointState> = {},
): RunnerTouchPointState => ({
  tick: 3_000_000,
  position: v(-0.023337, 0),
  velocity: v(10, 0),
  ...overrides,
});

describe('findBaseTouchTick', () => {
  it('finds a base touch that begins and ends inside one coarse interval', () => {
    const touchTick = findBaseTouchTick(
      runnerPoint(),
      base,
      5_000,
      parameters,
    );

    expect(touchTick).toBe(3_001_334);
  });

  it('supports an oriented finite base region instead of assuming world-axis alignment', () => {
    const touchTick = findBaseTouchTick(
      runnerPoint({
        position: v(0, -0.023337),
        velocity: v(0, 10),
      }),
      {
        ...base,
        rotationRadians: Math.PI / 2,
      },
      5_000,
      parameters,
    );

    expect(touchTick).toBe(3_001_334);
  });

  it('returns the start tick when the supplied physical touch point is already on the base', () => {
    expect(
      findBaseTouchTick(
        runnerPoint({ position: v(0, 0), velocity: v(0, 0) }),
        base,
        5_000,
        parameters,
      ),
    ).toBe(3_000_000);
  });

  it('returns null when the physical touch point passes beside the base', () => {
    expect(
      findBaseTouchTick(
        runnerPoint({ position: v(-0.023337, 0.2) }),
        base,
        5_000,
        parameters,
      ),
    ).toBeNull();
  });
});
