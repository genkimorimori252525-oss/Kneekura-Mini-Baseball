import { expect, it } from 'vitest';
import type { BattedBallInitialState } from '../contact/BatBallContact';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { deriveBallWorldContinuation, type BallWorldContinuationInput } from './BallWorldContinuation';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const ball = (position = v(0, 1, 0), velocity = v(0, 0, 10), tick = 0): BattedBallInitialState => ({ tick, position, velocity, spin: v(0, 0, 2) });
const input = (initial = ball(), throughTick = 1_000_000): BallWorldContinuationInput => ({
  moment: { originTick: initial.tick, elapsedSeconds: 0, ball: initial }, throughTick,
  parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.1, groundRollingDecelerationMps2: 1 },
  actors: [], surfaces: [], previousContacts: [],
});
const actor = (playerId: string, center: ReturnType<typeof v>, velocity = v(0, 0, 0), acceleration = v(0, 0, 0)) => ({ playerId,
  primitive: { role: 'body' as const, radius: 0.1, startTick: 0, endTick: 3_000_000, ticksPerSecond: 1_000_000,
    startCenter: center, startVelocity: velocity, acceleration } });
const wall = { surfaceId: 'wall', start: { x: -1, z: 1 }, end: { x: 1, z: 1 }, minimumHeight: 0, maximumHeight: 2 };
it('continues actual deflected velocity to the next actor instead of restoring an original bat forecast', () => {
  const result = deriveBallWorldContinuation({ ...input(ball(v(0, 1, 0.8), v(0, 0, -5))), actors: [actor('next', v(0, 1, 0))] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor', playerId: 'next', normal: { z: 1 } }] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(0.12, 12);
  expect(result.moment.ball.velocity.z).toBe(-5);
});
it('requires actual departure from a prior actor and retains that actor for an accelerated return', () => {
  const w = input(ball(v(0, 1, 0), v(0, 0, 0)), 3_000_000);
  const a = actor('same', v(0, 1, 0.2), v(0, 0, 1), v(0, 0, -1));
  const result = deriveBallWorldContinuation({ ...w, actors: [a], previousContacts: [{ kind: 'actor', playerId: 'same', role: 'body' }] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor', playerId: 'same' }] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(2, 12);
});
it('continues a descending ball to the true ground root without rebasing to a fake BatBallContact', () => {
  const w = input(ball(), 1_000_000);
  const result = deriveBallWorldContinuation({ ...w, parameters: { ...w.parameters, gravityY: -10 } });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(Math.sqrt(0.18), 12);
  expect(result.moment.ball.position.y).toBeCloseTo(0.1, 12);
  expect(result.moment.ball.velocity.y).toBeCloseTo(-Math.sqrt(18), 12);
});
it('does not repeat a prior bounce when the floor state is already rising', () => {
  const w = input(ball(v(0, 0.1, 0), v(0, 2, 1)), 1_000_000);
  const result = deriveBallWorldContinuation({ ...w, parameters: { ...w.parameters, gravityY: -10 } });
  expect(result.moment.elapsedSeconds).toBeCloseTo(0.4, 12);
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
});
it('uses rolling deceleration in swept actor contact and records a stop without closing a play', () => {
  const w = input(ball(v(0, 0.1, 0), v(2, 0, 0)), 3_000_000);
  const contact = deriveBallWorldContinuation({ ...w, actors: [actor('pickup', v(1, 0.1, 0))] });
  expect(contact.moment.elapsedSeconds).toBeCloseTo(2 - Math.sqrt(2.4), 12);
  expect(contact).toMatchObject({ kind: 'boundary', phase: 'rolling', contacts: [{ kind: 'actor', playerId: 'pickup' }] });
  const stop = deriveBallWorldContinuation(w);
  expect(stop).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'rolling_stop' }], moment: { ball: { position: { x: 2 }, velocity: v(0, 0, 0) } } });
  expect(stop).not.toHaveProperty('playEnd');
});
it('keeps a resting ball in World and detects a later actual moving actor', () => {
  const w = input(ball(v(0, 0.1, 0), v(0, 0, 0)), 3_000_000);
  expect(deriveBallWorldContinuation(w)).toMatchObject({ kind: 'resting', phase: 'resting', throughTick: 3_000_000 });
  const result = deriveBallWorldContinuation({ ...w, actors: [actor('pickup', v(0, 0.1, 2), v(0, 0, -1))] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(1.8, 12);
});
it('does not invent a rolling stop when explicit deceleration is zero', () => {
  const w = input(ball(v(0, 0.1, 0), v(2, 0, 0)), 3_000_000);
  expect(deriveBallWorldContinuation({ ...w, parameters: { ...w.parameters, groundRollingDecelerationMps2: 0 } }))
    .toMatchObject({ kind: 'moving', phase: 'rolling', moment: { ball: { position: { x: 6 }, velocity: { x: 2 } } } });
});
it('continues from a finite surface without repeating a separating surface contact', () => {
  const result = deriveBallWorldContinuation({ ...input(ball(v(0, 1, 0.9), v(0, 0, -1))),
    surfaces: [wall], previousContacts: [{ kind: 'surface', surfaceId: 'wall' }] });
  expect(result.kind).toBe('moving');
  expect(result.moment.ball.position.z).toBeCloseTo(-0.1, 12);
});
it('finds a finite panel corner without treating its extension as a wall face', () => {
  const panel = { ...wall, start: { x: 0, z: 1 }, end: { x: 1, z: 1 }, minimumHeight: 1, maximumHeight: 2 };
  const w = input(ball(v(-0.05, 0.95, 0), v(0, 0, 1)), 2_000_000);
  const result = deriveBallWorldContinuation({ ...w, surfaces: [panel] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'surface', point: v(0, 1, 1) }] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(1 - Math.sqrt(0.005), 12);
  expect(deriveBallWorldContinuation({ ...input(ball(v(-1, 0.5, 0), v(0, 0, 1)), 2_000_000), surfaces: [panel] }).kind).toBe('moving');
});
it('preserves all contacts at one recorded tick rather than choosing an ID or event kind', () => {
  const a = actor('fielder', v(0, 1, 1.1));
  const result = deriveBallWorldContinuation({ ...input(), actors: [a], surfaces: [wall] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor' }, { kind: 'surface' }] });
});
it.each([0, 2 ** 52])('retains relative continuous cursor and actor timing at original tick %s', (originTick) => {
  const w = input(ball(v(0, 1, 0.3), v(0, 0, 10), originTick + 30_000), originTick + 200_000);
  const result = deriveBallWorldContinuation({ ...w, moment: { originTick, elapsedSeconds: 0.03, ball: w.moment.ball }, surfaces: [wall] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(0.09, 12);
  expect(result.moment.ball.tick).toBe(originTick + 90_000);
});
it('rejects inconsistent cursors, incomplete motion coverage and missing physical calibration', () => {
  const w = input();
  expect(() => deriveBallWorldContinuation({ ...w, moment: { ...w.moment, elapsedSeconds: 0.5 } })).toThrow();
  expect(() => deriveBallWorldContinuation({ ...w, actors: [{ ...actor('a', v(1, 1, 1)), primitive: { ...actor('a', v(1, 1, 1)).primitive, endTick: 1 } }] })).toThrow();
  expect(() => deriveBallWorldContinuation({ ...w, parameters: { ...w.parameters, groundRollingDecelerationMps2: undefined } })).toThrow();
});
it('does not depend on object property order when matching the previous collider', () => {
  const w = input(ball(v(0, 1, 0), v(0, 0, 0)), 3_000_000);
  const a = actor('same', v(0, 1, 0.2), v(0, 0, 1), v(0, 0, -1));
  const result = deriveBallWorldContinuation({ ...w, actors: [a], previousContacts: [{ role: 'body', playerId: 'same', kind: 'actor' }] });
  expect(result.moment.elapsedSeconds).toBeCloseTo(2, 12);
});
it('rejects a new actor segment that begins after the continuous collision even at its recorded tick', () => {
  const w = input(ball(v(0, 1, 0), v(0, 0, 0), 1), 3_000_000);
  const a = actor('new', v(0, 1, 2));
  expect(() => deriveBallWorldContinuation({ ...w, moment: { originTick: 0, elapsedSeconds: 0.2e-6, ball: w.moment.ball },
    actors: [{ ...a, primitive: { ...a.primitive, startTick: 1 } }] })).toThrow();
});
it('retains a continuing earlier surface alongside a later actor instead of allowing one contact to decide the response', () => {
  const surface = { ...wall, start: { x: -2, z: 0 }, end: { x: 2, z: 0 } };
  const result = deriveBallWorldContinuation({ ...input(ball(v(0, 1, 0.1), v(1, 0, 0)), 2_000_000),
    actors: [actor('next', v(1.2, 1, 0.1))], surfaces: [surface], previousContacts: [{ kind: 'surface', surfaceId: surface.surfaceId }] });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'actor' }, { kind: 'surface', continuing: true }] });
});
it('does not let a prior actor pass into the ball when actual departure is blocked', () => {
  const result = deriveBallWorldContinuation({ ...input(ball(v(0, 1, 0), v(0, 0, 0)), 2_000_000),
    actors: [actor('same', v(0, 1, 0.2), v(0, 0, 0), v(0, 0, -1))], previousContacts: [{ kind: 'actor', playerId: 'same', role: 'body' }] });
  expect(result).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact', contacts: [{ kind: 'actor', continuing: true }] });
  expect(result.moment.elapsedSeconds).toBe(0);
});
