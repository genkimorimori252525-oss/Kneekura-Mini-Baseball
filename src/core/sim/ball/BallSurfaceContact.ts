import type { Vec3 } from '../../model/geometry';
import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';

export type BallSurfaceContactParameters = Readonly<{
  normalRestitution: number;
  tangentialRestitution: number;
  frictionCoefficient: number;
}>;

export type BallSurfaceContactInput = Readonly<{
  tick: number;
  ballCenter: Vec3;
  ballVelocity: Vec3;
  ballSpin: Vec3;
  ball: RigidBaseballProperties;
  /**
   * Unit normal pointing away from the surface into the ball's allowed
   * half-space. Ground is typically +Y.
   */
  surfaceNormal: Vec3;
  surfaceVelocity?: Vec3;
  parameters: BallSurfaceContactParameters;
}>;

export type BallSurfaceContactResult = Readonly<{
  tick: number;
  contactPoint: Vec3;
  normal: Vec3;
  relativeSurfaceVelocityBefore: Vec3;
  normalRelativeSpeedBeforeMps: number;
  tangentialRelativeSpeedBeforeMps: number;
  normalImpulseNs: number;
  tangentialImpulseNs: Vec3;
  totalImpulseNs: Vec3;
  tangentialTargetMet: boolean;
  exitVelocity: Vec3;
  exitSpin: Vec3;
  relativeSurfaceVelocityAfter: Vec3;
}>;

export const CROSS_NATHAN_2006_HARDWOOD_LOW_SPEED_LOWER_BOUND_FIXTURE:
  BallSurfaceContactParameters = Object.freeze({
    normalRestitution: 0.59,
    tangentialRestitution: 0.17,
    /**
     * Cross & Nathan report mu_k > 0.31 +/- 0.02 for their hardwood-floor
     * test. 0.31 is therefore only a conservative lower-bound fixture, not a
     * field-surface calibration.
     */
    frictionCoefficient: 0.31,
  });

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
  a.x * b.x
  + a.y * b.y
  + a.z * b.z;

const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});

const magnitude = (value: Vec3): number =>
  Math.hypot(
    value.x,
    value.y,
    value.z,
  );

const normalize = (value: Vec3): Vec3 => {
  const length = magnitude(value);
  if (
    !Number.isFinite(length)
    || length <= EPSILON
  ) {
    throw new Error(
      'surface normal must have finite non-zero length',
    );
  }
  return scale(
    value,
    1 / length,
  );
};

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(
      `${name} must contain finite values`,
    );
  }
};

const validate = (
  input: BallSurfaceContactInput,
): void => {
  if (
    !Number.isSafeInteger(input.tick)
    || input.tick < 0
  ) {
    throw new Error(
      'surface contact tick must be a non-negative safe integer',
    );
  }

  validateVec3(
    'ballCenter',
    input.ballCenter,
  );
  validateVec3(
    'ballVelocity',
    input.ballVelocity,
  );
  validateVec3(
    'ballSpin',
    input.ballSpin,
  );
  validateVec3(
    'surfaceNormal',
    input.surfaceNormal,
  );
  if (
    input.surfaceVelocity !== undefined
  ) {
    validateVec3(
      'surfaceVelocity',
      input.surfaceVelocity,
    );
  }

  if (
    !Number.isFinite(input.ball.massKg)
    || input.ball.massKg <= 0
    || !Number.isFinite(input.ball.radiusM)
    || input.ball.radiusM <= 0
    || !Number.isFinite(
      input.ball.rotationalInertiaFactor,
    )
    || input.ball.rotationalInertiaFactor <= 0
  ) {
    throw new Error(
      'surface-contact ball properties must be finite and positive',
    );
  }

  if (
    !Number.isFinite(
      input.parameters.normalRestitution,
    )
    || input.parameters.normalRestitution < 0
    || input.parameters.normalRestitution > 1
    || !Number.isFinite(
      input.parameters.tangentialRestitution,
    )
    || input.parameters.tangentialRestitution < 0
    || input.parameters.tangentialRestitution > 1
    || !Number.isFinite(
      input.parameters.frictionCoefficient,
    )
    || input.parameters.frictionCoefficient < 0
  ) {
    throw new Error(
      'surface contact restitution values must be within [0, 1] and friction non-negative',
    );
  }
};

const ballRotationalInertia = (
  ball: RigidBaseballProperties,
): number => (
  ball.rotationalInertiaFactor
  * ball.massKg
  * ball.radiusM
  * ball.radiusM
);

const pointVelocity = (
  centerVelocity: Vec3,
  spin: Vec3,
  leverArm: Vec3,
): Vec3 => add(
  centerVelocity,
  cross(
    spin,
    leverArm,
  ),
);

const tangentialInverseMass = (
  tangentDirection: Vec3,
  ballLeverArm: Vec3,
  ball: RigidBaseballProperties,
): number => {
  const inertia =
    ballRotationalInertia(ball);
  const angularContribution = dot(
    tangentDirection,
    cross(
      scale(
        cross(
          ballLeverArm,
          tangentDirection,
        ),
        1 / inertia,
      ),
      ballLeverArm,
    ),
  );

  return (
    1 / ball.massKg
    + angularContribution
  );
};

export const resolveBallSurfaceContact = (
  input: BallSurfaceContactInput,
): BallSurfaceContactResult | null => {
  validate(input);

  const normal = normalize(
    input.surfaceNormal,
  );
  const surfaceVelocity =
    input.surfaceVelocity
    ?? { x: 0, y: 0, z: 0 };

  const ballLeverArm = scale(
    normal,
    -input.ball.radiusM,
  );
  const contactPoint = add(
    input.ballCenter,
    ballLeverArm,
  );

  let exitVelocity =
    input.ballVelocity;
  let exitSpin =
    input.ballSpin;

  const relativeBefore = subtract(
    pointVelocity(
      exitVelocity,
      exitSpin,
      ballLeverArm,
    ),
    surfaceVelocity,
  );
  const normalRelativeSpeedBeforeMps =
    dot(
      relativeBefore,
      normal,
    );

  if (
    normalRelativeSpeedBeforeMps
    >= 0
  ) {
    return null;
  }

  const tangentBefore = subtract(
    relativeBefore,
    scale(
      normal,
      normalRelativeSpeedBeforeMps,
    ),
  );
  const tangentialRelativeSpeedBeforeMps =
    magnitude(tangentBefore);

  const normalImpulseNs =
    -(
      1
      + input.parameters
        .normalRestitution
    )
    * normalRelativeSpeedBeforeMps
    * input.ball.massKg;

  const normalImpulse = scale(
    normal,
    normalImpulseNs,
  );

  exitVelocity = add(
    exitVelocity,
    scale(
      normalImpulse,
      1 / input.ball.massKg,
    ),
  );

  let tangentialImpulseNs: Vec3 = {
    x: 0,
    y: 0,
    z: 0,
  };
  let tangentialTargetMet = true;

  if (
    input.parameters.frictionCoefficient > 0
    && tangentialRelativeSpeedBeforeMps
      > EPSILON
  ) {
    const relativeAfterNormal =
      subtract(
        pointVelocity(
          exitVelocity,
          exitSpin,
          ballLeverArm,
        ),
        surfaceVelocity,
      );
    const normalAfterNormal = dot(
      relativeAfterNormal,
      normal,
    );
    const tangentAfterNormal =
      subtract(
        relativeAfterNormal,
        scale(
          normal,
          normalAfterNormal,
        ),
      );
    const tangentSpeed =
      magnitude(tangentAfterNormal);

    if (tangentSpeed > EPSILON) {
      const tangentDirection = scale(
        tangentAfterNormal,
        1 / tangentSpeed,
      );
      const inverseMass =
        tangentialInverseMass(
          tangentDirection,
          ballLeverArm,
          input.ball,
        );
      const targetMagnitude =
        (
          1
          + input.parameters
            .tangentialRestitution
        )
        * tangentSpeed
        / inverseMass;
      const frictionLimit =
        input.parameters
          .frictionCoefficient
        * normalImpulseNs;
      const impulseMagnitude =
        Math.min(
          targetMagnitude,
          frictionLimit,
        );

      tangentialTargetMet =
        targetMagnitude
        <= frictionLimit
        + EPSILON;
      tangentialImpulseNs = scale(
        tangentDirection,
        -impulseMagnitude,
      );

      exitVelocity = add(
        exitVelocity,
        scale(
          tangentialImpulseNs,
          1 / input.ball.massKg,
        ),
      );

      const inertia =
        ballRotationalInertia(
          input.ball,
        );
      exitSpin = add(
        exitSpin,
        scale(
          cross(
            ballLeverArm,
            tangentialImpulseNs,
          ),
          1 / inertia,
        ),
      );
    }
  }

  const relativeAfter = subtract(
    pointVelocity(
      exitVelocity,
      exitSpin,
      ballLeverArm,
    ),
    surfaceVelocity,
  );

  return {
    tick: input.tick,
    contactPoint,
    normal,
    relativeSurfaceVelocityBefore:
      relativeBefore,
    normalRelativeSpeedBeforeMps,
    tangentialRelativeSpeedBeforeMps,
    normalImpulseNs,
    tangentialImpulseNs,
    totalImpulseNs: add(
      normalImpulse,
      tangentialImpulseNs,
    ),
    tangentialTargetMet,
    exitVelocity,
    exitSpin,
    relativeSurfaceVelocityAfter:
      relativeAfter,
  };
};
