import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import {
  advanceRunnerMotion,
  type RunnerMotionIntent,
  type RunnerMotionParameters,
  type RunnerMotionState,
} from './RunnerMotion';
import type { RunnerRoute } from './RunnerRoute';
import { projectRunnerWorldState } from './RunnerWorldProjection';
import {
  buildRouteFollowingController,
  createCanonicalRunnerKinematicsFromRouteMotion,
  sampleRouteFollowingController,
} from './RunnerLocomotionController';

const v = (x: number, z: number): Vec2 => ({ x, z });

const route: RunnerRoute = {
  segments: [{ kind: 'line', start: v(0, 0), end: v(30, 0) }],
};

const parameters: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 0,
  accelerationMps2: 4,
  brakingMps2: 4,
  slideDecelerationMps2: 5,
  topSpeedMps: 9,
};

const start: RunnerMotionState = {
  tick: 1_000_000,
  routeDistanceMeters: 2,
  speedMps: 3,
  driveDirection: 1,
  bodyMode: 'upright',
};

const intent: RunnerMotionIntent = {
  kind: 'advance',
  issuedTick: start.tick,
};

describe('RouteFollowingController', () => {
  it('preserves the existing RunnerMotion world result when no rebase occurs', () => {
    const canonical = createCanonicalRunnerKinematicsFromRouteMotion(
      'runner-1',
      start,
      route,
      7,
    );
    const controller = buildRouteFollowingController({
      canonical,
      startMotion: start,
      route,
      intent,
      parameters,
      endTick: 2_000_000,
    });
    const tick = 1_500_000;
    const directMotion = advanceRunnerMotion(
      start,
      intent,
      tick - start.tick,
      parameters,
    );
    const directWorld = projectRunnerWorldState(
      'runner-1',
      directMotion,
      route,
    );

    expect(sampleRouteFollowingController(
      controller,
      canonical,
      tick,
    )).toEqual({
      playerId: 'runner-1',
      tick,
      position: directWorld.position,
      velocity: directWorld.velocity,
      bodyMode: directMotion.bodyMode,
      motionRevision: 7,
    });
  });

  it('fails closed when route motion does not begin at the canonical world state', () => {
    const canonical = createCanonicalRunnerKinematicsFromRouteMotion(
      'runner-1',
      start,
      route,
      0,
    );

    expect(() => buildRouteFollowingController({
      canonical: {
        ...canonical,
        position: {
          x: canonical.position.x + 1,
          z: canonical.position.z,
        },
      },
      startMotion: start,
      route,
      intent,
      parameters,
      endTick: 2_000_000,
    })).toThrow(
      'route-following controller start must match canonical runner position and velocity',
    );
  });
});