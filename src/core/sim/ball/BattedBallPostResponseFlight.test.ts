import { expect, it } from 'vitest';
import type { BatBallContactResult } from '../contact/BatBallContact';
import {
  deriveBattedBallContactResponse,
  type BattedActorResponseProfile,
} from './BattedBallContactResponse';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import type { BattedWorldContactInput } from './BattedBallWorldContacts';
import { deriveBattedBallPostResponseFlight } from './BattedBallPostResponseFlight';

const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0 };
const contact: BatBallContactResult = {
  tick: 0,
  ballCenter: { x: 0, y: 1, z: 0 },
  point: { x: 0, y: 1, z: 0 },
  batPoint: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  segmentT: 0.5,
  exitVelocity: { x: 0, y: 0, z: 10 },
  exitSpin: { x: 0, y: 0, z: 2 },
};
const material = {
  restitution: 0.5,
  tangentialDamping: 0.1,
  spinDamping: 0.25,
};
const retention = {
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: parameters.ballRadius,
  pocketRadiusMeters: 0.2,
  centerRetentionCapacityJ: 20,
  captureDissipationPowerW: 1000,
  failedContactRestitution: 0.5,
  failedTangentialDamping: 0.1,
  failedSpinDamping: 0.25,
};

const world = (
  role: BattedActorResponseProfile['role'] = 'body',
): BattedWorldContactInput => ({
  flight: createBattedBallFlightEvidence({
    contact,
    parameters,
    searchDurationTicks: 1_000_000,
  }),
  parameters,
  throughTick: 1_000_000,
  surfaces: [],
  actors: [{
    playerId: 'fielder',
    primitive: {
      role,
      radius: 0.1,
      startTick: 0,
      endTick: 1_000_000,
      ticksPerSecond: parameters.ticksPerSecond,
      startCenter: { x: 0, y: 1, z: 1 },
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
    },
  }],
});

const body = {
  playerId: 'fielder',
  profile: { role: 'body' as const, material },
};
const glove = {
  playerId: 'fielder',
  profile: {
    role: 'glove' as const,
    pocketCenterOffset: { x: 0, y: 0, z: -0.1366 },
    bodyStability: 1,
    parameters: retention,
  },
};

it('projects a proven rebound without claiming later World absence', () => {
  const response = deriveBattedBallContactResponse({
    world: world(),
    actors: [body],
    surfaces: [],
  });
  const result = deriveBattedBallPostResponseFlight({
    response,
    parameters,
    searchDurationTicks: 100_000,
  });

  if (response.kind !== 'rebound') {
    throw new Error('body contact must produce rebound');
  }
  expect(result).toMatchObject({
    kind: 'flight_projection',
    responseKind: 'rebound',
    throughTick: response.ball.tick + 100_000,
    ball: { velocity: { z: -5 } },
  });
  if (result.kind !== 'flight_projection') {
    throw new Error('rebound must project');
  }
  expect(result.ball.position.z).toBeCloseTo(
    response.ball.position.z + response.ball.velocity.z * 0.1,
    12,
  );
});

it('keeps retained glove response pending until a World acquisition owner proves possession', () => {
  const response = deriveBattedBallContactResponse({
    world: world('glove'),
    actors: [glove],
    surfaces: [],
  });
  const result = deriveBattedBallPostResponseFlight({
    response,
    parameters,
    searchDurationTicks: 1_000_000,
  });

  if (
    response.kind !== 'capture_candidate'
    || response.retention.outcome.kind !== 'secured'
  ) {
    throw new Error('glove fixture must produce secured capture candidate');
  }
  expect(result).toEqual({
    kind: 'requires_acquisition',
    contactTick: response.retention.outcome.gloveContactTick,
    candidateSecureTick: response.retention.outcome.secureTick,
  });
  expect(result).not.toHaveProperty('ball');
  expect(result).not.toHaveProperty('possession');
});

it('requires another World interval instead of extrapolating an airborne no-contact horizon', () => {
  const w = world();
  const response = deriveBattedBallContactResponse({
    world: { ...w, throughTick: 1 },
    actors: [body],
    surfaces: [],
  });

  expect(deriveBattedBallPostResponseFlight({
    response,
    parameters,
    searchDurationTicks: 100,
  })).toEqual({
    kind: 'requires_world_extension',
    throughTick: 1,
  });
});

it('preserves an unresolved simultaneous response rather than choosing a continuation', () => {
  const w = world('glove');
  const response = deriveBattedBallContactResponse({
    world: { ...w, actors: [...w.actors, ...world().actors] },
    actors: [body, glove],
    surfaces: [],
  });

  expect(deriveBattedBallPostResponseFlight({
    response,
    parameters,
    searchDurationTicks: 100,
  })).toMatchObject({
    kind: 'unresolved',
    reason: 'simultaneous',
  });
});

it('continues an actual ground response through existing rolling physics only', () => {
  const p = {
    ...DEFAULT_BALL_FLIGHT_PARAMETERS,
    gravityY: -9.81,
    groundRestitution: 0,
    restingVerticalSpeed: 10,
  };
  const downward: BatBallContactResult = {
    ...contact,
    ballCenter: { x: 0, y: 0.2, z: 0 },
    exitVelocity: { x: 1, y: -1, z: 0 },
  };
  const flight = createBattedBallFlightEvidence({
    contact: downward,
    parameters: p,
    searchDurationTicks: 1_000_000,
  });
  const response = deriveBattedBallContactResponse({
    world: {
      flight,
      parameters: p,
      throughTick: 1_000_000,
      actors: [],
      surfaces: [],
    },
    actors: [],
    surfaces: [],
  });

  expect(response.kind).toBe('ground');
  const result = deriveBattedBallPostResponseFlight({
    response,
    parameters: p,
    searchDurationTicks: 100_000,
  });
  expect(result).toMatchObject({
    kind: 'flight_projection',
    responseKind: 'ground',
    motion: 'rolling',
  });
});

it.each([-1, 0.5])('rejects invalid continuation duration %s', (searchDurationTicks) => {
  const response = deriveBattedBallContactResponse({
    world: world(),
    actors: [body],
    surfaces: [],
  });

  expect(() => deriveBattedBallPostResponseFlight({
    response,
    parameters,
    searchDurationTicks,
  })).toThrow();
});
