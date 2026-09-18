import { describe, expect, it } from 'vitest';
import type { DefenderBodyKinematicsSegment } from './DefenderBodyKinematics';
import {
  composeDefenderPhysicalPrimitiveSegment,
  sampleDefenderPhysicalPrimitiveSegment,
} from './DefenderPhysicalPrimitive';
import {
  planGloveReachPoseSegment,
  type GloveReachExecutionParameters,
  type GloveReachState,
} from './GloveReachExecution';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';

const assessment = (
  overrides: Partial<PerceivedGloveTargetAssessment> = {},
): PerceivedGloveTargetAssessment => ({
  plannedFromTick: 1_000_000,
  targetTick: 1_200_000,
  ticksPerSecond: 1_000_000,
  predictedBallPosition: { x: 1.4, y: 1.2, z: 0 },
  predictedBodyPosition: { x: 0.2, y: 0.95, z: 0 },
  desiredOffset: { x: 1.2, y: 0.25, z: 0 },
  reachDistanceMeters: Math.hypot(1.2, 0.25),
  maximumReachMeters: 1.3,
  withinReach: true,
  sourceBallConfidence: 0.8,
  sourceObservedAt: 950_000,
  ...overrides,
});

const state: GloveReachState = {
  tick: 1_000_000,
  offset: { x: 0.8, y: 0.25, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
};

const parameters: GloveReachExecutionParameters = {
  gloveRadiusMeters: 0.08,
  maxRelativeReachSpeedMps: 5,
  maxRelativeReachAccelerationMps2: 30,
};

const body: DefenderBodyKinematicsSegment = {
  startTick: 1_000_000,
  endTick: 1_200_000,
  ticksPerSecond: 1_000_000,
  startPosition: { x: 0, y: 0.95, z: 0 },
  startVelocity: { x: 1, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
};

describe('GloveReachExecution', () => {
  it('solves a constant-acceleration glove segment that reaches the perceived target', () => {
    const pose = planGloveReachPoseSegment(
      state,
      assessment(),
      parameters,
    );

    expect(pose).toEqual({
      role: 'glove',
      radius: 0.08,
      startTick: 1_000_000,
      endTick: 1_200_000,
      ticksPerSecond: 1_000_000,
      startOffset: { x: 0.8, y: 0.25, z: 0 },
      offsetVelocity: { x: 0, y: 0, z: 0 },
      offsetAcceleration: { x: 20, y: 0, z: 0 },
    });

    const primitive = composeDefenderPhysicalPrimitiveSegment(
      body,
      pose!,
    );
    const endpoint = sampleDefenderPhysicalPrimitiveSegment(
      primitive,
      1_200_000,
    );

    expect(endpoint.center.x).toBeCloseTo(1.4, 12);
    expect(endpoint.center.y).toBeCloseTo(1.2, 12);
    expect(endpoint.center.z).toBeCloseTo(0, 12);
  });

  it('returns null when the target is outside the configured reach envelope', () => {
    expect(planGloveReachPoseSegment(
      state,
      assessment({ withinReach: false }),
      parameters,
    )).toBeNull();
  });

  it('returns null when required relative acceleration exceeds the physical limit', () => {
    expect(planGloveReachPoseSegment(
      state,
      assessment(),
      {
        ...parameters,
        maxRelativeReachAccelerationMps2: 19.9,
      },
    )).toBeNull();
  });

  it('returns null when terminal relative glove speed exceeds the physical limit', () => {
    expect(planGloveReachPoseSegment(
      state,
      assessment(),
      {
        ...parameters,
        maxRelativeReachSpeedMps: 3.9,
      },
    )).toBeNull();
  });

  it('changes execution when only the perceived target offset changes', () => {
    const first = planGloveReachPoseSegment(
      state,
      assessment(),
      parameters,
    );
    const second = planGloveReachPoseSegment(
      state,
      assessment({
        desiredOffset: { x: 1.1, y: 0.25, z: 0 },
        reachDistanceMeters: Math.hypot(1.1, 0.25),
      }),
      parameters,
    );

    expect(first?.offsetAcceleration.x).toBeCloseTo(20, 12);
    expect(second?.offsetAcceleration.x).toBeCloseTo(15, 12);
  });

  it('rejects planning from a glove state that does not match the perception time', () => {
    expect(() => planGloveReachPoseSegment(
      {
        ...state,
        tick: 999_999,
      },
      assessment(),
      parameters,
    )).toThrow('glove reach state tick must equal assessment plannedFromTick');
  });
});
