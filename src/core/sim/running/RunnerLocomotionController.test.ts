import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import type { BaseTouchRegion } from './BaseTouch';
import type { RunnerBodyContactParameters } from './RunnerBodyContact';
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
  findRouteFollowingControllerBaseTouchTick,
  rebaseCanonicalRunnerKinematics,
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

describe('runner canonical rebase', () => {
  const buildLongController = () => {
    const canonical = createCanonicalRunnerKinematicsFromRouteMotion(
      'runner-1',
      start,
      route,
      7,
    );
    return {
      canonical,
      controller: buildRouteFollowingController({
        canonical,
        startMotion: start,
        route,
        intent,
        parameters,
        endTick: 4_000_000,
      }),
    };
  };

  it('accepts a later canonical state on the same revision before sampling farther ahead', () => {
    const { canonical, controller } = buildLongController();
    const later = sampleRouteFollowingController(
      controller,
      canonical,
      1_500_000,
    );

    expect(sampleRouteFollowingController(
      controller,
      later,
      2_000_000,
    )).toEqual(sampleRouteFollowingController(
      controller,
      canonical,
      2_000_000,
    ));
  });

  it('invalidates old controller futures and starts replacement control exactly at the rebased state', () => {
    const { canonical, controller } = buildLongController();
    const rebaseTick = 1_500_000;
    const beforeRebase = sampleRouteFollowingController(
      controller,
      canonical,
      rebaseTick,
    );
    const rebased = rebaseCanonicalRunnerKinematics(beforeRebase, {
      position: v(10, 0),
      velocity: v(2, 0),
      bodyMode: 'upright',
      continuity: 'discontinuous',
      provenance: 'physical_engine',
      scope: 'production',
    });

    expect(rebased.current.motionRevision).toBe(8);
    expect(() => sampleRouteFollowingController(
      controller,
      rebased.current,
      2_000_000,
    )).toThrow(
      'route-following controller motionRevision does not match canonical runner',
    );

    const replacementRoute: RunnerRoute = {
      segments: [{ kind: 'line', start: v(10, 0), end: v(30, 0) }],
    };
    const replacementMotion: RunnerMotionState = {
      tick: rebaseTick,
      routeDistanceMeters: 0,
      speedMps: 2,
      driveDirection: 1,
      bodyMode: 'upright',
    };
    const replacement = buildRouteFollowingController({
      canonical: rebased.current,
      startMotion: replacementMotion,
      route: replacementRoute,
      intent: { kind: 'advance', issuedTick: rebaseTick },
      parameters,
      endTick: 3_000_000,
    });

    expect(sampleRouteFollowingController(
      replacement,
      rebased.current,
      rebaseTick,
    )).toEqual(rebased.current);
  });

  it('does not synthesize a base touch through a discontinuous skipped region', () => {
    const { canonical, controller } = buildLongController();
    const rebaseTick = 1_100_000;
    const beforeRebase = sampleRouteFollowingController(
      controller,
      canonical,
      rebaseTick,
    );
    const rebased = rebaseCanonicalRunnerKinematics(beforeRebase, {
      position: v(10, 0),
      velocity: v(1, 0),
      bodyMode: 'upright',
      continuity: 'discontinuous',
      provenance: 'debug_test',
      scope: 'debug_test',
    });
    const replacementRoute: RunnerRoute = {
      segments: [{ kind: 'line', start: v(10, 0), end: v(20, 0) }],
    };
    const replacementMotion: RunnerMotionState = {
      tick: rebaseTick,
      routeDistanceMeters: 0,
      speedMps: 1,
      driveDirection: 1,
      bodyMode: 'upright',
    };
    const replacement = buildRouteFollowingController({
      canonical: rebased.current,
      startMotion: replacementMotion,
      route: replacementRoute,
      intent: { kind: 'advance', issuedTick: rebaseTick },
      parameters: { ...parameters, topSpeedMps: 1 },
      endTick: rebaseTick + 2_000_000,
    });
    const skippedBase: BaseTouchRegion = {
      center: v(5, 0),
      halfSize: v(0.2, 0.2),
      rotationRadians: 0,
    };
    const body: RunnerBodyContactParameters = {
      uprightLeadMeters: 0,
      slideLeadMeters: 0,
    };

    expect(findRouteFollowingControllerBaseTouchTick(
      replacement,
      rebased.current,
      skippedBase,
      body,
    )).toBeNull();
  });
});