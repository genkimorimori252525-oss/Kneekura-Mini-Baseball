import { deriveDefenseCoordinationTrait,
  type DefenseCoordinationTraitDescriptor,
  type DefenseCoordinationTraitPolicy } from
  '../../core/world/team/DefenseCoordinationTrait';
import type { JointTask } from
  '../../core/world/team/PlayerRelationships';
import type { SqliteManagerRosterDecisionStore } from
  './SqliteManagerRosterDecisionStore';
import type { SqlitePlayerRelationshipStore } from
  './SqlitePlayerRelationshipStore';

export type DurableDefenseCoordinationSources = Readonly<{
  roster: Pick<SqliteManagerRosterDecisionStore, 'readHead'>;
  relationships: Pick<SqlitePlayerRelationshipStore, 'readAtDay'>;
  policy: Readonly<{
    readAcceptedPolicy(sourceId: string): Readonly<{
      sourceId: string; careerId: string; clubId: string;
      policy: DefenseCoordinationTraitPolicy;
    }> | null;
  }>;
}>;

/** A present-day descriptor over actual pair coordination and roster membership. */
export const projectDefenseCoordinationFromWorld = (
  sources: DurableDefenseCoordinationSources,
  input: Readonly<{ careerId: string; clubId: string;
    firstPlayerId: string; secondPlayerId: string;
    task: JointTask; policySourceId: string }>,
): DefenseCoordinationTraitDescriptor | null => {
  if (!input || !input.policySourceId) {
    throw new Error('invalid defense coordination source');
  }
  const head = sources.roster.readHead(input.careerId,
    input.clubId);
  const pinned = sources.policy.readAcceptedPolicy(
    input.policySourceId);
  if (!head || !pinned
    || pinned.sourceId !== input.policySourceId
    || pinned.careerId !== input.careerId
    || pinned.clubId !== input.clubId
    || head.roster.careerId !== input.careerId) {
    throw new Error('defense coordination lacks accepted World sources');
  }
  const atDay = head.roster.effectiveDay;
  const network = sources.relationships.readAtDay(
    input.careerId, atDay);
  if (!network) {
    throw new Error('defense coordination relationship history is missing');
  }
  return deriveDefenseCoordinationTrait(network,
    head.roster, input.clubId, input.firstPlayerId,
    input.secondPlayerId, input.task, atDay,
    pinned.policy);
};
