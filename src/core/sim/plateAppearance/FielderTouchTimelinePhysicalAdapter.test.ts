import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createFairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import type { CatchRetentionContact } from '../fielding/CatchRetention';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
} from './CanonicalPlateAppearanceTimeline';
import {
  deriveAndRecordFirstFielderTouchEvidence,
} from './FielderTouchTimelinePhysicalAdapter';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
  bases: { first: null, second: null, third: null },
  score: { away: 0, home: 0 },
  playId: 1,
};

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

const pending = () => {
  const pitch: PitchWorldState = {
    tick: 1_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: 0, z: 22 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must produce contact');
  }
  return recordBatBallContact(
    createCanonicalPlateAppearanceTimeline(
      match,
      900_000,
    ),
    contact,
  );
};

const gloveContact = (
  x: number,
  z: number,
): CatchRetentionContact => ({
  contactTick: 1_100_000,
  ball: {
    tick: 1_100_000,
    position: { x, y: 1.3, z },
    velocity: { x: 0, y: -2, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
  },
  glove: {
    tick: 1_100_000,
    position: { x, y: 1.3, z: z - 0.1 },
    velocity: { x: 0, y: 0, z: 0 },
  },
  contactNormal: { x: 0, y: 0, z: 1 },
  pocketOffsetMeters: 0.01,
  bodyStability: 1,
});

describe('FielderTouchTimelinePhysicalAdapter', () => {
  it('derives and records first-fielder-touch territory directly from CatchRetentionContact', () => {
    const result = deriveAndRecordFirstFielderTouchEvidence({
      timeline: pending(),
      fielderId: 'right-fielder',
      contact: gloveContact(0, 40),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: true,
    });

    expect(result.evidence).toMatchObject({
      fielderId: 'right-fielder',
      tick: 1_100_000,
      ballCenter: { x: 0, y: 1.3, z: 40 },
      classification: {
        kind: 'inside_fair_wedge',
      },
    });
    expect(result.timeline.events.at(-1)?.kind)
      .toBe('BattedBallFirstFielderTouch');
  });

  it('rejects use outside batted-ball pending state', () => {
    expect(() => deriveAndRecordFirstFielderTouchEvidence({
      timeline: createCanonicalPlateAppearanceTimeline(
        match,
        900_000,
      ),
      fielderId: 'right-fielder',
      contact: gloveContact(0, 40),
      field,
      ballRadiusMeters: 0.0366,
      isFirstFielderTouch: true,
    })).toThrow(
      'fielder-touch physical evidence requires a pending batted ball',
    );
  });
});
