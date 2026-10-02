import { describe, expect, it } from 'vitest';
import {
  calculateBaseballAtmosphereProperties,
  createAtmosphericBaseballAerodynamics,
} from './BaseballAtmosphere';

const calm = {
  x: 0,
  y: 0,
  z: 0,
} as const;

describe('baseball atmosphere', () => {
  it('reproduces standard-sea-level dry-air density near 1.225 kg/m^3 at 15 C', () => {
    const properties =
      calculateBaseballAtmosphereProperties({
        temperatureC: 15,
        relativeHumidity: 0,
        pressurePa: 101_325,
        windVelocityMps: calm,
      });

    expect(
      properties.airDensityKgM3,
    ).toBeCloseTo(1.225, 3);
  });

  it('makes humid air slightly less dense at the same temperature and station pressure', () => {
    const dry =
      calculateBaseballAtmosphereProperties({
        temperatureC: 30,
        relativeHumidity: 0,
        pressurePa: 101_325,
        windVelocityMps: calm,
      });
    const humid =
      calculateBaseballAtmosphereProperties({
        temperatureC: 30,
        relativeHumidity: 1,
        pressurePa: 101_325,
        windVelocityMps: calm,
      });

    expect(
      humid.airDensityKgM3,
    ).toBeLessThan(
      dry.airDensityKgM3,
    );
  });

  it('makes lower station pressure reduce density and increase kinematic viscosity', () => {
    const sea =
      calculateBaseballAtmosphereProperties({
        temperatureC: 20,
        relativeHumidity: 0.5,
        pressurePa: 101_325,
        windVelocityMps: calm,
      });
    const highElevation =
      calculateBaseballAtmosphereProperties({
        temperatureC: 20,
        relativeHumidity: 0.5,
        pressurePa: 80_000,
        windVelocityMps: calm,
      });

    expect(
      highElevation.airDensityKgM3,
    ).toBeLessThan(
      sea.airDensityKgM3,
    );
    expect(
      highElevation
        .kinematicViscosityM2PerSecond,
    ).toBeGreaterThan(
      sea.kinematicViscosityM2PerSecond,
    );
  });

  it('creates one aerodynamic input carrying measured weather into density, wind and Reynolds viscosity', () => {
    const parameters =
      createAtmosphericBaseballAerodynamics({
        atmosphere: {
          temperatureC: 25,
          relativeHumidity: 0.7,
          pressurePa: 99_000,
          windVelocityMps: {
            x: 2,
            y: 0,
            z: -3,
          },
        },
      });

    expect(parameters.windVelocityMps)
      .toEqual({
        x: 2,
        y: 0,
        z: -3,
      });
    expect(parameters.airDensityKgM3)
      .toBeGreaterThan(1);
    expect(
      parameters
        .airKinematicViscosityM2PerSecond,
    ).toBeGreaterThan(0);
    expect(parameters.coefficientProfile)
      .toBeDefined();
  });
});
