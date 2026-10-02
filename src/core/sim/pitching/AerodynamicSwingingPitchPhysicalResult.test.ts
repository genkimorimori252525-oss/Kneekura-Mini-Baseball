import { describe, expect, it } from 'vitest';
import type {
  BatterSwingState,
} from '../contact/BatBallContact';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  resolveAerodynamicSwingingPitchPhysicalResult,
} from './AerodynamicSwingingPitchPhysicalResult';
import type {
  BatterSwingWindow,
} from './SwingingPitchPhysicalResult';

const swingState = (
  xOffset = 0,
): BatterSwingState => ({
  pose: {
    grip: {
      x: -0.42 + xOffset,
      y: 1,
      z: 0,
    },
    tip: {
      x: 0.42 + xOffset,
      y: 1,
      z: 0,
    },
  },
  linearVelocity: {
    x: 0,
    y: 0,
    z: 0,
  },
  angularVelocity: {
    x: 0,
    y: 0,
    z: 0,
  },
});

const shortTrajectory = (
  spin = {
    x: 0,
    y: 0,
    z: 0,
  },
): AerodynamicPitchTrajectory => ({
  start: {
    tick: 1_000_000,
    position: {
      x: 0,
      y: 1,
      z: 0.2,
    },
    velocity: {
      x: 0,
      y: 0,
      z: -60,
    },
    spin,
  },
  endTick: 1_006_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 100,
    gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

const window = (
  stateAtStart = swingState(),
): BatterSwingWindow => ({
  startTick: 1_000_000,
  endTick: 1_006_000,
  ticksPerSecond: 1_000_000,
  stateAtStart,
});

describe('aerodynamic swinging pitch physical result', () => {
  it('finds contact on a continuously integrated aerodynamic pitch', () => {
    const result =
      resolveAerodynamicSwingingPitchPhysicalResult({
        trajectory: shortTrajectory(),
        swing: window(),
      });

    expect(result.kind).toBe('contact');
    if (result.kind !== 'contact') {
      throw new Error(
        'fixture must produce aerodynamic contact',
      );
    }
    expect(result.contact.tick)
      .toBeGreaterThan(1_000_000);
    expect(result.contact.tick)
      .toBeLessThan(1_006_000);
  });

  it('carries pitch spin into the physical contact state', () => {
    const spin = {
      x: 120,
      y: 40,
      z: -20,
    };
    const result =
      resolveAerodynamicSwingingPitchPhysicalResult({
        trajectory: shortTrajectory(spin),
        swing: window(),
      });

    expect(result.kind).toBe('contact');
    if (result.kind !== 'contact') {
      throw new Error(
        'fixture must produce aerodynamic contact',
      );
    }

    expect(result.contact.exitSpin.x)
      .not.toBe(0);
  });

  it('returns a miss when the bat geometry never reaches the aerodynamic pitch', () => {
    const result =
      resolveAerodynamicSwingingPitchPhysicalResult({
        trajectory: shortTrajectory(),
        swing: window(
          swingState(1),
        ),
      });

    expect(result).toEqual({
      kind: 'swinging_miss',
      adjudicationTick: 1_006_000,
    });
  });

  it('rejects mismatched trajectory and swing clocks', () => {
    expect(() =>
      resolveAerodynamicSwingingPitchPhysicalResult({
        trajectory: shortTrajectory(),
        swing: {
          ...window(),
          ticksPerSecond: 500_000,
        },
      }),
    ).toThrow(
      'aerodynamic pitch trajectory and swing window must share ticksPerSecond',
    );
  });

  it('is deterministic', () => {
    const input = {
      trajectory: shortTrajectory({
        x: 100,
        y: 40,
        z: -10,
      }),
      swing: window(),
    } as const;

    expect(
      resolveAerodynamicSwingingPitchPhysicalResult(
        input,
      ),
    ).toEqual(
      resolveAerodynamicSwingingPitchPhysicalResult(
        input,
      ),
    );
  });
});
