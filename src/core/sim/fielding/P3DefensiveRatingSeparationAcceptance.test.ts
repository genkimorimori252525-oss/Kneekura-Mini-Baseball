import { describe, expect, it } from 'vitest';
import {
  createDefensiveRatings,
  type DefensiveRatingsInput,
} from '../../model/DefensiveRatings';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';
import {
  deriveRatedCatchRetentionParameters,
  deriveRatedDefenderMotionParameters,
  resolveRatedCatchExecutionTarget,
  resolveRatedDefensiveDecisionTiming,
  resolveRatedDefenderFirstStepTiming,
} from './DefensiveRatingAdapters';

const baseInput: DefensiveRatingsInput = {
  positionSuitability: {
    P: 0.5,
    C: 0.5,
    '1B': 0.5,
    '2B': 0.5,
    '3B': 0.5,
    SS: 0.5,
    LF: 0.5,
    CF: 0.5,
    RF: 0.5,
  },
  firstStep: 0.5,
  acceleration: 0.5,
  battedBallRead: 0.5,
  routeEfficiency: 0.5,
  catching: 0.5,
  transfer: 0.5,
  armStrength: 0.5,
  throwingAccuracy: 0.5,
  situationalAwareness: 0.5,
  tagSkill: 0.5,
};

const ratings = (
  overrides: Partial<DefensiveRatingsInput>,
) => createDefensiveRatings({
  ...baseInput,
  ...overrides,
});

const motionBase = {
  ticksPerSecond: 1_000_000,
  maxIntegrationStepTicks: 10_000,
  accelerationMps2: 4,
  brakingMps2: 5,
  topSpeedMps: 8,
  arrivalRadiusMeters: 0.2,
} as const;

const accelerationCalibration = {
  lowestAbilityAccelerationMps2: 2,
  highestAbilityAccelerationMps2: 6,
} as const;

const target: PerceivedGloveTargetAssessment = {
  plannedFromTick: 1_000_000,
  targetTick: 1_100_000,
  ticksPerSecond: 1_000_000,
  predictedBallPosition: { x: 1, y: 1, z: 0 },
  predictedBodyPosition: { x: 0, y: 1, z: 0 },
  desiredOffset: { x: 1, y: 0, z: 0 },
  reachDistanceMeters: 1,
  maximumReachMeters: 1.5,
  withinReach: true,
  sourceBallConfidence: 0.8,
  sourceObservedAt: 950_000,
};

const catchExecutionCalibration = {
  minimumTargetErrorMeters: 0.01,
  maximumTargetErrorMeters: 0.11,
} as const;

const retentionBase = {
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: 0.0366,
  pocketRadiusMeters: 0.08,
  centerRetentionCapacityJ: 8,
  captureDissipationPowerW: 20,
  failedContactRestitution: 0.3,
  failedTangentialDamping: 0.4,
  failedSpinDamping: 0.2,
} as const;

const retentionCalibration = {
  lowAbilityCenterRetentionCapacityMultiplier: 0.5,
  highAbilityCenterRetentionCapacityMultiplier: 1.5,
  lowAbilityCaptureDissipationPowerMultiplier: 0.7,
  highAbilityCaptureDissipationPowerMultiplier: 1.3,
} as const;

const timingParameters = {
  minimumDecisionDelayTicks: 20_000,
  maximumDecisionDelayTicks: 100_000,
  fixedProcessingOffsetTicks: 5_000,
} as const;

const subsystemProjection = (
  value: ReturnType<typeof createDefensiveRatings>,
) => ({
  motion: deriveRatedDefenderMotionParameters(
    motionBase,
    value,
    accelerationCalibration,
  ),
  catchExecution: resolveRatedCatchExecutionTarget(
    target,
    value,
    new DeterministicRng(123),
    catchExecutionCalibration,
  ),
  retention: deriveRatedCatchRetentionParameters(
    retentionBase,
    value,
    retentionCalibration,
  ),
  decision: resolveRatedDefensiveDecisionTiming(
    1_000_000,
    value,
    timingParameters,
  ),
  firstStep: resolveRatedDefenderFirstStepTiming(
    1_000_000,
    value,
    {
      minimumFirstStepDelayTicks: 30_000,
      maximumFirstStepDelayTicks: 150_000,
      fixedMotorOffsetTicks: 10_000,
    },
  ),
});

describe('P3 defensive rating separation acceptance', () => {
  it('first step changes only movement-start timing', () => {
    const low = subsystemProjection(
      ratings({ firstStep: 0 }),
    );
    const high = subsystemProjection(
      ratings({ firstStep: 1 }),
    );

    expect(low.firstStep.movementStartTick)
      .not.toBe(high.firstStep.movementStartTick);
    expect(low.firstStep.recognitionTick)
      .toBe(high.firstStep.recognitionTick);
    expect(low.motion).toEqual(high.motion);
    expect(low.catchExecution)
      .toEqual(high.catchExecution);
    expect(low.retention).toEqual(high.retention);
    expect(low.decision).toEqual(high.decision);
  });

  it('acceleration changes motion acceleration while catch and decision outputs stay identical', () => {
    const low = subsystemProjection(
      ratings({ acceleration: 0 }),
    );
    const high = subsystemProjection(
      ratings({ acceleration: 1 }),
    );

    expect(low.motion.accelerationMps2).not.toBe(
      high.motion.accelerationMps2,
    );
    expect({
      ...low.motion,
      accelerationMps2: high.motion.accelerationMps2,
    }).toEqual(high.motion);

    expect(low.catchExecution)
      .toEqual(high.catchExecution);
    expect(low.retention).toEqual(high.retention);
    expect(low.decision).toEqual(high.decision);
    expect(low.firstStep).toEqual(high.firstStep);
  });

  it('catching changes catch execution/retention while motion and decision stay identical', () => {
    const low = subsystemProjection(
      ratings({ catching: 0 }),
    );
    const high = subsystemProjection(
      ratings({ catching: 1 }),
    );

    expect(low.motion).toEqual(high.motion);
    expect(low.decision).toEqual(high.decision);
    expect(low.firstStep).toEqual(high.firstStep);
    expect(low.catchExecution.errorScaleMeters)
      .not.toBe(high.catchExecution.errorScaleMeters);
    expect(low.retention.centerRetentionCapacityJ)
      .not.toBe(high.retention.centerRetentionCapacityJ);
  });

  it('situational awareness changes only the existing decision-time intermediate', () => {
    const low = subsystemProjection(
      ratings({ situationalAwareness: 0 }),
    );
    const high = subsystemProjection(
      ratings({ situationalAwareness: 1 }),
    );

    expect(low.motion).toEqual(high.motion);
    expect(low.catchExecution)
      .toEqual(high.catchExecution);
    expect(low.retention).toEqual(high.retention);
    expect(low.firstStep).toEqual(high.firstStep);
    expect(low.decision.decisionTick)
      .not.toBe(high.decision.decisionTick);
    expect(low.decision.evidenceAvailableAt)
      .toBe(high.decision.evidenceAvailableAt);
  });
});
