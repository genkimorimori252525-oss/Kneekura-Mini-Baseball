import { describe, expect, it } from 'vitest';
import {
  LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
  resolveBaseballAerodynamicCoefficients,
} from './BaseballAerodynamicCoefficientProfile';

describe('baseball aerodynamic coefficient profile', () => {
  it('reproduces the Lyu 2022 seam-averaged reference knots', () => {
    const atS015 =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        144_000,
        0.15,
      );

    expect(atS015.dragCoefficient)
      .toBeCloseTo(0.32, 12);
    expect(atS015.liftCoefficient)
      .toBeCloseTo(0.17, 12);
  });

  it('captures the low-spin drag crisis as Reynolds number changes', () => {
    const lowRe =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        75_000,
        0.05,
      );
    const crisis =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        175_000,
        0.05,
      );

    expect(lowRe.dragCoefficient)
      .toBeCloseTo(0.46, 12);
    expect(crisis.dragCoefficient)
      .toBeCloseTo(0.32, 12);
  });

  it('fades Reynolds drag-crisis correction away by spin factor 0.15', () => {
    const lowRe =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        75_000,
        0.15,
      );
    const highRe =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        250_000,
        0.15,
      );

    expect(lowRe.dragCoefficient)
      .toBeCloseTo(
        highRe.dragCoefficient,
        12,
      );
  });

  it('interpolates deterministically between measured/digitized knots', () => {
    const a =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        144_000,
        0.175,
      );
    const b =
      resolveBaseballAerodynamicCoefficients(
        LYU_2022_SEAM_AVERAGED_AERO_PROFILE,
        144_000,
        0.175,
      );

    expect(a).toEqual(b);
    expect(a.liftCoefficient)
      .toBeCloseTo(
        (0.17 + 0.195) / 2,
        12,
      );
  });
});
