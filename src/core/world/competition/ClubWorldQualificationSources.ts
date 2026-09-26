import type { ClubWorldBerthAuthority, ClubWorldCoefficient,
  ClubWorldRanking, ClubWorldRegion } from './ClubWorldBerths';

export type ClubWorldAchievementKind = 'TITLE' | 'FINAL_APPEARANCE'
  | 'SEMIFINAL_ADVANCE' | 'KNOCKOUT_ADVANCE' | 'SERIES_WIN'
  | 'GROUP_WIN';
const KINDS: readonly ClubWorldAchievementKind[] = [
  'TITLE', 'FINAL_APPEARANCE', 'SEMIFINAL_ADVANCE',
  'KNOCKOUT_ADVANCE', 'SERIES_WIN', 'GROUP_WIN'];
const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type ClubWorldQualificationPointsPolicy = Readonly<{
  version: string;
  /** In oldest-to-newest season order; values are supplied by the profile. */
  recencyMultipliers: readonly number[];
  eventWeights: Readonly<Record<ClubWorldAchievementKind, number>>;
  regionalTopClubCount: number;
  tieBreak: 'RECENT_THEN_ID';
}>;
export type ClubWorldQualificationPolicyRegistry = Readonly<{
  policies: readonly ClubWorldQualificationPointsPolicy[];
}>;
export const EMPTY_CLUB_WORLD_QUALIFICATION_POLICY_REGISTRY:
ClubWorldQualificationPolicyRegistry = Object.freeze({
  policies: Object.freeze([]),
});
export type OfficialRegionalClubSeason = Readonly<{
  region: ClubWorldRegion;
  seasonId: string;
  editionId: string;
  officialSnapshotId: string;
  completedAtDay: number;
  clubs: readonly Readonly<{
    clubId: string;
    /** Official results include losses, so a zero-win club keeps evidence. */
    resultApplicationIds: readonly string[];
    achievements: readonly Readonly<{
      kind: ClubWorldAchievementKind;
      applicationId: string;
    }>[];
  }>[];
}>;
export type ClubWorldEligibilitySnapshot = Readonly<{
  editionId: string;
  snapshotId: string;
  asOfDay: number;
  regions: readonly Readonly<{ region: ClubWorldRegion;
    eligibleClubIds: readonly string[] }>[];
}>;
/** Implementations must read completed official edition history as of the cutoff. */
export type ClubWorldQualificationSourceAuthority = Readonly<{
  editionHost: ClubWorldBerthAuthority['editionHost'];
  completedRegionalSeason: (region: ClubWorldRegion, seasonId: string,
    beforeDay: number) => OfficialRegionalClubSeason | null;
}>;
export type ClubWorldQualificationSourceInput = Readonly<{
  editionId: string;
  cycleId: string;
  fourYearSeasonIds: readonly string[];
  policy: ClubWorldQualificationPointsPolicy;
  policyRegistry: ClubWorldQualificationPolicyRegistry;
  eligibility: ClubWorldEligibilitySnapshot;
  authority: ClubWorldQualificationSourceAuthority;
}>;
export type ClubWorldQualificationSources = Readonly<{
  editionId: string;
  cycleId: string;
  policyVersion: string;
  eligibilitySnapshotId: string;
  coefficients: readonly ClubWorldCoefficient[];
  rankings: readonly ClubWorldRanking[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const scoreNumber = (value: bigint): number => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Club World qualification score exceeds safe range');
  }
  return Number(value);
};
const exactFields = (value: unknown, fields: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === fields.length
  && Object.keys(value).every((field) => fields.includes(field));
const snapshotPolicy = (
  value: ClubWorldQualificationPointsPolicy,
): ClubWorldQualificationPointsPolicy => {
  if (!exactFields(value, ['version', 'recencyMultipliers',
    'eventWeights', 'regionalTopClubCount', 'tieBreak'])
    || !id(value.version)
    || !Array.isArray(value.recencyMultipliers)
    || value.recencyMultipliers.length !== 4
    || value.recencyMultipliers.some((number) => !nonnegative(number))
    || !value.recencyMultipliers.some((number) => number > 0)
    || !exactFields(value.eventWeights, KINDS)
    || KINDS.some((kind) => !nonnegative(value.eventWeights[kind]))
    || !KINDS.some((kind) => value.eventWeights[kind] > 0)
    || !Number.isSafeInteger(value.regionalTopClubCount)
    || value.regionalTopClubCount < 1
    || value.regionalTopClubCount > 16
    || value.tieBreak !== 'RECENT_THEN_ID') {
    throw new Error('invalid versioned Club World points policy');
  }
  return Object.freeze({ version: value.version,
    recencyMultipliers: Object.freeze([...value.recencyMultipliers]),
    eventWeights: Object.freeze(Object.fromEntries(KINDS.map((kind) =>
      [kind, value.eventWeights[kind]])) as Record<ClubWorldAchievementKind,
      number>),
    regionalTopClubCount: value.regionalTopClubCount,
    tieBreak: value.tieBreak });
};
export const registerClubWorldQualificationPolicy = (
  registry: ClubWorldQualificationPolicyRegistry,
  value: ClubWorldQualificationPointsPolicy,
): ClubWorldQualificationPolicyRegistry => {
  if (!Array.isArray(registry?.policies)) {
    throw new Error('Club World points policy registry is required');
  }
  const policies = registry.policies.map(snapshotPolicy);
  if (new Set(policies.map((item) => item.version)).size
    !== policies.length) {
    throw new Error('duplicate Club World points policy version');
  }
  const snapshot = snapshotPolicy(value);
  const existing = policies.find((item) => item.version === snapshot.version);
  if (existing) {
    if (JSON.stringify(existing) !== JSON.stringify(snapshot)) {
      throw new Error('Club World points policy version conflicts with registry');
    }
    return registry;
  }
  return Object.freeze({ policies: Object.freeze([...policies, snapshot]) });
};
const requirePolicy = (registry: ClubWorldQualificationPolicyRegistry,
  value: ClubWorldQualificationPointsPolicy,
): ClubWorldQualificationPointsPolicy => {
  const snapshot = snapshotPolicy(value);
  if (!Array.isArray(registry?.policies)) {
    throw new Error('Club World points policy registry is required');
  }
  const registered = registry?.policies?.find((item) =>
    item.version === snapshot.version);
  if (!registered
    || JSON.stringify(snapshotPolicy(registered)) !== JSON.stringify(snapshot)) {
    throw new Error('Club World points policy must match registered version');
  }
  return snapshot;
};

/**
 * Converts official four-season performance into the two upstream snapshots
 * consumed by allocateClubWorldBerths. No domestic table or raw ability enters.
 */
export const buildClubWorldQualificationSources = (
  input: ClubWorldQualificationSourceInput,
): ClubWorldQualificationSources => {
  const policy = requirePolicy(input?.policyRegistry, input?.policy);
  const seasons = input?.fourYearSeasonIds;
  const eligibility = input?.eligibility;
  const weights = policy.eventWeights;
  if (!id(input?.editionId) || !id(input.cycleId)
    || !Array.isArray(seasons) || seasons.length !== 4
    || seasons.some((season) => !id(season))
    || new Set(seasons).size !== 4
    || !exactFields(eligibility, ['editionId', 'snapshotId',
      'asOfDay', 'regions'])
    || eligibility?.editionId !== input.editionId
    || !id(eligibility.snapshotId)
    || !nonnegative(eligibility.asOfDay)
    || !Array.isArray(eligibility.regions)
    || eligibility.regions.length !== 4
    || new Set(eligibility.regions.map((item) => item.region)).size !== 4
    || REGIONS.some((region) => !eligibility.regions.some((item) =>
      item.region === region))
    || typeof input.authority?.editionHost !== 'function'
    || typeof input.authority.completedRegionalSeason !== 'function') {
    throw new Error('invalid versioned Club World qualification source');
  }
  const officialHost = input.authority.editionHost(input.editionId);
  if (!officialHost || !id(officialHost.snapshotId)
    || !nonnegative(officialHost.qualificationCutoffDay)
    || eligibility.asOfDay !== officialHost.qualificationCutoffDay) {
    throw new Error('Club World eligibility must match official cutoff');
  }
  const clubRegions = new Map<string, ClubWorldRegion>();
  const applicationSources = new Map<string, string>();
  const editionIds = new Set<string>();
  const snapshotIds = new Set<string>();
  const coefficients: ClubWorldCoefficient[] = [];
  const rankings: ClubWorldRanking[] = [];
  for (const region of REGIONS) {
    const eligibleSource = eligibility.regions.find((item) =>
      item.region === region)!;
    const eligibleClubIds: readonly string[] = eligibleSource.eligibleClubIds;
    if (!exactFields(eligibleSource, ['region', 'eligibleClubIds'])
      || !Array.isArray(eligibleSource.eligibleClubIds)
      || eligibleSource.eligibleClubIds.some((clubId: string) => !id(clubId))
      || new Set(eligibleSource.eligibleClubIds).size
        !== eligibleSource.eligibleClubIds.length) {
      throw new Error('invalid Club World regional eligibility');
    }
    const scores = new Map<string, bigint>();
    const newestScores = new Map<string, bigint>();
    const evidenceByClub = new Map<string, Set<string>>();
    const regionEvidence = new Set<string>();
    const regionSnapshotIds: string[] = [];
    seasons.forEach((seasonId, seasonIndex) => {
      const season = input.authority.completedRegionalSeason(region,
        seasonId, officialHost.qualificationCutoffDay);
      if (!season || !exactFields(season, ['region', 'seasonId',
        'editionId', 'officialSnapshotId', 'completedAtDay', 'clubs'])
        || season.region !== region
        || season.seasonId !== seasonId || !id(season.editionId)
        || editionIds.has(season.editionId)
        || !id(season.officialSnapshotId)
        || snapshotIds.has(season.officialSnapshotId)
        || !nonnegative(season.completedAtDay)
        || season.completedAtDay > officialHost.qualificationCutoffDay
        || !Array.isArray(season.clubs) || season.clubs.length === 0
        || new Set(season.clubs.map((club: OfficialRegionalClubSeason['clubs'][number]) =>
          club.clubId)).size
          !== season.clubs.length) {
        throw new Error('official regional season is missing or after cutoff');
      }
      editionIds.add(season.editionId);
      snapshotIds.add(season.officialSnapshotId);
      regionSnapshotIds.push(season.officialSnapshotId);
      const applicationClubCounts = new Map<string, number>();
      const clubResults: OfficialRegionalClubSeason['clubs'] = season.clubs;
      for (const club of clubResults) {
        if (!exactFields(club, ['clubId', 'resultApplicationIds',
          'achievements'])
          || !id(club.clubId)
          || (clubRegions.has(club.clubId)
            && clubRegions.get(club.clubId) !== region)
          || !Array.isArray(club.resultApplicationIds)
          || club.resultApplicationIds.length === 0
          || club.resultApplicationIds.some((applicationId: string) =>
            !id(applicationId))
          || new Set(club.resultApplicationIds).size
            !== club.resultApplicationIds.length
          || !Array.isArray(club.achievements)) {
          throw new Error('official club performance requires result applications');
        }
        clubRegions.set(club.clubId, region);
        const resultIds = new Set(club.resultApplicationIds);
        for (const applicationId of resultIds) {
          const previous = applicationSources.get(applicationId);
          if (previous && previous !== season.editionId) {
            throw new Error('official result application crosses regional editions');
          }
          applicationSources.set(applicationId, season.editionId);
          regionEvidence.add(applicationId);
          const count = (applicationClubCounts.get(applicationId) ?? 0) + 1;
          if (count > 2) {
            throw new Error('official application cannot represent three clubs');
          }
          applicationClubCounts.set(applicationId, count);
        }
        const seenAchievements = new Set<string>();
        let seasonScore = 0n;
        const achievements: OfficialRegionalClubSeason['clubs'][number]['achievements'] =
          club.achievements;
        for (const event of achievements) {
          const key = JSON.stringify([event?.kind, event?.applicationId]);
          if (!exactFields(event, ['kind', 'applicationId'])
            || !KINDS.includes(event?.kind)
            || !resultIds.has(event.applicationId)
            || seenAchievements.has(key)) {
            throw new Error('achievement requires its official application');
          }
          seenAchievements.add(key);
          seasonScore += BigInt(weights[event.kind]);
        }
        const weighted = seasonScore
          * BigInt(policy.recencyMultipliers[seasonIndex]);
        scores.set(club.clubId, (scores.get(club.clubId) ?? 0n)
          + weighted);
        if (seasonIndex === 3) newestScores.set(club.clubId, weighted);
        const evidence = evidenceByClub.get(club.clubId) ?? new Set<string>();
        resultIds.forEach((applicationId) => evidence.add(applicationId));
        evidenceByClub.set(club.clubId, evidence);
      }
    });
    if (eligibleClubIds.some((clubId) =>
      !scores.has(clubId))) {
      throw new Error('eligible club lacks regional official performance');
    }
    const ordered = [...scores.keys()].sort((left, right) => {
      const total = scores.get(right)! - scores.get(left)!;
      if (total !== 0n) return total > 0n ? 1 : -1;
      const recent = (newestScores.get(right) ?? 0n)
        - (newestScores.get(left) ?? 0n);
      if (recent !== 0n) return recent > 0n ? 1 : -1;
      return left < right ? -1 : left > right ? 1 : 0;
    });
    const regionalScore = ordered.slice(0,
      policy.regionalTopClubCount).reduce((sum, clubId) =>
      sum + scores.get(clubId)!, 0n);
    const coefficientSnapshotId = JSON.stringify([
      'club-world-coefficient', input.editionId, input.cycleId, region,
      policy.version, ...regionSnapshotIds]);
    const rankingSnapshotId = JSON.stringify([
      'club-world-ranking', input.editionId, input.cycleId, region,
      policy.version, eligibility.snapshotId, ...regionSnapshotIds]);
    coefficients.push(Object.freeze({ region, cycleId: input.cycleId,
      coefficientSnapshotId, coefficientPolicyVersion: policy.version,
      score: scoreNumber(regionalScore),
      fourYearSeasonIds: Object.freeze([...seasons]),
      evidenceResultIds: Object.freeze([...regionEvidence].sort()) }));
    rankings.push(Object.freeze({ region, cycleId: input.cycleId,
      rankingSnapshotId, rankingPolicyVersion: policy.version,
      fourYearSeasonIds: Object.freeze([...seasons]),
      orderedCandidates: Object.freeze(ordered.map((clubId) =>
        Object.freeze({ clubId,
          eligible: eligibleClubIds.includes(clubId),
          evidenceResultIds: Object.freeze([
            ...evidenceByClub.get(clubId)!].sort()) }))) }));
  }
  return Object.freeze({ editionId: input.editionId,
    cycleId: input.cycleId, policyVersion: policy.version,
    eligibilitySnapshotId: eligibility.snapshotId,
    coefficients: Object.freeze(coefficients),
    rankings: Object.freeze(rankings) });
};
