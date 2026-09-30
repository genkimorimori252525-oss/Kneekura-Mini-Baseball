import { fnv1a32 } from '../../rng/DeterministicRng';
import type { CompetitionFormatProfile } from './CompetitionEdition';

export type DrawParticipant = Readonly<{
  teamId: string;
  pot: number;
  leagueId: string;
  regionId: string;
}>;
export type DrawSoftConstraint =
  | 'SAME_LEAGUE_AVOIDANCE' | 'REGIONAL_DIVERSITY' | 'REMATCH_AVOIDANCE';
export type CompetitionDrawPolicy = Readonly<{
  version: string;
  /** First constraint permitted to relax, through last. */
  relaxationOrder: readonly DrawSoftConstraint[];
}>;
export type CompetitionDrawPolicyRegistry = Readonly<{
  policies: readonly CompetitionDrawPolicy[];
}>;
/** Persist this registry with the career; one version cannot name two orders. */
export const EMPTY_COMPETITION_DRAW_POLICY_REGISTRY: CompetitionDrawPolicyRegistry =
  Object.freeze({ policies: Object.freeze([]) });
export type CompetitionDrawInput = Readonly<{
  editionId: string;
  profile: Pick<CompetitionFormatProfile, 'drawPolicyVersion' | 'drawPolicy'>;
  drawSeed: string;
  groupCount: number;
  participants: readonly DrawParticipant[];
  rematchPairs: readonly (readonly [string, string])[];
}>;
export type CompetitionDraw = Readonly<{
  editionId: string;
  drawPolicyVersion: string;
  drawSeed: string;
  groups: readonly (readonly DrawParticipant[])[];
  relaxationOrder: readonly DrawSoftConstraint[];
  appliedConstraints: readonly string[];
  relaxedConstraints: readonly DrawSoftConstraint[];
  softViolationCounts: Readonly<{
    sameLeague: number;
    sameRegion: number;
    rematch: number;
  }>;
}>;

const permutations = <T>(items: readonly T[]): T[][] => {
  if (items.length === 0) return [[]];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)])
      .map((rest) => [item, ...rest]));
};

type Score = Readonly<{ sameLeague: number; sameRegion: number; rematch: number }>;
const SCORE_KEY: Readonly<Record<DrawSoftConstraint, keyof Score>> = {
  SAME_LEAGUE_AVOIDANCE: 'sameLeague',
  REGIONAL_DIVERSITY: 'sameRegion',
  REMATCH_AVOIDANCE: 'rematch',
};
export const snapshotCompetitionDrawPolicy = (
  policy: CompetitionDrawPolicy,
): CompetitionDrawPolicy => {
  const requestedOrder: unknown = policy?.relaxationOrder;
  if (typeof policy?.version !== 'string' || policy.version.length === 0
    || !Array.isArray(requestedOrder)
    || requestedOrder.length !== 3 || new Set(requestedOrder).size !== 3
    || requestedOrder.some((constraint) =>
      typeof constraint !== 'string' || !Object.hasOwn(SCORE_KEY, constraint))) {
    throw new Error('draw relaxation order requires a valid versioned policy');
  }
  return Object.freeze({ version: policy.version,
    relaxationOrder: Object.freeze([...requestedOrder]) });
};
const readRegistry = (registry: CompetitionDrawPolicyRegistry):
readonly CompetitionDrawPolicy[] => {
  if (!Array.isArray(registry?.policies)) {
    throw new Error('draw policy registry is required');
  }
  const policies: readonly CompetitionDrawPolicy[] = registry.policies;
  const versions = new Set<string>();
  for (const policy of policies) {
    const snapshot = snapshotCompetitionDrawPolicy(policy);
    if (versions.has(snapshot.version)) {
      throw new Error('draw policy registry contains duplicate versions');
    }
    versions.add(snapshot.version);
  }
  return policies;
};
export const registerCompetitionDrawPolicy = (
  registry: CompetitionDrawPolicyRegistry,
  policy: CompetitionDrawPolicy,
): CompetitionDrawPolicyRegistry => {
  const policies = readRegistry(registry);
  const snapshot = snapshotCompetitionDrawPolicy(policy);
  const existing = policies.find((item) => item.version === snapshot.version);
  if (existing) {
    if (existing.relaxationOrder.length !== snapshot.relaxationOrder.length
      || existing.relaxationOrder.some((item, index) =>
        item !== snapshot.relaxationOrder[index])) {
      throw new Error('draw policy version conflicts with registered relaxation order');
    }
    return registry;
  }
  return Object.freeze({ policies: Object.freeze([...policies,
    snapshot]) });
};
export const requireRegisteredDrawPolicy = (
  registry: CompetitionDrawPolicyRegistry,
  policy: CompetitionDrawPolicy,
): CompetitionDrawPolicy => {
  const snapshot = snapshotCompetitionDrawPolicy(policy);
  const registered = readRegistry(registry).find((item) =>
    item.version === snapshot.version);
  if (!registered || registered.relaxationOrder.length !== snapshot.relaxationOrder.length
    || registered.relaxationOrder.some((item, index) =>
      item !== snapshot.relaxationOrder[index])) {
    throw new Error('draw policy must match the registered version');
  }
  return snapshot;
};
const compareScore = (a: Score, b: Score,
  relaxationOrder: readonly DrawSoftConstraint[]): number => {
  for (const constraint of [...relaxationOrder].reverse()) {
    const difference = a[SCORE_KEY[constraint]] - b[SCORE_KEY[constraint]];
    if (difference !== 0) return difference;
  }
  return 0;
};

const scoreGroups = (
  groups: readonly (readonly DrawParticipant[])[],
  rematches: ReadonlySet<string>,
): Score => {
  let sameLeague = 0;
  let sameRegion = 0;
  let rematch = 0;
  for (const group of groups) {
    for (let left = 0; left < group.length; left += 1) {
      for (let right = left + 1; right < group.length; right += 1) {
        if (group[left].leagueId === group[right].leagueId) sameLeague += 1;
        if (group[left].regionId === group[right].regionId) sameRegion += 1;
        if (rematches.has(JSON.stringify([group[left].teamId, group[right].teamId].sort()))) {
          rematch += 1;
        }
      }
    }
  }
  return { sameLeague, sameRegion, rematch };
};

/** Hard pot rules never relax. Soft priorities use a bounded deterministic search. */
export const drawCompetitionGroups = (input: CompetitionDrawInput,
  registry: CompetitionDrawPolicyRegistry): CompetitionDraw => {
  if (!input.editionId || !input.profile?.drawPolicyVersion || !input.drawSeed
    || !Number.isSafeInteger(input.groupCount) || input.groupCount < 2
    || input.groupCount > 6 || input.participants.length === 0
    || input.participants.length % input.groupCount !== 0) {
    throw new Error('invalid versioned competition draw');
  }
  if (input.profile.drawPolicy?.version !== input.profile.drawPolicyVersion) {
    throw new Error('draw policy must match its versioned competition profile');
  }
  const relaxationOrder = requireRegisteredDrawPolicy(
    registry, input.profile.drawPolicy).relaxationOrder;
  const potCount = input.participants.length / input.groupCount;
  const teamIds = new Set<string>();
  const pots = Array.from({ length: potCount }, () => [] as DrawParticipant[]);
  for (const participant of input.participants) {
    if (!participant.teamId || !participant.leagueId || !participant.regionId
      || teamIds.has(participant.teamId)
      || !Number.isSafeInteger(participant.pot)
      || participant.pot < 1 || participant.pot > potCount) {
      throw new Error('draw participants must be unique and assigned to legal pots');
    }
    teamIds.add(participant.teamId);
    pots[participant.pot - 1].push(participant);
  }
  if (pots.some((pot) => pot.length !== input.groupCount)) {
    throw new Error('draw pots must each match the legal group count');
  }
  const rematches = new Set(input.rematchPairs.map((pair) => {
    if (!teamIds.has(pair[0]) || !teamIds.has(pair[1]) || pair[0] === pair[1]) {
      throw new Error('draw rematch pair references an invalid team');
    }
    return JSON.stringify([...pair].sort());
  }));
  const sortedPots = pots.map((pot) => [...pot].sort((a, b) =>
    fnv1a32(`${input.drawSeed}:${a.teamId}`) - fnv1a32(`${input.drawSeed}:${b.teamId}`)
    || (a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0)));
  let beam: DrawParticipant[][][] = [sortedPots[0].map((participant) => [participant])];
  for (let potIndex = 1; potIndex < sortedPots.length; potIndex += 1) {
    const assignments = permutations(sortedPots[potIndex]);
    const next = beam.flatMap((groups) => assignments.map((assignment) => {
      const candidate = groups.map((group, index) => [...group, assignment[index]]);
      const key = candidate.map((group) => group.map((team) => team.teamId).join(':')).join('|');
      return { groups: candidate, score: scoreGroups(candidate, rematches), key,
        tieHash: fnv1a32(`${input.drawSeed}:${key}`) };
    }));
    next.sort((a, b) => {
      const priority = compareScore(a.score, b.score, relaxationOrder);
      if (priority !== 0) return priority;
      return a.tieHash - b.tieHash || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
    });
    beam = next.slice(0, 128).map((candidate) => candidate.groups);
  }
  const groups = beam[0];
  const counts = scoreGroups(groups, rematches);
  const relaxedConstraints = relaxationOrder.filter((constraint) =>
    counts[SCORE_KEY[constraint]] > 0);
  return Object.freeze({
    editionId: input.editionId,
    drawPolicyVersion: input.profile.drawPolicyVersion,
    drawSeed: input.drawSeed,
    relaxationOrder: Object.freeze([...relaxationOrder]),
    groups: Object.freeze(groups.map((group) => Object.freeze(group.map((team) =>
      Object.freeze({ ...team }))))),
    appliedConstraints: Object.freeze([
      'POT_INTEGRITY', 'PARTICIPANT_UNIQUENESS', 'LEGAL_GROUP_SIZE',
    ]),
    relaxedConstraints: Object.freeze(relaxedConstraints),
    softViolationCounts: Object.freeze(counts),
  });
};
