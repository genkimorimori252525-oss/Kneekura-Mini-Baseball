import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { CompetitionDraw } from
  '../../core/world/competition/CompetitionDraw';
import type { CompetitionEditionSnapshot } from
  '../../core/world/competition/CompetitionEdition';
import { assignContinentalGroupHomeSeries,
  createHomeFairnessLedger } from
  '../../core/world/competition/ContinentalHomeFairness';
import { createContinentalGroupGamePlan } from
  '../../core/world/competition/ContinentalGroupResults';
import { finalizeContinentalQuarterfinals,
  planContinentalQuarterfinals } from
  '../../core/world/competition/ContinentalQuarterfinals';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import { openSqliteContinentalGroupResultsStore } from
  './SqliteContinentalGroupResultsStore';
import { openSqliteContinentalQuarterfinalStore } from
  './SqliteContinentalQuarterfinalStore';
import { openSqliteContinentalFinalFourStore } from
  './SqliteContinentalFinalFourStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
const draw: CompetitionDraw = {
  editionId: 'edition-1', drawPolicyVersion: 'draw-v1',
  drawSeed: 'seed-1', relaxationOrder: ['REMATCH_AVOIDANCE',
    'REGIONAL_DIVERSITY', 'SAME_LEAGUE_AVOIDANCE'],
  groups: ['abcd', 'efgh', 'ijkl', 'mnop'].map((members) =>
    [...members].map((teamId, index) => ({ teamId, pot: index + 1,
      leagueId: `league-${teamId}`, regionId: `region-${teamId}` }))),
  appliedConstraints: [], relaxedConstraints: [],
  softViolationCounts: { sameLeague: 0, sameRegion: 0, rematch: 0 },
};
const assignment = assignContinentalGroupHomeSeries({
  competitionId: 'continental-a', editionId: draw.editionId,
  editionOrdinal: 0, expectedRevision: 0, draw,
  ledger: createHomeFairnessLedger('continental-a'),
  policy: { version: 'home-v1', recentEditionWeights: [1] },
});
const plan = createContinentalGroupGamePlan(assignment);
const games = plan.groups.flatMap((group) => group.games);
const finals = new Map(games.map((game, index):
  [string, OfficialGameResult] => {
  const homeWon = game.homeClubId < game.awayClubId;
  const homeRuns = homeWon ? 2 : 1;
  const awayRuns = homeWon ? 1 : 2;
  return [game.gameId, { ...game, seasonId: draw.editionId,
    homeRuns, awayRuns,
    winnerClubId: homeWon ? game.homeClubId : game.awayClubId,
    completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('continental-rules-v1'),
    gamePolicyVersion: 'group-game-v1', closureId: `closure-${index}`,
    applicationId: `application-${index}`, durableRevision: 1,
    venueBinding: { gameId: game.gameId, venueId: 'venue-1',
      fixtureEventId: `fixture-${index}`, fixtureRevision: 0 },
    lineScore: { innings: [{ inning: 1, homeRuns, awayRuns }],
      totals: { home: { runs: homeRuns, hits: 1, errors: 0 },
        away: { runs: awayRuns, hits: 1, errors: 0 } } },
  }];
}));
const fixtures = new Map([...finals].map(([gameId, result]) =>
  [gameId, result.venueBinding!]));
const matches = {
  getMatch: (gameId: string) => {
    const finalResult = finals.get(gameId);
    return finalResult ? { finalResult } : null;
  },
  getOfficialFixture: (gameId: string) => fixtures.get(gameId) ?? null,
} as PostseasonMatchSource;
const homes = { readAssignment: (_careerId: string, editionId: string) =>
  editionId === 'edition-1' ? { assignment, groupGamePlan: plan } : null };
const request = { careerId: 'career-1', editionId: 'edition-1',
  tiebreakPolicy: { version: 'group-tiebreak-v1',
    tieCreditNumerator: 0, tieCreditDenominator: 1,
    runDifferentialCapPerGame: 5 } };

it('freezes only 72 fixture-bound Match finals and replays standings', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-groups-'));
  const path = join(directory, 'world.sqlite');
  try {
    const store = openSqliteContinentalGroupResultsStore(path,
      { homes, matches });
    const first = finals.get(games[0].gameId)!;
    finals.delete(games[0].gameId);
    expect(store.finalize(request)).toBeNull();
    expect(store.readResults('career-1', 'edition-1')).toBeNull();
    finals.set(games[0].gameId, first);
    const value = store.finalize(request)!;
    expect(value.groups.map((group) => group.qualifierClubIds))
      .toEqual([['a', 'b'], ['e', 'f'], ['i', 'j'], ['m', 'n']]);
    expect(store.finalize(request)).toEqual(value);
    store.close();
    const reopened = openSqliteContinentalGroupResultsStore(path,
      { homes, matches });
    expect(reopened.readResults('career-1', 'edition-1')).toEqual(value);
    expect(() => reopened.finalize({ ...request,
      tiebreakPolicy: { ...request.tiebreakPolicy,
        version: 'changed' } })).toThrow('already frozen differently');
    const corrupted = { ...first, venueBinding: { ...first.venueBinding!,
      fixtureRevision: 1 } };
    finals.set(first.gameId, corrupted);
    expect(() => reopened.readResults('career-1', 'edition-1'))
      .toThrow('corrupt continental group results');
    finals.set(first.gameId, first);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_continental_group_results
      SET snapshot_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteContinentalGroupResultsStore(path,
      { homes, matches });
    expect(() => tampered.readResults('career-1', 'edition-1'))
      .toThrow('corrupt continental group results');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

it('draws from frozen group qualifiers and advances only decided Match finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-groups-'));
  const path = join(directory, 'world.sqlite');
  const groups = openSqliteContinentalGroupResultsStore(path,
    { homes, matches });
  const quarters = openSqliteContinentalQuarterfinalStore(path,
    { homes, groups, matches });
  const added: string[] = [];
  try {
    groups.finalize(request);
    const input = { careerId: 'career-1', editionId: 'edition-1',
      policyVersion: 'quarter-v1', drawSeed: 'quarter-seed' };
    const quarterPlan = quarters.initialize(input);
    expect(quarterPlan.games).toHaveLength(4);
    expect(quarters.readPlan('career-1', 'edition-1')).toEqual(quarterPlan);
    expect(() => quarters.initialize({ ...input,
      drawSeed: 'changed' })).toThrow('already frozen differently');
    expect(quarters.finalize('career-1', 'edition-1')).toBeNull();
    quarterPlan.games.forEach((game, index) => {
      const final: OfficialGameResult = {
        ...game, seasonId: 'edition-1', homeRuns: 2, awayRuns: 1,
        winnerClubId: game.homeClubId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId('continental-rules-v1'),
        gamePolicyVersion: 'quarter-game-v1',
        closureId: `quarter-closure-${index}`,
        applicationId: `quarter-application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId, venueId: 'venue-1',
          fixtureEventId: `quarter-fixture-${index}`,
          fixtureRevision: 0 },
        lineScore: { innings: [{ inning: 1,
          homeRuns: 2, awayRuns: 1 }],
          totals: { home: { runs: 2, hits: 1, errors: 0 },
            away: { runs: 1, hits: 1, errors: 0 } } },
      };
      finals.set(game.gameId, final);
      fixtures.set(game.gameId, final.venueBinding!);
      added.push(game.gameId);
    });
    const outcome = quarters.finalize('career-1', 'edition-1')!;
    expect(outcome.winnerClubIds).toEqual(quarterPlan.games.map((game) =>
      game.homeClubId));
    expect(quarters.readOutcome('career-1', 'edition-1'))
      .toEqual(outcome);
    quarters.close();
    const reopened = openSqliteContinentalQuarterfinalStore(path,
      { homes, groups, matches });
    expect(reopened.readOutcome('career-1', 'edition-1'))
      .toEqual(outcome);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_continental_quarterfinals
      SET outcome_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteContinentalQuarterfinalStore(path,
      { homes, groups, matches });
    expect(() => tampered.readOutcome('career-1', 'edition-1'))
      .toThrow('corrupt continental quarterfinals');
    tampered.close();
  } finally {
    added.forEach((gameId) => {
      finals.delete(gameId);
      fixtures.delete(gameId);
    });
    quarters.close();
    groups.close();
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});

it('replays the Edition-hosted final four through a Match champion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-groups-'));
  const path = join(directory, 'world.sqlite');
  const quarterfinalSource = { groupPlan: plan,
    groupOfficialResults: games.map((game) => finals.get(game.gameId)!),
    groupTiebreakPolicy: request.tiebreakPolicy };
  const quarterfinalPlan = planContinentalQuarterfinals({
    ...quarterfinalSource, policyVersion: 'quarter-v1',
    drawSeed: 'quarter-seed' });
  const official = (game: { gameId: string; homeClubId: string;
    awayClubId: string }, index: number,
    venueId: string): OfficialGameResult => ({
    ...game, seasonId: 'edition-1', homeRuns: 2, awayRuns: 1,
    winnerClubId: game.homeClubId,
    completionReason: 'BOTTOM_COMPLETE',
    ruleProfileId: asRuleProfileId('continental-rules-v1'),
    gamePolicyVersion: 'knockout-v1',
    closureId: `knockout-closure-${index}`,
    applicationId: `knockout-application-${index}`,
    durableRevision: 1,
    venueBinding: { gameId: game.gameId, venueId,
      fixtureEventId: `knockout-fixture-${index}`,
      fixtureRevision: 0 },
    lineScore: { innings: [{ inning: 1,
      homeRuns: 2, awayRuns: 1 }],
      totals: { home: { runs: 2, hits: 1, errors: 0 },
        away: { runs: 1, hits: 1, errors: 0 } } },
  });
  const quarterResults = quarterfinalPlan.games.map((game, index) =>
    official(game, index, 'venue-1'));
  const quarterfinalOutcome = finalizeContinentalQuarterfinals(
    quarterfinalPlan, quarterResults, quarterfinalSource);
  const edition = { competitionId: 'continental-a',
    editionId: 'edition-1', canonicalRole: 'CONTINENTAL_CL',
    formatVersion: 'format-v1', ruleProfileVersion: 'rules-v1',
    drawPolicyVersion: 'draw-v1', drawPolicy: {
      version: 'draw-v1', relaxationOrder: draw.relaxationOrder },
    awardPolicyVersion: 'award-v1',
    qualificationSnapshotId: 'qualifiers-v1',
    calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
    drawSnapshotId: 'draw-edition-1', prestigeAtEdition: 1,
    participantIds: plan.groups.flatMap((group) => group.memberClubIds),
    hostingPolicyVersion: 'host-v1',
    host: { nationId: 'nation-1', cityIds: ['city-1'],
      venueIds: ['neutral-1'] },
    finalFourHost: { policyVersion: 'host-v1',
      selectedNationId: 'nation-1', selectedCityId: 'city-1',
      selectedVenueId: 'neutral-1', selectedRegionId: 'region-1',
      evaluations: [] },
    finalFourPairingPolicy: { version: 'pair-v1',
      semifinalPairs: [[0, 1], [2, 3]] },
  } satisfies CompetitionEditionSnapshot;
  const quarterfinals = {
    readPlan: () => quarterfinalPlan,
    readSource: () => quarterfinalSource,
    readOutcome: () => quarterfinalOutcome,
  };
  const added: string[] = [];
  const put = (final: OfficialGameResult): void => {
    finals.set(final.gameId, final);
    fixtures.set(final.gameId, final.venueBinding!);
    added.push(final.gameId);
  };
  quarterResults.forEach(put);
  const store = openSqliteContinentalFinalFourStore(path, {
    editions: { readEdition: () => edition }, quarterfinals, matches,
  });
  try {
    const finalFourPlan = store.initialize('career-1', 'edition-1');
    expect(finalFourPlan.hostVenueId).toBe('neutral-1');
    expect(store.finalize('career-1', 'edition-1')).toBeNull();
    finalFourPlan.semifinalGames.forEach((game, index) =>
      put(official(game, index + 4, 'neutral-1')));
    expect(store.finalize('career-1', 'edition-1')).toBeNull();
    put(official({ gameId: finalFourPlan.finalGameId,
      homeClubId: finalFourPlan.semifinalGames[0].homeClubId,
      awayClubId: finalFourPlan.semifinalGames[1].homeClubId },
    6, 'neutral-1'));
    const outcome = store.finalize('career-1', 'edition-1')!;
    expect(outcome.championClubId).toBe(outcome.finalGame.homeClubId);
    expect(store.readOutcome('career-1', 'edition-1')).toEqual(outcome);
    store.close();
    const reopened = openSqliteContinentalFinalFourStore(path, {
      editions: { readEdition: () => edition }, quarterfinals, matches,
    });
    expect(reopened.readOutcome('career-1', 'edition-1')).toEqual(outcome);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_continental_final_fours
      SET outcome_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteContinentalFinalFourStore(path, {
      editions: { readEdition: () => edition }, quarterfinals, matches,
    });
    expect(() => tampered.readOutcome('career-1', 'edition-1'))
      .toThrow('corrupt continental final four');
    tampered.close();
  } finally {
    added.forEach((gameId) => {
      finals.delete(gameId);
      fixtures.delete(gameId);
    });
    store.close();
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
