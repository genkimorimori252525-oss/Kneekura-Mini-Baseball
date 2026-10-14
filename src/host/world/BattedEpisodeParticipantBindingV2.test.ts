import { expect, it } from 'vitest';
import { battedEpisodeV2ParticipantsMatch, type EpisodeParticipantActor, type EpisodeParticipantWorld } from './BattedEpisodeParticipantBindingV2';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const binding = (playerId: string, side: 'HOME' | 'AWAY' = 'HOME'): OfficialParticipantBinding => ({
  gameId: 'game', careerId: 'career', competitionEditionId: 'edition', gameDay: 10,
  clubId: side === 'HOME' ? 'home' : 'away', side, playerId, personId: `person-${playerId}`,
  personLinkSourceId: `intake-${playerId}`, rosterRevision: 0, fixtureEventId: 'fixture',
});
const person = (b: OfficialParticipantBinding): DurablePlayerPersonLink => ({
  sourceId: b.personLinkSourceId, careerId: b.careerId, playerId: b.playerId, personId: b.personId,
  sourceRecordId: `record-${b.playerId}`, sourceVersion: 'test-intake', acceptedRevision: 1, acceptedAtDay: 0, rosterRevision: 0,
});
// Only identity/role projections are constructed here. These are predicate tests,
// not accepted physical models, durable owner receipts or Native authentication.
const fixture = () => {
  const defenders = Array.from({ length: 9 }, (_, i) => binding(`defender-${i}`));
  const old = binding('prior-batter', 'AWAY'), next = binding('current-batter', 'AWAY');
  const original: EpisodeParticipantActor = { binding: old, person: person(old), defenderBindings: defenders, defenderPersons: defenders.map(person) };
  const current: EpisodeParticipantActor = { ...original, binding: next, person: person(next) };
  const active = [...defenders, next];
  const registered = [...defenders, old, next, ...Array.from({ length: 7 }, (_, i) => binding(`reserve-${i}`, 'AWAY'))];
  const model = registered.map(b => ({ playerId: b.playerId, personId: b.personId, primitives: roles.map(role => ({ role })) }));
  const world: EpisodeParticipantWorld = { model: { actors: model }, modelActorEvidence: registered.map(b => ({ binding: b, person: person(b) })),
    source: { commands: active.map(b => ({ playerId: b.playerId, primitiveMotions: roles.map(role => ({ role })) })) },
    actors: active.flatMap(b => roles.map(role => ({ playerId: b.playerId, primitive: { role } }))) };
  const value = { current: structuredClone(current), original: structuredClone(original),
    world: structuredClone(world), responseModel: structuredClone({ actors: model }) };
  return value as Mutable<typeof value>;
};
type Fixture = ReturnType<typeof fixture>;
const matches = (x: Fixture) => battedEpisodeV2ParticipantsMatch(x.current, x.original, x.world, x.responseModel);
const replaceBinding = (x: Fixture, key: keyof OfficialParticipantBinding, value: unknown) => {
  Object.assign(x.current.binding, { [key]: value });
  Object.assign(x.world.modelActorEvidence.find(e => e.binding.playerId === 'current-batter')!.binding, { [key]: value });
};

it('accepts the current batter and all nine unchanged defenders without selecting the registered prior batter', () => {
  const x = fixture(), before = JSON.stringify(x);
  expect(x.world.model.actors).toHaveLength(18); expect(matches(x)).toBe(true); expect(JSON.stringify(x)).toBe(before);
});
it('matches registered identities and roles independently of model and primitive ordering', () => {
  const x = fixture(); x.world.model.actors.reverse(); x.responseModel.actors.reverse();
  x.world.modelActorEvidence.reverse(); x.world.source.commands.reverse(); x.world.actors.reverse();
  for (const a of x.world.model.actors) a.primitives.reverse();
  expect(matches(x)).toBe(true);
});

const changes: [string, (x: Fixture) => void][] = [
  ...(['gameId', 'careerId', 'competitionEditionId', 'gameDay', 'fixtureEventId', 'clubId', 'side'] as const).map(key =>
    [`changed batter ${key}`, (x: Fixture) => replaceBinding(x, key, key === 'gameDay' ? 11 : 'foreign')] as [string, (x: Fixture) => void]),
  ['the prior batter binding', x => { x.current.binding = x.original.binding; x.current.person = x.original.person; }],
  ['the prior batter Person', x => replaceBinding(x, 'personId', x.original.binding.personId)],
  ['a changed defender binding', x => { x.current.defenderBindings[0] = binding('substitute'); }],
  ['a changed defender Person', x => { x.current.defenderPersons[0].sourceRecordId = 'changed'; }],
  ['a missing defender', x => { x.current.defenderBindings.pop(); }],
  ['an extra defender', x => { x.current.defenderBindings.push(binding('extra')); }],
  ['a duplicate current Player', x => { x.current.defenderBindings[1] = x.current.defenderBindings[0]; }],
  ['a duplicate current Person', x => { Object.assign(x.current.binding, { personId: x.current.defenderBindings[0].personId }); }],
  ['missing current model binding evidence', x => { x.world.modelActorEvidence = x.world.modelActorEvidence.filter(e => e.binding.playerId !== 'current-batter'); }],
  ['duplicate current model binding evidence', x => { x.world.modelActorEvidence.push(x.world.modelActorEvidence.find(e => e.binding.playerId === 'current-batter')!); }],
  ['a changed current model binding', x => { x.world.modelActorEvidence.find(e => e.binding.playerId === 'current-batter')!.binding.rosterRevision++; }],
  ['a changed current model Person', x => { x.world.modelActorEvidence.find(e => e.binding.playerId === 'current-batter')!.person.sourceRecordId = 'changed'; }],
  ['missing current World model entry', x => { x.world.model.actors = x.world.model.actors.filter(a => a.playerId !== 'current-batter'); }],
  ['a current World model Person mismatch', x => { x.world.model.actors.find(a => a.playerId === 'current-batter')!.personId = 'foreign'; }],
  ['missing current response model entry', x => { x.responseModel.actors = x.responseModel.actors.filter(a => a.playerId !== 'current-batter'); }],
  ['a current response model Person mismatch', x => { x.responseModel.actors.find(a => a.playerId === 'current-batter')!.personId = 'foreign'; }],
  ['duplicate current World model entry', x => { x.world.model.actors.push(x.world.model.actors.find(a => a.playerId === 'current-batter')!); }],
  ['duplicate current response model entry', x => { x.responseModel.actors.push(x.responseModel.actors.find(a => a.playerId === 'current-batter')!); }],
  ['a missing World body role', x => { x.world.model.actors.find(a => a.playerId === 'current-batter')!.primitives.pop(); }],
  ['a duplicate response body role', x => { const a = x.responseModel.actors.find(a => a.playerId === 'current-batter')!; a.primitives[1] = a.primitives[0]; }],
  ['prior-batter active primitives', x => { for (const a of x.world.actors) if (a.playerId === 'current-batter') a.playerId = 'prior-batter'; }],
  ['a duplicate active primitive role', x => { const a = x.world.actors.filter(a => a.playerId === 'current-batter'); a[1].primitive = a[0].primitive; }],
  ['an extra active primitive', x => { x.world.actors.push(x.world.actors[0]); }],
  ['a missing active primitive', x => { x.world.actors.pop(); }],
  ['prior-batter commands', x => { x.world.source.commands.find(c => c.playerId === 'current-batter')!.playerId = 'prior-batter'; }],
  ['duplicate current commands', x => { x.world.source.commands[1] = x.world.source.commands[0]; }],
  ['a missing command role', x => { x.world.source.commands[0].primitiveMotions.pop(); }],
];
for (const [label, change] of changes) it(`rejects ${label}`, () => { const x = fixture(); change(x); expect(matches(x)).toBe(false); });
