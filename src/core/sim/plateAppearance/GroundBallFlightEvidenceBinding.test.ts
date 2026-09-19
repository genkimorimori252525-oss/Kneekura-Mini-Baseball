import { describe, expect, it } from 'vitest';
import type {
  CanonicalMatchState,
} from '../../model/CanonicalMatchState';
import {
  asRuleProfileId,
} from '../../model/RuleProfileRef';
import {
  createBattedBallFlightEvidence,
} from '../ball/BattedBallFlightEvidence';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from '../ball/BallFlight';
import {
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  createCanonicalPlateAppearanceTimeline,
  recordBatBallContact,
  recordFairBattedBall,
} from './CanonicalPlateAppearanceTimeline';
import {
  assertBattedBallFlightEvidenceMatchesTimeline,
} from './GroundBallFlightEvidenceBinding';

const fixture = () => {
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
    playId: 7,
  };
  const pitch: PitchWorldState = {
    tick: 10_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: { x: -0.42, y: 1, z: 0 },
      tip: { x: 0.42, y: 1, z: 0 },
    },
    linearVelocity: { x: 0, y: -7, z: 17 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const contact = resolveBatBallContact(pitch, swing);
  if (contact === null) {
    throw new Error('fixture must create contact');
  }
  const timeline = recordFairBattedBall(
    recordBatBallContact(
      createCanonicalPlateAppearanceTimeline(
        match,
        contact.tick - 100_000,
      ),
      contact,
    ),
    contact.tick + 1,
  );
  const flight = createBattedBallFlightEvidence({
    contact,
    searchDurationTicks: 3_000_000,
    parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
  });
  if (flight.firstGroundContact === null) {
    throw new Error('fixture must produce first ground contact');
  }
  return { timeline, flight };
};

describe('GroundBallFlightEvidenceBinding', () => {
  it('accepts flight evidence derived from the authoritative timeline contact', () => {
    const { timeline, flight } = fixture();

    expect(() =>
      assertBattedBallFlightEvidenceMatchesTimeline(
        timeline,
        flight,
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      )
    ).not.toThrow();
  });

  it('rejects a swapped or mutated bat-ball contact', () => {
    const { timeline, flight } = fixture();
    const forged = {
      ...flight,
      contact: {
        ...flight.contact,
        exitVelocity: {
          ...flight.contact.exitVelocity,
          x: flight.contact.exitVelocity.x + 1,
        },
      },
    };

    expect(() =>
      assertBattedBallFlightEvidenceMatchesTimeline(
        timeline,
        forged,
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      )
    ).toThrow(
      'batted-ball flight evidence must match the authoritative timeline contact',
    );
  });

  it('rejects an injected initial ball state even when the contact object is unchanged', () => {
    const { timeline, flight } = fixture();
    const forged = {
      ...flight,
      initialBall: {
        ...flight.initialBall,
        velocity: {
          ...flight.initialBall.velocity,
          z: flight.initialBall.velocity.z + 1,
        },
      },
    };

    expect(() =>
      assertBattedBallFlightEvidenceMatchesTimeline(
        timeline,
        forged,
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      )
    ).toThrow(
      'batted-ball flight initial state must derive from the authoritative timeline contact',
    );
  });

  it('rejects a fabricated later first-ground-contact boundary', () => {
    const { timeline, flight } = fixture();
    if (flight.firstGroundContact === null) {
      throw new Error('fixture must produce first ground contact');
    }
    const forgedTick = flight.firstGroundContact.tick + 1;
    const forged = {
      ...flight,
      firstGroundContact: {
        ...flight.firstGroundContact,
        tick: forgedTick,
        state: {
          ...flight.firstGroundContact.state,
          tick: forgedTick,
        },
      },
    };

    expect(() =>
      assertBattedBallFlightEvidenceMatchesTimeline(
        timeline,
        forged,
        DEFAULT_BALL_FLIGHT_PARAMETERS,
      )
    ).toThrow(
      'batted-ball first-ground-contact tick must be the first physical ground contact',
    );
  });
});