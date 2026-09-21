import type {
  PitchWorldState,
} from './BatBallContact';
import {
  resolveRigidBatBallContactWithParameterResolver,
  type RigidBaseballProperties,
  type RigidBatBallContactParameters,
  type RigidBatBallContactResult,
  type RigidBatState,
} from './RigidBatBallContact';

export type WoodBatNormalRestitutionKnot =
  Readonly<{
    relativeImpactSpeedMps: number;
    normalRestitution: number;
  }>;

export type WoodBatSpeedResponseProfile =
  Readonly<{
    profileId: string;
    version: string;

    /**
     * Must represent measurements/calibration for one bat construction or a
     * justified population. Do not combine unrelated low/high-speed bats into
     * a pretend universal curve.
     */
    normalRestitutionKnots:
      readonly WoodBatNormalRestitutionKnot[];

    tangentialRestitution: number;
    frictionCoefficient: number;

    evidenceIds: readonly string[];
  }>;

export const HIRONO_2025_WOOD_BAT_SPEED_RESPONSE_EVIDENCE =
  Object.freeze({
    source:
      'Hirono, Murata & Nakamura 2025, Journal of the Society of Materials Science, Japan 74(9):582-587',
    testedImpactSpeedComparisonKph: Object.freeze([
      120,
      180,
    ] as const),
    finding:
      'BBCOR generally decreased as impact velocity increased, but the rate of decrease differed by wooden bat; some tested bats did not decrease monotonically through 180 km/h.',
    implication:
      'Wood-bat speed response must remain bat/profile-specific; a universal v^(-1/6) wooden-bat law is not justified by this evidence.',
  } as const);

const lerp = (
  a: number,
  b: number,
  t: number,
): number => (
  a + (b - a) * t
);

export const validateWoodBatSpeedResponseProfile = (
  profile: WoodBatSpeedResponseProfile,
): void => {
  if (
    profile.profileId.length === 0
    || profile.version.length === 0
  ) {
    throw new Error(
      'wood-bat speed response profile id/version must not be empty',
    );
  }
  if (
    profile.normalRestitutionKnots.length
    < 2
  ) {
    throw new Error(
      'wood-bat speed response requires at least two same-profile speed knots',
    );
  }
  if (
    profile.evidenceIds.length === 0
    || profile.evidenceIds.some(
      (id) => id.length === 0,
    )
  ) {
    throw new Error(
      'wood-bat speed response requires explicit evidence ids',
    );
  }
  if (
    !Number.isFinite(
      profile.tangentialRestitution,
    )
    || profile.tangentialRestitution < 0
    || profile.tangentialRestitution > 1
    || !Number.isFinite(
      profile.frictionCoefficient,
    )
    || profile.frictionCoefficient < 0
  ) {
    throw new Error(
      'wood-bat tangential restitution must be within [0,1] and friction non-negative',
    );
  }

  let previousSpeed = -Infinity;
  for (
    const knot
    of profile.normalRestitutionKnots
  ) {
    if (
      !Number.isFinite(
        knot.relativeImpactSpeedMps,
      )
      || knot.relativeImpactSpeedMps <= 0
      || knot.relativeImpactSpeedMps
        <= previousSpeed
      || !Number.isFinite(
        knot.normalRestitution,
      )
      || knot.normalRestitution < 0
      || knot.normalRestitution > 1
    ) {
      throw new Error(
        'wood-bat restitution knots must use strictly increasing positive speed and restitution within [0,1]',
      );
    }
    previousSpeed =
      knot.relativeImpactSpeedMps;
  }
};

export const resolveWoodBatSpeedResponse = (
  profile: WoodBatSpeedResponseProfile,
  relativeImpactSpeedMps: number,
): RigidBatBallContactParameters => {
  validateWoodBatSpeedResponseProfile(
    profile,
  );
  if (
    !Number.isFinite(
      relativeImpactSpeedMps,
    )
    || relativeImpactSpeedMps < 0
  ) {
    throw new Error(
      'wood-bat impact speed must be finite and non-negative',
    );
  }

  const knots =
    profile.normalRestitutionKnots;
  const first = knots[0]!;
  const last =
    knots[knots.length - 1]!;

  let normalRestitution =
    first.normalRestitution;

  if (
    relativeImpactSpeedMps
    >= last.relativeImpactSpeedMps
  ) {
    normalRestitution =
      last.normalRestitution;
  } else if (
    relativeImpactSpeedMps
    > first.relativeImpactSpeedMps
  ) {
    for (
      let index = 1;
      index < knots.length;
      index += 1
    ) {
      const right = knots[index]!;
      if (
        relativeImpactSpeedMps
        > right.relativeImpactSpeedMps
      ) {
        continue;
      }

      const left =
        knots[index - 1]!;
      const t =
        (
          relativeImpactSpeedMps
          - left.relativeImpactSpeedMps
        ) / (
          right.relativeImpactSpeedMps
          - left.relativeImpactSpeedMps
        );
      normalRestitution =
        lerp(
          left.normalRestitution,
          right.normalRestitution,
          t,
        );
      break;
    }
  }

  return {
    normalRestitution,
    tangentialRestitution:
      profile.tangentialRestitution,
    frictionCoefficient:
      profile.frictionCoefficient,
  };
};

export const resolveWoodBatSpeedProfileBallContact = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
  profile: WoodBatSpeedResponseProfile,
): RigidBatBallContactResult | null => (
  resolveRigidBatBallContactWithParameterResolver(
    pitch,
    bat,
    ball,
    (kinematics) =>
      resolveWoodBatSpeedResponse(
        profile,
        kinematics
          .normalApproachSpeedMps,
      ),
  )
);
