import { describe, expect, it } from 'vitest';
import type { Vec2 } from '../../model/geometry';
import type { BaseTouchRegion } from './BaseTouch';
import type { RunnerBodyContactParameters } from './RunnerBodyContact';
import {
  advanceRunnerMotion,
  type RunnerMotionParameters,
  type RunnerMotionState,
} from './RunnerMotion';
import type { RunnerRoute } from './RunnerRoute';
import {
  assertRunnerControllerBasisMatches,
  buildRouteFollowingController,
  createCanonicalRunnerKinematicsFromRouteMotion,
  findRouteFollowingControllerBaseTouchTick,
  rebaseCanonicalRunnerKinematics,
  sampleRouteFollowingController,
  type RunnerRebaseRequest,
} from './RunnerLocomotionController';

const v = (x: number, z: number): Vec2 => ({ x, z });

const route: RunnerRoute = {
  segments: [{ kind: 'line', start: v(0, 0), end: v(40, 0) }],
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

const buildFixture = () => {
  const canonical = createCanonicalRunnerKinematicsFromRouteMotion(
    'runner-hostile',
    start,
    route,
    4,
  );
  const controller = buildRouteFollowingController({
    canonical,
    startMotion: start,
    route,
    intent: { kind: 'advance', issuedTick: start.tick },
    parameters,
    endTick: 4_000_000,
  });
  return { canonical, controller };
};

describe('RunnerLocomotionController hostile authority checks', () => {
  it('rejects a same-revision canonical state whose position was silently changed', () => {
    const { canonical, controller } = buildFixture();
    const current = sampleRouteFollowingController(
      controller,
      canonical,
      1_500_000,
    );

    expect(() => sampleRouteFollowingController(
      controller,
      {
        ...current,
        position: {
          x: current.position.x + 0.01,
          z: current.position.z,
        },
      },
      2_000_000,
    )).toThrow(
      'route-following controller position does not match canonical runner at its authoritative tick',
    );
  });

  it('rejects the stale original ControllerBasis after a same-tick revision change', () => {
    const { canonical, controller } = buildFixture();
    const rebased = rebaseCanonicalRunnerKinematics(canonical, {
      position: canonical.position,
      velocity: canonical.velocity,
      bodyMode: canonical.bodyMode,
      continuity: 'continuous',
      provenance: 'physical_engine',
      scope: 'production',
    });

    expect(() => assertRunnerControllerBasisMatches(
      controller.basis,
      rebased.current,
    )).toThrow(
      'runner controller basis motionRevision does not match canonical runner',
    );
  });

  it('rejects stale base-touch authority after rebase instead of reading the old future trajectory', () => {
    const { canonical, controller } = buildFixture();
    const current = sampleRouteFollowingController(
      controller,
      canonical,
      1_200_000,
    );
    const rebased = rebaseCanonicalRunnerKinematics(current, {
      position: v(12, 0),
      velocity: v(2, 0),
      bodyMode: 'upright',
      continuity: 'discontinuous',
      provenance: 'physical_engine',
      scope: 'production',
    });
    const base: BaseTouchRegion = {
      center: v(8, 0),
      halfSize: v(0.2, 0.2),
      rotationRadians: 0,
    };
    const body: RunnerBodyContactParameters = {
      uprightLeadMeters: 0,
      slideLeadMeters: 0,
    };

    expect(() => findRouteFollowingControllerBaseTouchTick(
      controller,
      rebased.current,
      base,
      body,
    )).toThrow(
      'route-following controller motionRevision does not match canonical runner',
    );
  });

  it('records a continuous rebase at the exact canonical tick and lets replacement control start there', () => {
    const { canonical, controller } = buildFixture();
    const rebaseTick = 1_600_000;
    const current = sampleRouteFollowingController(
      controller,
      canonical,
      rebaseTick,
    );
    const directMotion = advanceRunnerMotion(
      start,
      { kind: 'advance', issuedTick: start.tick },
      rebaseTick - start.tick,
      parameters,
    );
    const rebased = rebaseCanonicalRunnerKinematics(current, {
      position: current.position,
      velocity: current.velocity,
      bodyMode: current.bodyMode,
      continuity: 'continuous',
      provenance: 'physical_engine',
      scope: 'production',
    });

    expect(rebased.fact).toEqual({
      playerId: 'runner-hostile',
      tick: rebaseTick,
      continuity: 'continuous',
      provenance: 'physical_engine',
      fromMotionRevision: 4,
      toMotionRevision: 5,
    });

    const replacement = buildRouteFollowingController({
      canonical: rebased.current,
      startMotion: directMotion,
      route,
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

  it('is deterministic for identical canonical state and rebase input', () => {
    const { canonical } = buildFixture();
    const request: RunnerRebaseRequest = {
      position: v(6, 1),
      velocity: v(2, 0.5),
      bodyMode: 'upright',
      continuity: 'discontinuous',
      provenance: 'rule_system',
      scope: 'production',
    };

    expect(rebaseCanonicalRunnerKinematics(canonical, request))
      .toEqual(rebaseCanonicalRunnerKinematics(canonical, request));
  });

  it('forbids debug_test provenance from production rebases', () => {
    const { canonical } = buildFixture();

    expect(() => rebaseCanonicalRunnerKinematics(canonical, {
      position: canonical.position,
      velocity: canonical.velocity,
      bodyMode: canonical.bodyMode,
      continuity: 'discontinuous',
      provenance: 'debug_test',
      scope: 'production',
    })).toThrow(
      'debug_test runner rebase is not permitted in production',
    );
  });

  it('rejects non-world provenance at runtime even if a caller bypasses TypeScript', () => {
    const { canonical } = buildFixture();
    const invalid = {
      position: canonical.position,
      velocity: canonical.velocity,
      bodyMode: canonical.bodyMode,
      continuity: 'discontinuous',
      provenance: 'presentation',
      scope: 'production',
    } as unknown as RunnerRebaseRequest;

    expect(() => rebaseCanonicalRunnerKinematics(
      canonical,
      invalid,
    )).toThrow(
      'runner rebase provenance is not recognized',
    );
  });

  it('rejects revision overflow instead of wrapping controller authority', () => {
    const { canonical } = buildFixture();

    expect(() => rebaseCanonicalRunnerKinematics(
      {
        ...canonical,
        motionRevision: Number.MAX_SAFE_INTEGER,
      },
      {
        position: canonical.position,
        velocity: canonical.velocity,
        bodyMode: canonical.bodyMode,
        continuity: 'continuous',
        provenance: 'physical_engine',
        scope: 'production',
      },
    )).toThrow(
      'runner motionRevision cannot be incremented safely',
    );
  });
});