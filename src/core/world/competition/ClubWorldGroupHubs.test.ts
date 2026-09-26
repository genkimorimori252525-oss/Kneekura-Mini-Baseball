import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../model/RuleProfileRef';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from './CompetitionDraw';
import { createCompetitionEdition } from './CompetitionEdition';
import type { OfficialGameResult } from './OfficialGameCompletion';
import type { ClubWorldBerthAllocation, ClubWorldRegion } from './ClubWorldBerths';
import { createClubWorldGroupHubPlan, finalizeClubWorldGroupHubs }
  from './ClubWorldGroupHubs';

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
