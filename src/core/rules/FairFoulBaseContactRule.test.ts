import { describe, expect, it } from 'vitest';
import type {
  RollingBattedBallBaseContactEvidence,
} from '../sim/ball/BattedBallBaseContact';
import {
  resolveFirstThirdBaseContactFairBall,
} from './FairFoulBaseContactRule';

const evidence = (
  base: 1 | 3,
): RollingBattedBallBaseContactEvidence => ({
  base,
  tick: 2_000_000,
  rollingStartTick: 1_000_000,
  elapsedSecondsFromRollingStart: 1,
  travelDistanceMeters: 3,
  continuousContactCenter: {
    x: base === 1 ? 27.2 : -27.2,
    y: 0.0366,
    z: 27.2,
  },
  authoritativeState: {
    tick: 2_000_000,
    position: {
      x: base === 1 ? 27.2 : -27.2,
      y: 0.0366,
      z: 27.2,
    },
    velocity: { x: 1, y: 0, z: 1 },
    spin: { x: 0, y: 0, z: 0 },
  },
});

describe('FairFoulBaseContactRule', () => {
  it('treats direct rolling contact with first base as decisive fair evidence', () => {
    expect(resolveFirstThirdBaseContactFairBall(
      evidence(1),
    )).toEqual({
      territory: 'fair',
      decisiveTick: 2_000_000,
      decisiveBase: 1,
      decisiveBallCenter: {
        x: 27.2,
        y: 0.0366,
        z: 27.2,
      },
    });
  });

  it('treats direct rolling contact with third base as decisive fair evidence', () => {
    expect(resolveFirstThirdBaseContactFairBall(
      evidence(3),
    ).decisiveBase).toBe(3);
  });
});
