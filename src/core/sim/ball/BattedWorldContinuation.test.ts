import { expect, it } from 'vitest';
import type { BatBallContactResult } from '../contact/BatBallContact';
import { createBattedBallFlightEvidence } from './BattedBallFlightEvidence';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import type { BattedBallContactResponseInput } from './BattedBallContactResponse';
import type { DefenderPhysicalPrimitiveRole } from '../fielding/DefenderPhysicalPrimitive';
import { deriveBattedWorldContinuation } from './BattedWorldContinuation';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const material = { restitution: 0.5, tangentialDamping: 0, spinDamping: 0 };
const contact: BatBallContactResult = { tick: 0, ballCenter: v(0, 1, 0), point: v(0, 1, 0), batPoint: v(0, 1, 0),
  normal: v(0, 0, 1), segmentT: 0.5, exitVelocity: v(0, 0, 10), exitSpin: v(0, 0, 2) };
const parameters = { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.1, groundRestitution: 0.5, groundFriction: 0.5 };
const wall = { surfaceId: 'wall', start: { x: -1, z: 1 }, end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
const original = (c = contact, p = parameters): BattedBallContactResponseInput => ({ world: {
  flight: createBattedBallFlightEvidence({ contact: c, parameters: p, searchDurationTicks: 1_000_000 }), parameters: p,
  throughTick: c.tick + 1_000_000, actors: [], surfaces: [wall] }, actors: [], surfaces: [{ surfaceId: wall.surfaceId, material }] });
const laterActor = (role: DefenderPhysicalPrimitiveRole, stability = 1): BattedBallContactResponseInput => {
  const base = original(), primitive = (r: DefenderPhysicalPrimitiveRole, z: number) => ({ role: r, radius: 0.1, startTick: 0,
    endTick: 2_000_000, ticksPerSecond: parameters.ticksPerSecond, startCenter: v(0, 1, z), startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) });
  return { ...base, world: { ...base.world, actors: [{ playerId: 'front', primitive: primitive('body', 1) }, { playerId: 'next', primitive: primitive(role, -1) }] },
    actors: [{ playerId: 'front', profile: { role: 'body', material } }, { playerId: 'next', profile: role !== 'glove' ? { role, material }
      : { role, pocketCenterOffset: v(0, 0, 0.2), bodyStability: stability, parameters: { ticksPerSecond: parameters.ticksPerSecond, ballMassKg: 0.145,
        ballRadiusMeters: parameters.ballRadius, pocketRadiusMeters: 0.2, centerRetentionCapacityJ: 20, captureDissipationPowerW: 1000,
        failedContactRestitution: 0.5, failedTangentialDamping: 0, failedSpinDamping: 0 } } }] };
};
it('owns the original response and advances from its continuous root, not a transported ball or old bat flight', () => {
  const trace = deriveBattedWorldContinuation({ response: original(), throughTicks: [1_000_000] });
  expect(trace.original.kind).toBe('rebound');
  expect(trace.initialCursor!.moment.elapsedSeconds).toBeCloseTo(0.09, 12);
  expect(trace.steps[0]).toMatchObject({ world: { kind: 'moving' }, response: { kind: 'moving' } });
  expect(trace.cursor!.moment.ball.position.z).toBeCloseTo(-3.65, 12);
  expect(trace.cursor!.moment.ball.velocity.z).toBe(-5);
  expect(trace).not.toHaveProperty('playEnd');
});
it('retains original ground archives but applies an immediate descending ground impulse exactly once', () => {
  const c = { ...contact, ballCenter: v(0, parameters.ballRadius, 0), exitVelocity: v(0, -2, 4) };
  const input = { ...original(c), world: { ...original(c).world, surfaces: [] }, surfaces: [] };
  const trace = deriveBattedWorldContinuation({ response: input, throughTicks: [100_000, 200_000] });
  expect(trace.original).toMatchObject({ kind: 'ground', ball: { velocity: v(0, -2, 4) } });
  expect(trace.initialCursor!.moment.ball.velocity).toEqual(v(0, 1, 2));
  expect(trace.steps.map((s) => s.world.kind)).toEqual(['moving', 'moving']);
  expect(trace.cursor!.moment.ball.velocity).toEqual(v(0, 1, 2));
});
it('does not apply friction or reflection again to an already responded original ground', () => {
  const p = { ...parameters, gravityY: -10 };
  const input = { ...original(contact, p), world: { ...original(contact, p).world, surfaces: [] }, surfaces: [] };
  const trace = deriveBattedWorldContinuation({ response: input, throughTicks: [600_000] });
  expect(trace.original.kind).toBe('ground');
  if (trace.original.kind !== 'ground') throw new Error('ground fixture');
  expect(trace.initialCursor!.moment.ball).toEqual(trace.original.ball);
  expect(trace.initialCursor!.moment.ball.velocity.z).toBe(5);
});
it('keeps subsequent descending ground, response and actual rolling state in the same physical prefix', () => {
  const p = { ...parameters, gravityY: -10, groundRestitution: 0, restingVerticalSpeed: 0.5 };
  const input = original(contact, p);
  const trace = deriveBattedWorldContinuation({ response: input, throughTicks: [1_000_000, 1_000_000] });
  expect(trace.steps[0]).toMatchObject({ world: { kind: 'boundary', contacts: [{ kind: 'ground' }] }, response: { kind: 'ground' } });
  expect(trace.steps[1]).toMatchObject({ world: { kind: 'moving', phase: 'rolling' } });
  expect(trace.cursor!.moment.ball.velocity.y).toBe(0);
});
it('retains later surface contacts and applies the material response to their own actual geometry', () => {
  const second = { ...wall, surfaceId: 'behind', start: { x: -1, z: -1 }, end: { x: 1, z: -1 } };
  const base = original(), input = { ...base, world: { ...base.world, surfaces: [wall, second] },
    surfaces: [...base.surfaces, { surfaceId: second.surfaceId, material }] };
  const trace = deriveBattedWorldContinuation({ response: input, throughTicks: [1_000_000, 1_000_000] });
  expect(trace.steps[0]).toMatchObject({ world: { contacts: [{ kind: 'surface', surfaceId: 'behind' }] }, response: { kind: 'rebound' } });
  expect(trace.steps[0].response.cursor!.moment.ball.velocity.z).toBe(2.5);
  expect(trace.steps[1].world.kind).toBe('moving');
});
it('rejects horizons before the owned cursor and redundant no-progress requests', () => {
  expect(() => deriveBattedWorldContinuation({ response: original(), throughTicks: [1] })).toThrow();
  expect(() => deriveBattedWorldContinuation({ response: original(), throughTicks: [1_000_000, 1_000_000] })).toThrow('progress');
});
it('cannot continue an unresolved original contact by selecting one of its simultaneous facts', () => {
  const base = original();
  const second = { ...wall, surfaceId: 'same' };
  const input = { ...base, world: { ...base.world, surfaces: [wall, second] },
    surfaces: [...base.surfaces, { surfaceId: second.surfaceId, material }] };
  expect(() => deriveBattedWorldContinuation({ response: input, throughTicks: [1_000_000] })).toThrow('pending');
});
it('connects a later true glove contact to a capture candidate without granting uninterrupted possession', () => {
  const response = laterActor('glove');
  const trace = deriveBattedWorldContinuation({ response, throughTicks: [1_000_000] });
  expect(trace.original.kind).toBe('rebound');
  expect(trace.steps[0]).toMatchObject({ world: { kind: 'boundary', contacts: [{ kind: 'actor', playerId: 'next', role: 'glove' }] },
    response: { kind: 'capture_candidate', cursor: null } });
  expect(trace.cursor).toBeNull();
  expect(trace.steps[0].response).not.toHaveProperty('possession');
  expect(() => deriveBattedWorldContinuation({ response, throughTicks: [1_000_000, 2_000_000] })).toThrow('pending');
});
it('keeps a failed later glove contact as its real reflected live ball through a following segment', () => {
  const trace = deriveBattedWorldContinuation({ response: laterActor('glove', 0), throughTicks: [1_000_000, 1_000_000] });
  expect(trace.steps[0]).toMatchObject({ response: { kind: 'rebound', retention: { outcome: { kind: 'live-ball' } }, cursor: { moment: { ball: { velocity: { z: 2.5 } } } } } });
  expect(trace.cursor!.moment.ball.position.z).toBeCloseTo(0.7, 12);
});
it.each(['body', 'tag_hand', 'left_foot', 'right_foot'] as const)('does not create a glove or retention for a later true %s contact', (role) => {
  const trace = deriveBattedWorldContinuation({ response: laterActor(role), throughTicks: [1_000_000] });
  expect(trace.steps[0]).toMatchObject({ world: { contacts: [{ kind: 'actor', role }] }, response: { kind: 'rebound' } });
  expect(trace.steps[0].response).not.toHaveProperty('retention');
});
it('keeps an ongoing wall and a later actor unresolved with both actual contacts', () => {
  const c = { ...contact, ballCenter: v(0, 1, 0.1), exitVelocity: v(1, 0, 0) }, surface = { ...wall, start: { x: -2, z: 0 }, end: { x: 2, z: 0 } };
  const base = original(c), response: BattedBallContactResponseInput = { ...base, world: { ...base.world,
    actors: [{ playerId: 'next', primitive: { role: 'body', radius: 0.1, startTick: 0, endTick: 2_000_000, ticksPerSecond: parameters.ticksPerSecond,
      startCenter: v(1.2, 1, 0.1), startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) } }], surfaces: [surface] },
    actors: [{ playerId: 'next', profile: { role: 'body', material } }] };
  const trace = deriveBattedWorldContinuation({ response, throughTicks: [2_000_000] });
  expect(trace.steps[0]).toMatchObject({ world: { contacts: [{ kind: 'actor' }, { kind: 'surface', continuing: true }] },
    response: { kind: 'unresolved', reason: 'simultaneous' } });
});
