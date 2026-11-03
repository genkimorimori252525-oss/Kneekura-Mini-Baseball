import { assertDeepFrozenInertPhysicsV98 } from './ImmutablePhysicsParametersV98';

export type BaseballAerodynamicSpinKnot = Readonly<{
  spinFactor: number;
  dragCoefficientAtReferenceRe: number;
  liftCoefficient: number;
}>;

export type BaseballAerodynamicReynoldsKnot = Readonly<{
  reynoldsNumber: number;
  dragCorrectionFactorAtLowSpin: number;
}>;

export type BaseballAerodynamicCoefficientProfile = Readonly<{
  profileId: string;
  version: string;
  referenceReynoldsNumber: number;
  spinKnots:
    readonly BaseballAerodynamicSpinKnot[];
  reynoldsKnots:
    readonly BaseballAerodynamicReynoldsKnot[];
  reynoldsCorrectionFullThroughSpinFactor: number;
  reynoldsCorrectionZeroAtSpinFactor: number;
}>;

type CompiledCoefficientProfileV98 = Readonly<{
  spinXs: readonly number[];
  dragYs: readonly number[];
  liftYs: readonly number[];
  reynoldsXs: readonly number[];
  reynoldsYs: readonly number[];
}>;
const ownedCoefficientProfilesV98 = new WeakMap<BaseballAerodynamicCoefficientProfile, CompiledCoefficientProfileV98>();

/** Internal constructor seam; not a raw/public-input validation shortcut. Only
 * clone-owned, validated and deeply frozen inert profiles may be registered. */
export function prepareOwnedBaseballCoefficientProfileV98(profile: BaseballAerodynamicCoefficientProfile): void {
  if (ownedCoefficientProfilesV98.has(profile)) return;
  assertDeepFrozenInertPhysicsV98(profile);
  validateBaseballAerodynamicCoefficientProfile(profile);
  ownedCoefficientProfilesV98.set(profile, {
    spinXs: Object.freeze(profile.spinKnots.map(knot => knot.spinFactor)),
    dragYs: Object.freeze(profile.spinKnots.map(knot => knot.dragCoefficientAtReferenceRe)),
    liftYs: Object.freeze(profile.spinKnots.map(knot => knot.liftCoefficient)),
    reynoldsXs: Object.freeze(profile.reynoldsKnots.map(knot => knot.reynoldsNumber)),
    reynoldsYs: Object.freeze(profile.reynoldsKnots.map(knot => knot.dragCorrectionFactorAtLowSpin)),
  });
}

const lerp = (
  a: number,
  b: number,
  t: number,
): number => (
  a + (b - a) * t
);

const validateAscending = (
  name: string,
  values: readonly number[],
): void => {
  for (
    let index = 1;
    index < values.length;
    index += 1
  ) {
    if (!(values[index]! > values[index - 1]!)) {
      throw new Error(
        `${name} must be strictly increasing`,
      );
    }
  }
};

export const validateBaseballAerodynamicCoefficientProfile = (
  profile: BaseballAerodynamicCoefficientProfile,
): void => {
  if (ownedCoefficientProfilesV98.has(profile)) return;
  if (
    profile.profileId.length === 0
    || profile.version.length === 0
  ) {
    throw new Error(
      'aerodynamic coefficient profile id/version must not be empty',
    );
  }
  if (
    !Number.isFinite(
      profile.referenceReynoldsNumber,
    )
    || profile.referenceReynoldsNumber <= 0
  ) {
    throw new Error(
      'referenceReynoldsNumber must be finite and positive',
    );
  }
  if (profile.spinKnots.length < 2) {
    throw new Error(
      'aerodynamic coefficient profile requires at least two spin knots',
    );
  }
  if (profile.reynoldsKnots.length < 2) {
    throw new Error(
      'aerodynamic coefficient profile requires at least two Reynolds knots',
    );
  }

  validateAscending(
    'spin factors',
    profile.spinKnots.map(
      (knot) => knot.spinFactor,
    ),
  );
  validateAscending(
    'Reynolds numbers',
    profile.reynoldsKnots.map(
      (knot) => knot.reynoldsNumber,
    ),
  );

  for (const knot of profile.spinKnots) {
    if (
      !Number.isFinite(knot.spinFactor)
      || knot.spinFactor < 0
      || !Number.isFinite(
        knot.dragCoefficientAtReferenceRe,
      )
      || knot.dragCoefficientAtReferenceRe < 0
      || !Number.isFinite(
        knot.liftCoefficient,
      )
      || knot.liftCoefficient < 0
    ) {
      throw new Error(
        'aerodynamic spin knots must contain finite non-negative values',
      );
    }
  }

  for (const knot of profile.reynoldsKnots) {
    if (
      !Number.isFinite(
        knot.reynoldsNumber,
      )
      || knot.reynoldsNumber <= 0
      || !Number.isFinite(
        knot.dragCorrectionFactorAtLowSpin,
      )
      || knot.dragCorrectionFactorAtLowSpin < 0
    ) {
      throw new Error(
        'aerodynamic Reynolds knots must contain finite positive Re and non-negative correction',
      );
    }
  }

  if (
    !Number.isFinite(
      profile.reynoldsCorrectionFullThroughSpinFactor,
    )
    || !Number.isFinite(
      profile.reynoldsCorrectionZeroAtSpinFactor,
    )
    || profile.reynoldsCorrectionFullThroughSpinFactor < 0
    || profile.reynoldsCorrectionZeroAtSpinFactor
      <= profile.reynoldsCorrectionFullThroughSpinFactor
  ) {
    throw new Error(
      'aerodynamic Reynolds spin-blend thresholds must be finite and ordered',
    );
  }
};

const interpolate = (
  x: number,
  xs: readonly number[],
  ys: readonly number[],
): number => {
  if (x <= xs[0]!) {
    return ys[0]!;
  }
  if (x >= xs[xs.length - 1]!) {
    return ys[ys.length - 1]!;
  }

  for (
    let index = 1;
    index < xs.length;
    index += 1
  ) {
    const rightX = xs[index]!;
    if (x > rightX) {
      continue;
    }
    const leftX = xs[index - 1]!;
    const t = (
      x - leftX
    ) / (
      rightX - leftX
    );
    return lerp(
      ys[index - 1]!,
      ys[index]!,
      t,
    );
  }

  throw new Error(
    'unreachable aerodynamic interpolation interval',
  );
};

export type BaseballAerodynamicCoefficients = Readonly<{
  dragCoefficient: number;
  liftCoefficient: number;
}>;

export const resolveBaseballAerodynamicCoefficients = (
  profile: BaseballAerodynamicCoefficientProfile,
  reynoldsNumber: number,
  spinFactor: number,
): BaseballAerodynamicCoefficients => {
  validateBaseballAerodynamicCoefficientProfile(
    profile,
  );
  if (
    !Number.isFinite(reynoldsNumber)
    || reynoldsNumber < 0
    || !Number.isFinite(spinFactor)
    || spinFactor < 0
  ) {
    throw new Error(
      'Reynolds number and spin factor must be finite and non-negative',
    );
  }

  const compiled = ownedCoefficientProfilesV98.get(profile);
  if(compiled){
    // Both coefficients use the same immutable spin grid. Locate that exact
    // interval and divide once; retain the original lerp arithmetic/order.
    const xs=compiled.spinXs,drag=compiled.dragYs,lift=compiled.liftYs,last=xs.length-1;
    let baseDrag:number,liftCoefficient:number;
    if(spinFactor<=xs[0]!){baseDrag=drag[0]!;liftCoefficient=lift[0]!;}
    else if(spinFactor>=xs[last]!){baseDrag=drag[last]!;liftCoefficient=lift[last]!;}
    else{
      let i=1;while(i<xs.length&&spinFactor>xs[i]!)i++;
      const t=(spinFactor-xs[i-1]!)/(xs[i]!-xs[i-1]!);
      baseDrag=lerp(drag[i-1]!,drag[i]!,t);liftCoefficient=lerp(lift[i-1]!,lift[i]!,t);
    }
    const full=profile.reynoldsCorrectionFullThroughSpinFactor,zero=profile.reynoldsCorrectionZeroAtSpinFactor,
      blend=spinFactor<=full?1:spinFactor>=zero?0:(zero-spinFactor)/(zero-full),
      // A validated finite correction multiplied by zero contributes exactly
      // zero. Keep dynamic input validation above and the raw profile path
      // below; no tolerance bucket or new coefficient is introduced.
      correction=blend===0?1:interpolate(reynoldsNumber,compiled.reynoldsXs,compiled.reynoldsYs);
    return{dragCoefficient:baseDrag*(1+blend*(correction-1)),liftCoefficient:spinFactor<=0?0:liftCoefficient};
  }
  const spinXs = profile.spinKnots.map(
    (knot) => knot.spinFactor,
  );
  const baseDrag = interpolate(
    spinFactor,
    spinXs,
    profile.spinKnots.map(
      (knot) =>
        knot.dragCoefficientAtReferenceRe,
    ),
  );
  const liftCoefficient = interpolate(
    spinFactor,
    spinXs,
    profile.spinKnots.map(
      (knot) =>
        knot.liftCoefficient,
    ),
  );

  const reynoldsCorrection = interpolate(
    reynoldsNumber,
    profile.reynoldsKnots.map(
      (knot) => knot.reynoldsNumber,
    ),
    profile.reynoldsKnots.map(
      (knot) =>
        knot.dragCorrectionFactorAtLowSpin,
    ),
  );

  const full =
    profile
      .reynoldsCorrectionFullThroughSpinFactor;
  const zero =
    profile
      .reynoldsCorrectionZeroAtSpinFactor;
  const blend =
    spinFactor <= full
      ? 1
      : spinFactor >= zero
        ? 0
        : (
            zero - spinFactor
          ) / (
            zero - full
          );

  return {
    dragCoefficient:
      baseDrag
      * (
        1
        + blend
          * (
            reynoldsCorrection - 1
          )
      ),
    liftCoefficient:
      spinFactor <= 0
        ? 0
        : liftCoefficient,
  };
};

/**
 * Seam-orientation-averaged approximation to Lyu et al. (2022).
 *
 * Spin-grid values are digitized from Fig. 3 with exact Table 1 lift anchors
 * used where available. Reynolds correction is digitized from Fig. 5.
 * Therefore this profile is an empirical calibration approximation, not a
 * reproduction of unpublished raw data.
 */
export const LYU_2022_SEAM_AVERAGED_AERO_PROFILE:
  BaseballAerodynamicCoefficientProfile =
  Object.freeze({
    profileId:
      'lyu-2022-seam-averaged',
    version:
      'lyu-2022-figure-digitization-v1',
    referenceReynoldsNumber: 144_000,
    spinKnots: Object.freeze([
      {
        spinFactor: 0,
        dragCoefficientAtReferenceRe: 0.35,
        liftCoefficient: 0,
      },
      {
        spinFactor: 0.05,
        dragCoefficientAtReferenceRe: 0.34,
        liftCoefficient: 0.10,
      },
      {
        spinFactor: 0.10,
        dragCoefficientAtReferenceRe: 0.32,
        liftCoefficient: 0.115,
      },
      {
        spinFactor: 0.15,
        dragCoefficientAtReferenceRe: 0.32,
        liftCoefficient: 0.17,
      },
      {
        spinFactor: 0.20,
        dragCoefficientAtReferenceRe: 0.33,
        liftCoefficient: 0.195,
      },
      {
        spinFactor: 0.25,
        dragCoefficientAtReferenceRe: 0.34,
        liftCoefficient: 0.230,
      },
      {
        spinFactor: 0.30,
        dragCoefficientAtReferenceRe: 0.36,
        liftCoefficient: 0.270,
      },
      {
        spinFactor: 0.35,
        dragCoefficientAtReferenceRe: 0.38,
        liftCoefficient: 0.305,
      },
      {
        spinFactor: 0.40,
        dragCoefficientAtReferenceRe: 0.39,
        liftCoefficient: 0.340,
      },
      {
        spinFactor: 0.45,
        dragCoefficientAtReferenceRe: 0.41,
        liftCoefficient: 0.385,
      },
      {
        spinFactor: 0.50,
        dragCoefficientAtReferenceRe: 0.42,
        liftCoefficient: 0.400,
      },
    ]),
    reynoldsKnots: Object.freeze([
      {
        reynoldsNumber: 75_000,
        dragCorrectionFactorAtLowSpin:
          0.46 / 0.34,
      },
      {
        reynoldsNumber: 100_000,
        dragCorrectionFactorAtLowSpin:
          0.44 / 0.34,
      },
      {
        reynoldsNumber: 125_000,
        dragCorrectionFactorAtLowSpin:
          0.42 / 0.34,
      },
      {
        reynoldsNumber: 150_000,
        dragCorrectionFactorAtLowSpin:
          0.36 / 0.34,
      },
      {
        reynoldsNumber: 175_000,
        dragCorrectionFactorAtLowSpin:
          0.32 / 0.34,
      },
      {
        reynoldsNumber: 200_000,
        dragCorrectionFactorAtLowSpin:
          0.34 / 0.34,
      },
      {
        reynoldsNumber: 250_000,
        dragCorrectionFactorAtLowSpin:
          0.35 / 0.34,
      },
    ]),
    reynoldsCorrectionFullThroughSpinFactor:
      0.05,
    reynoldsCorrectionZeroAtSpinFactor:
      0.15,
  });
