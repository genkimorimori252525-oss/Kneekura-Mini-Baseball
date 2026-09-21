import type { Vec3 } from '../../model/geometry';
import { findFirstTrueTick } from '../ExactEventTime';
import type {
  BattedBallInitialState,
} from '../contact/BatBallContact';
import type {
  RigidBaseballProperties,
} from '../contact/RigidBatBallContact';
import {
  sampleUninterruptedBallFreeFlight,
  type BallFlightParameters,
} from './BallFlight';
import {
  resolveBallSurfaceContact,
  type BallSurfaceContactParameters,
  type BallSurfaceContactResult,
} from './BallSurfaceContact';
import {
  resolveBallSurfaceMaterialContact,
  type BallSurfaceMaterialProfile,
} from './BallSurfaceMaterial';

export type PlanarBallSurface = Readonly<{
  point: Vec3;
  /**
   * Points from the material surface toward the ball's allowed/playable
   * half-space.
   */
  normal: Vec3;
}>;

export type PlanarBallSurfaceImpact = Readonly<{
  tick: number;
  centerAtContact: Vec3;
  preImpactState: BattedBallInitialState;
  contact: BallSurfaceContactResult;
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
  a.x * b.x
  + a.y * b.y
  + a.z * b.z;

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
      'planar surface normal must have finite non-zero length',
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

export const measureSpherePlanarSurfaceSeparation = (
  center: Vec3,
  ballRadiusM: number,
  surface: PlanarBallSurface,
): number => {
  validateVec3(
    'sphere center',
    center,
  );
  validateVec3(
    'surface point',
    surface.point,
  );
  const normal = normalize(
    surface.normal,
  );
  if (
    !Number.isFinite(ballRadiusM)
    || ballRadiusM <= 0
  ) {
    throw new Error(
      'sphere radius must be finite and positive',
    );
  }

  return dot(
    subtract(
      center,
      surface.point,
    ),
    normal,
  ) - ballRadiusM;
};

export const findPlanarBallSurfaceContactTick = (
  state: BattedBallInitialState,
  deltaTicks: number,
  parameters: BallFlightParameters,
  ballRadiusM: number,
  surface: PlanarBallSurface,
): number | null => {
  if (
    !Number.isSafeInteger(deltaTicks)
    || deltaTicks < 0
  ) {
    throw new Error(
      'planar surface deltaTicks must be a non-negative safe integer',
    );
  }
  const normal = normalize(
    surface.normal,
  );
  const startSeparation =
    measureSpherePlanarSurfaceSeparation(
      state.position,
      ballRadiusM,
      surface,
    );

  if (startSeparation < -EPSILON) {
    return state.tick;
  }
  if (
    Math.abs(startSeparation)
      <= EPSILON
  ) {
    return dot(
      state.velocity,
      normal,
    ) < 0
      ? state.tick
      : null;
  }
  if (deltaTicks === 0) {
    return null;
  }

  const end =
    sampleUninterruptedBallFreeFlight(
      state,
      deltaTicks,
      parameters,
    );
  if (
    measureSpherePlanarSurfaceSeparation(
      end.position,
      ballRadiusM,
      surface,
    ) > 0
  ) {
    return null;
  }

  return findFirstTrueTick(
    state.tick,
    state.tick + deltaTicks,
    (tick) => (
      measureSpherePlanarSurfaceSeparation(
        sampleUninterruptedBallFreeFlight(
          state,
          tick - state.tick,
          parameters,
        ).position,
        ballRadiusM,
        surface,
      ) <= 0
    ),
  );
};

export const resolvePlanarBallSurfaceImpact = (
  state: BattedBallInitialState,
  deltaTicks: number,
  flightParameters: BallFlightParameters,
  ball: RigidBaseballProperties,
  surface: PlanarBallSurface,
  contactParameters: BallSurfaceContactParameters,
): PlanarBallSurfaceImpact | null => {
  const normal = normalize(
    surface.normal,
  );
  const contactTick =
    findPlanarBallSurfaceContactTick(
      state,
      deltaTicks,
      flightParameters,
      ball.radiusM,
      surface,
    );
  if (contactTick === null) {
    return null;
  }

  const preImpactState =
    sampleUninterruptedBallFreeFlight(
      state,
      contactTick - state.tick,
      flightParameters,
    );

  const separation =
    measureSpherePlanarSurfaceSeparation(
      preImpactState.position,
      ball.radiusM,
      surface,
    );
  const centerAtContact = add(
    preImpactState.position,
    scale(
      normal,
      -separation,
    ),
  );

  const contact =
    resolveBallSurfaceContact({
      tick: contactTick,
      ballCenter:
        centerAtContact,
      ballVelocity:
        preImpactState.velocity,
      ballSpin:
        preImpactState.spin,
      ball,
      surfaceNormal: normal,
      parameters:
        contactParameters,
    });

  if (contact === null) {
    return null;
  }

  return {
    tick: contactTick,
    centerAtContact,
    preImpactState: {
      ...preImpactState,
      position: centerAtContact,
    },
    contact,
  };
};


export const resolvePlanarBallSurfaceMaterialImpact = (
  state: BattedBallInitialState,
  deltaTicks: number,
  flightParameters: BallFlightParameters,
  ball: RigidBaseballProperties,
  surface: PlanarBallSurface,
  material: BallSurfaceMaterialProfile,
): PlanarBallSurfaceImpact | null => {
  const contactTick =
    findPlanarBallSurfaceContactTick(
      state,
      deltaTicks,
      flightParameters,
      ball.radiusM,
      surface,
    );
  if (contactTick === null) {
    return null;
  }

  const preImpactState =
    sampleUninterruptedBallFreeFlight(
      state,
      contactTick - state.tick,
      flightParameters,
    );

  const materialContact =
    resolveBallSurfaceMaterialContact(
      material,
      preImpactState.velocity,
      surface.normal,
    );

  return resolvePlanarBallSurfaceImpact(
    state,
    deltaTicks,
    flightParameters,
    ball,
    surface,
    materialContact,
  );
};
