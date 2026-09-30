import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import * as drawModule from './SqliteRegionalNationalDrawStore';
import { nationalCallupFixture } from './NationalCallupFixtures.test-support';
import { openSqliteNationalCallupStore } from './SqliteNationalCallupStore';
import { openSqliteNationalRosterEligibilityStore } from './SqliteNationalRosterEligibilityStore';
import { openSqliteRegionalNationalRankingSnapshotStore } from './SqliteRegionalNationalRankingSnapshotStore';
import { openSqliteRegionalNationalGroupStore } from './SqliteRegionalNationalGroupStore';
import { regionalNationalInput } from './RegionalNationalFixtures.test-support';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, registerWorldNationalRankingPolicy } from '../../core/world/competition/WorldNationalRankingHistory';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, registerCompetitionDrawPolicy } from '../../core/world/competition/CompetitionDraw';

it.each([8, 12, 16])('draws only %i accepted regional national rosters into four ranking pots and replays source proof', (count) => {
  expect(drawModule).toHaveProperty('openSqliteRegionalNationalDrawStore');
  const nationIds = Array.from({ length: count + 1 }, (_, i) => `EU-${i.toString().padStart(2, '0')}`);
  const f = nationalCallupFixture([], { playerNationIds: nationIds,
    nations: nationIds.map((nationId) => ({ nationId, region: 'EUROPE' as const })) });
  const callups = openSqliteNationalCallupStore(f.path, f.sources);
  const eligibility = openSqliteNationalRosterEligibilityStore(f.path, { selections: f.selections, nations: f.nations, callups });
  const selection = f.selections.initialize({ careerId: 'career-a', editionId: 'regional-eu-2031',
    cycleOrdinal: 0, kind: 'REGIONAL_NATIONAL', region: 'EUROPE', careerDayOne: '2031-01-01', cutoffDay: 100 });
  // Isolated previous official history/metadata are fixtures. Ranking, callups, eligibility,
  // calendar and Nation owners are Native; actual previous Match evidence has a separate integration gate.
  const prior = { ...regionalNationalInput('EUROPE', 2, { startsOnDay: 20, endsOnDay: 80 }).edition, editionId: 'prior-eu' };
  let winner = nationIds[count];
  const rankings = openSqliteRegionalNationalRankingSnapshotStore(f.path, { nations: f.nations, history: {
    readRegionalEdition: () => prior,
    readHistory: () => ({ editions: [{ editionId: prior.editionId, tier: 'REGIONAL', completedAtDay: 80,
      snapshotId: 'previous-eu-proof', games: [{ applicationId: 'previous-eu-final', stage: 'FINAL',
        homeNationId: nationIds[count], awayNationId: nationIds[0], winnerNationId: winner }] }] }) } });
  const rankingPolicy = { version: 'regional-ranking-fixture-v1', winPoints: 2, tiePoints: 1,
    tierWeights: { REGIONAL: 1, WBC: 0, PREMIER_12: 0 },
    stageWeights: { GROUP: 1, ROUND_OF_16: 1, QUARTERFINAL: 2, SEMIFINAL: 3, BRONZE: 1, FINAL: 4 },
    recencyBands: [{ maxAgeDays: 100, multiplier: 1 }], tieBreak: 'NATION_ID' as const };
  const policy = { version: 'regional-draw-fixture-v1', rematchLookbackDays: 100,
    relaxationOrder: ['REMATCH_AVOIDANCE', 'SAME_LEAGUE_AVOIDANCE', 'REGIONAL_DIVERSITY'] as const };
  const registry = registerCompetitionDrawPolicy(EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, policy);
  const sources = { selections: f.selections, nations: f.nations, rankings, eligibility };
  let draws = drawModule.openSqliteRegionalNationalDrawStore(f.path, sources);
  try {
    for (let i = 0; i < count; i++) callups.register({ ...f.request(i), editionId: selection.editionId,
      nationId: nationIds[i], registeredAtDay: 90, callupPolicy: { ...f.request().callupPolicy,
        version: 'regional-roster-fixture-v1', initialRegistrationCutoffDay: 100, replacementCutoffDay: 110 } });
    const eligible = eligibility.initialize({ careerId: 'career-a', editionId: selection.editionId,
      asOfDay: 100, candidateNationIds: nationIds, policy: { version: 'regional-capability-fixture-v1', minimumActivePlayers: 1 } });
    const request = { careerId: 'career-a', editionId: selection.editionId,
      eligibilitySnapshotId: eligible.eligibility.snapshotId, drawSeed: 'regional-seed', policy, registry };
    if (count === 8) {
      const partial = eligibility.initialize({ ...eligible.input, candidateNationIds: nationIds.slice(0, 4) });
      const early = eligibility.initialize({ ...eligible.input, asOfDay: 99 });
      for (const eligibilitySnapshotId of ['missing-cohort', partial.eligibility.snapshotId, early.eligibility.snapshotId]) {
        expect(() => draws.initialize({ ...request, eligibilitySnapshotId })).toThrow('cutoff roster cohort');
        expect(draws.readDraw('career-a', selection.editionId)).toBeNull();
      }
      expect(() => draws.initialize({ ...request, registry: EMPTY_COMPETITION_DRAW_POLICY_REGISTRY })).toThrow('registered version');
    }
    expect(() => draws.initialize(request)).toThrow('regional cutoff ranking');
    rankings.initialize({ careerId: 'career-a', region: 'EUROPE', asOfDay: 100, nationIds,
      policy: rankingPolicy, registry: registerWorldNationalRankingPolicy(EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, rankingPolicy) });
    const accepted = draws.initialize(request);
    expect(accepted.draw.groups).toHaveLength(count / 4);
    expect(accepted.draw.groups.flatMap((group) => group.map((row) => row.teamId)).sort()).toEqual(nationIds.slice(0, count));
    for (const group of accepted.draw.groups) expect(group.map((row) => row.pot)).toEqual([1, 2, 3, 4]);
    expect(accepted.source.ranking.ranking.orderedNationIds[0]).toBe(nationIds[count]);
    expect(accepted.source.eligibility).toEqual(eligible.eligibility);
    expect(accepted.draw.softViolationCounts.sameRegion).toBe(count / 4 * 6);
    expect(draws.initialize(request)).toEqual(accepted);
    expect(() => draws.initialize({ ...request, drawSeed: 'another-seed' })).toThrow('frozen differently');
    callups.register({ ...f.request(count), editionId: selection.editionId, nationId: nationIds[count],
      registeredAtDay: 100, callupPolicy: { ...f.request().callupPolicy,
        version: 'regional-roster-fixture-v1', initialRegistrationCutoffDay: 100, replacementCutoffDay: 110 } });
    expect(draws.readDraw('career-a', selection.editionId)).toEqual(accepted);
    const groupSources = { selections: f.selections, regions: f.nations,
      draws: { readDraw: (careerId: string, editionId: string) => draws.readDraw(careerId, editionId) },
      matches: { getMatch: () => null, getOfficialFixture: () => null } };
    const groups = openSqliteRegionalNationalGroupStore(':memory:', groupSources);
    const manual = regionalNationalInput('EUROPE', count / 4, selection.calendarWindow).edition;
    const edition = { ...manual, editionId: selection.editionId,
      qualificationSnapshotId: eligible.eligibility.snapshotId, drawSnapshotId: accepted.drawSnapshotId,
      groups: manual.groups.map((group, index) => ({ ...group, nationIds: accepted.draw.groups[index].map((row) => row.teamId) })) };
    try {
      expect(() => groups.initialize('career-a', { ...edition, drawSnapshotId: 'manual-draw' })).toThrow('accepted regional draw');
      expect(() => groups.initialize('career-a', { ...edition, qualificationSnapshotId: 'manual-cohort' })).toThrow('accepted regional draw');
      const altered = edition.groups.map((group) => ({ ...group, nationIds: [...group.nationIds] }));
      [altered[0].nationIds[1], altered[1].nationIds[1]] = [altered[1].nationIds[1], altered[0].nationIds[1]];
      expect(() => groups.initialize('career-a', { ...edition, groups: altered })).toThrow('accepted regional draw');
      expect(groups.initialize('career-a', edition).groups).toHaveLength(count / 4);
    } finally { groups.close(); }
    f.nations.record({ careerId: 'career-a', nationId: nationIds[0], region: 'AMERICAS', effectiveFromDay: 101, sourceEventId: 'later-move' });
    draws.close(); draws = drawModule.openSqliteRegionalNationalDrawStore(f.path, sources);
    expect(draws.readDraw('career-a', selection.editionId)).toEqual(accepted);
    winner = nationIds[0];
    expect(() => draws.readDraw('career-a', selection.editionId)).toThrow('corrupt');
    winner = nationIds[count];
    const { DatabaseSync }: typeof import('node:sqlite') = createRequire(import.meta.url)('node:sqlite');
    const db = new DatabaseSync(f.path);
    try { db.prepare("UPDATE world_regional_national_draws SET draw_json='{}'").run(); }
    finally { db.close(); }
    expect(() => draws.readDraw('career-a', selection.editionId)).toThrow('corrupt');
  } finally { draws.close(); rankings.close(); eligibility.close(); callups.close(); f.close(); }
});
