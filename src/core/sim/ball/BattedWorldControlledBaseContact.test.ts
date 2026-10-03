import { expect, it } from 'vitest';
import { findBattedWorldControlledBaseContact } from './BattedWorldControlledBaseContact';
import type { BattedWorldMotion } from './BattedWorldMotion';

const base = { center: { x: 3, z: 0 }, halfSize: { x: 0.2, z: 0.2 }, rotationRadians: 0 };
const motion = (originTick = 0): BattedWorldMotion => {
  const moment = { originTick, elapsedSeconds: 2, ball: { tick: originTick + 2_000_000,
    position: { x: 4, y: 1, z: 0 }, velocity: { x: 2, y: 0, z: 0 }, spin: { x: 0, y: 0, z: 0 } } };
  return { carrierPlayerId: 'defender', actors: (['left_foot', 'right_foot'] as const).map((role) => ({ playerId: 'defender', startElapsedSeconds: 0.1000000004,
    primitive: { role, radius: 0.1, startTick: originTick, endTick: originTick + 2_000_000, ticksPerSecond: 1_000_000,
      startCenter: { x: role === 'left_foot' ? 0 : -1, y: 0, z: 0 }, startVelocity: { x: 2, y: 0, z: 0 }, acceleration: { x: 0, y: 0, z: 0 } } })),
    world: { kind: 'moving', moment, throughTick: moment.ball.tick }, response: { kind: 'carried', cursor: { moment, previousContacts: [] } },
    cursor: { moment, previousContacts: [] } };
};
it('finds actual foot contact during the own secured carried motion interval', () => {
  const result = findBattedWorldControlledBaseContact({ motion: motion(), base, baseSurfaceHeightMeters: 0 });
  expect(result?.role).toBe('left_foot'); expect(result?.tick).toBe(1_500_001);
  expect(result?.elapsedSeconds).toBeCloseTo(1.5000000004, 14);
});
it('keeps fractional physical contact at a large original clock', () => {
  expect(findBattedWorldControlledBaseContact({ motion: motion(2 ** 52), base, baseSurfaceHeightMeters: 0 })?.tick).toBe(2 ** 52 + 1_500_001);
});
it('does not count a foot that was on base before security and moved away before the carried basis', () => {
  const source = motion(), actors = source.actors.map((actor) => ({ ...actor,
    primitive: { ...actor.primitive, startCenter: { x: 4, y: 0, z: 0 }, startVelocity: { x: 1, y: 0, z: 0 } } }));
  expect(findBattedWorldControlledBaseContact({ motion: { ...source, actors }, base, baseSurfaceHeightMeters: 0 })).toBeNull();
});
it.each(['before', 'at', 'after'] as const)('counts only contacts strictly before actual %s interruption', (kind) => {
  const source = motion(), actual = findBattedWorldControlledBaseContact({ motion: source, base, baseSurfaceHeightMeters: 0 })!;
  const elapsedSeconds = kind === 'before' ? 1 : kind === 'at' ? actual.elapsedSeconds : 1.8;
  const moment = { ...source.world.moment, elapsedSeconds, ball: { ...source.world.moment.ball, tick: Math.ceil(elapsedSeconds * 1_000_000) } };
  const boundary: BattedWorldMotion = { ...source, world: { kind: 'boundary', moment, contacts: [{ kind: 'ground', moment }] },
    response: { kind: 'unresolved', reason: 'carried_contact', cursor: null }, cursor: null };
  const contact = findBattedWorldControlledBaseContact({ motion: boundary, base, baseSurfaceHeightMeters: 0 });
  if (kind === 'after') expect(contact?.tick).toBe(1_500_001); else expect(contact).toBeNull();
});
it.each(['free', 'feet', 'clock', 'basis'] as const)('rejects inconsistent %s carried evidence', (kind) => {
  const source = motion(), changed = kind === 'free' ? { ...source, carrierPlayerId: null }
    : kind === 'feet' ? { ...source, actors: source.actors.slice(0, 1) }
    : kind === 'clock' ? { ...source, actors: source.actors.map((a) => ({ ...a, primitive: { ...a.primitive, ticksPerSecond: 100 } })) }
    : { ...source, actors: source.actors.map((a, i) => ({ ...a, startElapsedSeconds: i ? 0.2 : a.startElapsedSeconds })) };
  expect(() => findBattedWorldControlledBaseContact({ motion: changed, base, baseSurfaceHeightMeters: 0 })).toThrow();
});
