export type ClubWorldRegion =
  | 'ASIA_PACIFIC' | 'AMERICAS' | 'EUROPE' | 'AFRICA';
const REGIONS: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
export type ClubWorldCoefficient = Readonly<{
  region: ClubWorldRegion;
  cycleId: string;
  coefficientSnapshotId: string;
  coefficientPolicyVersion: string;
  score: number;
  fourYearSeasonIds: readonly string[];
  evidenceResultIds: readonly string[];
}>;
export type ClubWorldRanking = Readonly<{
  region: ClubWorldRegion;
  cycleId: string;
  rankingSnapshotId: string;
  rankingPolicyVersion: string;
  fourYearSeasonIds: readonly string[];
  orderedCandidates: readonly Readonly<{
    clubId: string;
    eligible: boolean;
    evidenceResultIds: readonly string[];
  }>[];
}>;
export type ClubWorldBerthInput = Readonly<{
  editionId: string;
  policyVersion: 'club-world-qualification-v1';
  cycleId: string;
  coefficientPolicyVersion: string;
  rankingPolicyVersion: string;
  fourYearSeasonIds: readonly string[];
  previousRegionalEditionIds: Readonly<Record<ClubWorldRegion, string>>;
  previousWorldEditionId: string;
  hostRegion: ClubWorldRegion;
  hostSnapshot: Readonly<{ editionId: string; snapshotId: string;
    region: ClubWorldRegion }>;
  coefficients: readonly ClubWorldCoefficient[];
  regionalChampions: readonly Readonly<{
    region: ClubWorldRegion; clubId: string; officialTitleId: string;
    titleCompetitionId: string; titleEditionId: string;
  }>[];
  defendingWorldChampion: Readonly<{
    region: ClubWorldRegion; clubId: string; officialTitleId: string;
    titleCompetitionId: 'CLUB_WORLD'; titleEditionId: string;
  }>;
  rankings: readonly ClubWorldRanking[];
}>;
/** Read from completed official edition history and the pinned host edition. */
export type ClubWorldBerthAuthority = Readonly<{
  latestRegionalChampion: (region: ClubWorldRegion,
    beforeDay: number) => Readonly<{
    editionId: string; clubId: string; officialTitleId: string;
    titleFinalizedDay: number;
  }> | null;
  defendingWorldChampion: (beforeDay: number) => Readonly<{
    editionId: string; clubId: string; officialTitleId: string;
    region: ClubWorldRegion; titleFinalizedDay: number;
  }> | null;
  editionHost: (editionId: string) => Readonly<{
    snapshotId: string; region: ClubWorldRegion;
    qualificationCutoffDay: number;
  }> | null;
}>;
export type ClubWorldBerthSlot = Readonly<{
  berthIndex: number;
  route: 'REGIONAL_CHAMPION' | 'DEFENDING_WORLD_CHAMPION'
    | 'DUPLICATE_AUTOMATIC_CASCADE' | 'HOST_REGION'
    | 'REGIONAL_PERFORMANCE';
  region: ClubWorldRegion;
  clubId: string;
  originalClubId: string | null;
  sourceId: string;
  skippedClubIds: readonly string[];
}>;
export type ClubWorldBerthAllocation = Readonly<{
  editionId: string;
  policyVersion: ClubWorldBerthInput['policyVersion'];
  cycleId: string;
  fourYearSeasonIds: readonly string[];
  hostSnapshotId: string;
  coefficientSources: readonly Readonly<{ region: ClubWorldRegion;
    snapshotId: string; policyVersion: string;
    evidenceResultIds: readonly string[] }>[];
  rankingSources: readonly Readonly<{ region: ClubWorldRegion;
    snapshotId: string; policyVersion: string }>[];
  performanceBerthsByRegion: Readonly<Record<ClubWorldRegion, number>>;
  entrantClubIds: readonly string[];
  slots: readonly ClubWorldBerthSlot[];
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const exactRegions = (values: readonly ClubWorldRegion[]): boolean =>
  values.length === 4 && new Set(values).size === 4
  && REGIONS.every((region) => values.includes(region));
const sameSeasons = (value: unknown, expected: readonly string[]): boolean =>
  Array.isArray(value) && value.length === expected.length
  && expected.every((season, index) => value[index] === season);

/**
 * Consumes versioned upstream coefficient and ranking snapshots. It never
 * computes coefficients from domestic league table positions.
 */
export const allocateClubWorldBerths = (
  input: ClubWorldBerthInput,
  authority: ClubWorldBerthAuthority,
): ClubWorldBerthAllocation => {
  if (!id(input?.editionId)
    || input.policyVersion !== 'club-world-qualification-v1'
    || !id(input.cycleId)
    || !id(input.coefficientPolicyVersion)
    || !id(input.rankingPolicyVersion)
    || !Array.isArray(input.fourYearSeasonIds)
    || input.fourYearSeasonIds.length !== 4
    || new Set(input.fourYearSeasonIds).size !== 4
    || input.fourYearSeasonIds.some((seasonId) => !id(seasonId))
    || !input.previousRegionalEditionIds
    || REGIONS.some((region) => !id(input.previousRegionalEditionIds[region])
      || input.previousRegionalEditionIds[region] === input.editionId)
    || !id(input.previousWorldEditionId)
    || input.previousWorldEditionId === input.editionId
    || input.hostSnapshot?.editionId !== input.editionId
    || !id(input.hostSnapshot.snapshotId)
    || input.hostSnapshot.region !== input.hostRegion
    || !REGIONS.includes(input.hostRegion)
    || !Array.isArray(input.coefficients)
    || !Array.isArray(input.regionalChampions)
    || !Array.isArray(input.rankings)
    || !exactRegions(input.coefficients.map((item) => item.region))
    || !exactRegions(input.regionalChampions.map((item) => item.region))
    || !exactRegions(input.rankings.map((item) => item.region))) {
    throw new Error('invalid versioned Club World regional sources');
  }
  if (typeof authority?.latestRegionalChampion !== 'function'
    || typeof authority.defendingWorldChampion !== 'function'
    || typeof authority.editionHost !== 'function') {
    throw new Error('official Club World edition authority is required');
  }
  const officialHost = authority.editionHost(input.editionId);
  if (!officialHost || officialHost.snapshotId !== input.hostSnapshot.snapshotId
    || officialHost.region !== input.hostRegion
    || !Number.isSafeInteger(officialHost.qualificationCutoffDay)
    || officialHost.qualificationCutoffDay < 0) {
    throw new Error('host berth must match official edition host');
  }
  const coefficientByRegion = new Map(input.coefficients.map((item) =>
    [item.region, item]));
  const rankingByRegion = new Map(input.rankings.map((item) =>
    [item.region, item]));
  const championByRegion = new Map(input.regionalChampions.map((item) =>
    [item.region, item]));
  const evidence = new Set<string>();
  const coefficientSnapshotIds = new Set<string>();
  for (const coefficient of input.coefficients) {
    if (!Number.isSafeInteger(coefficient.score) || coefficient.score < 0
      || coefficient.cycleId !== input.cycleId
      || !id(coefficient.coefficientSnapshotId)
      || coefficientSnapshotIds.has(coefficient.coefficientSnapshotId)
      || coefficient.coefficientPolicyVersion !== input.coefficientPolicyVersion
      || !Array.isArray(coefficient.fourYearSeasonIds)
      || coefficient.fourYearSeasonIds.length !== 4
      || new Set(coefficient.fourYearSeasonIds).size !== 4
      || coefficient.fourYearSeasonIds.some((seasonId: string) =>
        !id(seasonId))
      || !sameSeasons(coefficient.fourYearSeasonIds,
        input.fourYearSeasonIds)
      || !Array.isArray(coefficient.evidenceResultIds)
      || coefficient.evidenceResultIds.length === 0
      || coefficient.evidenceResultIds.some((resultId: string) =>
        !id(resultId) || evidence.has(resultId))) {
      throw new Error('regional performance coefficient requires four-year official evidence');
    }
    coefficient.evidenceResultIds.forEach((resultId: string) =>
      evidence.add(resultId));
    coefficientSnapshotIds.add(coefficient.coefficientSnapshotId);
  }
  const allRankedClubs = new Set<string>();
  const rankingSnapshotIds = new Set<string>();
  for (const ranking of input.rankings) {
    if (!id(ranking.rankingSnapshotId)
      || rankingSnapshotIds.has(ranking.rankingSnapshotId)
      || ranking.cycleId !== input.cycleId
      || ranking.rankingPolicyVersion !== input.rankingPolicyVersion
      || !sameSeasons(ranking.fourYearSeasonIds,
        input.fourYearSeasonIds)
      || !Array.isArray(ranking.orderedCandidates)
      || ranking.orderedCandidates.length === 0) {
      throw new Error('invalid regional Club World qualification ranking');
    }
    for (const candidate of ranking.orderedCandidates) {
      if (!id(candidate.clubId) || allRankedClubs.has(candidate.clubId)
        || typeof candidate.eligible !== 'boolean'
        || !Array.isArray(candidate.evidenceResultIds)
        || candidate.evidenceResultIds.length === 0
        || candidate.evidenceResultIds.some((resultId: string) =>
          !id(resultId))) {
        throw new Error('ranking candidates require unique clubs and result evidence');
      }
      allRankedClubs.add(candidate.clubId);
    }
    rankingSnapshotIds.add(ranking.rankingSnapshotId);
  }
  const championIds = new Set<string>();
  const titleIds = new Set<string>();
  for (const champion of input.regionalChampions) {
    const official = authority.latestRegionalChampion(champion.region,
      officialHost.qualificationCutoffDay);
    if (!id(champion.clubId) || !id(champion.officialTitleId)
      || !official || official.editionId !== champion.titleEditionId
      || !Number.isSafeInteger(official.titleFinalizedDay)
      || official.titleFinalizedDay < 0
      || official.titleFinalizedDay > officialHost.qualificationCutoffDay
      || official.clubId !== champion.clubId
      || official.officialTitleId !== champion.officialTitleId
      || champion.titleCompetitionId !== `REGIONAL_CL_${champion.region}`
      || champion.titleEditionId
        !== input.previousRegionalEditionIds[champion.region as ClubWorldRegion]
      || championIds.has(champion.clubId)
      || titleIds.has(champion.officialTitleId)
      || input.rankings.some((ranking) =>
        ranking.region !== champion.region
        && ranking.orderedCandidates.some((candidate: { clubId: string }) =>
          candidate.clubId === champion.clubId))) {
      throw new Error('four regional champions require unique official titles');
    }
    championIds.add(champion.clubId);
    titleIds.add(champion.officialTitleId);
  }
  const defender = input.defendingWorldChampion;
  const officialDefender = authority.defendingWorldChampion(
    officialHost.qualificationCutoffDay);
  if (!REGIONS.includes(defender?.region)
    || !officialDefender
    || !Number.isSafeInteger(officialDefender.titleFinalizedDay)
    || officialDefender.titleFinalizedDay < 0
    || officialDefender.titleFinalizedDay
      > officialHost.qualificationCutoffDay
    || officialDefender.editionId !== defender.titleEditionId
    || officialDefender.clubId !== defender.clubId
    || officialDefender.officialTitleId !== defender.officialTitleId
    || officialDefender.region !== defender.region
    || !id(defender.clubId) || !id(defender.officialTitleId)
    || defender.titleCompetitionId !== 'CLUB_WORLD'
    || defender.titleEditionId !== input.previousWorldEditionId
    || titleIds.has(defender.officialTitleId)
    || (championIds.has(defender.clubId)
      && championByRegion.get(defender.region)?.clubId !== defender.clubId)
    || input.rankings.some((ranking) =>
      ranking.region !== defender.region
      && ranking.orderedCandidates.some((candidate: { clubId: string }) =>
        candidate.clubId === defender.clubId))) {
    throw new Error('defending Club World title must be official');
  }
  const performanceBerthsByRegion = Object.fromEntries(REGIONS.map(
    (region) => [region, 1])) as Record<ClubWorldRegion, number>;
  for (let remaining = 6; remaining > 0; remaining -= 1) {
    const open = REGIONS.filter((region) =>
      performanceBerthsByRegion[region] < 4);
    open.sort((left, right) => {
      const leftScore = coefficientByRegion.get(left)!.score;
      const rightScore = coefficientByRegion.get(right)!.score;
      const leftDivisor = performanceBerthsByRegion[left] + 1;
      const rightDivisor = performanceBerthsByRegion[right] + 1;
      const comparison = BigInt(rightScore) * BigInt(leftDivisor)
        - BigInt(leftScore) * BigInt(rightDivisor);
      return comparison < 0n ? -1 : comparison > 0n ? 1
        : REGIONS.indexOf(left) - REGIONS.indexOf(right);
    });
    performanceBerthsByRegion[open[0]] += 1;
  }
  const selected = new Set<string>();
  const slots: ClubWorldBerthSlot[] = [];
  const add = (route: ClubWorldBerthSlot['route'],
    region: ClubWorldRegion, clubId: string, sourceId: string,
    originalClubId: string | null = null,
    skippedClubIds: readonly string[] = []): void => {
    if (selected.has(clubId)) throw new Error('duplicate Club World entrant');
    selected.add(clubId);
    slots.push(Object.freeze({ berthIndex: slots.length,
      route, region, clubId, originalClubId, sourceId,
      skippedClubIds: Object.freeze([...skippedClubIds]) }));
  };
  const next = (region: ClubWorldRegion): Readonly<{
    clubId: string; skippedClubIds: readonly string[] }> => {
    const ranking = rankingByRegion.get(region)!;
    const skipped: string[] = [];
    for (const candidate of ranking.orderedCandidates) {
      if (selected.has(candidate.clubId) || !candidate.eligible) {
        skipped.push(candidate.clubId);
        continue;
      }
      return Object.freeze({ clubId: candidate.clubId,
        skippedClubIds: Object.freeze(skipped) });
    }
    throw new Error('not enough eligible regional candidates for Club World berths');
  };
  for (const region of REGIONS) {
    const champion = championByRegion.get(region)!;
    add('REGIONAL_CHAMPION', region,
      champion.clubId, champion.officialTitleId);
  }
  if (selected.has(defender.clubId)) {
    const cascade = next(defender.region);
    add('DUPLICATE_AUTOMATIC_CASCADE', defender.region,
      cascade.clubId, rankingByRegion.get(defender.region)!.rankingSnapshotId,
      defender.clubId, cascade.skippedClubIds);
  } else {
    add('DEFENDING_WORLD_CHAMPION', defender.region,
      defender.clubId, defender.officialTitleId);
  }
  const host = next(input.hostRegion);
  add('HOST_REGION', input.hostRegion,
    host.clubId, rankingByRegion.get(input.hostRegion)!.rankingSnapshotId,
    null, host.skippedClubIds);
  for (const region of REGIONS) {
    for (let index = 0; index < performanceBerthsByRegion[region];
      index += 1) {
      const candidate = next(region);
      add('REGIONAL_PERFORMANCE', region, candidate.clubId,
        rankingByRegion.get(region)!.rankingSnapshotId,
        null, candidate.skippedClubIds);
    }
  }
  if (slots.length !== 16 || selected.size !== 16) {
    throw new Error('Club World must have sixteen unique qualified clubs');
  }
  return Object.freeze({ editionId: input.editionId,
    policyVersion: input.policyVersion,
    cycleId: input.cycleId,
    fourYearSeasonIds: Object.freeze([...input.fourYearSeasonIds]),
    hostSnapshotId: input.hostSnapshot.snapshotId,
    coefficientSources: Object.freeze(REGIONS.map((region) => {
      const source = coefficientByRegion.get(region)!;
      return Object.freeze({ region, snapshotId: source.coefficientSnapshotId,
        policyVersion: source.coefficientPolicyVersion,
        evidenceResultIds: Object.freeze([...source.evidenceResultIds]) });
    })),
    rankingSources: Object.freeze(REGIONS.map((region) => {
      const source = rankingByRegion.get(region)!;
      return Object.freeze({ region, snapshotId: source.rankingSnapshotId,
        policyVersion: source.rankingPolicyVersion });
    })),
    performanceBerthsByRegion: Object.freeze(performanceBerthsByRegion),
    entrantClubIds: Object.freeze(slots.map((slot) => slot.clubId)),
    slots: Object.freeze(slots) });
};
