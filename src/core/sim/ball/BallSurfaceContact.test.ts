import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  CROSS_NATHAN_2006_HARDWOOD_LOW_SPEED_LOWER_BOUND_FIXTURE,
  resolveBallSurfaceContact,
} from './BallSurfaceContact';

const base = () => ({
  tick: 1_000_000,
  ballCenter: {
    x: 0,
    y: REFERENCE_BASEBALL_RIGID_BODY
      .radiusM,
    z: 0,
  },
  ballVelocity: {
    x: 0,
    y: -5.6,
    z: 0,
  },
  ballSpin: {
    x: 0,
    y: 0,
    z: 0,
  },
  ball:
    REFERENCE_BASEBALL_RIGID_BODY,
  surfaceNormal: {
    x: 0,
    y: 1,
    z: 0,
  },
});

describe('ball-surface rigid reduced-order contact', () => {
  it('reproduces the reference normal COR for the low-speed hardwood fixture', () => {
    const result =
      resolveBallSurfaceContact({
        ...base(),
        parameters:
          CROSS_NATHAN_2006_HARDWOOD_LOW_SPEED_LOWER_BOUND_FIXTURE,
      });

    expect(result).not.toBeNull();
    expect(result!.exitVelocity.y)
      .toBeCloseTo(
        5.6 * 0.59,
        10,
      );
  });

  it('leaves tangential translation and spin unchanged on a frictionless surface', () => {
    const result =
      resolveBallSurfaceContact({
        ...base(),
        ballVelocity: {
          x: 8,
          y: -5,
          z: 0,
        },
        ballSpin: {
          x: 0,
          y: 0,
          z: -30,
        },
        parameters: {
          normalRestitution: 0.5,
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      });

    expect(result).not.toBeNull();
    expect(result!.exitVelocity.x)
      .toBeCloseTo(8, 12);
    expect(result!.exitSpin.z)
      .toBeCloseTo(-30, 12);
  });

  it('couples translation and spin while reducing bottom-point slip on a rough ground contact', () => {
    const result =
      resolveBallSurfaceContact({
        ...base(),
        ballVelocity: {
          x: 8,
          y: -6,
          z: 0,
        },
        parameters: {
          normalRestitution: 0.4,
          tangentialRestitution: 0,
          frictionCoefficient: 10,
        },
      });

    expect(result).not.toBeNull();
    expect(result!.tangentialTargetMet)
      .toBe(true);
    expect(result!.exitVelocity.x)
      .toBeLessThan(8);
    expect(result!.exitSpin.z)
      .toBeLessThan(0);
    expect(
      Math.abs(
        result!
          .relativeSurfaceVelocityAfter
          .x,
      ),
    ).toBeLessThan(1e-9);
  });

  it('uses the same solver for a vertical wall by changing only the surface normal', () => {
    const result =
      resolveBallSurfaceContact({
        ...base(),
        ballCenter: {
          x: -REFERENCE_BASEBALL_RIGID_BODY
            .radiusM,
          y: 1,
          z: 0,
        },
        ballVelocity: {
          x: 10,
          y: 0,
          z: 0,
        },
        surfaceNormal: {
          x: -1,
          y: 0,
          z: 0,
        },
        parameters: {
          normalRestitution: 0.5,
          tangentialRestitution: 0,
          frictionCoefficient: 0,
        },
      });

    expect(result).not.toBeNull();
    expect(result!.exitVelocity.x)
      .toBeCloseTo(-5, 12);
  });

  it('reports friction-limited sliding when the desired tangential response exceeds the impulse cap', () => {
    const result =
      resolveBallSurfaceContact({
        ...base(),
        ballVelocity: {
          x: 20,
          y: -1,
          z: 0,
        },
        parameters: {
          normalRestitution: 0.2,
          tangentialRestitution: 0,
          frictionCoefficient: 0.05,
        },
      });

    expect(result).not.toBeNull();
    expect(result!.tangentialTargetMet)
      .toBe(false);
    expect(
      Math.abs(
        result!
          .relativeSurfaceVelocityAfter
          .x,
      ),
    ).toBeGreaterThan(0);
  });

  it('returns null when the ball is already separating from the surface', () => {
    expect(
      resolveBallSurfaceContact({
        ...base(),
        ballVelocity: {
          x: 0,
          y: 1,
          z: 0,
        },
        parameters: {
          normalRestitution: 0.5,
          tangentialRestitution: 0,
          frictionCoefficient: 0.3,
        },
      }),
    ).toBeNull();
  });
});
