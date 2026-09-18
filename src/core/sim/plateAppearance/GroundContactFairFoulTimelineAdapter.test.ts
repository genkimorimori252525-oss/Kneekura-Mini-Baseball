import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  createFairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordBattedBallFirstGroundContact,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolveAndRecordUntouchedGroundContactBeyondBases,
} from './GroundContactFairFoulTimelineAdapter';

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

const bases = {
  homePlate: { x: 0, z: 0 },
  firstBase: { x: 27.432, z: 27.432 },
  secondBase: { x: 0, z: 54.864 },
  thirdBase: { x: -27.432, z: 27.432 },
} as const;

const match = (
  strikes: number,
): CanonicalMatchState => ({
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes,
  bases: {
    first: null,
    second: null,
    third: null,
  },
  score: {
    away: 0,
    home: 0,
  },
  playId: 1,
});

const pendingWithGround = (
  strikes: number,
  position: { x: number; z: number },
  territoryKind: 'inside_fair_wedge' | 'outside_fair_wedge',
) => {
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

  const contacted = recordBatBallContact(
    createCanonicalPlateAppearanceTimeline(
      match(strikes),
      900_000,
    ),
    contact,
  );

  return recordBattedBallFirstGroundContact(
    contacted,
    {
      tick: 1_100_000,
      position,
      classification: {
        kind: territoryKind,
        firstBaseLineSignedSide: 0,
        thirdBaseLineSignedSide: 0,
      },
    },
  );
};

describe('GroundContactFairFoulTimelineAdapter', () => {
  it('turns decisive fair first-ground contact beyond the bases into live-ball state', () => {
    const result = resolveAndRecordUntouchedGroundContactBeyondBases({
      timeline: pendingWithGround(
        1,
        { x: 0, z: 70 },
        'inside_fair_wedge',
      ),
      field,
      bases,
      buntAttempt: false,
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('fair');
    if (result.kind !== 'fair') {
      throw new Error('fixture must resolve fair');
    }
    expect(result.timeline.status).toEqual({
      kind: 'live_ball',
      count: { balls: 0, strikes: 1 },
      contactTick: 1_000_000,
      fairDeterminationTick: 1_100_000,
    });
    expect(result.timeline.events.at(-1)?.kind)
      .toBe('BattedBallDeclaredFair');
  });

  it('turns decisive foul first-ground contact beyond the bases into dead-ball foul count semantics', () => {
    const result = resolveAndRecordUntouchedGroundContactBeyondBases({
      timeline: pendingWithGround(
        2,
        { x: 60, z: 40 },
        'outside_fair_wedge',
      ),
      field,
      bases,
      buntAttempt: false,
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('foul');
    if (result.kind !== 'foul') {
      throw new Error('fixture must resolve foul');
    }
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 2 },
    });
    expect(result.timeline.events.at(-1)?.kind)
      .toBe('FoulBattedBallResolved');
  });

  it('preserves pending state when first ground contact is not yet rule-decisive', () => {
    const timeline = pendingWithGround(
      1,
      { x: 0, z: 10 },
      'inside_fair_wedge',
    );
    const result = resolveAndRecordUntouchedGroundContactBeyondBases({
      timeline,
      field,
      bases,
      buntAttempt: false,
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('not_decisive');
    expect(result.timeline).toBe(timeline);
    expect(result.timeline.status.kind)
      .toBe('batted_ball_pending');
  });

  it('does not trust the stored territory label when geometry disagrees', () => {
    const result = resolveAndRecordUntouchedGroundContactBeyondBases({
      timeline: pendingWithGround(
        1,
        { x: 60, z: 40 },
        'inside_fair_wedge',
      ),
      field,
      bases,
      buntAttempt: false,
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('foul');
  });
});