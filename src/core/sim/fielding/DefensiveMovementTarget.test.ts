import { describe, expect, it } from 'vitest';
import type { PlayerPerceivedWorldState } from '../perception/PlayerPerceivedWorldState';
import type { DefensiveIntent } from './DefensiveDecision';
import {
  resolveDefensiveMovementTarget,
  type DefensiveFieldLandmarks,
} from './DefensiveMovementTarget';

const landmarks: DefensiveFieldLandmarks = {
  basePositions: {
    1: { x: 27.43, z: 0 },
    2: { x: 27.43, z: 27.43 },
    3: { x: 0, z: 27.43 },
    4: { x: 0, z: 0 },
  },
  baseCoverBodyPositions: {
    1: { x: 26.6, z: 0.15 },
    2: { x: 26.9, z: 26.9 },
    3: { x: 0.15, z: 26.6 },
    4: { x: 0.6, z: 0.6 },
  },
};

const world = (
  withBall = true,
): PlayerPerceivedWorldState<null> => ({
  observerId: 'pitcher',
  observationTime: 1_200_000,
  attention: {
    target: { kind: 'ball' },
    focusedSinceTick: 1_000_000,
  },
  ball: withBall ? {
    estimate: {
      position: { x: 8.5, y: 0.4, z: 4.25 },
      velocity: { x: 3, y: -1, z: 2 },
    },
    sourceObservedAt: 1_150_000,
    predictedAt: 1_200_000,
    confidence: 0.8,
  } : null,
  players: [],
  communications: [],
  knownContext: null,
});

describe('DefensiveMovementTarget', () => {
  it('resolves base cover from known static field landmarks', () => {
    expect(resolveDefensiveMovementTarget(
      { kind: 'base_cover', base: 1 },
      world(),
      landmarks,
    )).toEqual({ x: 26.6, z: 0.15 });
  });

  it('keeps the physical first-base landmark distinct from the defender body cover target', () => {
    expect(landmarks.basePositions[1]).toEqual({
      x: 27.43,
      z: 0,
    });
    expect(resolveDefensiveMovementTarget(
      { kind: 'base_cover', base: 1 },
      world(),
      landmarks,
    )).not.toEqual(landmarks.basePositions[1]);
  });

  it('uses the defender perceived ball estimate for ball handling', () => {
    expect(resolveDefensiveMovementTarget(
      { kind: 'ball_handler' },
      world(),
      landmarks,
    )).toEqual({ x: 8.5, z: 4.25 });
  });

  it('cannot invent a ball-handler target when this defender has no ball perception', () => {
    expect(resolveDefensiveMovementTarget(
      { kind: 'ball_handler' },
      world(false),
      landmarks,
    )).toBeNull();
  });

  it.each<readonly [DefensiveIntent, { x: number; z: number }]>([
    [{ kind: 'relay', target: { x: 12, z: 5 } }, { x: 12, z: 5 }],
    [{ kind: 'backup', target: { x: -3, z: 11 } }, { x: -3, z: 11 }],
    [{ kind: 'deep_coverage', target: { x: 22, z: 41 } }, { x: 22, z: 41 }],
  ])('preserves explicit local target for %o', (intent, expected) => {
    expect(resolveDefensiveMovementTarget(intent, world(), landmarks)).toEqual(expected);
  });

  it('maps hold to no movement target', () => {
    expect(resolveDefensiveMovementTarget(
      { kind: 'hold' },
      world(),
      landmarks,
    )).toBeNull();
  });
});
