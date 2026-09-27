import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, sep } from 'node:path';
import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { EMPTY_COMPETITION_DRAW_POLICY_REGISTRY,
  registerCompetitionDrawPolicy, type CompetitionDraw } from
  '../../core/world/competition/CompetitionDraw';
import { createCompetitionEdition } from
  '../../core/world/competition/CompetitionEdition';
import type { OfficialGameResult } from
  '../../core/world/competition/OfficialGameCompletion';
import type { PostseasonMatchSource } from './PostseasonResultsFromMatches';
import { openSqliteAfricaGroupHubStore } from
  './SqliteAfricaGroupHubStore';
import { openSqliteAfricaFinalFourStore } from
  './SqliteAfricaFinalFourStore';

const { DatabaseSync }: typeof import('node:sqlite') =
  createRequire(import.meta.url)('node:sqlite');
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
  hostingPolicyVersion: 'africa-hubs-v1',
  drawPolicyVersion: 'draw-v1', drawPolicy: {
    version: 'draw-v1', relaxationOrder: draw.relaxationOrder },
  awardPolicyVersion: 'awards-v1', canonicalRole: 'AFBCL' };
const registry = registerCompetitionDrawPolicy(
  EMPTY_COMPETITION_DRAW_POLICY_REGISTRY, profile.drawPolicy);
const edition = createCompetitionEdition(profile, {
  editionId: draw.editionId,
  qualificationSnapshotId: 'afbcl-qualified',
  participantIds: draw.groups.flatMap((group) =>
    group.map((team) => team.teamId)),
  host: { nationId: 'nation-final',
    cityIds: ['city-north', 'city-south', 'city-final'],
    venueIds: ['venue-north', 'venue-south', 'venue-final'] },
  calendarWindow: { startsOnDay: 1, endsOnDay: 30 },
  drawSnapshotId: 'afbcl-draw', prestigeAtEdition: 1,
  finalFourHostCandidates: [{ venueId: 'venue-final',
    nationId: 'nation-final', cityId: 'city-final',
    regionId: 'region-final', eligible: true,
    suitabilityScore: 10, rotationScore: 1 }],
  finalFourPairingPolicy: { version: 'afbcl-sf-v1',
    semifinalPairs: [[0, 3], [1, 2]] },
  groupHubs: [{ groupIndex: 0, nationId: 'nation-north',
    cityId: 'city-north', venueId: 'venue-north' },
  { groupIndex: 1, nationId: 'nation-south',
    cityId: 'city-south', venueId: 'venue-south' }],
}, registry);
const request = { careerId: 'career-1', editionId: draw.editionId,
  tiebreakPolicy: { version: 'africa-rank-v1',
    tieCreditNumerator: 0, tieCreditDenominator: 1,
    runDifferentialCapPerGame: 5 } };

it('freezes both African hubs and replays all 36 Match finals', () => {
  const directory = mkdtempSync(join(tmpdir(), 'kneekura-africa-groups-'));
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
    draws: { readDraw: () => ({ drawSnapshotId:
      edition.drawSnapshotId, draw }) }, matches };
  try {
    const store = openSqliteAfricaGroupHubStore(path, sources);
    const plan = store.initialize(request);
    expect(plan.groups.flatMap((group) => group.games))
      .toHaveLength(36);
    expect(store.finalize('career-1', draw.editionId))
      .toBeNull();
    plan.groups.flatMap((group) => group.games)
      .forEach((game, index) => {
        const homeWon = game.homeClubId < game.awayClubId;
        const homeRuns = homeWon ? 2 : 1;
        const awayRuns = homeWon ? 1 : 2;
        const result: OfficialGameResult = {
          gameId: game.gameId, seasonId: draw.editionId,
          homeClubId: game.homeClubId,
          awayClubId: game.awayClubId,
          homeRuns, awayRuns,
          winnerClubId: homeWon ? game.homeClubId
            : game.awayClubId,
          completionReason: 'BOTTOM_COMPLETE',
          ruleProfileId: asRuleProfileId('africa-rules-v1'),
          gamePolicyVersion: 'afbcl-game-v1',
          closureId: `closure-${index}`,
          applicationId: `application-${index}`,
          durableRevision: 1,
          venueBinding: { gameId: game.gameId,
            venueId: game.neutralVenueId,
            fixtureEventId: `fixture-${index}`,
            fixtureRevision: 1 },
          lineScore: { innings: [{ inning: 1,
            homeRuns, awayRuns }], totals: {
            home: { runs: homeRuns, hits: 0, errors: 0 },
            away: { runs: awayRuns, hits: 0, errors: 0 } } },
        };
        finals.set(game.gameId, result);
        fixtures.set(game.gameId, result.venueBinding!);
      });
    const outcome = store.finalize('career-1', draw.editionId)!;
    expect(outcome.groups.map((group) =>
      group.qualifierClubIds))
      .toEqual([['a', 'b'], ['e', 'f']]);
    expect(store.readResults('career-1', draw.editionId))
      .toHaveLength(36);
    const finalsStore = openSqliteAfricaFinalFourStore(path,
      { ...sources, groups: store });
    const finalPlan = finalsStore.initialize('career-1', draw.editionId);
    expect(finalPlan.hostVenueId).toBe('venue-final');
    expect(finalsStore.finalize('career-1', draw.editionId))
      .toBeNull();
    const putKnockout = (game: { gameId: string;
      homeClubId: string; awayClubId: string;
      neutralVenueId: string }, index: number): void => {
      const result: OfficialGameResult = {
        gameId: game.gameId, seasonId: draw.editionId,
        homeClubId: game.homeClubId,
        awayClubId: game.awayClubId,
        homeRuns: 2, awayRuns: 1,
        winnerClubId: game.homeClubId,
        completionReason: 'BOTTOM_COMPLETE',
        ruleProfileId: asRuleProfileId('africa-rules-v1'),
        gamePolicyVersion: 'afbcl-game-v1',
        closureId: `knockout-closure-${index}`,
        applicationId: `knockout-application-${index}`,
        durableRevision: 1,
        venueBinding: { gameId: game.gameId,
          venueId: game.neutralVenueId,
          fixtureEventId: `knockout-fixture-${index}`,
          fixtureRevision: 1 },
        lineScore: { innings: [{ inning: 1,
          homeRuns: 2, awayRuns: 1 }], totals: {
          home: { runs: 2, hits: 0, errors: 0 },
          away: { runs: 1, hits: 0, errors: 0 } } },
      };
      finals.set(game.gameId, result);
      fixtures.set(game.gameId, result.venueBinding!);
    };
    finalPlan.semifinalGames.forEach(putKnockout);
    expect(finalsStore.finalize('career-1', draw.editionId))
      .toBeNull();
    putKnockout({ gameId: finalPlan.finalGameId,
      homeClubId: finalPlan.semifinalGames[0].homeClubId,
      awayClubId: finalPlan.semifinalGames[1].homeClubId,
      neutralVenueId: finalPlan.hostVenueId }, 2);
    const champion = finalsStore.finalize('career-1',
      draw.editionId)!;
    expect(champion.championClubId).toBe(
      champion.finalGame.homeClubId);
    finalsStore.close();
    const reopenedFinals = openSqliteAfricaFinalFourStore(path,
      { ...sources, groups: store });
    expect(reopenedFinals.readOutcome('career-1', draw.editionId))
      .toEqual(champion);
    reopenedFinals.close();
    store.close();
    const reopened = openSqliteAfricaGroupHubStore(path, sources);
    expect(reopened.readOutcome('career-1', draw.editionId))
      .toEqual(outcome);
    reopened.close();
    const database = new DatabaseSync(path);
    database.prepare(`UPDATE world_africa_group_hubs
      SET outcome_json='{}' WHERE career_id='career-1'`).run();
    database.close();
    const tampered = openSqliteAfricaGroupHubStore(path, sources);
    expect(() => tampered.readOutcome('career-1', draw.editionId))
      .toThrow('corrupt Africa group hubs');
    tampered.close();
  } finally {
    const root = realpathSync(tmpdir());
    const target = realpathSync(directory);
    if (!target.startsWith(`${root}${sep}`)
      || !basename(target).startsWith('kneekura-africa-groups-')) {
      throw new Error('test cleanup target escaped its temporary directory');
    }
    rmSync(target, { recursive: true, force: true });
  }
});
