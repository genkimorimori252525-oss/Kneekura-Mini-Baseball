import { describe, expect, it } from 'vitest';
import { DeterministicRng } from '../../rng/DeterministicRng';
import {
  applyCatchExecutionTargetError,
  type CatchExecutionErrorCalibration,
} from './CatchExecutionSkill';
import type {
  PerceivedGloveTargetAssessment,
} from './PerceivedGloveTarget';

const target = (): PerceivedGloveTargetAssessment => ({
  plannedFromTick: 1_000_000,
  targetTick: 1_200_000,
  ticksPerSecond: 1_000_000,
  predictedBallPosition: { x: 1.4, y: 1.2, z: 0.2 },
  predictedBodyPosition: { x: 0.2, y: 0.95, z: 0 },
  desiredOffset: { x: 1.2, y: 0.25, z: 0.2 },
  reachDistanceMeters: Math.hypot(1.2, 0.25, 0.2),
  maximumReachMeters: 1.5,
  withinReach: true,
  sourceBallConfidence: 0.8,
  sourceObservedAt: 950_000,
});

const calibration: CatchExecutionErrorCalibration = {
  minimumTargetErrorMeters: 0.01,
  maximumTargetErrorMeters: 0.11,
};

describe('CatchExecutionSkill target error', () => {
  it('is deterministic for the same RNG seed and inputs', () => {
    const first = applyCatchExecutionTargetError(
      target(),
      0.6,
      new DeterministicRng(12345),
      calibration,
    );
    const second = applyCatchExecutionTargetError(
      target(),
      0.6,
      new DeterministicRng(12345),
      calibration,
    );

    expect(second).toEqual(first);
  });

  it('maps catching ability to an externally calibrated error scale', () => {
    const poor = applyCatchExecutionTargetError(
      target(),
      0,
      new DeterministicRng(777),
      calibration,
    );
    const elite = applyCatchExecutionTargetError(
      target(),
      1,
      new DeterministicRng(777),
      calibration,
    );

    expect(poor.errorScaleMeters).toBeCloseTo(0.11, 12);
    expect(elite.errorScaleMeters).toBeCloseTo(0.01, 12);

    expect(elite.executionError.x / elite.errorScaleMeters)
      .toBeCloseTo(poor.executionError.x / poor.errorScaleMeters, 12);
    expect(elite.executionError.y / elite.errorScaleMeters)
      .toBeCloseTo(poor.executionError.y / poor.errorScaleMeters, 12);
    expect(elite.executionError.z / elite.errorScaleMeters)
      .toBeCloseTo(poor.executionError.z / poor.errorScaleMeters, 12);

    expect(Math.abs(elite.executionError.x))
      .toBeLessThan(Math.abs(poor.executionError.x));
    expect(Math.abs(elite.executionError.y))
      .toBeLessThan(Math.abs(poor.executionError.y));
    expect(Math.abs(elite.executionError.z))
      .toBeLessThan(Math.abs(poor.executionError.z));
  });

  it('changes the commanded glove offset without changing the perceived ball estimate', () => {
    const source = target();
    const result = applyCatchExecutionTargetError(
      source,
      0.5,
      new DeterministicRng(42),
      calibration,
    );

    expect(result.predictedBallPosition).toEqual(
      source.predictedBallPosition,
    );
    expect(result.predictedBodyPosition).toEqual(
      source.predictedBodyPosition,
    );
    expect(result.sourceBallConfidence).toBe(source.sourceBallConfidence);
    expect(result.sourceObservedAt).toBe(source.sourceObservedAt);

    expect(result.desiredOffset.x).toBeCloseTo(
      source.desiredOffset.x + result.executionError.x,
      12,
    );
    expect(result.desiredOffset.y).toBeCloseTo(
      source.desiredOffset.y + result.executionError.y,
      12,
    );
    expect(result.desiredOffset.z).toBeCloseTo(
      source.desiredOffset.z + result.executionError.z,
      12,
    );

    expect(result.aimedGlovePosition.x).toBeCloseTo(
      source.predictedBodyPosition.x + result.desiredOffset.x,
      12,
    );
    expect(result.aimedGlovePosition.y).toBeCloseTo(
      source.predictedBodyPosition.y + result.desiredOffset.y,
      12,
    );
    expect(result.aimedGlovePosition.z).toBeCloseTo(
      source.predictedBodyPosition.z + result.desiredOffset.z,
      12,
    );

    expect(source).toEqual(target());
  });

  it('recomputes physical reach feasibility after execution error', () => {
    const nearBoundary: PerceivedGloveTargetAssessment = {
      ...target(),
      desiredOffset: { x: 0, y: 0, z: 0 },
      predictedBallPosition: { x: 0.2, y: 0.95, z: 0 },
      reachDistanceMeters: 0,
      maximumReachMeters: 0.001,
      withinReach: true,
    };
    const result = applyCatchExecutionTargetError(
      nearBoundary,
      0,
      new DeterministicRng(1),
      {
        minimumTargetErrorMeters: 1,
        maximumTargetErrorMeters: 1,
      },
    );

    expect(result.reachDistanceMeters).toBeGreaterThan(0.001);
    expect(result.withinReach).toBe(false);
  });

  it('rejects invalid ability and calibration values', () => {
    expect(() => applyCatchExecutionTargetError(
      target(),
      1.01,
      new DeterministicRng(1),
      calibration,
    )).toThrow('catchingAbility must be finite and within [0, 1]');

    expect(() => applyCatchExecutionTargetError(
      target(),
      0.5,
      new DeterministicRng(1),
      {
        minimumTargetErrorMeters: 0.2,
        maximumTargetErrorMeters: 0.1,
      },
    )).toThrow(
      'maximumTargetErrorMeters must be finite and at least minimumTargetErrorMeters',
    );
  });
});
