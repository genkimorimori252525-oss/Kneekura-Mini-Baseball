import type { Vec3 } from '../../model/geometry';
import {
  createSwingKinematicsTrajectoryV1,
  type SwingKinematicsTrajectoryV1,
} from '../contact/SwingKinematicsV1';
import type {
  StrikeZoneRegion,
} from './TakenPitchPhysicalResult';

export type SwingBatterHandednessV1 =
  | 'R'
  | 'L';

export type SwingCourseCoordinatesV1 =
  Readonly<{
    /**
     * -1 bottom, 0 middle, +1 top.
     */
    heightNormalized: number;
    /**
     * -1 inside, 0 middle, +1 outside.
     */
    insideOutsideNormalized: number;
  }>;

export type SwingKinematicsCourseProfileV1 =
  Readonly<{
    profileId: string;
    version: string;
    batLengthM: number;
    sweetSpotT: number;

    centerContactDepthM: number;
    contactDepthPopulationStdDevM:
      number;
    insideOutsideDepthGainM: number;
    heightDepthGainM: number;

    baseContactSweetSpotSpeedMps:
      number;
    contactDepthSpeedGainMpsPerM:
      number;

    basePreContactSeconds: number;
    insideOutsideTimingGainSeconds:
      number;
    heightTimingGainSeconds: number;
    followThroughSeconds: number;

    highAttackAngleDeg: number;
    middleAttackAngleDeg: number;
    lowAttackAngleDeg: number;

    /**
     * Positive = pull direction.
     * The sign is mirrored into world x by handedness.
     * Evidence identifies the direction relation more strongly than a
     * universal numeric magnitude, so this remains explicit/versioned.
     */
    courseAttackDirectionGainDeg:
      number;

    /**
     * Centerline offset behind the intended ball center for a nominal
     * centered contact. It represents ball radius + local bat radius.
     */
    nominalContactSurfaceDistanceM:
      number;
  }>;

const INCH_TO_M = 0.0254;

/**
 * Evidence-bounded population prior, not a universal hitter.
 *
 * Direct evidence:
 * - center depth 20.1 +/- 7.2 in from 2026 live NCAA markerless data;
 * - within-batter max-speed/depth slope 0.040 m/s per cm = 4 m/s per m;
 * - public 2025 Statcast height averages 7/9/16 deg high/middle/low.
 *
 * Provisional design gains:
 * - exact course depth offsets;
 * - exact timing gains;
 * - exact horizontal attack-direction gain.
 * Their signs are evidence-constrained, but magnitudes remain versioned
 * calibration inputs for future player-specific work.
 */
export const EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1:
  SwingKinematicsCourseProfileV1 =
  Object.freeze({
    profileId:
      'evidence-bounded-population-swing',
    version:
      'swing-course-profile-v1',
    batLengthM: 0.84,
    sweetSpotT: 0.72,

    centerContactDepthM:
      20.1 * INCH_TO_M,
    contactDepthPopulationStdDevM:
      7.2 * INCH_TO_M,
    insideOutsideDepthGainM:
      0.075,
    heightDepthGainM:
      0.035,

    baseContactSweetSpotSpeedMps:
      31,
    contactDepthSpeedGainMpsPerM:
      4,

    basePreContactSeconds:
      0.165,
    insideOutsideTimingGainSeconds:
      0.010,
    heightTimingGainSeconds:
      0.004,
    followThroughSeconds:
      0.135,

    highAttackAngleDeg: 7,
    middleAttackAngleDeg: 9,
    lowAttackAngleDeg: 16,

    courseAttackDirectionGainDeg:
      6,

    nominalContactSurfaceDistanceM:
      0.0366 + 0.033,
  });

export type CourseAwareSwingPlanInputV1 =
  Readonly<{
    handedness:
      SwingBatterHandednessV1;
    batterCenterOfMass: Vec3;
    /**
     * x/y location used for course classification. z is ignored and replaced
     * by the preferred contact depth.
     */
    targetBallCenterAtPlate: Vec3;
    /**
     * Optional actual/predicted ball center at the preferred contact depth.
     * When absent, x/y are copied from the plate target and z is synthesized
     * from the preferred contact depth. Aerodynamic integration should supply
     * this when curved-flight x/y at contact are known.
     */
    targetBallCenterAtContact?: Vec3;
    strikeZone:
      StrikeZoneRegion;
    contactTick: number;
    ticksPerSecond: number;
    profile?:
      SwingKinematicsCourseProfileV1;
  }>;

export type CourseAwareSwingPlanV1 =
  Readonly<{
    handedness:
      SwingBatterHandednessV1;
    course:
      SwingCourseCoordinatesV1;
    preferredContactDepthM: number;
    intendedBallCenterAtContact:
      Vec3;
    intendedSweetSpotCenterAtContact:
      Vec3;
    attackAngleDeg: number;
    attackDirectionPullDeg: number;
    contactSweetSpotSpeedMps:
      number;
    preContactSeconds: number;
    followThroughSeconds: number;
    trajectory:
      SwingKinematicsTrajectoryV1;
    profileId: string;
    profileVersion: string;
  }>;

const EPSILON = 1e-12;

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.max(
  minimum,
  Math.min(maximum, value),
);

const add = (
  first: Vec3,
  second: Vec3,
): Vec3 => ({
  x: first.x + second.x,
  y: first.y + second.y,
  z: first.z + second.z,
});

const subtract = (
  first: Vec3,
  second: Vec3,
): Vec3 => ({
  x: first.x - second.x,
  y: first.y - second.y,
  z: first.z - second.z,
});

const scale = (
  value: Vec3,
  scalar: number,
): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

const magnitude = (
  value: Vec3,
): number => Math.hypot(
  value.x,
  value.y,
  value.z,
);

const normalize = (
  value: Vec3,
): Vec3 => {
  const length = magnitude(value);
  if (
    !Number.isFinite(length)
    || length <= EPSILON
  ) {
    throw new Error(
      'course-aware swing vector must be finite and non-zero',
    );
  }
  return scale(
    value,
    1 / length,
  );
};

const degreesToRadians = (
  degrees: number,
): number => (
  degrees * Math.PI / 180
);

const validateProfile = (
  profile:
    SwingKinematicsCourseProfileV1,
): void => {
  if (
    profile.profileId.length === 0
    || profile.version.length === 0
  ) {
    throw new Error(
      'swing course profile id/version must not be empty',
    );
  }

  for (
    const [
      name,
      value,
    ]
    of [
      ['batLengthM', profile.batLengthM],
      ['sweetSpotT', profile.sweetSpotT],
      ['centerContactDepthM', profile.centerContactDepthM],
      ['contactDepthPopulationStdDevM', profile.contactDepthPopulationStdDevM],
      ['insideOutsideDepthGainM', profile.insideOutsideDepthGainM],
      ['heightDepthGainM', profile.heightDepthGainM],
      ['baseContactSweetSpotSpeedMps', profile.baseContactSweetSpotSpeedMps],
      ['contactDepthSpeedGainMpsPerM', profile.contactDepthSpeedGainMpsPerM],
      ['basePreContactSeconds', profile.basePreContactSeconds],
      ['insideOutsideTimingGainSeconds', profile.insideOutsideTimingGainSeconds],
      ['heightTimingGainSeconds', profile.heightTimingGainSeconds],
      ['followThroughSeconds', profile.followThroughSeconds],
      ['highAttackAngleDeg', profile.highAttackAngleDeg],
      ['middleAttackAngleDeg', profile.middleAttackAngleDeg],
      ['lowAttackAngleDeg', profile.lowAttackAngleDeg],
      ['courseAttackDirectionGainDeg', profile.courseAttackDirectionGainDeg],
      ['nominalContactSurfaceDistanceM', profile.nominalContactSurfaceDistanceM],
    ] as const
  ) {
    if (!Number.isFinite(value)) {
      throw new Error(
        `swing course profile ${name} must be finite`,
      );
    }
  }

  if (
    profile.batLengthM <= 0
    || profile.sweetSpotT <= 0
    || profile.sweetSpotT >= 1
    || profile.centerContactDepthM <= 0
    || profile.contactDepthPopulationStdDevM <= 0
    || profile.insideOutsideDepthGainM < 0
    || profile.heightDepthGainM < 0
    || profile.baseContactSweetSpotSpeedMps <= 0
    || profile.contactDepthSpeedGainMpsPerM < 0
    || profile.basePreContactSeconds <= 0
    || profile.insideOutsideTimingGainSeconds < 0
    || profile.heightTimingGainSeconds < 0
    || profile.followThroughSeconds <= 0
    || profile.nominalContactSurfaceDistanceM <= 0
  ) {
    throw new Error(
      'swing course profile physical/time magnitudes are invalid',
    );
  }
};

export const resolveSwingCourseCoordinatesV1 = (
  targetBallCenterAtPlate: Vec3,
  strikeZone: StrikeZoneRegion,
  handedness:
    SwingBatterHandednessV1,
): SwingCourseCoordinatesV1 => {
  if (
    !Number.isFinite(
      strikeZone.centerX,
    )
    || !Number.isFinite(
      strikeZone.halfWidth,
    )
    || strikeZone.halfWidth <= 0
    || !Number.isFinite(
      strikeZone.lowerY,
    )
    || !Number.isFinite(
      strikeZone.upperY,
    )
    || strikeZone.upperY
      <= strikeZone.lowerY
  ) {
    throw new Error(
      'course-aware swing requires a valid strike zone',
    );
  }

  const centerY =
    (
      strikeZone.lowerY
      + strikeZone.upperY
    ) / 2;
  const halfHeight =
    (
      strikeZone.upperY
      - strikeZone.lowerY
    ) / 2;

  /**
   * For R: negative world x is inside.
   * For L: positive world x is inside.
   */
  const handednessCourseSign =
    handedness === 'R'
      ? 1
      : -1;

  return {
    heightNormalized:
      clamp(
        (
          targetBallCenterAtPlate.y
          - centerY
        ) / halfHeight,
        -1,
        1,
      ),
    insideOutsideNormalized:
      clamp(
        (
          targetBallCenterAtPlate.x
          - strikeZone.centerX
        )
        / strikeZone.halfWidth
        * handednessCourseSign,
        -1,
        1,
      ),
  };
};

export const resolvePreferredContactDepthV1 = (
  course:
    SwingCourseCoordinatesV1,
  profile:
    SwingKinematicsCourseProfileV1 =
      EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,
): number => {
  validateProfile(profile);

  const raw =
    profile.centerContactDepthM
    - course.insideOutsideNormalized
      * profile.insideOutsideDepthGainM
    + course.heightNormalized
      * profile.heightDepthGainM;

  /**
   * Keep the population prior inside one reported standard deviation around
   * the adopted live-game mean. This is a safety/evidence bound, not a claim
   * that +/-1 SD are course extrema in nature.
   */
  return clamp(
    raw,
    profile.centerContactDepthM
      - profile.contactDepthPopulationStdDevM,
    profile.centerContactDepthM
      + profile.contactDepthPopulationStdDevM,
  );
};

export const resolveAttackAngleDegV1 = (
  heightNormalized: number,
  profile:
    SwingKinematicsCourseProfileV1 =
      EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,
): number => {
  validateProfile(profile);
  const height =
    clamp(
      heightNormalized,
      -1,
      1,
    );

  if (height >= 0) {
    return (
      profile.middleAttackAngleDeg
      + (
        profile.highAttackAngleDeg
        - profile.middleAttackAngleDeg
      ) * height
    );
  }

  return (
    profile.middleAttackAngleDeg
    + (
      profile.lowAttackAngleDeg
      - profile.middleAttackAngleDeg
    ) * -height
  );
};

export const resolvePreContactSecondsV1 = (
  course:
    SwingCourseCoordinatesV1,
  profile:
    SwingKinematicsCourseProfileV1 =
      EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1,
): number => {
  validateProfile(profile);

  return Math.max(
    0.08,
    profile.basePreContactSeconds
    - course.insideOutsideNormalized
      * profile
        .insideOutsideTimingGainSeconds
    + course.heightNormalized
      * profile.heightTimingGainSeconds,
  );
};

const resolveContactSpeedMps = (
  preferredContactDepthM: number,
  profile:
    SwingKinematicsCourseProfileV1,
): number => Math.max(
  1,
  profile.baseContactSweetSpotSpeedMps
  + (
    preferredContactDepthM
    - profile.centerContactDepthM
  )
    * profile
      .contactDepthSpeedGainMpsPerM,
);

const resolveContactVelocity = (
  handedness:
    SwingBatterHandednessV1,
  speedMps: number,
  attackAngleDeg: number,
  attackDirectionPullDeg: number,
): Vec3 => {
  const vertical =
    degreesToRadians(
      attackAngleDeg,
    );
  const horizontalDirection =
    degreesToRadians(
      attackDirectionPullDeg,
    );
  const horizontalSpeed =
    speedMps
    * Math.cos(vertical);
  const pullSignX =
    handedness === 'R'
      ? -1
      : 1;

  return {
    x:
      pullSignX
      * horizontalSpeed
      * Math.sin(
        horizontalDirection,
      ),
    y:
      speedMps
      * Math.sin(vertical),
    z:
      horizontalSpeed
      * Math.cos(
        horizontalDirection,
      ),
  };
};

const localTowardPlateSignX = (
  handedness:
    SwingBatterHandednessV1,
): number => (
  handedness === 'R'
    ? 1
    : -1
);

export const planCourseAwareSwingKinematicsV1 = (
  input:
    CourseAwareSwingPlanInputV1,
): CourseAwareSwingPlanV1 => {
  const profile =
    input.profile
    ?? EVIDENCE_BOUNDED_SWING_COURSE_PROFILE_V1;
  validateProfile(profile);

  if (
    !Number.isSafeInteger(
      input.contactTick,
    )
    || !Number.isSafeInteger(
      input.ticksPerSecond,
    )
    || input.ticksPerSecond <= 0
  ) {
    throw new Error(
      'course-aware swing requires safe contactTick and positive ticksPerSecond',
    );
  }

  const course =
    resolveSwingCourseCoordinatesV1(
      input.targetBallCenterAtPlate,
      input.strikeZone,
      input.handedness,
    );
  const preferredContactDepthM =
    resolvePreferredContactDepthV1(
      course,
      profile,
    );
  const attackAngleDeg =
    resolveAttackAngleDegV1(
      course.heightNormalized,
      profile,
    );
  const attackDirectionPullDeg =
    -course
      .insideOutsideNormalized
    * profile
      .courseAttackDirectionGainDeg;
  const contactSweetSpotSpeedMps =
    resolveContactSpeedMps(
      preferredContactDepthM,
      profile,
    );
  const preContactSeconds =
    resolvePreContactSecondsV1(
      course,
      profile,
    );
  const followThroughSeconds =
    profile.followThroughSeconds;

  const intendedBallCenterAtContact =
    input.targetBallCenterAtContact
    ?? {
      x:
        input.targetBallCenterAtPlate.x,
      y:
        input.targetBallCenterAtPlate.y,
      z:
        input.batterCenterOfMass.z
        + preferredContactDepthM,
    };

  const expectedContactZ =
    input.batterCenterOfMass.z
    + preferredContactDepthM;
  if (
    input.targetBallCenterAtContact
      !== undefined
    && Math.abs(
      input.targetBallCenterAtContact.z
      - expectedContactZ,
    ) > 0.01
  ) {
    throw new Error(
      'course-aware contact target z must match preferred contact depth within 1 cm',
    );
  }

  const towardPlateX =
    localTowardPlateSignX(
      input.handedness,
    );

  /**
   * Hands remain body-relative while the barrel centerline is solved so the
   * intended ball-center offset is perpendicular to the bat axis. This avoids
   * treating a fixed z offset as a true surface normal when the bat itself has
   * a z component.
   */
  const handGuideAtContact = {
    x:
      input.batterCenterOfMass.x
      + towardPlateX * 0.08,
    y:
      input.batterCenterOfMass.y
      + 0.06
      + course.heightNormalized
        * 0.05,
    z:
      intendedBallCenterAtContact.z
      - 0.18,
  };
  const pitcherNormal = {
    x: 0,
    y: 0,
    z: 1,
  } as const;

  let intendedSweetSpotCenterAtContact = {
    ...intendedBallCenterAtContact,
    z:
      intendedBallCenterAtContact.z
      - profile
        .nominalContactSurfaceDistanceM,
  };
  let contactAxis =
    normalize(
      subtract(
        intendedSweetSpotCenterAtContact,
        handGuideAtContact,
      ),
    );

  for (
    let iteration = 0;
    iteration < 8;
    iteration += 1
  ) {
    const projectedNormal = subtract(
      pitcherNormal,
      scale(
        contactAxis,
        (
          pitcherNormal.x * contactAxis.x
          + pitcherNormal.y * contactAxis.y
          + pitcherNormal.z * contactAxis.z
        ),
      ),
    );
    const contactNormal =
      normalize(projectedNormal);
    intendedSweetSpotCenterAtContact =
      subtract(
        intendedBallCenterAtContact,
        scale(
          contactNormal,
          profile
            .nominalContactSurfaceDistanceM,
        ),
      );
    contactAxis =
      normalize(
        subtract(
          intendedSweetSpotCenterAtContact,
          handGuideAtContact,
        ),
      );
  }

  const startGrip = add(
    input.batterCenterOfMass,
    {
      x:
        towardPlateX * 0.04,
      y: 0.34,
      z: -0.24,
    },
  );
  const startAxis =
    normalize({
      x:
        towardPlateX * 0.16,
      y: 0.91,
      z: -0.38,
    });
  const startSweetSpot =
    add(
      startGrip,
      scale(
        startAxis,
        profile.batLengthM
        * profile.sweetSpotT,
      ),
    );

  const pullSignX =
    input.handedness === 'R'
      ? -1
      : 1;
  const finishGrip = add(
    input.batterCenterOfMass,
    {
      x:
        pullSignX * 0.22,
      y: 0.28,
      z: 0.42,
    },
  );
  const finishAxis =
    normalize({
      x:
        pullSignX * 0.36,
      y: 0.68,
      z: 0.64,
    });
  const finishSweetSpot =
    add(
      finishGrip,
      scale(
        finishAxis,
        profile.batLengthM
        * profile.sweetSpotT,
      ),
    );

  const contactVelocity =
    resolveContactVelocity(
      input.handedness,
      contactSweetSpotSpeedMps,
      attackAngleDeg,
      attackDirectionPullDeg,
    );

  const startDirection =
    normalize(
      subtract(
        intendedSweetSpotCenterAtContact,
        startSweetSpot,
      ),
    );
  const finishDirection =
    normalize(
      subtract(
        finishSweetSpot,
        intendedSweetSpotCenterAtContact,
      ),
    );

  const startVelocity =
    scale(
      startDirection,
      contactSweetSpotSpeedMps
      * 0.10,
    );
  const finishVelocity =
    scale(
      finishDirection,
      contactSweetSpotSpeedMps
      * 0.42,
    );

  const preContactTicks =
    Math.max(
      1,
      Math.round(
        preContactSeconds
        * input.ticksPerSecond,
      ),
    );
  const followThroughTicks =
    Math.max(
      1,
      Math.round(
        followThroughSeconds
        * input.ticksPerSecond,
      ),
    );

  const trajectory =
    createSwingKinematicsTrajectoryV1({
      startTick:
        input.contactTick
        - preContactTicks,
      contactTick:
        input.contactTick,
      endTick:
        input.contactTick
        + followThroughTicks,
      ticksPerSecond:
        input.ticksPerSecond,
      batLengthM:
        profile.batLengthM,
      sweetSpotT:
        profile.sweetSpotT,
      start: {
        sweetSpotPosition:
          startSweetSpot,
        sweetSpotVelocity:
          startVelocity,
        batAxis:
          startAxis,
      },
      contact: {
        sweetSpotPosition:
          intendedSweetSpotCenterAtContact,
        sweetSpotVelocity:
          contactVelocity,
        batAxis:
          contactAxis,
      },
      finish: {
        sweetSpotPosition:
          finishSweetSpot,
        sweetSpotVelocity:
          finishVelocity,
        batAxis:
          finishAxis,
      },
    });

  return {
    handedness:
      input.handedness,
    course,
    preferredContactDepthM,
    intendedBallCenterAtContact,
    intendedSweetSpotCenterAtContact,
    attackAngleDeg,
    attackDirectionPullDeg,
    contactSweetSpotSpeedMps,
    preContactSeconds:
      preContactTicks
      / input.ticksPerSecond,
    followThroughSeconds:
      followThroughTicks
      / input.ticksPerSecond,
    trajectory,
    profileId:
      profile.profileId,
    profileVersion:
      profile.version,
  };
};