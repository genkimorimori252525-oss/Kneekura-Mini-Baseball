import { describe, expect, it } from 'vitest';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import type { DefenderBodyKinematicsSegment } from './DefenderBodyKinematics';
import {
  assessPerceivedGloveTarget,
  type PerceivedGloveTargetParameters,
} from './PerceivedGloveTarget';

const body = (): DefenderBodyKinematicsSegment => ({
  startTick: 1_000_000,
  endTick: 1_300_000,
  ticksPerSecond: 1_000_000,
  startPosition: { x: 0, y: 0.95, z: 0 },
  startVelocity: { x: 1, y: 0, z: 0 },
  acceleration: { x: 0, y: 0, z: 0 },
});

const world = (
  overrides: Partial<PlayerPerceivedWorldState<null>> = {},
): PlayerPerceivedWorldState<null> => ({
  observerId: 'shortstop',
  observationTime: 1_000_000,
  attention: {
    target: { kind: 'ball' },
    focusedSinceTick: 900_000,
  },
  ball: {
    estimate: {
      position: { x: 1, y: 1.2, z: 0 },
      velocity: { x: 2, y: 0, z: 0 },
    },
    sourceObservedAt: 950_000,
    predictedAt: 1_000_000,
    confidence: 0.8,
  },
  players: [],
  communications: [],
  knownContext: null,
  ...overrides,
});

const parameters: PerceivedGloveTargetParameters = {
  minimumBallConfidence: 0.5,
  maximumReachMeters: 1.3,
};

describe('PerceivedGloveTarget', () => {
  it('predicts a future glove target only from the defender perceived ball motion', () => {
    const result = assessPerceivedGloveTarget(
      world(),
      body(),
      1_200_000,
      parameters,
    );

    expect(result).not.toBeNull();
    expect(result?.plannedFromTick).toBe(1_000_000);
    expect(result?.targetTick).toBe(1_200_000);
    expect(result?.predictedBallPosition).toEqual({
      x: 1.4,
      y: 1.2,
      z: 0,
    });
    expect(result?.predictedBodyPosition).toEqual({
      x: 0.2,
      y: 0.95,
      z: 0,
    });
    expect(result?.desiredOffset).toEqual({
      x: 1.2,
      y: 0.25,
      z: 0,
    });
    expect(result?.reachDistanceMeters).toBeCloseTo(
      Math.hypot(1.2, 0.25),
      12,
    );
    expect(result?.withinReach).toBe(true);
    expect(result?.sourceBallConfidence).toBe(0.8);
    expect(result?.sourceObservedAt).toBe(950_000);
  });

  it('changes the target when only this defender perceived ball position changes', () => {
    const first = assessPerceivedGloveTarget(
      world(),
      body(),
      1_200_000,
      parameters,
    );
    const secondWorld = world({
      ball: {
        ...world().ball!,
        estimate: {
          position: { x: 1.3, y: 1.2, z: 0 },
          velocity: { x: 2, y: 0, z: 0 },
        },
      },
    });
    const second = assessPerceivedGloveTarget(
      secondWorld,
      body(),
      1_200_000,
      parameters,
    );

    expect(second?.predictedBallPosition.x).toBeCloseTo(
      first!.predictedBallPosition.x + 0.3,
      12,
    );
    expect(second?.desiredOffset.x).toBeCloseTo(
      first!.desiredOffset.x + 0.3,
      12,
    );
  });

  it('marks a perceived target outside the explicit reach envelope as unreachable', () => {
    const result = assessPerceivedGloveTarget(
      world(),
      body(),
      1_200_000,
      {
        ...parameters,
        maximumReachMeters: 1.0,
      },
    );

    expect(result?.withinReach).toBe(false);
  });

  it('returns no target when this defender has no usable ball perception', () => {
    expect(assessPerceivedGloveTarget(
      world({ ball: null }),
      body(),
      1_200_000,
      parameters,
    )).toBeNull();

    expect(assessPerceivedGloveTarget(
      world({
        ball: {
          ...world().ball!,
          confidence: 0.49,
        },
      }),
      body(),
      1_200_000,
      parameters,
    )).toBeNull();
  });

  it('rejects a candidate tick outside the supplied body trajectory', () => {
    expect(() => assessPerceivedGloveTarget(
      world(),
      body(),
      1_300_001,
      parameters,
    )).toThrow('targetTick must be inside the supplied body kinematics segment');
  });

  it('rejects a perceived ball prediction that is not resolved at observationTime', () => {
    expect(() => assessPerceivedGloveTarget(
      world({
        ball: {
          ...world().ball!,
          predictedAt: 999_999,
        },
      }),
      body(),
      1_200_000,
      parameters,
    )).toThrow('perceived ball must be resolved at observationTime');
  });
});
