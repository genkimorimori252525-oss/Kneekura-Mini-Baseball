import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy, type CompetitionDraw } from './CompetitionDraw';
import { createCompetitionEdition } from './CompetitionEdition';
import type { OfficialGameResult } from './OfficialGameCompletion';
import { createAfricaGroupHubPlan,
  finalizeAfricaGroupHubs } from './AfricaGroupHubs';

const draw: CompetitionDraw = {
  editionId: 'afbcl-2027', drawPolicyVersion: 'draw-v1',
  drawSeed: 'africa-seed', relaxationOrder: ['REMATCH_AVOIDANCE',
    'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'],
  groups: ['abcd', 'efgh'].map((members) => [...members].map(
    (teamId, index) => ({ teamId, pot: index + 1,
      leagueId: `league-${teamId}`, regionId: `region-${teamId}` }))),
  appliedConstraints: [], relaxedConstraints: [],
  softViolationCounts: { sameLeague: 0, sameRegion: 0, rematch: 0 },
};
const profile = { competitionId: 'afbcl', formatVersion: 'africa-8-v1',
  ruleProfileVersion: 'africa-rules-v1',
  hostingPolicyVersion: 'africa-hubs-v1', drawPolicyVersion: 'draw-v1',
  drawPolicy: { version: 'draw-v1', relaxationOrder: draw.relaxationOrder },
  awardPolicyVersion: 'awards-v1', canonicalRole: 'AFBCL' };
const registry = registerCompetitionDrawPolicy(
  EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, profile.drawPolicy);
const editionInput = {
  editionId: draw.editionId, qualificationSnapshotId: 'afbcl-qualified',
  participantIds: draw.groups.flatMap((group) => group.map((team) =>
    team.teamId)),
  host: { nationId: 'nation-final',
    cityIds: ['city-north', 'city-south', 'city-final'],
    venueIds: ['venue-north', 'venue-south', 'venue-final'] },
  calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
  drawSnapshotId: 'afbcl-draw', prestigeAtEdition: 1,
  finalFourHostCandidates: [{ venueId: 'venue-final',
    nationId: 'nation-final', cityId: 'city-final', regionId: 'region-final',
    eligible: true, suitabilityScore: 10, rotationScore: 1 }],
  groupHubs: [{ groupIndex: 0, nationId: 'nation-north',
    cityId: 'city-north', venueId: 'venue-north' },
  { groupIndex: 1, nationId: 'nation-south',
    cityId: 'city-south', venueId: 'venue-south' }],
};
const edition = createCompetitionEdition(profile, editionInput, registry);
const policy = { version: 'afbcl-rank-v1', tieCreditNumerator: 0,
  tieCreditDenominator: 1, runDifferentialCapPerGame: 5 };

const officialResult = (game: Readonly<{ gameId: string;
  homeClubId: string; awayClubId: string; neutralVenueId: string }>,
index: number): OfficialGameResult => {
  const winnerClubId = game.homeClubId < game.awayClubId
    ? game.homeClubId : game.awayClubId;
  const homeRuns = winnerClubId === game.homeClubId ? 2 : 1;
  const awayRuns = winnerClubId === game.awayClubId ? 2 : 1;
  return { gameId: game.gameId, seasonId: draw.editionId,
    homeClubId: game.homeClubId, awayClubId: game.awayClubId,
    homeRuns, awayRuns, winnerClubId, completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('africa-rules-v1'),
    gamePolicyVersion: 'afbcl-game-v1',
    closureId: `closure-${index}`,
    applicationId: `application-${index}`, durableRevision: index + 1,
    venueBinding: { gameId: game.gameId,
      venueId: game.neutralVenueId,
      fixtureEventId: `fixture-${index}`, fixtureRevision: 1 },
    lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
        away: { runs: awayRuns, hits: 0, errors: 0 } } },
  };
};

it('pins two African group hubs and qualifies from 36 official games', () => {
  expect(() => createCompetitionEdition(profile,
    { ...editionInput, groupHubs: undefined }, registry))
    .toThrow('group hubs');
  const source = { edition, draw, hubPolicyVersion: 'africa-hubs-v1' };
  const plan = createAfricaGroupHubPlan(source);
  expect(plan.groups).toHaveLength(2);
  expect(plan.groups.every((group) => group.games.length === 18)).toBe(true);
  const games = plan.groups.flatMap((group) => group.games);
  expect(new Set(games.map((game) => game.gameId)).size).toBe(36);
  expect(games.every((game) => game.neutralVenueId
    === plan.groups[game.groupIndex].hub.venueId)).toBe(true);
  const results = games.map(officialResult);
  const snapshot = finalizeAfricaGroupHubs(plan, results, policy, source);
  expect(snapshot.groups.map((group) => group.qualifierClubIds))
    .toEqual([['a', 'b'], ['e', 'f']]);
  expect(snapshot.groups.every((group) => group.standings.rows.every(
    (row) => row.games === 9))).toBe(true);
  expect(plan.groups.every((group) => group.memberClubIds.every((clubId) => {
    const homeGames = group.games.filter((game) =>
      game.homeClubId === clubId).length;
    return homeGames === 4 || homeGames === 5;
  }))).toBe(true);
  expect(() => finalizeAfricaGroupHubs(plan, results.slice(1),
    policy, source)).toThrow('complete');
  expect(() => finalizeAfricaGroupHubs(plan,
    [{ ...results[0], venueBinding: { ...results[0].venueBinding!,
      venueId: 'venue-south' } }, ...results.slice(1)],
    policy, source)).toThrow('venue');
  const forged = structuredClone(plan);
  (forged.groups[0].games[0] as { awayClubId: string }).awayClubId = 'x';
  expect(() => finalizeAfricaGroupHubs(forged, results,
    policy, source)).toThrow('plan');
  const tied = results.map((game): OfficialGameResult => ({
    ...game, homeRuns: 1, awayRuns: 1, winnerClubId: null,
    completionReason: 'TIE_LIMIT',
    lineScore: { innings: [{ inning: 1, homeRuns: 1, awayRuns: 1 }],
      totals: { home: { runs: 1, hits: 0, errors: 0 },
        away: { runs: 1, hits: 0, errors: 0 } } },
  }));
  expect(finalizeAfricaGroupHubs(plan, tied, policy, source).groups
    .every((group) => group.qualifierClubIds === null)).toBe(true);
});
