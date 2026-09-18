import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CONTACT_PARAMETERS,
  resolveBatBallContact,
  type BatterSwingState,
  type PitchWorldState,
} from '../contact/BatBallContact';
import {
  DEFAULT_BALL_FLIGHT_PARAMETERS,
} from './BallFlight';
import {
  createBattedBallFlightEvidence,
} from './BattedBallFlightEvidence';

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

describe('BattedBallFlightEvidence', () => {
  it('starts BallFlight from the physical contact ball center and finds first ground contact', () => {
    const contact = resolveBatBallContact(
      pitch,
      swing,
      DEFAULT_CONTACT_PARAMETERS,
    );
    expect(contact).not.toBeNull();
    if (contact === null) {
      throw new Error('fixture must produce contact');
    }

    const evidence = createBattedBallFlightEvidence({
      contact,
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(evidence.initialBall).toEqual({
      tick: contact.tick,
      position: contact.ballCenter,
      velocity: contact.exitVelocity,
      spin: contact.exitSpin,
    });
    expect(evidence.firstGroundContact).not.toBeNull();
    expect(evidence.firstGroundContact?.tick)
      .toBeGreaterThan(contact.tick);
    expect(evidence.firstGroundContact?.state.position.y)
      .toBeCloseTo(
        DEFAULT_BALL_FLIGHT_PARAMETERS.ballRadius,
        12,
      );
  });

  it('returns null first-ground evidence when the search window ends before landing', () => {
    const contact = resolveBatBallContact(
      pitch,
      swing,
      DEFAULT_CONTACT_PARAMETERS,
    );
    if (contact === null) {
      throw new Error('fixture must produce contact');
    }

    const evidence = createBattedBallFlightEvidence({
      contact,
      searchDurationTicks: 1,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(evidence.firstGroundContact).toBeNull();
  });

  it('is deterministic for identical physical contact and flight parameters', () => {
    const contact = resolveBatBallContact(
      pitch,
      swing,
      DEFAULT_CONTACT_PARAMETERS,
    );
    if (contact === null) {
      throw new Error('fixture must produce contact');
    }

    const run = () => createBattedBallFlightEvidence({
      contact,
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(run()).toEqual(run());
  });

  it('rejects invalid search duration', () => {
    const contact = resolveBatBallContact(
      pitch,
      swing,
      DEFAULT_CONTACT_PARAMETERS,
    );
    if (contact === null) {
      throw new Error('fixture must produce contact');
    }

    expect(() => createBattedBallFlightEvidence({
      contact,
      searchDurationTicks: -1,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    })).toThrow(
      'searchDurationTicks must be a non-negative integer',
    );
  });
});
