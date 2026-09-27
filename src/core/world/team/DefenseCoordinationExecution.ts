import { generateDefensiveIntentCandidates } from '../../sim/fielding/DefensiveDecision';
import type { DefensiveDecisionInput } from '../../sim/fielding/DefensiveDecision';
import { createTeamCoveragePlan } from '../../sim/fielding/TeamCoveragePlan';
import type { TeamCoveragePlan,
  TeamCoveragePlanInput } from '../../sim/fielding/TeamCoveragePlan';
import { createRosterState } from '../roster/RosterState';
import type { RosterState } from '../roster/RosterTypes';
import type { PlayerRelationshipNetwork } from './PlayerRelationships';

export type DefenseCoordinationExecutionPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  neutralCoordination: number;
  minimumJointEventsPerDirection: number;
  maximumEvidenceAgeDays: number;
  positiveCueGain: number;
  negativeCueLoss: number;
}>;
export type MiddleInfieldCoordinationCue = Readonly<{
  task: 'MIDDLE_INFIELD';
  receiverPlayerId: string;
  teammatePlayerId: string;
  pairScore: number;
  observedConfidence: number;
  adjustedConfidence: number;
  observedAt: number;
  sourceEventIds: readonly string[];
  policyId: string;
  policyVersion: string;
}>;
export type CoordinatedCoveragePlan = Readonly<{
  plan: TeamCoveragePlan;
  cue: MiddleInfieldCoordinationCue | null;
}>;
export type MiddleInfieldCoverageInput = Readonly<{
  network: PlayerRelationshipNetwork;
  roster: RosterState;
  clubId: string;
  atDay: number;
  policy: DefenseCoordinationExecutionPolicy;
  receiver: DefensiveDecisionInput;
  teammatePlayerId: string;
  coverage: TeamCoveragePlanInput;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const rating = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 100;

/** Shared task history changes interpretation of an observed role cue only. */
export const planMiddleInfieldCoordinatedCoverage = (
  input: MiddleInfieldCoverageInput,
): CoordinatedCoveragePlan => {
  const { network, clubId, atDay, policy, receiver,
    teammatePlayerId, coverage } = input;
  const roster = createRosterState(input.roster);
  if (!policy || !id(policy.policyId) || !id(policy.version)
    || !day(policy.availableAtDay)
    || !rating(policy.neutralCoordination)
    || policy.neutralCoordination <= 0
    || policy.neutralCoordination >= 100
    || !Number.isSafeInteger(policy.minimumJointEventsPerDirection)
    || policy.minimumJointEventsPerDirection < 1
    || !day(policy.maximumEvidenceAgeDays)
    || !unit(policy.positiveCueGain)
    || !unit(policy.negativeCueLoss)
    || policy.neutralCoordination
      !== network?.policy?.baseline.coordination
    || !day(atDay) || policy.availableAtDay > atDay) {
    throw new Error('invalid coordination policy');
  }
  if (!id(clubId) || !id(teammatePlayerId)
    || !network || network.careerId !== roster.careerId
    || network.effectiveDay > atDay
    || roster.effectiveDay > atDay
    || !Array.isArray(network.events)
    || network.revision !== network.events.length) {
    throw new Error('invalid coordination source scope');
  }
  const receiverId = receiver.self.playerId;
  const receiverSet = coverage.defenders.find((defender) =>
    defender.playerId === receiverId);
  const teammateSet = coverage.defenders.find((defender) =>
    defender.playerId === teammatePlayerId);
  const secondToShort = receiver.self.registeredPosition === '2B'
    && teammateSet?.registeredPosition === 'SS';
  const shortToSecond = receiver.self.registeredPosition === 'SS'
    && teammateSet?.registeredPosition === '2B';
  if (receiverId === teammatePlayerId
    || receiver.perceivedWorld.observerId !== receiverId
    || receiverSet?.registeredPosition
      !== receiver.self.registeredPosition
    || (!secondToShort && !shortToSecond)) {
    throw new Error('invalid middle infield pair or perceived observer');
  }
  const assigned = (playerId: string): boolean =>
    roster.players.some((player) => player.playerId === playerId
      && player.assignment?.clubId === clubId);
  if (!assigned(receiverId) || !assigned(teammatePlayerId)) {
    throw new Error('middle infield pair is not assigned together');
  }
  const recent = network.events.filter((event) =>
    event.task === 'MIDDLE_INFIELD'
      && event.atDay <= atDay
      && event.atDay >= atDay - policy.maximumEvidenceAgeDays
      && (event.kind === 'JOINT_REPETITION'
        || event.kind === 'JOINT_EXECUTION'
        || event.kind === 'JOINT_FAILURE')
      && ((event.after.fromPlayerId === receiverId
        && event.after.toPlayerId === teammatePlayerId)
        || (event.after.fromPlayerId === teammatePlayerId
          && event.after.toPlayerId === receiverId)));
  const forwardCount = recent.filter((event) =>
    event.after.fromPlayerId === receiverId).length;
  const reverseCount = recent.length - forwardCount;
  const first = network.links.find((link) =>
    link.fromPlayerId === receiverId
      && link.toPlayerId === teammatePlayerId);
  const second = network.links.find((link) =>
    link.fromPlayerId === teammatePlayerId
      && link.toPlayerId === receiverId);
  const firstScore = first?.coordinationByTask.MIDDLE_INFIELD;
  const secondScore = second?.coordinationByTask.MIDDLE_INFIELD;
  if ((firstScore !== undefined && !rating(firstScore))
    || (secondScore !== undefined && !rating(secondScore))) {
    throw new Error('invalid middle infield coordination score');
  }
  const visible = receiver.perceivedWorld.players.some((player) =>
    player.playerId === teammatePlayerId
      && player.memory.confidence >= receiver.minimumCueConfidence);
  const commitment = receiver.perceivedCues
    .filter((cue) => cue.kind === 'teammate_ball_commitment'
      && cue.playerId === teammatePlayerId)
    .sort((a, b) => b.confidence - a.confidence
      || a.observedAt - b.observedAt)[0];
  let cue: MiddleInfieldCoordinationCue | null = null;
  let decision = receiver;
  if (visible && commitment
    && firstScore !== undefined && secondScore !== undefined
    && forwardCount >= policy.minimumJointEventsPerDirection
    && reverseCount >= policy.minimumJointEventsPerDirection) {
    const pairScore = Math.min(firstScore, secondScore);
    const observedConfidence = commitment.confidence;
    const positive = Math.max(0, pairScore
      - policy.neutralCoordination) / (100 - policy.neutralCoordination);
    const negative = Math.max(0, policy.neutralCoordination
      - pairScore) / policy.neutralCoordination;
    const interpret = (confidence: number): number => positive > 0
      ? confidence + (1 - confidence)
        * positive * policy.positiveCueGain
      : confidence * (1 - negative * policy.negativeCueLoss);
    const adjustedConfidence = interpret(observedConfidence);
    cue = Object.freeze({ task: 'MIDDLE_INFIELD',
      receiverPlayerId: receiverId,
      teammatePlayerId, pairScore, observedConfidence,
      adjustedConfidence, observedAt: commitment.observedAt,
      sourceEventIds: Object.freeze([...new Set(recent.map((event) =>
        event.sourceEventId))].sort()),
      policyId: policy.policyId, policyVersion: policy.version });
    decision = { ...receiver, perceivedCues: receiver.perceivedCues
      .map((entry) => entry.kind === 'teammate_ball_commitment'
        && entry.playerId === teammatePlayerId
        ? { ...entry, confidence: interpret(entry.confidence) }
        : entry) };
  }
  const candidates = generateDefensiveIntentCandidates(decision);
  const plan = createTeamCoveragePlan({ ...coverage,
    defenders: coverage.defenders.map((defender) =>
      defender.playerId === receiverId
        ? { ...defender, candidates } : defender) });
  return Object.freeze({ plan, cue });
};
