import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import type { BatBallContactResult } from '../contact/BatBallContact';
import type { DefenderPhysicalPrimitiveSegment } from '../fielding/DefenderPhysicalPrimitive';
import { deriveFirstBattedWorldContact, type BattedWorldSurface } from './BattedBallWorldContacts';

const contact: BatBallContactResult = { tick: 0, ballCenter: { x: 0, y: 1, z: 0 }, point: { x: 0, y: 1, z: 0 },
  batPoint: { x: 0, y: 1, z: 0 }, normal: { x: 0, y: 0, z: 1 }, segmentT: 0.5,
  exitVelocity: { x: 0, y: 0, z: 10 }, exitSpin: { x: 0, y: 0, z: 0 } };
const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, groundRollingDecelerationMps2: 4 };
const flight = () => createBattedBallFlightEvidence({ contact, searchDurationTicks: 2_000_000, parameters });
const primitive = (role: DefenderPhysicalPrimitiveSegment['role'] = 'glove'): DefenderPhysicalPrimitiveSegment => ({
  role, radius: 0.08, startTick: 0, endTick: 2_000_000, ticksPerSecond: 1_000_000,
  startCenter: { x: 0, y: 1, z: 1 }, startVelocity: { x: 0, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 },
});
const wall: BattedWorldSurface = { surfaceId: 'wall', start: { x: -2, z: 2 }, end: { x: 2, z: 2 },
  minimumHeight: 0, maximumHeight: 3 };

it('retains a live short horizon and derives the actual earliest ground in the absence of modeled actor/surface contacts', () => {
  expect(deriveFirstBattedWorldContact({ flight: flight(), parameters, throughTick: 1_000, actors: [], surfaces: [] })).toMatchObject({ kind: 'airborne', throughTick: 1_000 });
  const actual = flight();
  expect(deriveFirstBattedWorldContact({ flight: actual, parameters, throughTick: 2_000_000, actors: [], surfaces: [] })).toMatchObject({
    kind: 'contact', tick: actual.firstGroundContact!.tick, contacts: [{ kind: 'ground' }],
  });
});

it('finds a glove before the projected ground and a later wall rather than deciding catch or fair/foul', () => {
  const result = deriveFirstBattedWorldContact({ flight: flight(), parameters, throughTick: 2_000_000,
    actors: [{ playerId: 'actual-fielder', primitive: primitive() }], surfaces: [wall] });
  expect(result.kind).toBe('contact');
  if (result.kind !== 'contact') throw new Error('fixture must touch the glove');
  expect(result.tick).toBeLessThan(flight().firstGroundContact!.tick);
  expect(result.contacts).toMatchObject([{ kind: 'actor', playerId: 'actual-fielder', role: 'glove' }]);
  expect(result).not.toHaveProperty('outcome');
});

it('preserves simultaneous physical body and glove contacts instead of picking a player by identifier', () => {
  const result = deriveFirstBattedWorldContact({ flight: flight(), parameters, throughTick: 2_000_000,
    actors: [{ playerId: 'a', primitive: primitive('body') }, { playerId: 'z', primitive: primitive() }], surfaces: [] });
  expect(result).toMatchObject({ kind: 'contact', contacts: [
    { kind: 'actor', playerId: 'a', role: 'body' }, { kind: 'actor', playerId: 'z', role: 'glove' },
  ] });
});

it('finds finite wall faces, edges and corners without a simulation frame step', () => {
  const p = { ...parameters, gravityY: 0 };
  const run = (x: number, y: number) => {
    const f = createBattedBallFlightEvidence({ contact: { ...contact, ballCenter: { x, y, z: 0 } }, searchDurationTicks: 1_000_000, parameters: p });
    return deriveFirstBattedWorldContact({ flight: f, parameters: p, throughTick: 1_000_000, actors: [], surfaces: [wall] });
  };
  for (const [x, y] of [[0, 1], [2.02, 1], [2.02, 3.02]]) {
    expect(run(x, y)).toMatchObject({ kind: 'contact', contacts: [{ kind: 'surface', surfaceId: 'wall' }] });
  }
  expect(run(2.04, 1).kind).toBe('airborne');
  expect(run(0, 3.04).kind).toBe('airborne');
});

it('rejects malformed later colliders, duplicate actor roles, incompatible clocks and mismatched flight evidence', () => {
  const base = { flight: flight(), parameters, throughTick: 2_000_000, actors: [], surfaces: [] };
  for (const input of [
    { ...base, actors: [{ playerId: 'x', primitive: primitive() }, { playerId: 'x', primitive: primitive() }] },
    { ...base, actors: [{ playerId: 'x', primitive: { ...primitive(), ticksPerSecond: 1 } }] },
    { ...base, surfaces: [wall, { ...wall, surfaceId: 'invalid', minimumHeight: 4 }] },
    { ...base, flight: { ...base.flight, initialBall: { ...base.flight.initialBall, velocity: { x: 1, y: 0, z: 0 } } } },
  ]) expect(() => deriveFirstBattedWorldContact(input)).toThrow();
});

it('accepts semantically identical original flight after canonical archive key ordering', () => {
  const archived = JSON.parse(JSON.stringify(flight(), (_key, value) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value));
  expect(deriveFirstBattedWorldContact({ flight: archived, parameters, throughTick: 2_000_000, actors: [], surfaces: [] })).toMatchObject({ kind: 'contact', contacts: [{ kind: 'ground' }] });
});

it.each([1, 1_000_000])('retains finite wall edge contact before rounding to a tick at %s ticks per second', (ticksPerSecond) => {
  const p = { ...parameters, gravityY: 0, ticksPerSecond };
  const actual = { ...contact, ballCenter: { x: -0.2, y: 1, z: 0 }, exitVelocity: { x: ticksPerSecond, y: ticksPerSecond / 2, z: 0 } };
  const f = createBattedBallFlightEvidence({ contact: actual, parameters: p, searchDurationTicks: 1 });
  expect(deriveFirstBattedWorldContact({ flight: f, parameters: p, throughTick: 1, actors: [], surfaces: [{
    surfaceId: 'finite-panel', start: { x: -0.1, z: p.ballRadius }, end: { x: 0.1, z: p.ballRadius }, minimumHeight: 0.9, maximumHeight: 1.1,
  }] })).toMatchObject({ kind: 'contact', tick: 1, contacts: [{ kind: 'surface', surfaceId: 'finite-panel' }] });
});

it('does not lose continuous finite-wall contact when the original absolute tick is large', () => {
  const at = 2 ** 52, p = { ...parameters, gravityY: 0 };
  const c = { ...contact, tick: at, ballCenter: { x: -0.2, y: 0.85, z: 0 }, exitVelocity: { x: p.ticksPerSecond, y: p.ticksPerSecond, z: 0 } };
  const f = createBattedBallFlightEvidence({ contact: c, parameters: p, searchDurationTicks: 1 });
  expect(deriveFirstBattedWorldContact({ flight: f, parameters: p, throughTick: at + 1, actors: [], surfaces: [{
    surfaceId: 'finite-panel', start: { x: -0.1, z: p.ballRadius }, end: { x: 0.1, z: p.ballRadius }, minimumHeight: 0.9, maximumHeight: 1.1,
  }] })).toMatchObject({ kind: 'contact', tick: at + 1, contacts: [{ kind: 'surface' }] });
});
