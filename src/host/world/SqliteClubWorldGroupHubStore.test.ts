import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { ClubWorldBerthAllocation, ClubWorldRegion } from
  '../../core/world/competition/ClubWorldBerths';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy } from
  '../../core/world/competition/CompetitionDraw';
import { createCompetitionEdition } from
  '../../core/world/competition/CompetitionEdition';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import { openSqliteClubWorldGroupHubStore } from
  './SqliteClubWorldGroupHubStore';
import { openSqliteClubWorldQuarterfinalStore } from
  './SqliteClubWorldQuarterfinalStore';
import { openSqliteClubWorldFinalFourStore } from
  './SqliteClubWorldFinalFourStore';
import { openSqliteClubWorldChampionHistoryStore } from
  './SqliteClubWorldChampionHistoryStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
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
  cycleId: 'cycle-2024-2027', fourYearSeasonIds: ['2024', '2025',
    '2026', '2027'],
  hostSnapshotId: 'host-2028', coefficientSources: [], rankingSources: [],
  performanceBerthsByRegion: { ASIA_PACIFIC: 4, AMERICAS: 3,
    EUROPE: 2, AFRICA: 1 }, entrantClubIds: clubIds,
  slots: clubIds.map((clubId, berthIndex) => ({ berthIndex, clubId,
    region: regions[berthIndex % 4], route: 'REGIONAL_PERFORMANCE',
    originalClubId: null, sourceId: 'ranking', skippedClubIds: [] })),
};
const request = { careerId: 'career-1', editionId: edition.editionId,
  drawSeed: 'world-draw-seed',
  drawParticipants: clubIds.map((teamId, index) => ({ teamId,
    pot: Math.floor(index / 4) + 1,
    leagueId: `league-${index}`, regionId: regions[index % 4] })),
  drawRegistry: registry,
  rematchPairs: [] as readonly (readonly [string, string])[],
  tiebreakPolicy: { version: 'world-rank-v1',
    tieCreditNumerator: 0, tieCreditDenominator: 1,
    runDifferentialCapPerGame: 5 },
};

it('pins four Club World hubs and replays 72 official Match finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-world-groups-'));
  const path = join(directory, 'world.sqlite');
  const finals = new Map<string, OfficialGameResult>();
  const fixtures = new Map<string,
    NonNullable<OfficialGameResult['venueBinding']>>();
  const matches = {
    getMatch: (gameId: string) => {
      const finalResult = finals.get(gameId);
      return finalResult ? { finalResult } : null;
    },
    getOfficialFixture: (gameId: string) =>
      fixtures.get(gameId) ?? null,
  } as PostseasonMatchSource;
  const sources = { editions: { readEdition: () => edition },
    berths: { readAllocation: () => berths }, matches };
  try {
    const store = openSqliteClubWorldGroupHubStore(path, sources);
    const plan = store.initialize(request);
    const games = plan.groups.flatMap((group) => group.games);
    expect(games).toHaveLength(72);
    expect(store.finalize('career-1', edition.editionId)).toBeNull();
    games.forEach((game, index) => {
      const homeWon = game.homeClubId < game.awayClubId;
      const homeRuns = homeWon ? 2 : 1;
      const awayRuns = homeWon ? 1 : 2;
      const result: OfficialGameResult = {
        gameId: game.gameId, seasonId: edition.editionId,
        homeClubId: game.homeClubId, awayClubId: game.awayClubId,
        homeRuns, awayRuns,
        winnerClubId: homeWon ? game.homeClubId : game.awayClubId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId('rules-v1'),
        gamePolicyVersion: 'world-game-v1',
        closureId: `closure-${index}`,
        applicationId: `application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId,
          venueId: game.neutralVenueId,
          fixtureEventId: game.fixtureEventId, fixtureRevision: 1 },
        lineScore: { innings: [{ inning: 1,
          homeRuns, awayRuns }], totals: {
          home: { runs: homeRuns, hits: 0, errors: 0 },
          away: { runs: awayRuns, hits: 0, errors: 0 } } },
      };
      finals.set(game.gameId, result);
      fixtures.set(game.gameId, result.venueBinding!);
    });
    const outcome = store.finalize('career-1', edition.editionId)!;
    expect(outcome.groups.every((group) =>
      group.qualifierClubIds?.length === 2)).toBe(true);
    expect(store.readResults('career-1', edition.editionId))
      .toHaveLength(72);
    const quarters = openSqliteClubWorldQuarterfinalStore(path,
      { groups: store, matches });
    const quarterPlan = quarters.initialize('career-1', edition.editionId);
    expect(quarterPlan.games).toHaveLength(4);
    expect(quarters.finalize('career-1', edition.editionId))
      .toBeNull();
    quarterPlan.games.forEach((game, index) => {
      const result: OfficialGameResult = {
        gameId: game.gameId, seasonId: edition.editionId,
        homeClubId: game.homeClubId, awayClubId: game.awayClubId,
        homeRuns: 2, awayRuns: 1, winnerClubId: game.homeClubId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId('rules-v1'),
        gamePolicyVersion: 'world-game-v1',
        closureId: `quarter-closure-${index}`,
        applicationId: `quarter-application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId,
          venueId: game.neutralVenueId,
          fixtureEventId: game.fixtureEventId, fixtureRevision: 1 },
        lineScore: { innings: [{ inning: 1,
          homeRuns: 2, awayRuns: 1 }], totals: {
          home: { runs: 2, hits: 0, errors: 0 },
          away: { runs: 1, hits: 0, errors: 0 } } },
      };
      finals.set(game.gameId, result);
      fixtures.set(game.gameId, result.venueBinding!);
    });
    const quarterOutcome = quarters.finalize('career-1',
      edition.editionId)!;
    expect(quarterOutcome.winnerClubIds)
      .toEqual(quarterPlan.games.map((game) => game.homeClubId));
    const finalStore = openSqliteClubWorldFinalFourStore(path,
      { quarterfinals: quarters, matches });
    const finalPlan = finalStore.initialize('career-1', edition.editionId);
    expect(finalPlan.semifinalGames).toHaveLength(2);
    expect(finalStore.finalize('career-1', edition.editionId))
      .toBeNull();
    const putFinal = (game: { gameId: string; homeClubId: string;
      awayClubId: string; neutralVenueId: string;
      fixtureEventId: string }, index: number): void => {
      const result: OfficialGameResult = {
        gameId: game.gameId, seasonId: edition.editionId,
        homeClubId: game.homeClubId, awayClubId: game.awayClubId,
        homeRuns: 2, awayRuns: 1, winnerClubId: game.homeClubId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId('rules-v1'),
        gamePolicyVersion: 'world-game-v1',
        closureId: `final-closure-${index}`,
        applicationId: `final-application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId,
          venueId: game.neutralVenueId,
          fixtureEventId: game.fixtureEventId, fixtureRevision: 1 },
        lineScore: { innings: [{ inning: 1,
          homeRuns: 2, awayRuns: 1 }], totals: {
          home: { runs: 2, hits: 0, errors: 0 },
          away: { runs: 1, hits: 0, errors: 0 } } },
      };
      finals.set(game.gameId, result);
      fixtures.set(game.gameId, result.venueBinding!);
    };
    finalPlan.semifinalGames.forEach(putFinal);
    expect(finalStore.finalize('career-1', edition.editionId))
      .toBeNull();
    putFinal({ gameId: finalPlan.finalGameId,
      homeClubId: finalPlan.semifinalGames[0].homeClubId,
      awayClubId: finalPlan.semifinalGames[1].homeClubId,
      neutralVenueId: finalPlan.hostVenueId,
      fixtureEventId: finalPlan.finalFixtureEventId }, 2);
    const champion = finalStore.finalize('career-1',
      edition.editionId)!;
    expect(champion.championClubId).toBe(
      finalPlan.semifinalGames[0].homeClubId);
    const titleStore = openSqliteClubWorldChampionHistoryStore(path,
      { finals: finalStore });
    titleStore.initialize('career-1', edition.competitionId);
    const titles = titleStore.record('career-1', edition.editionId);
    expect(titles.champions).toHaveLength(1);
    expect(titleStore.record('career-1', edition.editionId))
      .toEqual(titles);
    expect(titleStore.authority('career-1').defendingWorldChampion(29))
      .toBeNull();
    expect(titleStore.authority('career-1').defendingWorldChampion(30))
      .toEqual(titles.champions[0]);
    titleStore.close();
    finalStore.close();
    quarters.close();
    const reopenedQuarters = openSqliteClubWorldQuarterfinalStore(path,
      { groups: store, matches });
    expect(reopenedQuarters.readOutcome('career-1', edition.editionId))
      .toEqual(quarterOutcome);
    reopenedQuarters.close();
    store.close();
    const reopened = openSqliteClubWorldGroupHubStore(path, sources);
    expect(reopened.readOutcome('career-1', edition.editionId))
      .toEqual(outcome);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_club_world_group_hubs
      SET outcome_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteClubWorldGroupHubStore(path, sources);
    expect(() => tampered.readOutcome('career-1', edition.editionId))
      .toThrow('corrupt Club World group hubs');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-world-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
