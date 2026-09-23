import { fnv1a32 } from '../../rng/DeterministicRng';

export type DrawParticipant = Readonly<{
  teamId: string;
  pot: number;
  leagueId: string;
  regionId: string;
}>;
export type DrawSoftConstraint =
  | 'SAME_LEAGUE_AVOIDANCE' | 'REGIONAL_DIVERSITY' | 'REMATCH_AVOIDANCE';
export type CompetitionDrawInput = Readonly<{
  editionId: string;
  drawPolicyVersion: string;
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
const compareScore = (a: Score, b: Score): number =>
  a.sameLeague - b.sameLeague || a.sameRegion - b.sameRegion || a.rematch - b.rematch;

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
export const drawCompetitionGroups = (input: CompetitionDrawInput): CompetitionDraw => {
  if (!input.editionId || !input.drawPolicyVersion || !input.drawSeed
    || !Number.isSafeInteger(input.groupCount) || input.groupCount < 2
    || input.groupCount > 6 || input.participants.length === 0
    || input.participants.length % input.groupCount !== 0) {
    throw new Error('invalid versioned competition draw');
  }
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
    const next = beam.flatMap((groups) => assignments.map((assignment) =>
      groups.map((group, index) => [...group, assignment[index]])));
    next.sort((a, b) => {
      const priority = compareScore(scoreGroups(a, rematches), scoreGroups(b, rematches));
      if (priority !== 0) return priority;
      const keyA = a.map((group) => group.map((team) => team.teamId).join(':')).join('|');
      const keyB = b.map((group) => group.map((team) => team.teamId).join(':')).join('|');
      return fnv1a32(`${input.drawSeed}:${keyA}`) - fnv1a32(`${input.drawSeed}:${keyB}`)
        || (keyA < keyB ? -1 : keyA > keyB ? 1 : 0);
    });
    beam = next.slice(0, 128);
  }
  const groups = beam[0];
  const counts = scoreGroups(groups, rematches);
  const relaxedConstraints: DrawSoftConstraint[] = [];
  if (counts.sameLeague > 0) relaxedConstraints.push('SAME_LEAGUE_AVOIDANCE');
  if (counts.sameRegion > 0) relaxedConstraints.push('REGIONAL_DIVERSITY');
  if (counts.rematch > 0) relaxedConstraints.push('REMATCH_AVOIDANCE');
  return Object.freeze({
    editionId: input.editionId,
    drawPolicyVersion: input.drawPolicyVersion,
    drawSeed: input.drawSeed,
    groups: Object.freeze(groups.map((group) => Object.freeze(group.map((team) =>
      Object.freeze({ ...team }))))),
    appliedConstraints: Object.freeze([
      'POT_INTEGRITY', 'PARTICIPANT_UNIQUENESS', 'LEGAL_GROUP_SIZE',
    ]),
    relaxedConstraints: Object.freeze(relaxedConstraints),
    softViolationCounts: Object.freeze(counts),
  });
};
