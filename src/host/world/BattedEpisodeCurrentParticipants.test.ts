import { expect, it } from 'vitest';
import { battedEpisodeCurrentParticipantsMatch } from './BattedEpisodeCurrentParticipants';
import { battedEpisodeV2ParticipantsMatch, type EpisodeParticipantActor, type EpisodeParticipantWorld } from './BattedEpisodeParticipantBindingV2';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';

type Mutable<T> = { -readonly [K in keyof T]: Mutable<T[K]> };
const roles = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'] as const;
const fixture = (side: 'HOME' | 'AWAY' = 'HOME') => {
  const binding = (playerId: string, ownSide: 'HOME' | 'AWAY'): OfficialParticipantBinding => ({
    playerId, personId: `person-${playerId}`, personLinkSourceId: `person-source-${playerId}`,
    gameId: 'game', careerId: 'career', competitionEditionId: 'edition', fixtureEventId: 'fixture',
    gameDay: 10, rosterRevision: 0, side: ownSide, clubId: ownSide === 'HOME' ? 'home' : 'away' });
  const person = (b: OfficialParticipantBinding): DurablePlayerPersonLink => ({ sourceId: b.personLinkSourceId,
    careerId: b.careerId, playerId: b.playerId, personId: b.personId, sourceRecordId: `record-${b.playerId}`,
    sourceVersion: 'fixture-intake', acceptedRevision: 1, acceptedAtDay: 0, rosterRevision: 0 });
  const batter = binding(`${side}-batter`, side), defenders = Array.from({ length: 9 }, (_, i) => binding(`${side}-defender-${i}`, side === 'HOME' ? 'AWAY' : 'HOME'));
  const actor: EpisodeParticipantActor = { binding: batter, person: person(batter), defenderBindings: defenders, defenderPersons: defenders.map(person) };
  const all = [batter, ...defenders], model = { actors: all.map(b => ({ playerId: b.playerId, personId: b.personId,
    primitives: roles.map(role => ({ role })) })) };
  const world: EpisodeParticipantWorld = { model, modelActorEvidence: all.map(b => ({ binding: b, person: person(b) })),
    source: { commands: all.map(b => ({ playerId: b.playerId, primitiveMotions: roles.map(role => ({ role })) })) },
    actors: all.flatMap(b => roles.map(role => ({ playerId: b.playerId, primitive: { role } }))) };
  // Identity/role projections only; no physical calibration or accepted model
  // is created by these predicate tests.
  return { actor: structuredClone(actor), world: structuredClone(world), responseModel: structuredClone(model) } as Mutable<{ actor: EpisodeParticipantActor;
    world: EpisodeParticipantWorld; responseModel: EpisodeParticipantWorld['model'] }>;
};
type Fixture = ReturnType<typeof fixture>;
const matches = (x: Fixture) => battedEpisodeCurrentParticipantsMatch(x.actor, x.world, x.responseModel);
it.each(['HOME', 'AWAY'] as const)('uses the exact current %s batter and opposite-side nine with their own model evidence', side => {
  const x = fixture(side), before = JSON.stringify(x);
  expect(matches(x)).toBe(true); expect(JSON.stringify(x)).toBe(before);
  expect(battedEpisodeV2ParticipantsMatch(x.actor, fixture(side === 'HOME' ? 'AWAY' : 'HOME').actor, x.world, x.responseModel)).toBe(false);
});
it('is independent of catalog/command/role ordering without substituting an identity', () => {
  const x = fixture(); x.world.model.actors.reverse(); x.responseModel.actors.reverse(); x.world.modelActorEvidence.reverse();
  x.world.source.commands.reverse(); x.world.actors.reverse();
  expect(matches(x)).toBe(true);
});
const changes: [string, (x: Fixture) => void][] = [
  ['missing defender', x => { x.actor.defenderBindings.pop(); }],
  ['missing defender Person', x => { x.actor.defenderPersons.pop(); }],
  ['duplicate current Player', x => { x.actor.defenderBindings[1] = x.actor.defenderBindings[0]; }],
  ['duplicate current Person', x => { x.actor.defenderBindings[1].personId = x.actor.defenderBindings[0].personId; }],
  ['wrong current side', x => { x.actor.defenderBindings[0].side = x.actor.binding.side; }],
  ['wrong defensive club', x => { x.actor.defenderBindings[0].clubId = 'foreign'; }],
  ...(['gameId', 'careerId', 'competitionEditionId', 'fixtureEventId', 'gameDay'] as const).map(key =>
    [`wrong defender ${key}`, (x: Fixture) => Object.assign(x.actor.defenderBindings[0], { [key]: key === 'gameDay' ? 11 : 'foreign' })] as [string, (x: Fixture) => void]),
  ['old roster binding evidence', x => { x.world.modelActorEvidence[0].binding.rosterRevision++; }],
  ['different Person intake', x => { x.actor.person.sourceId = 'different-intake'; }],
  ['future Person intake', x => { x.actor.person.acceptedAtDay = 11; }],
  ['future Person roster revision', x => { x.actor.person.rosterRevision = 1; }],
  ['missing model evidence', x => { x.world.modelActorEvidence.pop(); }],
  ['duplicate model evidence', x => { x.world.modelActorEvidence.push(x.world.modelActorEvidence[0]); }],
  ['foreign model Person', x => { x.world.model.actors[0].personId = 'foreign'; }],
  ['missing response model Player', x => { x.responseModel.actors.pop(); }],
  ['duplicate response model Player', x => { x.responseModel.actors.push(x.responseModel.actors[0]); }],
  ['missing model role', x => { x.world.model.actors[0].primitives.pop(); }],
  ['duplicate response role', x => { x.responseModel.actors[0].primitives[1] = x.responseModel.actors[0].primitives[0]; }],
  ['missing active role', x => { x.world.actors.pop(); }],
  ['duplicate active role', x => { x.world.actors[1] = x.world.actors[0]; }],
  ['missing current command', x => { x.world.source.commands.pop(); }],
  ['foreign command Player', x => { x.world.source.commands[0].playerId = 'old-player'; }],
  ['missing command role', x => { x.world.source.commands[0].primitiveMotions.pop(); }],
];
for (const [name, change] of changes) it(`rejects ${name}`, () => { const x = fixture(); change(x); expect(matches(x)).toBe(false); });
