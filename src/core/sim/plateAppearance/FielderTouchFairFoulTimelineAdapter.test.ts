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
  recordBattedBallFirstFielderTouch,
  recordFoulBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolveAndRecordFirstFielderTouchTerritory,
} from './FielderTouchFairFoulTimelineAdapter';

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

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 1,
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
};

const pendingWithTouch = (
  x: number,
  z: number,
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

  return recordBattedBallFirstFielderTouch(
    recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match,
        900_000,
      ),
      contact,
    ),
    {
      fielderId: 'right-fielder',
      tick: 1_100_000,
      ballCenter: { x, y: 1.2, z },
      classification: {
        kind: Math.abs(x) <= z
          ? 'inside_fair_wedge'
          : 'outside_fair_wedge',
        firstBaseLineSignedSide: 0,
        thirdBaseLineSignedSide: 0,
      },
    },
  );
};

describe('FielderTouchFairFoulTimelineAdapter', () => {
  it('turns first fielder touch in fair territory into live-ball state immediately', () => {
    const result = resolveAndRecordFirstFielderTouchTerritory({
      timeline: pendingWithTouch(0, 40),
      field,
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
  });

  it('keeps foul first-touch pending until catch/drop semantics resolve', () => {
    const timeline = pendingWithTouch(50, 20);
    const result = resolveAndRecordFirstFielderTouchTerritory({
      timeline,
      field,
    });

    expect(result.kind).toBe('foul_pending_catch');
    if (result.kind !== 'foul_pending_catch') {
      throw new Error('fixture must await foul catch/drop');
    }
    expect(result.timeline).toBe(timeline);
    expect(result.timeline.status.kind)
      .toBe('batted_ball_pending');

    const caught = recordFoulBattedBall(
      result.timeline,
      1_150_000,
      false,
      {
        kind: 'caught',
        batterRunnerId: 'batter',
        firstFielderTouchTick: 1_100_000,
        outTick: 1_150_000,
        secureCatchTick: 1_150_000,
      },
    );
    expect(caught.status.kind).toBe('caught_foul_live');
  });

  it('allows a dropped foul first-touch to return to count semantics', () => {
    const result = resolveAndRecordFirstFielderTouchTerritory({
      timeline: pendingWithTouch(50, 20),
      field,
    });
    if (result.kind !== 'foul_pending_catch') {
      throw new Error('fixture must await foul catch/drop');
    }

    const dropped = recordFoulBattedBall(
      result.timeline,
      1_120_000,
      false,
      {
        kind: 'not_caught',
        batterRunnerId: 'batter',
        firstFielderTouchTick: 1_100_000,
        firstGroundContactTick: 1_120_000,
        secureCatchTick: 1_130_000,
      },
    );

    expect(dropped.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 2 },
    });
  });
});
