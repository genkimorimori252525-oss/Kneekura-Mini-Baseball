import { describe, expect, it } from 'vitest';
import type { Vec3 } from '../../model/geometry';
import {
  REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,
  REFERENCE_BASEBALL_AERODYNAMICS,
  calculateBaseballAerodynamics,
  calculateBaseballLiftCoefficient,
} from './BaseballAerodynamics';

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

describe('baseball aerodynamics', () => {
  it('uses the empirical bilinear baseball lift relation', () => {
    expect(calculateBaseballLiftCoefficient(0)).toBe(0);
    expect(calculateBaseballLiftCoefficient(0.05)).toBeCloseTo(0.075, 12);
    expect(calculateBaseballLiftCoefficient(0.1)).toBeCloseTo(0.15, 12);
    expect(calculateBaseballLiftCoefficient(0.2)).toBeCloseTo(0.21, 12);
  });

  it('makes drag oppose the air-relative velocity', () => {
    const result = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(0, 0, 0),
    );

    expect(result.dragAcceleration.x).toBeCloseTo(0, 12);
    expect(result.dragAcceleration.y).toBeCloseTo(0, 12);
    expect(result.dragAcceleration.z).toBeLessThan(0);
    expect(result.liftAcceleration).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('gives backspin an upward Magnus acceleration', () => {
    const result = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(-200, 0, 0),
    );

    expect(result.liftAcceleration.y).toBeGreaterThan(0);
    expect(result.spinFactor).toBeGreaterThan(0);
  });

  it('does not create Magnus lift from pure gyrospin', () => {
    const result = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(0, 0, 200),
    );

    expect(result.activeSpin.x).toBeCloseTo(0, 12);
    expect(result.activeSpin.y).toBeCloseTo(0, 12);
    expect(result.activeSpin.z).toBeCloseTo(0, 12);
    expect(result.spinFactor).toBeCloseTo(0, 12);
    expect(result.liftAcceleration).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('uses wind through air-relative velocity instead of ground velocity', () => {
    const noWind = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(0, 0, 0),
    );
    const tailWind = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(0, 0, 0),
      {
        ...REFERENCE_BASEBALL_AERODYNAMICS,
        windVelocityMps: v(0, 0, 10),
      },
    );

    expect(Math.abs(tailWind.dragAcceleration.z))
      .toBeLessThan(Math.abs(noWind.dragAcceleration.z));
  });

  it('can use the Lyu 2022 speed-spin profile instead of constant drag and bilinear lift', () => {
    const result =
      calculateBaseballAerodynamics(
        v(0, 0, 35),
        v(-180, 0, 0),
        REALISTIC_LYU_2022_BASEBALL_AERODYNAMICS,
      );

    expect(result.reynoldsNumber)
      .not.toBeNull();
    expect(
      result.dragCoefficientUsed,
    ).toBeGreaterThan(0);
    expect(
      result.liftCoefficientUsed,
    ).toBeGreaterThan(0);
    expect(
      result.dragCoefficientUsed,
    ).not.toBeCloseTo(
      REFERENCE_BASEBALL_AERODYNAMICS
        .dragCoefficient,
      6,
    );
  });

  it('scales aerodynamic force with air density', () => {
    const seaLevel = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(-200, 0, 0),
    );
    const thinAir = calculateBaseballAerodynamics(
      v(0, 0, 45),
      v(-200, 0, 0),
      {
        ...REFERENCE_BASEBALL_AERODYNAMICS,
        airDensityKgM3:
          REFERENCE_BASEBALL_AERODYNAMICS.airDensityKgM3 * 0.8,
      },
    );

    expect(thinAir.dragAcceleration.z / seaLevel.dragAcceleration.z)
      .toBeCloseTo(0.8, 12);
    expect(thinAir.liftAcceleration.y / seaLevel.liftAcceleration.y)
      .toBeCloseTo(0.8, 12);
  });
});
