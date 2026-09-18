import { describe, expect, it } from 'vitest';
import {
  createFairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import type {
  BattedBallFirstFielderTouchTerritory,
} from '../sim/fielding/BattedBallFirstFielderTouchTerritory';
import {
  resolveFirstFielderTouchTerritory,
} from './FairFoulFielderTouchRule';

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

const evidence = (
  x: number,
  z: number,
  label: 'inside_fair_wedge' | 'outside_fair_wedge',
): BattedBallFirstFielderTouchTerritory => ({
  fielderId: 'right-fielder',
  tick: 2_000_000,
  ballCenter: { x, y: 1.2, z },
  classification: {
    kind: label,
    firstBaseLineSignedSide: 0,
    thirdBaseLineSignedSide: 0,
  },
});

describe('FairFoulFielderTouchRule', () => {
  it('resolves first fielder touch in fair territory as fair', () => {
    expect(resolveFirstFielderTouchTerritory({
      evidence: evidence(
        0,
        40,
        'inside_fair_wedge',
      ),
      field,
    })).toEqual({
      territory: 'fair',
      decisiveTick: 2_000_000,
      fielderId: 'right-fielder',
      ballCenter: { x: 0, y: 1.2, z: 40 },
    });
  });

  it('resolves first fielder touch in foul territory as foul', () => {
    expect(resolveFirstFielderTouchTerritory({
      evidence: evidence(
        50,
        20,
        'outside_fair_wedge',
      ),
      field,
    })).toEqual({
      territory: 'foul',
      decisiveTick: 2_000_000,
      fielderId: 'right-fielder',
      ballCenter: { x: 50, y: 1.2, z: 20 },
    });
  });

  it('recomputes territory from physical ball center instead of trusting stored label', () => {
    expect(resolveFirstFielderTouchTerritory({
      evidence: evidence(
        50,
        20,
        'inside_fair_wedge',
      ),
      field,
    }).territory).toBe('foul');
  });
});
