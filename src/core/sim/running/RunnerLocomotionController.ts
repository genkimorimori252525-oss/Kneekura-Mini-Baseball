import type { BaserunnerWorldState } from '../../model/CanonicalWorldSnapshot';
import type { Vec2 } from '../../model/geometry';
import type { BaseTouchRegion } from './BaseTouch';
import type { RunnerBodyContactParameters } from './RunnerBodyContact';
import { findRunnerBaseTouchTickOnTrajectory } from './RunnerBaseTouch';
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

export type WorldTransitionContinuity = 'continuous' | 'discontinuous';

export type WorldTransitionProvenance =
  | 'physical_engine'
  | 'rule_system'
  | 'debug_test';

export type RunnerRebaseScope = 'production' | 'debug_test';

export type RunnerRebaseRequest = Readonly<{
  position: Vec2;
  velocity: Vec2;
  bodyMode: RunnerBodyMode;
  continuity: WorldTransitionContinuity;
  provenance: WorldTransitionProvenance;
  scope: RunnerRebaseScope;
}>;

export type RunnerRebaseFact = Readonly<{
  playerId: string;
  tick: number;
  continuity: WorldTransitionContinuity;
  provenance: WorldTransitionProvenance;
  fromMotionRevision: number;
  toMotionRevision: number;
}>;

export type RunnerRebaseResult = Readonly<{
  previous: CanonicalRunnerKinematics;
  current: CanonicalRunnerKinematics;
  fact: RunnerRebaseFact;
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

const validateBodyMode = (bodyMode: RunnerBodyMode): void => {
  if (bodyMode !== 'upright' && bodyMode !== 'sliding') {
    throw new Error("runner bodyMode must be 'upright' or 'sliding'");
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
  validateBodyMode(canonical.bodyMode);
};

const validateRebaseRequest = (request: RunnerRebaseRequest): void => {
  validateVec2('runner rebase position', request.position);
  validateVec2('runner rebase velocity', request.velocity);
  validateBodyMode(request.bodyMode);
  if (request.continuity !== 'continuous' && request.continuity !== 'discontinuous') {
    throw new Error('runner rebase continuity is not recognized');
  }
  if (
    request.provenance !== 'physical_engine'
    && request.provenance !== 'rule_system'
    && request.provenance !== 'debug_test'
  ) {
    throw new Error('runner rebase provenance is not recognized');
  }
  if (request.scope !== 'production' && request.scope !== 'debug_test') {
    throw new Error('runner rebase scope is not recognized');
  }
  if (request.scope === 'production' && request.provenance === 'debug_test') {
    throw new Error('debug_test runner rebase is not permitted in production');
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

const sampleControllerWithoutAuthorityCheck = (
  controller: RouteFollowingController,
  tick: number,
): CanonicalRunnerKinematics => {
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

export const assertRouteFollowingControllerAuthority = (
  controller: RouteFollowingController,
  canonical: CanonicalRunnerKinematics,
): void => {
  validateCanonicalRunnerKinematics(canonical);
  if (controller.basis.playerId !== canonical.playerId) {
    throw new Error('route-following controller playerId does not match canonical runner');
  }
  if (controller.basis.motionRevision !== canonical.motionRevision) {
    throw new Error(
      'route-following controller motionRevision does not match canonical runner',
    );
  }
  if (
    canonical.tick < controller.trajectory.startTick
    || canonical.tick > controller.trajectory.endState.tick
  ) {
    throw new Error(
      'canonical runner tick lies outside the route-following controller interval',
    );
  }
  const expected = sampleControllerWithoutAuthorityCheck(controller, canonical.tick);
  if (!vec2Matches(expected.position, canonical.position)) {
    throw new Error(
      'route-following controller position does not match canonical runner at its authoritative tick',
    );
  }
  if (!vec2Matches(expected.velocity, canonical.velocity)) {
    throw new Error(
      'route-following controller velocity does not match canonical runner at its authoritative tick',
    );
  }
  if (expected.bodyMode !== canonical.bodyMode) {
    throw new Error(
      'route-following controller bodyMode does not match canonical runner at its authoritative tick',
    );
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
  authoritativeState: CanonicalRunnerKinematics,
  tick: number,
): CanonicalRunnerKinematics => {
  assertRouteFollowingControllerAuthority(controller, authoritativeState);
  if (tick < authoritativeState.tick) {
    throw new Error(
      'route-following controller sample tick must not precede the authoritative canonical tick',
    );
  }
  return sampleControllerWithoutAuthorityCheck(controller, tick);
};

export const findRouteFollowingControllerBaseTouchTick = (
  controller: RouteFollowingController,
  authoritativeState: CanonicalRunnerKinematics,
  base: BaseTouchRegion,
  bodyParameters: RunnerBodyContactParameters,
): number | null => {
  assertRouteFollowingControllerAuthority(controller, authoritativeState);
  return findRunnerBaseTouchTickOnTrajectory(
    controller.trajectory,
    controller.route,
    base,
    bodyParameters,
  );
};

export const rebaseCanonicalRunnerKinematics = (
  current: CanonicalRunnerKinematics,
  request: RunnerRebaseRequest,
): RunnerRebaseResult => {
  validateCanonicalRunnerKinematics(current);
  validateRebaseRequest(request);
  if (current.motionRevision === Number.MAX_SAFE_INTEGER) {
    throw new Error('runner motionRevision cannot be incremented safely');
  }

  const nextRevision = current.motionRevision + 1;
  const rebased: CanonicalRunnerKinematics = {
    playerId: current.playerId,
    tick: current.tick,
    position: { ...request.position },
    velocity: { ...request.velocity },
    bodyMode: request.bodyMode,
    motionRevision: nextRevision,
  };
  validateCanonicalRunnerKinematics(rebased);

  return {
    previous: current,
    current: rebased,
    fact: {
      playerId: current.playerId,
      tick: current.tick,
      continuity: request.continuity,
      provenance: request.provenance,
      fromMotionRevision: current.motionRevision,
      toMotionRevision: nextRevision,
    },
  };
};