import type { BaserunnerWorldState } from '../../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../../model/geometry';
import {
  buildRunnerMotionTrajectory,
  sampleRunnerMotionTrajectory,
  type RunnerBodyMode,
  type RunnerMotionIntent,
  type RunnerMotionParameters,
  type RunnerMotionState,
  type RunnerMotionTrajectory,
} from './RunnerMotion';
import type { RunnerRoute } from './RunnerRoute';
import { projectRunnerWorldState } from './RunnerWorldProjection';

export type CanonicalRunnerKinematics = Readonly<{
  playerId: string;
  tick: number;
  position: Vec2;
  velocity: Vec2;
  bodyMode: RunnerBodyMode;
  motionRevision: number;
}>;

export type RunnerControllerBasis = Readonly<{
  playerId: string;
  tick: number;
  motionRevision: number;
  position: Vec2;
  velocity: Vec2;
}>;

export type RouteFollowingController = Readonly<{
  kind: 'route_following';
  basis: RunnerControllerBasis;
  route: RunnerRoute;
  trajectory: RunnerMotionTrajectory;
}>;

export type RouteFollowingControllerInput = Readonly<{
  canonical: CanonicalRunnerKinematics;
  startMotion: RunnerMotionState;
  route: RunnerRoute;
  intent: RunnerMotionIntent;
  parameters: RunnerMotionParameters;
  endTick: number;
}>;

const KINEMATICS_TOLERANCE = 1e-9;

const validateVec2 = (name: string, value: Vec2): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(name + ' must be finite');
  }
};

const validateRevision = (motionRevision: number): void => {
  if (!Number.isSafeInteger(motionRevision) || motionRevision < 0) {
    throw new Error('motionRevision must be a non-negative safe integer');
  }
};

const validateCanonicalRunnerKinematics = (
  canonical: CanonicalRunnerKinematics,
): void => {
  if (canonical.playerId.length === 0) {
    throw new Error('canonical runner playerId must not be empty');
  }
  if (!Number.isSafeInteger(canonical.tick) || canonical.tick < 0) {
    throw new Error('canonical runner tick must be a non-negative safe integer');
  }
  validateVec2('canonical runner position', canonical.position);
  validateVec2('canonical runner velocity', canonical.velocity);
  validateRevision(canonical.motionRevision);
  if (canonical.bodyMode !== 'upright' && canonical.bodyMode !== 'sliding') {
    throw new Error("canonical runner bodyMode must be 'upright' or 'sliding'");
  }
};

const vec2Matches = (first: Vec2, second: Vec2): boolean => (
  Math.abs(first.x - second.x) <= KINEMATICS_TOLERANCE
  && Math.abs(first.z - second.z) <= KINEMATICS_TOLERANCE
);

const worldMatchesCanonical = (
  world: BaserunnerWorldState,
  canonical: CanonicalRunnerKinematics,
): boolean => (
  world.playerId === canonical.playerId
  && vec2Matches(world.position, canonical.position)
  && vec2Matches(world.velocity, canonical.velocity)
);

export const createRunnerControllerBasis = (
  canonical: CanonicalRunnerKinematics,
): RunnerControllerBasis => {
  validateCanonicalRunnerKinematics(canonical);
  return {
    playerId: canonical.playerId,
    tick: canonical.tick,
    motionRevision: canonical.motionRevision,
    position: { ...canonical.position },
    velocity: { ...canonical.velocity },
  };
};

export const assertRunnerControllerBasisMatches = (
  basis: RunnerControllerBasis,
  canonical: CanonicalRunnerKinematics,
): void => {
  validateCanonicalRunnerKinematics(canonical);
  if (basis.playerId !== canonical.playerId) {
    throw new Error('runner controller basis playerId does not match canonical runner');
  }
  if (basis.tick !== canonical.tick) {
    throw new Error('runner controller basis tick does not match canonical runner');
  }
  if (basis.motionRevision !== canonical.motionRevision) {
    throw new Error('runner controller basis motionRevision does not match canonical runner');
  }
  if (!vec2Matches(basis.position, canonical.position)) {
    throw new Error('runner controller basis position does not match canonical runner');
  }
  if (!vec2Matches(basis.velocity, canonical.velocity)) {
    throw new Error('runner controller basis velocity does not match canonical runner');
  }
};

export const createCanonicalRunnerKinematicsFromRouteMotion = (
  playerId: string,
  motion: RunnerMotionState,
  route: RunnerRoute,
  motionRevision: number,
): CanonicalRunnerKinematics => {
  if (playerId.length === 0) {
    throw new Error('canonical runner playerId must not be empty');
  }
  if (!Number.isSafeInteger(motion.tick) || motion.tick < 0) {
    throw new Error('runner motion tick must be a non-negative safe integer');
  }
  validateRevision(motionRevision);

  const world = projectRunnerWorldState(playerId, motion, route);
  const canonical: CanonicalRunnerKinematics = {
    playerId,
    tick: motion.tick,
    position: world.position,
    velocity: world.velocity,
    bodyMode: motion.bodyMode,
    motionRevision,
  };
  validateCanonicalRunnerKinematics(canonical);
  return canonical;
};

export const buildRouteFollowingController = (
  input: RouteFollowingControllerInput,
): RouteFollowingController => {
  validateCanonicalRunnerKinematics(input.canonical);
  if (!Number.isSafeInteger(input.endTick) || input.endTick < input.canonical.tick) {
    throw new Error(
      'route-following controller endTick must be a safe integer at or after the canonical tick',
    );
  }
  if (input.startMotion.tick !== input.canonical.tick) {
    throw new Error(
      'route-following controller motion tick must match the canonical runner tick',
    );
  }
  if (input.startMotion.bodyMode !== input.canonical.bodyMode) {
    throw new Error(
      'route-following controller bodyMode must match the canonical runner bodyMode',
    );
  }

  const startWorld = projectRunnerWorldState(
    input.canonical.playerId,
    input.startMotion,
    input.route,
  );
  if (!worldMatchesCanonical(startWorld, input.canonical)) {
    throw new Error(
      'route-following controller start must match canonical runner position and velocity',
    );
  }

  return {
    kind: 'route_following',
    basis: createRunnerControllerBasis(input.canonical),
    route: input.route,
    trajectory: buildRunnerMotionTrajectory(
      input.startMotion,
      input.intent,
      input.endTick - input.canonical.tick,
      input.parameters,
    ),
  };
};

export const sampleRouteFollowingController = (
  controller: RouteFollowingController,
  authoritativeBasis: CanonicalRunnerKinematics,
  tick: number,
): CanonicalRunnerKinematics => {
  assertRunnerControllerBasisMatches(controller.basis, authoritativeBasis);
  const motion = sampleRunnerMotionTrajectory(controller.trajectory, tick);
  const world = projectRunnerWorldState(
    controller.basis.playerId,
    motion,
    controller.route,
  );
  return {
    playerId: controller.basis.playerId,
    tick,
    position: world.position,
    velocity: world.velocity,
    bodyMode: motion.bodyMode,
    motionRevision: controller.basis.motionRevision,
  };
};