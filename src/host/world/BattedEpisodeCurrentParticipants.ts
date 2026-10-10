import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { EpisodeParticipantActor, EpisodeParticipantWorld } from './BattedEpisodeParticipantBindingV2';
import type { DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';

const roles: readonly DefenderPhysicalPrimitiveRole[] = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'];
const allRoles = (items: readonly Readonly<{ role: DefenderPhysicalPrimitiveRole }>[]) => items.length === roles.length
  && new Set(items.map(item => item.role)).size === roles.length && items.every(item => roles.includes(item.role));
const scope = ['gameId', 'careerId', 'competitionEditionId', 'gameDay', 'fixtureEventId'] as const;

/** V4 checks only the actual current participants against independently owned
 * model evidence. The earlier calibration contributes no Player or body data.
 * Inputs here have already been authenticated by the actor/contact owners. */
export const battedEpisodeCurrentParticipantsMatch = (actor: EpisodeParticipantActor, world: EpisodeParticipantWorld,
  responseModel: EpisodeParticipantWorld['model']): boolean => {
  const current = actor.binding, bindings = [current, ...actor.defenderBindings], persons = [actor.person, ...actor.defenderPersons];
  if (actor.defenderBindings.length !== 9 || actor.defenderPersons.length !== 9
    || !['HOME', 'AWAY'].includes(current.side)
    || new Set(bindings.map(binding => binding.playerId)).size !== 10
    || new Set(bindings.map(binding => binding.personId)).size !== 10
    || world.source.commands.length !== 10 || world.actors.length !== 50
    || actor.defenderBindings.some(binding => scope.some(key => binding[key] !== current[key])
      || binding.side !== (current.side === 'HOME' ? 'AWAY' : 'HOME') || binding.clubId === current.clubId
      || binding.clubId !== actor.defenderBindings[0].clubId)) return false;
  return bindings.every((binding, index) => {
    const person = persons[index], evidence = world.modelActorEvidence.filter(item => item.binding.playerId === binding.playerId);
    const commands = world.source.commands.filter(command => command.playerId === binding.playerId);
    return person.playerId === binding.playerId && person.personId === binding.personId && person.careerId === binding.careerId
      && person.sourceId === binding.personLinkSourceId && person.acceptedAtDay <= binding.gameDay && person.rosterRevision <= binding.rosterRevision
      && evidence.length === 1 && json(evidence[0].binding) === json(binding) && json(evidence[0].person) === json(person)
      && [world.model, responseModel].every(model => {
        const entries = model.actors.filter(item => item.playerId === binding.playerId);
        return entries.length === 1 && entries[0].personId === binding.personId && allRoles(entries[0].primitives);
      })
      && commands.length === 1 && allRoles(commands[0].primitiveMotions)
      && allRoles(world.actors.filter(item => item.playerId === binding.playerId).map(item => item.primitive));
  });
};
