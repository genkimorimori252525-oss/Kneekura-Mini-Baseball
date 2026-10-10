import { actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import type { DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { DurablePlayerPersonLink } from './SqlitePlayerPersonLinkStore';
import type { DefenderPhysicalPrimitiveRole } from '../../core/sim/fielding/DefenderPhysicalPrimitive';

export type EpisodeParticipantActor = Pick<DurablePhysicalPlateAppearanceActor,
  'binding' | 'person' | 'defenderBindings' | 'defenderPersons'>;
type Role = Readonly<{ role: DefenderPhysicalPrimitiveRole }>;
type Model = Readonly<{ actors: readonly Readonly<{ playerId: string; personId: string; primitives: readonly Role[] }>[] }>;
export type EpisodeParticipantWorld = Readonly<{
  model: Model;
  modelActorEvidence: readonly Readonly<{ binding: OfficialParticipantBinding; person: DurablePlayerPersonLink }>[];
  source: Readonly<{ commands: readonly Readonly<{ playerId: string; primitiveMotions: readonly Role[] }>[] }>;
  actors: readonly Readonly<{ playerId: string; primitive: Role }>[];
}>;
const roles: readonly DefenderPhysicalPrimitiveRole[] = ['glove', 'body', 'tag_hand', 'left_foot', 'right_foot'];
const allRoles = (items: readonly Role[]) => items.length === roles.length
  && new Set(items.map(item => item.role)).size === roles.length && items.every(item => roles.includes(item.role));
const scope = ['gameId', 'careerId', 'competitionEditionId', 'gameDay', 'fixtureEventId', 'clubId', 'side'] as const;

/** A version-specific predicate over already authenticated owner values. This
 * neither authenticates supplied snapshots nor selects/replaces physical models. */
export const battedEpisodeV2ParticipantsMatch = (actor: EpisodeParticipantActor, original: EpisodeParticipantActor,
  world: EpisodeParticipantWorld, responseModel: Model): boolean => {
  const current = actor.binding, previous = original.binding;
  const bindings = [current, ...actor.defenderBindings], persons = [actor.person, ...actor.defenderPersons];
  if (current.playerId === previous.playerId || current.personId === previous.personId
    || scope.some(key => current[key] !== previous[key])
    || actor.defenderBindings.length !== 9 || actor.defenderPersons.length !== 9
    || json(actor.defenderBindings) !== json(original.defenderBindings)
    || json(actor.defenderPersons) !== json(original.defenderPersons)
    || new Set(bindings.map(binding => binding.playerId)).size !== 10
    || new Set(bindings.map(binding => binding.personId)).size !== 10
    || world.source.commands.length !== 10 || world.actors.length !== 50) return false;
  return bindings.every((binding, index) => {
    const evidence = world.modelActorEvidence.filter(item => item.binding.playerId === binding.playerId);
    const commands = world.source.commands.filter(command => command.playerId === binding.playerId);
    return evidence.length === 1 && json(evidence[0].binding) === json(binding) && json(evidence[0].person) === json(persons[index])
      && [world.model, responseModel].every(model => {
        const entries = model.actors.filter(item => item.playerId === binding.playerId);
        return entries.length === 1 && entries[0].personId === binding.personId && allRoles(entries[0].primitives);
      })
      && commands.length === 1 && allRoles(commands[0].primitiveMotions)
      && allRoles(world.actors.filter(item => item.playerId === binding.playerId).map(item => item.primitive));
  });
};
