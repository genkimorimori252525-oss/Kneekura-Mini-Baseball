import { describe, expect, it } from 'vitest';
import type { CatchRetentionContact } from './CatchRetention';
import {
  createFairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  createBattedBallFirstFielderTouchTerritory,
} from './BattedBallFirstFielderTouchTerritory';

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

const contact = (
  x: number,
  z: number,
): CatchRetentionContact => ({
  contactTick: 2_000_000,
  ball: {
    tick: 2_000_000,
    position: { x, y: 1.2, z },
    velocity: { x: 0, y: -2, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
  },
  glove: {
    tick: 2_000_000,
    position: { x, y: 1.2, z: z - 0.1 },
    velocity: { x: 0, y: 0, z: 0 },
  },
  contactNormal: { x: 0, y: 0, z: 1 },
  pocketOffsetMeters: 0.02,
  bodyStability: 1,
});

describe('BattedBallFirstFielderTouchTerritory', () => {
  it('classifies first fielder touch from the physical ball center in fair territory', () => {
    expect(createBattedBallFirstFielderTouchTerritory({
      fielderId: 'right-fielder',
      contact: contact(0, 40),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: true,
    })).toMatchObject({
      fielderId: 'right-fielder',
      tick: 2_000_000,
      ballCenter: { x: 0, y: 1.2, z: 40 },
      classification: {
        kind: 'inside_fair_wedge',
      },
    });
  });

  it('classifies first fielder touch from the physical ball center in foul territory', () => {
    expect(createBattedBallFirstFielderTouchTerritory({
      fielderId: 'right-fielder',
      contact: contact(50, 20),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: true,
    })).toMatchObject({
      classification: {
        kind: 'outside_fair_wedge',
      },
    });
  });

  it('treats physical ball-radius overlap with a foul line as fair territory', () => {
    expect(createBattedBallFirstFielderTouchTerritory({
      fielderId: 'right-fielder',
      contact: contact(1.04, 1),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: true,
    }).classification.kind).toBe('inside_fair_wedge');
  });

  it('requires the caller to establish that this really is the first fielder touch', () => {
    expect(() => createBattedBallFirstFielderTouchTerritory({
      fielderId: 'right-fielder',
      contact: contact(0, 40),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: false as true,
    })).toThrow(
      'batted-ball territory evidence requires first fielder touch',
    );
  });

  it('rejects empty fielder identity', () => {
    expect(() => createBattedBallFirstFielderTouchTerritory({
      fielderId: '',
      contact: contact(0, 40),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: true,
    })).toThrow(
      'fielderId must not be empty',
    );
  });
});
