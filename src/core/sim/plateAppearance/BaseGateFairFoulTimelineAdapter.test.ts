import { describe, expect, it } from 'vitest';
import type { CanonicalMatchState } from '../../model/CanonicalMatchState';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from '../ball/BallFlight';
import type {
  BattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import {
  createFairFoulBaseGateGeometry,
} from '../ball/FairFoulBaseGateGeometry';
import {
  createFairTerritoryWedge,
} from '../ball/FairTerritoryGeometry';
import type {
  BatBallContactResult,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordBattedBallFirstGroundContact,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolveAndRecordPostBounceBaseGatePassage,
} from './BaseGateFairFoulTimelineAdapter';

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

const fixture = (
  velocityX: number,
  velocityZ: number,
) => {
  const contact: BatBallContactResult = {
    tick: 1_000_000,
    ballCenter: { x: 0, y: 0.0366, z: 10 },
    point: { x: 0, y: 0.0366, z: 10 },
    batPoint: { x: 0, y: 0.0366, z: 10 },
    normal: { x: 0, y: 0, z: 1 },
    segmentT: 0.5,
    exitVelocity: {
      x: velocityX,
      y: 0,
      z: velocityZ,
    },
    exitSpin: { x: 0, y: 0, z: 0 },
  };
  const initialBall = {
    tick: contact.tick,
    position: contact.ballCenter,
    velocity: contact.exitVelocity,
    spin: contact.exitSpin,
  };
  const flight: BattedBallFlightEvidence = {
    contact,
    initialBall,
    ballRadiusMeters: 0.0366,
    firstGroundContact: {
      tick: 1_000_000,
      state: initialBall,
    },
  };

  let timeline = recordBatBallContact(
    createCanonicalPlateAppearanceTimeline(
      match,
      900_000,
    ),
    contact,
  );
  timeline = recordBattedBallFirstGroundContact(
    timeline,
    {
      tick: 1_000_000,
      position: { x: 0, z: 10 },
      classification: {
        kind: 'inside_fair_wedge',
        firstBaseLineSignedSide: expect.any(Number) as unknown as number,
        thirdBaseLineSignedSide: expect.any(Number) as unknown as number,
      },
    },
  );

  return {
    timeline,
    flight,
  };
};

describe('BaseGateFairFoulTimelineAdapter', () => {
  it('continues a before-base bounce to a fair base-gate passage and live-ball state', () => {
    const { timeline, flight } = fixture(20, 30);
    const result = resolveAndRecordPostBounceBaseGatePassage({
      timeline,
      flight,
      field,
      bases,
      searchDurationTicks: 2_000_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      buntAttempt: false,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
    });

    expect(result.kind).toBe('fair');
    if (result.kind !== 'fair') {
      throw new Error('fixture must resolve fair');
    }
    expect(result.timeline.status.kind).toBe('live_ball');
    expect(result.timeline.events.map((event) => event.kind))
      .toEqual([
        'BatBallContact',
        'BattedBallFirstGroundContact',
        'BattedBallBaseGatePassed',
        'BattedBallDeclaredFair',
      ]);
    expect(result.passage.beyond.firstBase).toBe(true);
  });

  it('returns a before-base bounce to foul count semantics when gate passage is fully foul', () => {
    const { timeline, flight } = fixture(40, 15);
    const result = resolveAndRecordPostBounceBaseGatePassage({
      timeline,
      flight,
      field,
      bases,
      searchDurationTicks: 2_000_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      buntAttempt: false,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
    });

    expect(result.kind).toBe('foul');
    if (result.kind !== 'foul') {
      throw new Error('fixture must resolve foul');
    }
    expect(result.timeline.status).toEqual({
      kind: 'active',
      count: { balls: 0, strikes: 2 },
    });
    expect(result.timeline.events.map((event) => event.kind))
      .toEqual([
        'BatBallContact',
        'BattedBallFirstGroundContact',
        'BattedBallBaseGatePassed',
        'FoulBattedBallResolved',
      ]);
  });

  it('stays pending when the ball does not reach a base gate inside the search window', () => {
    const { timeline, flight } = fixture(1, 1);
    const result = resolveAndRecordPostBounceBaseGatePassage({
      timeline,
      flight,
      field,
      bases,
      searchDurationTicks: 100_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      buntAttempt: false,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
    });

    expect(result.kind).toBe('no_passage');
    expect(result.timeline).toBe(timeline);
    expect(result.timeline.status.kind)
      .toBe('batted_ball_pending');
  });
});
