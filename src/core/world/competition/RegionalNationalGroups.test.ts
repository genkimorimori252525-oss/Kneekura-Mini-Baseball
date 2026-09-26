import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import type { ClubWorldRegion } from './ClubWorldBerths';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { finalizeRegionalNationalGroups,
  planRegionalNationalGroups,
  type RegionalNationalEdition,
  type RegionalNationalGroupGame }
  from './RegionalNationalGroups';

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
const result = (game: RegionalNationalGroupGame,
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
