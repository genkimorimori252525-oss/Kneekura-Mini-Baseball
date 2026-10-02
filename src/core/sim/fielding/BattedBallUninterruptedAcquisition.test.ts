import { expect, it } from 'vitest';
import type { BatBallContactResult } from '../contact/BatBallContact';
import {
  deriveBattedBallContactResponse,
  type BattedActorResponseProfile,
} from '../ball/BattedBallContactResponse';
import { createBattedBallFlightEvidence } from '../ball/BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from '../ball/BallFlight';
import type { BattedWorldContactInput } from '../ball/BattedBallWorldContacts';
import { deriveBattedBallUninterruptedAcquisition } from './BattedBallUninterruptedAcquisition';

const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0 };
const contact: BatBallContactResult = {
  tick: 0,
  ballCenter: { x: 0, y: 1, z: 0 },
  point: { x: 0, y: 1, z: 0 },
  batPoint: { x: 0, y: 1, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  segmentT: 0.5,
  exitVelocity: { x: 0, y: 0, z: 10 },
  exitSpin: { x: 0, y: 0, z: 0 },
};

const material = {
  restitution: 0.5,
  tangentialDamping: 0.1,
  spinDamping: 0.25,
};

const retention = (captureDissipationPowerW = 1000) => ({
  ticksPerSecond: 1_000_000,
  ballMassKg: 0.145,
  ballRadiusMeters: parameters.ballRadius,
  pocketRadiusMeters: 0.2,
  centerRetentionCapacityJ: 20,
  captureDissipationPowerW,
  failedContactRestitution: 0.5,
  failedTangentialDamping: 0.1,
  failedSpinDamping: 0.25,
});

const world = (
  role: BattedActorResponseProfile['role'] = 'glove',
  sourceContact: BatBallContactResult = contact,
): BattedWorldContactInput => ({
  flight: createBattedBallFlightEvidence({
    contact: sourceContact,
    parameters,
    searchDurationTicks: 1_000_000,
  }),
  parameters,
  throughTick: sourceContact.tick + 1_000_000,
  surfaces: [],
  actors: [{
    playerId: 'fielder',
    primitive: {
      role,
      radius: 0.1,
      startTick: sourceContact.tick,
      endTick: sourceContact.tick + 1_000_000,
      ticksPerSecond: parameters.ticksPerSecond,
      startCenter: { x: 0, y: 1, z: 1 },
      startVelocity: { x: 0, y: 0, z: 0 },
      acceleration: { x: 0, y: 0, z: 0 },
    },
  }],
});

const glove = (power = 1000) => ({
  playerId: 'fielder',
  profile: {
    role: 'glove' as const,
    pocketCenterOffset: { x: 0, y: 0, z: -0.1366 },
    bodyStability: 1,
    parameters: retention(power),
  },
});

const body = {
  playerId: 'fielder',
  profile: {
    role: 'body' as const,
    material,
  },
};

it('acquires only when the same actual glove primitive covers the complete retention interval', () => {
  const original = world();
  const response = deriveBattedBallContactResponse({
    world: original,
    actors: [glove()],
    surfaces: [],
  });
  expect(response.kind).toBe('capture_candidate');

  const result = deriveBattedBallUninterruptedAcquisition({
    response,
    world: original,
  });
  expect(result).toMatchObject({
    kind: 'acquired',
    fielderId: 'fielder',
  });
  if (result.kind !== 'acquired') {
    throw new Error('fixture must acquire');
  }
  expect(result.secureTick).toBeGreaterThanOrEqual(
    result.gloveContactTick,
  );
  expect(result.secureGlove.tick).toBe(result.secureTick);
  expect(result.worldThroughTick).toBe(original.throughTick);
});

it('requires a new owned World interval when secure possession lies beyond original primitive coverage', () => {
  const original = world();
  const response = deriveBattedBallContactResponse({
    world: original,
    actors: [glove(0.1)],
    surfaces: [],
  });
  expect(response.kind).toBe('capture_candidate');

  const result = deriveBattedBallUninterruptedAcquisition({
    response,
    world: original,
  });
  expect(result).toMatchObject({
    kind: 'requires_world_extension',
    fielderId: 'fielder',
    worldThroughTick: original.throughTick,
  });
  if (result.kind !== 'requires_world_extension') {
    throw new Error('slow dissipation must require extension');
  }
  expect(result.secureTick).toBeGreaterThan(result.worldThroughTick);
});

it('supports zero-load acquisition at the physical glove-contact tick', () => {
  const stillContact: BatBallContactResult = {
    ...contact,
    exitVelocity: { x: 0, y: 0, z: 0 },
    exitSpin: { x: 0, y: 0, z: 0 },
  };
  const original: BattedWorldContactInput = {
    ...world('glove', stillContact),
    actors: [{
      playerId: 'fielder',
      primitive: {
        role: 'glove',
        radius: 0.1,
        startTick: 0,
        endTick: 1_000_000,
        ticksPerSecond: parameters.ticksPerSecond,
        startCenter: { x: 0, y: 1, z: 0.1 },
        startVelocity: { x: 0, y: 0, z: 0 },
        acceleration: { x: 0, y: 0, z: 0 },
      },
    }],
  };
  const response = deriveBattedBallContactResponse({
    world: original,
    actors: [{
      ...glove(),
      profile: {
        ...glove().profile,
        pocketCenterOffset: { x: 0, y: 0, z: -0.1 },
      },
    }],
    surfaces: [],
  });
  expect(response).toMatchObject({
    kind: 'capture_candidate',
    retention: {
      outcome: {
        kind: 'secured',
        gloveContactTick: 0,
        secureTick: 0,
      },
    },
  });

  expect(deriveBattedBallUninterruptedAcquisition({
    response,
    world: original,
  })).toMatchObject({
    kind: 'acquired',
    gloveContactTick: 0,
    secureTick: 0,
  });
});

it('rejects a substituted World primitive instead of trusting the capture result', () => {
  const original = world();
  const response = deriveBattedBallContactResponse({
    world: original,
    actors: [glove()],
    surfaces: [],
  });
  const changed = {
    ...original,
    actors: original.actors.map((actor) => ({
      ...actor,
      primitive: {
        ...actor.primitive,
        startCenter: {
          ...actor.primitive.startCenter,
          z: actor.primitive.startCenter.z + 0.05,
        },
      },
    })),
  };
  expect(() => deriveBattedBallUninterruptedAcquisition({
    response,
    world: changed,
  })).toThrow('original World differs');
});

it('keeps a real rebound outside acquisition instead of converting contact into possession', () => {
  const original = world('body');
  const response = deriveBattedBallContactResponse({
    world: original,
    actors: [body],
    surfaces: [],
  });
  expect(deriveBattedBallUninterruptedAcquisition({
    response,
    world: original,
  })).toEqual({
    kind: 'not_candidate',
    responseKind: 'rebound',
  });
});

it('preserves simultaneous contact as unresolved acquisition evidence', () => {
  const gloveWorld = world('glove');
  const bodyWorld = world('body');
  const original = {
    ...gloveWorld,
    actors: [...gloveWorld.actors, ...bodyWorld.actors],
  };
  const response = deriveBattedBallContactResponse({
    world: original,
    actors: [glove(), body],
    surfaces: [],
  });
  expect(deriveBattedBallUninterruptedAcquisition({
    response,
    world: original,
  })).toMatchObject({
    kind: 'unresolved',
    reason: 'simultaneous',
  });
});
