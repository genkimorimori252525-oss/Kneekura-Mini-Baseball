import { createRosterState } from '../roster/RosterState';
import type { RosterState } from '../roster/RosterTypes';
import { JOINT_TASKS } from './PlayerRelationships';
import type { JointTask, PlayerRelationshipNetwork } from './PlayerRelationships';

export type DefenseCoordinationTraitPolicy = Readonly<{
  policyId: string;
  version: string;
  season: number;
  availableAtDay: number;
  minimumJointEventsPerDirection: number;
  maximumEvidenceAgeDays: number;
  blueThreshold: number;
  goldThreshold: number;
  redThreshold: number;
}>;
export type DefenseCoordinationTraitDescriptor = Readonly<{
  family: 'DEFENSE_COORDINATION';
  mode: 'CAUSAL_STATE_DESCRIPTOR';
  boundaryPolicy: 'CARRYOVER_ELIGIBLE';
  tier: 'RED' | 'BLUE' | 'GOLD';
  careerId: string;
  clubId: string;
  season: number;
  atDay: number;
  task: JointTask;
  memberPlayerIds: readonly [string, string];
  score: number;
  policyId: string;
  policyVersion: string;
  sourceEventIds: readonly string[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));

/** Projects a pair descriptor over actual task coordination, never a skill bonus. */
export const deriveDefenseCoordinationTrait = (
  network: PlayerRelationshipNetwork,
  rosterInput: RosterState,
  clubId: string,
  firstPlayerId: string,
  secondPlayerId: string,
  task: JointTask,
  atDay: number,
  policy: DefenseCoordinationTraitPolicy,
): DefenseCoordinationTraitDescriptor | null => {
  const roster = createRosterState(rosterInput);
  if (!id(clubId) || !id(firstPlayerId)
    || !id(secondPlayerId)
    || firstPlayerId === secondPlayerId
    || !JOINT_TASKS.includes(task) || task === 'BATTERY'
    || !day(atDay)
    || roster.effectiveDay !== atDay
    || network.effectiveDay > atDay
    || network.careerId !== roster.careerId
    || !Array.isArray(network.events)
    || network.revision !== network.events.length
    || !fields(policy, ['policyId', 'version', 'season',
      'availableAtDay', 'minimumJointEventsPerDirection',
      'maximumEvidenceAgeDays', 'blueThreshold',
      'goldThreshold', 'redThreshold'])
    || !id(policy.policyId) || !id(policy.version)
    || !Number.isSafeInteger(policy.season)
    || policy.season <= 0
    || !roster.profiles.some((profile) =>
      profile.season === policy.season)
    || !day(policy.availableAtDay)
    || policy.availableAtDay > atDay
    || !Number.isSafeInteger(policy.minimumJointEventsPerDirection)
    || policy.minimumJointEventsPerDirection <= 0
    || !day(policy.maximumEvidenceAgeDays)) {
    throw new Error('invalid defense coordination scope or policy');
  }
  const baseline = network.policy.baseline.coordination;
  if (![policy.blueThreshold, policy.goldThreshold,
    policy.redThreshold].every((value) =>
    Number.isFinite(value) && value >= 0 && value <= 100)
    || !(policy.redThreshold < baseline
      && baseline < policy.blueThreshold
      && policy.blueThreshold < policy.goldThreshold)) {
    throw new Error('invalid defense coordination threshold');
  }
  const assigned = (playerId: string) => roster.players.some((player) =>
    player.playerId === playerId
      && player.assignment?.clubId === clubId);
  if (!assigned(firstPlayerId) || !assigned(secondPlayerId)) {
    return null;
  }
  const first = network.links.find((link) =>
    link.fromPlayerId === firstPlayerId
      && link.toPlayerId === secondPlayerId);
  const second = network.links.find((link) =>
    link.fromPlayerId === secondPlayerId
      && link.toPlayerId === firstPlayerId);
  const firstScore = first?.coordinationByTask[task];
  const secondScore = second?.coordinationByTask[task];
  if (firstScore === undefined || secondScore === undefined) {
    return null;
  }
  if (!Number.isFinite(firstScore) || !Number.isFinite(secondScore)
    || firstScore < 0 || firstScore > 100
    || secondScore < 0 || secondScore > 100) {
    throw new Error('invalid defense coordination source state');
  }
  const recent = network.events.filter((event) =>
    event.task === task && event.atDay <= atDay
      && event.atDay >= atDay - policy.maximumEvidenceAgeDays
      && (event.kind === 'JOINT_REPETITION'
        || event.kind === 'JOINT_EXECUTION'
        || event.kind === 'JOINT_FAILURE')
      && ((event.after.fromPlayerId === firstPlayerId
        && event.after.toPlayerId === secondPlayerId)
        || (event.after.fromPlayerId === secondPlayerId
          && event.after.toPlayerId === firstPlayerId)));
  const forwardCount = recent.filter((event) =>
    event.after.fromPlayerId === firstPlayerId).length;
  const reverseCount = recent.length - forwardCount;
  if (forwardCount < policy.minimumJointEventsPerDirection
    || reverseCount < policy.minimumJointEventsPerDirection) {
    return null;
  }
  const score = Math.min(firstScore, secondScore);
  const tier = score >= policy.goldThreshold ? 'GOLD'
    : score >= policy.blueThreshold ? 'BLUE'
      : score <= policy.redThreshold ? 'RED' : null;
  if (!tier) return null;
  const members = [firstPlayerId, secondPlayerId].sort() as [string, string];
  return Object.freeze({ family: 'DEFENSE_COORDINATION',
    mode: 'CAUSAL_STATE_DESCRIPTOR',
    boundaryPolicy: 'CARRYOVER_ELIGIBLE',
    tier, careerId: roster.careerId, clubId,
    season: policy.season, atDay, task,
    memberPlayerIds: Object.freeze(members), score,
    policyId: policy.policyId, policyVersion: policy.version,
    sourceEventIds: Object.freeze([...new Set(recent.map((event) =>
      event.sourceEventId))].sort()),
  });
};
