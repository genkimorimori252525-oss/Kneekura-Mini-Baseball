import type { Vec3 } from '../../model/geometry';
import {
  createGloveContactInputFromDefenderPrimitive,
} from './DefenderPhysicalContactAdapters';
import type {
  DefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import {
  findAcceleratedGloveBallContactTick,
  type GloveWorldState,
  type LiveBallState,
} from './GloveBallContact';
import type {
  CatchRetentionContact,
} from './CatchRetention';

export type AcceleratedThrowReceptionInput = Readonly<{
  ball: LiveBallState;
  ballAcceleration: Vec3;
  glovePrimitive: DefenderPhysicalPrimitiveSegment;
  ballRadiusMeters: number;
  pocketOffsetMeters: number;
  bodyStability: number;
}>;

const validateVec3 = (
  name: string,
  value: Vec3,
): void => {
  if (
    !Number.isFinite(value.x)
    || !Number.isFinite(value.y)
    || !Number.isFinite(value.z)
  ) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const sampleAcceleratedVec3 = (
  position: Vec3,
  velocity: Vec3,
  acceleration: Vec3,
  elapsedSeconds: number,
): Readonly<{
  position: Vec3;
  velocity: Vec3;
}> => ({
  position: {
    x: (
      position.x
      + velocity.x * elapsedSeconds
      + 0.5 * acceleration.x
        * elapsedSeconds * elapsedSeconds
    ),
    y: (
      position.y
      + velocity.y * elapsedSeconds
      + 0.5 * acceleration.y
        * elapsedSeconds * elapsedSeconds
    ),
    z: (
      position.z
      + velocity.z * elapsedSeconds
      + 0.5 * acceleration.z
        * elapsedSeconds * elapsedSeconds
    ),
  },
  velocity: {
    x: velocity.x + acceleration.x * elapsedSeconds,
    y: velocity.y + acceleration.y * elapsedSeconds,
    z: velocity.z + acceleration.z * elapsedSeconds,
  },
});

const normalize = (
  value: Vec3,
): Vec3 => {
  const length = Math.hypot(
    value.x,
    value.y,
    value.z,
  );
  if (!Number.isFinite(length) || length <= 0) {
    throw new Error(
      'glove-ball contact normal requires distinct sampled centers',
    );
  }
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
};

export const createCatchRetentionContactFromAcceleratedReception = (
  input: AcceleratedThrowReceptionInput,
): CatchRetentionContact | null => {
  if (input.glovePrimitive.role !== 'glove') {
    throw new Error(
      "throw reception contact requires a 'glove' primitive",
    );
  }
  validateVec3('ballAcceleration', input.ballAcceleration);
  if (
    !Number.isFinite(input.ballRadiusMeters)
    || input.ballRadiusMeters <= 0
  ) {
    throw new Error(
      'ballRadiusMeters must be finite and positive',
    );
  }
  if (
    !Number.isFinite(input.pocketOffsetMeters)
    || input.pocketOffsetMeters < 0
  ) {
    throw new Error(
      'pocketOffsetMeters must be finite and non-negative',
    );
  }
  if (
    !Number.isFinite(input.bodyStability)
    || input.bodyStability < 0
    || input.bodyStability > 1
  ) {
    throw new Error(
      'bodyStability must be a finite number in [0, 1]',
    );
  }

  const gloveInput =
    createGloveContactInputFromDefenderPrimitive(
      input.glovePrimitive,
    );
  if (input.ball.tick !== gloveInput.glove.tick) {
    throw new Error(
      'ball and glove reception window must share the same start tick',
    );
  }

  const contactTick = findAcceleratedGloveBallContactTick(
    input.ball,
    input.ballAcceleration,
    gloveInput.glove,
    gloveInput.acceleration,
    gloveInput.deltaTicks,
    {
      ticksPerSecond: input.glovePrimitive.ticksPerSecond,
      ballRadius: input.ballRadiusMeters,
      gloveContactRadius: input.glovePrimitive.radius,
    },
  );
  if (contactTick === null) {
    return null;
  }

  const elapsedSeconds = (
    contactTick - input.ball.tick
  ) / input.glovePrimitive.ticksPerSecond;
  const ballSample = sampleAcceleratedVec3(
    input.ball.position,
    input.ball.velocity,
    input.ballAcceleration,
    elapsedSeconds,
  );
  const gloveSample = sampleAcceleratedVec3(
    gloveInput.glove.position,
    gloveInput.glove.velocity,
    gloveInput.acceleration,
    elapsedSeconds,
  );

  const ball: LiveBallState = {
    tick: contactTick,
    position: ballSample.position,
    velocity: ballSample.velocity,
    spin: input.ball.spin,
  };
  const glove: GloveWorldState = {
    tick: contactTick,
    position: gloveSample.position,
    velocity: gloveSample.velocity,
  };
  const contactNormal = normalize({
    x: ball.position.x - glove.position.x,
    y: ball.position.y - glove.position.y,
    z: ball.position.z - glove.position.z,
  });

  return {
    contactTick,
    ball,
    glove,
    contactNormal,
    pocketOffsetMeters: input.pocketOffsetMeters,
    bodyStability: input.bodyStability,
  };
};
