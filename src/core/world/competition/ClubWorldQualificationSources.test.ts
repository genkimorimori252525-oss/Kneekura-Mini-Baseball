import { expect, it } from 'vitest';
import { allocateClubWorldBerths, type ClubWorldRegion }
  from './ClubWorldBerths';
import { buildClubWorldQualificationSources,
  EMPTY_CLUB_WORLD_QUALIFICATION_POLICY_REGISTRY,
  registerClubWorldQualificationPolicy,
  type ClubWorldQualificationSourceInput }
  from './ClubWorldQualificationSources';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const seasons = ['2024', '2025', '2026', '2027'];
const makeSeason = (region: ClubWorldRegion, seasonId: string) => ({
  region, seasonId, editionId: `${region}-${seasonId}`,
  officialSnapshotId: `official-${region}-${seasonId}`,
  completedAtDay: Number(seasonId) - 2000,
  clubs: [0, 1].map((index) => ({ clubId: `${region}-${index}`,
    resultApplicationIds: [`result-${region}-${seasonId}-${index}`],
    achievements: index === 0 ? [
      { kind: 'GROUP_WIN' as const,
        applicationId: `result-${region}-${seasonId}-${index}` },
      ...(seasonId === '2027' ? [{ kind: 'TITLE' as const,
        applicationId: `result-${region}-${seasonId}-${index}` }] : []),
    ] : [],
  })),
});
const input: ClubWorldQualificationSourceInput = {
  editionId: 'club-world-2028', cycleId: 'cycle-2024-2027',
  fourYearSeasonIds: seasons,
  policy: { version: 'world-points-v1',
    recencyMultipliers: [1, 2, 3, 4], regionalTopClubCount: 2,
    tieBreak: 'RECENT_THEN_ID',
    eventWeights: { TITLE: 10, FINAL_APPEARANCE: 5,
      SEMIFINAL_ADVANCE: 3, KNOCKOUT_ADVANCE: 2,
      SERIES_WIN: 1, GROUP_WIN: 1 } },
  policyRegistry: registerClubWorldQualificationPolicy(
    EMPTY_CLUB_WORLD_QUALIFICATION_POLICY_REGISTRY, {
      version: 'world-points-v1',
      recencyMultipliers: [1, 2, 3, 4], regionalTopClubCount: 2,
      tieBreak: 'RECENT_THEN_ID',
      eventWeights: { TITLE: 10, FINAL_APPEARANCE: 5,
        SEMIFINAL_ADVANCE: 3, KNOCKOUT_ADVANCE: 2,
        SERIES_WIN: 1, GROUP_WIN: 1 },
    }),
  eligibility: { editionId: 'club-world-2028',
    snapshotId: 'eligibility-2028', asOfDay: 100,
    regions: regions.map((region) => ({ region,
      eligibleClubIds: [`${region}-0`, `${region}-1`] })) },
  authority: {
    editionHost: () => ({ snapshotId: 'host-2028',
      region: 'AMERICAS' as const, qualificationCutoffDay: 100 }),
    completedRegionalSeason: (region, seasonId) =>
      makeSeason(region, seasonId),
  },
};

it('derives regional coefficients and club rankings only from four official seasons', () => {
  const result = buildClubWorldQualificationSources(input);
  expect(result.coefficients).toHaveLength(4);
  expect(result.rankings).toHaveLength(4);
  expect(result.coefficients[0]).toMatchObject({ region: 'ASIA_PACIFIC',
    score: 50, coefficientPolicyVersion: 'world-points-v1',
    fourYearSeasonIds: seasons });
  expect(result.rankings[0].orderedCandidates.map((candidate) =>
    candidate.clubId)).toEqual(['ASIA_PACIFIC-0', 'ASIA_PACIFIC-1']);
  expect(result.rankings[0].orderedCandidates[0].evidenceResultIds)
    .toHaveLength(4);
  expect(result.eligibilitySnapshotId).toBe('eligibility-2028');
  expect(buildClubWorldQualificationSources(input)).toEqual(result);
});

it('rejects future, mismatched, or unproven achievements', () => {
  const future = { ...input, authority: { ...input.authority,
    completedRegionalSeason: (region: ClubWorldRegion, seasonId: string) =>
      ({ ...makeSeason(region, seasonId), completedAtDay: 101 }) } };
  expect(() => buildClubWorldQualificationSources(future)).toThrow('cutoff');
  const forged = { ...input, authority: { ...input.authority,
    completedRegionalSeason: (region: ClubWorldRegion, seasonId: string) => {
      const season = makeSeason(region, seasonId);
      return { ...season, clubs: season.clubs.map((club, index) => index === 0
        ? { ...club, achievements: [{ kind: 'TITLE' as const,
          applicationId: 'missing-result' }] } : club) };
    } } };
  expect(() => buildClubWorldQualificationSources(forged))
    .toThrow('application');
  expect(() => buildClubWorldQualificationSources({ ...input,
    eligibility: { ...input.eligibility, asOfDay: 101 } }))
    .toThrow('eligibility');
  expect(() => buildClubWorldQualificationSources({ ...input,
    policy: { ...input.policy, eventWeights: {
      ...input.policy.eventWeights, TITLE: 11 } } }))
    .toThrow('registered');
  const hidden = { ...input, authority: { ...input.authority,
    completedRegionalSeason: (region: ClubWorldRegion, seasonId: string) => {
      const season = makeSeason(region, seasonId);
      return { ...season, clubs: [{ ...season.clubs[0], trueAbility: 99 },
        season.clubs[1]] };
    } } };
  expect(() => buildClubWorldQualificationSources(hidden)).toThrow('official');
});

it('feeds sixteen berth slots without a domestic standings input', () => {
  const extended = { ...input,
    eligibility: { ...input.eligibility,
      regions: regions.map((region) => ({ region,
        eligibleClubIds: Array.from({ length: 8 }, (_, index) =>
          `${region}-${index}`) })) },
    authority: { ...input.authority,
      completedRegionalSeason: (region: ClubWorldRegion, seasonId: string) => {
        const season = makeSeason(region, seasonId);
        return { ...season,
          clubs: Array.from({ length: 8 }, (_, index) => index < 2
            ? season.clubs[index] : { clubId: `${region}-${index}`,
              resultApplicationIds: [`result-${region}-${seasonId}-${index}`],
              achievements: [] }) };
      } },
  };
  const sources = buildClubWorldQualificationSources(extended);
  const authority = {
    editionHost: input.authority.editionHost,
    latestRegionalChampion: (region: ClubWorldRegion) => ({
      editionId: `${region}-2027`, clubId: `${region}-0`,
      officialTitleId: `title-${region}`, titleFinalizedDay: 30 }),
    defendingWorldChampion: () => ({ editionId: 'club-world-2024',
      clubId: 'ASIA_PACIFIC-0', officialTitleId: 'world-title-2024',
      region: 'ASIA_PACIFIC' as const, titleFinalizedDay: 20 }),
  };
  const allocation = allocateClubWorldBerths({
    editionId: input.editionId, cycleId: input.cycleId,
    policyVersion: 'club-world-qualification-v1',
    coefficientPolicyVersion: sources.policyVersion,
    rankingPolicyVersion: sources.policyVersion,
    fourYearSeasonIds: seasons,
    previousRegionalEditionIds: {
      ASIA_PACIFIC: 'ASIA_PACIFIC-2027',
      AMERICAS: 'AMERICAS-2027', EUROPE: 'EUROPE-2027',
      AFRICA: 'AFRICA-2027',
    },
    previousWorldEditionId: 'club-world-2024',
    hostRegion: 'AMERICAS',
    hostSnapshot: { editionId: input.editionId,
      snapshotId: 'host-2028', region: 'AMERICAS' },
    coefficients: sources.coefficients,
    rankings: sources.rankings,
    regionalChampions: regions.map((region) => ({ region,
      clubId: `${region}-0`, officialTitleId: `title-${region}`,
      titleCompetitionId: `REGIONAL_CL_${region}`,
      titleEditionId: `${region}-2027` })),
    defendingWorldChampion: { region: 'ASIA_PACIFIC',
      clubId: 'ASIA_PACIFIC-0', officialTitleId: 'world-title-2024',
      titleCompetitionId: 'CLUB_WORLD',
      titleEditionId: 'club-world-2024' },
  }, authority);
  expect(allocation.entrantClubIds).toHaveLength(16);
  expect(new Set(allocation.entrantClubIds).size).toBe(16);
  expect(allocation.coefficientSources[0].snapshotId)
    .toBe(sources.coefficients[0].coefficientSnapshotId);
});
