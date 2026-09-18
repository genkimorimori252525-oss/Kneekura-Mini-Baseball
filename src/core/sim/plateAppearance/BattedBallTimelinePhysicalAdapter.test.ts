import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from '../ball/BallFlight';
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
} from './CanonicalPlateAppearanceTimeline';
import {
  deriveAndRecordFirstGroundContactEvidence,
} from './BattedBallTimelinePhysicalAdapter';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 1,
  half: 'top',
  outs: 0,
  balls: 0,
  strikes: 0,
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

const pendingTimeline = () => {
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
  const contact = resolveBatBallContact(
    pitch,
    swing,
  );
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

describe('BattedBallTimelinePhysicalAdapter', () => {
  it('derives first-ground territory from the contact already stored in the canonical timeline', () => {
    const result = deriveAndRecordFirstGroundContactEvidence({
      timeline: pendingTimeline(),
      field,
      searchDurationTicks: 2_000_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(result.kind).toBe('recorded');
    if (result.kind !== 'recorded') {
      throw new Error('fixture must land inside search window');
    }

    expect(result.timeline.status.kind)
      .toBe('batted_ball_pending');
    expect(result.timeline.events.map((event) => event.kind))
      .toEqual([
        'BatBallContact',
        'BattedBallFirstGroundContact',
      ]);
    expect(result.territory.tick)
      .toBe(result.flight.firstGroundContact?.tick);
  });

  it('preserves pending timeline when no ground contact occurs inside the search window', () => {
    const timeline = pendingTimeline();
    const result = deriveAndRecordFirstGroundContactEvidence({
      timeline,
      field,
      searchDurationTicks: 1,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(result.kind).toBe('no_ground_contact');
    if (result.kind !== 'no_ground_contact') {
      throw new Error('fixture must not land in one tick');
    }
    expect(result.timeline).toBe(timeline);
    expect(result.flight.firstGroundContact).toBeNull();
  });

  it('rejects a timeline that is not waiting for batted-ball disposition', () => {
    expect(() => deriveAndRecordFirstGroundContactEvidence({
      timeline: createCanonicalPlateAppearanceTimeline(
        match,
        900_000,
      ),
      field,
      searchDurationTicks: 2_000_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
    })).toThrow(
      'batted-ball physical evidence requires a pending batted ball',
    );
  });
});
