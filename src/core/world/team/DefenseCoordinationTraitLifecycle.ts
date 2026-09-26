import type { RosterState } from '../roster/RosterTypes';
import { deriveDefenseCoordinationTrait } from './DefenseCoordinationTrait';
import type { DefenseCoordinationTraitDescriptor,
  DefenseCoordinationTraitPolicy } from './DefenseCoordinationTrait';
import type { JointTask,
  PlayerRelationshipNetwork } from './PlayerRelationships';

const matchesEventHistory = (network: PlayerRelationshipNetwork): boolean => {
  if (!Array.isArray(network.events)
    || !Array.isArray(network.links)
    || network.revision !== network.events.length) return false;
  const links = new Map<string, (typeof network.links)[number]>();
  let day = network.policy.availableAtDay;
  for (const [index, event] of network.events.entries()) {
    const key = `${event.after.fromPlayerId}\0${event.after.toPlayerId}`;
    const previous = links.get(key) ?? null;
    if (event.careerId !== network.careerId
      || event.beforeRevision !== index
      || event.afterRevision !== index + 1
      || event.atDay < day
      || JSON.stringify(event.before) !== JSON.stringify(previous)) {
      return false;
    }
    links.set(key, event.after);
    day = event.atDay;
  }
  return day === network.effectiveDay
    && JSON.stringify([...links.values()])
      === JSON.stringify(network.links);
};

export type DefenseCoordinationTraitTransition = Readonly<{
  family: 'DEFENSE_COORDINATION';
  transition: 'ACQUIRED' | 'TIER_CHANGED' | 'REFRESHED'
    | 'EXPIRED' | 'UNCHANGED';
  careerId: string;
  clubId: string;
  atDay: number;
  beforeRevision: number;
  afterRevision: number;
  before: DefenseCoordinationTraitDescriptor | null;
  after: DefenseCoordinationTraitDescriptor | null;
}>;

/** Compares replayable relationship history; a descriptor never grants a fielding modifier. */
export const compareDefenseCoordinationTrait = (
  beforeNetwork: PlayerRelationshipNetwork,
  beforeRoster: RosterState,
  beforeDay: number,
  afterNetwork: PlayerRelationshipNetwork,
  afterRoster: RosterState,
  afterDay: number,
  clubId: string,
  firstPlayerId: string,
  secondPlayerId: string,
  task: JointTask,
  policy: DefenseCoordinationTraitPolicy,
): DefenseCoordinationTraitTransition => {
  if (beforeNetwork.careerId !== afterNetwork.careerId
    || beforeNetwork.revision > afterNetwork.revision
    || !matchesEventHistory(beforeNetwork)
    || !matchesEventHistory(afterNetwork)
    || beforeDay > afterDay
    || beforeNetwork.events.some((event, index) =>
      JSON.stringify(event)
        !== JSON.stringify(afterNetwork.events[index]))
    || JSON.stringify(beforeNetwork.policy)
      !== JSON.stringify(afterNetwork.policy)) {
    throw new Error('defense coordination history mismatch');
  }
  const before = deriveDefenseCoordinationTrait(beforeNetwork,
    beforeRoster, clubId, firstPlayerId, secondPlayerId,
    task, beforeDay, policy);
  const after = deriveDefenseCoordinationTrait(afterNetwork,
    afterRoster, clubId, firstPlayerId, secondPlayerId,
    task, afterDay, policy);
  const transition = !before && after ? 'ACQUIRED'
    : before && !after ? 'EXPIRED'
      : before && after && before.tier !== after.tier
        ? 'TIER_CHANGED'
        : before && after && (before.score !== after.score
          || JSON.stringify(before.sourceEventIds)
            !== JSON.stringify(after.sourceEventIds))
          ? 'REFRESHED' : 'UNCHANGED';
  return Object.freeze({ family: 'DEFENSE_COORDINATION',
    transition, careerId: afterNetwork.careerId,
    clubId, atDay: afterDay,
    beforeRevision: beforeNetwork.revision,
    afterRevision: afterNetwork.revision,
    before, after });
};
