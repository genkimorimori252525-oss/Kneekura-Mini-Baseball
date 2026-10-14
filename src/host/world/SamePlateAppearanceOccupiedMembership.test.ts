import { expect, it, vi } from 'vitest';
import { completeSamePaOccupiedPhysicalFixture } from './SamePlateAppearanceOccupiedPhysicalFixture.test-support';

const owned = vi.hoisted(() => ({ lifecycle: null as unknown }));
vi.mock('./SamePlateAppearancePhysicalLifecycleFixture.test-support', () => ({ prepareSamePaPhysicalLifecycleContinuation: () => owned.lifecycle }));
vi.mock('./SqliteBattingEmotionStore', () => ({ openSqliteBattingEmotionStore: () => ({ acceptGenesis: () => ({ kind: 'batting_emotion_genesis' }) }) }));
const enrolled = ['away-1', 'away-2', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'p2'];
const dispatched = ['away-2', 'p2', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8', 'away-1'];
const run = (members: readonly string[], participants: readonly string[] = enrolled) => {
  type Args = Parameters<typeof completeSamePaOccupiedPhysicalFixture>;
  const actor = { source: { sourceId: 'original-occupied-actor' } }, accepted = new Map<string, unknown>();
  owned.lifecycle = { first: { originalActor: actor }, second: { originalActor: actor },
    current: () => ({ view: { lineage: { participantReferences: enrolled } },
      basis: { actor, members: members.map(playerId => ({ playerId })) } }) };
  const occupied = { actor, accepted, save: <T extends { sourceId: string }>(s: T) => { accepted.set(s.sourceId, s); return s; },
    f: { path: '/unopened/fixture.sqlite', x: { f: { track: <T>(s: T) => s } } },
    action: { source: { viewReference: { sourceId: 'original-view' } } }, roles: [{ member: { playerId: 'away-2' } }],
    enrollment: { participants: participants.map(playerId => ({ binding: { playerId } })) } } as unknown as Args[1];
  return completeSamePaOccupiedPhysicalFixture({} as Args[0], occupied, 'lan01:occupied', {} as Args[3]);
};
it('accepts the same eleven participants in role order and enrollment key order without mutating either', () => {
  const roles = Object.freeze([...dispatched]), participants = Object.freeze([...enrolled]);
  expect(() => run(roles, participants)).not.toThrow();
  expect(roles).toEqual(dispatched); expect(participants).toEqual(enrolled);
});
it.each([
  ['missing', dispatched.slice(0, -1)],
  ['extra', [...dispatched, 'foreign-player']],
  ['duplicate instead of runner', [...dispatched.slice(0, -1), 'away-2']],
  ['different participant', [...dispatched.slice(0, -1), 'foreign-player']],
])('rejects %s membership', (_name, members) => {
  expect(() => run(members)).toThrow();
});
it('rejects matching duplicated IDs on both sides rather than hiding them with a Set', () => {
  const repeated = [...enrolled.slice(0, -1), 'away-1'];
  expect(() => run(repeated, repeated)).toThrow();
});

it.each([
  ['matching missing participant', enrolled.slice(0, -1)],
  ['matching extra participant', [...enrolled, 'foreign-player']],
])('rejects %s on both sides against the original eleven-person contract', (_name, participants) => {
  expect(() => run(participants, participants)).toThrow();
});
