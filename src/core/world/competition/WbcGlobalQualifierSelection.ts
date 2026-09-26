import type { ClubWorldRegion } from './ClubWorldBerths';
import type { PremierTwelveRanking } from './PremierTwelve';
import type { WbcDirectBerths } from './WbcBerths';

const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const day = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export type WbcQualifierSelectionPolicy = Readonly<{
  version: string;
  regionalPriorityPerRegion: number;
  rankingPolicyVersion: string;
}>;
export type WbcQualifierSelectionPolicyRegistry = Readonly<{
  policies: readonly WbcQualifierSelectionPolicy[];
}>;
export const EMPTY_WBC_QUALIFIER_SELECTION_POLICY_REGISTRY:
WbcQualifierSelectionPolicyRegistry = Object.freeze({
  policies: Object.freeze([]),
});
export type WbcQualifierEligibility = Readonly<{
  snapshotId: string;
  asOfDay: number;
  eligibleNationIds: readonly string[];
}>;
export type WbcQualifierSelection = Readonly<{
  qualifierEditionId: string;
  directSnapshotId: string;
  rankingSnapshotId: string;
  eligibilitySnapshotId: string;
  policyVersion: string;
  qualificationSnapshotId: string;
  entrants: readonly Readonly<{ nationId: string;
    region: ClubWorldRegion;
    route: 'REGIONAL_PRIORITY' | 'WORLD_RANKING'
      | 'REGIONAL_CASCADE';
    sourceId: string }>[];
}>;

const snapshotPolicy = (policy: WbcQualifierSelectionPolicy):
WbcQualifierSelectionPolicy => {
  if (!id(policy?.version)
    || !Number.isSafeInteger(policy.regionalPriorityPerRegion)
    || policy.regionalPriorityPerRegion < 1
    || policy.regionalPriorityPerRegion > 3
    || !id(policy.rankingPolicyVersion)) {
    throw new Error('invalid versioned WBC qualifier selection policy');
  }
  return Object.freeze({ version: policy.version,
    regionalPriorityPerRegion: policy.regionalPriorityPerRegion,
    rankingPolicyVersion: policy.rankingPolicyVersion });
};
export const registerWbcQualifierSelectionPolicy = (
  registry: WbcQualifierSelectionPolicyRegistry,
  policy: WbcQualifierSelectionPolicy,
): WbcQualifierSelectionPolicyRegistry => {
  if (!Array.isArray(registry?.policies)) {
    throw new Error('WBC qualifier selection registry required');
  }
  const registered = registry.policies.map(snapshotPolicy);
  if (new Set(registered.map((item) => item.version)).size
    !== registered.length) {
    throw new Error('duplicate WBC qualifier selection policy');
  }
  const snapshot = snapshotPolicy(policy);
  const existing = registered.find((item) =>
    item.version === snapshot.version);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(snapshot)) {
      throw new Error('WBC qualifier selection policy version conflict');
    }
    return registry;
  }
  return Object.freeze({ policies: Object.freeze([...registered,
    snapshot]) });
};

/** Selects sixteen eligible non-direct nations before the four pods are drawn. */
export const selectWbcGlobalQualifierEntrants = (
  qualifierEditionId: string,
  direct: WbcDirectBerths,
  ranking: PremierTwelveRanking,
  eligibility: WbcQualifierEligibility,
  requestedPolicy: WbcQualifierSelectionPolicy,
  registry: WbcQualifierSelectionPolicyRegistry,
  nationCompetitionRegion: (nationId: string,
    beforeDay: number) => ClubWorldRegion | null,
): WbcQualifierSelection => {
  const policy = snapshotPolicy(requestedPolicy);
  const registered = registry?.policies?.find((item) =>
    item.version === policy.version);
  if (!registered
    || JSON.stringify(snapshotPolicy(registered))
      !== JSON.stringify(policy)) {
    throw new Error('WBC qualifier selection policy must be registered');
  }
  if (!id(qualifierEditionId)
    || qualifierEditionId !== direct?.qualifierEditionId
    || !id(direct?.directSnapshotId)
    || !id(direct.cutoffSnapshotId)
    || !day(direct.cutoffDay)
    || !Array.isArray(direct.entrantNationIds)
    || direct.entrantNationIds.length !== 20
    || new Set(direct.entrantNationIds).size !== 20
    || !Array.isArray(direct.placements)
    || direct.placements.length !== 4
    || !id(ranking?.snapshotId)
    || ranking.policyVersion !== policy.rankingPolicyVersion
    || !day(ranking.asOfDay)
    || ranking.asOfDay > direct.cutoffDay
    || !Array.isArray(ranking.orderedNationIds)
    || new Set(ranking.orderedNationIds).size
      !== ranking.orderedNationIds.length
    || ranking.orderedNationIds.some((nationId) => !id(nationId))
    || !Array.isArray(ranking.evidenceResultIds)
    || ranking.evidenceResultIds.length === 0
    || new Set(ranking.evidenceResultIds).size
      !== ranking.evidenceResultIds.length
    || ranking.evidenceResultIds.some((resultId) => !id(resultId))
    || !id(eligibility?.snapshotId)
    || !day(eligibility.asOfDay)
    || eligibility.asOfDay > direct.cutoffDay
    || !Array.isArray(eligibility.eligibleNationIds)
    || new Set(eligibility.eligibleNationIds).size
      !== eligibility.eligibleNationIds.length
    || eligibility.eligibleNationIds.some((nationId) => !id(nationId))
    || typeof nationCompetitionRegion !== 'function') {
    throw new Error('invalid WBC qualifier cutoff sources');
  }
  const eligible = new Set(eligibility.eligibleNationIds);
  const directNations = new Set(direct.entrantNationIds);
  const selected = new Set<string>();
  const entrants: WbcQualifierSelection['entrants'][number][] = [];
  const regionByNation = new Map<string, ClubWorldRegion>();
  const lowerRegional = new Map<ClubWorldRegion, readonly string[]>();
  for (const region of REGIONS) {
    const placement = direct.placements.find((item) =>
      item.region === region);
    const directCount = direct.directBerthsByRegion[region];
    if (!placement || !id(placement.snapshotId)
      || !Number.isSafeInteger(directCount)
      || directCount < 1
      || !Array.isArray(placement.orderedNationIds)) {
      throw new Error('WBC qualifier needs official regional placements');
    }
    const orderedNationIds: readonly string[] =
      placement.orderedNationIds;
    if (new Set(orderedNationIds).size
      !== orderedNationIds.length
      || orderedNationIds.slice(0, directCount)
        .some((nationId) => !directNations.has(nationId))) {
      throw new Error('WBC qualifier needs official regional placements');
    }
    const lower = orderedNationIds.slice(directCount)
      .filter((nationId) => eligible.has(nationId));
    if (lower.length < policy.regionalPriorityPerRegion
      || lower.some((nationId) => nationCompetitionRegion(
        nationId, direct.cutoffDay) !== region)
      || lower.some((nationId) => regionByNation.has(nationId))) {
      throw new Error('WBC qualifier regional minimum unavailable');
    }
    lower.forEach((nationId) => regionByNation.set(nationId,
      region));
    lowerRegional.set(region, lower);
  }
  const add = (nationId: string, region: ClubWorldRegion,
    route: WbcQualifierSelection['entrants'][number]['route'],
    sourceId: string): void => {
    if (directNations.has(nationId) || selected.has(nationId)) return;
    selected.add(nationId);
    entrants.push(Object.freeze({ nationId, region, route, sourceId }));
  };
  for (const region of REGIONS) {
    lowerRegional.get(region)!.slice(0,
      policy.regionalPriorityPerRegion).forEach((nationId) =>
      add(nationId, region, 'REGIONAL_PRIORITY',
        direct.placements.find((item) =>
          item.region === region)!.snapshotId));
  }
  for (const nationId of ranking.orderedNationIds) {
    if (entrants.length === 16) break;
    if (!eligible.has(nationId) || directNations.has(nationId)) {
      continue;
    }
    const region = nationCompetitionRegion(nationId,
      direct.cutoffDay);
    if (!region || !REGIONS.includes(region)
      || (regionByNation.has(nationId)
        && regionByNation.get(nationId) !== region)) {
      throw new Error('WBC ranking nation has wrong region');
    }
    add(nationId, region, 'WORLD_RANKING', ranking.snapshotId);
  }
  for (const region of REGIONS) {
    for (const nationId of lowerRegional.get(region)!) {
      if (entrants.length === 16) break;
      add(nationId, region, 'REGIONAL_CASCADE',
        direct.placements.find((item) =>
          item.region === region)!.snapshotId);
    }
  }
  if (entrants.length !== 16
    || REGIONS.some((region) => !entrants.some((item) =>
      item.region === region))) {
    throw new Error('WBC qualifier requires sixteen regional nations');
  }
  return Object.freeze({ qualifierEditionId,
    directSnapshotId: direct.directSnapshotId,
    rankingSnapshotId: ranking.snapshotId,
    eligibilitySnapshotId: eligibility.snapshotId,
    policyVersion: policy.version,
    qualificationSnapshotId: JSON.stringify(['wbc-qualifier-selection',
      qualifierEditionId, direct.directSnapshotId,
      ranking.snapshotId, eligibility.snapshotId, policy.version,
      ...entrants.map((item) => [item.nationId,
        item.route, item.sourceId])]),
    entrants: Object.freeze(entrants) });
};
