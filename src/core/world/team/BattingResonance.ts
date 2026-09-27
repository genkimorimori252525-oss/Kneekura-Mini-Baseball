import type { PlayerRelationshipLink,
  PlayerRelationshipNetwork } from './PlayerRelationships';

export type OffensiveResonanceChannel = 'POWER' | 'CONTACT'
  | 'ON_BASE' | 'SPEED_PRESSURE' | 'NONE';
export type BattingResonancePolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  minAffinity: number;
  minTrust: number;
  minSharedSuccessMemory: number;
  minChannelStrength: number;
}>;
export type ReceiverOffensiveProfile = Readonly<{
  playerId: string;
  power: number;
  contact: number;
  onBase: number;
  speedPressure: number;
}>;
export type TeammateBattingSuccess = Readonly<{
  sourceEventId: string;
  careerId: string;
  gameId: string;
  teamId: string;
  atDay: number;
  batterPlayerId: string;
  result: 'HIT' | 'HOME_RUN' | 'REACHED_BASE';
}>;
export type BattingLineupContext = Readonly<{
  gameId: string;
  teamId: string;
  playerIds: readonly string[];
}>;
export type BattingResonanceScope = Readonly<{
  kind: 'PAIR' | 'CLUSTER';
  playerIds: readonly string[];
}>;
export type BattingResonanceStimulus = Readonly<{
  type: 'BATTING_RESONANCE_STIMULUS';
  family: 'BATTING_RESONANCE';
  mode: 'CAUSAL_STATE_DESCRIPTOR';
  sourceEventId: string;
  sourceResult: TeammateBattingSuccess['result'];
  careerId: string;
  gameId: string;
  teamId: string;
  atDay: number;
  sourcePlayerId: string;
  receiverPlayerId: string;
  channel: Exclude<OffensiveResonanceChannel, 'NONE'>;
  proximity: 'ADJACENT' | 'OTHER_LINEUP';
  scope: BattingResonanceScope;
  policyId: string;
  policyVersion: string;
}>;
export type BattingResonanceInput = Readonly<{
  network: PlayerRelationshipNetwork;
  policy: BattingResonancePolicy;
  success: TeammateBattingSuccess;
  lineup: BattingLineupContext;
  scope: BattingResonanceScope;
  receiverProfile: ReceiverOffensiveProfile;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const rating = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0
    && (value as number) <= 100;
const distinctIds = (values: unknown): values is readonly string[] =>
  Array.isArray(values) && values.every(id)
    && new Set(values).size === values.length;
const validPolicy = (policy: BattingResonancePolicy): boolean =>
  !!policy && id(policy.policyId) && id(policy.version)
    && day(policy.availableAtDay)
    && rating(policy.minAffinity) && rating(policy.minTrust)
    && Number.isSafeInteger(policy.minSharedSuccessMemory)
    && policy.minSharedSuccessMemory >= 1
    && rating(policy.minChannelStrength)
    && policy.minChannelStrength >= 1;
const validProfile = (profile: ReceiverOffensiveProfile): boolean =>
  !!profile && id(profile.playerId)
    && rating(profile.power) && rating(profile.contact)
    && rating(profile.onBase) && rating(profile.speedPressure);

/** The channel belongs to the receiver's true profile, never the teammate's hit. */
export const selectOffensiveResonanceChannel = (
  profile: ReceiverOffensiveProfile,
  policy: BattingResonancePolicy,
): OffensiveResonanceChannel => {
  if (!validPolicy(policy)) throw new Error('invalid resonance policy');
  if (!validProfile(profile)) throw new Error('invalid receiver profile');
  const channels = [
    ['POWER', profile.power], ['CONTACT', profile.contact],
    ['ON_BASE', profile.onBase], ['SPEED_PRESSURE', profile.speedPressure],
  ] as const;
  const best = channels.reduce((current, candidate) =>
    candidate[1] > current[1] ? candidate : current);
  return best[1] >= policy.minChannelStrength ? best[0] : 'NONE';
};

const eligibleLink = (
  link: PlayerRelationshipLink,
  policy: BattingResonancePolicy,
): boolean => link.affinity >= policy.minAffinity
  && link.trust >= policy.minTrust
  && link.sharedSuccessMemory >= policy.minSharedSuccessMemory;

const connectedCluster = (
  scope: BattingResonanceScope,
  network: PlayerRelationshipNetwork,
  policy: BattingResonancePolicy,
): boolean => {
  const reached = new Set([scope.playerIds[0]]);
  let previousSize = -1;
  while (reached.size !== previousSize) {
    previousSize = reached.size;
    for (const link of network.links) {
      if (!eligibleLink(link, policy)) continue;
      if (reached.has(link.fromPlayerId)
        && scope.playerIds.includes(link.toPlayerId)) {
        reached.add(link.toPlayerId);
      }
      if (reached.has(link.toPlayerId)
        && scope.playerIds.includes(link.fromPlayerId)) {
        reached.add(link.fromPlayerId);
      }
    }
  }
  return reached.size === scope.playerIds.length;
};

/** Emits one positive cue for one receiver and canonical success event. */
export const evaluateBattingResonance = (
  input: BattingResonanceInput,
): BattingResonanceStimulus | null => {
  const { network, policy, success, lineup, scope,
    receiverProfile } = input;
  if (!validPolicy(policy)) throw new Error('invalid resonance policy');
  if (!validProfile(receiverProfile)) {
    throw new Error('invalid receiver profile');
  }
  if (!success || !id(success.sourceEventId) || !id(success.careerId)
    || !id(success.gameId) || !id(success.teamId)
    || !id(success.batterPlayerId) || !day(success.atDay)
    || !(['HIT', 'HOME_RUN', 'REACHED_BASE'] as const)
      .includes(success.result)) {
    throw new Error('invalid resonance success evidence');
  }
  if (!network || success.careerId !== network.careerId
    || success.atDay < policy.availableAtDay
    || success.atDay < network.effectiveDay) {
    throw new Error('invalid resonance career or day');
  }
  if (!scope || !distinctIds(scope.playerIds)
    || (scope.kind === 'PAIR' && scope.playerIds.length !== 2)
    || (scope.kind === 'CLUSTER' && scope.playerIds.length < 3)
    || (scope.kind !== 'PAIR' && scope.kind !== 'CLUSTER')
    || !scope.playerIds.includes(success.batterPlayerId)
    || !scope.playerIds.includes(receiverProfile.playerId)
    || success.batterPlayerId === receiverProfile.playerId) {
    throw new Error('invalid resonance scope');
  }
  if (!lineup || !id(lineup.gameId) || !id(lineup.teamId)
    || !distinctIds(lineup.playerIds)
    || lineup.gameId !== success.gameId
    || lineup.teamId !== success.teamId
    || !scope.playerIds.every((playerId) =>
      lineup.playerIds.includes(playerId))) {
    throw new Error('invalid resonance lineup');
  }
  const link = network.links.find((candidate) =>
    candidate.fromPlayerId === receiverProfile.playerId
      && candidate.toPlayerId === success.batterPlayerId);
  if (!link || !eligibleLink(link, policy)
    || (scope.kind === 'CLUSTER'
      && !connectedCluster(scope, network, policy))) return null;
  const channel = selectOffensiveResonanceChannel(receiverProfile, policy);
  if (channel === 'NONE') return null;
  const sourceIndex = lineup.playerIds.indexOf(success.batterPlayerId);
  const receiverIndex = lineup.playerIds.indexOf(receiverProfile.playerId);
  const distance = Math.abs(sourceIndex - receiverIndex);
  const adjacent = Math.min(distance, lineup.playerIds.length - distance) === 1;
  return Object.freeze({ type: 'BATTING_RESONANCE_STIMULUS',
    family: 'BATTING_RESONANCE', mode: 'CAUSAL_STATE_DESCRIPTOR',
    sourceEventId: success.sourceEventId, sourceResult: success.result,
    careerId: success.careerId, gameId: success.gameId,
    teamId: success.teamId, atDay: success.atDay,
    sourcePlayerId: success.batterPlayerId,
    receiverPlayerId: receiverProfile.playerId,
    channel, proximity: adjacent ? 'ADJACENT' : 'OTHER_LINEUP',
    scope: Object.freeze({ kind: scope.kind,
      playerIds: Object.freeze([...scope.playerIds]) }),
    policyId: policy.policyId, policyVersion: policy.version,
  });
};
