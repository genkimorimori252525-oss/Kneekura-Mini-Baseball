import type { Vec3 } from '../../model/geometry';
import type {
  BatterSwingState,
  BatPose,
  PitchWorldState,
} from './BatBallContact';

export type BatRadiusKnot = Readonly<{
  t: number;
  radiusM: number;
}>;

export type BatRadiusProfile = Readonly<{
  knots: readonly BatRadiusKnot[];
}>;

export type BatEffectiveMassKnot = Readonly<{
  t: number;
  effectiveMassKg: number;
}>;

export type BatEffectiveMassProfile = Readonly<{
  knots: readonly BatEffectiveMassKnot[];
}>;

export type RigidBatPhysicalProperties = Readonly<{
  massKg: number;
  centerOfMassT: number;
  transverseMomentOfInertiaKgM2: number;
  axialMomentOfInertiaKgM2: number;
  radiusProfile: BatRadiusProfile;
  /**
   * Optional reduced-order measurement/calibration of the normal effective
   * mass seen by the ball. It may include vibration consequences, but never
   * introduces deformation state into the authoritative Core.
   */
  normalEffectiveMassProfile?: BatEffectiveMassProfile;
}>;

export type RigidBatState = Readonly<{
  pose: BatPose;
  centerOfMassVelocity: Vec3;
  angularVelocity: Vec3;
  physical: RigidBatPhysicalProperties;
}>;

export type RigidBaseballProperties = Readonly<{
  massKg: number;
  radiusM: number;
  rotationalInertiaFactor: number;
}>;

export const REFERENCE_BASEBALL_RIGID_BODY: RigidBaseballProperties =
  Object.freeze({
    massKg: 0.145,
    radiusM: 0.0366,
    rotationalInertiaFactor: 0.4,
  });

/**
 * Brody's measured collegiate baseball had I/(mR^2) ~= 0.378 rather than the
 * uniform-solid-sphere value 0.4. Keep the old 0.4 reference for compatibility
 * fixtures, while realistic calibrated paths may opt into this measured value.
 */
export const MEASURED_BASEBALL_ROTATIONAL_INERTIA_FACTOR =
  0.378 as const;

export const REALISTIC_BASEBALL_RIGID_BODY: RigidBaseballProperties =
  Object.freeze({
    ...REFERENCE_BASEBALL_RIGID_BODY,
    rotationalInertiaFactor:
      MEASURED_BASEBALL_ROTATIONAL_INERTIA_FACTOR,
  });

export type RigidBatBallContactParameters = Readonly<{
  normalRestitution: number;
  tangentialRestitution: number;
  frictionCoefficient: number;
}>;

/**
 * Low-speed (~4 m/s) wooden-bat fixture from Cross & Nathan (2006).
 *
 * ey ~= 0.63, ex ~= 0.16. The reported ball-bat sliding-friction result is
 * only a lower bound (>0.50), so 0.50 is used here strictly as a conservative
 * validation fixture. These are NOT MLB game-speed production coefficients.
 */
export const CROSS_NATHAN_2006_LOW_SPEED_BAT_CONTACT_FIXTURE:
  RigidBatBallContactParameters = Object.freeze({
    normalRestitution: 0.63,
    tangentialRestitution: 0.16,
    frictionCoefficient: 0.50,
  });

export type RigidBatBallContactResult = Readonly<{
  tick: number;
  segmentT: number;
  localBatRadiusM: number;
  normal: Vec3;
  batSurfacePoint: Vec3;
  ballSurfacePoint: Vec3;
  normalRelativeSpeedBeforeMps: number;
  tangentialRelativeSpeedBeforeMps: number;
  normalImpulseNs: number;
  tangentialImpulseNs: Vec3;
  totalImpulseNs: Vec3;
  effectiveNormalMassKg: number;
  batNormalEffectiveMassKg: number;
  normalEffectiveMassSource: 'rigid_body' | 'dynamic_profile';
  batRecoilModel: 'rigid_body' | 'rigid_projection_only';
  exitVelocity: Vec3;
  exitSpin: Vec3;
  batExitCenterOfMassVelocity: Vec3;
  batExitAngularVelocity: Vec3;
}>;

const EPSILON = 1e-12;

const add = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x + b.x,
  y: a.y + b.y,
  z: a.z + b.z,
});

const subtract = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.x - b.x,
  y: a.y - b.y,
  z: a.z - b.z,
});

const scale = (value: Vec3, scalar: number): Vec3 => ({
  x: value.x * scalar,
  y: value.y * scalar,
  z: value.z * scalar,
});

const dot = (a: Vec3, b: Vec3): number =>
  a.x * b.x + a.y * b.y + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (value: Vec3): number =>
  Math.hypot(value.x, value.y, value.z);

const normalize = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  if (length <= EPSILON) {
    throw new Error('cannot normalize a zero-length vector');
  }
  return scale(value, 1 / length);
};

const clamp01 = (value: number): number =>
  Math.max(0, Math.min(1, value));

const validateRadiusProfile = (
  profile: BatRadiusProfile,
): void => {
  if (profile.knots.length < 2) {
    throw new Error('bat radius profile requires at least two knots');
  }
  let previousT = -Infinity;
  for (const knot of profile.knots) {
    if (!Number.isFinite(knot.t) || knot.t < 0 || knot.t > 1) {
      throw new Error('bat radius knot t must be finite within [0, 1]');
    }
    if (!Number.isFinite(knot.radiusM) || knot.radiusM <= 0) {
      throw new Error('bat radius knot radiusM must be finite and positive');
    }
    if (knot.t <= previousT) {
      throw new Error('bat radius knots must be strictly increasing');
    }
    previousT = knot.t;
  }
  if (
    profile.knots[0]!.t !== 0
    || profile.knots[profile.knots.length - 1]!.t !== 1
  ) {
    throw new Error('bat radius profile must include t=0 and t=1 endpoints');
  }
};

const validateEffectiveMassProfile = (
  profile: BatEffectiveMassProfile,
): void => {
  if (profile.knots.length < 2) {
    throw new Error(
      'bat effective-mass profile requires at least two knots',
    );
  }
  let previousT = -Infinity;
  for (const knot of profile.knots) {
    if (!Number.isFinite(knot.t) || knot.t < 0 || knot.t > 1) {
      throw new Error(
        'bat effective-mass knot t must be finite within [0, 1]',
      );
    }
    if (
      !Number.isFinite(knot.effectiveMassKg)
      || knot.effectiveMassKg <= 0
    ) {
      throw new Error(
        'bat effective-mass knot value must be finite and positive',
      );
    }
    if (knot.t <= previousT) {
      throw new Error(
        'bat effective-mass knots must be strictly increasing',
      );
    }
    previousT = knot.t;
  }
  if (
    profile.knots[0]!.t !== 0
    || profile.knots[profile.knots.length - 1]!.t !== 1
  ) {
    throw new Error(
      'bat effective-mass profile must include t=0 and t=1 endpoints',
    );
  }
};

const validateBat = (bat: RigidBatState): void => {
  const p = bat.physical;
  if (!Number.isFinite(p.massKg) || p.massKg <= 0) {
    throw new Error('bat massKg must be finite and positive');
  }
  if (
    !Number.isFinite(p.centerOfMassT)
    || p.centerOfMassT < 0
    || p.centerOfMassT > 1
  ) {
    throw new Error('bat centerOfMassT must be finite within [0, 1]');
  }
  if (
    !Number.isFinite(p.transverseMomentOfInertiaKgM2)
    || p.transverseMomentOfInertiaKgM2 <= 0
    || !Number.isFinite(p.axialMomentOfInertiaKgM2)
    || p.axialMomentOfInertiaKgM2 <= 0
  ) {
    throw new Error('bat moments of inertia must be finite and positive');
  }
  validateRadiusProfile(p.radiusProfile);
  if (p.normalEffectiveMassProfile !== undefined) {
    validateEffectiveMassProfile(
      p.normalEffectiveMassProfile,
    );
  }
};

const validateBall = (ball: RigidBaseballProperties): void => {
  if (!Number.isFinite(ball.massKg) || ball.massKg <= 0) {
    throw new Error('ball massKg must be finite and positive');
  }
  if (!Number.isFinite(ball.radiusM) || ball.radiusM <= 0) {
    throw new Error('ball radiusM must be finite and positive');
  }
  if (
    !Number.isFinite(ball.rotationalInertiaFactor)
    || ball.rotationalInertiaFactor <= 0
  ) {
    throw new Error(
      'ball rotationalInertiaFactor must be finite and positive',
    );
  }
};

const validateContactParameters = (
  parameters: RigidBatBallContactParameters,
): void => {
  for (const [name, value] of [
    ['normalRestitution', parameters.normalRestitution],
    ['tangentialRestitution', parameters.tangentialRestitution],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error(`${name} must be finite within [0, 1]`);
    }
  }
  if (
    !Number.isFinite(parameters.frictionCoefficient)
    || parameters.frictionCoefficient < 0
  ) {
    throw new Error('frictionCoefficient must be finite and non-negative');
  }
};

export const sampleBatRadius = (
  profile: BatRadiusProfile,
  t: number,
): number => {
  validateRadiusProfile(profile);
  if (!Number.isFinite(t)) {
    throw new Error('bat radius sample t must be finite');
  }
  const clamped = clamp01(t);

  for (let index = 1; index < profile.knots.length; index += 1) {
    const right = profile.knots[index]!;
    if (clamped > right.t) {
      continue;
    }
    const left = profile.knots[index - 1]!;
    const span = right.t - left.t;
    const local = span <= EPSILON
      ? 0
      : (clamped - left.t) / span;
    return left.radiusM
      + (right.radiusM - left.radiusM) * local;
  }

  return profile.knots[profile.knots.length - 1]!.radiusM;
};

export const sampleBatEffectiveMass = (
  profile: BatEffectiveMassProfile,
  t: number,
): number => {
  validateEffectiveMassProfile(profile);
  if (!Number.isFinite(t)) {
    throw new Error('bat effective-mass sample t must be finite');
  }
  const clamped = clamp01(t);

  for (let index = 1; index < profile.knots.length; index += 1) {
    const right = profile.knots[index]!;
    if (clamped > right.t) {
      continue;
    }
    const left = profile.knots[index - 1]!;
    const span = right.t - left.t;
    const local = span <= EPSILON
      ? 0
      : (clamped - left.t) / span;
    return left.effectiveMassKg
      + (
        right.effectiveMassKg
        - left.effectiveMassKg
      ) * local;
  }

  return profile.knots[profile.knots.length - 1]!.effectiveMassKg;
};

const axisGeometry = (
  pose: BatPose,
): Readonly<{
  axis: Vec3;
  lengthM: number;
}> => {
  const delta = subtract(pose.tip, pose.grip);
  const lengthM = magnitude(delta);
  if (lengthM <= EPSILON) {
    throw new Error('bat pose grip and tip must not be identical');
  }
  return {
    axis: scale(delta, 1 / lengthM),
    lengthM,
  };
};

const closestPointOnTaperedBat = (
  point: Vec3,
  bat: RigidBatState,
): Readonly<{
  point: Vec3;
  t: number;
  localRadiusM: number;
  surfaceSeparationM: number;
}> => {
  const { axis, lengthM } = axisGeometry(bat.pose);
  const fromGrip = subtract(
    point,
    bat.pose.grip,
  );
  const projectedS = dot(
    fromGrip,
    axis,
  );
  const perpendicular = subtract(
    fromGrip,
    scale(axis, projectedS),
  );
  const perpendicularDistance = magnitude(
    perpendicular,
  );

  let best: Readonly<{
    point: Vec3;
    t: number;
    localRadiusM: number;
    surfaceSeparationM: number;
  }> | null = null;

  const consider = (candidateT: number): void => {
    const t = clamp01(candidateT);
    const axisPoint = add(
      bat.pose.grip,
      scale(axis, t * lengthM),
    );
    const localRadiusM = sampleBatRadius(
      bat.physical.radiusProfile,
      t,
    );
    const surfaceSeparationM =
      magnitude(subtract(point, axisPoint))
      - localRadiusM;

    if (
      best === null
      || surfaceSeparationM < best.surfaceSeparationM
    ) {
      best = {
        point: axisPoint,
        t,
        localRadiusM,
        surfaceSeparationM,
      };
    }
  };

  const knots = bat.physical.radiusProfile.knots;
  for (let index = 1; index < knots.length; index += 1) {
    const left = knots[index - 1]!;
    const right = knots[index]!;
    consider(left.t);
    consider(right.t);

    const intervalLengthM =
      (right.t - left.t) * lengthM;
    const radiusSlope =
      (right.radiusM - left.radiusM)
      / intervalLengthM;

    // Within a linear-radius interval, minimize
    // sqrt(d^2 + (s-s0)^2) - r(s) analytically.
    if (Math.abs(radiusSlope) < 1) {
      const longitudinalOffsetM =
        radiusSlope
        * perpendicularDistance
        / Math.sqrt(
          1 - radiusSlope * radiusSlope,
        );
      const candidateS =
        projectedS + longitudinalOffsetM;
      const candidateT =
        candidateS / lengthM;
      if (
        candidateT >= left.t
        && candidateT <= right.t
      ) {
        consider(candidateT);
      }
    }
  }

  if (best === null) {
    throw new Error('bat radius profile produced no contact candidates');
  }
  return best;
};

const batCenterOfMassPoint = (
  bat: RigidBatState,
): Vec3 => add(
  bat.pose.grip,
  scale(
    subtract(bat.pose.tip, bat.pose.grip),
    bat.physical.centerOfMassT,
  ),
);

const applyBatInverseInertia = (
  value: Vec3,
  batAxis: Vec3,
  physical: RigidBatPhysicalProperties,
): Vec3 => {
  const parallel = scale(batAxis, dot(value, batAxis));
  const perpendicular = subtract(value, parallel);
  return add(
    scale(parallel, 1 / physical.axialMomentOfInertiaKgM2),
    scale(
      perpendicular,
      1 / physical.transverseMomentOfInertiaKgM2,
    ),
  );
};

const applyBallInverseInertia = (
  value: Vec3,
  ball: RigidBaseballProperties,
): Vec3 => {
  const inertia =
    ball.rotationalInertiaFactor
    * ball.massKg
    * ball.radiusM
    * ball.radiusM;
  return scale(value, 1 / inertia);
};

const pointVelocity = (
  centerVelocity: Vec3,
  angularVelocity: Vec3,
  leverArm: Vec3,
): Vec3 => add(
  centerVelocity,
  cross(angularVelocity, leverArm),
);

type MutableRigidState = {
  ballVelocity: Vec3;
  ballSpin: Vec3;
  batVelocity: Vec3;
  batAngularVelocity: Vec3;
};

const applyImpulse = (
  state: MutableRigidState,
  impulseOnBall: Vec3,
  ballLeverArm: Vec3,
  batLeverArm: Vec3,
  ball: RigidBaseballProperties,
  bat: RigidBatState,
  batAxis: Vec3,
): void => {
  state.ballVelocity = add(
    state.ballVelocity,
    scale(impulseOnBall, 1 / ball.massKg),
  );
  state.ballSpin = add(
    state.ballSpin,
    applyBallInverseInertia(
      cross(ballLeverArm, impulseOnBall),
      ball,
    ),
  );

  const impulseOnBat = scale(impulseOnBall, -1);
  state.batVelocity = add(
    state.batVelocity,
    scale(impulseOnBat, 1 / bat.physical.massKg),
  );
  state.batAngularVelocity = add(
    state.batAngularVelocity,
    applyBatInverseInertia(
      cross(batLeverArm, impulseOnBat),
      batAxis,
      bat.physical,
    ),
  );
};

const relativeSurfaceVelocity = (
  state: MutableRigidState,
  ballLeverArm: Vec3,
  batLeverArm: Vec3,
): Vec3 => subtract(
  pointVelocity(
    state.ballVelocity,
    state.ballSpin,
    ballLeverArm,
  ),
  pointVelocity(
    state.batVelocity,
    state.batAngularVelocity,
    batLeverArm,
  ),
);

const ballInverseMassContributionAlong = (
  direction: Vec3,
  ballLeverArm: Vec3,
  ball: RigidBaseballProperties,
): number => {
  const angular = dot(
    direction,
    cross(
      applyBallInverseInertia(
        cross(ballLeverArm, direction),
        ball,
      ),
      ballLeverArm,
    ),
  );
  return 1 / ball.massKg + angular;
};

const rigidBatInverseMassContributionAlong = (
  direction: Vec3,
  batLeverArm: Vec3,
  bat: RigidBatState,
  batAxis: Vec3,
): number => {
  const angular = dot(
    direction,
    cross(
      applyBatInverseInertia(
        cross(batLeverArm, direction),
        batAxis,
        bat.physical,
      ),
      batLeverArm,
    ),
  );
  return 1 / bat.physical.massKg + angular;
};

const effectiveInverseMassAlong = (
  direction: Vec3,
  ballLeverArm: Vec3,
  batLeverArm: Vec3,
  ball: RigidBaseballProperties,
  bat: RigidBatState,
  batAxis: Vec3,
): number => (
  ballInverseMassContributionAlong(
    direction,
    ballLeverArm,
    ball,
  )
  + rigidBatInverseMassContributionAlong(
    direction,
    batLeverArm,
    bat,
    batAxis,
  )
);

export const createRigidBatStateFromBatterSwingState = (
  swing: BatterSwingState,
  physical: RigidBatPhysicalProperties,
): RigidBatState => {
  validateBat({
    pose: swing.pose,
    centerOfMassVelocity: {
      x: 0,
      y: 0,
      z: 0,
    },
    angularVelocity:
      swing.angularVelocity,
    physical,
  });

  const centerOfMassPoint = add(
    swing.pose.grip,
    scale(
      subtract(
        swing.pose.tip,
        swing.pose.grip,
      ),
      physical.centerOfMassT,
    ),
  );
  const gripToCenterOfMass = subtract(
    centerOfMassPoint,
    swing.pose.grip,
  );

  return {
    pose: swing.pose,
    centerOfMassVelocity: add(
      swing.linearVelocity,
      cross(
        swing.angularVelocity,
        gripToCenterOfMass,
      ),
    ),
    angularVelocity:
      swing.angularVelocity,
    physical,
  };
};

export const measureRigidBatBallSurfaceSeparation = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
): number => {
  validateBat(bat);
  validateBall(ball);

  const nearest =
    closestPointOnTaperedBat(
      pitch.position,
      bat,
    );
  return (
    nearest.surfaceSeparationM
    - ball.radiusM
  );
};

export const calculateRigidBatDirectionalEffectiveMass = (
  bat: RigidBatState,
  contactPoint: Vec3,
  direction: Vec3,
): number => {
  validateBat(bat);
  const unitDirection =
    normalize(direction);
  const { axis: batAxis } =
    axisGeometry(bat.pose);
  const leverArm = subtract(
    contactPoint,
    batCenterOfMassPoint(bat),
  );
  const inverseMass =
    rigidBatInverseMassContributionAlong(
      unitDirection,
      leverArm,
      bat,
      batAxis,
    );
  if (inverseMass <= EPSILON) {
    throw new Error(
      'rigid bat directional inverse mass must be positive',
    );
  }
  return 1 / inverseMass;
};

export type RigidBatBallContactKinematics = Readonly<{
  tick: number;
  segmentT: number;
  localBatRadiusM: number;
  normal: Vec3;
  batSurfacePoint: Vec3;
  ballSurfacePoint: Vec3;
  relativeSurfaceVelocityBefore: Vec3;
  totalRelativeSurfaceSpeedMps: number;
  normalRelativeSpeedBeforeMps: number;
  normalApproachSpeedMps: number;
  tangentialRelativeSpeedBeforeMps: number;
}>;

export type RigidBatBallContactParameterResolver = (
  kinematics: RigidBatBallContactKinematics,
) => RigidBatBallContactParameters;

type PreparedRigidBatBallContact = Readonly<{
  kinematics: RigidBatBallContactKinematics;
  batAxis: Vec3;
  batLeverArm: Vec3;
  ballLeverArm: Vec3;
  state: MutableRigidState;
}>;

const prepareRigidBatBallContact = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
): PreparedRigidBatBallContact | null => {
  validateBat(bat);
  validateBall(ball);

  const { axis: batAxis } =
    axisGeometry(bat.pose);
  const nearest =
    closestPointOnTaperedBat(
      pitch.position,
      bat,
    );
  const localBatRadiusM =
    nearest.localRadiusM;

  if (
    nearest.surfaceSeparationM
    > ball.radiusM
  ) {
    return null;
  }

  const axisToBall = subtract(
    pitch.position,
    nearest.point,
  );
  const centerDistance =
    magnitude(axisToBall);
  const centerOfMass =
    batCenterOfMassPoint(bat);
  const fallbackRelative =
    subtract(
      pitch.velocity,
      bat.centerOfMassVelocity,
    );
  const normal =
    centerDistance > EPSILON
      ? scale(
          axisToBall,
          1 / centerDistance,
        )
      : normalize(
          scale(
            fallbackRelative,
            -1,
          ),
        );

  const batSurfacePoint = add(
    nearest.point,
    scale(
      normal,
      localBatRadiusM,
    ),
  );
  const ballSurfacePoint = add(
    pitch.position,
    scale(
      normal,
      -ball.radiusM,
    ),
  );
  const batLeverArm = subtract(
    batSurfacePoint,
    centerOfMass,
  );
  const ballLeverArm = subtract(
    ballSurfacePoint,
    pitch.position,
  );

  const state: MutableRigidState = {
    ballVelocity: pitch.velocity,
    ballSpin: pitch.spin,
    batVelocity:
      bat.centerOfMassVelocity,
    batAngularVelocity:
      bat.angularVelocity,
  };

  const relativeBefore =
    relativeSurfaceVelocity(
      state,
      ballLeverArm,
      batLeverArm,
    );
  const normalRelativeSpeed =
    dot(
      relativeBefore,
      normal,
    );

  if (normalRelativeSpeed >= 0) {
    return null;
  }

  const tangentBefore = subtract(
    relativeBefore,
    scale(
      normal,
      normalRelativeSpeed,
    ),
  );
  const tangentialRelativeSpeedBeforeMps =
    magnitude(tangentBefore);

  return {
    kinematics: {
      tick: pitch.tick,
      segmentT: nearest.t,
      localBatRadiusM,
      normal,
      batSurfacePoint,
      ballSurfacePoint,
      relativeSurfaceVelocityBefore:
        relativeBefore,
      totalRelativeSurfaceSpeedMps:
        magnitude(relativeBefore),
      normalRelativeSpeedBeforeMps:
        normalRelativeSpeed,
      normalApproachSpeedMps:
        -normalRelativeSpeed,
      tangentialRelativeSpeedBeforeMps,
    },
    batAxis,
    batLeverArm,
    ballLeverArm,
    state,
  };
};

export const measureRigidBatBallContactKinematics = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
): RigidBatBallContactKinematics | null => (
  prepareRigidBatBallContact(
    pitch,
    bat,
    ball,
  )?.kinematics
  ?? null
);

export const resolveRigidBatBallContactWithParameterResolver = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
  parameterResolver:
    RigidBatBallContactParameterResolver,
): RigidBatBallContactResult | null => {
  const prepared =
    prepareRigidBatBallContact(
      pitch,
      bat,
      ball,
    );
  if (prepared === null) {
    return null;
  }

  const {
    kinematics,
    batAxis,
    batLeverArm,
    ballLeverArm,
    state,
  } = prepared;

  const parameters =
    parameterResolver(kinematics);
  validateContactParameters(
    parameters,
  );

  const rigidBatNormalInverseMass =
    rigidBatInverseMassContributionAlong(
      kinematics.normal,
      batLeverArm,
      bat,
      batAxis,
    );
  const rigidBatNormalEffectiveMassKg =
    1 / rigidBatNormalInverseMass;
  const dynamicProfile =
    bat.physical
      .normalEffectiveMassProfile;
  const batNormalEffectiveMassKg =
    dynamicProfile === undefined
      ? rigidBatNormalEffectiveMassKg
      : sampleBatEffectiveMass(
          dynamicProfile,
          kinematics.segmentT,
        );
  const normalEffectiveMassSource =
    dynamicProfile === undefined
      ? 'rigid_body' as const
      : 'dynamic_profile' as const;

  const normalInverseMass =
    ballInverseMassContributionAlong(
      kinematics.normal,
      ballLeverArm,
      ball,
    )
    + 1 / batNormalEffectiveMassKg;
  if (normalInverseMass <= EPSILON) {
    throw new Error(
      'normal effective inverse mass must be positive',
    );
  }

  const normalImpulseNs =
    -(
      1
      + parameters.normalRestitution
    )
    * kinematics
      .normalRelativeSpeedBeforeMps
    / normalInverseMass;
  const normalImpulse = scale(
    kinematics.normal,
    normalImpulseNs,
  );

  applyImpulse(
    state,
    normalImpulse,
    ballLeverArm,
    batLeverArm,
    ball,
    bat,
    batAxis,
  );

  let tangentialImpulseNs: Vec3 = {
    x: 0,
    y: 0,
    z: 0,
  };

  if (
    parameters.frictionCoefficient > 0
    && kinematics
      .tangentialRelativeSpeedBeforeMps
      > EPSILON
  ) {
    const relativeAfterNormal =
      relativeSurfaceVelocity(
        state,
        ballLeverArm,
        batLeverArm,
      );
    const normalAfterNormal = dot(
      relativeAfterNormal,
      kinematics.normal,
    );
    const tangentAfterNormal = subtract(
      relativeAfterNormal,
      scale(
        kinematics.normal,
        normalAfterNormal,
      ),
    );
    const tangentSpeedAfterNormal =
      magnitude(tangentAfterNormal);

    if (
      tangentSpeedAfterNormal
      > EPSILON
    ) {
      const tangentDirection = scale(
        tangentAfterNormal,
        1 / tangentSpeedAfterNormal,
      );
      const tangentialInverseMass =
        effectiveInverseMassAlong(
          tangentDirection,
          ballLeverArm,
          batLeverArm,
          ball,
          bat,
          batAxis,
        );

      if (
        tangentialInverseMass
        <= EPSILON
      ) {
        throw new Error(
          'tangential effective inverse mass must be positive',
        );
      }

      const targetImpulseMagnitude =
        (
          1
          + parameters
            .tangentialRestitution
        )
        * tangentSpeedAfterNormal
        / tangentialInverseMass;
      const frictionLimit =
        parameters
          .frictionCoefficient
        * normalImpulseNs;
      const tangentialImpulseMagnitude =
        Math.min(
          targetImpulseMagnitude,
          frictionLimit,
        );

      tangentialImpulseNs = scale(
        tangentDirection,
        -tangentialImpulseMagnitude,
      );

      applyImpulse(
        state,
        tangentialImpulseNs,
        ballLeverArm,
        batLeverArm,
        ball,
        bat,
        batAxis,
      );
    }
  }

  const totalImpulseNs = add(
    normalImpulse,
    tangentialImpulseNs,
  );

  return {
    tick: kinematics.tick,
    segmentT:
      kinematics.segmentT,
    localBatRadiusM:
      kinematics.localBatRadiusM,
    normal:
      kinematics.normal,
    batSurfacePoint:
      kinematics.batSurfacePoint,
    ballSurfacePoint:
      kinematics.ballSurfacePoint,
    normalRelativeSpeedBeforeMps:
      kinematics
        .normalRelativeSpeedBeforeMps,
    tangentialRelativeSpeedBeforeMps:
      kinematics
        .tangentialRelativeSpeedBeforeMps,
    normalImpulseNs,
    tangentialImpulseNs,
    totalImpulseNs,
    effectiveNormalMassKg:
      1 / normalInverseMass,
    batNormalEffectiveMassKg,
    normalEffectiveMassSource,
    batRecoilModel:
      normalEffectiveMassSource
      === 'rigid_body'
        ? 'rigid_body'
        : 'rigid_projection_only',
    exitVelocity:
      state.ballVelocity,
    exitSpin:
      state.ballSpin,
    batExitCenterOfMassVelocity:
      state.batVelocity,
    batExitAngularVelocity:
      state.batAngularVelocity,
  };
};

export const resolveRigidBatBallContact = (
  pitch: PitchWorldState,
  bat: RigidBatState,
  ball: RigidBaseballProperties,
  parameters: RigidBatBallContactParameters,
): RigidBatBallContactResult | null => (
  resolveRigidBatBallContactWithParameterResolver(
    pitch,
    bat,
    ball,
    () => parameters,
  )
);
