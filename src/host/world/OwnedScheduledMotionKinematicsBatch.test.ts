import { expect, it, vi } from 'vitest';
import * as kinematics from './ActualPlayerKinematicsFromPrefix';
import * as physical from './BattedWorldFieldPhysicalPrefix';
import { ownedScheduledMotionFixture } from './OwnedScheduledMotionFixtures.test-support';

type Prefix = Parameters<typeof kinematics.actualPlayerKinematicsFromPrefix>[1];
type Batch = (playerIds: readonly string[], prefix: Prefix) => readonly kinematics.ActualPlayerKinematics[];

it('derives one real physical prefix per batch and preserves independent byte-identical Player outputs', () => {
  expect(kinematics).toHaveProperty('actualPlayersKinematicsFromPrefix');
  const batch = Reflect.get(kinematics, 'actualPlayersKinematicsFromPrefix') as Batch;
  const x = ownedScheduledMotionFixture();
  try {
    const prefix = x.prefix(null), before = JSON.stringify(prefix);
    const expected = x.playerIds.map(id => kinematics.actualPlayerKinematicsFromPrefix(id, prefix));
    // This spy observes the real pure derivation without replacing its implementation.
    const derivations = vi.spyOn(physical, 'battedWorldFieldPhysicalPrefix');
    try {
      const actual = batch(x.playerIds, prefix);
      expect(derivations).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
      expect(Object.isFrozen(actual)).toBe(true);
      expect(actual.every(s => Object.isFrozen(s) && Object.isFrozen(s.roles))).toBe(true);
      expect(actual[0]).not.toBe(expected[0]);
      expect(JSON.stringify(prefix)).toBe(before);
      expect(() => batch([x.playerIds[0], x.playerIds[0]], prefix)).toThrow(/duplicate|unique/);
      expect(() => batch(['foreign-player'], prefix)).toThrow(/Player|scope/);
      expect(() => batch([], prefix)).toThrow(/empty|Player|scope/);
    } finally { derivations.mockRestore(); }
  } finally { x.f.close(); }
});
