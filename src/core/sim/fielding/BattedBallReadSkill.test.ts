import { describe, expect, it } from 'vitest';
import {
  DeterministicRng,
} from '../../rng/DeterministicRng';
import {
  applyBattedBallReadPredictionError,
} from './BattedBallReadSkill';

const perceivedBall = {
  estimate: {
    position: { x: 10, y: 3, z: 20 },
    velocity: { x: 4, y: -1, z: 8 },
  },
  sourceObservedAt: 900_000,
  predictedAt: 1_000_000,
  confidence: 0.82,
} as const;

const calibration = {
  minimumPositionErrorMeters: 0.02,
  maximumPositionErrorMeters: 1.2,
  minimumVelocityErrorMps: 0.05,
  maximumVelocityErrorMps: 2.5,
} as const;

describe('BattedBallReadSkill', () => {
  it('reduces perceived position and velocity error scales as read ability rises', () => {
    const low = applyBattedBallReadPredictionError(
      perceivedBall,
      0,
      new DeterministicRng(1234),
      calibration,
    );
    const high = applyBattedBallReadPredictionError(
      perceivedBall,
      1,
      new DeterministicRng(1234),
      calibration,
    );

    expect(low.positionErrorScaleMeters).toBe(1.2);
    expect(high.positionErrorScaleMeters).toBe(0.02);
    expect(low.velocityErrorScaleMps).toBe(2.5);
    expect(high.velocityErrorScaleMps).toBe(0.05);
    expect(low.positionError).not.toEqual(high.positionError);
    expect(low.velocityError).not.toEqual(high.velocityError);
  });

  it('preserves observation chronology and confidence instead of turning read skill into visibility', () => {
    const result = applyBattedBallReadPredictionError(
      perceivedBall,
      0.7,
      new DeterministicRng(42),
      calibration,
    );

    expect(result.prediction.sourceObservedAt)
      .toBe(perceivedBall.sourceObservedAt);
    expect(result.prediction.predictedAt)
      .toBe(perceivedBall.predictedAt);
    expect(result.prediction.confidence)
      .toBe(perceivedBall.confidence);
  });

  it('is deterministic for the same read ability and RNG seed', () => {
    const run = () => applyBattedBallReadPredictionError(
      perceivedBall,
      0.6,
      new DeterministicRng(20260918),
      calibration,
    );

    expect(run()).toEqual(run());
  });

  it('rejects invalid ability and inverted calibration ranges', () => {
    expect(() => applyBattedBallReadPredictionError(
      perceivedBall,
      -0.01,
      new DeterministicRng(1),
      calibration,
    )).toThrow(
      'battedBallRead must be finite and within [0, 1]',
    );

    expect(() => applyBattedBallReadPredictionError(
      perceivedBall,
      0.5,
      new DeterministicRng(1),
      {
        ...calibration,
        minimumPositionErrorMeters: 2,
      },
    )).toThrow(
      'maximumPositionErrorMeters must be at least minimumPositionErrorMeters',
    );
  });
});
