import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { allocateWbcBerths, EMPTY_WBC_BERTH_POLICY_REGISTRY,
  registerWbcBerthPolicy, type WbcBerthAuthority,
  type WbcBerthInput } from './WbcBerths';
import { finalizeWbcFinalsGroups, planWbcFinalsGroups,
  type WbcFinalsGroupEdition, type WbcFinalsGroupGame }
  from './WbcFinalsGroups';

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
  const revisedSource = allocateWbcBerths(input, {
    ...authority, regionalCoefficient: (region, day) => ({
      ...authority.regionalCoefficient(region, day)!,
      snapshotId: `revised-coefficient-${region}` }),
  });
  expect(revisedSource.entrantNationIds).toEqual(result.entrantNationIds);
  expect(revisedSource.qualificationSnapshotId)
    .not.toBe(result.qualificationSnapshotId);
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

it('binds 24 allocated WBC nations to six US pools and 36 official games', () => {
  const berths = allocateWbcBerths(input, authority);
  const edition: WbcFinalsGroupEdition = {
    competitionId: 'wbc', editionId: input.editionId,
    canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
    formatVersion: 'wbc-24-v1', ruleProfileVersion: 'wbc-rules-v1',
    gamePolicyVersion: 'wbc-group-game-v1',
    hostingPolicyVersion: 'us-six-pools-v1',
    drawPolicyVersion: 'wbc-draw-v1', drawSnapshotId: 'draw-2032',
    qualificationSnapshotId: berths.qualificationSnapshotId,
    hostNationId: 'US',
    calendarWindow: { startsOnDay: 110, endsOnDay: 140 },
    groupTiebreakPolicy: { version: 'wbc-groups-v1',
      tieCreditNumerator: 0, tieCreditDenominator: 1,
      runDifferentialCapPerGame: 5 },
    thirdPlacePolicy: { version: 'wbc-third-v1',
      criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL',
        'RUNS_AGAINST'], drawSeed: 'third-place-2032' },
    groups: Array.from({ length: 6 }, (_, groupIndex) => ({ groupIndex,
      hostCityId: `us-city-${groupIndex}`,
      hostVenueId: `us-venue-${groupIndex}`,
      nationIds: berths.entrantNationIds.slice(groupIndex * 4,
        groupIndex * 4 + 4) })),
  };
  const plan = planWbcFinalsGroups(edition, berths);
  expect(plan.groups.flatMap((group) => group.games)).toHaveLength(36);
  const result = (game: WbcFinalsGroupGame,
    index: number): OfficialGameResult => ({
    gameId: game.gameId, seasonId: edition.editionId,
    homeClubId: game.homeNationId, awayClubId: game.awayNationId,
    homeRuns: 2, awayRuns: 1, winnerClubId: game.homeNationId,
    completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId(edition.ruleProfileVersion),
    gamePolicyVersion: edition.gamePolicyVersion,
    closureId: `wbc-closure-${index}`,
    applicationId: `wbc-application-${index}`,
    durableRevision: index + 1,
    venueBinding: { gameId: game.gameId, venueId: game.venueId,
      fixtureEventId: `wbc-fixture-${index}`, fixtureRevision: 1 },
    lineScore: { innings: [{ inning: 1,
      homeRuns: 2, awayRuns: 1 }], totals: {
      home: { runs: 2, hits: 0, errors: 0 },
      away: { runs: 1, hits: 0, errors: 0 } } },
  });
  const results = plan.groups.flatMap((group) => group.games).map(result);
  const complete = finalizeWbcFinalsGroups(plan,
    results, edition, berths);
  expect(complete.groups).toHaveLength(6);
  expect(complete.groups.every((group) =>
    group.topTwoNationIds?.length === 2
    && group.thirdPlaceNationId !== null)).toBe(true);
  expect(complete.resultApplicationIds).toHaveLength(36);
  expect(complete.qualifiedThirdPlaceNationIds).toHaveLength(4);
  expect(complete.roundOf16NationIds).toHaveLength(16);
  expect(new Set(complete.roundOf16NationIds).size).toBe(16);
  expect(() => finalizeWbcFinalsGroups(plan, results.slice(1),
    edition, berths)).toThrow('36');
  expect(() => finalizeWbcFinalsGroups(plan,
    [{ ...results[0], venueBinding: {
      ...results[0].venueBinding!, venueId: 'foreign' } },
      ...results.slice(1)], edition, berths)).toThrow('venue-bound');
});
