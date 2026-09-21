import type { Vec3 } from '../../model/geometry';
import type {
  BatterSwingState,
} from './BatBallContact';

export const SWING_KINEMATICS_V1_VERSION =
  'swing-kinematics-v1' as const;

export type SwingKinematicsV1Version =
  typeof SWING_KINEMATICS_V1_VERSION;

export type SwingKinematicsPhaseV1 =
  | 'pre_contact'
  | 'contact'
  | 'follow_through';

export type SwingKinematicsKnotV1 = Readonly<{
  sweetSpotPosition: Vec3;
  sweetSpotVelocity: Vec3;
  batAxis: Vec3;
  /**
   * Time derivative of the unit bat-axis vector, in 1/s.
   * Must be tangent to batAxis.
   */
  batAxisDerivative: Vec3;
}>;

export type SwingKinematicsTrajectoryV1 = Readonly<{
  version: SwingKinematicsV1Version;
  startTick: number;
  contactTick: number;
  endTick: number;
  ticksPerSecond: number;
  batLengthM: number;
  /**
   * Fraction measured from grip to tip.
   */
  sweetSpotT: number;
  start: SwingKinematicsKnotV1;
  contact: SwingKinematicsKnotV1;
  finish: SwingKinematicsKnotV1;
}>;

export type SwingKinematicsSampleV1 = Readonly<{
  tick: number;
  phase: SwingKinematicsPhaseV1;
  sweetSpotPosition: Vec3;
  sweetSpotVelocity: Vec3;
  batAxis: Vec3;
  batAxisDerivative: Vec3;
  swingState: BatterSwingState;
}>;

export type SwingKinematicsTrajectoryV1Input = Readonly<{
  startTick: number;
  contactTick: number;
  endTick: number;
  ticksPerSecond: number;
  batLengthM: number;
  sweetSpotT: number;
  start: Readonly<{
    sweetSpotPosition: Vec3;
    sweetSpotVelocity: Vec3;
    batAxis: Vec3;
  }>;
  contact: Readonly<{
    sweetSpotPosition: Vec3;
    sweetSpotVelocity: Vec3;
    batAxis: Vec3;
  }>;
  finish: Readonly<{
    sweetSpotPosition: Vec3;
    sweetSpotVelocity: Vec3;
    batAxis: Vec3;
  }>;
}>;

const EPSILON = 1e-12;

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

const dot = (
  first: Vec3,
  second: Vec3,
): number => (
  first.x * second.x
  + first.y * second.y
  + first.z * second.z
);

const cross = (
  first: Vec3,
  second: Vec3,
): Vec3 => ({
  x:
    first.y * second.z
    - first.z * second.y,
  y:
    first.z * second.x
    - first.x * second.z,
  z:
    first.x * second.y
    - first.y * second.x,
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
      'swing kinematics bat axis must be finite and non-zero',
    );
  }
  return scale(
    value,
    1 / length,
  );
};

const tangentProjection = (
  axis: Vec3,
  derivative: Vec3,
): Vec3 => subtract(
  derivative,
  scale(
    axis,
    dot(axis, derivative),
  ),
);

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  for (
    const component
    of [
      value.x,
      value.y,
      value.z,
    ]
  ) {
    if (!Number.isFinite(component)) {
      throw new Error(
        `${name} must contain only finite values`,
      );
    }
  }
};

const validateTrajectory = (
  trajectory:
    SwingKinematicsTrajectoryV1,
): void => {
  if (
    trajectory.version
    !== SWING_KINEMATICS_V1_VERSION
  ) {
    throw new Error(
      'unsupported swing kinematics trajectory version',
    );
  }
  if (
    !Number.isSafeInteger(
      trajectory.startTick,
    )
    || !Number.isSafeInteger(
      trajectory.contactTick,
    )
    || !Number.isSafeInteger(
      trajectory.endTick,
    )
    || trajectory.startTick
      >= trajectory.contactTick
    || trajectory.contactTick
      >= trajectory.endTick
  ) {
    throw new Error(
      'swing kinematics ticks must be safe integers with start < contact < end',
    );
  }
  if (
    !Number.isSafeInteger(
      trajectory.ticksPerSecond,
    )
    || trajectory.ticksPerSecond <= 0
  ) {
    throw new Error(
      'swing kinematics ticksPerSecond must be a positive safe integer',
    );
  }
  if (
    !Number.isFinite(
      trajectory.batLengthM,
    )
    || trajectory.batLengthM <= 0
  ) {
    throw new Error(
      'swing kinematics batLengthM must be finite and positive',
    );
  }
  if (
    !Number.isFinite(
      trajectory.sweetSpotT,
    )
    || trajectory.sweetSpotT <= 0
    || trajectory.sweetSpotT >= 1
  ) {
    throw new Error(
      'swing kinematics sweetSpotT must lie strictly within (0, 1)',
    );
  }

  for (
    const [
      name,
      knot,
    ]
    of [
      ['start', trajectory.start],
      ['contact', trajectory.contact],
      ['finish', trajectory.finish],
    ] as const
  ) {
    validateVec3(
      `${name}.sweetSpotPosition`,
      knot.sweetSpotPosition,
    );
    validateVec3(
      `${name}.sweetSpotVelocity`,
      knot.sweetSpotVelocity,
    );
    validateVec3(
      `${name}.batAxis`,
      knot.batAxis,
    );
    validateVec3(
      `${name}.batAxisDerivative`,
      knot.batAxisDerivative,
    );

    const axisLength =
      magnitude(knot.batAxis);
    if (
      Math.abs(axisLength - 1)
      > 1e-9
    ) {
      throw new Error(
        `${name}.batAxis must be normalized`,
      );
    }
    if (
      Math.abs(
        dot(
          knot.batAxis,
          knot.batAxisDerivative,
        ),
      ) > 1e-8
    ) {
      throw new Error(
        `${name}.batAxisDerivative must be tangent to batAxis`,
      );
    }
  }
};

const estimateEndpointAxisDerivative = (
  fromAxis: Vec3,
  toAxis: Vec3,
  durationSeconds: number,
  scaleFactor: number,
): Vec3 => {
  const raw = scale(
    subtract(
      toAxis,
      fromAxis,
    ),
    scaleFactor
      / durationSeconds,
  );
  return tangentProjection(
    fromAxis,
    raw,
  );
};

const estimateSharedContactAxisDerivative = (
  startAxis: Vec3,
  contactAxis: Vec3,
  finishAxis: Vec3,
  totalSeconds: number,
): Vec3 => {
  const raw = scale(
    subtract(
      finishAxis,
      startAxis,
    ),
    1 / totalSeconds,
  );
  return tangentProjection(
    contactAxis,
    raw,
  );
};

export const createSwingKinematicsTrajectoryV1 = (
  input:
    SwingKinematicsTrajectoryV1Input,
): SwingKinematicsTrajectoryV1 => {
  if (
    !Number.isSafeInteger(
      input.startTick,
    )
    || !Number.isSafeInteger(
      input.contactTick,
    )
    || !Number.isSafeInteger(
      input.endTick,
    )
    || input.startTick
      >= input.contactTick
    || input.contactTick
      >= input.endTick
  ) {
    throw new Error(
      'swing kinematics input ticks must satisfy start < contact < end',
    );
  }
  if (
    !Number.isSafeInteger(
      input.ticksPerSecond,
    )
    || input.ticksPerSecond <= 0
  ) {
    throw new Error(
      'swing kinematics input ticksPerSecond must be a positive safe integer',
    );
  }

  const startAxis =
    normalize(
      input.start.batAxis,
    );
  const contactAxis =
    normalize(
      input.contact.batAxis,
    );
  const finishAxis =
    normalize(
      input.finish.batAxis,
    );

  const preContactSeconds =
    (
      input.contactTick
      - input.startTick
    )
    / input.ticksPerSecond;
  const postContactSeconds =
    (
      input.endTick
      - input.contactTick
    )
    / input.ticksPerSecond;
  const totalSeconds =
    preContactSeconds
    + postContactSeconds;

  const contactAxisDerivative =
    estimateSharedContactAxisDerivative(
      startAxis,
      contactAxis,
      finishAxis,
      totalSeconds,
    );

  const trajectory:
    SwingKinematicsTrajectoryV1 = {
      version:
        SWING_KINEMATICS_V1_VERSION,
      startTick:
        input.startTick,
      contactTick:
        input.contactTick,
      endTick:
        input.endTick,
      ticksPerSecond:
        input.ticksPerSecond,
      batLengthM:
        input.batLengthM,
      sweetSpotT:
        input.sweetSpotT,
      start: {
        sweetSpotPosition:
          input.start.sweetSpotPosition,
        sweetSpotVelocity:
          input.start.sweetSpotVelocity,
        batAxis:
          startAxis,
        batAxisDerivative:
          estimateEndpointAxisDerivative(
            startAxis,
            contactAxis,
            preContactSeconds,
            0.45,
          ),
      },
      contact: {
        sweetSpotPosition:
          input.contact.sweetSpotPosition,
        sweetSpotVelocity:
          input.contact.sweetSpotVelocity,
        batAxis:
          contactAxis,
        batAxisDerivative:
          contactAxisDerivative,
      },
      finish: {
        sweetSpotPosition:
          input.finish.sweetSpotPosition,
        sweetSpotVelocity:
          input.finish.sweetSpotVelocity,
        batAxis:
          finishAxis,
        batAxisDerivative:
          estimateEndpointAxisDerivative(
            finishAxis,
            contactAxis,
            postContactSeconds,
            -0.35,
          ),
      },
    };

  validateTrajectory(
    trajectory,
  );
  return trajectory;
};

type HermiteSample = Readonly<{
  value: Vec3;
  derivativePerSecond: Vec3;
}>;

const sampleHermite = (
  startValue: Vec3,
  startDerivativePerSecond: Vec3,
  endValue: Vec3,
  endDerivativePerSecond: Vec3,
  durationSeconds: number,
  u: number,
): HermiteSample => {
  const clamped =
    Math.max(
      0,
      Math.min(1, u),
    );
  const u2 =
    clamped * clamped;
  const u3 =
    u2 * clamped;

  const h00 =
    2 * u3
    - 3 * u2
    + 1;
  const h10 =
    u3
    - 2 * u2
    + clamped;
  const h01 =
    -2 * u3
    + 3 * u2;
  const h11 =
    u3
    - u2;

  const value = add(
    add(
      scale(
        startValue,
        h00,
      ),
      scale(
        startDerivativePerSecond,
        h10 * durationSeconds,
      ),
    ),
    add(
      scale(
        endValue,
        h01,
      ),
      scale(
        endDerivativePerSecond,
        h11 * durationSeconds,
      ),
    ),
  );

  const dh00 =
    6 * u2
    - 6 * clamped;
  const dh10 =
    3 * u2
    - 4 * clamped
    + 1;
  const dh01 =
    -6 * u2
    + 6 * clamped;
  const dh11 =
    3 * u2
    - 2 * clamped;

  const derivativePerU = add(
    add(
      scale(
        startValue,
        dh00,
      ),
      scale(
        startDerivativePerSecond,
        dh10 * durationSeconds,
      ),
    ),
    add(
      scale(
        endValue,
        dh01,
      ),
      scale(
        endDerivativePerSecond,
        dh11 * durationSeconds,
      ),
    ),
  );

  return {
    value,
    derivativePerSecond:
      scale(
        derivativePerU,
        1 / durationSeconds,
      ),
  };
};

const normalizeWithDerivative = (
  value: Vec3,
  derivativePerSecond: Vec3,
): Readonly<{
  axis: Vec3;
  derivativePerSecond: Vec3;
}> => {
  const length =
    magnitude(value);
  if (
    !Number.isFinite(length)
    || length <= EPSILON
  ) {
    throw new Error(
      'swing kinematics interpolated bat axis collapsed to zero',
    );
  }

  const axis =
    scale(
      value,
      1 / length,
    );
  const tangent =
    subtract(
      derivativePerSecond,
      scale(
        axis,
        dot(
          axis,
          derivativePerSecond,
        ),
      ),
    );

  return {
    axis,
    derivativePerSecond:
      scale(
        tangent,
        1 / length,
      ),
  };
};

const sampleSegment = (
  start:
    SwingKinematicsKnotV1,
  end:
    SwingKinematicsKnotV1,
  startTick: number,
  endTick: number,
  sampleTick: number,
  ticksPerSecond: number,
): Readonly<{
  sweetSpotPosition: Vec3;
  sweetSpotVelocity: Vec3;
  batAxis: Vec3;
  batAxisDerivative: Vec3;
}> => {
  const durationTicks =
    endTick - startTick;
  const durationSeconds =
    durationTicks
    / ticksPerSecond;
  const u =
    (
      sampleTick - startTick
    )
    / durationTicks;

  const sweetSpot =
    sampleHermite(
      start.sweetSpotPosition,
      start.sweetSpotVelocity,
      end.sweetSpotPosition,
      end.sweetSpotVelocity,
      durationSeconds,
      u,
    );
  const axisRaw =
    sampleHermite(
      start.batAxis,
      start.batAxisDerivative,
      end.batAxis,
      end.batAxisDerivative,
      durationSeconds,
      u,
    );
  const axis =
    normalizeWithDerivative(
      axisRaw.value,
      axisRaw.derivativePerSecond,
    );

  return {
    sweetSpotPosition:
      sweetSpot.value,
    sweetSpotVelocity:
      sweetSpot
        .derivativePerSecond,
    batAxis:
      axis.axis,
    batAxisDerivative:
      axis.derivativePerSecond,
  };
};

export const sampleSwingKinematicsV1 = (
  trajectory:
    SwingKinematicsTrajectoryV1,
  tick: number,
): SwingKinematicsSampleV1 => {
  validateTrajectory(
    trajectory,
  );
  if (
    !Number.isSafeInteger(tick)
    || tick < trajectory.startTick
    || tick > trajectory.endTick
  ) {
    throw new Error(
      'swing kinematics sample tick must lie within the trajectory interval',
    );
  }

  const phase:
    SwingKinematicsPhaseV1 =
    tick < trajectory.contactTick
      ? 'pre_contact'
      : tick === trajectory.contactTick
        ? 'contact'
        : 'follow_through';

  const sampled =
    tick <= trajectory.contactTick
      ? sampleSegment(
          trajectory.start,
          trajectory.contact,
          trajectory.startTick,
          trajectory.contactTick,
          tick,
          trajectory.ticksPerSecond,
        )
      : sampleSegment(
          trajectory.contact,
          trajectory.finish,
          trajectory.contactTick,
          trajectory.endTick,
          tick,
          trajectory.ticksPerSecond,
        );

  const grip = subtract(
    sampled.sweetSpotPosition,
    scale(
      sampled.batAxis,
      trajectory.batLengthM
      * trajectory.sweetSpotT,
    ),
  );
  const tip = add(
    grip,
    scale(
      sampled.batAxis,
      trajectory.batLengthM,
    ),
  );
  const gripVelocity =
    subtract(
      sampled.sweetSpotVelocity,
      scale(
        sampled.batAxisDerivative,
        trajectory.batLengthM
        * trajectory.sweetSpotT,
      ),
    );

  /**
   * For a unit axis a and tangent derivative a_dot:
   * omega = a x a_dot
   * gives omega x a = a_dot.
   * v1 deliberately carries no axial roll component.
   */
  const angularVelocity =
    cross(
      sampled.batAxis,
      sampled.batAxisDerivative,
    );

  return {
    tick,
    phase,
    sweetSpotPosition:
      sampled.sweetSpotPosition,
    sweetSpotVelocity:
      sampled.sweetSpotVelocity,
    batAxis:
      sampled.batAxis,
    batAxisDerivative:
      sampled.batAxisDerivative,
    swingState: {
      pose: {
        grip,
        tip,
      },
      linearVelocity:
        gripVelocity,
      angularVelocity,
    },
  };
};

export const sampleSwingStateV1 = (
  trajectory:
    SwingKinematicsTrajectoryV1,
  tick: number,
): BatterSwingState => (
  sampleSwingKinematicsV1(
    trajectory,
    tick,
  ).swingState
);