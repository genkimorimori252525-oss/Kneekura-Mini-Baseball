import type {
  BaseTouchRegion,
} from '../running/BaseTouch';
import {
  findFirstTrueTick,
  quantizeEventTick,
} from '../ExactEventTime';
import {
  advanceBallState,
  DEFAULT_BALL_FLIGHT_PARAMETERS,
  type BallFlightParameters,
} from './BallFlight';
import type {
  BattedBallFlightEvidence,
} from './BattedBallFlightEvidence';
import type {
  BattedBallInitialState,
} from '../contact/BatBallContact';
import type { Vec3 } from '../../model/geometry';

export type BattedBallBasePrism = Readonly<{
  region: BaseTouchRegion;
  bottomY: number;
  topY: number;
}>;

export type RollingBattedBallBaseContactEvidence = Readonly<{
  base: 1 | 3;
  tick: number;
  rollingStartTick: number;
  travelDistanceMeters: number;
  continuousContactCenter: Vec3;
  authoritativeState: BattedBallInitialState;
}>;

export type RollingBattedBallBaseContactInput = Readonly<{
  flight: BattedBallFlightEvidence;
  base: 1 | 3;
  basePrism: BattedBallBasePrism;
  searchDurationTicks: number;
  parameters: BallFlightParameters;
}>;

const EPSILON = 1e-12;
const DISTANCE_TOLERANCE = 1e-10;

const validatePrism = (
  prism: BattedBallBasePrism,
): void => {
  const values = [
    prism.region.center.x,
    prism.region.center.z,
    prism.region.halfSize.x,
    prism.region.halfSize.z,
    prism.region.rotationRadians,
    prism.bottomY,
    prism.topY,
  ];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error(
      'base prism geometry must contain finite values',
    );
  }
  if (
    prism.region.halfSize.x <= 0
    || prism.region.halfSize.z <= 0
  ) {
    throw new Error(
      'base prism halfSize components must be positive',
    );
  }
  if (prism.topY <= prism.bottomY) {
    throw new Error(
      'base prism topY must be greater than bottomY',
    );
  }
};

const toLocal = (
  point: Readonly<{ x: number; z: number }>,
  base: BaseTouchRegion,
): Readonly<{ x: number; z: number }> => {
  const cosine = Math.cos(base.rotationRadians);
  const sine = Math.sin(base.rotationRadians);
  const dx = point.x - base.center.x;
  const dz = point.z - base.center.z;
  return {
    x: dx * cosine + dz * sine,
    z: -dx * sine + dz * cosine,
  };
};

const rotateVectorToLocal = (
  vector: Readonly<{ x: number; z: number }>,
  rotationRadians: number,
): Readonly<{ x: number; z: number }> => {
  const cosine = Math.cos(rotationRadians);
  const sine = Math.sin(rotationRadians);
  return {
    x: vector.x * cosine + vector.z * sine,
    z: -vector.x * sine + vector.z * cosine,
  };
};

const pointToRectangleDistanceSquared = (
  point: Readonly<{ x: number; z: number }>,
  halfSize: Readonly<{ x: number; z: number }>,
): number => {
  const dx = Math.max(
    Math.abs(point.x) - halfSize.x,
    0,
  );
  const dz = Math.max(
    Math.abs(point.z) - halfSize.z,
    0,
  );
  return dx * dx + dz * dz;
};

const firstPathDistanceToRoundedRectangle = (
  start: Readonly<{ x: number; z: number }>,
  direction: Readonly<{ x: number; z: number }>,
  halfSize: Readonly<{ x: number; z: number }>,
  radius: number,
  maxDistance: number,
): number | null => {
  const radiusSquared = radius * radius;
  const candidates: number[] = [0];

  const addCandidate = (distance: number): void => {
    if (
      !Number.isFinite(distance)
      || distance < -DISTANCE_TOLERANCE
      || distance > maxDistance + DISTANCE_TOLERANCE
    ) {
      return;
    }
    candidates.push(
      Math.max(0, Math.min(maxDistance, distance)),
    );
  };

  if (Math.abs(direction.x) > EPSILON) {
    for (const target of [
      halfSize.x + radius,
      -halfSize.x - radius,
    ]) {
      addCandidate(
        (target - start.x) / direction.x,
      );
    }
  }

  if (Math.abs(direction.z) > EPSILON) {
    for (const target of [
      halfSize.z + radius,
      -halfSize.z - radius,
    ]) {
      addCandidate(
        (target - start.z) / direction.z,
      );
    }
  }

  for (const cornerX of [
    -halfSize.x,
    halfSize.x,
  ]) {
    for (const cornerZ of [
      -halfSize.z,
      halfSize.z,
    ]) {
      const mx = start.x - cornerX;
      const mz = start.z - cornerZ;
      const b = 2 * (
        mx * direction.x
        + mz * direction.z
      );
      const c = (
        mx * mx
        + mz * mz
        - radiusSquared
      );
      const discriminant = b * b - 4 * c;
      if (discriminant < -EPSILON) {
        continue;
      }
      const root = Math.sqrt(
        Math.max(0, discriminant),
      );
      addCandidate((-b - root) / 2);
      addCandidate((-b + root) / 2);
    }
  }

  const ordered = [...candidates]
    .sort((first, second) => first - second);

  for (const distance of ordered) {
    const point = {
      x: start.x + direction.x * distance,
      z: start.z + direction.z * distance,
    };
    if (
      pointToRectangleDistanceSquared(
        point,
        halfSize,
      ) <= radiusSquared + DISTANCE_TOLERANCE
    ) {
      return distance;
    }
  }

  return null;
};

const rollingDistance = (
  speed: number,
  durationSeconds: number,
  deceleration: number,
): number => {
  if (speed <= EPSILON || durationSeconds <= 0) {
    return 0;
  }
  if (deceleration <= EPSILON) {
    return speed * durationSeconds;
  }
  const travelSeconds = Math.min(
    durationSeconds,
    speed / deceleration,
  );
  return (
    speed * travelSeconds
    - 0.5
      * deceleration
      * travelSeconds
      * travelSeconds
  );
};

const timeForRollingDistance = (
  speed: number,
  distance: number,
  deceleration: number,
): number | null => {
  if (distance <= DISTANCE_TOLERANCE) {
    return 0;
  }
  if (speed <= EPSILON) {
    return null;
  }
  if (deceleration <= EPSILON) {
    return distance / speed;
  }

  const discriminant = (
    speed * speed
    - 2 * deceleration * distance
  );
  if (discriminant < -DISTANCE_TOLERANCE) {
    return null;
  }
  return (
    speed - Math.sqrt(Math.max(0, discriminant))
  ) / deceleration;
};

const rollingDeceleration = (
  parameters: BallFlightParameters,
): number => (
  parameters.groundRollingDecelerationMps2
  ?? DEFAULT_BALL_FLIGHT_PARAMETERS.groundRollingDecelerationMps2
  ?? 0
);

const findRollingStartTick = (
  flight: BattedBallFlightEvidence,
  endTick: number,
  parameters: BallFlightParameters,
): number | null => {
  if (flight.firstGroundContact === null) {
    throw new Error(
      'rolling base-contact search requires first-ground contact evidence',
    );
  }

  const startTick = flight.firstGroundContact.tick;
  return findFirstTrueTick(
    startTick,
    endTick,
    (tick) => {
      const state = advanceBallState(
        flight.initialBall,
        tick - flight.initialBall.tick,
        parameters,
      );
      return (
        state.position.y
          <= parameters.ballRadius + EPSILON
        && Math.abs(state.velocity.y) <= EPSILON
      );
    },
  );
};

export const findFirstRollingBattedBallBaseContact = (
  input: RollingBattedBallBaseContactInput,
): RollingBattedBallBaseContactEvidence | null => {
  validatePrism(input.basePrism);

  if (
    !Number.isInteger(input.searchDurationTicks)
    || input.searchDurationTicks < 0
  ) {
    throw new Error(
      'searchDurationTicks must be a non-negative integer',
    );
  }
  if (
    !Number.isFinite(input.flight.ballRadiusMeters)
    || input.flight.ballRadiusMeters <= 0
  ) {
    throw new Error(
      'ballRadiusMeters must be finite and positive',
    );
  }

  const firstGround = input.flight.firstGroundContact;
  if (firstGround === null) {
    throw new Error(
      'rolling base-contact search requires first-ground contact evidence',
    );
  }

  const searchEndTick = (
    firstGround.tick
    + input.searchDurationTicks
  );
  if (!Number.isSafeInteger(searchEndTick)) {
    throw new Error(
      'rolling base-contact search end tick must be a safe integer',
    );
  }

  const rollingStartTick = findRollingStartTick(
    input.flight,
    searchEndTick,
    input.parameters,
  );
  if (rollingStartTick === null) {
    return null;
  }

  const rollingState = advanceBallState(
    input.flight.initialBall,
    rollingStartTick
      - input.flight.initialBall.tick,
    input.parameters,
  );

  const radius = input.flight.ballRadiusMeters;
  const ballBottom = rollingState.position.y - radius;
  const ballTop = rollingState.position.y + radius;
  if (
    ballTop < input.basePrism.bottomY - EPSILON
    || ballBottom > input.basePrism.topY + EPSILON
  ) {
    return null;
  }

  const speed = Math.hypot(
    rollingState.velocity.x,
    rollingState.velocity.z,
  );

  const worldDirection = speed <= EPSILON
    ? { x: 0, z: 0 }
    : {
        x: rollingState.velocity.x / speed,
        z: rollingState.velocity.z / speed,
      };

  const localStart = toLocal(
    {
      x: rollingState.position.x,
      z: rollingState.position.z,
    },
    input.basePrism.region,
  );
  const localDirection = rotateVectorToLocal(
    worldDirection,
    input.basePrism.region.rotationRadians,
  );

  const durationSeconds = (
    searchEndTick - rollingStartTick
  ) / input.parameters.ticksPerSecond;
  const deceleration = rollingDeceleration(
    input.parameters,
  );
  const maxDistance = rollingDistance(
    speed,
    durationSeconds,
    deceleration,
  );

  const travelDistanceMeters =
    firstPathDistanceToRoundedRectangle(
      localStart,
      localDirection,
      input.basePrism.region.halfSize,
      radius,
      maxDistance,
    );

  if (travelDistanceMeters === null) {
    return null;
  }

  const elapsedSeconds = timeForRollingDistance(
    speed,
    travelDistanceMeters,
    deceleration,
  );
  if (elapsedSeconds === null) {
    return null;
  }

  const tick = quantizeEventTick(
    rollingStartTick,
    elapsedSeconds,
    input.parameters.ticksPerSecond,
  );
  if (tick > searchEndTick) {
    return null;
  }

  return {
    base: input.base,
    tick,
    rollingStartTick,
    travelDistanceMeters,
    continuousContactCenter: {
      x: rollingState.position.x
        + worldDirection.x * travelDistanceMeters,
      y: rollingState.position.y,
      z: rollingState.position.z
        + worldDirection.z * travelDistanceMeters,
    },
    authoritativeState: advanceBallState(
      input.flight.initialBall,
      tick - input.flight.initialBall.tick,
      input.parameters,
    ),
  };
};
