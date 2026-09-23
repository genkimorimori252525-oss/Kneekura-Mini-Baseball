import { fnv1a32 } from '../../rng/DeterministicRng';
import type { CompetitionDraw } from './CompetitionDraw';

export type HomeFairnessPolicy = Readonly<{
  version: string;
  /** Weight for one, two, ... prior competition editions. */
  recentEditionWeights: readonly number[];
}>;
export type HomeFairnessHistory = Readonly<{
  editionId: string;
  editionOrdinal: number;
  clubId: string;
  homeSeriesCount: 1 | 2;
  policyVersion: string;
}>;
export type HomeFairnessLedger = Readonly<{
  competitionId: string;
  revision: number;
  policies: readonly HomeFairnessPolicy[];
  history: readonly HomeFairnessHistory[];
}>;
export type ContinentalGroupHomeSeries = Readonly<{
  groupIndex: number;
  fairnessCost: number;
  series: readonly Readonly<{
    seriesId: string;
    homeClubId: string;
    awayClubId: string;
    gamesPerSeries: 3;
  }>[];
  homeSeriesCounts: readonly Readonly<{
    clubId: string;
    count: 1 | 2;
    creditBefore: number;
    creditAfter: number;
  }>[];
}>;
export type ContinentalHomeAssignment = Readonly<{
  competitionId: string;
  editionId: string;
  editionOrdinal: number;
  drawPolicyVersion: string;
  drawSeed: string;
  groupClubIds: readonly (readonly string[])[];
  homeFairnessPolicyVersion: string;
  homeFairnessPolicy: HomeFairnessPolicy;
  groups: readonly ContinentalGroupHomeSeries[];
  ledger: HomeFairnessLedger;
}>;
export type ContinentalHomeAssignmentInput = Readonly<{
  competitionId: string;
  editionId: string;
  editionOrdinal: number;
  expectedRevision: number;
  draw: CompetitionDraw;
  ledger: HomeFairnessLedger;
  policy: HomeFairnessPolicy;
}>;

const safeNonnegative = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

export const createHomeFairnessLedger = (
  competitionId: string,
): HomeFairnessLedger => {
  if (!text(competitionId)) throw new Error('competition ID is required');
  return Object.freeze({ competitionId, revision: 0,
    policies: Object.freeze([]), history: Object.freeze([]) });
};

const validPolicy = (policy: HomeFairnessPolicy): boolean => {
  const weights = policy?.recentEditionWeights;
  return text(policy?.version) && Array.isArray(weights)
    && weights.length > 0 && weights.some((weight) => weight > 0)
    && weights.every((weight, index) => Number.isFinite(weight)
      && weight >= 0 && (index === 0 || weight <= weights[index - 1]))
    && Number.isFinite(weights.reduce((sum, weight) => sum + weight, 0));
};

const validateInput = (input: ContinentalHomeAssignmentInput): void => {
  if (!text(input.competitionId) || !text(input.editionId)
    || !safeNonnegative(input.editionOrdinal)
    || !safeNonnegative(input.expectedRevision)
    || input.ledger?.competitionId !== input.competitionId
    || !safeNonnegative(input.ledger.revision)
    || input.expectedRevision !== input.ledger.revision) {
    throw new Error('home fairness competition or revision mismatch');
  }
  if (input.draw?.editionId !== input.editionId
    || !text(input.draw.drawPolicyVersion)
    || !text(input.draw.drawSeed)) {
    throw new Error('home fairness draw edition or policy mismatch');
  }
  if (!validPolicy(input.policy)) {
    throw new Error('invalid versioned home fairness policy');
  }
  if (!Array.isArray(input.ledger.policies)
    || input.ledger.policies.some((policy) => !validPolicy(policy))
    || new Set(input.ledger.policies.map((policy) => policy.version)).size
      !== input.ledger.policies.length) {
    throw new Error('invalid home fairness policy history');
  }
  const previousPolicy = input.ledger.policies.find((policy) =>
    policy.version === input.policy.version);
  const previousWeights: readonly number[] = previousPolicy?.recentEditionWeights ?? [];
  if (previousPolicy && (previousPolicy.recentEditionWeights.length
      !== input.policy.recentEditionWeights.length
    || previousWeights.some((weight, index) =>
      weight !== input.policy.recentEditionWeights[index]))) {
    throw new Error('home fairness policy version conflicts with history');
  }
  if (!Array.isArray(input.ledger.history)
    || input.ledger.history.some((entry) =>
      entry === null || typeof entry !== 'object'
      || !text(entry.editionId) || !text(entry.clubId)
      || !text(entry.policyVersion)
      || !input.ledger.policies.some((policy) =>
        policy.version === entry.policyVersion)
      || !safeNonnegative(entry.editionOrdinal)
      || entry.editionOrdinal >= input.editionOrdinal
      || (entry.homeSeriesCount !== 1 && entry.homeSeriesCount !== 2))
    || new Set(input.ledger.history.map((entry) =>
      JSON.stringify([entry.editionId, entry.clubId]))).size
      !== input.ledger.history.length
    || input.ledger.history.some((entry) =>
      input.ledger.history.some((other) =>
        (other.editionId === entry.editionId
          && other.editionOrdinal !== entry.editionOrdinal)
        || (other.editionOrdinal === entry.editionOrdinal
          && other.editionId !== entry.editionId)))) {
    throw new Error('home fairness history is invalid or contains this edition');
  }
  const editions = new Map<string, HomeFairnessHistory[]>();
  for (const entry of input.ledger.history) {
    const entries = editions.get(entry.editionId) ?? [];
    entries.push(entry);
    editions.set(entry.editionId, entries);
  }
  if (editions.size !== input.ledger.revision
    || [...editions.values()].some((entries) =>
      entries.length !== 16
      || entries.filter((entry) => entry.homeSeriesCount === 2).length !== 8
      || entries.some((entry) => entry.policyVersion !== entries[0].policyVersion))) {
    throw new Error('home fairness history has incomplete editions');
  }
  if (!Array.isArray(input.draw.groups)
    || input.draw.groups.length !== 4
    || input.draw.groups.some((group) =>
      !Array.isArray(group) || group.length !== 4
      || group.some((club: unknown) =>
        club === null || typeof club !== 'object'
        || !text((club as { teamId?: unknown }).teamId)))) {
    throw new Error('club-home continental draw requires four groups of four');
  }
  const clubIds = input.draw.groups.flatMap((group) =>
    group.map((club: { teamId: string }) => club.teamId));
  if (new Set(clubIds).size !== clubIds.length) {
    throw new Error('continental group draw contains duplicate clubs');
  }
  if (input.ledger.history.some((entry) =>
    entry.editionId === input.editionId)) {
    throw new Error('home fairness edition was already assigned');
  }
};

const creditBefore = (input: ContinentalHomeAssignmentInput,
  clubId: string): number => input.ledger.history.reduce((credit, entry) => {
  if (entry.clubId !== clubId) return credit;
  const age = input.editionOrdinal - entry.editionOrdinal;
  const weight = input.policy.recentEditionWeights[age - 1] ?? 0;
  return credit + weight * (entry.homeSeriesCount === 2 ? -1 : 1);
}, 0);

const assignGroup = (input: ContinentalHomeAssignmentInput,
  groupIndex: number): ContinentalGroupHomeSeries => {
  const ids = input.draw.groups[groupIndex].map((club) => club.teamId);
  const pairs: readonly (readonly [number, number])[] = [
    [0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3],
  ];
  const before = ids.map((clubId) => creditBefore(input, clubId));
  let chosen: Readonly<{ mask: number; counts: number[];
    cost: number; tie: number }> | null = null;
  for (let mask = 0; mask < 64; mask += 1) {
    const counts = [0, 0, 0, 0];
    pairs.forEach(([left, right], index) => {
      counts[(mask & (1 << index)) === 0 ? left : right] += 1;
    });
    if (counts.some((count) => count < 1 || count > 2)) continue;
    const cost = counts.reduce((sum, count, index) =>
      sum + Math.abs(before[index] + (count === 2 ? -1 : 1)), 0);
    const tie = fnv1a32(`${input.draw.drawSeed}:${input.editionId}:${groupIndex}:${mask}`);
    if (chosen === null || cost < chosen.cost
      || (cost === chosen.cost && (tie < chosen.tie
        || (tie === chosen.tie && mask < chosen.mask)))) {
      chosen = { mask, counts, cost, tie };
    }
  }
  if (chosen === null) throw new Error('no legal continental home assignment');
  const assignment = chosen;
  return Object.freeze({ groupIndex, fairnessCost: assignment.cost,
    series: Object.freeze(pairs.map(([left, right], index) => {
      const firstHome = (assignment.mask & (1 << index)) === 0;
      return Object.freeze({
        seriesId: JSON.stringify(['continental-group-series', input.competitionId,
          input.editionId, groupIndex, ids[left], ids[right]]),
        homeClubId: ids[firstHome ? left : right],
        awayClubId: ids[firstHome ? right : left],
        gamesPerSeries: 3 as const,
      });
    })),
    homeSeriesCounts: Object.freeze(ids.map((clubId, index) => {
      const count = assignment.counts[index] as 1 | 2;
      return Object.freeze({ clubId, count, creditBefore: before[index],
        creditAfter: before[index] + (count === 2 ? -1 : 1) });
    })),
  });
};

/** Group-stage hosting only; explicit knockout home rules and venues remain separate. */
export const assignContinentalGroupHomeSeries = (
  input: ContinentalHomeAssignmentInput,
): ContinentalHomeAssignment => {
  validateInput(input);
  const groups = Object.freeze(input.draw.groups.map((_, index) =>
    assignGroup(input, index)));
  const added = groups.flatMap((group) => group.homeSeriesCounts.map((item) =>
    Object.freeze({ editionId: input.editionId,
      editionOrdinal: input.editionOrdinal, clubId: item.clubId,
      homeSeriesCount: item.count, policyVersion: input.policy.version })));
  const homeFairnessPolicy = Object.freeze({ version: input.policy.version,
    recentEditionWeights: Object.freeze([...input.policy.recentEditionWeights]) });
  const historicalPolicies = input.ledger.policies.map((policy) =>
    Object.freeze({ version: policy.version,
      recentEditionWeights: Object.freeze([...policy.recentEditionWeights]) }));
  const historicalEntries = input.ledger.history.map((entry) =>
    Object.freeze({ ...entry }));
  const ledger = Object.freeze({ competitionId: input.competitionId,
    revision: input.ledger.revision + 1,
    policies: Object.freeze(input.ledger.policies.some((policy) =>
      policy.version === input.policy.version)
      ? historicalPolicies : [...historicalPolicies, homeFairnessPolicy]),
    history: Object.freeze([...historicalEntries, ...added]) });
  return Object.freeze({ competitionId: input.competitionId,
    editionId: input.editionId, editionOrdinal: input.editionOrdinal,
    drawPolicyVersion: input.draw.drawPolicyVersion,
    drawSeed: input.draw.drawSeed,
    groupClubIds: Object.freeze(input.draw.groups.map((group) =>
      Object.freeze(group.map((club) => club.teamId)))),
    homeFairnessPolicyVersion: input.policy.version,
    homeFairnessPolicy, groups, ledger });
};
