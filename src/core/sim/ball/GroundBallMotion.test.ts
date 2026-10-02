import { describe, expect, it } from 'vitest';
import {
  REALISTIC_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  advanceGroundBallMotion,
  calculateGroundContactSlipVelocity,
} from './GroundBallMotion';

const parameters = {
  ticksPerSecond: 1_000_000,
  gravityMagnitudeMps2: 9.81,
  ball:
    REALISTIC_BASEBALL_RIGID_BODY,
  slidingFrictionCoefficient: 0.3,
  rollingDecelerationMps2: 1,
} as const;

describe('ground ball skid-to-roll motion', () => {
  it('measures bottom-point slip from both translation and spin', () => {
    const slip =
      calculateGroundContactSlipVelocity(
        {
          x: 5,
          y: 0,
          z: 2,
        },
        {
          x: 10,
          y: 3,
          z: -20,
        },
        parameters.ball.radiusM,
      );

    expect(slip.x).toBeCloseTo(
      5
      - 20
        * parameters.ball.radiusM,
      12,
    );
    expect(slip.z).toBeCloseTo(
      2
      - 10
        * parameters.ball.radiusM,
      12,
    );
  });

  it('slows a zero-spin skidding ball and generates rolling backspin', () => {
    const result =
      advanceGroundBallMotion(
        {
          tick: 0,
          position: {
            x: 0,
            y: parameters.ball.radiusM,
            z: 0,
          },
          velocity: {
            x: 8,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        1_000_000,
        parameters,
      );

    expect(result.reachedRollingConstraint)
      .toBe(true);
    expect(result.state.velocity.x)
      .toBeLessThan(8);
    expect(result.state.spin.z)
      .toBeLessThan(0);

    const slip =
      calculateGroundContactSlipVelocity(
        result.state.velocity,
        result.state.spin,
        parameters.ball.radiusM,
      );
    expect(Math.hypot(slip.x, slip.z))
      .toBeLessThan(1e-9);
  });

  it('can accelerate translation while removing excessive topspin/overspin slip', () => {
    const radius =
      parameters.ball.radiusM;
    const result =
      advanceGroundBallMotion(
        {
          tick: 0,
          position: {
            x: 0,
            y: radius,
            z: 0,
          },
          velocity: {
            x: 5,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: -220,
          },
        },
        200_000,
        parameters,
      );

    expect(result.state.velocity.x)
      .toBeGreaterThan(5);
    expect(
      Math.abs(result.state.spin.z),
    ).toBeLessThan(220);
  });

  it('remains in sliding mode when friction cannot remove slip inside the step', () => {
    const result =
      advanceGroundBallMotion(
        {
          tick: 0,
          position: {
            x: 0,
            y: parameters.ball.radiusM,
            z: 0,
          },
          velocity: {
            x: 20,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        10_000,
        {
          ...parameters,
          slidingFrictionCoefficient:
            0.05,
        },
      );

    expect(result.mode).toBe('sliding');
    expect(
      result.reachedRollingConstraint,
    ).toBe(false);

    const slip =
      calculateGroundContactSlipVelocity(
        result.state.velocity,
        result.state.spin,
        parameters.ball.radiusM,
      );
    expect(Math.abs(slip.x))
      .toBeGreaterThan(0);
  });

  it('applies rolling resistance only after no-slip rolling begins', () => {
    const radius =
      parameters.ball.radiusM;
    const noSlipSpinZ =
      -6 / radius;

    const result =
      advanceGroundBallMotion(
        {
          tick: 0,
          position: {
            x: 0,
            y: radius,
            z: 0,
          },
          velocity: {
            x: 6,
            y: 0,
            z: 0,
          },
          spin: {
            x: 0,
            y: 0,
            z: noSlipSpinZ,
          },
        },
        1_000_000,
        parameters,
      );

    expect(result.mode).toBe('rolling');
    expect(result.slidingSeconds).toBe(0);
    expect(result.state.velocity.x)
      .toBeCloseTo(5, 10);
    expect(result.state.spin.z)
      .toBeCloseTo(
        -5 / radius,
        10,
      );
  });
});
