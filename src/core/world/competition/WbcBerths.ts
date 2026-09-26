import type { ClubWorldRegion } from './ClubWorldBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const FLOORS: Readonly<Record<ClubWorldRegion, number>> = Object.freeze({
  ASIA_PACIFIC: 5, AMERICAS: 5, EUROPE: 4, AFRICA: 2,
});

export type WbcBerthPolicy = Readonly<{
  version: string;
  performanceMethod: 'DIVISOR_WITH_TWO_EXTRA_CAP';
}>;
export type WbcBerthPolicyRegistry = Readonly<{
  policies: readonly WbcBerthPolicy[];
}>;
export const EMPTY_WBC_BERTH_POLICY_REGISTRY: WbcBerthPolicyRegistry =
  Object.freeze({ policies: Object.freeze([]) });
export type WbcRegionalCoefficient = Readonly<{
  region: ClubWorldRegion;
  snapshotId: string;
  policyVersion: string;
  previousWorldEditionIds: readonly string[];
  completedAtDay: number;
  score: number;
  evidenceResultIds: readonly string[];
}>;
export type WbcRegionalPlacement = Readonly<{
  region: ClubWorldRegion;
  editionId: string;
  snapshotId: string;
  completedAtDay: number;
  orderedNationIds: readonly string[];
}>;
export type WbcQualifierPodWinner = Readonly<{
  podIndex: number;
  qualifierEditionId: string;
  nationId: string;
  region: ClubWorldRegion;
  officialFinalApplicationId: string;
  finalizedDay: number;
}>;
export type WbcBerthAuthority = Readonly<{
  editionCutoff: (editionId: string) => Readonly<{
    snapshotId: string; day: number }> | null;
  regionalCoefficient: (region: ClubWorldRegion,
    beforeDay: number) => WbcRegionalCoefficient | null;
  regionalChampionship: (region: ClubWorldRegion,
    beforeDay: number) => WbcRegionalPlacement | null;
  qualifierPodWinner: (podIndex: number,
    beforeDay: number) => WbcQualifierPodWinner | null;
  nationCompetitionRegion: (nationId: string,
    beforeDay: number) => ClubWorldRegion | null;
}>;
export type WbcBerthInput = Readonly<{
  editionId: string;
  cycleId: string;
  previousWorldEditionIds: readonly string[];
  previousRegionalEditionIds: Readonly<Record<ClubWorldRegion, string>>;
  qualifierEditionId: string;
  cutoffSnapshotId: string;
  coefficientPolicyVersion: string;
  policy: WbcBerthPolicy;
  policyRegistry: WbcBerthPolicyRegistry;
}>;
export type WbcBerthSlot = Readonly<{
  index: number;
  route: 'REGIONAL_FLOOR' | 'REGIONAL_PERFORMANCE'
    | 'GLOBAL_QUALIFIER';
  nationId: string;
  region: ClubWorldRegion;
  sourceId: string;
}>;
export type WbcBerthAllocation = Readonly<{
  editionId: string;
  cycleId: string;
  policyVersion: string;
  cutoffSnapshotId: string;
  qualificationSnapshotId: string;
  previousWorldEditionIds: readonly string[];
  directBerthsByRegion: Readonly<Record<ClubWorldRegion, number>>;
  coefficientSources: readonly Readonly<{ region: ClubWorldRegion;
    snapshotId: string; evidenceResultIds: readonly string[] }>[];
  regionalPlacementSources: readonly Readonly<{ region: ClubWorldRegion;
    editionId: string; snapshotId: string }>[];
  entrantNationIds: readonly string[];
  slots: readonly WbcBerthSlot[];
}>;
export type WbcDirectBerths = Readonly<{
  editionId: string;
  qualifierEditionId: string;
  cycleId: string;
  policyVersion: string;
  cutoffSnapshotId: string;
  cutoffDay: number;
  directSnapshotId: string;
  previousWorldEditionIds: readonly string[];
  directBerthsByRegion: Readonly<Record<ClubWorldRegion, number>>;
  coefficientSources: WbcBerthAllocation['coefficientSources'];
  regionalPlacementSources: WbcBerthAllocation['regionalPlacementSources'];
  placements: readonly WbcRegionalPlacement[];
  entrantNationIds: readonly string[];
  slots: readonly WbcBerthSlot[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const sameIds = (actual: unknown, expected: readonly string[]): boolean =>
  Array.isArray(actual) && actual.length === expected.length
  && expected.every((value, index) => actual[index] === value);
const snapshotPolicy = (value: WbcBerthPolicy): WbcBerthPolicy => {
  if (!value || Object.keys(value).sort().join(',')
    !== 'performanceMethod,version' || !id(value.version)
    || value.performanceMethod !== 'DIVISOR_WITH_TWO_EXTRA_CAP') {
    throw new Error('invalid versioned WBC berth policy');
  }
  return Object.freeze({ version: value.version,
    performanceMethod: value.performanceMethod });
};
export const registerWbcBerthPolicy = (
  registry: WbcBerthPolicyRegistry,
  value: WbcBerthPolicy,
): WbcBerthPolicyRegistry => {
  if (!Array.isArray(registry?.policies)) {
    throw new Error('WBC berth policy registry is required');
  }
  const policies = registry.policies.map(snapshotPolicy);
  const policy = snapshotPolicy(value);
  if (new Set(policies.map((item) => item.version)).size
    !== policies.length) {
    throw new Error('duplicate WBC berth policy version');
  }
  const existing = policies.find((item) => item.version === policy.version);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(policy)) {
      throw new Error('WBC berth policy version conflicts with registry');
    }
    return registry;
  }
  return Object.freeze({ policies: Object.freeze([...policies, policy]) });
};

/** Resolves the twenty direct berths before Global Qualifier entrants are drawn. */
export const planWbcDirectBerths = (
  input: WbcBerthInput,
  authority: Omit<WbcBerthAuthority, 'qualifierPodWinner'>,
): WbcDirectBerths => {
  const policy = snapshotPolicy(input?.policy);
  if (!Array.isArray(input.policyRegistry?.policies)) {
    throw new Error('WBC berth policy registry is required');
  }
  const registered = input.policyRegistry?.policies?.find((item) =>
    item.version === policy.version);
  if (!registered || JSON.stringify(snapshotPolicy(registered))
    !== JSON.stringify(policy)) {
    throw new Error('WBC berth policy must match registered version');
  }
  if (!id(input.editionId) || !id(input.cycleId)
    || !Array.isArray(input.previousWorldEditionIds)
    || input.previousWorldEditionIds.length !== 2
    || input.previousWorldEditionIds.some((item) => !id(item))
    || new Set(input.previousWorldEditionIds).size !== 2
    || input.previousWorldEditionIds.includes(input.editionId)
    || !input.previousRegionalEditionIds
    || REGIONS.some((region) =>
      !id(input.previousRegionalEditionIds[region]))
    || new Set(REGIONS.map((region) =>
      input.previousRegionalEditionIds[region])).size !== 4
    || !id(input.qualifierEditionId)
    || input.qualifierEditionId === input.editionId
    || !id(input.cutoffSnapshotId)
    || !id(input.coefficientPolicyVersion)
    || typeof authority?.editionCutoff !== 'function'
    || typeof authority.regionalCoefficient !== 'function'
    || typeof authority.regionalChampionship !== 'function'
    || typeof authority.nationCompetitionRegion !== 'function') {
    throw new Error('invalid official WBC qualification source');
  }
  const cutoff = authority.editionCutoff(input.editionId);
  if (!cutoff || cutoff.snapshotId !== input.cutoffSnapshotId
    || !day(cutoff.day)) {
    throw new Error('WBC qualification cutoff must match its edition');
  }
  const coefficientSnapshots = new Set<string>();
  const placementSnapshots = new Set<string>();
  const allPlacedNations = new Set<string>();
  const coefficients: WbcRegionalCoefficient[] = [];
  const placements: WbcRegionalPlacement[] = [];
  for (const region of REGIONS) {
    const coefficient = authority.regionalCoefficient(region, cutoff.day);
    const placement = authority.regionalChampionship(region, cutoff.day);
    if (!coefficient || coefficient.region !== region
      || !id(coefficient.snapshotId)
      || coefficientSnapshots.has(coefficient.snapshotId)
      || coefficient.policyVersion !== input.coefficientPolicyVersion
      || !sameIds(coefficient.previousWorldEditionIds,
        input.previousWorldEditionIds)
      || !day(coefficient.completedAtDay)
      || coefficient.completedAtDay > cutoff.day
      || !day(coefficient.score)
      || !Array.isArray(coefficient.evidenceResultIds)
      || coefficient.evidenceResultIds.length === 0
      || new Set(coefficient.evidenceResultIds).size
        !== coefficient.evidenceResultIds.length
      || coefficient.evidenceResultIds.some((resultId) =>
        !id(resultId))
      || !placement || placement.region !== region
      || placement.editionId !== input.previousRegionalEditionIds[region]
      || !id(placement.snapshotId)
      || placementSnapshots.has(placement.snapshotId)
      || !day(placement.completedAtDay)
      || placement.completedAtDay > cutoff.day
      || !Array.isArray(placement.orderedNationIds)
      || placement.orderedNationIds.length < FLOORS[region] + 2
      || new Set(placement.orderedNationIds).size
        !== placement.orderedNationIds.length
      || placement.orderedNationIds.some((nationId) =>
        !id(nationId) || allPlacedNations.has(nationId))) {
      throw new Error('WBC regional results require official two-edition evidence');
    }
    coefficientSnapshots.add(coefficient.snapshotId);
    placementSnapshots.add(placement.snapshotId);
    for (const nationId of placement.orderedNationIds) {
      if (authority.nationCompetitionRegion(nationId, cutoff.day)
        !== region) {
        throw new Error('WBC regional placement nation has wrong region');
      }
      allPlacedNations.add(nationId);
    }
    coefficients.push(coefficient);
    placements.push(placement);
  }
  const extras = Object.fromEntries(REGIONS.map((region) =>
    [region, 0])) as Record<ClubWorldRegion, number>;
  for (let remaining = 4; remaining > 0; remaining -= 1) {
    const open = REGIONS.filter((region) => extras[region] < 2);
    open.sort((left, right) => {
      const leftScore = coefficients.find((item) => item.region === left)!.score;
      const rightScore = coefficients.find((item) => item.region === right)!.score;
      const comparison = BigInt(rightScore) * BigInt(extras[left] + 1)
        - BigInt(leftScore) * BigInt(extras[right] + 1);
      return comparison < 0n ? -1 : comparison > 0n ? 1
        : REGIONS.indexOf(left) - REGIONS.indexOf(right);
    });
    extras[open[0]] += 1;
  }
  const directBerthsByRegion = Object.fromEntries(REGIONS.map((region) =>
    [region, FLOORS[region] + extras[region]])) as Record<ClubWorldRegion,
    number>;
  const slots: WbcBerthSlot[] = [];
  const selected = new Set<string>();
  const add = (route: WbcBerthSlot['route'], nationId: string,
    region: ClubWorldRegion, sourceId: string): void => {
    if (selected.has(nationId)) {
      throw new Error('duplicate WBC entrant');
    }
    selected.add(nationId);
    slots.push(Object.freeze({ index: slots.length, route,
      nationId, region, sourceId }));
  };
  for (const region of REGIONS) {
    const placement = placements.find((item) => item.region === region)!;
    placement.orderedNationIds.slice(0, FLOORS[region]).forEach((nationId) =>
      add('REGIONAL_FLOOR', nationId, region, placement.snapshotId));
    placement.orderedNationIds.slice(FLOORS[region],
      directBerthsByRegion[region]).forEach((nationId) =>
      add('REGIONAL_PERFORMANCE', nationId, region,
        placement.snapshotId));
  }
  if (slots.length !== 20 || selected.size !== 20) {
    throw new Error('WBC direct qualification requires twenty nations');
  }
  return Object.freeze({ editionId: input.editionId,
    qualifierEditionId: input.qualifierEditionId,
    cycleId: input.cycleId, policyVersion: policy.version,
    cutoffSnapshotId: cutoff.snapshotId, cutoffDay: cutoff.day,
    directSnapshotId: JSON.stringify(['wbc-direct-berths',
      input.editionId, input.cycleId, policy.version, cutoff.snapshotId,
      ...coefficients.map((item) => item.snapshotId),
      ...placements.map((item) => item.snapshotId),
      ...slots.map((slot) => [slot.route, slot.nationId, slot.sourceId])]),
    previousWorldEditionIds: Object.freeze([...input.previousWorldEditionIds]),
    directBerthsByRegion: Object.freeze(directBerthsByRegion),
    coefficientSources: Object.freeze(coefficients.map((item) =>
      Object.freeze({ region: item.region, snapshotId: item.snapshotId,
        evidenceResultIds: Object.freeze([...item.evidenceResultIds]) }))),
    regionalPlacementSources: Object.freeze(placements.map((item) =>
      Object.freeze({ region: item.region, editionId: item.editionId,
        snapshotId: item.snapshotId }))),
    placements: Object.freeze(placements.map((item) =>
      Object.freeze({ ...item,
        orderedNationIds: Object.freeze([...item.orderedNationIds]) }))),
    entrantNationIds: Object.freeze(slots.map((slot) => slot.nationId)),
    slots: Object.freeze(slots) });
};

/** Adds four official Global Qualifier winners to the direct-berth snapshot. */
export const allocateWbcBerths = (
  input: WbcBerthInput,
  authority: WbcBerthAuthority,
): WbcBerthAllocation => {
  if (typeof authority?.qualifierPodWinner !== 'function') {
    throw new Error('four official Global Qualifier pod winners required');
  }
  const direct = planWbcDirectBerths(input, authority);
  const coefficientEvidence = new Set(direct.coefficientSources.flatMap(
    (item) => item.evidenceResultIds));
  const selected = new Set(direct.entrantNationIds);
  const slots: WbcBerthSlot[] = [...direct.slots];
  const qualifierFinals = new Set<string>();
  for (let podIndex = 0; podIndex < 4; podIndex += 1) {
    const winner = authority.qualifierPodWinner(podIndex,
      direct.cutoffDay);
    if (!winner || winner.podIndex !== podIndex
      || winner.qualifierEditionId !== input.qualifierEditionId
      || !id(winner.nationId) || !REGIONS.includes(winner.region)
      || authority.nationCompetitionRegion(winner.nationId,
        direct.cutoffDay) !== winner.region
      || !id(winner.officialFinalApplicationId)
      || qualifierFinals.has(winner.officialFinalApplicationId)
      || coefficientEvidence.has(winner.officialFinalApplicationId)
      || !day(winner.finalizedDay)
      || winner.finalizedDay > direct.cutoffDay) {
      throw new Error('four official Global Qualifier pod winners required');
    }
    if (selected.has(winner.nationId)) {
      throw new Error('duplicate WBC entrant');
    }
    qualifierFinals.add(winner.officialFinalApplicationId);
    selected.add(winner.nationId);
    slots.push(Object.freeze({ index: slots.length,
      route: 'GLOBAL_QUALIFIER', nationId: winner.nationId,
      region: winner.region,
      sourceId: winner.officialFinalApplicationId }));
  }
  if (slots.length !== 24 || selected.size !== 24) {
    throw new Error('WBC finals require twenty-four unique nations');
  }
  return Object.freeze({ editionId: direct.editionId,
    cycleId: direct.cycleId, policyVersion: direct.policyVersion,
    cutoffSnapshotId: direct.cutoffSnapshotId,
    qualificationSnapshotId: JSON.stringify(['wbc-berths',
      direct.directSnapshotId,
      ...slots.slice(20).map((slot) =>
        [slot.nationId, slot.region, slot.sourceId])]),
    previousWorldEditionIds: direct.previousWorldEditionIds,
    directBerthsByRegion: direct.directBerthsByRegion,
    coefficientSources: direct.coefficientSources,
    regionalPlacementSources: direct.regionalPlacementSources,
    entrantNationIds: Object.freeze(slots.map((slot) => slot.nationId)),
    slots: Object.freeze(slots) });
};
