import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  IDENTITY_QUATERNION,
  rotateVectorByQuaternion,
} from './BaseballOrientation';
import {
  findAerodynamicPitchPlateCrossing,
  sampleAerodynamicPitchTrajectory,
  type AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';

const params = {
  ticksPerSecond: 1_000_000,
  integrationStepTicks: 1_000,
  gravityY: -9.81,
  aerodynamics: REFERENCE_BASEBALL_AERODYNAMICS,
} as const;

const trajectory = (
  spin = { x: 0, y: 0, z: 0 },
): AerodynamicPitchTrajectory => ({
  start: {
    tick: 1_000_000,
    position: {
      x: 0,
      y: 1.8,
      z: 16.5,
    },
    velocity: {
      x: 0,
      y: 0,
      z: -42.5,
    },
    spin,
  },
  endTick: 1_600_000,
  parameters: params,
});

describe('aerodynamic pitch trajectory', () => {
  it('slows a pitch through drag', () => {
    const state = sampleAerodynamicPitchTrajectory(
      trajectory(),
      1_300_000,
    );

    expect(Math.abs(state.velocity.z))
      .toBeLessThan(42.5);
  });

  it('makes backspin resist gravitational drop', () => {
    const noSpin = sampleAerodynamicPitchTrajectory(
      trajectory(),
      1_350_000,
    );
    const backspin = sampleAerodynamicPitchTrajectory(
      trajectory({ x: 220, y: 0, z: 0 }),
      1_350_000,
    );

    expect(backspin.position.y)
      .toBeGreaterThan(noSpin.position.y);
    expect(backspin.velocity.y)
      .toBeGreaterThan(noSpin.velocity.y);
  });

  it('makes sidespin create lateral break', () => {
    const noSpin = sampleAerodynamicPitchTrajectory(
      trajectory(),
      1_350_000,
    );
    const sidespin = sampleAerodynamicPitchTrajectory(
      trajectory({ x: 0, y: 220, z: 0 }),
      1_350_000,
    );

    expect(Math.abs(sidespin.position.x))
      .toBeGreaterThan(Math.abs(noSpin.position.x));
  });

  it('gives release-axis gyrospin far less movement than true backspin', () => {
    const noSpin = sampleAerodynamicPitchTrajectory(
      trajectory(),
      1_350_000,
    );
    const gyro = sampleAerodynamicPitchTrajectory(
      trajectory({ x: 0, y: 0, z: -220 }),
      1_350_000,
    );
    const backspin = sampleAerodynamicPitchTrajectory(
      trajectory({ x: 220, y: 0, z: 0 }),
      1_350_000,
    );

    const gyroMovement = Math.hypot(
      gyro.position.x - noSpin.position.x,
      gyro.position.y - noSpin.position.y,
    );
    const backspinMovement = Math.hypot(
      backspin.position.x - noSpin.position.x,
      backspin.position.y - noSpin.position.y,
    );

    expect(gyroMovement)
      .toBeLessThan(backspinMovement * 0.1);
  });

  it('lets instantaneous active-spin geometry change as the velocity vector bends', () => {
    const input = trajectory({
      x: 0,
      y: 0,
      z: -220,
    });
    const release = input.start;
    const late = sampleAerodynamicPitchTrajectory(
      input,
      1_350_000,
    );

    expect(release.velocity.y).toBe(0);
    expect(late.velocity.y).toBeLessThan(0);
    expect(late.spin).toEqual(release.spin);
  });

  it('finds the plate crossing under changing aerodynamic acceleration', () => {
    const crossing = findAerodynamicPitchPlateCrossing(
      trajectory({ x: 220, y: 0, z: 0 }),
      0,
    );

    expect(crossing).not.toBeNull();
    expect(crossing!.position.z)
      .toBeCloseTo(0, 12);
    expect(crossing!.elapsedSeconds)
      .toBeGreaterThan(16.5 / 42.5);
    expect(crossing!.spinDecomposition.activeSpinFraction)
      .toBeGreaterThan(0.99);
  });

  it('keeps the physical spin vector fixed while Magnus geometry follows velocity', () => {
    const input = trajectory({
      x: 170,
      y: 80,
      z: -60,
    });
    const releaseSpin = input.start.spin;
    const late = sampleAerodynamicPitchTrajectory(
      input,
      1_400_000,
    );

    expect(late.spin).toEqual(releaseSpin);
  });

  it('carries seam/material orientation to the plate crossing', () => {
    const input: AerodynamicPitchTrajectory = {
      ...trajectory({
        x: 100,
        y: 0,
        z: 0,
      }),
      releaseOrientation: IDENTITY_QUATERNION,
    };
    const crossing = findAerodynamicPitchPlateCrossing(
      input,
      0,
    );

    expect(crossing).not.toBeNull();
    expect(crossing!.orientation)
      .toBeDefined();

    const releaseMarker = {
      x: 0,
      y: 1,
      z: 0,
    };
    const crossedMarker = rotateVectorByQuaternion(
      releaseMarker,
      crossing!.orientation!,
    );

    expect(crossedMarker)
      .not.toEqual(releaseMarker);
  });

  it('is deterministic for identical inputs', () => {
    const input = trajectory({
      x: 180,
      y: 70,
      z: -50,
    });

    const a = sampleAerodynamicPitchTrajectory(
      input,
      1_425_000,
    );
    const b = sampleAerodynamicPitchTrajectory(
      input,
      1_425_000,
    );

    expect(a).toEqual(b);
  });
});
