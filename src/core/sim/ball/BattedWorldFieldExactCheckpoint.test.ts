import { expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import * as field from './BattedWorldFieldMotion';
import type { BattedWorldFieldRetainedCheckpointInput, BattedWorldFieldMotion } from './BattedWorldFieldMotion';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import { quantizeEventTick } from '../ExactEventTime';
const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const material = { restitution: 1, tangentialDamping: 0, spinDamping: 0 };
const fixture = (elapsedSeconds = 0) => {
  const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, ticksPerSecond: 1, gravityY: 0, ballRadius: 0.125, groundRollingDecelerationMps2: 1 };
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  const geometry = field.createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: 0, z: 0 },
    firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }, bases: {
    home: base(0, 0), first: base(3, 0), second: base(3, 3), third: base(0, 3) } },
    baseModels: { home: { bottomY: 0, material }, first: { bottomY: 0, material }, second: { bottomY: 0, material }, third: { bottomY: 0, material } } });
  const contact = { tick: 0, ballCenter: v(0, 2), point: v(0, 2), batPoint: v(0, 2), normal: v(1),
    segmentT: 0.5, exitVelocity: v(1), exitSpin: v(0, 0, 2) };
  const actors = [{ playerId: 'defender', primitive: { role: 'body' as const, radius: 0.125, startTick: 0, endTick: 3,
    ticksPerSecond: 1, startCenter: v(20, 2, 20), startVelocity: v(0.2, 0.1, 0.3), acceleration: v(0.1, 0.2, 0.3) } }];
  const flight = createBattedBallFlightEvidence({ contact, parameters, searchDurationTicks: 3 });
  const response: BattedBallContactResponseInput = { world: { flight, parameters, throughTick: 3, actors, surfaces: [] },
    actors: [{ playerId: 'defender', profile: { role: 'body', material } }], surfaces: [] };
  const cursor = { moment: { originTick: 0, elapsedSeconds, ball: { ...flight.initialBall,
    tick: quantizeEventTick(0, elapsedSeconds, 1), position: v(elapsedSeconds, 2) } }, previousContacts: [] };
  return { response, geometry, actors, cursor, carrierPlayerId: null, checkpointThroughElapsedSeconds: 1.25 };
};
type ExactInput = Omit<BattedWorldFieldRetainedCheckpointInput, 'checkpointThroughTick'> & { checkpointThroughElapsedSeconds: number };
const advance = (input: ExactInput): BattedWorldFieldMotion => {
  expect(field.advanceBattedWorldFieldMotionExactCheckpointV1).toBeTypeOf('function');
  return field.advanceBattedWorldFieldMotionExactCheckpointV1(input);
};
const next = (input: ExactInput, result: BattedWorldFieldMotion): ExactInput => ({ ...input, cursor: result.motion.cursor!, actors: result.motion.actors,
  carrierPlayerId: result.motion.carrierPlayerId });
it('retains original anchored actors and the exact contact-free tail endpoint', () => {
  const input = fixture(0.75), endpoint = 1 + 8e-10;
  const result = advance({ ...input, checkpointThroughElapsedSeconds: endpoint });
  expect(result.motion.world).toMatchObject({ kind: 'moving', phase: 'airborne', moment: { elapsedSeconds: endpoint, ball: { tick: 1 } } });
  expect(result.motion.actors).toEqual(input.actors);
  expect(result.motion.cursor!.moment).toEqual(result.motion.world.moment);
  expect(result.motion.response.cursor).toEqual(result.motion.cursor);
  expect(Object.isFrozen(result.motion.cursor!.moment.ball)).toBe(true);
});
it('rejects a T-covered actor before even a contact-free T-tail checkpoint and allows original T+1 coverage', () => {
  const input = fixture(), endpoint = 1 + 8e-10;
  expect(() => advance({ ...input, checkpointThroughElapsedSeconds: endpoint, actors: input.actors.map((a) => ({ ...a, primitive: { ...a.primitive, endTick: 1 } })) })).toThrow(/coverage/);
  expect(advance({ ...input, checkpointThroughElapsedSeconds: endpoint, actors: input.actors.map((a) => ({ ...a, primitive: { ...a.primitive, endTick: 2 } })) }).motion.world.moment.elapsedSeconds).toBe(endpoint);
});
it('executes three distinct same-bucket contacts in sequence using their actual rebound cursors', () => {
  const input = fixture(), surfaces = [{ surfaceId: 'right', start: { x: 1.125, z: -1 }, end: { x: 1.125, z: 1 }, minimumHeight: 1, maximumHeight: 3 },
    { surfaceId: 'left', start: { x: -0.375, z: -1 }, end: { x: -0.375, z: 1 }, minimumHeight: 1, maximumHeight: 3 }];
  const scope = { ...input, response: { ...input.response, world: { ...input.response.world, surfaces }, surfaces: surfaces.map((s) => ({ surfaceId: s.surfaceId, material })) },
    cursor: { ...input.cursor, moment: { ...input.cursor.moment, ball: { ...input.cursor.moment.ball, velocity: v(4) } } }, checkpointThroughElapsedSeconds: 0.9 };
  const first = advance(scope), second = advance(next(scope, first)), third = advance(next(scope, second));
  expect([first, second, third].map((r) => r.motion.world.moment.elapsedSeconds)).toEqual([0.25, 0.5625, 0.875]);
  for (const result of [first, second, third]) {
    expect(result.motion.world).toMatchObject({ kind: 'boundary', moment: { ball: { tick: 1 } } });
    if (result.motion.world.kind !== 'boundary') throw new Error('expected actual contact');
    expect(result.motion.world.contacts).toHaveLength(1);
    expect(result.motion.response.kind).toBe('rebound');
    expect(result.motion.actors).toEqual(input.actors);
  }
  const end = advance(next(scope, third));
  expect(end.motion.world).toMatchObject({ kind: 'moving', moment: { elapsedSeconds: 0.9 } });
  expect(end.motion.cursor!.previousContacts).toEqual([{ kind: 'surface', surfaceId: 'right' }, { kind: 'surface', surfaceId: 'left' }]);
});
it('preserves actual contact just beyond mathematical T and does not normalize it to the requested endpoint', () => {
  const input = fixture(), eventTime = 1 + 4e-10;
  const actor = { ...input.actors[0], primitive: { ...input.actors[0].primitive, startCenter: v(eventTime + 0.25, 2), startVelocity: v(), acceleration: v() } };
  const result = advance({ ...input, actors: [actor], checkpointThroughElapsedSeconds: 1 + 8e-10 });
  expect(result.motion.world.moment.elapsedSeconds).toBe(eventTime);
  expect(result.motion.world.moment.ball.tick).toBe(1);
  expect(result.motion.response.kind).toBe('rebound');
});
it('keeps fractional actor anchors unchanged across repeated exact checkpoints', () => {
  const input = fixture(0.125), anchored = { ...input, actors: input.actors.map((a) => ({ ...a, startElapsedSeconds: 0.125 })) };
  const first = advance({ ...anchored, checkpointThroughElapsedSeconds: 0.625 });
  const second = advance(next(anchored, first)), once = advance(anchored);
  expect(second).toEqual(once);
  expect(second.motion.actors).toEqual(anchored.actors);
});
it('preserves rolling-stop response and then advances the actual resting cursor', () => {
  const input = fixture(), scope = { ...input, cursor: { ...input.cursor, moment: { ...input.cursor.moment,
    ball: { ...input.cursor.moment.ball, position: v(10, 0.125) } } } };
  const first = advance(scope);
  expect(first.motion.response.kind).toBe('rolling_stop');
  expect(first.motion.world).toMatchObject({ kind: 'boundary', phase: 'rolling', moment: { elapsedSeconds: 1 } });
  const rest = advance(next(scope, first));
  expect(rest.motion.response.kind).toBe('resting');
  expect(rest.motion.world).toMatchObject({ kind: 'resting', phase: 'resting', moment: { elapsedSeconds: 1.25, ball: { position: v(10.5, 0.125), velocity: v() } } });
});
it('preserves a true simultaneous contact set and its unresolved null cursor', () => {
  const input = fixture(), surface = { surfaceId: 'wall', start: { x: 1.125, z: -1 }, end: { x: 1.125, z: 1 }, minimumHeight: 1, maximumHeight: 3 };
  const actor = { ...input.actors[0], primitive: { ...input.actors[0].primitive, startCenter: v(1.25, 2), startVelocity: v(), acceleration: v() } };
  const result = advance({ ...input, actors: [actor], response: { ...input.response, world: { ...input.response.world, surfaces: [surface] }, surfaces: [{ surfaceId: surface.surfaceId, material }] } });
  expect(result.motion.response).toEqual({ kind: 'unresolved', reason: 'simultaneous', cursor: null });
  expect(result.motion.cursor).toBeNull();
});
it('continues retained carried velocity at the exact time and preserves competing-contact pending semantics', () => {
  const input = fixture(), actor = { ...input.actors[0], primitive: { ...input.actors[0].primitive, role: 'glove' as const,
    startCenter: v(0, 2), startVelocity: v(1), acceleration: v(0.25) } };
  const profile = { role: 'glove' as const, pocketCenterOffset: v(), bodyStability: 1,
    parameters: { ticksPerSecond: 1, ballRadiusMeters: 0.125, ballMassKg: 0.145, pocketRadiusMeters: 0.2,
      centerRetentionCapacityJ: 10, captureDissipationPowerW: 100, failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } };
  const response = { ...input.response, world: { ...input.response.world, actors: [actor] }, actors: [{ playerId: actor.playerId, profile }] };
  const scope = { ...input, response, actors: [actor], carrierPlayerId: actor.playerId, checkpointThroughElapsedSeconds: 0.5 };
  const first = advance(scope), second = advance({ ...next(scope, first), checkpointThroughElapsedSeconds: 1.25 });
  expect(second.motion.response.kind).toBe('carried');
  expect(second.motion.world.moment.ball.position).toEqual(v(1.4453125, 2));
  expect(second.motion.world.moment.ball.velocity).toEqual(v(1.3125));
  expect(second.motion.actors).toEqual([actor]);
  const surface = { surfaceId: 'wall', start: { x: 1.25, z: -1 }, end: { x: 1.25, z: 1 }, minimumHeight: 1, maximumHeight: 3 };
  const hit = advance({ ...scope, checkpointThroughElapsedSeconds: 1.25,
    response: { ...response, world: { ...response.world, surfaces: [surface] }, surfaces: [{ surfaceId: surface.surfaceId, material }] } });
  expect(hit.motion.response).toEqual({ kind: 'unresolved', reason: 'carried_contact', cursor: null });
  expect(hit.motion.world.moment.elapsedSeconds).toBe(1);
});
it('rejects zero progress, backwards cuts, exhausted coverage and command/coverage injection', () => {
  const input = fixture(0.5);
  for (const checkpointThroughElapsedSeconds of [0.5, 0.25, 3.1, NaN, Infinity]) expect(() => advance({ ...input, checkpointThroughElapsedSeconds })).toThrow();
  expect(advance({ ...input, checkpointThroughElapsedSeconds: 3 }).motion.world.moment.elapsedSeconds).toBe(3);
  expect(() => advance({ ...input, commands: [] } as ExactInput)).toThrow();
  expect(() => advance({ ...input, coverageThroughTick: 4 } as ExactInput)).toThrow();
  expect(() => advance({ ...input, actors: [] })).toThrow();
  expect(() => advance({ ...input, actors: [...input.actors, ...input.actors] })).toThrow();
  expect(() => advance({ ...input, cursor: null } as unknown as ExactInput)).toThrow();
});
it('rejects active data without invoking it and preserves all input bytes', () => {
  const input = fixture(), before = JSON.stringify(input); let called = false;
  expect(() => advance({ ...input, get checkpointThroughElapsedSeconds() { called = true; return 1; } })).toThrow();
  expect(called).toBe(false);
  advance(input);
  expect(JSON.stringify(input)).toBe(before);
});
it('keeps the archived retained integer checkpoint byte-identical', () => {
  const { checkpointThroughElapsedSeconds: _, ...input } = fixture(0.125);
  const result = field.advanceBattedWorldFieldMotionCheckpoint({ ...input, checkpointThroughTick: 1 });
  expect(createHash('sha256').update(JSON.stringify(result)).digest('hex')).toBe('2fa0b9974c8057b30e49e8cfc385bf37ab85edabb3752b0d256fb2a233c537fa');
});

it('keeps a real same-time overlap at its occurrence and preserves its unresolved cursor', () => {
  const input = fixture(), actor = { ...input.actors[0], primitive: { ...input.actors[0].primitive, startCenter: v(0, 2), startVelocity: v(), acceleration: v() } };
  const result = advance({ ...input, actors: [actor] });
  expect(result.motion.world).toMatchObject({ kind: 'boundary', moment: { elapsedSeconds: 0 } });
  expect(result.motion.response).toEqual({ kind: 'unresolved', reason: 'degenerate_normal', cursor: null });
});
it('executes the first exact base boundary with original material and base sidecar evidence', () => {
  const input = fixture(), scope = { ...input, checkpointThroughElapsedSeconds: 3, cursor: { ...input.cursor, moment: { ...input.cursor.moment,
    ball: { ...input.cursor.moment.ball, position: v(1, 0.5) } } } };
  const result = advance(scope);
  expect(result.baseContacts).toMatchObject([{ kind: 'base', baseId: 'first', moment: { elapsedSeconds: 1.625 } }]);
  expect(result.motion.response.kind).toBe('rebound');
  expect(result.motion.cursor!.moment.ball.velocity.x).toBe(-1);
  const continued = advance({ ...next(scope, result), checkpointThroughElapsedSeconds: 1.75 });
  expect(continued.motion.world.kind).toBe('moving');
  expect(continued.motion.cursor!.previousContacts).toEqual([{ kind: 'surface', surfaceId: field.battedWorldBaseSurfaceId('first') }]);
});

it('refuses an outside actor/base endpoint instead of manufacturing a rebound cursor', () => {
  const start = 5.066471592429789e-6, end = 0.847855530938653, duration = end - start, input = fixture(start);
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  const geometry = field.createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: -100, z: 0 },
    firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } }, bases: { home: base(-100, 0), first: base(duration + 0.375, 0),
    second: base(duration + 0.375, 100), third: base(-100, 100) } }, baseModels: input.geometry.baseModels });
  const actor = { ...input.actors[0], primitive: { ...input.actors[0].primitive, startCenter: v(duration + 0.25, 0.5), startVelocity: v(), acceleration: v() } };
  const scope = { ...input, geometry, actors: [actor], cursor: { ...input.cursor, moment: { ...input.cursor.moment,
    ball: { ...input.cursor.moment.ball, position: v(0, 0.5) } } }, checkpointThroughElapsedSeconds: end };
  const long = advance({ ...scope, checkpointThroughElapsedSeconds: 1 });
  expect(long.motion.response).toEqual({ kind: 'unresolved', reason: 'simultaneous', cursor: null });
  expect(() => advance(scope)).toThrow(/exact.*horizon/);
});
it('keeps a base contact at the original ground-clipped local cut and refuses a fabricated ground cursor', () => {
  const start = 0.0006065495116636157, local = 0.06196985277347267, input = fixture(start);
  const base = (x: number, z: number) => ({ region: { center: { x, z }, halfSize: { x: 0.25, z: 0.25 }, rotationRadians: 0 }, surfaceHeightMeters: 1 });
  const geometry = field.createBattedWorldFieldGeometry({ baseGeometry: { field: { homePlate: { x: -100, z: 0 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } },
    bases: { home: base(-100, 0), first: base(local + 0.375, 0), second: base(local + 0.375, 100), third: base(-100, 100) } }, baseModels: input.geometry.baseModels });
  const result = advance({ ...input, geometry, cursor: { ...input.cursor, moment: { ...input.cursor.moment, ball: { ...input.cursor.moment.ball,
    position: v(0, local + 0.125), velocity: v(1, -1) } } }, checkpointThroughElapsedSeconds: 1 });
  expect(result.motion.response).toEqual({ kind: 'unresolved', reason: 'simultaneous', cursor: null });
  expect(result.baseContacts).toHaveLength(1);
});
