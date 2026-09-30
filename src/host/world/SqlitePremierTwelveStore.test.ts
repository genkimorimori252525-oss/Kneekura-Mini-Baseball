import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PremierTwelveEdition, PremierTwelveGame } from
  '../../core/world/competition/PremierTwelve';
import type { RegionalNationalEdition } from
  '../../core/world/competition/RegionalNationalGroups';
import { EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY,
  registerWorldNationalRankingPolicy } from
  '../../core/world/competition/WorldNationalRankingHistory';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import { openSqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import { openSqliteRegionalNationalGroupStore } from
  './SqliteRegionalNationalGroupStore';
import { openSqliteRegionalNationalKnockoutStore } from
  './SqliteRegionalNationalKnockoutStore';
import { openSqliteWorldNationalRankingHistoryStore } from
  './SqliteWorldNationalRankingHistoryStore';
import { openSqliteWorldNationalRankingSnapshotStore } from
  './SqliteWorldNationalRankingSnapshotStore';
import { openSqlitePremierTwelveGroupStore } from
  './SqlitePremierTwelveGroupStore';
import { openSqlitePremierTwelveFinalFourStore,
  type SqlitePremierTwelveFinalFourStore } from
  './SqlitePremierTwelveFinalFourStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const nationIds = Array.from({ length: 12 }, (_, index) =>
  `nation-${index}`);
const regionalEdition: RegionalNationalEdition = {
  competitionId: 'national-europe', editionId: 'europe-2033',
  canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP', region: 'EUROPE',
  formatVersion: 'groups-2-v1', ruleProfileVersion: 'rules-v1',
  gamePolicyVersion: 'games-v1', hostingPolicyVersion: 'hosts-v1',
  qualificationSnapshotId: 'qualification-2033', drawSnapshotId: 'draw-2033',
  tiebreakPolicy: { version: 'ties-v1', tieCreditNumerator: 0,
    tieCreditDenominator: 1, runDifferentialCapPerGame: 5 },
  bestThirdPolicy: { version: 'third-v1', criteria: ['WINS',
    'CAPPED_RUN_DIFFERENTIAL', 'RUNS_AGAINST'], drawSeed: 'third-seed' },
  hostNationIds: ['nation-0'],
  groups: [0, 1].map((groupIndex) => ({ groupIndex,
    nationIds: nationIds.slice(groupIndex * 4, groupIndex * 4 + 4),
    hostNationId: 'nation-0', hostCityId: `city-${groupIndex}`,
    hostVenueId: `venue-${groupIndex}` })),
  calendarWindow: { startsOnDay: 10, endsOnDay: 30 },
};
const policy = { version: 'ranking-v1', winPoints: 2, tiePoints: 1,
  tierWeights: { REGIONAL: 1, WBC: 3, PREMIER_12: 2 },
  stageWeights: { GROUP: 1, ROUND_OF_16: 2, QUARTERFINAL: 3,
    SEMIFINAL: 4, BRONZE: 2, FINAL: 5 },
  recencyBands: [{ maxAgeDays: 100, multiplier: 1 }],
  tieBreak: 'NATION_ID' as const };
const registry = registerWorldNationalRankingPolicy(
  EMPTY_WORLD_NATIONAL_RANKING_POLICY_REGISTRY, policy);

it('replays regional ranking through all 34 Premier12 games and later rankings', () => {
  const directory = mkdtempSync(join(tmpdir(), 'premier-twelve-'));
  const path = join(directory, 'world.sqlite');
  const closables: { close(): void }[] = [];
  const finals = new Map<string, OfficialGameResult>();
  const fixtures = new Map<string,
    NonNullable<OfficialGameResult['venueBinding']>>();
  const matches = { getMatch: (gameId: string) => {
    const finalResult = finals.get(gameId);
    return finalResult ? { finalResult } : null;
  }, getOfficialFixture: (gameId: string) => fixtures.get(gameId) ?? null,
  } as PostseasonMatchSource;
  const track = <T extends { close(): void }>(store: T): T => {
    closables.push(store);
    return store;
  };
  const put = (game: PremierTwelveGame, editionId: string): void => {
    const result: OfficialGameResult = {
      gameId: game.gameId, seasonId: editionId,
      homeClubId: game.homeNationId, awayClubId: game.awayNationId,
      homeRuns: 2, awayRuns: 1, winnerClubId: game.homeNationId,
      completionReason: 'BOTTOM_COMPLETE',
      ruleProfileId: asRuleProfileId('rules-v1'), gamePolicyVersion: 'games-v1',
      closureId: `closure-${game.gameId}`, applicationId: `apply-${game.gameId}`,
      durableRevision: 1,
      venueBinding: { gameId: game.gameId, venueId: game.venueId,
        fixtureEventId: `fixture-${game.gameId}`, fixtureRevision: 1 },
      lineScore: { innings: [{ inning: 1, homeRuns: 2, awayRuns: 1 }],
        totals: { home: { runs: 2, hits: 1, errors: 0 },
          away: { runs: 1, hits: 1, errors: 0 } } },
    };
    finals.set(game.gameId, result);
    fixtures.set(game.gameId, result.venueBinding!);
  };
  try {
    const regions = track(openSqliteNationCompetitionRegionStore(path));
    nationIds.forEach((nationId, index) => regions.record({
      careerId: 'career-1', nationId, region: 'EUROPE',
      effectiveFromDay: 0, sourceEventId: `region-${index}` }));
    const regionalGroups = track(openSqliteRegionalNationalGroupStore(path,
      { regions, matches }));
    const regionalPlan = regionalGroups.initialize('career-1', regionalEdition);
    regionalPlan.groups.flatMap((group) => group.games)
      .forEach((game) => put(game, regionalEdition.editionId));
    regionalGroups.finalize('career-1', regionalEdition.editionId);
    const regional = track(openSqliteRegionalNationalKnockoutStore(path,
      { groups: regionalGroups, regions, matches }));
    const regionalKnockout = regional.initialize('career-1', {
      competitionId: regionalEdition.competitionId,
      editionId: regionalEdition.editionId, region: 'EUROPE',
      formatVersion: 'groups-2-v1', ruleProfileVersion: 'rules-v1',
      gamePolicyVersion: 'games-v1', qualificationSnapshotId: 'qualification-2033',
      groupDrawSnapshotId: 'draw-2033', knockoutPolicyVersion: 'knockout-v1',
      openingPairs: [[0, 3], [1, 2]],
      openingVenueIds: ['semi-0', 'semi-1'],
      semifinalVenueIds: ['semi-0', 'semi-1'], finalVenueId: 'final-venue',
      placementPolicy: { version: 'placement-v1', criteria: ['GROUP_WINS',
        'GROUP_RUN_DIFFERENTIAL', 'GROUP_RUNS_AGAINST'], drawSeed: 'place-seed' },
    });
    regionalKnockout.openingGames.forEach((game) =>
      put(game, regionalEdition.editionId));
    put(regional.readFinalGame('career-1', regionalEdition.editionId)!,
      regionalEdition.editionId);
    regional.finalize('career-1', regionalEdition.editionId);
    let finalFour: SqlitePremierTwelveFinalFourStore | undefined;
    const history = track(openSqliteWorldNationalRankingHistoryStore(path, {
      regional, wbc: { readEvidence: () => null }, nations: regions,
      premier: { readEvidence: (careerId, editionId) =>
        finalFour?.readEvidence(careerId, editionId) ?? null },
    }));
    history.recordRegional('career-1', regionalEdition.editionId);
    const rankings = track(openSqliteWorldNationalRankingSnapshotStore(path,
      { history }));
    const ranking = rankings.initialize({ careerId: 'career-1',
      asOfDay: 30, nationIds, policy, registry });
    const edition: PremierTwelveEdition = {
      competitionId: 'premier12', editionId: 'premier-2034',
      canonicalRole: 'PREMIER_12', formatVersion: 'premier-v1',
      ruleProfileVersion: 'rules-v1', gamePolicyVersion: 'games-v1',
      rankingPolicyVersion: policy.version,
      qualificationCutoffSnapshotId: 'cutoff-2034',
      rankingSnapshotId: ranking.snapshotId, drawSnapshotId: 'premier-draw',
      hostingPolicyVersion: 'premier-hosts-v1',
      tiebreakPolicy: regionalEdition.tiebreakPolicy,
      finalFourPairingPolicy: { version: 'pairs-v1', semifinalPairs: [[0, 3], [1, 2]] },
      hostNationIds: ['nation-0', 'nation-6'],
      groupHosts: [{ groupIndex: 0, nationId: 'nation-0', cityId: 'host-a',
        venueId: 'group-a' }, { groupIndex: 1, nationId: 'nation-6',
        cityId: 'host-b', venueId: 'group-b' }],
      finalFourHost: { nationId: 'nation-0', cityId: 'medal-city',
        venueId: 'medal-venue' },
      groups: [0, 1].map((groupIndex) => ({ groupIndex,
        nationIds: ranking.orderedNationIds.slice(groupIndex * 6, groupIndex * 6 + 6) })),
      calendarWindow: { startsOnDay: 40, endsOnDay: 55 },
    };
    let cutoff = { snapshotId: 'cutoff-2034', day: 30 };
    const sources = { rankings, editionCutoff: () => cutoff, matches };
    const groups = track(openSqlitePremierTwelveGroupStore(path, sources));
    const request = { careerId: 'career-1', edition };
    const plan = groups.initialize(request);
    expect(groups.initialize(request)).toEqual(plan);
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path, { groups, matches }));
    expect(() => finalFour!.initialize('career-1', edition.editionId))
      .toThrow('finalized groups');
    const games = plan.groups.flatMap((group) => group.games);
    games.slice(0, 29).forEach((game) => put(game, edition.editionId));
    expect(groups.finalize('career-1', edition.editionId)).toBeNull();
    groups.close();
    const reopenedGroups = track(openSqlitePremierTwelveGroupStore(path, sources));
    expect(reopenedGroups.readPlan('career-1', edition.editionId)).toEqual(plan);
    put(games[29], edition.editionId);
    const groupOutcome = reopenedGroups.finalize('career-1', edition.editionId)!;
    expect(groupOutcome.resultApplicationIds).toHaveLength(30);
    finalFour.close();
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path,
      { groups: reopenedGroups, matches }));
    const medalPlan = finalFour.initialize('career-1', edition.editionId);
    put(medalPlan.semifinalGames[0], edition.editionId);
    expect(finalFour.medalGames('career-1', edition.editionId)).toBeNull();
    finalFour.close();
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path,
      { groups: reopenedGroups, matches }));
    expect(finalFour.readPlan('career-1', edition.editionId)).toEqual(medalPlan);
    put(medalPlan.semifinalGames[1], edition.editionId);
    const medals = finalFour.medalGames('career-1', edition.editionId)!;
    put(medals.finalGame, edition.editionId);
    expect(finalFour.finalize('career-1', edition.editionId)).toBeNull();
    put(medals.bronzeGame, edition.editionId);
    const outcome = finalFour.finalize('career-1', edition.editionId)!;
    expect(outcome.championNationId).toBe(medals.finalGame.homeNationId);
    expect(outcome.bronzeNationId).toBe(medals.bronzeGame.homeNationId);
    const rankedHistory = history.recordPremier('career-1', edition.editionId);
    expect(rankedHistory.editions[1].tier).toBe('PREMIER_12');
    expect(rankedHistory.editions[1].games).toHaveLength(34);
    expect(history.recordPremier('career-1', edition.editionId)).toEqual(rankedHistory);
    expect(rankings.readRanking('career-1', 30)).toEqual(ranking);
    const laterRanking = rankings.initialize({ careerId: 'career-1',
      asOfDay: 55, nationIds, policy, registry });
    expect(laterRanking.evidenceResultIds).toHaveLength(49);
    expect(history.readHistory('career-1')).toEqual(rankedHistory);
    finalFour.close();
    finalFour = track(openSqlitePremierTwelveFinalFourStore(path,
      { groups: reopenedGroups, matches }));
    expect(finalFour.readOutcome('career-1', edition.editionId)).toEqual(outcome);
    expect(() => reopenedGroups.initialize({ ...request,
      edition: { ...edition, drawSnapshotId: 'changed' } })).toThrow('frozen differently');
    cutoff = { ...cutoff, day: 29 };
    expect(() => finalFour!.readOutcome('career-1', edition.editionId)).toThrow('corrupt');
    cutoff = { ...cutoff, day: 30 };
    cutoff = { ...cutoff, day: 55 };
    expect(() => reopenedGroups.readPlan('career-1', edition.editionId))
      .toThrow('corrupt');
    cutoff = { ...cutoff, day: 30 };
    const binding = fixtures.get(medals.finalGame.gameId)!;
    fixtures.set(medals.finalGame.gameId, { ...binding, venueId: 'wrong' });
    expect(() => history.readHistory('career-1')).toThrow('corrupt');
    expect(rankings.readRanking('career-1', 30)).toEqual(ranking);
    fixtures.set(medals.finalGame.gameId, binding);
    const db = new DatabaseSync(path);
    db.prepare("UPDATE world_premier_twelve_final_four SET outcome_json='{}'").run();
    db.close();
    expect(() => finalFour!.readOutcome('career-1', edition.editionId)).toThrow('corrupt');
  } finally {
    closables.reverse().forEach((store) => store.close());
    rmSync(directory, { recursive: true, force: true });
  }
});
