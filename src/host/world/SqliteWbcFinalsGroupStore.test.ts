import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { WbcBerthAllocation } from
  '../../core/world/competition/WbcBerths';
import type { WbcFinalsGroupEdition } from
  '../../core/world/competition/WbcFinalsGroups';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import { openSqliteWbcFinalsGroupStore } from
  './SqliteWbcFinalsGroupStore';
import { openSqliteWbcFinalsKnockoutStore } from
  './SqliteWbcFinalsKnockoutStore';
import type { WbcKnockoutEdition, WbcKnockoutGame } from
  '../../core/world/competition/WbcFinalsKnockout';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const nationIds = Array.from({ length: 24 }, (_, index) =>
  `nation-${index}`);
const berths: WbcBerthAllocation = {
  editionId: 'wbc-2032', cycleId: 'cycle-2032',
  policyVersion: 'wbc-v1', cutoffSnapshotId: 'cutoff-2032',
  qualificationSnapshotId: 'qualified-2032',
  previousWorldEditionIds: ['wbc-2024', 'wbc-2028'],
  directBerthsByRegion: { ASIA_PACIFIC: 5, AMERICAS: 5,
    EUROPE: 4, AFRICA: 2 },
  coefficientSources: [], regionalPlacementSources: [],
  entrantNationIds: nationIds, slots: [],
};
const edition: WbcFinalsGroupEdition = {
  competitionId: 'wbc', editionId: berths.editionId,
  canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
  formatVersion: 'wbc-24-v1', ruleProfileVersion: 'wbc-rules-v1',
  gamePolicyVersion: 'wbc-game-v1',
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
    nationIds: nationIds.slice(groupIndex * 4,
      groupIndex * 4 + 4) })),
};

it('freezes six WBC pools and replays 36 official Match finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-wbc-groups-'));
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
  const sources = { berths: { readAllocation: () => berths }, matches };
  try {
    const store = openSqliteWbcFinalsGroupStore(path, sources);
    const plan = store.initialize({ careerId: 'career-1', edition });
    const games = plan.groups.flatMap((group) => group.games);
    expect(games).toHaveLength(36);
    expect(store.finalize('career-1', edition.editionId)).toBeNull();
    games.forEach((game, index) => {
      const result: OfficialGameResult = {
        gameId: game.gameId, seasonId: edition.editionId,
        homeClubId: game.homeNationId,
        awayClubId: game.awayNationId,
        homeRuns: 2, awayRuns: 1,
        winnerClubId: game.homeNationId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId(edition.ruleProfileVersion),
        gamePolicyVersion: edition.gamePolicyVersion,
        closureId: `closure-${index}`,
        applicationId: `application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId,
          venueId: game.venueId,
          fixtureEventId: `fixture-${index}`, fixtureRevision: 1 },
        lineScore: { innings: [{ inning: 1,
          homeRuns: 2, awayRuns: 1 }], totals: {
          home: { runs: 2, hits: 0, errors: 0 },
          away: { runs: 1, hits: 0, errors: 0 } } },
      };
      finals.set(game.gameId, result);
      fixtures.set(game.gameId, result.venueBinding!);
    });
    const outcome = store.finalize('career-1', edition.editionId)!;
    expect(outcome.roundOf16NationIds).toHaveLength(16);
    const knockoutEdition: WbcKnockoutEdition = {
      competitionId: edition.competitionId,
      editionId: edition.editionId,
      canonicalRole: 'NATIONAL_WORLD_CHAMPIONSHIP',
      qualificationSnapshotId: edition.qualificationSnapshotId,
      groupDrawSnapshotId: edition.drawSnapshotId,
      ruleProfileVersion: edition.ruleProfileVersion,
      gamePolicyVersion: edition.gamePolicyVersion,
      knockoutPolicyVersion: 'wbc-knockout-v1',
      hostNationId: 'US',
      roundOf16Pairs: Array.from({ length: 8 }, (_, index) =>
        [index * 2, index * 2 + 1] as const),
      knockoutHubs: [{ cityId: 'us-hub-a', venueId: 'hub-a' },
        { cityId: 'us-hub-b', venueId: 'hub-b' }],
      roundOf16HubIndices: [0, 1, 0, 1, 0, 1, 0, 1],
      quarterfinalHubIndices: [0, 1, 0, 1],
      finalFourHost: { cityId: 'us-final-city',
        venueId: 'us-final-venue' },
    };
    const knockout = openSqliteWbcFinalsKnockoutStore(path,
      { groups: store, matches });
    const knockoutPlan = knockout.initialize({
      careerId: 'career-1', edition: knockoutEdition });
    expect(knockoutPlan.roundOf16Games).toHaveLength(8);
    expect(knockout.quarterfinalGames('career-1',
      edition.editionId)).toBeNull();
    const putKnockout = (game: WbcKnockoutGame,
      index: number): void => {
      const result: OfficialGameResult = {
        gameId: game.gameId, seasonId: edition.editionId,
        homeClubId: game.homeNationId,
        awayClubId: game.awayNationId,
        homeRuns: 3, awayRuns: 1,
        winnerClubId: game.homeNationId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId(edition.ruleProfileVersion),
        gamePolicyVersion: edition.gamePolicyVersion,
        closureId: `knockout-closure-${index}`,
        applicationId: `knockout-application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId,
          venueId: game.venueId,
          fixtureEventId: `knockout-fixture-${index}`,
          fixtureRevision: 1 },
        lineScore: { innings: [{ inning: 1,
          homeRuns: 3, awayRuns: 1 }], totals: {
          home: { runs: 3, hits: 0, errors: 0 },
          away: { runs: 1, hits: 0, errors: 0 } } },
      };
      finals.set(game.gameId, result);
      fixtures.set(game.gameId, result.venueBinding!);
    };
    knockoutPlan.roundOf16Games.forEach(putKnockout);
    const quarters = knockout.quarterfinalGames('career-1',
      edition.editionId)!;
    expect(quarters).toHaveLength(4);
    quarters.forEach((game, index) => putKnockout(game, index + 8));
    const semis = knockout.semifinalGames('career-1',
      edition.editionId)!;
    expect(semis).toHaveLength(2);
    semis.forEach((game, index) => putKnockout(game, index + 12));
    const finalGame = knockout.finalGame('career-1',
      edition.editionId)!;
    putKnockout(finalGame, 14);
    const champion = knockout.finalize('career-1',
      edition.editionId)!;
    expect(champion.championNationId).toBe(finalGame.homeNationId);
    expect(knockout.readEvidence('career-1',
      edition.editionId)?.outcome).toEqual(champion);
    knockout.close();
    store.close();
    const reopened = openSqliteWbcFinalsGroupStore(path, sources);
    expect(reopened.readEvidence('career-1', edition.editionId)?.outcome)
      .toEqual(outcome);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_wbc_finals_groups
      SET outcome_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteWbcFinalsGroupStore(path, sources);
    expect(() => tampered.readOutcome('career-1', edition.editionId))
      .toThrow('corrupt WBC finals groups');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-wbc-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
