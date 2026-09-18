import type { Vec2 } from '../../model/geometry';
import { quantizeEventTick } from '../ExactEventTime';
import type { RunnerMotionState } from './RunnerMotion';
import {
  getRunnerRouteLength,
  sampleRunnerRoute,
  type RunnerRoute,
} from './RunnerRoute';

export type SwingExitBodyState = Readonly<{
  tick: number;
  planarVelocity: Vec2;
  bodyForwardUnit: Vec2;
}>;

export type BatterSwingExitRunTransitionParameters = Readonly<{
  ticksPerSecond: number;
  maximumBodyTurnRateRadiansPerSecond: number;
  lateralVelocityDampingMps2: number;
  backwardVelocityBrakingMps2: number;
}>;

export type BatterSwingExitRunTransitionResult = Readonly<{
  launchTick: number;
  launchRouteDistanceMeters: number;
  initialRouteSpeedMps: number;
  requiredTurnRadians: number;
  turnRecoverySeconds: number;
  lateralRecoverySeconds: number;
  backwardRecoverySeconds: number;
  recoverySeconds: number;
}>;

const EPSILON = 1e-12;
const UNIT_TOLERANCE = 1e-9;

const validateVec2 = (
  name: string,
  value: Vec2,
): void => {
  if (!Number.isFinite(value.x) || !Number.isFinite(value.z)) {
    throw new Error(`${name} coordinates must be finite`);
  }
};

const magnitude = (value: Vec2): number => Math.hypot(
  value.x,
  value.z,
);

const dot = (first: Vec2, second: Vec2): number => (
  first.x * second.x + first.z * second.z
);

const crossScalar = (first: Vec2, second: Vec2): number => (
  first.x * second.z - first.z * second.x
);

const clamp = (
  value: number,
  minimum: number,
  maximum: number,
): number => Math.max(minimum, Math.min(maximum, value));

const validateBodyState = (
  state: SwingExitBodyState,
): void => {
  if (!Number.isSafeInteger(state.tick) || state.tick < 0) {
    throw new Error(
      'swing-exit tick must be a non-negative safe integer',
    );
  }
  validateVec2('planarVelocity', state.planarVelocity);
  validateVec2('bodyForwardUnit', state.bodyForwardUnit);
  if (
    Math.abs(magnitude(state.bodyForwardUnit) - 1)
    > UNIT_TOLERANCE
  ) {
    throw new Error('bodyForwardUnit must be a unit vector');
  }
};

const validateParameters = (
  parameters: BatterSwingExitRunTransitionParameters,
): void => {
  if (
    !Number.isSafeInteger(parameters.ticksPerSecond)
    || parameters.ticksPerSecond <= 0
  ) {
    throw new Error(
      'ticksPerSecond must be a positive safe integer',
    );
  }

  for (const [name, value] of [
    [
      'maximumBodyTurnRateRadiansPerSecond',
      parameters.maximumBodyTurnRateRadiansPerSecond,
    ],
    [
      'lateralVelocityDampingMps2',
      parameters.lateralVelocityDampingMps2,
    ],
    [
      'backwardVelocityBrakingMps2',
      parameters.backwardVelocityBrakingMps2,
    ],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be finite and positive`);
    }
  }
};

const canonicalZero = (value: number): number => (
  Math.abs(value) <= EPSILON ? 0 : value
);

export const resolveBatterSwingExitRunTransition = (
  state: SwingExitBodyState,
  route: RunnerRoute,
  parameters: BatterSwingExitRunTransitionParameters,
): BatterSwingExitRunTransitionResult => {
  validateBodyState(state);
  validateParameters(parameters);

  const routeLength = getRunnerRouteLength(route);
  const routeTangent = sampleRunnerRoute(route, 0).tangent;

  const forwardVelocityMps = dot(
    state.planarVelocity,
    routeTangent,
  );
  const lateralVelocityMps = Math.abs(
    crossScalar(routeTangent, state.planarVelocity),
  );
  const backwardVelocityMps = Math.max(
    0,
    -forwardVelocityMps,
  );

  const facingDot = clamp(
    dot(state.bodyForwardUnit, routeTangent),
    -1,
    1,
  );
  const requiredTurnRadians = canonicalZero(
    Math.acos(facingDot),
  );

  const turnRecoverySeconds = (
    requiredTurnRadians
    / parameters.maximumBodyTurnRateRadiansPerSecond
  );
  const lateralRecoverySeconds = (
    lateralVelocityMps
    / parameters.lateralVelocityDampingMps2
  );
  const backwardRecoverySeconds = (
    backwardVelocityMps
    / parameters.backwardVelocityBrakingMps2
  );
  const recoverySeconds = Math.max(
    turnRecoverySeconds,
    lateralRecoverySeconds,
    backwardRecoverySeconds,
  );

  const initialRouteSpeedMps = canonicalZero(
    Math.max(0, forwardVelocityMps),
  );
  const launchRouteDistanceMeters = canonicalZero(
    initialRouteSpeedMps * recoverySeconds,
  );

  if (
    launchRouteDistanceMeters - routeLength > EPSILON
  ) {
    throw new Error(
      'swing-exit recovery progress exceeds the finite runner route',
    );
  }

  return {
    launchTick: quantizeEventTick(
      state.tick,
      recoverySeconds,
      parameters.ticksPerSecond,
    ),
    launchRouteDistanceMeters,
    initialRouteSpeedMps,
    requiredTurnRadians,
    turnRecoverySeconds,
    lateralRecoverySeconds,
    backwardRecoverySeconds,
    recoverySeconds,
  };
};

export const resolveBatterSwingExitRunTransitionAfterContact = (
  contactTick: number,
  state: SwingExitBodyState,
  route: RunnerRoute,
  parameters: BatterSwingExitRunTransitionParameters,
): BatterSwingExitRunTransitionResult => {
  if (!Number.isSafeInteger(contactTick) || contactTick < 0) {
    throw new Error(
      'contactTick must be a non-negative safe integer',
    );
  }
  if (state.tick < contactTick) {
    throw new Error(
      'swing-exit body state must not precede bat-ball contact',
    );
  }

  return resolveBatterSwingExitRunTransition(
    state,
    route,
    parameters,
  );
};

export const createRunnerMotionStateFromSwingExitTransition = (
  transition: BatterSwingExitRunTransitionResult,
): RunnerMotionState => ({
  tick: transition.launchTick,
  routeDistanceMeters: transition.launchRouteDistanceMeters,
  speedMps: transition.initialRouteSpeedMps,
  driveDirection: 0,
  bodyMode: 'upright',
});
