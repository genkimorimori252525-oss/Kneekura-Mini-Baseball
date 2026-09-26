import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeRegionalNationalGroups,
  planRegionalNationalGroups,
  type RegionalNationalEdition,
  type RegionalNationalGroupGame }
  from './RegionalNationalGroups';
import { finalizeRegionalNationalKnockout,
  planRegionalNationalFinal, planRegionalNationalKnockout,
  planRegionalNationalSemifinals,
  type RegionalNationalKnockoutEdition }
  from './RegionalNationalKnockout';

const edition = (region: ClubWorldRegion,
  groupCount: 2 | 3 | 4): RegionalNationalEdition => ({
  competitionId: `national-${region}`,
  editionId: `national-${region}-2031`,
  canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP',
  region, formatVersion: `groups-${groupCount}-v1`,
  ruleProfileVersion: 'national-rules-v1',
  gamePolicyVersion: 'national-games-v1',
  hostingPolicyVersion: 'national-hosts-v1',
  qualificationSnapshotId: `qualified-${region}-2031`,
  drawSnapshotId: `draw-${region}-2031`,
  tiebreakPolicy: { version: 'national-groups-v1',
    tieCreditNumerator: 0, tieCreditDenominator: 1,
    runDifferentialCapPerGame: 5 },
  bestThirdPolicy: { version: 'national-third-v1',
    criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL',
      'RUNS_AGAINST'], drawSeed: `third-${region}` },
  hostNationIds: ['host-nation'],
  groups: Array.from({ length: groupCount }, (_, groupIndex) => ({
    groupIndex,
    nationIds: Array.from({ length: 4 }, (_, memberIndex) =>
      `${region}-${groupIndex * 4 + memberIndex}`),
    hostNationId: 'host-nation',
    hostCityId: `host-city-${groupIndex}`,
    hostVenueId: `host-venue-${groupIndex}` })),
  calendarWindow: { startsOnDay: 10, endsOnDay: 30 },
});
const authority = {
  nationCompetitionRegion: (nationId: string) =>
    nationId.split('-')[0] as ClubWorldRegion,
};
const result = (game: Pick<RegionalNationalGroupGame,
  'gameId' | 'homeNationId' | 'awayNationId' | 'venueId'>,
  index: number, editionId: string): OfficialGameResult => ({
  gameId: game.gameId, seasonId: editionId,
  homeClubId: game.homeNationId,
  awayClubId: game.awayNationId,
  homeRuns: 2, awayRuns: 1,
  winnerClubId: game.homeNationId,
  completionReason: 'BOTTOM_COMPLETE',
  ruleProfileId: asRuleProfileId('national-rules-v1'),
  gamePolicyVersion: 'national-games-v1',
  closureId: `closure-${index}`,
  applicationId: `application-${index}`,
  durableRevision: index + 1,
  venueBinding: { gameId: game.gameId,
    venueId: game.venueId,
    fixtureEventId: `fixture-${index}`,
    fixtureRevision: 1 },
  lineScore: { innings: [{ inning: 1,
    homeRuns: 2, awayRuns: 1 }], totals: {
    home: { runs: 2, hits: 0, errors: 0 },
    away: { runs: 1, hits: 0, errors: 0 } } },
});

it('finishes regional national knockouts and ranks every entrant for WBC berths', () => {
  for (const [region, groupCount] of [
    ['ASIA_PACIFIC', 4], ['AFRICA', 3],
    ['EUROPE', 2],
  ] as const) {
    const groupEdition = edition(region, groupCount);
    const groupPlan = planRegionalNationalGroups(groupEdition, authority);
    const groupResults = groupPlan.groups.flatMap((group) => group.games)
      .map((game, index) => result(game, index, groupEdition.editionId));
    const knockoutEdition: RegionalNationalKnockoutEdition = {
      competitionId: groupEdition.competitionId,
      editionId: groupEdition.editionId,
      region, formatVersion: groupEdition.formatVersion,
      ruleProfileVersion: groupEdition.ruleProfileVersion,
      gamePolicyVersion: groupEdition.gamePolicyVersion,
      qualificationSnapshotId: groupEdition.qualificationSnapshotId,
      groupDrawSnapshotId: groupEdition.drawSnapshotId,
      knockoutPolicyVersion: 'regional-national-knockout-v1',
      openingPairs: groupCount === 2
        ? [[0, 3], [1, 2]]
        : [[0, 7], [1, 6], [2, 5], [3, 4]],
      openingVenueIds: Array.from({ length: groupCount === 2 ? 2 : 4 },
        (_, index) => `knockout-venue-${index}`),
      semifinalVenueIds: ['semi-venue-0', 'semi-venue-1'],
      finalVenueId: 'final-venue',
      placementPolicy: { version: 'regional-placement-v1',
        criteria: ['GROUP_WINS', 'GROUP_RUN_DIFFERENTIAL',
          'GROUP_RUNS_AGAINST'], drawSeed: `placement-${region}` },
    };
    const source = { groupEdition, groupPlan, groupResults,
      authority, knockoutEdition };
    const plan = planRegionalNationalKnockout(source);
    const quarterfinalResults = groupCount === 2 ? []
      : plan.openingGames.map((game, index) => result(game,
        groupResults.length + index, groupEdition.editionId));
    const semifinalGames = groupCount === 2
      ? plan.openingGames
      : planRegionalNationalSemifinals(plan, quarterfinalResults, source);
    const semifinalResults = semifinalGames.map((game, index) => result(game,
      groupResults.length + quarterfinalResults.length + index,
      groupEdition.editionId));
    const finalGame = planRegionalNationalFinal(plan, quarterfinalResults,
      semifinalResults, source);
    const finalResult = result(finalGame,
      groupResults.length + quarterfinalResults.length
        + semifinalResults.length, groupEdition.editionId);
    const complete = finalizeRegionalNationalKnockout(plan,
      quarterfinalResults, semifinalResults, finalResult, source);
    expect(complete.championNationId).toBe(finalGame.homeNationId);
    expect(complete.placement.region).toBe(region);
    expect(complete.placement.orderedNationIds)
      .toHaveLength(groupCount * 4);
    expect(new Set(complete.placement.orderedNationIds).size)
      .toBe(groupCount * 4);
    expect(complete.placement.orderedNationIds[0])
      .toBe(complete.championNationId);
    expect(complete.resultApplicationIds).toHaveLength(
      groupResults.length + quarterfinalResults.length
        + semifinalResults.length + 1);
    expect(() => finalizeRegionalNationalKnockout(plan,
      quarterfinalResults, semifinalResults,
      { ...finalResult, winnerClubId: finalGame.awayNationId },
      source)).toThrow('contradicts');
  }
});

it('advances official 16, 12 and 8-nation regional formats', () => {
  for (const [region, groupCount] of [
    ['ASIA_PACIFIC', 4], ['AFRICA', 3],
    ['EUROPE', 2],
  ] as const) {
    const source = edition(region, groupCount);
    const plan = planRegionalNationalGroups(source, authority);
    const results = plan.groups.flatMap((group) => group.games)
      .map((game, index) => result(game, index, source.editionId));
    const complete = finalizeRegionalNationalGroups(plan,
      results, source, authority);
    expect(complete.groups).toHaveLength(groupCount);
    expect(complete.resultApplicationIds).toHaveLength(groupCount * 6);
    expect(complete.knockoutNationIds).toHaveLength(
      groupCount === 2 ? 4 : 8);
    expect(new Set(complete.knockoutNationIds).size)
      .toBe(complete.knockoutNationIds!.length);
    expect(complete.bestThirdNationIds).toHaveLength(
      groupCount === 3 ? 2 : 0);
  }
});

it('rejects foreign nation, incomplete result and wrong venue', () => {
  const source = edition('AFRICA', 3);
  const plan = planRegionalNationalGroups(source, authority);
  const results = plan.groups.flatMap((group) => group.games)
    .map((game, index) => result(game, index, source.editionId));
  expect(() => finalizeRegionalNationalGroups(plan,
    results.slice(1), source, authority)).toThrow('complete');
  expect(() => finalizeRegionalNationalGroups(plan,
    [{ ...results[0], venueBinding: {
      ...results[0].venueBinding!, venueId: 'foreign' } },
      ...results.slice(1)], source, authority)).toThrow('venue');
  const wrongNation = structuredClone(source);
  (wrongNation.groups[0].nationIds[0] as string) = 'EUROPE-0';
  expect(() => planRegionalNationalGroups(wrongNation, authority))
    .toThrow('eligible');
});
