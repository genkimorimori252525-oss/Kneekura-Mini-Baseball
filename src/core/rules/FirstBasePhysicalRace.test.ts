import { describe, expect, it } from 'vitest';
import type { BaseTouchRegion } from '../sim/running/BaseTouch';
import type {
  CatchRetentionParameters,
} from '../sim/fielding/CatchRetention';
import type {
  DefenderBodyKinematicsSegment,
} from '../sim/fielding/DefenderBodyKinematics';
import {
  planDefenderBaseFootReachPrimitive,
} from '../sim/fielding/DefenderBaseFootReach';
import type { RunnerBodyContactParameters } from '../sim/running/RunnerBodyContact';
import {
  buildBatterSwingExitRecoveryTrajectory,
} from '../sim/running/BatterSwingExitRecoveryTrajectory';
import {
  buildBatterRunnerWorldTimeline,
  findBatterRunnerPostLaunchBaseTouchTick,
} from '../sim/running/BatterRunnerWorldTimeline';
import type {
  RunnerMotionParameters,
} from '../sim/running/RunnerMotion';
import type { RunnerRoute } from '../sim/running/RunnerRoute';
import {
  createRunnerBaseTouchFact,
} from './PhysicalRuleFacts';
import {
  resolveFirstBasePhysicalRace,
  resolveGroundBallFirstBasePhysicalRace,
} from './FirstBasePhysicalRace';

const route: RunnerRoute = {
  segments: [{
    kind: 'line',
    start: { x: 0, z: 0 },
    end: { x: 35, z: 0 },
  }],
};

const firstBase: BaseTouchRegion = {
  center: { x: 27, z: 0 },
  halfSize: { x: 0.2, z: 0.2 },
  rotationRadians: 0,
};

const runnerBody: RunnerBodyContactParameters = {
  uprightLeadMeters: 0.25,
  slideLeadMeters: 0.6,
};

const runnerMotion: RunnerMotionParameters = {
  ticksPerSecond: 1_000_000,
  reactionDelayTicks: 0,
  accelerationMps2: 4,
  brakingMps2: 4,
  slideDecelerationMps2: 5,
  topSpeedMps: 8,
};

const retention: CatchRetentionParameters = {
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.1,
  centerRetentionCapacityJ: 400,
  captureDissipationPowerW: 100_000,
  failedContactRestitution: 0.25,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
};

const timeline = () => {
  const recovery = buildBatterSwingExitRecoveryTrajectory(
    {
      tick: 1_000_000,
      planarVelocity: { x: 1, z: 0 },
      bodyForwardUnit: { x: 1, z: 0 },
    },
    route,
    {
      ticksPerSecond: 1_000_000,
      maximumBodyTurnRateRadiansPerSecond: Math.PI,
      lateralRealignmentAccelerationMps2: 3,
      backwardRecoveryAccelerationMps2: 4,
    },
  );

  return buildBatterRunnerWorldTimeline({
    playerId: 'batter',
    route,
    recovery,
    postLaunchIntent: {
      kind: 'advance',
      issuedTick: recovery.transition.launchTick,
    },
    runnerMotionParameters: runnerMotion,
    endTick: recovery.transition.launchTick + 4_500_000,
  });
};

const plannedFootForRunnerTouch = (
  runnerTouchTick: number,
) => {
  const targetTick = runnerTouchTick + 100_000;
  const body: DefenderBodyKinematicsSegment = {
    startTick: targetTick - 1_000_000,
    endTick: targetTick,
    ticksPerSecond: 1_000_000,
    startPosition: {
      x: firstBase.center.x - 0.8,
      y: 1,
      z: firstBase.center.z,
    },
    startVelocity: { x: 0, y: 0, z: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
  };
  const primitive = planDefenderBaseFootReachPrimitive({
    body,
    footState: {
      tick: body.startTick,
      offset: { x: 0.4, y: -1, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    },
    role: 'left_foot',
    targetTick,
    base: firstBase,
    baseLocalContactPoint: { x: 0, z: 0 },
    baseSurfaceHeightMeters: 0,
    parameters: {
      footRadiusMeters: 0.12,
      maximumLegReachMeters: 1.5,
      maxRelativeReachSpeedMps: 3,
      maxRelativeReachAccelerationMps2: 4,
    },
  });
  if (primitive === null) {
    throw new Error('fixture must produce a reachable base foot primitive');
  }
  return primitive;
};

const receptionStartingAt = (
  startTick: number,
  xOffset = 0,
) => ({
  ball: {
    tick: startTick,
    position: { x: xOffset, y: 1.2, z: 0.2 },
    velocity: { x: 0, y: 0, z: -60 },
    spin: { x: 0, y: 0, z: 0 },
  },
  ballAcceleration: { x: 0, y: 0, z: 0 },
  glovePrimitive: {
    role: 'glove' as const,
    radius: 0.0334,
    startTick,
    endTick: startTick + 5_000,
    ticksPerSecond: 1_000_000,
    startCenter: { x: 0, y: 1.2, z: 0 },
    startVelocity: { x: 0, y: 0, z: 0 },
    acceleration: { x: 0, y: 0, z: 0 },
  },
  ballRadiusMeters: 0.0366,
  pocketOffsetMeters: 0,
  bodyStability: 1,
});

const inputAtReceptionStart = (
  receptionStartTick: number,
  retentionParameters: CatchRetentionParameters = retention,
) => {
  const built = timeline();
  const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
    built,
    firstBase,
    runnerBody,
  );
  if (runnerTouchTick === null) {
    throw new Error('fixture must produce runner first-base touch');
  }
  return {
    timeline: built,
    firstBase,
    runnerBodyParameters: runnerBody,
    defender: {
      defenderId: 'first-baseman',
      baseSurfaceHeightMeters: 0,
      controlThroughTick: built.endTick,
      contactPrimitives: [plannedFootForRunnerTouch(runnerTouchTick)],
      reception: receptionStartingAt(receptionStartTick),
      retentionParameters,
    },
  };
};

describe('end-to-end first-base physical race', () => {
  it('resolves OUT from throw reception, retention, foot control, and runner touch evidence', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;
    const input = inputAtReceptionStart(
      runnerTouchTick - 8_000,
    );

    const result = resolveFirstBasePhysicalRace(input);

    expect(result.receptionContact?.contactTick)
      .toBe(runnerTouchTick - 5_833);
    expect(result.catchRetention?.outcome.kind).toBe('secured');
    expect(result.defenderControl?.tick)
      .toBe(runnerTouchTick - 3_223);
    expect(result.runnerTouch?.tick).toBe(runnerTouchTick);
    expect(result.correctRuleResult).toMatchObject({
      kind: 'out',
      defenderControlTick: runnerTouchTick - 3_223,
      runnerTouchTick,
    });
  });

  it('resolves SAFE when physical secure possession occurs after runner touch', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;

    const result = resolveFirstBasePhysicalRace(
      inputAtReceptionStart(runnerTouchTick - 3_000),
    );

    expect(result.catchRetention?.outcome.kind).toBe('secured');
    expect(result.defenderControl?.tick)
      .toBe(runnerTouchTick + 1_777);
    expect(result.correctRuleResult).toMatchObject({
      kind: 'safe',
      touchTick: runnerTouchTick,
      defenderControlTick: runnerTouchTick + 1_777,
    });
  });

  it('preserves exact physical simultaneity through the existing rule', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;

    const result = resolveFirstBasePhysicalRace(
      inputAtReceptionStart(runnerTouchTick - 4_777),
    );

    expect(result.defenderControl?.tick).toBe(runnerTouchTick);
    expect(result.runnerTouch?.tick).toBe(runnerTouchTick);
    expect(result.correctRuleResult).toEqual({
      kind: 'simultaneous',
      runnerId: 'batter',
      base: 1,
      tick: runnerTouchTick,
    });
  });

  it('keeps a failed retention live and leaves defender control unresolved', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;

    const result = resolveFirstBasePhysicalRace(
      inputAtReceptionStart(
        runnerTouchTick - 8_000,
        {
          ...retention,
          centerRetentionCapacityJ: 100,
        },
      ),
    );

    expect(result.receptionContact).not.toBeNull();
    expect(result.catchRetention?.outcome.kind).toBe('live-ball');
    expect(result.defenderControl).toBeNull();
    expect(result.correctRuleResult).toEqual({
      kind: 'unresolved',
      runnerId: 'batter',
      reason: 'missing_defender_control',
    });
  });

  it('does not invent a catch or control when the throw misses the glove', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;
    const input = inputAtReceptionStart(
      runnerTouchTick - 8_000,
    );
    const result = resolveFirstBasePhysicalRace({
      ...input,
      defender: {
        ...input.defender,
        reception: receptionStartingAt(
          runnerTouchTick - 8_000,
          0.5,
        ),
      },
    });

    expect(result.receptionContact).toBeNull();
    expect(result.catchRetention).toBeNull();
    expect(result.defenderControl).toBeNull();
    expect(result.correctRuleResult).toMatchObject({
      kind: 'unresolved',
      reason: 'missing_defender_control',
    });
  });

  it('rejects mismatched authoritative clocks before comparing race ticks', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;
    const input = inputAtReceptionStart(
      runnerTouchTick - 8_000,
    );

    expect(() => resolveFirstBasePhysicalRace({
      ...input,
      defender: {
        ...input.defender,
        retentionParameters: {
          ...input.defender.retentionParameters,
          ticksPerSecond: 500_000,
        },
      },
    })).toThrow(
      'first-base physical race subsystems must share ticksPerSecond',
    );

    expect(() => resolveFirstBasePhysicalRace({
      ...input,
      defender: {
        ...input.defender,
        contactPrimitives: [{
          ...plannedFootForRunnerTouch(runnerTouchTick),
          ticksPerSecond: 500_000,
        }],
      },
    })).toThrow(
      'first-base physical race subsystems must share ticksPerSecond',
    );
  });

  it('rejects inconsistent ball radius between collision and retention physics', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;
    const input = inputAtReceptionStart(
      runnerTouchTick - 8_000,
    );

    expect(() => resolveFirstBasePhysicalRace({
      ...input,
      defender: {
        ...input.defender,
        retentionParameters: {
          ...input.defender.retentionParameters,
          ballRadiusMeters: 0.04,
        },
      },
    })).toThrow(
      'throw-reception and catch-retention ball radius must match',
    );
  });

  it('feeds the same physical facts into existing two-out ground-ball scoring', () => {
    const built = timeline();
    const runnerTouchTick = findBatterRunnerPostLaunchBaseTouchTick(
      built,
      firstBase,
      runnerBody,
    ) as number;
    const homeTouch = createRunnerBaseTouchFact(
      'r3',
      4,
      runnerTouchTick - 100_000,
    );
    const input = inputAtReceptionStart(
      runnerTouchTick - 8_000,
    );

    const result = resolveGroundBallFirstBasePhysicalRace({
      ...input,
      outsAtStart: 2,
      homeTouches: [homeTouch],
    });

    expect(result.race.correctRuleResult.kind).toBe('out');
    expect(result.ruleEngine.correctRuleResult).toMatchObject({
      kind: 'resolved',
      outsAfter: 3,
      thirdOut: true,
      runsScored: [],
      runsSuppressed: [homeTouch],
    });
    expect(result.ruleEngine.physicalFacts.defenderControl)
      .toEqual(result.race.defenderControl);
    expect(result.ruleEngine.physicalFacts.batterRunnerTouch)
      .toEqual(result.race.runnerTouch);
  });
});