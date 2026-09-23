import { expect, it } from 'vitest';
import { allocateClubWorldBerths, type ClubWorldBerthInput,
  type ClubWorldRegion, type ClubWorldBerthAuthority }
  from './ClubWorldBerths';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const scores = [40, 30, 20, 10];
const input: ClubWorldBerthInput = {
  editionId: 'club-world-2028',
  policyVersion: 'club-world-qualification-v1',
  cycleId: 'cycle-2024-2027',
  coefficientPolicyVersion: 'coefficient-v1',
  rankingPolicyVersion: 'ranking-v1',
  fourYearSeasonIds: ['2024', '2025', '2026', '2027'],
  previousRegionalEditionIds: {
    ASIA_PACIFIC: 'apbcl-2027', AMERICAS: 'ambcl-2027',
    EUROPE: 'ebcl-2027', AFRICA: 'afbcl-2027',
  },
  previousWorldEditionId: 'club-world-2024',
  hostRegion: 'AMERICAS' as const,
  hostSnapshot: { editionId: 'club-world-2028',
    snapshotId: 'host-2028', region: 'AMERICAS' as const },
  coefficients: regions.map((region, index) => ({ region,
    cycleId: 'cycle-2024-2027',
    coefficientSnapshotId: `coefficient-${region}`,
    coefficientPolicyVersion: 'coefficient-v1',
    score: scores[index],
    fourYearSeasonIds: ['2024', '2025', '2026', '2027'],
    evidenceResultIds: [`regional-results-${region}`] })),
  regionalChampions: regions.map((region, index) => ({
    region, clubId: `${region}-0`,
    officialTitleId: `title-${index}`,
    titleCompetitionId: `REGIONAL_CL_${region}`,
    titleEditionId: {
      ASIA_PACIFIC: 'apbcl-2027', AMERICAS: 'ambcl-2027',
      EUROPE: 'ebcl-2027', AFRICA: 'afbcl-2027',
    }[region] })),
  defendingWorldChampion: { region: 'ASIA_PACIFIC' as const,
    clubId: 'ASIA_PACIFIC-0', officialTitleId: 'world-title-2024',
    titleCompetitionId: 'CLUB_WORLD', titleEditionId: 'club-world-2024' },
  rankings: regions.map((region) => ({ region,
    cycleId: 'cycle-2024-2027', rankingPolicyVersion: 'ranking-v1',
    fourYearSeasonIds: ['2024', '2025', '2026', '2027'],
    rankingSnapshotId: `ranking-${region}`,
    orderedCandidates: Array.from({ length: 8 }, (_, index) => ({
      clubId: `${region}-${index}`, eligible: true,
      evidenceResultIds: [`evidence-${region}-${index}`],
    })) })),
};
const authority: ClubWorldBerthAuthority = {
  latestRegionalChampion: (region) => {
    const title = input.regionalChampions.find((item) => item.region === region)!;
    return { editionId: title.titleEditionId, clubId: title.clubId,
      officialTitleId: title.officialTitleId, titleFinalizedDay: 90 };
  },
  defendingWorldChampion: () => ({
    editionId: 'club-world-2024', clubId: 'ASIA_PACIFIC-0',
    officialTitleId: 'world-title-2024', region: 'ASIA_PACIFIC',
    titleFinalizedDay: 50,
  }),
  editionHost: () => ({ snapshotId: 'host-2028', region: 'AMERICAS',
    qualificationCutoffDay: 100 }),
};
const allocate = (value: ClubWorldBerthInput) =>
  allocateClubWorldBerths(value, authority);

it('allocates six automatic routes and ten four-year performance berths', () => {
  const result = allocate(input);
  expect(result.entrantClubIds).toHaveLength(16);
  expect(new Set(result.entrantClubIds).size).toBe(16);
  expect(result.performanceBerthsByRegion).toEqual({
    ASIA_PACIFIC: 4, AMERICAS: 3, EUROPE: 2, AFRICA: 1,
  });
  expect(result.coefficientSources[0]).toMatchObject({
    snapshotId: 'coefficient-ASIA_PACIFIC',
    policyVersion: 'coefficient-v1',
  });
  expect(result.hostSnapshotId).toBe('host-2028');
  expect(result.slots).toHaveLength(16);
  expect(result.slots.slice(0, 4).map((slot) => slot.clubId))
    .toEqual(regions.map((region) => `${region}-0`));
  expect(result.slots[4]).toMatchObject({
    route: 'DUPLICATE_AUTOMATIC_CASCADE',
    clubId: 'ASIA_PACIFIC-1', originalClubId: 'ASIA_PACIFIC-0',
  });
  expect(result.slots[5]).toMatchObject({
    route: 'HOST_REGION', clubId: 'AMERICAS-1',
  });
  expect(result.slots.slice(6).every((slot) =>
    slot.route === 'REGIONAL_PERFORMANCE')).toBe(true);
  expect(allocate(input)).toEqual(result);
  expect(() => allocate({ ...input,
    coefficients: input.coefficients.map((coefficient, index) =>
      index === 0 ? { ...coefficient, evidenceResultIds: [] }
        : coefficient) })).toThrow('coefficient');
  expect(() => allocate({ ...input,
    rankings: input.rankings.map((ranking, index) => index === 0
      ? { ...ranking, orderedCandidates: ranking.orderedCandidates
        .slice(0, 2) } : ranking) })).toThrow('eligible');
  expect(() => allocate({ ...input,
    rankings: input.rankings.map((ranking, index) => index === 0
      ? { ...ranking, cycleId: 'older-cycle' } : ranking) })).toThrow('ranking');
  expect(() => allocate({ ...input,
    coefficients: input.coefficients.map((coefficient, index) => index === 0
      ? { ...coefficient, coefficientPolicyVersion: 'old-policy' }
      : coefficient) })).toThrow('coefficient');
  expect(() => allocate({ ...input,
    regionalChampions: input.regionalChampions.map((champion, index) =>
      index === 0 ? { ...champion, titleEditionId: 'apbcl-2026' }
        : champion) })).toThrow('champions');
  expect(() => allocate({ ...input,
    defendingWorldChampion: { ...input.defendingWorldChampion,
      titleEditionId: 'club-world-2020' } })).toThrow('defending');
  expect(() => allocate({ ...input,
    hostSnapshot: { ...input.hostSnapshot,
      region: 'EUROPE' } })).toThrow('regional sources');
  expect(() => allocate({ ...input,
    previousRegionalEditionIds: { ...input.previousRegionalEditionIds,
      EUROPE: 'ebcl-2026' },
    regionalChampions: input.regionalChampions.map((champion) =>
      champion.region === 'EUROPE'
        ? { ...champion, titleEditionId: 'ebcl-2026' } : champion),
  })).toThrow('champions');
  expect(() => allocate({ ...input, hostRegion: 'EUROPE',
    hostSnapshot: { ...input.hostSnapshot, region: 'EUROPE' },
  })).toThrow('official edition host');
  expect(() => allocate({ ...input,
    fourYearSeasonIds: ['a|b', 'c', 'd', 'e'],
    coefficients: input.coefficients.map((coefficient) => ({ ...coefficient,
      fourYearSeasonIds: ['a', 'b|c', 'd', 'e'] })),
  })).toThrow('coefficient');
  expect(() => allocateClubWorldBerths(input, {
    ...authority,
    latestRegionalChampion: (region, beforeDay) => ({
      ...authority.latestRegionalChampion(region, beforeDay)!,
      titleFinalizedDay: beforeDay + 1,
    }),
  })).toThrow('champions');
});
