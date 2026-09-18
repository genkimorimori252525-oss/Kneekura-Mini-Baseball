import { describe, expect, it } from 'vitest';
import {
  createFairFoulBaseGateGeometry,
} from '../sim/ball/FairFoulBaseGateGeometry';
import {
  createFairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import type {
  BattedBallSettlingEvidence,
} from '../sim/ball/BattedBallSettlingEvidence';
import {
  resolveUntouchedSettledBattedBallTerritory,
} from './FairFoulSettledBallRule';

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

const bases = createFairFoulBaseGateGeometry({
  homePlate: { x: 0, z: 0 },
  firstBase: { x: 27.432, z: 27.432 },
  secondBase: { x: 0, z: 54.864 },
  thirdBase: { x: -27.432, z: 27.432 },
});

const settled = (
  x: number,
  z: number,
): BattedBallSettlingEvidence => ({
  tick: 2_000_000,
  state: {
    tick: 2_000_000,
    position: { x, y: 0.0366, z },
    velocity: { x: 0, y: 0, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
  },
  territory: {
    kind: Math.abs(x) <= z
      ? 'inside_fair_wedge'
      : 'outside_fair_wedge',
    firstBaseLineSignedSide: 0,
    thirdBaseLineSignedSide: 0,
  },
});

describe('FairFoulSettledBallRule', () => {
  it('resolves a ball settled in fair territory between home and the base gates as fair', () => {
    expect(resolveUntouchedSettledBattedBallTerritory({
      settling: settled(0, 10),
      field,
      bases,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
    })).toEqual({
      territory: 'fair',
      decisiveTick: 2_000_000,
      decisivePosition: { x: 0, z: 10 },
    });
  });

  it('resolves a ball settled fully in foul territory between home and the base gates as foul', () => {
    expect(resolveUntouchedSettledBattedBallTerritory({
      settling: settled(10, 2),
      field,
      bases,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
    }).territory).toBe('foul');
  });

  it('recomputes territory from geometry rather than trusting stored evidence labels', () => {
    const mislabeled: BattedBallSettlingEvidence = {
      ...settled(10, 2),
      territory: {
        kind: 'inside_fair_wedge',
        firstBaseLineSignedSide: 999,
        thirdBaseLineSignedSide: 999,
      },
    };

    expect(resolveUntouchedSettledBattedBallTerritory({
      settling: mislabeled,
      field,
      bases,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
    }).territory).toBe('foul');
  });

  it('rejects a settling point already beyond a first/third-base gate', () => {
    expect(() => resolveUntouchedSettledBattedBallTerritory({
      settling: settled(20, 40),
      field,
      bases,
      ballRadiusMeters: 0.0366,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
    })).toThrow(
      'settled-ball fair/foul resolution requires the ball to remain before both base gates',
    );
  });
});
