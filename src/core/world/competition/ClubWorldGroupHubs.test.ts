import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from './CompetitionDraw';
import { createCompetitionEdition } from './CompetitionEdition';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { ClubWorldBerthAllocation, ClubWorldRegion } from './ClubWorldBerths';
import { createClubWorldGroupHubPlan, finalizeClubWorldGroupHubs }
  from './ClubWorldGroupHubs';
import { planClubWorldQuarterfinals, finalizeClubWorldQuarterfinals }
  from './ClubWorldQuarterfinals';
import { planClubWorldFinalFour, finalizeClubWorldFinalFour }
  from './ClubWorldFinalFour';

const regions: readonly ClubWorldRegion[] = [
  'ASIA_PACIFIC', 'AMERICAS', 'EUROPE', 'AFRICA'];
const clubIds = Array.from({ length: 16 }, (_, index) => `club-${index}`);
const drawPolicy = { version: 'draw-v1', relaxationOrder: [
  'REMATCH_AVOIDANCE', 'REGIONAL_DIVERSITY',
  'SAME_LEAGUE_AVOIDANCE'] as const };
const registry = registerCompetitionDrawPolicy(
  EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, drawPolicy);
const edition = createCompetitionEdition({ competitionId: 'club-world',
  canonicalRole: 'CLUB_WORLD', formatVersion: 'club-world-16-v1',
  ruleProfileVersion: 'rules-v1', hostingPolicyVersion: 'hubs-v1',
  drawPolicyVersion: drawPolicy.version, drawPolicy,
  awardPolicyVersion: 'awards-v1' }, {
  editionId: 'club-world-2028', qualificationSnapshotId: 'qualified-2028',
  participantIds: clubIds,
  host: { nationId: 'host-nation',
    cityIds: ['city-0', 'city-1', 'city-2', 'city-3'],
    venueIds: ['venue-0', 'venue-1', 'venue-2', 'venue-3'] },
  calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
  drawSnapshotId: 'draw-2028', prestigeAtEdition: 1,
  groupHubs: Array.from({ length: 4 }, (_, groupIndex) => ({ groupIndex,
    nationId: 'host-nation', cityId: `city-${groupIndex}`,
    venueId: `venue-${groupIndex}` })),
  clubWorldQuarterfinalPolicy: { version: 'world-qf-v1',
    runnerGroupByWinnerGroup: [1, 0, 3, 2],
    groupWinnerBatsLast: true,
    venueIds: ['venue-0', 'venue-1', 'venue-2', 'venue-3'] },
  finalFourHostCandidates: [{ venueId: 'venue-3',
    nationId: 'host-nation', cityId: 'city-3', regionId: 'AMERICAS',
    eligible: true, suitabilityScore: 10, rotationScore: 1 }],
  finalFourPairingPolicy: { version: 'world-sf-v1',
    semifinalPairs: [[0, 3], [1, 2]] as const },
}, registry);
const berths: ClubWorldBerthAllocation = {
  editionId: edition.editionId, policyVersion: 'club-world-qualification-v1',
  cycleId: 'cycle-2024-2027', fourYearSeasonIds: ['2024', '2025', '2026', '2027'],
  hostSnapshotId: 'host-2028', coefficientSources: [], rankingSources: [],
  performanceBerthsByRegion: { ASIA_PACIFIC: 4, AMERICAS: 3,
    EUROPE: 2, AFRICA: 1 }, entrantClubIds: clubIds,
  slots: clubIds.map((clubId, berthIndex) => ({ berthIndex, clubId,
    region: regions[berthIndex % 4], route: 'REGIONAL_PERFORMANCE',
    originalClubId: null, sourceId: 'ranking', skippedClubIds: [] })),
};
const source = { edition, berths, drawSeed: 'draw-seed',
  drawParticipants: clubIds.map((teamId, index) => ({ teamId,
    pot: Math.floor(index / 4) + 1,
    leagueId: `league-${index}`, regionId: regions[index % 4] })),
  drawRegistry: registry,
  rematchPairs: [] as readonly (readonly [string, string])[],
  hubPolicyVersion: 'hubs-v1',
};
const policy = { version: 'world-rank-v1', tieCreditNumerator: 0,
  tieCreditDenominator: 1, runDifferentialCapPerGame: 5 };

const officialResult = (game: Readonly<{ gameId: string;
  homeClubId: string; awayClubId: string; neutralVenueId: string;
  fixtureEventId: string }>,
index: number): OfficialGameResult => {
  const winnerClubId = game.homeClubId < game.awayClubId
    ? game.homeClubId : game.awayClubId;
  const homeRuns = winnerClubId === game.homeClubId ? 2 : 1;
  const awayRuns = winnerClubId === game.awayClubId ? 2 : 1;
  return { gameId: game.gameId, seasonId: edition.editionId,
    homeClubId: game.homeClubId, awayClubId: game.awayClubId,
    homeRuns, awayRuns, winnerClubId, completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('rules-v1'),
    gamePolicyVersion: 'world-game-v1', closureId: `closure-${index}`,
    applicationId: `application-${index}`, durableRevision: index + 1,
    venueBinding: { gameId: game.gameId, venueId: game.neutralVenueId,
      fixtureEventId: game.fixtureEventId, fixtureRevision: 1 },
    lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: { home: { runs: homeRuns, hits: 0, errors: 0 },
        away: { runs: awayRuns, hits: 0, errors: 0 } } },
  };
};

it('pins four neutral hubs and ranks 72 venue-bound official group games', () => {
  const plan = createClubWorldGroupHubPlan(source);
  expect(plan.groups).toHaveLength(4);
  const games = plan.groups.flatMap((group) => group.games);
  expect(games).toHaveLength(72);
  expect(new Set(games.map((game) => game.gameId)).size).toBe(72);
  expect(plan.groups.every((group) => group.games.length === 18
    && group.games.every((game) => game.neutralVenueId === group.hub.venueId)))
    .toBe(true);
  expect(createClubWorldGroupHubPlan(source)).toEqual(plan);
  const results = games.map(officialResult);
  const finalized = finalizeClubWorldGroupHubs(plan, results, policy, source);
  expect(finalized.groups.every((group) => group.standings.rows.every(
    (row) => row.games === 9))).toBe(true);
  expect(finalized.groups.every((group) => group.qualifierClubIds?.length === 2))
    .toBe(true);
  expect(() => finalizeClubWorldGroupHubs(plan, results.slice(1),
    policy, source)).toThrow('72');
  expect(() => finalizeClubWorldGroupHubs(plan,
    [{ ...results[0], venueBinding: { ...results[0].venueBinding!,
      venueId: 'venue-3' } }, ...results.slice(1)],
    policy, source)).toThrow('venue');
  expect(() => finalizeClubWorldGroupHubs(plan,
    [{ ...results[0], venueBinding: { ...results[0].venueBinding!,
      fixtureEventId: 'forged-fixture' } }, ...results.slice(1)],
    policy, source)).toThrow('venue');
  expect(() => finalizeClubWorldGroupHubs(plan,
    [{ ...results[0], applicationId: results[1].applicationId },
      ...results.slice(1)], policy, source)).toThrow('venue');
  const forged = structuredClone(plan);
  (forged.groups[0].games[0] as { awayClubId: string }).awayClubId = 'forged';
  expect(() => finalizeClubWorldGroupHubs(forged, results, policy, source))
    .toThrow('plan');
  const tied = results.map((result): OfficialGameResult => ({ ...result,
    homeRuns: 1, awayRuns: 1, winnerClubId: null,
    completionReason: 'TIE_LIMIT',
    lineScore: { innings: [{ inning: 1, homeRuns: 1, awayRuns: 1 }],
      totals: { home: { runs: 1, hits: 0, errors: 0 },
        away: { runs: 1, hits: 0, errors: 0 } } },
  }));
  expect(finalizeClubWorldGroupHubs(plan, tied, policy, source).groups.every(
    (group) => group.qualifierClubIds === null)).toBe(true);
});

it('rejects a draw member from a different region or a hub outside the edition', () => {
  expect(() => createClubWorldGroupHubPlan({ ...source,
    drawParticipants: source.drawParticipants.map((item, index) =>
      index === 0 ? { ...item, regionId: 'AFRICA' } : item),
  })).toThrow('region');
  expect(() => createClubWorldGroupHubPlan({ ...source,
    edition: { ...edition, groupHubs: edition.groupHubs!.map((hub, index) => index === 0
      ? { ...hub, venueId: 'outside' } : hub),
    },
  })).toThrow('hub');
});

it('advances four decided neutral quarterfinals from official group qualification', () => {
  const groupPlan = createClubWorldGroupHubPlan(source);
  const groupOfficialResults = groupPlan.groups.flatMap((group) => group.games)
    .map(officialResult);
  const quarterfinalSource = { groupSource: source, groupPlan,
    groupOfficialResults, groupTiebreakPolicy: policy };
  const plan = planClubWorldQuarterfinals(quarterfinalSource);
  expect(plan.games).toHaveLength(4);
  expect(plan.games.every((game) => game.neutralVenueId
    === edition.clubWorldQuarterfinalPolicy!.venueIds[game.winnerGroupIndex]))
    .toBe(true);
  const results = plan.games.map((game, index) =>
    officialResult(game, index + 72));
  const outcome = finalizeClubWorldQuarterfinals(plan, results,
    quarterfinalSource);
  expect(outcome.winnerClubIds).toHaveLength(4);
  expect(new Set(outcome.winnerClubIds).size).toBe(4);
  expect(() => finalizeClubWorldQuarterfinals(plan,
    [{ ...results[0], venueBinding: { ...results[0].venueBinding!,
      venueId: 'wrong' } }, ...results.slice(1)],
    quarterfinalSource)).toThrow('venue');
  expect(() => finalizeClubWorldQuarterfinals(plan,
    [{ ...results[0], applicationId: groupOfficialResults[0].applicationId },
      ...results.slice(1)], quarterfinalSource)).toThrow('application');
  expect(() => finalizeClubWorldQuarterfinals(plan,
    [{ ...results[0], homeRuns: 1, awayRuns: 1, winnerClubId: null },
      ...results.slice(1)], quarterfinalSource)).toThrow('decided');
  const forged = structuredClone(plan);
  (forged.games[0] as { awayClubId: string }).awayClubId = 'forged';
  expect(() => finalizeClubWorldQuarterfinals(forged, results,
    quarterfinalSource)).toThrow('plan');
});

it('decides the world champion in a neutral semifinal and single-game final', () => {
  const groupPlan = createClubWorldGroupHubPlan(source);
  const groupOfficialResults = groupPlan.groups.flatMap((group) => group.games)
    .map(officialResult);
  const quarterfinalSource = { groupSource: source, groupPlan,
    groupOfficialResults, groupTiebreakPolicy: policy };
  const quarterfinalPlan = planClubWorldQuarterfinals(quarterfinalSource);
  const quarterfinalResults = quarterfinalPlan.games.map((game, index) =>
    officialResult(game, index + 72));
  const finalSource = { quarterfinalSource, quarterfinalPlan,
    quarterfinalResults };
  const plan = planClubWorldFinalFour(finalSource);
  expect(plan.semifinalGames).toHaveLength(2);
  expect(plan.semifinalGames.every((game) =>
    game.neutralVenueId === 'venue-3')).toBe(true);
  const semifinals = plan.semifinalGames.map((game, index) =>
    officialResult(game, index + 76));
  const final = officialResult({ gameId: plan.finalGameId,
    homeClubId: semifinals[0].winnerClubId!,
    awayClubId: semifinals[1].winnerClubId!,
    neutralVenueId: plan.hostVenueId,
    fixtureEventId: plan.finalFixtureEventId }, 78);
  const outcome = finalizeClubWorldFinalFour(plan, semifinals, final,
    finalSource);
  expect(outcome.championClubId).toBe(final.winnerClubId);
  expect(outcome.resultApplicationIds).toHaveLength(3);
  expect(() => finalizeClubWorldFinalFour(plan, semifinals,
    { ...final, venueBinding: { ...final.venueBinding!,
      venueId: 'venue-0' } }, finalSource)).toThrow('venue');
  expect(() => finalizeClubWorldFinalFour(plan, semifinals,
    { ...final, applicationId: groupOfficialResults[0].applicationId },
    finalSource)).toThrow('application');
  expect(() => finalizeClubWorldFinalFour(plan, semifinals,
    { ...final, closureId: semifinals[0].closureId },
    finalSource)).toThrow('application');
  const forged = structuredClone(plan);
  (forged.semifinalGames[0] as { awayClubId: string }).awayClubId = 'forged';
  expect(() => finalizeClubWorldFinalFour(forged, semifinals, final,
    finalSource)).toThrow('plan');
});
