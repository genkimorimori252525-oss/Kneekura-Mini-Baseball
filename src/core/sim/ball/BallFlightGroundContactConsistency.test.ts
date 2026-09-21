import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from './BaseballAerodynamics';
import {
  findGroundContactTick,
  sampleUninterruptedBallFreeFlight,
  type BallFlightParameters,
} from './BallFlight';

const parameters: BallFlightParameters = {
  ticksPerSecond: 1_000_000,
  gravityY: -9.81,
  ballRadius: 0.0366,
  groundRestitution: 0.35,
  groundFriction: 0.78,
  groundRollingDecelerationMps2: 4,
  integrationStepTicks: 2_000,
  restingVerticalSpeed: 0.5,
  aerodynamics:
    REFERENCE_BASEBALL_AERODYNAMICS,
  groundSurfacePhysics: null,
};

describe('aerodynamic ground-contact timing consistency', () => {
  it('finds contact on the same composed RK4 free-flight path used by the canonical integrator', () => {
    const initial = {
      tick: 1_000_000,
      position: {
        x: 0,
        y: 2,
        z: 0,
      },
      velocity: {
        x: 8,
        y: 4,
        z: 35,
      },
      spin: {
        x: -180,
        y: 20,
        z: 0,
      },
    };

    const contactTick =
      findGroundContactTick(
        initial,
        2_000_000,
        parameters,
      );

    expect(contactTick).not.toBeNull();

    const before =
      sampleUninterruptedBallFreeFlight(
        initial,
        contactTick! - initial.tick - 1,
        parameters,
      );
    const at =
      sampleUninterruptedBallFreeFlight(
        initial,
        contactTick! - initial.tick,
        parameters,
      );

    expect(before.position.y)
      .toBeGreaterThan(
        parameters.ballRadius,
      );
    expect(at.position.y)
      .toBeLessThanOrEqual(
        parameters.ballRadius,
      );
  });

  it('is independent of how wide the caller search window is once the first contact is included', () => {
    const initial = {
      tick: 2_000_000,
      position: {
        x: 0,
        y: 1.5,
        z: 0,
      },
      velocity: {
        x: 4,
        y: 1,
        z: 30,
      },
      spin: {
        x: -120,
        y: 0,
        z: 40,
      },
    };

    const wide =
      findGroundContactTick(
        initial,
        2_000_000,
        parameters,
      );

    expect(wide).not.toBeNull();

    const exactWindow =
      wide! - initial.tick;
    const narrow =
      findGroundContactTick(
        initial,
        exactWindow,
        parameters,
      );

    expect(narrow).toBe(wide);
  });
});
