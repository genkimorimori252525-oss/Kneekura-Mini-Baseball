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
import {
  createFairTerritoryWedge,
} from './FairTerritoryGeometry';
import {
  classifyFirstGroundContactTerritory,
} from './FirstGroundContactTerritory';

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
  batXOffset: number,
) => {
  const pitch: PitchWorldState = {
    tick: 1_000_000,
    position: { x: 0, y: 1, z: 0.06 },
    velocity: { x: 0, y: -1.5, z: -35 },
    spin: { x: 0, y: 0, z: 0 },
  };
  const swing: BatterSwingState = {
    pose: {
      grip: {
        x: -0.42 + batXOffset,
        y: 1,
        z: 0,
      },
      tip: {
        x: 0.42 + batXOffset,
        y: 1,
        z: 0,
      },
    },
    linearVelocity: { x: 0, y: 0, z: 22 },
    angularVelocity: { x: 0, y: 0, z: 0 },
  };
  const result = resolveBatBallContact(
    pitch,
    swing,
    DEFAULT_CONTACT_PARAMETERS,
  );
  if (result === null) {
    throw new Error('fixture must produce contact');
  }
  return result;
};

describe('FirstGroundContactTerritory', () => {
  it('classifies the actual first-ground contact point against foul-line geometry', () => {
    const evidence = createBattedBallFlightEvidence({
      contact: contact(0),
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    const territory = classifyFirstGroundContactTerritory(
      evidence,
      field,
    );

    expect(territory).not.toBeNull();
    expect(territory?.tick).toBe(
      evidence.firstGroundContact?.tick,
    );
    expect(territory?.position).toEqual({
      x: evidence.firstGroundContact?.state.position.x,
      z: evidence.firstGroundContact?.state.position.z,
    });
    expect([
      'inside_fair_wedge',
      'outside_fair_wedge',
    ]).toContain(territory?.classification.kind);
  });

  it('returns null when there is no first-ground evidence in the search window', () => {
    const evidence = createBattedBallFlightEvidence({
      contact: contact(0),
      searchDurationTicks: 1,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });

    expect(classifyFirstGroundContactTerritory(
      evidence,
      field,
    )).toBeNull();
  });

  it('does not mutate or reinterpret the BallFlight evidence', () => {
    const evidence = createBattedBallFlightEvidence({
      contact: contact(0),
      searchDurationTicks: 2_000_000,
      parameters: DEFAULT_BALL_FLIGHT_PARAMETERS,
    });
    const before = JSON.stringify(evidence);

    classifyFirstGroundContactTerritory(
      evidence,
      field,
    );

    expect(JSON.stringify(evidence)).toBe(before);
  });
});
