import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import { findBaseTouchTick, type BaseTouchRegion } from './BaseTouch';
import type { RunnerBodyContactParameters } from './RunnerBodyContact';
import type {
  RunnerMotionIntent,
  RunnerMotionParameters,
  RunnerMotionState,
} from './RunnerMotion';
import type { RunnerRoute } from './RunnerRoute';
import { findRunnerBaseTouchTick } from './RunnerBaseTouch';

const v = (x: number, z: number): Vec2 => ({ x, z });

const bodyParameters: RunnerBodyContactParameters = {
  uprightLeadMeters: 0,
  slideLeadMeters: 0,
};

const straightBase: BaseTouchRegion = {
  center: v(5, 0),
  halfSize: v(0.2, 0.2),
  rotationRadians: 0,
};

const acceleratingParameters: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 0,
  accelerationMps2: 4,
  brakingMps2: 4,
  slideDecelerationMps2: 5,
  topSpeedMps: 10,
};

const advanceIntent: RunnerMotionIntent = {
  kind: 'advance',
  issuedTick: 0,
};

describe('findRunnerBaseTouchTick', () => {
  it('finds base touch during acceleration when the legacy constant-velocity ray cannot', () => {
    const route: RunnerRoute = {
      segments: [{ kind: 'line', start: v(0, 0), end: v(20, 0) }],
    };
    const start: RunnerMotionState = {
      tick: 0,
      routeDistanceMeters: 0,
      speedMps: 0,
      driveDirection: 0,
      bodyMode: 'upright',
    };

    expect(findBaseTouchTick(
      { tick: 0, position: v(0, 0), velocity: v(0, 0) },
      straightBase,
      2_000_000,
      { ticksPerSecond: 1_000_000 },
    )).toBeNull();

    expect(findRunnerBaseTouchTick(
      start,
      advanceIntent,
      route,
      straightBase,
      2_000_000,
      acceleratingParameters,
      bodyParameters,
    )).toBe(1_549_194);
  });

  it('finds first touch while following an authoritative circular base-rounding arc', () => {
    const route: RunnerRoute = {
      segments: [{
        kind: 'arc',
        center: v(0, 0),
        radiusMeters: 2,
        startAngleRadians: 0,
        sweepRadians: Math.PI / 2,
      }],
    };
    const midpoint = Math.SQRT2;
    const base: BaseTouchRegion = {
      center: v(midpoint, midpoint),
      halfSize: v(0.05, 0.05),
      rotationRadians: 0,
    };
    const start: RunnerMotionState = {
      tick: 0,
      routeDistanceMeters: 0,
      speedMps: 1,
      driveDirection: 1,
      bodyMode: 'upright',
    };
    const parameters: RunnerMotionParameters = {
      ...acceleratingParameters,
      topSpeedMps: 1,
    };

    expect(findRunnerBaseTouchTick(
      start,
      advanceIntent,
      route,
      base,
      2_000_000,
      parameters,
      bodyParameters,
    )).toBe(1_501_280);
  });
});
