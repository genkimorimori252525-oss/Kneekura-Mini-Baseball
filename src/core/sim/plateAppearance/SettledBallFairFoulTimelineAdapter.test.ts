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
  resolveAndRecordSettledBeforeBaseTerritory,
} from './SettledBallFairFoulTimelineAdapter';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 2,
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
  playId: 2,
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
  x: number,
  z: number,
  vx: number,
  vz: number,
) => {
  const contact: BatBallContactResult = {
    tick: 1_000_000,
    ballCenter: { x, y: 0.0366, z },
    point: { x, y: 0.0366, z },
    batPoint: { x, y: 0.0366, z },
    normal: { x: 0, y: 0, z: 1 },
    segmentT: 0.5,
    exitVelocity: { x: vx, y: 0, z: vz },
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
      tick: contact.tick,
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
      tick: contact.tick,
      position: { x, z },
      classification: {
        kind: Math.abs(x) <= z
          ? 'inside_fair_wedge'
          : 'outside_fair_wedge',
        firstBaseLineSignedSide: 1,
        thirdBaseLineSignedSide: 1,
      },
    },
  );

  return {
    timeline,
    flight,
  };
};

describe('SettledBallFairFoulTimelineAdapter', () => {
  it('turns a settled before-base fair ball into live-ball state', () => {
    const { timeline, flight } = fixture(
      0,
      5,
      0.5,
      0.5,
    );
    const result = resolveAndRecordSettledBeforeBaseTerritory({
      timeline,
      flight,
      field,
      bases,
      searchDurationTicks: 2_000_000,
      ballFlightParameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
      buntAttempt: false,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
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
        'BattedBallSettled',
        'BattedBallDeclaredFair',
      ]);
  });

  it('turns a settled before-base foul ball into foul count semantics', () => {
    const { timeline, flight } = fixture(
      5,
      0,
      0.5,
      0,
    );
    const result = resolveAndRecordSettledBeforeBaseTerritory({
      timeline,
      flight,
      field,
      bases,
      searchDurationTicks: 2_000_000,
      ballFlightParameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
      buntAttempt: false,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
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

  it('stays pending when the ball has not settled inside the search window', () => {
    const { timeline, flight } = fixture(
      0,
      5,
      3,
      4,
    );
    const result = resolveAndRecordSettledBeforeBaseTerritory({
      timeline,
      flight,
      field,
      bases,
      searchDurationTicks: 100_000,
      ballFlightParameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 4,
      },
      buntAttempt: false,
      noPriorFielderTouch: true,
      noPriorFirstOrThirdBaseTouch: true,
      noPriorBaseGatePassage: true,
    });

    expect(result.kind).toBe('not_settled');
    expect(result.timeline).toBe(timeline);
    expect(result.timeline.status.kind)
      .toBe('batted_ball_pending');
  });
});
