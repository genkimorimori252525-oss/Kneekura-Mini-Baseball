import type {
  BallSurfaceContactParameters,
} from './BallSurfaceContact';

export type BallSurfaceResponseKnot = Readonly<{
  incidentSpeedMps: number;
  contact: BallSurfaceContactParameters;
}>;

export type BallSurfaceResponseProfile = Readonly<{
  profileId: string;
  version: string;
  knots: readonly BallSurfaceResponseKnot[];
}>;

const lerp = (
  a: number,
  b: number,
  t: number,
): number => a + (b - a) * t;

const validateContact = (
  contact: BallSurfaceContactParameters,
): void => {
  if (
    !Number.isFinite(
      contact.normalRestitution,
    )
    || contact.normalRestitution < 0
    || contact.normalRestitution > 1
    || !Number.isFinite(
      contact.tangentialRestitution,
    )
    || contact.tangentialRestitution < 0
    || contact.tangentialRestitution > 1
    || !Number.isFinite(
      contact.frictionCoefficient,
    )
    || contact.frictionCoefficient < 0
  ) {
    throw new Error(
      'surface response contact parameters must be finite, restitution within [0, 1], and friction non-negative',
    );
  }
};

export const validateBallSurfaceResponseProfile = (
  profile: BallSurfaceResponseProfile,
): void => {
  if (profile.profileId.length === 0) {
    throw new Error(
      'surface response profileId must not be empty',
    );
  }
  if (profile.version.length === 0) {
    throw new Error(
      'surface response version must not be empty',
    );
  }
  if (profile.knots.length === 0) {
    throw new Error(
      'surface response profile requires at least one speed knot',
    );
  }

  let previousSpeed = -Infinity;
  for (const knot of profile.knots) {
    if (
      !Number.isFinite(
        knot.incidentSpeedMps,
      )
      || knot.incidentSpeedMps <= 0
      || knot.incidentSpeedMps
        <= previousSpeed
    ) {
      throw new Error(
        'surface response speed knots must be finite, positive, and strictly increasing',
      );
    }
    validateContact(knot.contact);
    previousSpeed =
      knot.incidentSpeedMps;
  }
};

/**
 * Deterministic piecewise-linear calibration lookup.
 *
 * Pennbounce data show a statistically significant surface x velocity
 * interaction, so a single constant contact parameter set cannot represent
 * all field materials. The profile remains data-only and versioned.
 */
export const resolveBallSurfaceResponse = (
  profile: BallSurfaceResponseProfile,
  incidentSpeedMps: number,
): BallSurfaceContactParameters => {
  validateBallSurfaceResponseProfile(
    profile,
  );
  if (
    !Number.isFinite(incidentSpeedMps)
    || incidentSpeedMps < 0
  ) {
    throw new Error(
      'surface response incidentSpeedMps must be finite and non-negative',
    );
  }

  const first = profile.knots[0]!;
  if (
    incidentSpeedMps
    <= first.incidentSpeedMps
  ) {
    return first.contact;
  }

  const last =
    profile.knots[
      profile.knots.length - 1
    ]!;
  if (
    incidentSpeedMps
    >= last.incidentSpeedMps
  ) {
    return last.contact;
  }

  for (
    let index = 1;
    index < profile.knots.length;
    index += 1
  ) {
    const right =
      profile.knots[index]!;
    if (
      incidentSpeedMps
      > right.incidentSpeedMps
    ) {
      continue;
    }

    const left =
      profile.knots[index - 1]!;
    const t = (
      incidentSpeedMps
      - left.incidentSpeedMps
    ) / (
      right.incidentSpeedMps
      - left.incidentSpeedMps
    );

    return {
      normalRestitution: lerp(
        left.contact
          .normalRestitution,
        right.contact
          .normalRestitution,
        t,
      ),
      tangentialRestitution: lerp(
        left.contact
          .tangentialRestitution,
        right.contact
          .tangentialRestitution,
        t,
      ),
      frictionCoefficient: lerp(
        left.contact
          .frictionCoefficient,
        right.contact
          .frictionCoefficient,
        t,
      ),
    };
  }

  throw new Error(
    'unreachable surface response interpolation interval',
  );
};
