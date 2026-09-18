import { describe, expect, it } from 'vitest';
import type {
  FirstGroundContactTerritory,
} from '../sim/ball/FirstGroundContactTerritory';
import {
  createFairTerritoryWedge,
} from '../sim/ball/FairTerritoryGeometry';
import {
  resolveUntouchedGroundContactBeyondBases,
} from './FairFoulGroundRule';

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

const diamond = {
  firstBase: { x: 27.432, z: 27.432 },
  secondBase: { x: 0, z: 54.864 },
  thirdBase: { x: -27.432, z: 27.432 },
} as const;

const evidence = (
  x: number,
  z: number,
): FirstGroundContactTerritory => ({
  tick: 2_000_000,
  position: { x, z },
  classification: {
    kind: Math.abs(x) <= z
      ? 'inside_fair_wedge'
      : 'outside_fair_wedge',
    firstBaseLineSignedSide: 0,
    thirdBaseLineSignedSide: 0,
  },
});

describe('FairFoulGroundRule', () => {
  it('declares an untouched first ground contact beyond the bases fair when it lands in fair territory', () => {
    expect(resolveUntouchedGroundContactBeyondBases({
      firstGroundContact: evidence(0, 70),
      field,
      bases: diamond,
      noPriorFielderTouch: true,
    })).toEqual({
      kind: 'resolved',
      territory: 'fair',
      decisiveTick: 2_000_000,
      decisivePosition: { x: 0, z: 70 },
      beyond: {
        firstBase: true,
        thirdBase: true,
      },
    });
  });

  it('declares an untouched first ground contact beyond first base foul when it lands outside the foul line', () => {
    expect(resolveUntouchedGroundContactBeyondBases({
      firstGroundContact: evidence(60, 40),
      field,
      bases: diamond,
      noPriorFielderTouch: true,
    })).toEqual({
      kind: 'resolved',
      territory: 'foul',
      decisiveTick: 2_000_000,
      decisivePosition: { x: 60, z: 40 },
      beyond: {
        firstBase: true,
        thirdBase: false,
      },
    });
  });

  it('does not guess fair or foul from a first ground contact before the first/third-base gates', () => {
    expect(resolveUntouchedGroundContactBeyondBases({
      firstGroundContact: evidence(0, 10),
      field,
      bases: diamond,
      noPriorFielderTouch: true,
    })).toEqual({
      kind: 'not_decisive',
      reason: 'first_ground_contact_not_beyond_first_or_third',
      beyond: {
        firstBase: false,
        thirdBase: false,
      },
    });
  });

  it('uses geometric territory from the field instead of trusting a caller-supplied classification label', () => {
    const mislabeled: FirstGroundContactTerritory = {
      ...evidence(60, 40),
      classification: {
        kind: 'inside_fair_wedge',
        firstBaseLineSignedSide: 999,
        thirdBaseLineSignedSide: 999,
      },
    };

    expect(resolveUntouchedGroundContactBeyondBases({
      firstGroundContact: mislabeled,
      field,
      bases: diamond,
      noPriorFielderTouch: true,
    })).toMatchObject({
      kind: 'resolved',
      territory: 'foul',
    });
  });

  it('requires an explicit guarantee that no fielder touched the ball first', () => {
    expect(() => resolveUntouchedGroundContactBeyondBases({
      firstGroundContact: evidence(0, 70),
      field,
      bases: diamond,
      noPriorFielderTouch: false as true,
    })).toThrow(
      'ground-contact fair/foul resolution requires no prior fielder touch',
    );
  });
});
