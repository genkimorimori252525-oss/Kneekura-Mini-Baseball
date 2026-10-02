import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  resolveAerodynamicTakenPitchPhysicalResult,
} from './AerodynamicTakenPitchPhysicalResult';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';

const trajectory = (
  spin: Readonly<{ x: number; y: number; z: number }>,
): AerodynamicPitchTrajectory => ({
  start: {
    tick: 1_000_000,
    position: {
      x: 0,
      y: 1.65,
      z: 16.5,
    },
    velocity: {
      x: 0,
      y: 0,
      z: -42,
    },
    spin,
  },
  endTick: 1_600_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 1_000,
    gravityY: -9.81,
    aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

const zone = {
  centerX: 0,
  halfWidth: 0.215,
  lowerY: 0.55,
  upperY: 1.75,
} as const;

describe('aerodynamic taken pitch physical result', () => {
  it('uses the aerodynamic plate crossing for strike geometry', () => {
    const result =
      resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: trajectory({
          x: 210,
          y: 0,
          z: 0,
        }),
        plateZ: 0,
        strikeZone: zone,
        ballRadiusMeters: 0.0366,
      });

    expect(result).not.toBeNull();
    expect(result!.kind).toBe('called_strike');
    expect(result!.crossing.spinDecomposition.activeSpinFraction)
      .toBeGreaterThan(0.99);
  });

  it('lets sidespin move an otherwise centered pitch laterally', () => {
    const noSpin =
      resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: trajectory({
          x: 0,
          y: 0,
          z: 0,
        }),
        plateZ: 0,
        strikeZone: zone,
        ballRadiusMeters: 0.0366,
      });
    const sidespin =
      resolveAerodynamicTakenPitchPhysicalResult({
        trajectory: trajectory({
          x: 0,
          y: 240,
          z: 0,
        }),
        plateZ: 0,
        strikeZone: zone,
        ballRadiusMeters: 0.0366,
      });

    expect(noSpin).not.toBeNull();
    expect(sidespin).not.toBeNull();
    expect(Math.abs(sidespin!.crossing.position.x))
      .toBeGreaterThan(
        Math.abs(noSpin!.crossing.position.x),
      );
  });
});
