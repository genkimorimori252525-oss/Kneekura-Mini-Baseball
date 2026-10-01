import { expect, it } from 'vitest';
import { createRosterState } from '../../core/world/roster/RosterState';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import * as codec from './RosterEvidenceJson';

const roster = () => createRosterState({ careerId: 'fixture-career', effectiveDay: 10,
  profiles: [], units: [], players: [{ playerId: 'fixture-player', clubRights: { rightsHolderClubId: null, contractId: null },
    assignment: null, registrations: [], availability: { status: 'UNAVAILABLE', evidenceId: 'fixture-source' } }] });
const legacy = (value: unknown) => JSON.stringify(cloneInert(value), (_key, item: unknown) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : item);

it('preserves canonical JSON and input ownership for existing root and nested roster evidence', () => {
  const original = { z: roster(), a: { roster: roster(), plain: { b: -0, a: null } } };
  expect(codec.canonicalRosterEvidenceJson(original)).toBe(legacy(original));
  const copy = codec.cloneRosterEvidence(original);
  expect(copy).toEqual(original);
  expect(copy).not.toBe(original);
  expect(copy.z).not.toBe(original.z);
  expect(copy.z.players).not.toBe(original.z.players);
  expect(Object.isFrozen(original.z)).toBe(true);
});

it('rejects dangerous data before getters execute and preserves ordinary evidence limits', () => {
  let calls = 0;
  const getter = { ...roster() };
  Object.defineProperty(getter, 'players', { enumerable: true, get() { calls += 1; return []; } });
  expect(() => codec.cloneRosterEvidence(getter)).toThrow();
  expect(calls).toBe(0);
  const sparse = { ...roster(), players: new Array(2) };
  expect(() => codec.canonicalRosterEvidenceJson(sparse)).toThrow();
  const withSymbol = { ...roster(), [Symbol('bad')]: 1 };
  expect(() => codec.cloneRosterEvidence(withSymbol)).toThrow();
  const cyclic: Record<string, unknown> = { ...roster() }; cyclic.extra = cyclic;
  expect(() => codec.cloneRosterEvidence(cyclic)).toThrow();
  expect(() => codec.cloneRosterEvidence({ ...roster(), revision: Infinity })).toThrow();
  expect(() => codec.cloneRosterEvidence(new Date())).toThrow();
  expect(() => codec.cloneRosterEvidence(Array.from({ length: 100000 }, () => null))).toThrow('size');
  expect(() => codec.cloneRosterEvidence({ ...roster(), players: Array.from({ length: 12000 }, () => ({ fake: true })) })).toThrow();
  const arrayGetter: unknown[] = [null];
  Object.defineProperty(arrayGetter, '0', { enumerable: true, get() { calls += 1; return roster().players[0]; } });
  expect(() => codec.cloneRosterEvidence({ ...roster(), players: arrayGetter })).toThrow();
  expect(calls).toBe(0);
  expect(() => codec.cloneRosterEvidence({ ...roster(), players: [{ ...roster().players[0], extra: 'unrecognized' }] })).toThrow('schema');
  let deep: unknown = null;
  for (let index = 0; index < 65; index += 1) deep = { child: deep };
  expect(() => codec.cloneRosterEvidence(deep)).toThrow('size');
});

it('validates roster profiles and retains the bounded full-roster transport budget', () => {
  const invalid = { ...roster(), players: roster().players.map((player) => ({ ...player, assignment: { unitId: 'missing', clubId: 'missing' } })) };
  expect(() => codec.cloneRosterEvidence(invalid)).toThrow();
  const tooLarge = { ...roster(), players: Array.from({ length: 100000 }, (_, index) => ({
    ...roster().players[0], playerId: `fixture-${index}` })) };
  expect(() => codec.cloneRosterEvidence(tooLarge)).toThrow('size');
});

it('bounds composite evidence even when it contains individually valid full global rosters', () => {
  const player = roster().players[0];
  const large = createRosterState({ ...roster(), players: Array.from({ length: 33000 }, (_, index) => ({ ...player, playerId: `fixture-${index}` })) });
  expect(() => codec.cloneRosterEvidence(Array.from({ length: 13 }, () => large))).toThrow('size');
});
