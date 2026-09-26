import { expect, it } from 'vitest';
import type { ClubWorldRegion } from './ClubWorldBerths';
import { allocateWbcBerths, EMPTY_WBC_BERTH_POLICY_REGISTRY,
  registerWbcBerthPolicy, type WbcBerthAuthority,
  type WbcBerthInput } from './WbcBerths';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const policy = { version: 'wbc-berths-v1',
  performanceMethod: 'DIVISOR_WITH_TWO_EXTRA_CAP' as const };
const input: WbcBerthInput = {
  editionId: 'wbc-2032', cycleId: 'cycle-2031',
  previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
  previousRegionalEditionIds: {
    ASIA_PACIFIC: 'regional-ap-2031',
    AMERICAS: 'regional-am-2031',
    EUROPE: 'regional-eu-2031', AFRICA: 'regional-af-2031',
  },
  qualifierEditionId: 'qualifier-2032',
  cutoffSnapshotId: 'cutoff-2032',
  coefficientPolicyVersion: 'wbc-regional-results-v1',
  policy,
  policyRegistry: registerWbcBerthPolicy(
    EMPTY_WBC_BERTH_POLICY_REGISTRY, policy),
};
const nationRegion = (nationId: string): ClubWorldRegion | null =>
  regions.find((region) => nationId.startsWith(`${region}-`)) ?? null;
const authority: WbcBerthAuthority = {
  editionCutoff: () => ({ snapshotId: 'cutoff-2032', day: 100 }),
  regionalCoefficient: (region) => ({ region,
    snapshotId: `coefficient-${region}`,
    policyVersion: 'wbc-regional-results-v1',
    previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
    completedAtDay: 60,
    score: { ASIA_PACIFIC: 100, AMERICAS: 80,
      EUROPE: 40, AFRICA: 20 }[region],
    evidenceResultIds: [`wbc-result-${region}-2024`,
      `wbc-result-${region}-2028`] }),
  regionalChampionship: (region) => ({ region,
    editionId: input.previousRegionalEditionIds[region],
    snapshotId: `placement-${region}`, completedAtDay: 70,
    orderedNationIds: Array.from({ length: 8 }, (_, index) =>
      `${region}-${index}`) }),
  qualifierPodWinner: (podIndex) => ({ podIndex,
    qualifierEditionId: 'qualifier-2032',
    nationId: `${regions[podIndex]}-${[7, 7, 4, 2][podIndex]}`,
    region: regions[podIndex],
    officialFinalApplicationId: `qualifier-final-${podIndex}`,
    finalizedDay: 80 }),
  nationCompetitionRegion: nationRegion,
};

it('fills 16 floor, four performance and four qualifier WBC berths', () => {
  const result = allocateWbcBerths(input, authority);
  expect(result.slots).toHaveLength(24);
  expect(new Set(result.entrantNationIds).size).toBe(24);
  expect(result.slots.filter((slot) =>
    slot.route === 'REGIONAL_FLOOR')).toHaveLength(16);
  expect(result.slots.filter((slot) =>
    slot.route === 'REGIONAL_PERFORMANCE')).toHaveLength(4);
  expect(result.slots.filter((slot) =>
    slot.route === 'GLOBAL_QUALIFIER')).toHaveLength(4);
  expect(result.directBerthsByRegion).toEqual({
    ASIA_PACIFIC: 7, AMERICAS: 7, EUROPE: 4, AFRICA: 2,
  });
  expect(result.coefficientSources).toHaveLength(4);
  expect(result.regionalPlacementSources).toHaveLength(4);
  expect(allocateWbcBerths(input, authority)).toEqual(result);
});

it('rejects future, duplicate and foreign official qualification evidence', () => {
  expect(() => allocateWbcBerths(input, {
    ...authority, regionalCoefficient: (region, day) => ({
      ...authority.regionalCoefficient(region, day)!,
      completedAtDay: 101 }) })).toThrow('two-edition');
  expect(() => allocateWbcBerths(input, {
    ...authority, qualifierPodWinner: (pod, day) => ({
      ...authority.qualifierPodWinner(pod, day)!,
      nationId: 'ASIA_PACIFIC-0' }) })).toThrow('duplicate');
  expect(() => allocateWbcBerths(input, {
    ...authority, regionalChampionship: (region, day) => ({
      ...authority.regionalChampionship(region, day)!,
      orderedNationIds: region === 'AFRICA'
        ? ['AMERICAS-0', ...Array.from({ length: 7 }, (_, index) =>
          `AFRICA-${index}`)]
        : authority.regionalChampionship(region, day)!.orderedNationIds,
    }) })).toThrow('regional');
  expect(() => allocateWbcBerths({ ...input,
    policy: { ...policy, version: 'unregistered' } }, authority))
    .toThrow('registered');
});
