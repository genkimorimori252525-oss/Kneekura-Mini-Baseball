import { expect, it } from 'vitest';
import { DEFAULT_BALL_FLIGHT_PARAMETERS } from './BallFlight';
import { deriveAcceleratedBallWorldFieldMotion, deriveBallWorldContinuation, deriveBallWorldFieldContinuation } from './BallWorldContinuation';

const v = (x: number, y: number, z: number) => ({ x, y, z });
const prism = (x = 0, z = 0) => ({ region: { center: { x, z }, halfSize: { x: 1, z: 1 }, rotationRadians: 0 }, bottomY: 0, topY: 1 });
const input = () => ({ moment: { originTick: 0, elapsedSeconds: 0,
  ball: { tick: 0, position: v(-3, 0.5, 0), velocity: v(1, 0, 0), spin: v(0, 0, 2) } }, throughTick: 5_000_000,
  parameters: { ...DEFAULT_BALL_FLIGHT_PARAMETERS, gravityY: 0, ballRadius: 0.125, groundRollingDecelerationMps2: 1 },
  actors: [], surfaces: [], previousContacts: [],
  bases: { home: prism(100, 100), first: prism(), second: prism(200, 200), third: prism(300, 300) }, previousBaseContacts: [],
});
const actor = (playerId: string, x: number, ticksPerSecond = 1_000_000) => ({ playerId, primitive: { role: 'body' as const,
  radius: 0.125, startTick: 0, endTick: 5 * ticksPerSecond, ticksPerSecond,
  startCenter: v(x, 0.5, 0), startVelocity: v(0, 0, 0), acceleration: v(0, 0, 0) } });
it('executes only to the actual base face before a later actor or wall', () => {
  const query = { ...input(), actors: [actor('later', 1)], surfaces: [{ surfaceId: 'later-wall',
    start: { x: 2, z: -2 }, end: { x: 2, z: 2 }, minimumHeight: 0, maximumHeight: 2 }] };
  const result = deriveBallWorldFieldContinuation(query);
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'base', baseId: 'first' }], moment: { elapsedSeconds: 1.875 } });
  if (result.kind === 'boundary') expect(result.contacts).toHaveLength(1);
  expect(result).not.toHaveProperty('playEnd');
});
it('retains legacy archive grouping but selects distinct actual actor times for the new field path', () => {
  const query = { ...input(), throughTick: 5, parameters: { ...input().parameters, ticksPerSecond: 1 },
    actors: [actor('earlier', -1.5, 1), actor('later', -1.4, 1)] };
  const old = deriveBallWorldContinuation(query), actual = deriveBallWorldFieldContinuation(query);
  if (old.kind !== 'boundary' || actual.kind !== 'boundary') throw new Error('expected physical boundary');
  expect(old.contacts).toHaveLength(2);
  expect(actual.contacts).toHaveLength(1);
  expect(actual.contacts[0]).toMatchObject({ kind: 'actor', playerId: 'earlier' });
});
it('preserves exact simultaneous actor and bag contact without deciding a baseball outcome', () => {
  const result = deriveBallWorldFieldContinuation({ ...input(), actors: [actor('same', -0.875)] });
  if (result.kind !== 'boundary') throw new Error('expected physical boundary');
  expect(result.contacts.map((c) => c.kind)).toEqual(['actor', 'base']);
  const later = deriveBallWorldFieldContinuation({ ...input(), actors: [actor('later', -0.875 + 1e-14)] });
  if (later.kind !== 'boundary') throw new Error('expected physical boundary');
  expect(later.contacts.map((c) => c.kind)).toEqual(['base']);
});
it('preserves a simultaneous wall face and bag face while separating a real nearby wall', () => {
  const wall = (x: number) => ({ surfaceId: 'same-plane-wall', start: { x, z: -2 }, end: { x, z: 2 }, minimumHeight: 0, maximumHeight: 2 });
  const result = deriveBallWorldFieldContinuation({ ...input(), surfaces: [wall(-1)] });
  if (result.kind !== 'boundary') throw new Error('actual simultaneous face');
  expect(result.moment.elapsedSeconds).toBe(1.875);
  expect(result.contacts.map((c) => c.kind)).toEqual(['base', 'surface']);
  const later = deriveBallWorldFieldContinuation({ ...input(), surfaces: [wall(-1 + 1e-14)] });
  if (later.kind !== 'boundary') throw new Error('actual distinct face');
  expect(later.contacts.map((c) => c.kind)).toEqual(['base']);
  const earlier = deriveBallWorldFieldContinuation({ ...input(), surfaces: [wall(-1 - 1e-14)] });
  if (earlier.kind !== 'boundary') throw new Error('actual distinct face');
  expect(earlier.contacts.map((c) => c.kind)).toEqual(['surface']);
});
it('retains a previous touching actor at an earlier bag boundary as a physical constraint', () => {
  const query = input();
  const carriedActor = { ...actor('held', -3), primitive: { ...actor('held', -3).primitive, startVelocity: v(1, 0, 0) } };
  const result = deriveBallWorldFieldContinuation({ ...query, actors: [carriedActor], previousContacts: [{ kind: 'actor' as const, playerId: 'held', role: 'body' as const }] });
  if (result.kind !== 'boundary') throw new Error('expected physical boundary');
  expect(result.contacts).toHaveLength(2);
  expect(result.contacts.find((c) => c.kind === 'actor')).toMatchObject({ continuing: true });
});
it('uses free gravity and actual rolling deceleration before the base contact', () => {
  const descending = input();
  const result = deriveBallWorldFieldContinuation({ ...descending, moment: { ...descending.moment,
    ball: { ...descending.moment.ball, position: v(0, 3, 0), velocity: v(0, 0, 0) } }, parameters: { ...descending.parameters, gravityY: -2 } });
  expect(result.moment.elapsedSeconds).toBeCloseTo(Math.sqrt(1.875), 12);
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'base', baseId: 'first' }] });
  const rolling = input();
  const stopped = deriveBallWorldFieldContinuation({ ...rolling, moment: { ...rolling.moment,
    ball: { ...rolling.moment.ball, position: v(-3, 0.125, 0), velocity: v(2, 0, 0) } } });
  expect(stopped.moment.elapsedSeconds).toBeCloseTo(1.5, 12);
  expect(stopped.moment.ball.velocity.x).toBeCloseTo(0.5, 12);
});
it('keeps ground and rolling-stop boundaries when they precede a bag', () => {
  const query = input();
  expect(deriveBallWorldFieldContinuation({ ...query, parameters: { ...query.parameters, gravityY: -2 } }))
    .toMatchObject({ kind: 'boundary', contacts: [{ kind: 'ground' }] });
  expect(deriveBallWorldFieldContinuation({ ...query, moment: { ...query.moment,
    ball: { ...query.moment.ball, position: v(-3, 0.125, 0), velocity: v(1, 0, 0) } } }))
    .toMatchObject({ kind: 'boundary', contacts: [{ kind: 'rolling_stop' }] });
});
it('allows prior base departure and stops persistent inward contact', () => {
  const query = input();
  const atBase = { ...query, moment: { ...query.moment, ball: { ...query.moment.ball, position: v(-1.125, 0.5, 0) } }, previousBaseContacts: ['first'] as const };
  expect(deriveBallWorldFieldContinuation(atBase)).toMatchObject({ kind: 'boundary', pendingReason: 'persistent_contact' });
  expect(deriveBallWorldFieldContinuation({ ...atBase, moment: { ...atBase.moment,
    ball: { ...atBase.moment.ball, velocity: v(-1, 0, 0) } } })).toMatchObject({ kind: 'moving', moment: { elapsedSeconds: 5 } });
});
it('checks a carried accelerated interval against bases without inventing free gravity or a drop', () => {
  const { throughTick: _, ...query } = input();
  const result = deriveAcceleratedBallWorldFieldMotion({ ...query, acceleration: v(0, 0, 0), throughElapsedSeconds: 5 });
  expect(result).toMatchObject({ kind: 'boundary', contacts: [{ kind: 'base', baseId: 'first' }] });
  expect(result).not.toHaveProperty('phase');
  expect(result).not.toHaveProperty('acquisition');
});
it('validates complete field calibration even when an earlier actor would stop the ball', () => {
  const query = { ...input(), actors: [actor('early', -3)] };
  expect(() => deriveBallWorldFieldContinuation({ ...query, bases: { ...query.bases, first: { ...prism(), topY: 0 } } })).toThrow();
  expect(() => deriveBallWorldFieldContinuation({ ...query, result: 'fair' } as typeof query)).toThrow();
});
