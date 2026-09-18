import { describe, expect, it } from 'vitest';
import {
  createFairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import type {
  BattedBallBaseGatePassage,
} from '../sim/ball/BattedBallBaseGatePassage';
import {
  resolveUntouchedBaseGatePassageTerritory,
} from './FairFoulBaseGatePassageRule';

const field = createFairTerritoryWedge({
  homePlate: { x: 0, z: 0 },
  firstBaseLineUnit: {
    x: Math.SQRT1_2,
    z: Math.SQRT1_2,
  },
  thirdBaseLineUnit: {
    x: -Math.SQRT1_2,
    z: Math.SQRT1_2,
  },
});

const passage = (
  x: number,
  z: number,
  storedKind: 'inside_fair_wedge' | 'outside_fair_wedge',
): BattedBallBaseGatePassage => ({
  tick: 2_000_000,
  state: {
    tick: 2_000_000,
    position: { x, y: 0.0366, z },
    velocity: { x: 10, y: 0, z: 10 },
    spin: { x: 0, y: 0, z: 0 },
  },
  beyond: {
    firstBase: true,
    thirdBase: false,
  },
  territory: {
    kind: storedKind,
    firstBaseLineSignedSide: 0,
    thirdBaseLineSignedSide: 0,
  },
});

describe('FairFoulBaseGatePassageRule', () => {
  it('resolves fair when the ball passes a base gate while any part remains over fair territory', () => {
    const result = resolveUntouchedBaseGatePassageTerritory({
      passage: passage(30, 30, 'inside_fair_wedge'),
      field,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
    });

    expect(result).toEqual({
      territory: 'fair',
      decisiveTick: 2_000_000,
      decisivePosition: { x: 30, z: 30 },
      beyond: {
        firstBase: true,
        thirdBase: false,
      },
    });
  });

  it('resolves foul when the ball passes the gate fully outside fair territory', () => {
    const result = resolveUntouchedBaseGatePassageTerritory({
      passage: passage(50, 30, 'outside_fair_wedge'),
      field,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
    });

    expect(result.territory).toBe('foul');
  });

  it('recomputes territory from geometry instead of trusting stored labels', () => {
    const result = resolveUntouchedBaseGatePassageTerritory({
      passage: passage(50, 30, 'inside_fair_wedge'),
      field,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
    });

    expect(result.territory).toBe('foul');
  });

  it('requires no prior fielder or base touch', () => {
    expect(() => resolveUntouchedBaseGatePassageTerritory({
      passage: passage(30, 30, 'inside_fair_wedge'),
      field,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: false as true,
      noPriorFirstOrThirdBaseTouch: true,
    })).toThrow(
      'base-gate fair/foul resolution requires no prior fielder touch',
    );

    expect(() => resolveUntouchedBaseGatePassageTerritory({
      passage: passage(30, 30, 'inside_fair_wedge'),
      field,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: false as true,
    })).toThrow(
      'base-gate fair/foul resolution requires no prior first/third-base touch',
    );
  });
});
