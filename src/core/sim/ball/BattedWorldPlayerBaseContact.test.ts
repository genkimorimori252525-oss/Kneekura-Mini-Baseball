import { expect, it } from 'vitest';
import { findBattedWorldPlayerBaseContact } from './BattedWorldPlayerBaseContact';
import type { BattedWorldMotion } from './BattedWorldMotion';

const base = { center: { x: 3, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 };
const motion = (originTick = 0): BattedWorldMotion => {
  const moment = { originTick, elapsedSeconds: 2, ball: { tick: originTick + 2_000_000,
    position: { x: 100, y: 1, z: 0 }, velocity: { x: 2, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } };
  const cursor = { moment, previousContacts: [] };
  return { carrierPlayerId: null, actors: (['left_foot', 'right_foot'] as const).map((role) => ({ playerId: 'batter', startElapsedSeconds: 0.1000000004,
    primitive: { role, radius: 0.1, startTick: originTick, endTick: originTick + 2_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: role === 'left_foot' ? 0 : -1, y: 0, z: 0 }, startVelocity: { x: 2, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })),
    world: { kind: 'moving', phase: 'airborne', moment, throughTick: moment.ball.tick }, response: { kind: 'moving', cursor }, cursor };
};
const query = (source: BattedWorldMotion) => ({ motion: source, playerId: 'batter', base, baseSurfaceHeightMeters: 0 });
it('finds actual batter foot contact while the ball remains free', () => {
  const result = findBattedWorldPlayerBaseContact(query(motion()));
  expect(result?.playerId).toBe('batter'); expect(result?.role).toBe('left_foot'); expect(result?.tick).toBe(1_500_001);
  expect(result?.elapsedSeconds).toBeCloseTo(1.5000000004, 14); expect(result).not.toHaveProperty('safe');
});
it('preserves actual fractional contact on a large original clock', () => {
  expect(findBattedWorldPlayerBaseContact(query(motion(2 ** 52)))?.tick).toBe(2 ** 52 + 1_500_001);
});
it('keeps actual player contact exactly at a ball boundary independently of possession', () => {
  const source = motion(), actual = findBattedWorldPlayerBaseContact(query(source))!;
  const moment = { ...source.world.moment, elapsedSeconds: actual.elapsedSeconds, ball: { ...source.world.moment.ball, tick: actual.tick } };
  const boundary: BattedWorldMotion = { ...source, world: { kind: 'boundary', phase: 'airborne', moment, contacts: [{ kind: 'ground', moment }] },
    response: { kind: 'ground', cursor: { moment, previousContacts: [] } }, cursor: { moment, previousContacts: [] } };
  expect(findBattedWorldPlayerBaseContact(query(boundary))).toEqual(actual);
});
it('cannot count contact after the actual executed ball boundary', () => {
  const source = motion(), moment = { ...source.world.moment, elapsedSeconds: 1, ball: { ...source.world.moment.ball, tick: 1_000_000 } };
  const boundary: BattedWorldMotion = { ...source, world: { kind: 'boundary', phase: 'airborne', moment, contacts: [{ kind: 'ground', moment }] },
    response: { kind: 'ground', cursor: { moment, previousContacts: [] } }, cursor: { moment, previousContacts: [] } };
  expect(findBattedWorldPlayerBaseContact(query(boundary))).toBeNull();
});
it('does not infer a touch from a body/center or an intended base', () => {
  const source = motion(), actors = source.actors.map((a) => ({ ...a, primitive: { ...a.primitive, startCenter: { ...a.primitive.startCenter, y: 0.2 } } }));
  expect(findBattedWorldPlayerBaseContact(query({ ...source, actors }))).toBeNull();
});
it.each(['player', 'missing', 'duplicate', 'clock', 'basis', 'past_end'] as const)('rejects invalid %s actual foot evidence', (kind) => {
  const source = motion(), changed = kind === 'missing' ? { ...source, actors: source.actors.slice(0, 1) }
    : kind === 'duplicate' ? { ...source, actors: [source.actors[0], source.actors[0]] }
    : kind === 'clock' ? { ...source, actors: source.actors.map((a) => ({ ...a, primitive: { ...a.primitive, ticksPerSecond: 100 } })) }
    : kind === 'basis' ? { ...source, actors: source.actors.map((a, i) => ({ ...a, startElapsedSeconds: i ? 0.2 : a.startElapsedSeconds })) }
    : kind === 'past_end' ? { ...source, actors: source.actors.map((a) => ({ ...a, startElapsedSeconds: 2.1 })) } : source;
  expect(() => findBattedWorldPlayerBaseContact({ ...query(changed), playerId: kind === 'player' ? 'unknown-player' : 'batter' })).toThrow();
});
