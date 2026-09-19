import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import type {
  AerodynamicPitchTrajectory,
} from './AerodynamicPitchTrajectory';
import {
  classifyPitchMovementDirection,
  displayPitchMovementDirection,
  measurePitchMovementSignature,
} from './PitchMovementSignature';

const trajectory = (
  spin: Readonly<{
    x: number;
    y: number;
    z: number;
  }>,
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
      z: -42,
    },
    spin,
  },
  endTick: 1_600_000,
  parameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 1_000,
    gravityY: -9.81,
    aerodynamics:
      REFERENCE_BASEBALL_AERODYNAMICS,
  },
});

describe('pitch movement signature', () => {
  it('classifies broad movement direction independently of pitch name', () => {
    expect(
      classifyPitchMovementDirection(
        0,
        -0.2,
      ),
    ).toBe('down');
    expect(
      classifyPitchMovementDirection(
        0.2,
        0,
      ),
    ).toBe('x_positive');
    expect(
      classifyPitchMovementDirection(
        -0.2,
        0.2,
      ),
    ).toBe('up_x_negative');
  });

  it('maps simulation horizontal sign to readable right/left only at display time', () => {
    expect(
      displayPitchMovementDirection(
        'down_x_positive',
        'positive_x_is_right',
      ),
    ).toBe('down_right');
    expect(
      displayPitchMovementDirection(
        'down_x_positive',
        'positive_x_is_left',
      ),
    ).toBe('down_left');
  });

  it('measures spin-induced movement against the same zero-spin release', () => {
    const backspin =
      measurePitchMovementSignature({
        trajectory: trajectory({
          x: 220,
          y: 0,
          z: 0,
        }),
        plateZ: 0,
      });

    expect(backspin.inducedVerticalM)
      .toBeGreaterThan(0);
    expect(backspin.directionFamily)
      .toBe('up');
    expect(backspin.inducedMagnitudeM)
      .toBeGreaterThan(0);
  });

  it('measures sidespin as horizontal induced movement', () => {
    const sidespin =
      measurePitchMovementSignature({
        trajectory: trajectory({
          x: 0,
          y: 220,
          z: 0,
        }),
        plateZ: 0,
      });

    expect(
      Math.abs(sidespin.inducedHorizontalM),
    ).toBeGreaterThan(0);
    expect(
      Math.abs(sidespin.inducedVerticalM),
    ).toBeLessThan(
      Math.abs(sidespin.inducedHorizontalM),
    );
  });

  it('reports pure release gyrospin as near-neutral movement rather than inventing a pitch name', () => {
    const gyro =
      measurePitchMovementSignature({
        trajectory: trajectory({
          x: 0,
          y: 0,
          z: -220,
        }),
        plateZ: 0,
        neutralThresholdM: 0.03,
      });

    expect(gyro.inducedMagnitudeM)
      .toBeLessThan(0.03);
    expect(gyro.directionFamily)
      .toBe('neutral');
  });

  it('is deterministic', () => {
    const input = {
      trajectory: trajectory({
        x: 170,
        y: 80,
        z: -40,
      }),
      plateZ: 0,
    } as const;

    expect(
      measurePitchMovementSignature(input),
    ).toEqual(
      measurePitchMovementSignature(input),
    );
  });
});
