import { describe, expect, it } from 'vitest';
import { DeterministicRng } from '../../rng/DeterministicRng';
import {
  evaluateCatchRetentionLoad,
  type CatchRetentionContact,
  type CatchRetentionParameters,
} from './CatchRetention';
import {
  applyCatchExecutionTargetError,
  evaluateCatchBodyStability,
} from './CatchExecutionSkill';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';

const target: PerceivedGloveTargetAssessment = {
  plannedFromTick: 1_000_000,
  targetTick: 1_200_000,
  ticksPerSecond: 1_000_000,
  predictedBallPosition: { x: 1.2, y: 1.1, z: 0 },
  predictedBodyPosition: { x: 0, y: 1, z: 0 },
  desiredOffset: { x: 1.2, y: 0.1, z: 0 },
  reachDistanceMeters: Math.hypot(1.2, 0.1),
  maximumReachMeters: 1.5,
  withinReach: true,
  sourceBallConfidence: 0.9,
  sourceObservedAt: 990_000,
};

const retentionParameters: CatchRetentionParameters = {
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.12,
  centerRetentionCapacityJ: 8,
  captureDissipationPowerW: 725,
  failedContactRestitution: 0.25,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
};

const baseContact = (
  pocketOffsetMeters: number,
  bodyStability: number,
): CatchRetentionContact => ({
  contactTick: 1_200_000,
  ball: {
    tick: 1_200_000,
    position: { x: 1.2, y: 1.1, z: 0 },
    velocity: { x: 0, y: 0, z: -8 },
    spin: { x: 0, y: 20, z: 0 },
  },
  glove: {
    tick: 1_200_000,
    position: { x: 1.2, y: 1.1, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  },
  contactNormal: { x: 0, y: 0, z: 1 },
  pocketOffsetMeters,
  bodyStability,
});

const magnitude = (value: { x: number; y: number; z: number }): number => (
  Math.hypot(value.x, value.y, value.z)
);

describe('catch execution skill -> retention physics', () => {
  it('changes pocket centering and body stability without changing incoming ball energy', () => {
    const errorCalibration = {
      minimumTargetErrorMeters: 0.005,
      maximumTargetErrorMeters: 0.04,
    } as const;
    const stabilityCalibration = {
      lowestAbilityFullReachStability: 0.25,
      highestAbilityFullReachStability: 0.9,
    } as const;

    const lowSkillTarget = applyCatchExecutionTargetError(
      target,
      0,
      new DeterministicRng(2026),
      errorCalibration,
    );
    const highSkillTarget = applyCatchExecutionTargetError(
      target,
      1,
      new DeterministicRng(2026),
      errorCalibration,
    );

    const lowPocketOffset = magnitude(lowSkillTarget.executionError);
    const highPocketOffset = magnitude(highSkillTarget.executionError);
    expect(highPocketOffset).toBeLessThan(lowPocketOffset);

    const lowStability = evaluateCatchBodyStability(
      lowSkillTarget,
      0,
      stabilityCalibration,
    );
    const highStability = evaluateCatchBodyStability(
      highSkillTarget,
      1,
      stabilityCalibration,
    );
    expect(highStability).toBeGreaterThan(lowStability);

    const low = evaluateCatchRetentionLoad(
      baseContact(lowPocketOffset, lowStability),
      retentionParameters,
    );
    const high = evaluateCatchRetentionLoad(
      baseContact(highPocketOffset, highStability),
      retentionParameters,
    );

    expect(high.translationalEnergyJ).toBeCloseTo(
      low.translationalEnergyJ,
      12,
    );
    expect(high.rotationalEnergyJ).toBeCloseTo(
      low.rotationalEnergyJ,
      12,
    );
    expect(high.retentionLoadJ).toBeCloseTo(
      low.retentionLoadJ,
      12,
    );

    expect(high.pocketFactor).toBeGreaterThan(low.pocketFactor);
    expect(high.effectiveCapacityJ).toBeGreaterThan(
      low.effectiveCapacityJ,
    );
  });
});
