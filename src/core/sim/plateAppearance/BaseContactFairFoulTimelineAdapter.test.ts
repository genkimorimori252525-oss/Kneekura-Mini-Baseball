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
import type {
  BattedBallBasePrism,
} from '../ball/BattedBallBaseContact';
import type {
  BatBallContactResult,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordBattedBallFirstGroundContact,
} from './CanonicalPlateAppearanceTimeline';
import {
  resolveAndRecordRollingFirstThirdBaseContact,
} from './BaseContactFairFoulTimelineAdapter';

const match: CanonicalMatchState = {
  ruleProfileId: asRuleProfileId('npb-2026'),
  inning: 3,
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
  playId: 3,
};

const gates = createFairFoulBaseGateGeometry({
  homePlate: { x: 0, z: 0 },
  firstBase: { x: 3, z: 0 },
  secondBase: { x: 3, z: 3 },
  thirdBase: { x: 0, z: 3 },
});

const prism = (
  x: number,
  z: number,
): BattedBallBasePrism => ({
  region: {
    center: { x, z },
    halfSize: { x: 0.2, z: 0.2 },
    rotationRadians: 0,
  },
  bottomY: 0,
  topY: 0.05,
});

const fixture = (
  vx: number,
  vz: number,
) => {
  const ballRadius = 0.0366;
  const contact: BatBallContactResult = {
    tick: 1_000_000,
    ballCenter: { x: 0, y: ballRadius, z: 0 },
    point: { x: 0, y: ballRadius, z: 0 },
    batPoint: { x: 0, y: ballRadius, z: 0 },
    normal: { x: 1, y: 0, z: 0 },
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
    ballRadiusMeters: ballRadius,
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
      position: { x: 0, z: 0 },
      classification: {
        kind: 'inside_fair_wedge',
        firstBaseLineSignedSide: 0,
        thirdBaseLineSignedSide: 0,
      },
    },
  );

  return { timeline, flight };
};

describe('BaseContactFairFoulTimelineAdapter', () => {
  it('records direct first-base contact and immediately promotes the batted ball to fair/live', () => {
    const { timeline, flight } = fixture(4, 0);

    const result = resolveAndRecordRollingFirstThirdBaseContact({
      timeline,
      flight,
      baseGates: gates,
      firstBasePrism: prism(3, 0),
      thirdBasePrism: prism(0, 3),
      searchDurationTicks: 1_000_000,
      ballFlightParameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 0,
      },
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('fair_base_contact');
    if (result.kind !== 'fair_base_contact') {
      throw new Error('fixture must contact first base');
    }
    expect(result.contact.base).toBe(1);
    expect(result.timeline.status.kind).toBe('live_ball');
    expect(result.timeline.events.map((event) => event.kind))
      .toEqual([
        'BatBallContact',
        'BattedBallFirstGroundContact',
        'BattedBallFirstThirdBaseContact',
        'BattedBallDeclaredFair',
      ]);
  });

  it('chooses third base when that physical contact happens first', () => {
    const { timeline, flight } = fixture(0, 4);

    const result = resolveAndRecordRollingFirstThirdBaseContact({
      timeline,
      flight,
      baseGates: gates,
      firstBasePrism: prism(3, 0),
      thirdBasePrism: prism(0, 3),
      searchDurationTicks: 1_000_000,
      ballFlightParameters: {
        ...DEFAULT_BALL_FLIGHT_PARAMETERS,
        groundRollingDecelerationMps2: 0,
      },
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('fair_base_contact');
    if (result.kind !== 'fair_base_contact') {
      throw new Error('fixture must contact third base');
    }
    expect(result.contact.base).toBe(3);
  });

  it('stays pending when neither base is physically reached', () => {
    const { timeline, flight } = fixture(0.5, 0.5);

    const result = resolveAndRecordRollingFirstThirdBaseContact({
      timeline,
      flight,
      baseGates: gates,
      firstBasePrism: prism(3, 0),
      thirdBasePrism: prism(0, 3),
      searchDurationTicks: 100_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      noPriorFielderTouch: true,
    });

    expect(result.kind).toBe('no_base_contact');
    expect(result.timeline).toBe(timeline);
  });

  it('rejects the base-contact path when a prior fielder-touch event already exists', () => {
    const { timeline, flight } = fixture(4, 0);
    const withPriorTouch = {
      ...timeline,
      events: [
        ...timeline.events,
        {
          tick: 1_100_000,
          sequence: timeline.nextSequence,
          kind: 'BattedBallFirstFielderTouch' as const,
          payload: {
            evidence: {
              fielderId: 'third-baseman',
              tick: 1_100_000,
              ballCenter: {
                x: 0.4,
                y: 0.0366,
                z: 0,
              },
              ballRadiusMeters: 0.0366,
              classification: {
                kind: 'inside_fair_wedge' as const,
                firstBaseLineSignedSide: 1,
                thirdBaseLineSignedSide: 1,
              },
            },
          },
        },
      ],
      lastEventTick: 1_100_000,
      nextSequence: timeline.nextSequence + 1,
    };

    expect(() => resolveAndRecordRollingFirstThirdBaseContact({
      timeline: withPriorTouch,
      flight,
      baseGates: gates,
      firstBasePrism: prism(3, 0),
      thirdBasePrism: prism(0, 3),
      searchDurationTicks: 1_000_000,
      ballFlightParameters:
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      noPriorFielderTouch: true,
    })).toThrow(
      'rolling base-contact fair/foul resolution requires no prior fielder-touch event',
    );
  });
});
