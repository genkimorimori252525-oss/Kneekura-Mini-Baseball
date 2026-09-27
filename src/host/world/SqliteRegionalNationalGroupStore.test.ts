import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { RegionalNationalEdition } from
  '../../core/world/competition/RegionalNationalGroups';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import { openSqliteNationCompetitionRegionStore } from
  './SqliteNationCompetitionRegionStore';
import { openSqliteRegionalNationalGroupStore } from
  './SqliteRegionalNationalGroupStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const edition: RegionalNationalEdition = {
  competitionId: 'national-europe', editionId: 'europe-2031',
  canonicalRole: 'REGIONAL_NATIONAL_CHAMPIONSHIP',
  region: 'EUROPE', formatVersion: 'groups-2-v1',
  ruleProfileVersion: 'national-rules-v1',
  gamePolicyVersion: 'national-games-v1',
  hostingPolicyVersion: 'national-hosts-v1',
  qualificationSnapshotId: 'qualification-2031',
  drawSnapshotId: 'draw-2031',
  tiebreakPolicy: { version: 'national-groups-v1',
    tieCreditNumerator: 0, tieCreditDenominator: 1,
    runDifferentialCapPerGame: 5 },
  bestThirdPolicy: { version: 'third-v1',
    criteria: ['WINS', 'CAPPED_RUN_DIFFERENTIAL',
      'RUNS_AGAINST'], drawSeed: 'third-seed' },
  hostNationIds: ['host-nation'],
  groups: [0, 1].map((groupIndex) => ({ groupIndex,
    nationIds: [0, 1, 2, 3].map((memberIndex) =>
      `nation-${groupIndex * 4 + memberIndex}`),
    hostNationId: 'host-nation',
    hostCityId: `host-city-${groupIndex}`,
    hostVenueId: `host-venue-${groupIndex}` })),
  calendarWindow: { startsOnDay: 10, endsOnDay: 30 },
};

it('replays accepted regional draw and advances only venue-bound Match finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-national-groups-'));
  const path = join(directory, 'world.sqlite');
  const regions = openSqliteNationCompetitionRegionStore(path);
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
  try {
    edition.groups.flatMap((group) => group.nationIds)
      .forEach((nationId, index) => regions.record({
        careerId: 'career-1', nationId, region: 'EUROPE',
        effectiveFromDay: 0, sourceEventId: `region-${index}` }));
    const store = openSqliteRegionalNationalGroupStore(path,
      { regions, matches });
    const plan = store.initialize('career-1', edition);
    expect(plan.groups.flatMap((group) => group.games))
      .toHaveLength(12);
    expect(store.finalize('career-1', edition.editionId)).toBeNull();
    plan.groups.flatMap((group) => group.games)
      .forEach((game, index) => {
        const result: OfficialGameResult = {
          gameId: game.gameId, seasonId: edition.editionId,
          homeClubId: game.homeNationId,
          awayClubId: game.awayNationId,
          homeRuns: 2, awayRuns: 1,
          winnerClubId: game.homeNationId,
          completionReason: 'BOTTOM_COMPLETE',
          ruleProfileId: asRuleProfileId('national-rules-v1'),
          gamePolicyVersion: 'national-games-v1',
          closureId: `closure-${index}`,
          applicationId: `application-${index}`,
          durableRevision: 1,
          venueBinding: { gameId: game.gameId,
            venueId: game.venueId,
            fixtureEventId: `fixture-${index}`,
            fixtureRevision: 1 },
          lineScore: { innings: [{ inning: 1,
            homeRuns: 2, awayRuns: 1 }], totals: {
            home: { runs: 2, hits: 1, errors: 0 },
            away: { runs: 1, hits: 1, errors: 0 } } },
        };
        finals.set(game.gameId, result);
        fixtures.set(game.gameId, result.venueBinding!);
      });
    const outcome = store.finalize('career-1', edition.editionId)!;
    expect(outcome.knockoutNationIds).toHaveLength(4);
    expect(store.readResults('career-1', edition.editionId))
      .toHaveLength(12);
    expect(() => store.initialize('career-1', {
      ...edition, drawSnapshotId: 'other' }))
      .toThrow('already frozen differently');
    regions.record({ careerId: 'career-1', nationId: 'nation-0',
      region: 'AMERICAS', effectiveFromDay: 100,
      sourceEventId: 'region-reform' });
    expect(store.readOutcome('career-1', edition.editionId))
      .toEqual(outcome);
    store.close();
    const reopened = openSqliteRegionalNationalGroupStore(path,
      { regions, matches });
    expect(reopened.readOutcome('career-1', edition.editionId))
      .toEqual(outcome);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_regional_national_groups
      SET outcome_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteRegionalNationalGroupStore(path,
      { regions, matches });
    expect(() => tampered.readOutcome('career-1', edition.editionId))
      .toThrow('corrupt regional national groups');
    tampered.close();
  } finally {
    regions.close();
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-national-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
