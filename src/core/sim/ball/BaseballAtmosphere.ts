import type { Vec3 } from '../../model/geometry';
import {
  LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
  type BaseballAerodynamicCoefficientProfile,
} from './BaseballAerodynamicCoefficientProfile';
import type {
  BaseballAerodynamicsParameters,
} from './BaseballAerodynamics';
import {
  NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE,
  type BaseballSpinDecayParameters,
} from './BaseballSpinDecay';

export type BaseballAtmosphere = Readonly<{
  temperatureC: number;
  relativeHumidity: number;
  /**
   * Local station pressure, not sea-level corrected pressure.
   */
  pressurePa: number;
  windVelocityMps: Vec3;
}>;

export type BaseballAtmosphereProperties = Readonly<{
  temperatureK: number;
  saturationVaporPressurePa: number;
  vaporPressurePa: number;
  dryAirPartialPressurePa: number;
  airDensityKgM3: number;
  dynamicViscosityPaS: number;
  kinematicViscosityM2PerSecond: number;
}>;

const DRY_AIR_GAS_CONSTANT =
  287.05;
const WATER_VAPOR_GAS_CONSTANT =
  461.495;

/**
 * Buck saturation-vapor-pressure approximation over liquid water.
 *
 * The exponential form is appropriate for ordinary outdoor baseball
 * temperatures and avoids treating relative humidity as a direct density
 * multiplier.
 */
export const calculateSaturationVaporPressurePa = (
  temperatureC: number,
): number => {
  if (!Number.isFinite(temperatureC)) {
    throw new Error(
      'temperatureC must be finite',
    );
  }

  return (
    611.21
    * Math.exp(
      (
        18.678
        - temperatureC / 234.5
      )
      * (
        temperatureC
        / (
          257.14 + temperatureC
        )
      ),
    )
  );
};

/**
 * Sutherland-law approximation for dry-air dynamic viscosity.
 *
 * Humidity has a much larger role in density than in the precision needed for
 * this baseball Reynolds-number helper, so viscosity is temperature-driven.
 */
export const calculateAirDynamicViscosityPaS = (
  temperatureK: number,
): number => {
  if (
    !Number.isFinite(temperatureK)
    || temperatureK <= 0
  ) {
    throw new Error(
      'temperatureK must be finite and positive',
    );
  }

  const referenceTemperatureK =
    273.15;
  const referenceViscosityPaS =
    1.716e-5;
  const sutherlandConstantK =
    110.4;

  return (
    referenceViscosityPaS
    * Math.pow(
      temperatureK
      / referenceTemperatureK,
      1.5,
    )
    * (
      referenceTemperatureK
      + sutherlandConstantK
    )
    / (
      temperatureK
      + sutherlandConstantK
    )
  );
};

export const calculateBaseballAtmosphereProperties = (
  atmosphere: BaseballAtmosphere,
): BaseballAtmosphereProperties => {
  if (
    !Number.isFinite(
      atmosphere.relativeHumidity,
    )
    || atmosphere.relativeHumidity < 0
    || atmosphere.relativeHumidity > 1
  ) {
    throw new Error(
      'relativeHumidity must lie within [0, 1]',
    );
  }
  if (
    !Number.isFinite(
      atmosphere.pressurePa,
    )
    || atmosphere.pressurePa <= 0
  ) {
    throw new Error(
      'pressurePa must be finite and positive',
    );
  }
  for (const component of [
    atmosphere.windVelocityMps.x,
    atmosphere.windVelocityMps.y,
    atmosphere.windVelocityMps.z,
  ]) {
    if (!Number.isFinite(component)) {
      throw new Error(
        'windVelocityMps must contain finite values',
      );
    }
  }

  const temperatureK =
    atmosphere.temperatureC
    + 273.15;
  if (temperatureK <= 0) {
    throw new Error(
      'temperature must remain above absolute zero',
    );
  }

  const saturationVaporPressurePa =
    calculateSaturationVaporPressurePa(
      atmosphere.temperatureC,
    );
  const vaporPressurePa =
    Math.min(
      atmosphere.pressurePa,
      atmosphere.relativeHumidity
      * saturationVaporPressurePa,
    );
  const dryAirPartialPressurePa =
    atmosphere.pressurePa
    - vaporPressurePa;

  const airDensityKgM3 =
    dryAirPartialPressurePa
      / (
        DRY_AIR_GAS_CONSTANT
        * temperatureK
      )
    + vaporPressurePa
      / (
        WATER_VAPOR_GAS_CONSTANT
        * temperatureK
      );

  const dynamicViscosityPaS =
    calculateAirDynamicViscosityPaS(
      temperatureK,
    );

  return {
    temperatureK,
    saturationVaporPressurePa,
    vaporPressurePa,
    dryAirPartialPressurePa,
    airDensityKgM3,
    dynamicViscosityPaS,
    kinematicViscosityM2PerSecond:
      dynamicViscosityPaS
      / airDensityKgM3,
  };
};

export type BaseballAtmosphericAerodynamicsInput =
  Readonly<{
    atmosphere: BaseballAtmosphere;
    ballMassKg?: number;
    ballRadiusM?: number;
    coefficientProfile?:
      BaseballAerodynamicCoefficientProfile;
    compatibilityDragCoefficient?: number;
    spinDecay?:
      BaseballSpinDecayParameters | null;
  }>;

export const createAtmosphericBaseballAerodynamics = (
  input: BaseballAtmosphericAerodynamicsInput,
): BaseballAerodynamicsParameters => {
  const properties =
    calculateBaseballAtmosphereProperties(
      input.atmosphere,
    );

  return {
    ballMassKg:
      input.ballMassKg ?? 0.145,
    ballRadiusM:
      input.ballRadiusM ?? 0.0366,
    airDensityKgM3:
      properties.airDensityKgM3,
    windVelocityMps:
      input.atmosphere.windVelocityMps,
    dragCoefficient:
      input.compatibilityDragCoefficient
      ?? 0.35,
    coefficientProfile:
      input.coefficientProfile
      ?? LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
    airKinematicViscosityM2PerSecond:
      properties
        .kinematicViscosityM2PerSecond,
    spinDecay:
      input.spinDecay === null
        ? undefined
        : (
            input.spinDecay
            ?? NATHAN_2026_BASEBALL_SPIN_DECAY_ESTIMATE
          ),
  };
};
