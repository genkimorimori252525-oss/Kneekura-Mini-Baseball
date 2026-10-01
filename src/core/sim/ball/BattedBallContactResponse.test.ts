import { expect, it } from 'vitest';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import type { BatBallContactResult } from '../contact/BatBallContact';
import type { BattedWorldContactInput } from './BattedBallWorldContacts';
import { deriveBattedBallContactResponse, type BattedActorResponseProfile } from './BattedBallContactResponse';

const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0 };
const contact: BatBallContactResult = { tick: 0, ballCenter: { x: 0, y: 1, z: 0 }, point: { x: 0, y: 1, z: 0 },
  batPoint: { x: 0, y: 1, z: 0 }, normal: { x: 0, y: 0, z: 1 }, segmentT: 0.5,
  exitVelocity: { x: 0, y: 0, z: 10 }, exitSpin: { x: 0, y: 0, z: 2 } };
const material = { restitution: 0.5, tangentialDamping: 0.1, spinDamping: 0.25 };
const retention = { ticksPerSecond: 1_000_000, ballMassKg: 0.145, ballRadiusMeters: parameters.ballRadius,
  pocketRadiusMeters: 0.2, centerRetentionCapacityJ: 20, captureDissipationPowerW: 1000,
  failedContactRestitution: 0.5, failedTangentialDamping: 0.1, failedSpinDamping: 0.25 };
const world = (role: BattedActorResponseProfile['role'] = 'body', c = contact): BattedWorldContactInput => ({
  flight: createBattedBallFlightEvidence({ contact: c, parameters, searchDurationTicks: 1_000_000 }), parameters,
  throughTick: c.tick + 1_000_000, surfaces: [], actors: [{ playerId: 'fielder', primitive: {
    role, radius: 0.1, startTick: c.tick, endTick: c.tick + 1_000_000, ticksPerSecond: parameters.ticksPerSecond,
    startCenter: { x: 0, y: 1, z: 1 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 },
  } }],
});
const body = { playerId: 'fielder', profile: { role: 'body' as const, material } };
const glove = { playerId: 'fielder', profile: { role: 'glove' as const, pocketCenterOffset: { x: 0, y: 0, z: -0.1366 }, bodyStability: 1, parameters: retention } };
it('derives an actual body rebound without manufacturing glove retention or possession', () => {
  const result = deriveBattedBallContactResponse({ world: world(), actors: [body], surfaces: [] });
  expect(result).toMatchObject({ kind: 'rebound', ball: { velocity: { z: -5 }, spin: { z: 1.5 } },
    geometry: { normal: { z: -1 } } });
  expect(result).not.toHaveProperty('retention');
});
it('derives actual moving-body relative rebound', () => {
  const w = world();
  const moving = { ...w, actors: w.actors.map((a) => ({ ...a, primitive: { ...a.primitive, startVelocity: { x: 0, y: 0, z: 2 } } })) };
  expect(deriveBattedBallContactResponse({ world: moving, actors: [body], surfaces: [] })).toMatchObject({ kind: 'rebound', ball: { velocity: { z: -2 } } });
});
it('reuses actual glove geometry and retention as a capture candidate, not an acquired catch', () => {
  const result = deriveBattedBallContactResponse({ world: world('glove'), actors: [glove], surfaces: [] });
  expect(result).toMatchObject({ kind: 'capture_candidate', retention: { outcome: { kind: 'secured' } } });
  expect(result).not.toHaveProperty('possession');
});
it('retains a physically failed glove attempt as the actual live rebound ball', () => {
  const result = deriveBattedBallContactResponse({ world: world('glove'),
    actors: [{ ...glove, profile: { ...glove.profile, bodyStability: 0 } }], surfaces: [] });
  expect(result).toMatchObject({ kind: 'rebound', ball: { velocity: { z: -5 } }, retention: { outcome: { kind: 'live-ball' } } });
});
it('preserves all simultaneous contacts rather than choosing an actor or contact kind', () => {
  const w = world('glove');
  expect(deriveBattedBallContactResponse({ world: { ...w, actors: [...w.actors, ...world().actors] },
    actors: [body, glove], surfaces: [] })).toMatchObject({ kind: 'unresolved', reason: 'simultaneous',
    world: { contacts: [{ kind: 'actor', role: 'body' }, { kind: 'actor', role: 'glove' }] } });
});
it('does not invent an outward normal when actor and ball centers coincide', () => {
  const w = world();
  expect(deriveBattedBallContactResponse({ world: { ...w, actors: w.actors.map((a) => ({ ...a,
    primitive: { ...a.primitive, startCenter: contact.ballCenter } })) }, actors: [body], surfaces: [] }))
    .toMatchObject({ kind: 'unresolved', reason: 'degenerate_normal' });
});
it.each([0, 2 ** 52])('uses continuous surface geometry before the ball crosses its finite face at original tick %s', (at) => {
  const c = { ...contact, tick: at, ballCenter: { x: -0.2, y: 0.85, z: 0 },
    exitVelocity: { x: parameters.ticksPerSecond, y: parameters.ticksPerSecond, z: 0 } };
  const w = world('body', c);
  const surface = { surfaceId: 'panel', start: { x: -0.1, z: parameters.ballRadius }, end: { x: 0.1, z: parameters.ballRadius }, minimumHeight: 0.9, maximumHeight: 1.1 };
  const result = deriveBattedBallContactResponse({ world: { ...w, throughTick: at + 1, actors: [], surfaces: [surface] }, actors: [], surfaces: [{ surfaceId: 'panel', material }] });
  expect(result).toMatchObject({ kind: 'rebound', ball: { tick: at + 1 } });
  if (result.kind !== 'rebound') throw new Error('finite panel must respond');
  expect(result.geometry.ball.position.x).toBeLessThan(0.1);
  expect(result.geometry.normal!.z).toBeLessThan(0);
  expect(result.ball.velocity.y).toBeCloseTo(c.exitVelocity.y * (1 - material.tangentialDamping));
});
it('reflects the incoming side at a continuous wall root rather than its already crossed quantized sample', () => {
  const c = { ...contact, exitVelocity: { x: 0, y: 0, z: 1_000_000 } };
  const w = world('body', c);
  const surface = { surfaceId: 'fast-wall', start: { x: -1, z: 0.2 }, end: { x: 1, z: 0.2 }, minimumHeight: 0, maximumHeight: 2 };
  expect(deriveBattedBallContactResponse({ world: { ...w, throughTick: 1, actors: [], surfaces: [surface] }, actors: [], surfaces: [{ surfaceId: surface.surfaceId, material }] }))
    .toMatchObject({ kind: 'rebound', ball: { tick: 1, velocity: { z: -500_000 } }, geometry: { normal: { z: -1 } } });
});
it.each(['body', 'surface'] as const)('preserves a continuous %s contact infinitesimally after the rounded event tick', (kind) => {
  const w = world();
  const surface = { surfaceId: 'rounding-wall', start: { x: -1, z: 1.036600000000001 },
    end: { x: 1, z: 1.036600000000001 }, minimumHeight: 0, maximumHeight: 2 };
  const actual = kind === 'body' ? { ...w, actors: w.actors.map((a) => ({ ...a,
    primitive: { ...a.primitive, startCenter: { ...a.primitive.startCenter, z: 1.136600000000001 } } })) }
    : { ...w, actors: [], surfaces: [surface] };
  expect(deriveBattedBallContactResponse({ world: actual, actors: kind === 'body' ? [body] : [],
    surfaces: kind === 'surface' ? [{ surfaceId: surface.surfaceId, material }] : [] }))
    .toMatchObject({ kind: 'rebound', ball: { tick: 100_000, velocity: { z: -5 } } });
});
it('keeps short-horizon airborne and original sole-ground response without manufacturing later contacts', () => {
  const w = world();
  expect(deriveBattedBallContactResponse({ world: { ...w, throughTick: 1 }, actors: [body], surfaces: [] }).kind).toBe('airborne');
  const p = { ...parameters, gravityY: -9.81 };
  const f = createBattedBallFlightEvidence({ contact, parameters: p, searchDurationTicks: 1_000_000 });
  expect(deriveBattedBallContactResponse({ world: { ...w, actors: [], parameters: p, flight: f }, actors: [], surfaces: [] }))
    .toMatchObject({ kind: 'ground', ball: f.firstGroundContact!.state });
});
it.each([
  { actors: [] }, { actors: [body, body] }, { actors: [{ ...body, playerId: 'other' }] },
  { actors: [{ ...body, profile: { ...body.profile, material: { ...material, restitution: NaN } } }] },
])('rejects missing, duplicate, wrong-player or malformed complete response calibration %j', ({ actors }) => {
  expect(() => deriveBattedBallContactResponse({ world: world(), actors, surfaces: [] })).toThrow();
});
it('rejects incompatible glove ball radius/clock even when its contact is later than the horizon', () => {
  for (const change of [{ ballRadiusMeters: 0.1 }, { ticksPerSecond: 1 }]) {
    expect(() => deriveBattedBallContactResponse({ world: { ...world('glove'), throughTick: 1 },
      actors: [{ ...glove, profile: { ...glove.profile, parameters: { ...retention, ...change } } }], surfaces: [] })).toThrow();
  }
});
